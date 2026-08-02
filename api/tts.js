/**
 * JARVIS Gemini text-to-speech backend for Vercel.
 *
 * Uses the existing GEMINI_API_KEY.
 *
 * Optional Vercel variables:
 *   JARVIS_TTS_MODEL=gemini-3.1-flash-tts-preview
 *   JARVIS_TTS_VOICE=Charon
 */

const DEFAULT_MODEL = "gemini-3.1-flash-tts-preview";
const DEFAULT_VOICE = "Charon";
const SAMPLE_RATE = 24000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function cleanText(value, maxLength = 4000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function pcmToWav(pcm) {
  const dataLength = pcm.length;
  const header = Buffer.alloc(44);
  const byteRate =
    SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8);
  const blockAlign =
    CHANNELS * (BITS_PER_SAMPLE / 8);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);

  return Buffer.concat([header, pcm]);
}

async function generateSpeech({
  apiKey,
  model,
  voice,
  text
}) {
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    `${encodeURIComponent(model)}:generateContent`;

  const performancePrompt = `
Synthesize speech only.

AUDIO PROFILE:
An original, sophisticated male artificial-intelligence assistant. Mature,
clear, composed, warm, highly articulate, and technically precise.

DIRECTOR'S NOTES:
Accent: Refined British English using modern Received Pronunciation.
Style: Calm, intelligent, reassuring, understated, and conversational.
Pacing: Measured but natural. Never sluggish.
Delivery: Crisp consonants, restrained emotion, confident phrasing.
Do not imitate any actor, celebrity, or copyrighted character.
Do not read these directions aloud.

SPOKEN TRANSCRIPT:
${text}
  `.trim();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: performancePrompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      `Gemini TTS failed with status ${response.status}.`
    );
  }

  const base64Audio =
    data?.candidates?.[0]?.content?.parts?.find(
      (part) => part?.inlineData?.data
    )?.inlineData?.data;

  if (!base64Audio) {
    throw new Error("Gemini TTS returned no audio.");
  }

  return Buffer.from(base64Audio, "base64");
}

export default {
  async fetch(request) {
    const apiKey = process.env.GEMINI_API_KEY;
    const model =
      cleanText(process.env.JARVIS_TTS_MODEL, 100) ||
      DEFAULT_MODEL;
    const voice =
      cleanText(process.env.JARVIS_TTS_VOICE, 100) ||
      DEFAULT_VOICE;

    if (request.method === "GET") {
      return json({
        status: "ok",
        service: "JARVIS Gemini TTS API",
        model,
        voice,
        apiKeyConfigured: Boolean(apiKey)
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Allow": "GET, POST, OPTIONS"
        }
      });
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    if (!apiKey) {
      return json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      }, 500);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request body" }, 400);
    }

    const text = cleanText(body?.text);

    if (!text) {
      return json({ error: "Missing speech text" }, 400);
    }

    let lastError;

    // The TTS preview can very occasionally return no audio.
    // Retry once automatically.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const pcm = await generateSpeech({
          apiKey,
          model,
          voice,
          text
        });

        const wav = pcmToWav(pcm);

        return new Response(new Uint8Array(wav), {
          status: 200,
          headers: {
            "Content-Type": "audio/wav",
            "Content-Length": String(wav.length),
            "Cache-Control": "no-store",
            "X-JARVIS-TTS-Voice": voice
          }
        });
      } catch (error) {
        lastError = error;
        console.error(
          `Gemini TTS attempt ${attempt + 1} failed:`,
          error
        );
      }
    }

    return json({
      error:
        lastError?.message ||
        "Unable to generate JARVIS speech."
    }, 502);
  }
};

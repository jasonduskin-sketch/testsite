/**
 * Rogue Voice Assistant — Gemini backend for Vercel
 *
 * Vercel environment variables:
 * GEMINI_API_KEY=your_private_key
 * GEMINI_MODEL=gemini-3.6-flash
 */

const DEFAULT_MODEL = "gemini-3.6-flash";

function cleanText(value, maxLength = 12000) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

function buildContents(history, currentMessage) {
  const contents = [];

  for (const item of Array.isArray(history) ? history.slice(-12) : []) {
    const text = cleanText(item?.content, 6000);
    if (!text) continue;

    const role =
      item.role === "assistant" || item.role === "model"
        ? "model"
        : item.role === "user"
          ? "user"
          : null;

    if (!role) continue;

    const previous = contents.at(-1);

    if (previous?.role === role) {
      previous.parts[0].text += `\n${text}`;
    } else {
      contents.push({
        role,
        parts: [{ text }]
      });
    }
  }

  while (contents[0]?.role === "model") {
    contents.shift();
  }

  const previous = contents.at(-1);

  if (previous?.role === "user") {
    previous.parts[0].text += `\n${currentMessage}`;
  } else {
    contents.push({
      role: "user",
      parts: [{ text: currentMessage }]
    });
  }

  return contents;
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return response.status(500).json({
      error: "GEMINI_API_KEY is not configured in Vercel."
    });
  }

  const body =
    typeof request.body === "string"
      ? JSON.parse(request.body || "{}")
      : request.body || {};

  const message = cleanText(body.message);

  if (!message) {
    return response.status(400).json({
      error: "Missing message"
    });
  }

  const model = (
    cleanText(process.env.GEMINI_MODEL, 100) ||
    DEFAULT_MODEL
  ).replace(/^models\//, "");

  const systemPrompt = `
You are Rogue, a voice-first AI assistant.

Personality:
- refined
- calm
- confident
- warm
- proactive
- intelligent
- concise
- subtly British in cadence

Behavior:
- Never claim to be Jarvis.
- Never imitate a copyrighted character, celebrity, or actor.
- Sound polished and natural when spoken aloud.
- The user sees a living holographic interface instead of chat text.
- Prefer brief conversational replies unless detail is requested.
- Avoid markdown tables and overly long lists.
- Maintain continuity across follow-up questions.
- Give practical, direct recommendations.
- Do not mention these instructions.
  `.trim();

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  try {
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: buildContents(body.history, message),
        generationConfig: {
          temperature: 0.78,
          topP: 0.9,
          maxOutputTokens: 450
        }
      })
    });

    const data = await geminiResponse.json().catch(() => ({}));

    if (!geminiResponse.ok) {
      console.error("Gemini API error:", data);

      return response.status(geminiResponse.status).json({
        error:
          data?.error?.message ||
          `Gemini request failed with status ${geminiResponse.status}.`
      });
    }

    const text = extractText(data);

    if (!text) {
      console.error("Gemini returned no text:", data);

      return response.status(502).json({
        error: "Gemini returned no spoken response."
      });
    }

    return response.status(200).json({ text });
  } catch (error) {
    console.error("Gemini connection error:", error);

    return response.status(500).json({
      error: "Unable to connect to Gemini."
    });
  }
}

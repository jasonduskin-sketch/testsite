# JARVIS Voice Assistant — Gemini Cloud Voice Edition

This update replaces unreliable device/browser speech synthesis with
server-generated Gemini TTS audio.

## What changed

- JARVIS now speaks through `api/tts.js`.
- Desktop and mobile receive the same generated voice.
- The existing `GEMINI_API_KEY` is reused.
- The default TTS model is `gemini-3.1-flash-tts-preview`.
- The default voice is `Charon`.
- The delivery prompt requests refined British English, mature articulation,
  measured pacing, and an original AI-assistant style.
- Browser speech synthesis remains only as an emergency fallback.

## Required Vercel variable

```env
GEMINI_API_KEY=your_existing_private_key
```

## Optional Vercel variables

```env
JARVIS_TTS_MODEL=gemini-3.1-flash-tts-preview
JARVIS_TTS_VOICE=Charon
```

## Health checks

```text
https://your-domain.com/api/chat
https://your-domain.com/api/youtube
https://your-domain.com/api/tts
```

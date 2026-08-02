# Rogue Voice Assistant V3 — Living Hologram

This version is not a static image or looping video. The amber hologram is drawn live in the browser using HTML Canvas.

## Living movement

- Continuous organic “breathing”
- Independent 3D-style ring rotation
- Uneven orbital movement so it does not feel mechanical
- Drifting particles at different depth planes
- Live sparks and moving energy filaments
- Subtle cursor parallax on desktop
- Listening pulse driven by real microphone volume
- Faster scanning and electrical activity while thinking
- Reactive energy membrane while speaking
- No visible transcript or chat bubbles

## Deploy

1. Upload this folder to GitHub.
2. Import it into Vercel.
3. Add:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

4. Deploy.
5. Open it in Chrome.
6. Click **Activate Voice Assistant**.
7. Grant microphone access.
8. Say **Hey Rogue**.

## Local development

```bash
npm install -g vercel
vercel dev
```

Create `.env.local` from `.env.example` before running locally.

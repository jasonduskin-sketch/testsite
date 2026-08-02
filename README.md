# Rogue Voice Assistant — Fixed Gemini Build

This build includes:

- the animated holographic frontend
- `api/chat.js` as a zero-configuration Vercel Function
- Gemini integration through `GEMINI_API_KEY`
- a browser health check at `/api/chat`

No custom `functions` pattern is used in `vercel.json`.

## Vercel variables

```env
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.6-flash
```

## Health check

Visit:

```text
https://your-domain.com/api/chat
```

A successful deployment returns JSON with `status: "ok"`.

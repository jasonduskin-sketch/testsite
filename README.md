# Rogue Voice Assistant — Complete Gemini Build

This package includes the animated holographic frontend and a Vercel Gemini
server function at:

```text
api/chat.mjs
```

## Required Vercel setting

```env
GEMINI_API_KEY=your_private_gemini_key
```

The model variable is optional:

```env
GEMINI_MODEL=gemini-3.6-flash
```

## Backend health check

After deployment, visit:

```text
https://your-domain.com/api/chat
```

A working route returns JSON showing `status: "ok"` and whether the API key
is configured.

The API key remains in Vercel and is never exposed through the browser code.

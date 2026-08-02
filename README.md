# Rogue Voice Assistant — Gemini Edition

This build uses Gemini for the assistant's intelligence while retaining the
animated HTML Canvas hologram, browser speech recognition, and browser voice.

## Required Vercel environment variables

```env
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.6-flash
```

Do not upload the real API key to GitHub.

## Updating an existing installation

Replace the existing GitHub file:

```text
api/chat.js
```

with the Gemini version included here. Then add the two environment variables
inside Vercel and redeploy the latest production deployment.

## New installation

Upload the contents of this folder to the root of the GitHub repository,
connect the repository to Vercel, add the environment variables, and deploy.

## Testing

Open the deployed HTTPS site in Chrome, activate microphone access, then say:

```text
Hey Rogue, tell me who you are.
```

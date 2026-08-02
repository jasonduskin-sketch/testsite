# JARVIS Voice Assistant — YouTube Edition

This update adds secure YouTube search and an embedded voice-controlled player.

## Vercel environment variables

```env
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.6-flash
YOUTUBE_API_KEY=your_private_youtube_data_api_key
```

## Example voice commands

```text
JARVIS, play Johnny Cash Hurt on YouTube.
Pause video.
Resume.
Turn it down.
Set volume to 30 percent.
Skip ahead 30 seconds.
Go back 10 seconds.
Next video.
Close video.
```

## API health checks

```text
https://your-domain.com/api/chat
https://your-domain.com/api/youtube
```

Both routes should return JSON with `status: "ok"`.

The YouTube key remains private in Vercel. Browser playback uses the official
YouTube IFrame Player API.


## Natural YouTube phrases

Version 5.1 recognizes conversational wording such as:

- “Can you play the Superman trailer on YouTube?”
- “Put on Alabama football highlights.”
- “Show me a Johnny Cash music video.”
- “I want to watch the new trailer on YouTube.”

Open the browser console to see whether a phrase was routed to YouTube.

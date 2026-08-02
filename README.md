# JARVIS Voice Assistant — British Voice Edition

## Conversation behavior

1. Click **Activate Voice Assistant**.
2. Say **“JARVIS”** once.
3. JARVIS answers **“At your service.”**
4. The conversation remains active for three minutes of inactivity.
5. Every exchange resets the three-minute timer.
6. Say **“Go to sleep,” “Stop listening,” “That’s all,”** or **“Stand by”**
   to end the session.

## Voice behavior

The browser now prioritizes articulate British English voices, including:

- Microsoft Ryan Online (Natural)
- Microsoft Ryan
- Microsoft George
- Microsoft Thomas
- Daniel
- Arthur
- Google UK English Male

The exact voice depends on the voices exposed by the browser and operating
system. Open Chrome's developer console to see:

```text
JARVIS voice selected: <voice name> <language>
```

## Vercel variables

```env
GEMINI_API_KEY=your_private_gemini_key
GEMINI_MODEL=gemini-3.6-flash
```

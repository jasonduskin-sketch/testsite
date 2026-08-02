/**
 * JARVIS YouTube search backend for Vercel.
 *
 * Required Vercel environment variable:
 *   YOUTUBE_API_KEY=your_private_youtube_data_api_key
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function cleanText(value, maxLength = 200) {
  return typeof value === "string"
    ? value.trim().slice(0, maxLength)
    : "";
}

export default {
  async fetch(request) {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (request.method === "GET") {
      return json({
        status: "ok",
        service: "JARVIS YouTube Search API",
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
        error: "YOUTUBE_API_KEY is not configured in Vercel."
      }, 500);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON request body" }, 400);
    }

    const query = cleanText(body?.query);

    if (!query) {
      return json({ error: "Missing YouTube search query" }, 400);
    }

    const params = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "5",
      order: "relevance",
      safeSearch: "moderate",
      videoEmbeddable: "true",
      videoSyndicated: "true",
      relevanceLanguage: "en",
      regionCode: "US",
      key: apiKey
    });

    const endpoint =
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

    try {
      const youtubeResponse = await fetch(endpoint, {
        headers: {
          "Accept": "application/json"
        }
      });

      const data = await youtubeResponse.json().catch(() => ({}));

      if (!youtubeResponse.ok) {
        console.error("YouTube Data API error:", data);

        return json({
          error:
            data?.error?.message ||
            `YouTube search failed with status ${youtubeResponse.status}.`
        }, youtubeResponse.status);
      }

      const results = Array.isArray(data?.items)
        ? data.items
            .filter((item) => item?.id?.videoId)
            .map((item) => ({
              videoId: item.id.videoId,
              title: item?.snippet?.title || "YouTube video",
              channelTitle: item?.snippet?.channelTitle || "",
              description: item?.snippet?.description || "",
              thumbnail:
                item?.snippet?.thumbnails?.high?.url ||
                item?.snippet?.thumbnails?.medium?.url ||
                item?.snippet?.thumbnails?.default?.url ||
                ""
            }))
        : [];

      if (!results.length) {
        return json({
          error: `No playable YouTube videos were found for "${query}".`
        }, 404);
      }

      return json({
        query,
        results
      });
    } catch (error) {
      console.error("YouTube connection error:", error);

      return json({
        error: "Unable to connect to YouTube."
      }, 500);
    }
  }
};

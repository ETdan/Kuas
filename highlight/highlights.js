var LOCAL_STORAGE_KEY = "match-name";
var YOUTUBE_API_KEY = "AIzaSyAN8e3dUGj_802aU1fWlukez5EO5Ckjc9o";
var HIGHLIGHTS_CACHE_PREFIX = "yt-highlights:v2:";
var CACHE_TTL_MS = 12 * 60 * 60 * 1000;

var highlightsContainer = document.getElementById("highlights-container");

async function init() {
  const match = localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!match) {
    highlightsContainer.innerHTML =
      "<p>No match data found. Please select a match from the matches page.</p>";
    return;
  }

  const query = `${match} highlights`;

  try {
    console.log(query, "query");

    const highlights = await getHighlights(query);
    // console.log(highlights, "/////////////heighlights");

    renderHighlights(highlights);
  } catch (error) {
    console.error("Error fetching highlights:", error);
    highlightsContainer.innerHTML = "";
    const errorText = document.createElement("p");
    errorText.textContent = `Failed to load highlights: ${error.message || "Unknown error"}`;
    highlightsContainer.appendChild(errorText);
  }
}

async function getHighlights(query) {
  const cacheKey = HIGHLIGHTS_CACHE_PREFIX + query.toLowerCase();
  const cached = readCache(cacheKey);

  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    part: "snippet",
    maxResults: "5",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    key: YOUTUBE_API_KEY,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  const res = await fetch(url);
  const data = await safeJson(res);

  if (!res.ok) {
    const firstError =
      data && data.error && data.error.errors && data.error.errors[0];
    const reason = firstError && firstError.reason;
    const message =
      (data && data.error && data.error.message) ||
      `YouTube API request failed with status ${res.status}`;
    throw new Error(reason ? `${message} (reason: ${reason})` : message);
  }

  if (!data.items) return [];

  const highlights = data.items
    .filter((v) => v.id && v.id.videoId)
    .map((v) => ({
      id: v.id.videoId,
      title: v.snippet.title,
      thumbnail:
        (v.snippet.thumbnails.medium && v.snippet.thumbnails.medium.url) ||
        (v.snippet.thumbnails.default && v.snippet.thumbnails.default.url) ||
        "",
    }));

  writeCache(cacheKey, highlights);
  return highlights;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return {};
  }
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || !parsed.expiresAt)
      return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch (_error) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      }),
    );
  } catch (_error) {
    // Ignore cache write failures so rendering can continue.
  }
}

function buildEmbedUrl(videoId) {
  const params = new URLSearchParams({
    feature: "oembed",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function renderHighlights(highlights) {
  if (highlights.length === 0) {
    highlightsContainer.innerHTML = "<p>No highlights found.</p>";
    return;
  }
  console.log(highlights, "filtered content");

  highlightsContainer.innerHTML = "";

  highlights.forEach((highlight) => {
    const iframeContainer = document.createElement("div");
    iframeContainer.className = "highlight-video";

    if (highlight.id) {
      const iframe = document.createElement("iframe");
      iframe.src = buildEmbedUrl(highlight.id);

      iframe.width = "560";
      iframe.height = "315";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      );
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      iframeContainer.appendChild(iframe);
    } else {
      // Fallback: show thumbnail and link
      const link = document.createElement("a");
      link.href = highlight.thumbnail;
      link.target = "_blank";
      const img = document.createElement("img");
      img.src = highlight.thumbnail;
      img.alt = highlight.title;
      link.appendChild(img);
      iframeContainer.appendChild(link);
    }

    const titleObj = document.createElement("h6");
    titleObj.textContent = highlight.title;
    iframeContainer.appendChild(titleObj);
    highlightsContainer.appendChild(iframeContainer);
  });
}

init();

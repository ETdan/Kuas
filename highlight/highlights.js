var LOCAL_STORAGE_KEY = "match-name";
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
  // const query = "Manchester United vs Bournemouth highlights";

  try {
    console.log(query, "query");

    const highlights = await getHighlights(query);
    console.log(highlights, "/////////////heighlights");

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
  const instance = "https://yewtu.be"; // You can swap this for any Invidious instance
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=date&limit=5`;
  try {
    const response = await fetch(url);
    const results = await response.json();

    // Results are already clean JSON objects
    return results.slice(0, 5).map((video) => ({
      title: video.title,
      id: video.videoId,
      author: video.author,
      thumbnail: video.videoThumbnails[0].url,
    }));
  } catch (error) {
    console.error("Invidious search failed:", error);
  }
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
    const container = document.createElement("div");
    container.className = "highlight-video";

    // Always show thumbnail as a clickable link to YouTube
    const link = document.createElement("a");
    if (highlight.id) {
      link.href = `https://www.youtube.com/watch?v=${highlight.id}`;
    } else {
      link.href = highlight.thumbnail;
    }
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = highlight.thumbnail;
    img.alt = highlight.title;
    img.className = "highlight-thumbnail";
    link.appendChild(img);
    container.appendChild(link);

    const titleObj = document.createElement("h6");
    titleObj.textContent = highlight.title;
    container.appendChild(titleObj);

    if (highlight.author) {
      const authorObj = document.createElement("div");
      authorObj.className = "highlight-author";
      authorObj.textContent = `By: ${highlight.author}`;
      container.appendChild(authorObj);
    }

    highlightsContainer.appendChild(container);
  });
}

init();

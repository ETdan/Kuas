var LOCAL_STORAGE_KEY = "match-name";
var YOUTUBE_API_KEY = "AIzaSyD58N6vYNuXQ_P7D3J3HzZLEdz1zdi6GrY";

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
    const highlights = await getHighlights(query);
    console.log(highlights, "/////////////heighlights");

    renderHighlights(highlights);
  } catch (error) {
    console.error("Error fetching highlights:", error);
    highlightsContainer.innerHTML =
      "<p>Failed to load highlights. Please try again later.</p>";
  }
}

async function getHighlights(query) {
  const url =
    "https://youtube.googleapis.com/youtube/v3/search" +
    "?part=snippet" +
    "&maxResults=5" +
    "&q=" +
    encodeURIComponent(query) +
    "&key=" +
    YOUTUBE_API_KEY;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  const data = await res.json();

  if (!data.items) return [];
  console.log(data.items, "fetched data");

  // Only return items with a valid videoId
  return data.items
    .filter((v) => v.id && v.id.videoId)
    .map((v) => ({
      id: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.medium.url,
    }));
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
      // iframe.src = `https://www.youtube.com/embed/${highlight.id}`;
      // iframe.src = `https://www.youtube.com/embed/${highlight.id}?origin=${location.origin}`;
      // Change this line in your JS
      iframe.src = `https://www.youtube.com/embed/${highlight.id}?enablejsapi=1&origin=https://www.youtube.com`;
      iframe.width = "560";
      iframe.height = "315";
      iframe.setAttribute("frameborder", "0");
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
      );
      iframe.setAttribute("allowfullscreen", "true");
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

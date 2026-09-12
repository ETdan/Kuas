/**
 * highlights.js - Match Highlights view module.
 * Matchday Edition / Broadcast Reel Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML } from "../utils.js";

const CACHE_PREFIX  = "yt-highlights:v3:";
const CACHE_TTL_MS  = 12 * 60 * 60 * 1000;
const MAX_OPTIONS   = 3;
const TIMEOUT_MS    = 2500;

const INVIDIOUS_INSTANCES = [
  "https://inv.tux.pizza",
  "https://invidious.drgns.space",
  "https://vid.puffyan.us",
];

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function readCache(key) {
  try {
    const parsed = await Storage.get(key);
    if (!parsed || !Array.isArray(parsed.data) || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) { await Storage.remove(key); return null; }
    return parsed.data;
  } catch (_e) { return null; }
}

async function writeCache(key, data) {
  try {
    await Storage.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  } catch (_e) {}
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) { clearTimeout(id); throw e; }
}

async function searchPiped(query) {
  const url = `https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=videos`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error("Piped API failed");
  const json  = await res.json();
  const items = json.items || json || [];
  return items
    .filter((v) => v.url || v.id)
    .slice(0, MAX_OPTIONS)
    .map((v) => ({
      title:     v.title || "Match Highlight",
      id:        v.url ? v.url.replace("/watch?v=", "") : v.id,
      author:    v.uploaderName || v.uploader || "",
      thumbnail: v.thumbnail || (v.id ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : ""),
    }));
}

async function searchInvidious(instance, query) {
  const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort=relevance`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Invidious failed on ${instance}`);
  const results = await res.json();
  if (!Array.isArray(results) || !results.length) return [];
  return results.slice(0, MAX_OPTIONS).map((v) => ({
    title:     v.title || "Match Highlight",
    id:        v.videoId,
    author:    v.author || "",
    thumbnail: v.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
  }));
}

async function getHighlights(query) {
  const cacheKey = CACHE_PREFIX + query;
  const cached   = await readCache(cacheKey);
  if (cached?.length) return cached;

  try {
    const results = await searchPiped(query);
    if (results.length) { await writeCache(cacheKey, results); return results; }
  } catch (_e) {}

  for (const inst of INVIDIOUS_INSTANCES) {
    try {
      const results = await searchInvidious(inst, query);
      if (results.length) { await writeCache(cacheKey, results); return results; }
    } catch (_e) {}
  }

  return [];
}

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function renderHighlightOptionHTML(highlight, index, ytSearchUrl) {
  const videoUrl = highlight.id
    ? `https://www.youtube.com/watch?v=${escapeHTML(highlight.id)}`
    : ytSearchUrl;

  const thumbHTML = highlight.thumbnail
    ? `<img class="highlight-thumbnail" src="${escapeHTML(highlight.thumbnail)}" alt="${escapeHTML(highlight.title)}" loading="lazy">`
    : `<div class="thumb-fallback">🎬</div>`;
  const authorHTML = highlight.author
    ? `<div class="highlight-author">Channel: ${escapeHTML(highlight.author)}</div>`
    : "";

  return `
    <div class="highlight-video">
      <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="highlight-link">
        <div class="thumb-frame">
          ${thumbHTML}
          <div class="play-overlay">▶</div>
        </div>
      </a>
      <div class="highlight-info">
        <span class="option-badge">REEL OPTION ${index + 1}</span>
        <h3 class="highlight-title">${escapeHTML(highlight.title)}</h3>
        ${authorHTML}
        <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="watch-now-btn">
          WATCH HIGHLIGHT ↗
        </a>
      </div>
    </div>
  `;
}

function renderHighlightsHTML(highlights, matchName, ytSearchUrl) {
  const sectionTitle = highlights.length
    ? `TOP HIGHLIGHT OPTIONS (${highlights.length}):`
    : "No pre-fetched video streams available.";

  const directCard = `
    <div class="direct-yt-card">
      <div class="direct-yt-content">
        <span class="direct-yt-icon">▶</span>
        <div class="direct-yt-text">
          <strong>Official Broadcast & YouTube Hub</strong>
          <span>Search and stream verified match highlights for "${escapeHTML(matchName)}"</span>
        </div>
      </div>
      <a href="${ytSearchUrl}" target="_blank" rel="noopener noreferrer" class="direct-yt-btn">OPEN YOUTUBE ↗</a>
    </div>
  `;

  const optionsHTML = highlights
    .slice(0, MAX_OPTIONS)
    .map((h, i) => renderHighlightOptionHTML(h, i, ytSearchUrl))
    .join("");

  return `
    ${directCard}
    <div class="highlights-section-title">${sectionTitle}</div>
    ${optionsHTML}
  `;
}

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  const matchName = await Storage.get("match-name");

  container.innerHTML = `
    <div class="highlight-header">
      <button class="back-btn" id="highlightBackBtn">
        <span class="back-arrow">‹</span> MATCHES
      </button>
      <h2 id="highlight-match-title" class="highlight-match-title">${escapeHTML(matchName || "Match Highlights")}</h2>
    </div>
    <div id="highlights-container">
      <div class="info-msg">
        <div class="loader"></div>
        <span>SEARCHING MATCH HIGHLIGHTS…</span>
      </div>
    </div>
  `;

  container.querySelector("#highlightBackBtn").addEventListener("click", () => navigate("matches"));

  const highlightsContainer = container.querySelector("#highlights-container");

  if (!matchName) {
    highlightsContainer.innerHTML = `<div class="info-msg">No match selected. Return to fixtures and pick a match.</div>`;
    return;
  }

  const query       = `${matchName} highlights`;
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const highlights = await getHighlights(query);
    highlightsContainer.innerHTML = renderHighlightsHTML(highlights, matchName, ytSearchUrl);
  } catch (err) {
    console.error("Error fetching highlights:", err);
    highlightsContainer.innerHTML = renderHighlightsHTML([], matchName, ytSearchUrl);
  }
}

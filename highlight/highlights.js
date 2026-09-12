/**
 * highlights.js - Match Highlights view module.
 * Matchday Edition / Broadcast Reel Theme
 * Extracts verified match highlights with uploaded time, duration, and direct playback.
 */

import { Storage } from "../storage.js";
import { escapeHTML } from "../utils.js";

const CACHE_PREFIX = "yt-highlights:v6:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours for archive matches
const RECENT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for active / today matches
const MAX_OPTIONS  = 4;
const TIMEOUT_MS   = 6000;

/**
 * Clean and normalize match titles so YouTube gets the best search relevance.
 * e.g. "Brentford at AFC Bournemouth" -> "AFC Bournemouth vs Brentford"
 */
export function normalizeMatchQuery(name) {
  if (!name) return "";
  let clean = name.trim();
  if (clean.includes(" at ")) {
    const parts = clean.split(" at ");
    if (parts.length === 2) {
      clean = `${parts[1].trim()} vs ${parts[0].trim()}`;
    }
  }
  return clean.replace(/\s+v\s+/i, " vs ");
}

/**
 * Parse YouTube relative time string into hours for sorting fresh highlights first.
 * e.g. "55 minutes ago" -> 0.91, "1 hour ago" -> 1, "6 months ago" -> 4320
 */
function parseUploadedAgeHours(str) {
  if (!str) return 999999;
  const s = str.toLowerCase();
  if (s.includes("second")) return 0.01;
  if (s.includes("min")) return (parseInt(s, 10) || 1) / 60;
  if (s.includes("hour") || s.includes("h ago")) return parseInt(s, 10) || 1;
  if (s.includes("day") || s.includes("d ago")) return (parseInt(s, 10) || 1) * 24;
  if (s.includes("week") || s.includes("w ago")) return (parseInt(s, 10) || 1) * 24 * 7;
  if (s.includes("month") || s.includes("mo ago")) return (parseInt(s, 10) || 1) * 24 * 30;
  if (s.includes("year") || s.includes("y ago")) return (parseInt(s, 10) || 1) * 24 * 365;
  return 999999;
}

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

async function readCache(key) {
  try {
    const parsed = await Storage.get(key);
    if (!parsed || !Array.isArray(parsed.data) || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      await Storage.remove(key);
      return null;
    }
    return parsed.data;
  } catch (_e) {
    return null;
  }
}

async function writeCache(key, data, ttlMs = CACHE_TTL_MS) {
  try {
    await Storage.set(key, { data, expiresAt: Date.now() + ttlMs });
  } catch (_e) {}
}

// ---------------------------------------------------------------------------
// YouTube direct search scraper
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function searchYouTube(query, { sp = "" } = {}) {
  const spParam = sp ? `&sp=${sp}` : "";
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${spParam}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`YouTube responded with status ${res.status}`);

  const html = await res.text();
  const match = html.match(/var ytInitialData = ({.*?});<\/script>/s) ||
                html.match(/ytInitialData\s*=\s*({.+?});/);
  if (!match) throw new Error("Could not parse YouTube initial data");

  const data = JSON.parse(match[1]);
  const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
  if (!Array.isArray(contents)) return [];

  const videos = [];
  for (const section of contents) {
    const items = section?.itemSectionRenderer?.contents;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      const vr = item.videoRenderer;
      if (!vr?.videoId) continue;

      const title = vr.title?.runs?.map((r) => r.text).join("") || vr.title?.simpleText || "Match Highlight";
      const author = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || "";
      const duration = vr.lengthText?.simpleText || "";
      const uploaded = vr.publishedTimeText?.simpleText || "";
      const views = vr.shortViewCountText?.simpleText || "";
      const thumbs = vr.thumbnail?.thumbnails || [];
      const thumbnail = thumbs.length
        ? thumbs[thumbs.length - 1].url
        : `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

      // Filter out video game simulations (PES, eFootball, etc.)
      const lower = title.toLowerCase();
      if (lower.includes("simulation") || lower.includes("pes ") || lower.includes("efootball") || lower.includes("gameplay")) {
        continue;
      }

      videos.push({
        id: vr.videoId,
        title,
        author,
        duration,
        uploaded,
        views,
        thumbnail,
      });

      if (videos.length >= 10) break;
    }
    if (videos.length >= 10) break;
  }

  return videos;
}

export async function getHighlights(query, options = {}) {
  const isRecent = options.isRecent ?? true;
  const cleanTitle = normalizeMatchQuery(query);
  const baseQuery = cleanTitle.toLowerCase().includes("highlight") ? cleanTitle : `${cleanTitle} highlights`;
  const cacheKey = `${CACHE_PREFIX}${isRecent ? "recent:" : "std:"}${baseQuery}`;

  const cached = await readCache(cacheKey);
  if (cached?.length) return cached;

  try {
    let videos = [];

    if (isRecent) {
      // 1. Stage 1: Try Today / Last 24 Hours filter
      try {
        const todayVids = await searchYouTube(baseQuery, { sp: "EgIIAg%253D%253D" });
        if (todayVids.length >= 2) {
          videos = todayVids;
        }
      } catch (_err) {}

      // 2. Stage 2: Try This Week filter
      if (videos.length < 2) {
        try {
          const weekVids = await searchYouTube(baseQuery, { sp: "EgIIAw%253D%253D" });
          videos = [...videos, ...weekVids];
        } catch (_err) {}
      }
    }

    // 3. Stage 3: Fallback to standard relevance search
    if (videos.length < 2) {
      try {
        const standardVids = await searchYouTube(baseQuery);
        videos = [...videos, ...standardVids];
      } catch (_err) {}
    }

    // Deduplicate by videoId
    const seen = new Set();
    const unique = [];
    for (const v of videos) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        unique.push(v);
      }
    }

    if (isRecent) {
      // Prioritize videos uploaded minutes/hours ago over old historical archives
      unique.sort((a, b) => parseUploadedAgeHours(a.uploaded) - parseUploadedAgeHours(b.uploaded));
    }

    const results = unique.slice(0, MAX_OPTIONS);
    if (results.length) {
      const ttl = isRecent ? RECENT_CACHE_TTL_MS : CACHE_TTL_MS;
      await writeCache(cacheKey, results, ttl);
      return results;
    }
  } catch (err) {
    console.warn("Direct YouTube search error:", err);
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

  const durationHTML = highlight.duration
    ? `<span class="duration-badge">${escapeHTML(highlight.duration)}</span>`
    : "";

  const thumbHTML = highlight.thumbnail
    ? `<img class="highlight-thumbnail" src="${escapeHTML(highlight.thumbnail)}" alt="${escapeHTML(highlight.title)}" loading="lazy">`
    : `<div class="thumb-fallback">🎬</div>`;

  const authorHTML = highlight.author
    ? `<span class="highlight-author"><span class="author-icon">📺</span> ${escapeHTML(highlight.author)}</span>`
    : "";

  const uploadedHTML = highlight.uploaded
    ? `<span class="highlight-uploaded"><span class="clock-icon">⏱</span> ${escapeHTML(highlight.uploaded)}</span>`
    : "";

  const viewsHTML = highlight.views
    ? `<span class="highlight-views"><span class="eye-icon">👁</span> ${escapeHTML(highlight.views)}</span>`
    : "";

  return `
    <div class="highlight-video" data-video-url="${escapeHTML(videoUrl)}">
      <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="thumb-frame" title="Watch highlight on YouTube">
        ${thumbHTML}
        ${durationHTML}
        <div class="play-overlay">▶</div>
      </a>
      <div class="highlight-info">
        <div class="highlight-info-top">
          <span class="option-badge">REEL OPTION ${index + 1}</span>
          <div class="highlight-meta-tags">
            ${authorHTML}
            ${uploadedHTML}
          </div>
        </div>

        <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="highlight-title-link">
          <h3 class="highlight-title" title="${escapeHTML(highlight.title)}">${escapeHTML(highlight.title)}</h3>
        </a>

        <div class="highlight-actions">
          ${viewsHTML}
          <a href="${videoUrl}" target="_blank" rel="noopener noreferrer" class="watch-video-btn">
            <span class="btn-icon">▶</span> WATCH HIGHLIGHT ↗
          </a>
        </div>
      </div>
    </div>
  `;
}

export function renderHighlightsHTML(highlights, matchName, ytSearchUrl) {
  const sectionTitle = highlights.length
    ? `AVAILABLE BROADCAST REELS (${highlights.length})`
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
    <div class="highlights-list">
      ${optionsHTML}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  const matchName = await Storage.get("match-name");

  const cleanName = normalizeMatchQuery(matchName);

  container.innerHTML = `
    <div class="highlight-header">
      <button class="back-btn" id="highlightBackBtn">
        <span class="back-arrow">‹</span> MATCHES
      </button>
      <h2 id="highlight-match-title" class="highlight-match-title">${escapeHTML(cleanName || "Match Highlights")}</h2>
    </div>
    <div id="highlights-container">
      <div class="info-msg">
        <div class="loader"></div>
        <span>SEARCHING BROADCAST HIGHLIGHTS…</span>
      </div>
    </div>
  `;

  container.querySelector("#highlightBackBtn").addEventListener("click", () => navigate("back"));

  const highlightsContainer = container.querySelector("#highlights-container");

  if (!cleanName) {
    highlightsContainer.innerHTML = `<div class="info-msg">No match selected. Return to fixtures and pick a match.</div>`;
    return;
  }

  const query       = `${cleanName} highlights`;
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const highlights = await getHighlights(query, { isRecent: true });
    highlightsContainer.innerHTML = renderHighlightsHTML(highlights, cleanName, ytSearchUrl);
  } catch (err) {
    console.error("Error fetching highlights:", err);
    highlightsContainer.innerHTML = renderHighlightsHTML([], cleanName, ytSearchUrl);
  }
}


/**
 * index.js - Popup entry point.
 * Fetches all available soccer leagues from ESPN, renders the league cards,
 * handles search/category filtering, and provides one-click access to
 * the Worldwide Live Matchday Desk.
 */
import { Storage } from "./storage.js";
import { escapeHTML, ensureHttps } from "./utils.js";
import { getLeagues, getLiveScoreboard } from "./api.js";

const leaguesContainer = document.getElementById("leagues");
const searchInput = document.getElementById("league-search");
const clearSearchBtn = document.getElementById("clear-search");
const filterChips = document.getElementById("filter-chips");
const leagueCountBadge = document.getElementById("league-count");
const mastheadLiveBtn = document.getElementById("masthead-live-btn");
const mastheadLiveCount = document.getElementById("masthead-live-count");

let allLeagues = [];
let activeFilter = "all";
let searchQuery = "";

// ---------------------------------------------------------------------------
// Monogram & Fallback Badge Generator
// ---------------------------------------------------------------------------

/**
 * Generate a clean 2-3 character monogram for a competition name.
 * e.g. "UEFA Champions League" -> "UCL"
 * "FIFA Women's Champions Cup" -> "FW"
 * "English Premier League" -> "EPL"
 */
function getLeagueMonogram(name, slug = "") {
  const s = (slug || "").toLowerCase();
  if (s.includes("uefa.champions")) return "UCL";
  if (s.includes("uefa.europa")) return "UEL";
  if (s.includes("uefa.conference")) return "UECL";
  if (s.includes("eng.1")) return "EPL";
  if (s.includes("esp.1")) return "LAL";
  if (s.includes("ita.1")) return "SER";
  if (s.includes("ger.1")) return "BUN";
  if (s.includes("fra.1")) return "L1";
  if (s.includes("usa.1")) return "MLS";
  if (s.includes("mex.1")) return "LMX";
  if (s.includes("bra.1")) return "BRA";
  if (s.includes("arg.1")) return "ARG";

  if (s.includes("fifa")) {
    const parts = (name || "").replace(/[^a-zA-Z\s]/g, "").split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return "FIFA";
  }

  // Acronym from major words
  const words = (name || "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => !["of", "the", "and", "de", "la", "le", "cup", "league"].includes(w.toLowerCase()));

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return ((name || "FB").slice(0, 2)).toUpperCase();
}

function renderMonogramHTML(name, slug = "") {
  const monogram = escapeHTML(getLeagueMonogram(name, slug));
  return `<div class="league-monogram-badge" title="${escapeHTML(name)}">${monogram}</div>`;
}

// ---------------------------------------------------------------------------
// Categorization Helper
// ---------------------------------------------------------------------------
function matchCategory(league, filter) {
  if (filter === "all") return true;
  const slug = (league.slug || "").toLowerCase();
  const name = (league.name || "").toLowerCase();

  if (filter === "europe") {
    const euroPrefixes = ["eng.", "esp.", "ita.", "ger.", "fra.", "ned.", "por.", "sco.", "tur.", "bel.", "uefa."];
    return euroPrefixes.some((p) => slug.startsWith(p)) || name.includes("premier") || name.includes("laliga") || name.includes("serie a") || name.includes("bundesliga");
  }

  if (filter === "americas") {
    const amPrefixes = ["usa.", "mex.", "bra.", "arg.", "col.", "chi.", "conmebol.", "concacaf."];
    return amPrefixes.some((p) => slug.startsWith(p)) || name.includes("mls") || name.includes("liga mx") || name.includes("libertadores");
  }

  if (filter === "cup") {
    return (
      name.includes("cup") ||
      name.includes("copa") ||
      name.includes("champions") ||
      name.includes("trophy") ||
      name.includes("shield") ||
      name.includes("pokal") ||
      slug.includes("uefa") ||
      slug.includes("fifa")
    );
  }

  return true;
}

function getLeagueSubLabel(slug) {
  if (!slug) return "LEAGUE";
  if (slug.startsWith("eng.")) return "ENGLAND";
  if (slug.startsWith("esp.")) return "SPAIN";
  if (slug.startsWith("ita.")) return "ITALY";
  if (slug.startsWith("ger.")) return "GERMANY";
  if (slug.startsWith("fra.")) return "FRANCE";
  if (slug.startsWith("usa.")) return "USA";
  if (slug.startsWith("uefa.")) return "UEFA";
  if (slug.startsWith("fifa.")) return "FIFA";
  if (slug.startsWith("mex.")) return "MEXICO";
  if (slug.startsWith("bra.")) return "BRAZIL";
  if (slug.startsWith("arg.")) return "ARGENTINA";
  return "SOCCER";
}

function renderLeagueCardHTML(league) {
  const rawLogo = league.logos && league.logos.length > 0 ? league.logos[0].href : null;
  const logoUrl = rawLogo ? ensureHttps(rawLogo) : null;
  const name = escapeHTML(league.name || "League");
  const slug = escapeHTML(league.slug || "");
  const region = getLeagueSubLabel(league.slug || "");
  const monogramHTML = renderMonogramHTML(league.name || "League", league.slug || "");

  const logoContent = logoUrl
    ? `<img class="league-image" src="${logoUrl}" alt="${name}" fetchpriority="high">`
    : monogramHTML;

  return `
    <div class="league-container ${slug}" data-slug="${slug}" role="button" tabindex="0"
         aria-label="${name}">
      <div class="league-logo-frame">
        ${logoContent}
      </div>
      <span class="league-name" title="${name}">${name}</span>
      <span class="league-badge-pill">${region}</span>
    </div>
  `;
}

function applyFiltersAndRender() {
  const q = searchQuery.toLowerCase().trim();
  const filtered = allLeagues.filter((league) => {
    const matchesCat = matchCategory(league, activeFilter);
    if (!matchesCat) return false;
    if (!q) return true;
    const name = (league.name || "").toLowerCase();
    const slug = (league.slug || "").toLowerCase();
    return name.includes(q) || slug.includes(q);
  });

  if (leagueCountBadge) {
    leagueCountBadge.textContent = `${filtered.length} AVAILABLE`;
  }

  if (filtered.length === 0) {
    leaguesContainer.innerHTML = `
      <div class="info-msg">
        <span>No competitions found matching "${escapeHTML(searchQuery)}".</span>
      </div>
    `;
    return;
  }

  leaguesContainer.innerHTML = filtered.map(renderLeagueCardHTML).join("");
}

// ---------------------------------------------------------------------------
// Search & Filter Interactions & Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (clearSearchBtn) {
      clearSearchBtn.style.display = searchQuery ? "block" : "none";
    }
    applyFiltersAndRender();
  });

  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    searchQuery = "";
    if (clearSearchBtn) clearSearchBtn.style.display = "none";
    applyFiltersAndRender();
    searchInput?.focus();
  });

  filterChips?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    filterChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter") || "all";
    applyFiltersAndRender();
  });

  // Event delegation — league card click
  leaguesContainer.addEventListener("click", async (e) => {
    const card = e.target.closest(".league-container");
    if (!card) return;
    const slug = card.getAttribute("data-slug");
    if (slug) {
      await Promise.all([
        Storage.set("leagueSlug", slug),
        Storage.set("lastLocation", "league"),
        Storage.set("lastTab", "matches"),
        Storage.remove("teamId"),
        Storage.remove("clubSlug"),
        Storage.remove("clubName"),
        Storage.remove("matchEventId"),
        Storage.remove("matchName"),
        Storage.remove("matchInitialTab"),
      ]);
      if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
        chrome.action.setPopup({ popup: "league/league.html" });
      }
      window.location.href = "league/league.html";
    }
  });

  // Keyboard accessibility
  leaguesContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.closest(".league-container")?.click();
    }
  });

  // Safe monogram fallback if logo image fails to load (CSP-compliant capture listener)
  leaguesContainer.addEventListener(
    "error",
    (e) => {
      if (e.target && e.target.classList.contains("league-image")) {
        const card = e.target.closest(".league-container");
        const name = card?.getAttribute("aria-label") || "League";
        const slug = card?.getAttribute("data-slug") || "";
        const frame = e.target.parentElement;
        if (frame) {
          frame.innerHTML = renderMonogramHTML(name, slug);
        }
      }
    },
    true
  );

  mastheadLiveBtn?.addEventListener("click", async () => {
    await Promise.all([
      Storage.set("lastLocation", "league"),
      Storage.set("lastTab", "live"),
      Storage.set("liveInitialScope", "all"),
      Storage.set("leagueSlug", "all"),
    ]);
    if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
      chrome.action.setPopup({ popup: "league/league.html" });
    }
    window.location.href = "league/league.html";
  });
}

// ---------------------------------------------------------------------------
// Masthead LIVE Matchday Desk Access & Real-Time Counter
// ---------------------------------------------------------------------------
async function checkLiveMatches() {
  try {
    const data = await getLiveScoreboard("all");
    const events = data?.events || [];
    const isLive = (e) =>
      e?.status?.type?.state === "in" || e?.competitions?.[0]?.status?.type?.state === "in";
    const liveCount = events.filter(isLive).length;

    if (mastheadLiveCount) {
      if (liveCount > 0) {
        mastheadLiveCount.textContent = String(liveCount);
        mastheadLiveCount.style.display = "inline-block";
        mastheadLiveBtn?.setAttribute("title", `${liveCount} live matches in-play worldwide — click to view`);
      } else {
        mastheadLiveCount.style.display = "none";
        mastheadLiveBtn?.setAttribute("title", "View real-time Live Matchday Desk");
      }
    }
  } catch (_e) {}
}

// ---------------------------------------------------------------------------
// Application Entry Point
// ---------------------------------------------------------------------------
async function start() {
  // Fast restore: if user was viewing a league, restore directly to league hub
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      const stored = await chrome.storage.local.get(["lastLocation", "leagueSlug"]);
      if (stored?.lastLocation === "league" && stored?.leagueSlug) {
        window.location.replace("league/league.html");
        return;
      }
    }
  } catch (_e) {}

  if (!leaguesContainer) return;

  // Setup interactions and listeners
  setupEventListeners();

  // Check live matches on startup and refresh every 30s
  checkLiveMatches();
  const livePollInterval = setInterval(checkLiveMatches, 30000);
  window.addEventListener("unload", () => clearInterval(livePollInterval));

  // Initial Leagues Load
  try {
    const leagues = await getLeagues();
    if (!leagues || leagues.length === 0) {
      leaguesContainer.innerHTML = `<div class="error-msg">Failed to load leagues from server.</div>`;
      return;
    }
    allLeagues = leagues;
    applyFiltersAndRender();
  } catch (_err) {
    leaguesContainer.innerHTML = `<div class="error-msg">Failed to load leagues from server.</div>`;
  }
}

start();

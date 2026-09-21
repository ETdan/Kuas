/**
 * league.js - SPA router for the league shell.
 * Matchday Edition / Football Art Theme
 */

import { Storage } from "../storage.js";
import { clearCache } from "../api.js";

// Format slug into readable competition title
function formatLeagueSlug(slug) {
  if (!slug) return "LEAGUE HUB";
  const map = {
    "eng.1": "ENGLISH PREMIER LEAGUE",
    "esp.1": "LALIGA EA SPORTS",
    "ita.1": "SERIE A",
    "ger.1": "BUNDESLIGA",
    "fra.1": "LIGUE 1",
    "usa.1": "MAJOR LEAGUE SOCCER",
    "uefa.champions": "UEFA CHAMPIONS LEAGUE",
    "uefa.europa": "UEFA EUROPA LEAGUE",
    "fifa.world": "FIFA WORLD CUP",
    "mex.1": "LIGA MX",
    "bra.1": "BRASILEIRÃO",
    "arg.1": "ARGENTINE PRIMERA",
    "ned.1": "EREDIVISIE",
    "por.1": "LIGA PORTUGAL",
  };
  return map[slug.toLowerCase()] || slug.toUpperCase().replace(/\./g, " ");
}

// Display league title
const titleElem = document.getElementById("league-title-text");
Storage.get("leagueSlug").then((slug) => {
  if (titleElem && slug) {
    titleElem.textContent = formatLeagueSlug(slug);
  }
});

// Lazy-import each view
const VIEW_LOADERS = {
  matches:     () => import("../matches/matches.js"),
  live:        () => import("../live/live.js"),
  standing:    () => import("../standing/standing.js"),
  club:        () => import("../club/club.js"),
  club_detail: () => import("../club_detail/club_detail.js"),
  highlight:   () => import("../highlight/highlights.js"),
  match_detail:() => import("../matches/match_detail.js"),
};

const VIEW_CSS = {
  matches:     "../matches/matches.css",
  live:        "../live/live.css",
  standing:    "../standing/standing.css",
  club:        "../club/club.css",
  club_detail: "../club_detail/club_detail.css",
  highlight:   "../highlight/highlight.css",
  match_detail:"../matches/matches.css",
};

// Nav links exist for top-level tabs.
const NAV_PAGES = new Set(["matches", "live", "standing", "club"]);

let currentPage = null;
let cssLink = null;
const navHistory = [];

const content = document.getElementById("content");

/** Load and activate a view by name, with back-navigation history. */
async function navigate(page, { isBack = false } = {}) {
  if (page === "back") {
    const prev = navHistory.pop() || "matches";
    return navigate(prev, { isBack: true });
  }

  if (!VIEW_LOADERS[page]) {
    console.warn(`[router] Unknown page: "${page}"`);
    return;
  }
  if (page === currentPage) return;

  // Record history if navigating forward to a new view
  if (!isBack && currentPage) {
    navHistory.push(currentPage);
    if (navHistory.length > 20) navHistory.shift();
  }

  currentPage = page;

  // Persist current active view & location
  Storage.set("lastTab", page);
  Storage.set("lastLocation", "league");
  if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
    chrome.action.setPopup({ popup: "league/league.html" });
  }

  // Update nav active state (only for pages that have nav links)
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-page") === page);
  });

  // Swap stylesheet
  cssLink?.remove();
  if (VIEW_CSS[page]) {
    cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = VIEW_CSS[page];
    document.head.appendChild(cssLink);
  }

  // Show loading placeholder
  content.innerHTML = `
    <div class="view-loading">
      <div class="loader"></div>
      <span>MATCHDAY DESK LOADING…</span>
    </div>
  `;

  // Lazy-load the view module
  const mod = await VIEW_LOADERS[page]();

  // Let the view render itself
  await mod.init(content, navigate);
}

// ---------------------------------------------------------------------------
// Nav link clicks
// ---------------------------------------------------------------------------
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    navigate(link.getAttribute("data-page"));
  });
});

// ---------------------------------------------------------------------------
// Home button — back to popup root (clears lastLocation & stale subpages)
// ---------------------------------------------------------------------------
document.getElementById("home")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await Promise.all([
    Storage.set("lastLocation", "home"),
    Storage.set("lastTab", "matches"),
    Storage.remove("teamId"),
    Storage.remove("clubSlug"),
    Storage.remove("clubName"),
    Storage.remove("matchEventId"),
    Storage.remove("matchName"),
    Storage.remove("matchInitialTab"),
  ]);
  if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
    chrome.action.setPopup({ popup: "index.html" });
  }
  clearCache();
  window.location.href = "../index.html";
});

// ---------------------------------------------------------------------------
// Live badge pill updater for top navigation
// ---------------------------------------------------------------------------
async function updateNavLivePill() {
  try {
    const pill = document.getElementById("navLivePill");
    if (!pill) return;
    const slug = await Storage.get("leagueSlug");
    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug || "eng.1"}/scoreboard`);
    if (!res.ok) return;
    const data = await res.json();
    const liveCount = data?.events?.filter((e) => e.status?.type?.state === "in")?.length || 0;
    if (liveCount > 0) {
      pill.textContent = String(liveCount);
      pill.style.display = "inline-flex";
    } else {
      pill.style.display = "none";
    }
  } catch (_e) {}
}
updateNavLivePill();

// ---------------------------------------------------------------------------
// Boot — restore last active tab or subpage seamlessly
// ---------------------------------------------------------------------------
async function boot() {
  const currentSlug = (await Storage.get("leagueSlug")) || "eng.1";
  const lastViewedSlug = await Storage.get("lastViewedLeagueSlug");

  // Detect league switch: if the league changed, reset to matches and clear stale subpages
  if (currentSlug !== lastViewedSlug) {
    await Promise.all([
      Storage.set("lastViewedLeagueSlug", currentSlug),
      Storage.set("lastTab", "matches"),
      Storage.remove("teamId"),
      Storage.remove("clubSlug"),
      Storage.remove("clubName"),
      Storage.remove("matchEventId"),
      Storage.remove("matchName"),
      Storage.remove("matchInitialTab"),
    ]);
    return navigate("matches");
  }

  const tab = await Storage.get("lastTab", "matches");
  if (NAV_PAGES.has(tab)) {
    return navigate(tab);
  }
  if (tab === "club_detail") {
    const teamId = await Storage.get("teamId");
    if (teamId) return navigate("club_detail");
  }
  if (tab === "match_detail") {
    const eventId = await Storage.get("matchEventId");
    if (eventId) return navigate("match_detail");
  }
  navigate("matches");
}

boot();

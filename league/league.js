/**
 * league.js - SPA router for the league shell.
 * Dedicated to single-competition matchday browsing.
 */

import { Storage } from "../storage.js";
import { clearCache } from "../api.js";
import { checkUpdatePrompt } from "../update_prompt.js";

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

function updateHeaderTitle(slug) {
  if (titleElem && slug) {
    titleElem.textContent = formatLeagueSlug(slug);
  }
}

Storage.get("leagueSlug").then((slug) => {
  if (slug) {
    updateHeaderTitle(slug);
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
const loadedStyles = new Set();
const navHistory = [];

const content = document.getElementById("content");

function ensureViewStylesheet(page) {
  const href = VIEW_CSS[page];
  if (!href || loadedStyles.has(href)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
  loadedStyles.add(href);
}

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
  await Promise.all([
    Storage.set("lastTab", page),
    Storage.set("lastLocation", "league"),
  ]);
  if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
    chrome.action.setPopup({ popup: "league/league.html" });
  }

  // Update nav active state
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-page") === page);
  });

  // Ensure stylesheet is loaded without removing existing ones
  ensureViewStylesheet(page);

  // Lazy-load the view module
  const mod = await VIEW_LOADERS[page]();

  // Let the view render itself directly into content
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
// Home button — back to popup root
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
export async function updateNavLivePill() {
  try {
    const pill = document.getElementById("navLivePill");
    const slug = (await Storage.get("leagueSlug")) || "eng.1";

    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => null) : null;

    const isLive = (e) =>
      e?.status?.type?.state === "in" || e?.competitions?.[0]?.status?.type?.state === "in";

    const leagueCount = (data?.events || []).filter(isLive).length;

    if (pill) {
      if (leagueCount > 0) {
        pill.textContent = String(leagueCount);
        pill.style.display = "inline-flex";
        pill.title = `${leagueCount} live match${leagueCount > 1 ? "es" : ""} in this league`;
      } else {
        pill.style.display = "none";
      }
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

  updateHeaderTitle(currentSlug);
  checkUpdatePrompt();

  const tab = await Storage.get("lastTab", "matches");

  // Detect league switch: if the league changed, reset to matches and clear stale subpages
  if (currentSlug !== lastViewedSlug) {
    await Promise.all([
      Storage.set("lastViewedLeagueSlug", currentSlug),
      Storage.set("lastTab", tab),
      Storage.remove("teamId"),
      Storage.remove("clubSlug"),
      Storage.remove("clubName"),
      Storage.remove("matchEventId"),
      Storage.remove("matchName"),
      Storage.remove("matchInitialTab"),
    ]);
    return navigate(tab);
  }

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

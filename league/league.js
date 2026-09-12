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
  matches:    () => import("../matches/matches.js"),
  standing:   () => import("../standing/standing.js"),
  club:       () => import("../club/club.js"),
  club_detail:() => import("../club_detail/club_detail.js"),
  highlight:  () => import("../highlight/highlights.js"),
};

const VIEW_CSS = {
  matches:    "../matches/matches.css",
  standing:   "../standing/standing.css",
  club:       "../club/club.css",
  club_detail:"../club_detail/club_detail.css",
  highlight:  "../highlight/highlight.css",
};

// Nav links only exist for the three top-level tabs.
const NAV_PAGES = new Set(["matches", "standing", "club"]);

let currentPage = null;
let cssLink = null;

const content = document.getElementById("content");

/** Load and activate a view by name. */
async function navigate(page) {
  if (!VIEW_LOADERS[page]) {
    console.warn(`[router] Unknown page: "${page}"`);
    return;
  }
  if (page === currentPage) return;
  currentPage = page;

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
// Home button — back to popup root
// ---------------------------------------------------------------------------
document.getElementById("home")?.addEventListener("click", (e) => {
  e.preventDefault();
  clearCache();
  window.location.href = "../index.html";
});

// ---------------------------------------------------------------------------
// Boot — restore last active tab or default to matches
// ---------------------------------------------------------------------------
Storage.get("lastTab", "matches").then((tab) => {
  navigate(NAV_PAGES.has(tab) ? tab : "matches");
});

// Persist active tab on nav clicks
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    Storage.set("lastTab", link.getAttribute("data-page"));
  });
});

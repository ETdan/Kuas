/**
 * worldwide/worldwide.js - Router for the Worldwide Matchday Desk.
 * Dedicated to global match schedules and worldwide live scores.
 */

import { Storage } from "../storage.js";
import { clearCache } from "../api.js";

const VIEW_LOADERS = {
  matches:     () => import("../matches/matches.js"),
  live:        () => import("./worldwide_live.js"),
  match_detail:() => import("../matches/match_detail.js"),
  club_detail: () => import("../club_detail/club_detail.js"),
  highlight:   () => import("../highlight/highlights.js"),
};

const VIEW_CSS = {
  matches:     "../matches/matches.css",
  live:        "../live/live.css",
  match_detail:"../matches/matches.css",
  club_detail: "../club_detail/club_detail.css",
  highlight:   "../highlight/highlight.css",
};

const NAV_PAGES = new Set(["matches", "live"]);

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
    console.warn(`[worldwide-router] Unknown page: "${page}"`);
    return;
  }

  if (page === currentPage) return;

  if (!isBack && currentPage) {
    navHistory.push(currentPage);
    if (navHistory.length > 20) navHistory.shift();
  }

  currentPage = page;

  // Persist current active view & location
  await Promise.all([
    Storage.set("lastTab", page),
    Storage.set("lastLocation", "worldwide"),
    Storage.set("leagueSlug", "all"),
  ]);
  if (typeof chrome !== "undefined" && chrome.action?.setPopup) {
    chrome.action.setPopup({ popup: "worldwide/worldwide.html" });
  }

  // Update nav active state (only for pages that have nav links)
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
// Home button — back to league selector
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
    const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard").catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => null) : null;

    const isLive = (e) =>
      e?.status?.type?.state === "in" || e?.competitions?.[0]?.status?.type?.state === "in";

    const allCount = (data?.events || []).filter(isLive).length;

    if (pill) {
      if (allCount > 0) {
        pill.textContent = String(allCount);
        pill.style.display = "inline-flex";
        pill.title = `${allCount} live match${allCount > 1 ? "es" : ""} worldwide`;
      } else {
        pill.style.display = "none";
      }
    }

    if (typeof chrome !== "undefined" && chrome.action?.setBadgeText) {
      if (allCount > 0) {
        chrome.action.setBadgeText({ text: allCount > 1 ? `${allCount}` : "LIVE" });
        chrome.action.setBadgeBackgroundColor({ color: "#D8232A" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
    }
  } catch (_e) {}
}
updateNavLivePill();

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
async function boot() {
  // Ensure leagueSlug is set to "all" for worldwide desk
  await Storage.set("leagueSlug", "all");

  const tab = await Storage.get("lastTab", "matches");

  if (NAV_PAGES.has(tab)) {
    return navigate(tab);
  }
  if (tab === "match_detail") {
    const eventId = await Storage.get("matchEventId");
    if (eventId) return navigate("match_detail");
  }
  if (tab === "club_detail") {
    const teamId = await Storage.get("teamId");
    if (teamId) return navigate("club_detail");
  }
  navigate("matches");
}

boot();

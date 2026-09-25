// background.js - Kuas Service Worker
// Monitors active matches and displays a red "LIVE" badge on the extension icon.

import { Storage } from "./storage.js";

const ALARM_NAME = "kuas_live_match_checker";
const CHECK_INTERVAL_MINUTES = 5;

function isEventLive(event) {
  const statusState = event?.status?.type?.state || event?.competitions?.[0]?.status?.type?.state;
  return statusState === "in";
}

async function checkLiveMatches() {
  try {
    const stored = await chrome.storage.local.get("leagueSlug");
    const slug = stored?.leagueSlug || "eng.1";

    // Query both selected league and worldwide scoreboards in parallel
    const [leagueRes, allRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`).catch(() => null),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard`).catch(() => null),
    ]);

    const leagueData = leagueRes && leagueRes.ok ? await leagueRes.json().catch(() => null) : null;
    const allData = allRes && allRes.ok ? await allRes.json().catch(() => null) : null;

    const leagueLiveCount = (leagueData?.events || []).filter(isEventLive).length;
    const allLiveCount = (allData?.events || []).filter(isEventLive).length;

    // Prioritize selected league count if live matches exist there; otherwise use worldwide count
    const totalLive = leagueLiveCount > 0 ? leagueLiveCount : allLiveCount;

    if (totalLive > 0) {
      chrome.action.setBadgeText({ text: totalLive > 1 ? `${totalLive}` : "LIVE" });
      chrome.action.setBadgeBackgroundColor({ color: "#D8232A" });
      if (chrome.action.setBadgeTextColor) {
        chrome.action.setBadgeTextColor({ color: "#FFFFFF" });
      }
      const scopeLabel = leagueLiveCount > 0 ? "in active competition" : "worldwide";
      chrome.action.setTitle({
        title: `Kuas — ${totalLive} match${totalLive > 1 ? "es" : ""} currently LIVE (${scopeLabel})!`,
      });
    } else {
      chrome.action.setBadgeText({ text: "" });
      chrome.action.setTitle({ title: "Kuas — Football Matchday Hub" });
    }
  } catch (err) {
    console.debug("[Kuas BG] Error checking live matches:", err);
  }
}

async function syncPopupDestination() {
  try {
    const stored = await chrome.storage.local.get(["lastLocation", "leagueSlug"]);
    if (stored?.lastLocation === "worldwide") {
      chrome.action.setPopup({ popup: "worldwide/worldwide.html" });
    } else if (stored?.lastLocation === "league" && stored?.leagueSlug) {
      chrome.action.setPopup({ popup: "league/league.html" });
    } else {
      chrome.action.setPopup({ popup: "index.html" });
    }
  } catch (err) {
    console.debug("[Kuas BG] Error syncing popup destination:", err);
  }
}

function setupAlarm() {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, {
        delayInMinutes: 0.1,
        periodInMinutes: CHECK_INTERVAL_MINUTES,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Extension Update Management
// ---------------------------------------------------------------------------
// Listen for update readiness (e.g. when triggered from popup requestUpdateCheck)
if (typeof chrome !== "undefined" && chrome.runtime?.onUpdateAvailable) {
  chrome.runtime.onUpdateAvailable.addListener((details) => {
    chrome.storage.local.set({
      updateAvailable: true,
      updateVersion: details?.version || "",
    });
  });
}

// Allow popup to request immediate extension reload when user confirms update
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "RESTART_EXTENSION") {
      chrome.runtime.reload();
    }
  });
}

// Lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Kuas Football Extension installed successfully.");
  if (details?.reason === "update") {
    chrome.storage.local.remove(["updateAvailable", "updateVersion"]);
  }
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.1,
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  checkLiveMatches();
  syncPopupDestination();
  Storage.pruneExpired().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
  checkLiveMatches();
  syncPopupDestination();
  Storage.pruneExpired().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkLiveMatches();
  }
});

// React to storage updates
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    if (changes.leagueSlug) {
      checkLiveMatches();
    }
    if (changes.lastLocation || changes.leagueSlug) {
      syncPopupDestination();
    }
  }
});

// Immediate execution on service worker startup / reload
setupAlarm();
checkLiveMatches();
syncPopupDestination();



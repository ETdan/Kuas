// background.js - Kuas Service Worker
// Monitors active matches and displays a red "LIVE" badge on the extension icon.

import { Storage } from "./storage.js";

const ALARM_NAME = "kuas_live_match_checker";
const CHECK_INTERVAL_MINUTES = 10;

async function checkLiveMatches() {
  try {
    const stored = await chrome.storage.local.get("leagueSlug");
    const slug = stored?.leagueSlug || "eng.1";

    const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`);
    if (!res.ok) return;

    const data = await res.json();
    const events = data?.events || [];

    let liveCount = 0;
    for (const event of events) {
      const statusType = event?.competitions?.[0]?.status?.type;
      if (statusType?.state === "in") {
        liveCount++;
      }
    }

    if (liveCount > 0) {
      chrome.action.setBadgeText({ text: liveCount > 1 ? `${liveCount}` : "LIVE" });
      chrome.action.setBadgeBackgroundColor({ color: "#D8232A" });
      chrome.action.setTitle({ title: `Kuas — ${liveCount} match${liveCount > 1 ? "es" : ""} currently LIVE!` });
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
    if (stored?.lastLocation === "league" && stored?.leagueSlug) {
      chrome.action.setPopup({ popup: "league/league.html" });
    } else {
      chrome.action.setPopup({ popup: "index.html" });
    }
  } catch (err) {
    console.debug("[Kuas BG] Error syncing popup destination:", err);
  }
}

// Lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log("Kuas Football Extension installed successfully.");
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 0.2,
    periodInMinutes: CHECK_INTERVAL_MINUTES,
  });
  checkLiveMatches();
  syncPopupDestination();
  Storage.pruneExpired().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
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


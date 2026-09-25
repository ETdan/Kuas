/**
 * worldwide/worldwide_live.js - Worldwide Live Matchday Desk.
 * Displays all active in-play matches across all soccer competitions globally.
 */

import { Storage } from "../storage.js";
import { escapeHTML, renderErrorState } from "../utils.js";
import { getLiveScoreboard } from "../api.js";
import { renderMatchCardHTML, normalizeEspnEvent } from "../components/match_card.js";

const REFRESH_INTERVAL_MS = 30000; // 30 seconds auto-refresh

function renderShellHTML() {
  return `
    <div class="live-view-wrap">
      <!-- Top Live Desk Header -->
      <div class="live-header-bar">
        <div class="live-title-row">
          <div class="live-title-left">
            <span class="live-pulse-dot"></span>
            <div class="live-title-meta">
              <span class="live-kicker">GLOBAL REAL-TIME DESK</span>
              <h2 class="live-heading">WORLDWIDE LIVE MATCHES</h2>
            </div>
          </div>
          <button class="live-refresh-btn" id="liveRefreshBtn" title="Refresh live scores">
            <span class="refresh-icon">🔄</span> REFRESH
          </button>
        </div>
      </div>

      <!-- Live Matches List Container -->
      <div id="liveMatchesContainer" class="live-matches-container">
        <div class="info-msg">
          <div class="loader"></div>
          <span>TRANSMITTING WORLDWIDE LIVE FEEDS…</span>
        </div>
      </div>
    </div>
  `;
}

export async function init(container, navigate) {
  container.innerHTML = renderShellHTML();

  const containerEl = container.querySelector("#liveMatchesContainer");
  const refreshBtn = container.querySelector("#liveRefreshBtn");

  let refreshTimerId = null;

  async function loadLiveFeed(isManualRefresh = false) {
    if (isManualRefresh && refreshBtn) {
      refreshBtn.classList.add("refreshing");
    }

    try {
      const allData = await getLiveScoreboard("all").catch(() => null);
      const events = allData?.events || [];
      const liveEvents = events.filter((e) => e.status?.type?.state === "in");

      // Update nav live pill
      const navPill = document.getElementById("navLivePill");
      if (navPill) {
        if (liveEvents.length > 0) {
          navPill.textContent = String(liveEvents.length);
          navPill.style.display = "inline-flex";
        } else {
          navPill.style.display = "none";
        }
      }

      if (typeof chrome !== "undefined" && chrome.action?.setBadgeText) {
        if (liveEvents.length > 0) {
          chrome.action.setBadgeText({ text: liveEvents.length > 1 ? `${liveEvents.length}` : "LIVE" });
          chrome.action.setBadgeBackgroundColor({ color: "#D8232A" });
        } else {
          chrome.action.setBadgeText({ text: "" });
        }
      }

      const mappedCards = liveEvents.map((e) => normalizeEspnEvent(e)).filter(Boolean);

      if (!mappedCards.length) {
        containerEl.innerHTML = `
          <div class="live-empty-card">
            <div class="live-empty-icon">⚽</div>
            <h3 class="live-empty-title">No Worldwide Live Matches</h3>
            <p class="live-empty-desc">No tracked matches are currently in-play across leagues. Check the Matches tab for upcoming fixture times.</p>
          </div>
        `;
        return;
      }

      containerEl.innerHTML = mappedCards.map((card) => {
        const compHeader = card.competitionTitle
          ? `<div class="live-card-league-tag">🏆 ${escapeHTML(card.competitionTitle)}</div>`
          : "";
        return `
          <div class="live-card-wrapper">
            ${compHeader}
            ${renderMatchCardHTML(card)}
          </div>
        `;
      }).join("");
    } catch (err) {
      console.error("Error loading worldwide live matches:", err);
      renderErrorState(
        containerEl,
        "Worldwide live scoreboard feed currently unavailable. Please click below to retry.",
        () => loadLiveFeed(true)
      );
    } finally {
      if (refreshBtn) {
        setTimeout(() => refreshBtn.classList.remove("refreshing"), 400);
      }
    }
  }

  refreshBtn?.addEventListener("click", () => {
    loadLiveFeed(true);
  });

  // Event delegation on match cards
  containerEl.addEventListener("click", async (e) => {
    // 1. Team click → Club view
    const clubElem = e.target.closest('[data-action="open-club"]');
    if (clubElem) {
      e.stopPropagation();
      await Promise.all([
        Storage.set("clubSlug", clubElem.getAttribute("data-club-slug")),
        Storage.set("clubName", clubElem.getAttribute("data-club-name")),
        Storage.set("teamId", clubElem.getAttribute("data-club-id")),
      ]);
      navigate("club_detail");
      return;
    }

    // 2. Card click → Match Center
    const card = e.target.closest(".match-card");
    if (card) {
      e.stopPropagation();
      await Promise.all([
        Storage.set("matchEventId", card.getAttribute("data-event-id")),
        Storage.set("matchName", card.getAttribute("data-match-name") || "Match Details"),
        Storage.set("matchKickoff", card.getAttribute("data-kickoff") || ""),
        Storage.set("matchVenue", card.getAttribute("data-venue") || ""),
        Storage.set("matchState", card.getAttribute("data-state") || "in"),
        Storage.set("matchHomeName", card.getAttribute("data-home-name") || ""),
        Storage.set("matchHomeLogo", card.getAttribute("data-home-logo") || ""),
        Storage.set("matchHomeScore", card.getAttribute("data-home-score") || ""),
        Storage.set("matchAwayName", card.getAttribute("data-away-name") || ""),
        Storage.set("matchAwayLogo", card.getAttribute("data-away-logo") || ""),
        Storage.set("matchAwayScore", card.getAttribute("data-away-score") || ""),
        Storage.set("matchInitialTab", "h2h"),
      ]);
      navigate("match_detail");
      return;
    }
  });

  // Initial load
  await loadLiveFeed();

  // 30s auto-refresh timer
  refreshTimerId = setInterval(() => {
    loadLiveFeed();
  }, REFRESH_INTERVAL_MS);

  // Clear timer when unmounting or navigating away
  const observer = new MutationObserver(() => {
    if (!document.body.contains(containerEl)) {
      if (refreshTimerId) clearInterval(refreshTimerId);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true });
}

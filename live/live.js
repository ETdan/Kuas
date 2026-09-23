/**
 * live/live.js - Live Matchday Desk view module.
 * Displays all in-play / live matches simultaneously with real-time scoreboards,
 * live clocks, and instant scope switching (Current League vs Worldwide).
 */

import { Storage } from "../storage.js";
import { escapeHTML, renderErrorState } from "../utils.js";
import { getLiveScoreboard } from "../api.js";
import { renderMatchCardHTML, normalizeEspnEvent } from "../components/match_card.js";

const REFRESH_INTERVAL_MS = 30000; // 30 seconds auto-refresh

function renderShellHTML(leagueName, initialScope = "league") {
  return `
    <div class="live-view-wrap">
      <!-- Top Live Desk Header -->
      <div class="live-header-bar">
        <div class="live-title-row">
          <div class="live-title-left">
            <span class="live-pulse-dot"></span>
            <div class="live-title-meta">
              <span class="live-kicker">REAL-TIME DESK</span>
              <h2 class="live-heading">LIVE MATCHDAY HUB</h2>
            </div>
          </div>
          <button class="live-refresh-btn" id="liveRefreshBtn" title="Refresh live scores">
            <span class="refresh-icon">🔄</span> REFRESH
          </button>
        </div>

        <div class="live-scope-chips" id="liveScopeChips">
          <button class="live-chip ${initialScope === "league" ? "active" : ""}" data-scope="league">
            <span class="chip-dot">●</span> CURRENT LEAGUE (<span id="leagueLiveCount">0</span>)
          </button>
          <button class="live-chip ${initialScope === "all" ? "active" : ""}" data-scope="all">
            <span class="chip-globe">🌍</span> WORLDWIDE (<span id="allLiveCount">0</span>)
          </button>
        </div>
      </div>

      <!-- Live Matches List Container -->
      <div id="liveMatchesContainer" class="live-matches-container">
        <div class="info-msg">
          <div class="loader"></div>
          <span>TRANSMITTING LIVE MATCHDAY FEEDS…</span>
        </div>
      </div>
    </div>
  `;
}

export async function init(container, navigate) {
  const slug = (await Storage.get("leagueSlug")) || "eng.1";
  const initialScopeStored = await Storage.get("liveInitialScope");
  const initialScope = initialScopeStored === "all" ? "all" : "league";
  await Storage.remove("liveInitialScope");

  container.innerHTML = renderShellHTML(slug.toUpperCase(), initialScope);

  const containerEl = container.querySelector("#liveMatchesContainer");
  const refreshBtn = container.querySelector("#liveRefreshBtn");
  const scopeChips = container.querySelector("#liveScopeChips");
  const leagueCountEl = container.querySelector("#leagueLiveCount");
  const allCountEl = container.querySelector("#allLiveCount");

  let currentScope = initialScope; // 'league' | 'all'
  let refreshTimerId = null;

  async function loadLiveFeed(isManualRefresh = false) {
    if (isManualRefresh && refreshBtn) {
      refreshBtn.classList.add("refreshing");
    }

    try {
      const [leagueData, allData] = await Promise.all([
        getLiveScoreboard(slug).catch(() => null),
        getLiveScoreboard("all").catch(() => null),
      ]);

      const leagueEvents = leagueData?.events || [];
      const allEvents = allData?.events || [];

      const leagueLiveEvents = leagueEvents.filter((e) => e.status?.type?.state === "in");
      const allLiveEvents = allEvents.filter((e) => e.status?.type?.state === "in");

      if (leagueCountEl) leagueCountEl.textContent = String(leagueLiveEvents.length);
      if (allCountEl) allCountEl.textContent = String(allLiveEvents.length);

      // Instantly sync nav pill and action badge
      const effectiveLiveCount = leagueLiveEvents.length > 0 ? leagueLiveEvents.length : allLiveEvents.length;
      const navPill = document.getElementById("navLivePill");
      if (navPill) {
        if (effectiveLiveCount > 0) {
          navPill.textContent = String(effectiveLiveCount);
          navPill.style.display = "inline-flex";
        } else {
          navPill.style.display = "none";
        }
      }
      if (typeof chrome !== "undefined" && chrome.action?.setBadgeText) {
        if (effectiveLiveCount > 0) {
          chrome.action.setBadgeText({ text: effectiveLiveCount > 1 ? `${effectiveLiveCount}` : "LIVE" });
          chrome.action.setBadgeBackgroundColor({ color: "#D8232A" });
        } else {
          chrome.action.setBadgeText({ text: "" });
        }
      }

      const activeList = currentScope === "league" ? leagueLiveEvents : allLiveEvents;
      const mappedCards = activeList.map((e) => normalizeEspnEvent(e)).filter(Boolean);

      if (!mappedCards.length) {
        if (currentScope === "league") {
          containerEl.innerHTML = `
            <div class="live-empty-card">
              <div class="live-empty-icon">⏳</div>
              <h3 class="live-empty-title">No Live Matches in This League</h3>
              <p class="live-empty-desc">
                There are no active matches in play for this competition right now.
                ${allLiveEvents.length > 0 ? `There are <strong>${allLiveEvents.length} live matches</strong> happening worldwide right now!` : "Check the Matches tab for upcoming fixture times."}
              </p>
              ${allLiveEvents.length > 0 ? `
                <button class="live-switch-scope-btn" id="switchToAllBtn">
                  <span>🌍</span> VIEW ${allLiveEvents.length} WORLDWIDE LIVE MATCHES ↗
                </button>
              ` : ""}
            </div>
          `;
          const switchBtn = containerEl.querySelector("#switchToAllBtn");
          if (switchBtn) {
            switchBtn.addEventListener("click", () => {
              setScope("all");
            });
          }
        } else {
          containerEl.innerHTML = `
            <div class="live-empty-card">
              <div class="live-empty-icon">⚽</div>
              <h3 class="live-empty-title">No Worldwide Live Matches</h3>
              <p class="live-empty-desc">No tracked matches are currently in-play across leagues. Check back during scheduled matchdays or view upcoming fixtures in the Matches desk.</p>
            </div>
          `;
        }
        return;
      }

      containerEl.innerHTML = mappedCards.map((card) => {
        const compHeader = currentScope === "all" && card.competitionTitle
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
      console.error("Error loading live match feed:", err);
      renderErrorState(
        containerEl,
        "Live scoreboard feed currently unavailable. Please click below to retry.",
        () => loadLiveFeed(true)
      );
    } finally {
      if (refreshBtn) {
        setTimeout(() => refreshBtn.classList.remove("refreshing"), 400);
      }
    }
  }

  function setScope(scope) {
    currentScope = scope;
    scopeChips?.querySelectorAll(".live-chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.scope === scope);
    });
    containerEl.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>UPDATING LIVE FEED…</span>
      </div>
    `;
    loadLiveFeed();
  }

  scopeChips?.addEventListener("click", (e) => {
    const chip = e.target.closest(".live-chip");
    if (!chip) return;
    const scope = chip.dataset.scope;
    if (scope && scope !== currentScope) {
      setScope(scope);
    }
  });

  refreshBtn?.addEventListener("click", () => {
    loadLiveFeed(true);
  });

  // Event delegation on match cards
  containerEl.addEventListener("click", async (e) => {
    // 1. Team click → Club view
    const clubElem = e.target.closest('[data-action="open-club"]');
    if (clubElem) {
      e.stopPropagation();
      await Storage.set("clubSlug", clubElem.getAttribute("data-club-slug"));
      await Storage.set("clubName", clubElem.getAttribute("data-club-name"));
      await Storage.set("teamId", clubElem.getAttribute("data-club-id"));
      navigate("club_detail");
      return;
    }

    // 2. Card click → Match Center (with live timeline, stats, highlights)
    const card = e.target.closest(".match-card");
    if (card) {
      e.stopPropagation();
      const eventId = card.getAttribute("data-event-id");
      const matchName = card.getAttribute("data-match-name") || "Match Details";
      const kickoff = card.getAttribute("data-kickoff") || "";
      const venue = card.getAttribute("data-venue") || "";
      const state = card.getAttribute("data-state") || "in";
      const homeName = card.getAttribute("data-home-name") || "";
      const homeLogo = card.getAttribute("data-home-logo") || "";
      const homeScore = card.getAttribute("data-home-score") || "";
      const awayName = card.getAttribute("data-away-name") || "";
      const awayLogo = card.getAttribute("data-away-logo") || "";
      const awayScore = card.getAttribute("data-away-score") || "";

      await Promise.all([
        Storage.set("matchEventId", eventId),
        Storage.set("matchName", matchName),
        Storage.set("matchKickoff", kickoff),
        Storage.set("matchVenue", venue),
        Storage.set("matchState", state),
        Storage.set("matchHomeName", homeName),
        Storage.set("matchHomeLogo", homeLogo),
        Storage.set("matchHomeScore", homeScore),
        Storage.set("matchAwayName", awayName),
        Storage.set("matchAwayLogo", awayLogo),
        Storage.set("matchAwayScore", awayScore),
        Storage.set("matchInitialTab", "timeline"),
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

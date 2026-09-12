/**
 * matches/match_detail.js - Full-page Match Center & Detail View
 * Dedicated broadcast layout with Timeline, Team Stats, and Highlights.
 * No modals or popups. Fits smoothly in the Chrome extension window.
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps } from "../utils.js";
import { getMatchSummary } from "../api.js";
import { getHighlights, renderHighlightsHTML } from "../highlight/highlights.js";

function renderShellHTML(matchTitle) {
  return `
    <div class="match-detail-page">
      <div class="match-detail-header">
        <button class="back-btn" id="matchDetailBackBtn">
          <span class="back-arrow">‹</span> BACK
        </button>
        <div class="match-detail-title-wrap">
          <span class="detail-kicker">MATCH CENTER</span>
          <h2 class="match-detail-title" title="${escapeHTML(matchTitle)}">${escapeHTML(matchTitle)}</h2>
        </div>
      </div>

      <div id="matchDetailBody" class="match-detail-body">
        <div class="info-msg">
          <div class="loader"></div>
          <span>TRANSMITTING MATCHDAY DATA…</span>
        </div>
      </div>
    </div>
  `;
}

function renderContentHTML(data, meta) {
  const header = data?.header || {};
  const comp = header.competitions?.[0] || {};
  const statusType = comp.status?.type || {};

  const state = statusType.state || meta.state || "pre";
  const isPre = state === "pre";
  const isLive = state === "in";
  const isPost = state === "post";

  let statusLabel = "UPCOMING";
  if (isLive) {
    statusLabel = statusType.shortDetail || statusType.detail || "● LIVE";
  } else if (isPost) {
    statusLabel = statusType.shortDetail || statusType.detail || "FT";
  }

  const competitors = comp.competitors || [];
  const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0] || {};
  const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1] || {};

  const homeTeam = homeComp.team || {};
  const awayTeam = awayComp.team || {};

  const homeName = homeTeam.displayName || homeTeam.name || meta.homeName || "Home";
  const awayName = awayTeam.displayName || awayTeam.name || meta.awayName || "Away";

  const homeLogo = homeTeam.logos?.[0]?.href
    ? ensureHttps(homeTeam.logos[0].href)
    : (meta.homeLogo || "");
  const awayLogo = awayTeam.logos?.[0]?.href
    ? ensureHttps(awayTeam.logos[0].href)
    : (meta.awayLogo || "");

  const rawHomeScore = homeComp.score?.value ?? homeComp.score ?? meta.homeScore;
  const rawAwayScore = awayComp.score?.value ?? awayComp.score ?? meta.awayScore;

  const homeScore = (rawHomeScore != null && rawHomeScore !== "") ? String(rawHomeScore) : "-";
  const awayScore = (rawAwayScore != null && rawAwayScore !== "") ? String(rawAwayScore) : "-";

  const venueName = comp.venue?.fullName || meta.venue || "";
  const kickoff = meta.kickoff || "";
  const leagueName = header.season?.displayName || comp.league?.name || "";

  const activeTab = meta.initialTab || "timeline";

  // 1. Scoreboard Banner
  let centerScoreHTML = "";
  if (isPre) {
    centerScoreHTML = `
      <span class="banner-status-tag">UPCOMING</span>
      <div class="banner-digits banner-vs">
        <span class="vs-text">VS</span>
      </div>
      ${kickoff ? `<span class="banner-kickoff-time">⏱ ${escapeHTML(kickoff)}</span>` : ""}
      ${venueName ? `<span class="banner-venue" title="${escapeHTML(venueName)}">🏟 ${escapeHTML(venueName)}</span>` : ""}
    `;
  } else {
    centerScoreHTML = `
      <span class="banner-status-tag ${isLive ? "live-tag" : ""}">${escapeHTML(statusLabel)}</span>
      <div class="banner-digits">
        <span>${escapeHTML(homeScore)}</span>
        <span class="score-sep">:</span>
        <span>${escapeHTML(awayScore)}</span>
      </div>
      ${venueName ? `<span class="banner-venue" title="${escapeHTML(venueName)}">🏟 ${escapeHTML(venueName)}</span>` : ""}
    `;
  }

  const scoreboardHTML = `
    <div class="summary-scoreboard-banner">
      <div class="banner-team home-banner">
        ${homeLogo ? `<img class="banner-logo" src="${escapeHTML(homeLogo)}" alt="${escapeHTML(homeName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
        <span class="banner-team-name">${escapeHTML(homeName)}</span>
      </div>

      <div class="banner-score-box">
        ${centerScoreHTML}
      </div>

      <div class="banner-team away-banner">
        ${awayLogo ? `<img class="banner-logo" src="${escapeHTML(awayLogo)}" alt="${escapeHTML(awayName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
        <span class="banner-team-name">${escapeHTML(awayName)}</span>
      </div>
    </div>
  `;

  // 2. Timeline Events & Fixture Preview
  const keyEvents = data?.keyEvents || [];
  let timelineHTML = "";

  if (keyEvents.length > 0) {
    const eventsList = keyEvents.map((ev) => {
      const clock = ev.clock?.displayValue || "";
      const text = ev.text || ev.shortText || "Event";
      const isGoal = ev.scoringPlay || ev.type?.type?.includes("goal");
      const isYellow = ev.type?.type?.includes("yellow") || ev.type?.text?.toLowerCase().includes("yellow");
      const isRed = ev.type?.type?.includes("red") || ev.type?.text?.toLowerCase().includes("red");

      let eventIcon = "⏱";
      let eventCls = "event-generic";
      if (isGoal) {
        eventIcon = "⚽";
        eventCls = "event-goal";
      } else if (isRed) {
        eventIcon = "🟥";
        eventCls = "event-red";
      } else if (isYellow) {
        eventIcon = "🟨";
        eventCls = "event-yellow";
      }

      return `
        <div class="timeline-event ${eventCls}">
          <span class="event-clock">${escapeHTML(clock)}</span>
          <span class="event-icon">${eventIcon}</span>
          <div class="event-text-wrap">
            <span class="event-team-label">${escapeHTML(ev.team?.displayName || "")}</span>
            <span class="event-desc">${escapeHTML(text)}</span>
          </div>
        </div>
      `;
    }).join("");

    timelineHTML = `<div class="timeline-list">${eventsList}</div>`;
  } else if (isPre) {
    timelineHTML = `
      <div class="match-preview-card">
        <div class="preview-badge-row">
          <span class="preview-badge">⏳ FIXTURE PREVIEW</span>
          <span class="preview-status-pill">UPCOMING MATCH</span>
        </div>
        <h3 class="preview-title">${escapeHTML(homeName)} vs ${escapeHTML(awayName)}</h3>
        <p class="preview-desc">This match is scheduled to kick off soon. Live timeline, goals, substitutions, cards and commentary updates will stream here minute-by-minute once kickoff starts.</p>
        <div class="preview-meta-list">
          <div class="preview-meta-item">
            <span class="meta-icon">⏱</span>
            <span class="meta-label">Kickoff:</span>
            <strong>${escapeHTML(kickoff || "Scheduled")}</strong>
          </div>
          ${venueName ? `
            <div class="preview-meta-item">
              <span class="meta-icon">🏟</span>
              <span class="meta-label">Venue:</span>
              <strong>${escapeHTML(venueName)}</strong>
            </div>` : ""}
          ${leagueName ? `
            <div class="preview-meta-item">
              <span class="meta-icon">🏆</span>
              <span class="meta-label">Competition:</span>
              <strong>${escapeHTML(leagueName)}</strong>
            </div>` : ""}
        </div>
      </div>
    `;
  } else {
    timelineHTML = `
      <div class="summary-empty">
        <p>No key match events recorded for this game.</p>
      </div>
    `;
  }

  // 3. Team Stats Comparison Bars
  let statsHTML = "";

  if (isPre) {
    statsHTML = `
      <div class="stats-pending-box">
        <div class="stats-pending-icon">📊</div>
        <h3 class="stats-pending-title">Match Statistics Pending Kickoff</h3>
        <p class="stats-pending-desc">
          Live matchday statistics — including possession %, total shots, shots on target, corners, saves, and fouls — will calculate and stream live once the referee starts the game.
        </p>
        <div class="stats-pending-meta">
          <span class="pending-chip">⏱️ Kickoff: ${escapeHTML(kickoff || "Scheduled")}</span>
          ${venueName ? `<span class="pending-chip">🏟️ ${escapeHTML(venueName)}</span>` : ""}
        </div>
      </div>
    `;
  } else {
    const boxTeams = data?.boxscore?.teams || [];
    if (boxTeams.length >= 2) {
      const homeStats = boxTeams[0]?.statistics || [];
      const awayStats = boxTeams[1]?.statistics || [];

      const inGameRows = [
        { name: "possessionPct", label: "Possession %" },
        { name: "totalShots", label: "Total Shots" },
        { name: "shotsOnTarget", label: "Shots On Target" },
        { name: "wonCorners", label: "Corners" },
        { name: "foulsCommitted", label: "Fouls" },
        { name: "saves", label: "Saves" },
      ];

      const availableRows = inGameRows.filter((r) =>
        homeStats.some((s) => s.name === r.name) || awayStats.some((s) => s.name === r.name)
      );

      if (availableRows.length > 0) {
        const renderedStats = availableRows.map((row) => {
          const hStat = homeStats.find((s) => s.name === row.name);
          const aStat = awayStats.find((s) => s.name === row.name);

          const hValNum = Number(hStat?.value ?? hStat?.displayValue ?? 0) || 0;
          const aValNum = Number(aStat?.value ?? aStat?.displayValue ?? 0) || 0;

          const hValStr = hStat?.displayValue ?? String(hValNum);
          const aValStr = aStat?.displayValue ?? String(aValNum);

          let hPct = 50;
          let aPct = 50;
          const total = Math.abs(hValNum) + Math.abs(aValNum);
          if (total > 0) {
            hPct = Math.round((Math.abs(hValNum) / total) * 100);
            aPct = 100 - hPct;
          }

          return `
            <div class="stat-comp-row">
              <div class="stat-comp-header">
                <span class="stat-val stat-val-home">${escapeHTML(hValStr)}</span>
                <span class="stat-metric-name">${escapeHTML(row.label)}</span>
                <span class="stat-val stat-val-away">${escapeHTML(aValStr)}</span>
              </div>
              <div class="stat-bar-track">
                <div class="stat-bar-fill-home" style="width: ${hPct}%;"></div>
                <div class="stat-bar-fill-away" style="width: ${aPct}%;"></div>
              </div>
            </div>
          `;
        }).join("");

        statsHTML = `<div class="stats-comparison-box">${renderedStats}</div>`;
      } else {
        statsHTML = `
          <div class="summary-empty">
            <p>Detailed in-game statistics are not recorded for this match.</p>
          </div>
        `;
      }
    } else {
      statsHTML = `
        <div class="summary-empty">
          <p>Detailed team statistics will update live during match play.</p>
        </div>
      `;
    }
  }

  // 4. Sub-tabs Navigation
  return `
    ${scoreboardHTML}

    <div class="summary-nav-tabs">
      <button class="summary-tab-btn ${activeTab === "timeline" ? "active" : ""}" data-tab="timeline">⏱️ TIMELINE</button>
      <button class="summary-tab-btn ${activeTab === "stats" ? "active" : ""}" data-tab="stats">📊 TEAM STATS</button>
      <button class="summary-tab-btn ${activeTab === "highlights" ? "active" : ""}" data-tab="highlights">🎬 HIGHLIGHTS</button>
    </div>

    <div class="summary-tab-section ${activeTab === "timeline" ? "active" : ""}" id="tab-timeline">
      ${timelineHTML}
    </div>

    <div class="summary-tab-section ${activeTab === "stats" ? "active" : ""}" id="tab-stats">
      ${statsHTML}
    </div>

    <div class="summary-tab-section ${activeTab === "highlights" ? "active" : ""}" id="tab-highlights">
      <div id="matchDetailHighlightsWrap" class="match-detail-highlights-wrap">
        <div class="info-msg">
          <div class="loader"></div>
          <span>RETRIEVING BROADCAST REELS & HIGHLIGHTS…</span>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  const [
    eventId,
    slug,
    matchName,
    kickoff,
    venue,
    state,
    homeName,
    homeLogo,
    homeScore,
    awayName,
    awayLogo,
    awayScore,
    initialTab,
  ] = await Promise.all([
    Storage.get("matchEventId"),
    Storage.get("leagueSlug"),
    Storage.get("matchName"),
    Storage.get("matchKickoff"),
    Storage.get("matchVenue"),
    Storage.get("matchState"),
    Storage.get("matchHomeName"),
    Storage.get("matchHomeLogo"),
    Storage.get("matchHomeScore"),
    Storage.get("matchAwayName"),
    Storage.get("matchAwayLogo"),
    Storage.get("matchAwayScore"),
    Storage.get("matchInitialTab"),
  ]);

  const resolvedMatchName = matchName || "Match Details";

  container.innerHTML = renderShellHTML(resolvedMatchName);

  const backBtn = container.querySelector("#matchDetailBackBtn");
  backBtn.addEventListener("click", () => navigate("back"));

  const bodyEl = container.querySelector("#matchDetailBody");

  const meta = {
    matchName: resolvedMatchName,
    kickoff: kickoff || "",
    venue: venue || "",
    state: state || "pre",
    homeName: homeName || "Home",
    homeLogo: homeLogo || "",
    homeScore: homeScore || "",
    awayName: awayName || "Away",
    awayLogo: awayLogo || "",
    awayScore: awayScore || "",
    initialTab: initialTab || "timeline",
  };

  // Pre-load highlights promise immediately for snappy switching
  const query = `${resolvedMatchName} highlights`;
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const highlightsPromise = getHighlights(query).catch((err) => {
    console.warn("Highlights fetch error in match center:", err);
    return [];
  });

  let matchData = null;
  if (eventId) {
    try {
      matchData = await getMatchSummary(slug || "all", eventId);
    } catch (err) {
      console.warn("Notice: getMatchSummary was unable to fetch summary payload:", err);
    }
  }

  // Render match center layout (with data or graceful fallback)
  bodyEl.innerHTML = renderContentHTML(matchData, meta);

  // Wire Sub Tabs
  const tabBtns = bodyEl.querySelectorAll(".summary-tab-btn");
  const tabSections = bodyEl.querySelectorAll(".summary-tab-section");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabSections.forEach((s) => s.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.dataset.tab;
      const target = bodyEl.querySelector(`#tab-${tabId}`);
      if (target) target.classList.add("active");
    });
  });

  // Populate Highlights sub-page
  const highlightsWrap = bodyEl.querySelector("#matchDetailHighlightsWrap");
  highlightsPromise.then((highlights) => {
    if (highlightsWrap) {
      highlightsWrap.innerHTML = renderHighlightsHTML(highlights, resolvedMatchName, ytSearchUrl);
    }
  });
}

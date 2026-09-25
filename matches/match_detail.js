/**
 * matches/match_detail.js - Full-page Match Center & Detail View
 * Dedicated broadcast layout with Timeline, Team Stats, and Highlights.
 * No modals or popups. Fits smoothly in the Chrome extension window.
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps, formatKickoff } from "../utils.js";
import { getMatchSummary } from "../api.js";
import { getHighlights, renderHighlightsHTML, normalizeMatchQuery } from "../highlight/highlights.js";

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

  const activeTab = meta.initialTab || "h2h";

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

  // 4. Lineups & Tactical Formations
  const lineupsHTML = renderLineupsHTML(data, meta);

  // 5. Head-to-Head & Recent Form
  const h2hHTML = renderH2HAndFormHTML(data, meta);

  // 6. Sub-tabs Navigation
  return `
    ${scoreboardHTML}

    <div class="summary-nav-tabs">
      <button class="summary-tab-btn ${activeTab === "timeline" ? "active" : ""}" data-tab="timeline">⏱️ TIMELINE</button>
      <button class="summary-tab-btn ${activeTab === "lineups" ? "active" : ""}" data-tab="lineups">📋 LINEUPS</button>
      <button class="summary-tab-btn ${activeTab === "h2h" ? "active" : ""}" data-tab="h2h">⚔️ H2H & FORM</button>
      <button class="summary-tab-btn ${activeTab === "stats" ? "active" : ""}" data-tab="stats">📊 STATS</button>
      <button class="summary-tab-btn ${activeTab === "highlights" ? "active" : ""}" data-tab="highlights">🎬 REELS</button>
    </div>

    <div class="summary-tab-section ${activeTab === "timeline" ? "active" : ""}" id="tab-timeline">
      ${timelineHTML}
    </div>

    <div class="summary-tab-section ${activeTab === "lineups" ? "active" : ""}" id="tab-lineups">
      ${lineupsHTML}
    </div>

    <div class="summary-tab-section ${activeTab === "h2h" ? "active" : ""}" id="tab-h2h">
      ${h2hHTML}
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

function renderRosterColumn(rosterObj, fallbackName, fallbackLogo) {
  const team = rosterObj?.team || {};
  const teamName = team.displayName || team.name || fallbackName || "Club";
  const teamLogo = team.logo || team.logos?.[0]?.href || fallbackLogo || "";
  const formation = rosterObj?.formation ? `Setup: ${rosterObj.formation}` : "Tactical Setup";
  const rawRoster = rosterObj?.roster || [];

  const starters = rawRoster.filter((p) => p.starter);
  const bench = rawRoster.filter((p) => !p.starter);

  function renderPlayerItem(p) {
    const name = p.athlete?.displayName || p.athlete?.shortName || p.athlete?.name || "Player";
    const jersey = p.jersey ? `#${p.jersey}` : "•";
    const pos = p.position?.abbreviation || p.position?.displayName || "";
    const isSubbedOut = p.subbedOut;
    const isSubbedIn = p.subbedIn;

    let subTag = "";
    if (isSubbedOut) subTag = `<span class="player-sub-badge out" title="Substituted Off">▼</span>`;
    if (isSubbedIn) subTag = `<span class="player-sub-badge in" title="Substituted On">▲</span>`;

    return `
      <div class="lineup-player-row">
        <span class="player-jersey-pill">${escapeHTML(jersey)}</span>
        <span class="player-lineup-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
        ${subTag}
        ${pos ? `<span class="player-pos-tag">${escapeHTML(pos)}</span>` : ""}
      </div>
    `;
  }

  return `
    <div class="lineup-team-col">
      <div class="lineup-team-header">
        ${teamLogo ? `<img class="lineup-team-crest" src="${escapeHTML(teamLogo)}" alt="${escapeHTML(teamName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
        <div class="lineup-team-meta">
          <h4 class="lineup-team-name">${escapeHTML(teamName)}</h4>
          <span class="lineup-formation-badge">${escapeHTML(formation)}</span>
        </div>
      </div>

      <div class="lineup-group">
        <div class="lineup-group-header">
          <span class="lineup-group-title">STARTING XI</span>
          <span class="lineup-count-pill">${starters.length}</span>
        </div>
        <div class="lineup-players-list">
          ${starters.length > 0 ? starters.map(renderPlayerItem).join("") : '<div class="lineup-pending-note">Starters not yet announced</div>'}
        </div>
      </div>

      ${bench.length > 0 ? `
        <div class="lineup-group bench-group">
          <div class="lineup-group-header">
            <span class="lineup-group-title">SUBSTITUTES</span>
            <span class="lineup-count-pill">${bench.length}</span>
          </div>
          <div class="lineup-players-list bench-list">
            ${bench.map(renderPlayerItem).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;
}

function getSideRank(p) {
  const abbr = (p.position?.abbreviation || "").toUpperCase();
  const name = (p.position?.name || p.position?.displayName || "").toLowerCase();
  if (abbr.includes("L") || name.includes("left")) return 1;
  if (abbr.includes("C") || name.includes("center") || name.includes("centre")) return 2;
  if (abbr.includes("R") || name.includes("right")) return 3;
  return 2;
}

function parseFormationLines(formationStr) {
  if (!formationStr) return null;
  const parts = formationStr.split(/[-–—]/).map((n) => parseInt(n.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum === 10) return parts;
  return null;
}

function buildTeamLines(rosterObj) {
  const rawRoster = rosterObj?.roster || [];
  const starters = rawRoster.filter((p) => p.starter);
  if (!starters.length) return null;

  // Identify GK
  let gkIndex = starters.findIndex((p) => {
    const abbr = (p.position?.abbreviation || "").toUpperCase();
    const name = (p.position?.name || p.position?.displayName || "").toLowerCase();
    return abbr === "G" || abbr === "GK" || name.includes("goal") || String(p.formationPlace) === "1";
  });
  if (gkIndex < 0) gkIndex = 0;

  const gk = starters[gkIndex];
  const outfield = starters.filter((_, idx) => idx !== gkIndex);

  // Categorize outfielders into DEF, MID, FWD
  const defs = [];
  const mids = [];
  const fwds = [];

  outfield.forEach((p) => {
    const abbr = (p.position?.abbreviation || "").toUpperCase();
    const name = (p.position?.displayName || p.position?.name || "").toLowerCase();
    if (abbr.includes("B") || abbr.includes("D") || name.includes("def") || name.includes("back")) {
      defs.push(p);
    } else if (abbr.includes("F") || abbr.includes("W") || abbr.includes("S") || name.includes("forw") || name.includes("att") || name.includes("strik")) {
      fwds.push(p);
    } else {
      mids.push(p);
    }
  });

  // Sort each group left to right
  defs.sort((a, b) => getSideRank(a) - getSideRank(b));
  mids.sort((a, b) => getSideRank(a) - getSideRank(b));
  fwds.sort((a, b) => getSideRank(a) - getSideRank(b));

  const sortedOutfield = [...defs, ...mids, ...fwds];

  const parsedParts = parseFormationLines(rosterObj?.formation);
  let lines = [];
  if (parsedParts) {
    let offset = 0;
    parsedParts.forEach((count) => {
      lines.push(sortedOutfield.slice(offset, offset + count));
      offset += count;
    });
  } else {
    if (defs.length) lines.push(defs);
    if (mids.length) lines.push(mids);
    if (fwds.length) lines.push(fwds);
    if (!lines.length) {
      lines = [
        sortedOutfield.slice(0, 4),
        sortedOutfield.slice(4, 8),
        sortedOutfield.slice(8, 10),
      ];
    }
  }

  const formationName = rosterObj?.formation || lines.map((l) => l.length).join("-");
  return { gk, lines, formation: formationName, starters };
}

function getLineXPositions(count) {
  if (count <= 1) return [50];
  if (count === 2) return [34, 66];
  if (count === 3) return [22, 50, 78];
  if (count === 4) return [14, 38, 62, 86];
  if (count === 5) return [12, 31, 50, 69, 88];
  const res = [];
  for (let i = 0; i < count; i++) {
    res.push(12 + i * (76 / (count - 1)));
  }
  return res;
}

const PORTRAIT_CACHE_PREFIX = "portrait_";
const PORTRAIT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function getCachedPortrait(pName) {
  try {
    const key = PORTRAIT_CACHE_PREFIX + pName.toLowerCase();
    const item = await Storage.get(key);
    if (item && item.url && item.expiresAt && Date.now() < item.expiresAt) {
      return item.url;
    }
  } catch (_e) {}
  return null;
}

async function setCachedPortrait(pName, url) {
  try {
    const key = PORTRAIT_CACHE_PREFIX + pName.toLowerCase();
    await Storage.set(key, { url, expiresAt: Date.now() + PORTRAIT_CACHE_TTL_MS });
  } catch (_e) {}
}

function applyPitchPortrait(athleteId, url) {
  if (!athleteId || !url) return;
  const img = new Image();
  img.onload = () => {
    const imgEl = document.getElementById(`pitch-img-${athleteId}`);
    const fallbackEl = document.getElementById(`pitch-fallback-${athleteId}`);
    if (imgEl) {
      imgEl.src = url;
      imgEl.style.display = "block";
    }
    if (fallbackEl) {
      fallbackEl.style.display = "none";
    }
  };
  img.src = url;
}

async function loadPitchPortraitsBatched(starters) {
  if (!starters || !starters.length) return;

  const toFetch = [];
  for (const p of starters) {
    if (p.resolvedImg) continue;
    const athlete = p.athlete || {};
    const athleteId = String(athlete.id || p.id || "");
    const name = athlete.fullName || athlete.displayName || athlete.name || "";
    if (!name || !athleteId) continue;

    const cached = await getCachedPortrait(name);
    if (cached) {
      p.resolvedImg = cached;
      applyPitchPortrait(athleteId, cached);
    } else {
      toFetch.push({ athleteId, name });
    }
  }

  const batchSize = 3;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ({ athleteId, name }) => {
        const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        let cutout = null;
        try {
          const res = await fetch(
            `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(cleanName)}`
          );
          if (res.ok) {
            const data = await res.json();
            const pList = data?.player || [];
            const withCutout = pList.find((pl) => pl.strCutout || pl.strRender || pl.strThumb) || pList[0];
            cutout = withCutout?.strCutout || withCutout?.strRender || withCutout?.strThumb;
          }
        } catch (_e) {}

        if (cutout) {
          await setCachedPortrait(name, cutout);
          applyPitchPortrait(athleteId, cutout);
        }
      })
    );

    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }
}

function renderPitchPlayerNode(p, topPct, leftPct) {
  const athlete = p.athlete || {};
  const athleteId = String(athlete.id || p.id || Math.random().toString(36).slice(2, 7));
  const rawJersey = p.jersey != null ? String(p.jersey).replace(/^#/, "").trim() : "";
  const shortName = athlete.shortName || athlete.displayName || athlete.name || "Player";
  const fullName = athlete.fullName || athlete.displayName || shortName;

  const verifiedImg = p.resolvedImg || (athlete.headshot?.href ? ensureHttps(athlete.headshot.href) : "");

  const stats = p.stats || [];
  const hasYellow = stats.some((s) => s.name === "yellowCards" && Number(s.value) > 0);
  const hasRed = stats.some((s) => s.name === "redCards" && Number(s.value) > 0);
  const hasGoal = stats.some((s) => (s.name === "totalGoals" || s.name === "goals") && Number(s.value) > 0);
  const isCaptain = p.captain === true;

  return `
    <div class="pitch-player-node" style="top: ${topPct.toFixed(1)}%; left: ${leftPct.toFixed(1)}%;">
      <div class="pitch-player-avatar-wrap">
        <div class="pitch-avatar-circle">
          <img class="pitch-player-img" id="pitch-img-${escapeHTML(athleteId)}"
               src="${escapeHTML(verifiedImg)}"
               alt="${escapeHTML(fullName)}"
               data-athlete-id="${escapeHTML(athleteId)}"
               loading="lazy"
               ${!verifiedImg ? 'style="display:none;"' : ''}>
          <div class="pitch-player-fallback" id="pitch-fallback-${escapeHTML(athleteId)}" ${verifiedImg ? 'style="display:none;"' : ''}>
            <svg class="pitch-fallback-avatar" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/>
            </svg>
          </div>
        </div>
        ${rawJersey ? `<span class="pitch-player-number">${escapeHTML(rawJersey)}</span>` : ""}
        ${isCaptain ? `<span class="pitch-player-event-badge captain" title="Team Captain">C</span>` : ""}
        ${hasGoal ? `<span class="pitch-player-event-badge goal" title="Goal Scored">⚽</span>` : ""}
        ${hasYellow ? `<span class="pitch-player-event-badge card-yellow" title="Yellow Card"></span>` : ""}
        ${hasRed ? `<span class="pitch-player-event-badge card-red" title="Red Card"></span>` : ""}
      </div>
      <span class="pitch-player-name" title="${escapeHTML(fullName)}">${escapeHTML(shortName)}</span>
    </div>
  `;
}

function calculateAvgAge(starters) {
  if (!starters || !starters.length) return null;
  const ages = starters.map((p) => parseInt(p.athlete?.age || p.age, 10)).filter((a) => !isNaN(a) && a > 15 && a < 50);
  if (!ages.length) return null;
  const avg = ages.reduce((s, v) => s + v, 0) / ages.length;
  return avg.toFixed(1);
}

function renderPitchFormationHTML(homeRoster, awayRoster, meta) {
  const homeData = buildTeamLines(homeRoster);
  const awayData = buildTeamLines(awayRoster);

  if (!homeData || !awayData) return "";

  const homeLogo = meta.homeLogo || homeRoster.team?.logo || homeRoster.team?.logos?.[0]?.href || "";
  const homeName = meta.homeName || homeRoster.team?.displayName || "Home Team";
  const homeCoach = homeRoster.coach?.displayName || homeRoster.coach?.[0]?.displayName || "";
  const homeAvgAge = calculateAvgAge(homeData.starters);

  const awayLogo = meta.awayLogo || awayRoster.team?.logo || awayRoster.team?.logos?.[0]?.href || "";
  const awayName = meta.awayName || awayRoster.team?.displayName || "Away Team";
  const awayCoach = awayRoster.coach?.displayName || awayRoster.coach?.[0]?.displayName || "";
  const awayAvgAge = calculateAvgAge(awayData.starters);

  // Render Home Players (Top Half: 0% - 50%)
  const homePlayerNodes = [];
  if (homeData.gk) {
    homePlayerNodes.push(renderPitchPlayerNode(homeData.gk, 6.5, 50));
  }
  const homeLines = homeData.lines;
  const hL = homeLines.length;
  homeLines.forEach((line, lineIdx) => {
    const topPct = hL > 1 ? 16 + lineIdx * (26 / (hL - 1)) : 28;
    const xPositions = getLineXPositions(line.length);
    line.forEach((p, pIdx) => {
      homePlayerNodes.push(renderPitchPlayerNode(p, topPct, xPositions[pIdx]));
    });
  });

  // Render Away Players (Bottom Half: 50% - 100%)
  const awayPlayerNodes = [];
  const awayLines = [...awayData.lines].reverse();
  const aL = awayLines.length;
  awayLines.forEach((line, lineIdx) => {
    const topPct = aL > 1 ? 57.5 + lineIdx * (26.5 / (aL - 1)) : 71;
    const xPositions = getLineXPositions(line.length);
    line.forEach((p, pIdx) => {
      awayPlayerNodes.push(renderPitchPlayerNode(p, topPct, xPositions[pIdx]));
    });
  });
  if (awayData.gk) {
    awayPlayerNodes.push(renderPitchPlayerNode(awayData.gk, 93.5, 50));
  }

  return `
    <div class="pitch-formation-wrap">
      <!-- Home Manager / Team Header Bar -->
      <div class="pitch-team-bar home-bar">
        <div class="pitch-team-info">
          ${homeLogo ? `<img class="pitch-team-crest" src="${escapeHTML(homeLogo)}" alt="${escapeHTML(homeName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
          <div class="pitch-team-text">
            <span class="pitch-team-name">${escapeHTML(homeCoach || homeName)}</span>
            <span class="pitch-team-sub">${escapeHTML(homeCoach ? homeName : "Home Starting XI")}</span>
          </div>
        </div>
        <div class="pitch-stat-badge">
          <span class="stat-badge-val">${escapeHTML(homeAvgAge || homeData.formation)}</span>
          <span class="stat-badge-label">${homeAvgAge ? "AVERAGE AGE" : "FORMATION"}</span>
        </div>
      </div>

      <!-- Soccer Pitch Board -->
      <div class="pitch-board">
        <svg class="pitch-markings" viewBox="0 0 400 580" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pitchGrass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2E7D32"/>
              <stop offset="50%" stop-color="#276C2B"/>
              <stop offset="100%" stop-color="#1E5E24"/>
            </linearGradient>
            <pattern id="grassStripes" width="400" height="48.33" patternUnits="userSpaceOnUse">
              <rect width="400" height="24.16" fill="rgba(255,255,255,0.035)"/>
              <rect y="24.16" width="400" height="24.16" fill="rgba(0,0,0,0.035)"/>
            </pattern>
          </defs>
          <rect width="400" height="580" fill="url(#pitchGrass)"/>
          <rect width="400" height="580" fill="url(#grassStripes)"/>
          <rect x="16" y="16" width="368" height="548" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <line x1="16" y1="290" x2="384" y2="290" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <circle cx="200" cy="290" r="46" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <circle cx="200" cy="290" r="3" fill="rgba(255,255,255,0.7)"/>
          <!-- Top Penalty Area -->
          <rect x="88" y="16" width="224" height="92" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <rect x="144" y="16" width="112" height="34" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <circle cx="200" cy="76" r="3" fill="rgba(255,255,255,0.7)"/>
          <path d="M 160 108 A 46 46 0 0 0 240 108" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <!-- Bottom Penalty Area -->
          <rect x="88" y="472" width="224" height="92" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <rect x="144" y="530" width="112" height="34" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <circle cx="200" cy="504" r="3" fill="rgba(255,255,255,0.7)"/>
          <path d="M 160 472 A 46 46 0 0 1 240 472" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <!-- Corner Arcs -->
          <path d="M 16 28 A 12 12 0 0 0 28 16" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <path d="M 372 16 A 12 12 0 0 0 384 28" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <path d="M 16 552 A 12 12 0 0 1 28 564" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
          <path d="M 372 564 A 12 12 0 0 1 384 552" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="2"/>
        </svg>

        <!-- Formation corner pills -->
        <div class="pitch-formation-tag top-tag">${escapeHTML(homeData.formation)}</div>
        <div class="pitch-formation-tag bottom-tag">${escapeHTML(awayData.formation)}</div>

        <!-- Home players -->
        ${homePlayerNodes.join("")}

        <!-- Away players -->
        ${awayPlayerNodes.join("")}
      </div>

      <!-- Away Manager / Team Header Bar -->
      <div class="pitch-team-bar away-bar">
        <div class="pitch-team-info">
          ${awayLogo ? `<img class="pitch-team-crest" src="${escapeHTML(awayLogo)}" alt="${escapeHTML(awayName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
          <div class="pitch-team-text">
            <span class="pitch-team-name">${escapeHTML(awayCoach || awayName)}</span>
            <span class="pitch-team-sub">${escapeHTML(awayCoach ? awayName : "Away Starting XI")}</span>
          </div>
        </div>
        <div class="pitch-stat-badge">
          <span class="stat-badge-val">${escapeHTML(awayAvgAge || awayData.formation)}</span>
          <span class="stat-badge-label">${awayAvgAge ? "AVERAGE AGE" : "FORMATION"}</span>
        </div>
      </div>
    </div>
  `;
}

function renderLineupsHTML(data, meta) {
  const rosters = data?.rosters || [];
  const homeRoster = rosters.find((r) => r.homeAway === "home") || rosters[0];
  const awayRoster = rosters.find((r) => r.homeAway === "away") || rosters[1];

  const hasStarters = (homeRoster?.roster?.some((p) => p.starter)) || (awayRoster?.roster?.some((p) => p.starter));

  if (!hasStarters) {
    return `
      <div class="lineup-pending-card">
        <div class="lineup-pending-icon">📋</div>
        <h3 class="lineup-pending-title">Official Starting Lineups Pending</h3>
        <p class="lineup-pending-desc">
          Official starting XIs, tactical formations, and substitutes are typically confirmed and announced by both clubs approximately <strong>60 to 75 minutes</strong> before scheduled kickoff.
        </p>
        <div class="lineup-pending-meta">
          <span class="pending-chip">⏱️ Kickoff: ${escapeHTML(meta.kickoff || "Scheduled")}</span>
          ${meta.venue ? `<span class="pending-chip">🏟️ ${escapeHTML(meta.venue)}</span>` : ""}
        </div>
      </div>
    `;
  }

  const pitchFormationHTML = renderPitchFormationHTML(homeRoster, awayRoster, meta);

  return `
    <div class="lineups-view-wrap">
      ${pitchFormationHTML}

      <div class="lineup-roster-section">
        <div class="lineup-section-header">
          <h4 class="match-detail-section-title">DETAILED SQUADS & BENCH</h4>
        </div>
        <div class="lineups-dual-container">
          ${renderRosterColumn(homeRoster, meta.homeName, meta.homeLogo)}
          ${renderRosterColumn(awayRoster, meta.awayName, meta.awayLogo)}
        </div>
      </div>
    </div>
  `;
}

function renderH2HAndFormHTML(data, meta) {
  const lastFiveGames = data?.lastFiveGames || [];
  const seasonseries = data?.seasonseries || [];

  const homeFive = lastFiveGames.find((g) => g.team?.displayName === meta.homeName || g.team?.name === meta.homeName) || lastFiveGames[0] || {};
  const awayFive = lastFiveGames.find((g) => g.team?.displayName === meta.awayName || g.team?.name === meta.awayName) || lastFiveGames[1] || {};

  function renderFormPills(fiveObj, fallbackName, fallbackLogo) {
    const teamName = fiveObj.team?.displayName || fiveObj.team?.name || fallbackName;
    const teamLogo = fiveObj.team?.logo || fiveObj.team?.logos?.[0]?.href || fallbackLogo;
    const events = fiveObj.events || [];

    if (!events.length) {
      return `
        <div class="form-team-card">
          <div class="form-team-header">
            ${teamLogo ? `<img class="form-team-crest" src="${escapeHTML(teamLogo)}" alt="${escapeHTML(teamName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
            <span class="form-team-title">${escapeHTML(teamName)}</span>
          </div>
          <span class="form-empty-note">Recent match form not recorded</span>
        </div>
      `;
    }

    const pills = events.map((ev) => {
      const res = (ev.gameResult || ev.result || "-").toUpperCase();
      const opp = ev.opponent?.displayName || ev.opponent?.shortDisplayName || "Opponent";
      const score = ev.score || "";
      const cls = res === "W" ? "win" : (res === "D" ? "draw" : (res === "L" ? "loss" : "unknown"));
      const title = `${res} vs ${opp}${score ? ` (${score})` : ""}`;
      return `
        <div class="form-pill-wrap" title="${escapeHTML(title)}">
          <span class="form-pill ${cls}">${escapeHTML(res)}</span>
          <span class="form-opp-sub">${escapeHTML(score || opp.slice(0, 3))}</span>
        </div>
      `;
    }).join("");

    return `
      <div class="form-team-card">
        <div class="form-team-header">
          ${teamLogo ? `<img class="form-team-crest" src="${escapeHTML(teamLogo)}" alt="${escapeHTML(teamName)}">` : `<div class="team-logo-placeholder">⚽</div>`}
          <div class="form-team-title-wrap">
            <span class="form-team-title">${escapeHTML(teamName)}</span>
            <span class="form-subtitle">LAST 5 MATCHES</span>
          </div>
        </div>
        <div class="form-pills-row">
          ${pills}
        </div>
      </div>
    `;
  }

  const series = seasonseries[0] || {};
  const seriesEvents = series.events || [];
  const seriesSummary = series.summary || series.seriesScore || "";

  let h2hMatchesHTML = "";
  if (seriesEvents.length > 0) {
    h2hMatchesHTML = seriesEvents.map((ev) => {
      const comps = ev.competitors || [];
      const hComp = comps.find((c) => c.homeAway === "home") || comps[0] || {};
      const aComp = comps.find((c) => c.homeAway === "away") || comps[1] || {};
      const hTeam = hComp.team?.displayName || "Home";
      const aTeam = aComp.team?.displayName || "Away";
      const hScore = hComp.score ?? "-";
      const aScore = aComp.score ?? "-";
      const date = formatKickoff(ev.date);
      const compName = ev.competitionName || "Matchup";

      const hWon = hComp.winner === true;
      const aWon = aComp.winner === true;

      return `
        <div class="h2h-match-row">
          <div class="h2h-match-meta">
            <span class="h2h-comp">${escapeHTML(compName)}</span>
            <span class="h2h-date">${escapeHTML(date)}</span>
          </div>
          <div class="h2h-score-line">
            <span class="h2h-team h2h-team-home ${hWon ? "winner" : ""}">${escapeHTML(hTeam)}</span>
            <span class="h2h-score-digits">${escapeHTML(String(hScore))} : ${escapeHTML(String(aScore))}</span>
            <span class="h2h-team h2h-team-away ${aWon ? "winner" : ""}">${escapeHTML(aTeam)}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  return `
    <div class="h2h-wrap">
      <div class="form-guide-section">
        <h4 class="match-detail-section-title">RECENT FORM GUIDE</h4>
        <div class="form-teams-grid">
          ${renderFormPills(homeFive, meta.homeName, meta.homeLogo)}
          ${renderFormPills(awayFive, meta.awayName, meta.awayLogo)}
        </div>
      </div>

      <div class="h2h-series-section">
        <div class="h2h-section-header">
          <h4 class="match-detail-section-title">HEAD-TO-HEAD HISTORY</h4>
          ${seriesSummary ? `<span class="h2h-series-pill">⚔️ ${escapeHTML(seriesSummary)}</span>` : ""}
        </div>
        ${h2hMatchesHTML ? `
          <div class="h2h-matches-list">
            ${h2hMatchesHTML}
          </div>
        ` : `
          <div class="summary-empty">
            <p>No previous head-to-head records found for these clubs.</p>
          </div>
        `}
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
    initialTab: initialTab || "h2h",
  };

  // Pre-load highlights promise immediately for snappy switching
  const cleanMatchName = (homeName && awayName && homeName !== "Home" && awayName !== "Away")
    ? `${homeName} vs ${awayName}`
    : normalizeMatchQuery(resolvedMatchName);
  const query = `${cleanMatchName} highlights`;
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const isRecent = state === "in" || state === "post" || !state;
  const highlightsPromise = getHighlights(cleanMatchName, { isRecent }).catch((err) => {
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

  // Pre-resolve cached portraits for starting XI players so they render instantly
  const rosters = matchData?.rosters || [];
  const homeRoster = rosters.find((r) => r.homeAway === "home") || rosters[0];
  const awayRoster = rosters.find((r) => r.homeAway === "away") || rosters[1];
  const allStarters = [
    ...(homeRoster?.roster || []).filter((p) => p.starter),
    ...(awayRoster?.roster || []).filter((p) => p.starter),
  ];

  await Promise.all(
    allStarters.map(async (p) => {
      const name = p.athlete?.fullName || p.athlete?.displayName || p.athlete?.name;
      if (name) {
        const cached = await getCachedPortrait(name);
        if (cached) p.resolvedImg = cached;
      }
    })
  );

  // Render match center layout (with data or graceful fallback)
  bodyEl.innerHTML = renderContentHTML(matchData, meta);

  // Safety net: capture any image load errors on the pitch and fall back to SVG silhouette cleanly
  bodyEl.addEventListener("error", (e) => {
    if (e.target && e.target.classList.contains("pitch-player-img")) {
      e.target.style.display = "none";
      const athleteId = e.target.getAttribute("data-athlete-id");
      const fallback = document.getElementById(`pitch-fallback-${athleteId}`);
      if (fallback) fallback.style.display = "flex";
    }
  }, true);

  // Background portrait resolution for any starters without a verified photo yet
  const unresolvedStarters = allStarters.filter((p) => !p.resolvedImg && !p.athlete?.headshot?.href);
  if (unresolvedStarters.length > 0) {
    loadPitchPortraitsBatched(unresolvedStarters);
  }

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
      highlightsWrap.innerHTML = renderHighlightsHTML(highlights, cleanMatchName, ytSearchUrl);
    }
  });
}

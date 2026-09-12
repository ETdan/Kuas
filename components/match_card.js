import { escapeHTML, ensureHttps, formatKickoff } from "../utils.js";

/**
 * Format a season slug into a readable competition title.
 * e.g. "2026-27-english-premier-league" -> "ENGLISH PREMIER LEAGUE"
 */
export function formatCompetitionTitle(seasonSlug, defaultTitle = "SOCCER") {
  if (!seasonSlug) return defaultTitle;
  return seasonSlug
    .replace(/^\d{4}-\d{2}-/, "")
    .replace(/-/g, " ")
    .toUpperCase();
}

/**
 * Normalize any ESPN match event (from scoreboard, schedule, or core API)
 * into a standardized, bulletproof MatchCardData object.
 * @param {object} event Raw ESPN event object
 * @param {object} options Extra options e.g. { competitionTitle }
 * @returns {object|null} Standardized match data object or null if invalid
 */
export function normalizeEspnEvent(event, options = {}) {
  if (!event) return null;
  const comp = event.competitions?.[0] || event;
  const competitors = comp.competitors || [];
  if (competitors.length < 2) return null;

  const homeComp = competitors.find((c) => c.homeAway === "home") || competitors[0] || {};
  const awayComp = competitors.find((c) => c.homeAway === "away") || competitors[1] || {};

  const homeTeam = homeComp.team || {};
  const awayTeam = awayComp.team || {};

  const statusType = comp.status?.type || {};
  const state = statusType.state || "pre";
  const isLive = state === "in";
  const isPost = state === "post";

  let label = "FIXTURE";
  if (isLive) {
    const clock = comp.status?.displayClock || statusType.shortDetail || "";
    label = clock ? `● ${clock}` : "● LIVE";
  } else if (isPost) {
    label = statusType.shortDetail || statusType.detail || "FT";
  }

  const dateStr = comp.date || event.date;
  const kickoff = formatKickoff(dateStr);

  const homeName = homeTeam.displayName || homeTeam.name || "Home";
  const awayName = awayTeam.displayName || awayTeam.name || "Away";

  const homeLogo = ensureHttps(homeTeam.logo || homeTeam.logos?.[0]?.href || "");
  const awayLogo = ensureHttps(awayTeam.logo || awayTeam.logos?.[0]?.href || "");

  const homeScore = homeComp.score?.value ?? homeComp.score ?? "0";
  const awayScore = awayComp.score?.value ?? awayComp.score ?? "0";

  const compTitle = options.competitionTitle || formatCompetitionTitle(event.season?.slug, comp.league?.name || "");

  return {
    eventId: String(event.id || comp.id || ""),
    matchName: event.name || `${homeName} vs ${awayName}`,
    kickoff,
    state,
    label,
    detail: statusType.description || (isLive ? "In Play" : (isPost ? "Final" : "")),
    competitionTitle: compTitle,
    homeName,
    homeSlug: homeTeam.slug || "",
    homeId: String(homeTeam.id || ""),
    homeLogo,
    homeScore,
    awayName,
    awaySlug: awayTeam.slug || "",
    awayId: String(awayTeam.id || ""),
    awayLogo,
    awayScore,
    showScore: isLive || isPost,
    venueName: comp.venue?.fullName || comp.venue?.shortName || "",
  };
}

/**
 * Render a standardized Matchday scoreboard match card.
 * @param {object} d Match data object
 * @param {object} options Display options
 * @returns {string} HTML string
 */
export function renderMatchCardHTML(d, options = {}) {
  const homeLogo = d.homeLogo
    ? `<img class="team-logo" src="${escapeHTML(d.homeLogo)}" alt="${escapeHTML(d.homeName)}" loading="lazy">`
    : `<div class="team-logo-placeholder">⚽</div>`;
  const awayLogo = d.awayLogo
    ? `<img class="team-logo" src="${escapeHTML(d.awayLogo)}" alt="${escapeHTML(d.awayName)}" loading="lazy">`
    : `<div class="team-logo-placeholder">⚽</div>`;

  const isLive = d.state === "in";
  const isFinished = d.state === "post";

  let matchCenterBadge = "";
  if (isLive) {
    matchCenterBadge = `<span class="match-center-cue live-cue">LIVE MATCH CENTER ↗</span>`;
  } else if (isFinished) {
    matchCenterBadge = `<span class="match-center-cue">MATCH CENTER & REELS ↗</span>`;
  } else {
    matchCenterBadge = `<span class="match-center-cue fixture-cue">MATCH CENTER ↗</span>`;
  }

  return `
    <div class="match-card status-${escapeHTML(d.state || "pre")}"
         data-action="open-match-center"
         data-event-id="${escapeHTML(d.eventId || "")}"
         data-match-name="${escapeHTML(d.matchName || "")}"
         data-kickoff="${escapeHTML(d.kickoff || "")}"
         data-venue="${escapeHTML(d.venueName || "")}"
         data-state="${escapeHTML(d.state || "pre")}"
         data-home-name="${escapeHTML(d.homeName || "")}"
         data-home-logo="${escapeHTML(d.homeLogo || "")}"
         data-home-score="${escapeHTML(String(d.homeScore ?? ""))}"
         data-away-name="${escapeHTML(d.awayName || "")}"
         data-away-logo="${escapeHTML(d.awayLogo || "")}"
         data-away-score="${escapeHTML(String(d.awayScore ?? ""))}"
         role="button" tabindex="0" aria-label="${escapeHTML(d.matchName)}">
      <div class="match-top">
        <div class="match-kickoff">
          <span class="clock-icon">⏱</span>
          <span>${escapeHTML(d.kickoff)}</span>
        </div>
        <div class="match-status status-${escapeHTML(d.state || "pre")}" title="${escapeHTML(d.detail || "")}">
          <span class="status-pill">${escapeHTML(d.label || "FIXTURE")}</span>
          ${d.detail ? `<span class="status-detail">${escapeHTML(d.detail)}</span>` : ""}
        </div>
      </div>

      <div class="match-teams">
        <div class="match-team home-team">
          <div class="team-logo-wrap">${homeLogo}</div>
          <div class="team-info">
            <span class="team-name" data-action="open-club"
                  data-club-slug="${escapeHTML(d.homeSlug || "")}"
                  data-club-id="${escapeHTML(d.homeId || "")}"
                  data-club-name="${escapeHTML(d.homeName || "")}">${escapeHTML(d.homeName)}</span>
            <span class="team-side-badge">HOME</span>
          </div>
        </div>

        <div class="match-score-board ${d.showScore ? "has-score" : "is-vs"}">
          ${d.showScore 
            ? `<span class="score-digit">${escapeHTML(String(d.homeScore ?? "0"))}</span>
               <span class="score-divider">:</span>
               <span class="score-divider">${escapeHTML(String(d.awayScore ?? "0"))}</span>`
            : `<span class="vs-text">VS</span>`}
        </div>

        <div class="match-team away-team">
          <div class="team-info team-info-away">
            <span class="team-name" data-action="open-club"
                  data-club-slug="${escapeHTML(d.awaySlug || "")}"
                  data-club-id="${escapeHTML(d.awayId || "")}"
                  data-club-name="${escapeHTML(d.awayName || "")}">${escapeHTML(d.awayName)}</span>
            <span class="team-side-badge">AWAY</span>
          </div>
          <div class="team-logo-wrap">${awayLogo}</div>
        </div>
      </div>

      <div class="match-bottom">
        <div class="match-venue" title="${escapeHTML(d.venueName || "")}">
          ${d.venueName ? `<span class="stadium-icon">🏟</span> ${escapeHTML(d.venueName)}` : ""}
        </div>
        <div class="match-cues">
          ${matchCenterBadge}
        </div>
      </div>
    </div>
  `;
}


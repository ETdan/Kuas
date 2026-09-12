/**
 * components/match_card.js - Shared Match Card UI Component
 * Used across Matches view and Club Fixtures.
 */

import { escapeHTML } from "../utils.js";

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


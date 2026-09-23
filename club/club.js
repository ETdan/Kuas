/**
 * club.js - Clubs list view module.
 * Matchday Edition / Panini Sticker Album Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps } from "../utils.js";
import { getLeagueTeams } from "../api.js";

function isValidLogoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    !lower.includes("default-team-logo") &&
    !lower.includes("default-league-logo") &&
    !lower.includes("missing")
  );
}

function renderTeamCardHTML(team) {
  const logoUrl  = team.logos?.length ? ensureHttps(team.logos[0].href) : "";
  const teamName = escapeHTML(team.displayName || team.name || "Team");
  const abbrev   = escapeHTML(team.abbreviation || team.shortDisplayName || teamName.slice(0, 3).toUpperCase());
  const hasValidLogo = isValidLogoUrl(logoUrl);
  const logoHTML = hasValidLogo
    ? `<img class="club-logo" src="${logoUrl}" alt="${teamName}" loading="lazy">`
    : `<div class="team-monogram-badge" title="${teamName}">${abbrev}</div>`;

  return `
    <div class="club" data-team-id="${escapeHTML(String(team.id))}" role="button" tabindex="0" aria-label="${teamName}">
      <span class="club-abbrev-badge">${abbrev}</span>
      <div class="club-logo-frame">
        ${logoHTML}
      </div>
      <div class="club-name" title="${teamName}">${teamName}</div>
    </div>
  `;
}

export async function init(container, navigate) {
  const slug = await Storage.get("leagueSlug");

  container.innerHTML = `
    <div class="clubs-page-header">
      <h2 class="clubs-title">MEMBER CLUBS</h2>
    </div>
    <div id="clubs-container">
      <div class="info-msg">
        <div class="loader"></div>
        <span>SCOUTING CLUBS…</span>
      </div>
    </div>
  `;

  const clubsContainer = container.querySelector("#clubs-container");

  if (!slug) {
    clubsContainer.innerHTML = `<div class="info-msg">No league selected.</div>`;
    return;
  }

  // Event delegation
  clubsContainer.addEventListener("click", async (e) => {
    const card = e.target.closest(".club");
    if (!card) return;
    const teamId = card.getAttribute("data-team-id");
    if (teamId) {
      await Storage.set("teamId", teamId);
      navigate("club_detail");
    }
  });

  // Keyboard accessibility
  clubsContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.closest(".club")?.click();
    }
  });

  try {
    const teams = await getLeagueTeams(slug);
    if (!teams.length) {
      clubsContainer.innerHTML = `<div class="info-msg">No clubs found for this competition.</div>`;
      return;
    }
    clubsContainer.innerHTML = teams.map(renderTeamCardHTML).join("");
  } catch (err) {
    console.error("Error fetching teams:", err);
    clubsContainer.innerHTML = `<div class="error-msg">Failed to load clubs.</div>`;
  }
}

/**
 * club_detail.js - Club Detail view module.
 * Shows two tabs: Fixtures and Players.
 * Matchday Edition / Panini Trading Card Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps, formatKickoff } from "../utils.js";
import { getTeamSchedule, getTeamRoster, getPlayer } from "../api.js";

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function renderShellHTML() {
  return `
    <div class="club-detail">
      <div class="club-detail-header">
        <button class="back-btn" id="backBtn">
          <span class="back-arrow">‹</span> CLUBS
        </button>
        <div class="club-detail-tabs">
          <button class="tab-btn active" id="matchesBtn">Fixtures</button>
          <button class="tab-btn" id="playersBtn">Squad / Players</button>
        </div>
      </div>
      <div id="club-content">
        <div class="info-msg">
          <div class="loader"></div>
          <span>LOADING CLUB DATA…</span>
        </div>
      </div>
    </div>
  `;
}

function renderMatchCardHTML(d) {
  const homeLogo = d.homeLogo
    ? `<img class="team-logo" src="${escapeHTML(d.homeLogo)}" alt="${escapeHTML(d.homeName)}" loading="lazy">`
    : `<span class="team-logo-placeholder">⚽</span>`;
  const awayLogo = d.awayLogo
    ? `<img class="team-logo" src="${escapeHTML(d.awayLogo)}" alt="${escapeHTML(d.awayName)}" loading="lazy">`
    : `<span class="team-logo-placeholder">⚽</span>`;

  return `
    <div class="match-card">
      <div class="match-top">
        <div class="match-kickoff">
          <span class="clock-icon">⏱</span>
          <span>${escapeHTML(d.kickoff)}</span>
        </div>
        <span class="status-pill status-fixture">FIXTURE</span>
      </div>
      <div class="match-teams">
        <div class="match-team home-team">
          <div class="team-logo-wrap">${homeLogo}</div>
          <div class="team-info">
            <span class="team-name" data-action="switch-team" data-team-id="${escapeHTML(d.homeId)}">${escapeHTML(d.homeName)}</span>
            <span class="team-side-badge">HOME</span>
          </div>
        </div>
        <div class="match-score-board is-vs">
          <span class="vs-text">VS</span>
        </div>
        <div class="match-team away-team">
          <div class="team-info team-info-away">
            <span class="team-name" data-action="switch-team" data-team-id="${escapeHTML(d.awayId)}">${escapeHTML(d.awayName)}</span>
            <span class="team-side-badge">AWAY</span>
          </div>
          <div class="team-logo-wrap">${awayLogo}</div>
        </div>
      </div>
      <div class="match-bottom">
        <div class="match-venue">${d.venueName ? `<span>🏟</span> ${escapeHTML(d.venueName)}` : ""}</div>
      </div>
    </div>
  `;
}

function renderPlayerCardHTML(player) {
  const pName    = player.fullName || player.displayName || "Player";
  const jersey   = player.jersey ? `#${player.jersey}` : "";
  const position = player.position?.displayName || "Player";
  const flagHTML = player.flag?.href
    ? `<img class="player-flag" src="${ensureHttps(player.flag.href)}" alt="${escapeHTML(player.citizenship || "")}">` 
    : "";

  const details = [
    { label: "Position", value: position },
    { label: "Age", value: player.age },
    { label: "Height", value: player.displayHeight },
    { label: "Weight", value: player.displayWeight },
    { label: "Nationality", value: player.citizenshipCountry?.abbreviation || player.citizenship },
    { label: "Status", value: player.status?.name },
  ]
    .filter((i) => i.value != null && i.value !== "")
    .map(
      (i) => `
        <div class="player-stat-tile">
          <span class="stat-label">${escapeHTML(i.label)}</span>
          <span class="stat-value">${escapeHTML(String(i.value))}</span>
        </div>
      `
    )
    .join("");

  return `
    <div class="player-card" id="player-${escapeHTML(String(player.id))}">
      <div class="player-card-header">
        <span class="player-pos-badge">${escapeHTML(position)}</span>
        ${jersey ? `<span class="player-jersey-badge">${escapeHTML(jersey)}</span>` : ""}
      </div>

      <div class="player-top">
        <div class="player-img-wrap">
          <img class="player-img" id="img-player-${escapeHTML(String(player.id))}"
               alt="${escapeHTML(pName)}" style="display:none;" loading="lazy">
          <span class="player-avatar-fallback">👤</span>
        </div>
        <div class="player-meta">
          <div class="player-name">${escapeHTML(pName)}</div>
          <div class="player-country-row">
            ${flagHTML}
            <span class="player-country-text">${escapeHTML(player.citizenship || "")}</span>
          </div>
        </div>
      </div>

      <div class="player-stats-grid">${details}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Portrait loader — rate-limited batch fetch
// ---------------------------------------------------------------------------

async function loadPortraitsBatched(players, batchSize = 4, delayMs = 150) {
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (player) => {
        const pName = player.fullName || player.displayName;
        if (!pName) return;
        try {
          const res = await fetch(
            `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(pName)}`
          );
          const data = await res.json();
          const thumb = data?.player?.[0]?.strThumb;
          if (thumb) {
            const imgEl = document.getElementById(`img-player-${player.id}`);
            if (imgEl) {
              imgEl.src = thumb;
              imgEl.style.display = "block";
              const wrap = imgEl.closest(".player-img-wrap");
              wrap?.querySelector(".player-avatar-fallback")?.remove();
            }
          }
        } catch (_e) { /* portrait unavailable — silent */ }
      })
    );
    if (i + batchSize < players.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  container.innerHTML = renderShellHTML();

  const clubContent   = container.querySelector("#club-content");
  const matchesBtn    = container.querySelector("#matchesBtn");
  const playersBtn    = container.querySelector("#playersBtn");
  const backBtn       = container.querySelector("#backBtn");

  // ---- Back button ----
  backBtn.addEventListener("click", () => navigate("club"));

  // ---- Load fixtures ----
  async function loadMatches() {
    const teamId = await Storage.get("teamId");
    if (!teamId) {
      clubContent.innerHTML = `<div class="info-msg">No club selected.</div>`;
      return;
    }

    setActiveTab(matchesBtn);
    clubContent.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>SCOUTING UPCOMING FIXTURES…</span>
      </div>
    `;

    try {
      const data = await getTeamSchedule(teamId);

      if (!data?.events?.length) {
        clubContent.innerHTML = `<div class="info-msg">No upcoming fixtures scheduled for this club.</div>`;
        return;
      }

      const matchDatas = data.events.map((match) => {
        const comp = match?.competitions?.[0];
        if (!comp?.competitors || comp.competitors.length < 2) return null;
        const homeTeam = comp.competitors[0].team;
        const awayTeam = comp.competitors[1].team;
        return {
          kickoff:  formatKickoff(comp.date),
          venueName: comp.venue?.fullName ?? "",
          homeId:   homeTeam?.id ?? "",
          homeName: homeTeam?.displayName ?? "Home",
          homeLogo: ensureHttps(homeTeam?.logos?.[0]?.href ?? ""),
          awayId:   awayTeam?.id ?? "",
          awayName: awayTeam?.displayName ?? "Away",
          awayLogo: ensureHttps(awayTeam?.logos?.[0]?.href ?? ""),
        };
      }).filter(Boolean);

      if (!matchDatas.length) {
        clubContent.innerHTML = `<div class="info-msg">No fixture details available.</div>`;
        return;
      }

      clubContent.innerHTML = `
        <div class="fixtures-list">
          ${matchDatas.map(renderMatchCardHTML).join("")}
        </div>
      `;
    } catch (err) {
      console.error("Error loading fixtures:", err);
      clubContent.innerHTML = `<div class="error-msg">Failed to load club fixtures.</div>`;
    }
  }

  // ---- Load players ----
  async function loadPlayers() {
    const teamId = await Storage.get("teamId");
    const league = await Storage.get("leagueSlug");
    if (!teamId || !league) {
      clubContent.innerHTML = `<div class="info-msg">No club or league selected.</div>`;
      return;
    }

    setActiveTab(playersBtn);
    clubContent.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>UNPACKING SQUAD ROSTER…</span>
      </div>
    `;

    try {
      const rosterData = await getTeamRoster(league, teamId);

      if (!rosterData?.items?.length) {
        clubContent.innerHTML = `<div class="info-msg">No squad roster data available.</div>`;
        return;
      }

      const playerDetails = await Promise.all(
        rosterData.items.map((ref) =>
          getPlayer(ref.$ref).catch(() => null)
        )
      );
      const validPlayers = playerDetails.filter(Boolean);

      if (!validPlayers.length) {
        clubContent.innerHTML = `<div class="info-msg">No player profiles could be loaded.</div>`;
        return;
      }

      // Render Panini-style cards
      clubContent.innerHTML = `
        <div class="players-grid">
          ${validPlayers.map(renderPlayerCardHTML).join("")}
        </div>
      `;

      // Then load portraits in background
      loadPortraitsBatched(validPlayers);
    } catch (err) {
      console.error("Error loading players:", err);
      clubContent.innerHTML = `<div class="error-msg">Failed to load squad roster.</div>`;
    }
  }

  // ---- Tab helpers ----
  function setActiveTab(activeBtn) {
    [matchesBtn, playersBtn].forEach((btn) =>
      btn.classList.toggle("active", btn === activeBtn)
    );
  }

  // ---- Fixture card delegation — switch team ----
  clubContent.addEventListener("click", async (e) => {
    const switchBtn = e.target.closest('[data-action="switch-team"]');
    if (switchBtn) {
      e.stopPropagation();
      const nextId = switchBtn.getAttribute("data-team-id");
      if (nextId) {
        await Storage.set("teamId", nextId);
        loadMatches();
      }
    }
  });

  matchesBtn.addEventListener("click", loadMatches);
  playersBtn.addEventListener("click", loadPlayers);

  // Default tab
  loadMatches();
}

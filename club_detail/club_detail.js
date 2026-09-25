/**
 * club_detail.js - Club Detail view module.
 * Shows Club Detail, Fixtures, and Collectible Player Cards in dedicated tabs.
 * Matchday Edition / Panini Collectible Trading Card Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps, formatKickoff, renderErrorState } from "../utils.js";
import { getTeamSchedule, getTeamRoster, getTeamInfo } from "../api.js";
import { renderMatchCardHTML, normalizeEspnEvent } from "../components/match_card.js";

const PORTRAIT_CACHE_PREFIX = "player-cutout:v2:";
const PORTRAIT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function renderShellHTML() {
  return `
    <div class="club-detail">
      <div class="club-detail-header">
        <button class="back-btn" id="backBtn">
          <span class="back-arrow">‹</span> BACK
        </button>
        <div class="club-detail-tabs">
          <button class="tab-btn active" id="detailBtn">Club Detail</button>
          <button class="tab-btn" id="matchesBtn">Fixtures</button>
          <button class="tab-btn" id="playersBtn">Players</button>
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

function renderClubDetailContentHTML(team, coachName, venueName) {
  const name = team.displayName || team.name || "Club";
  const logo = team.logos?.[0]?.href ? ensureHttps(team.logos[0].href) : "";
  const standing = team.standingSummary || "";
  const record = team.record?.items?.[0]?.summary || "-";
  const color = team.color ? `#${team.color}` : "var(--art-yellow)";
  const nickname = team.nickname || team.shortDisplayName || "";
  const abbrev = team.abbreviation || "";

  return `
    <div class="club-profile-wrap">
      <!-- Hero Card -->
      <div class="club-hero-card" style="--club-accent: ${color};">
        <div class="club-hero-crest-frame">
          ${logo ? `<img class="club-hero-crest" src="${escapeHTML(logo)}" alt="${escapeHTML(name)}">` : `<span class="club-crest-fallback">🛡</span>`}
        </div>
        <h2 class="club-hero-name">${escapeHTML(name)}</h2>
        ${standing ? `<span class="club-hero-standing">${escapeHTML(standing)}</span>` : ""}
      </div>

      <!-- Quick Info Tiles -->
      <div class="club-info-grid">
        <div class="club-info-tile">
          <span class="info-tile-label">👔 Manager</span>
          <span class="info-tile-val">${escapeHTML(coachName || "Head Coach")}</span>
        </div>
        <div class="club-info-tile">
          <span class="info-tile-label">📊 Season Record</span>
          <span class="info-tile-val">${escapeHTML(record)}</span>
        </div>
        <div class="club-info-tile">
          <span class="info-tile-label">🏟️ Stadium</span>
          <span class="info-tile-val" title="${escapeHTML(venueName || "Home Ground")}">${escapeHTML(venueName || "Home Stadium")}</span>
        </div>
        <div class="club-info-tile">
          <span class="info-tile-label">🛡️ Nickname / Tag</span>
          <span class="info-tile-val">${escapeHTML(nickname || abbrev || "Club")}</span>
        </div>
      </div>

      <!-- Tab Jump Shortcuts -->
      <div class="club-quick-actions">
        <button class="quick-action-btn" data-action="jump-tab" data-tab="fixtures">
          <span>📅</span> VIEW FIXTURES ↗
        </button>
        <button class="quick-action-btn" data-action="jump-tab" data-tab="players">
          <span>👥</span> SQUAD & PLAYERS ↗
        </button>
      </div>
    </div>
  `;
}

function categorizePosition(posName) {
  const p = (posName || "").toLowerCase();
  if (p.includes("goal") || p === "g" || p === "gk") return { code: "GK", label: "GK", cls: "pos-gk" };
  if (p.includes("def") || p.includes("back") || p === "d") return { code: "DEF", label: "DEF", cls: "pos-def" };
  if (p.includes("mid") || p === "m") return { code: "MID", label: "MID", cls: "pos-mid" };
  if (p.includes("forw") || p.includes("attack") || p.includes("wing") || p.includes("striker") || p === "f") return { code: "FWD", label: "FWD", cls: "pos-fwd" };
  return { code: "MID", label: "MID", cls: "pos-mid" };
}

function renderPlayerCardHTML(p) {
  const pos = categorizePosition(p.position);
  const jerseyDisplay = p.jersey ? `#${escapeHTML(p.jersey)}` : "";
  const flagHTML = p.flag
    ? `<img class="player-flag" src="${ensureHttps(p.flag)}" alt="${escapeHTML(p.citizenship || "")}" loading="lazy">`
    : "";

  const imgHTML = p.resolvedImg
    ? `<img class="player-cutout-img" id="img-player-${escapeHTML(p.id)}" src="${escapeHTML(p.resolvedImg)}" alt="${escapeHTML(p.name)}" loading="lazy">`
    : `<img class="player-cutout-img" id="img-player-${escapeHTML(p.id)}" alt="${escapeHTML(p.name)}" style="display:none;" loading="lazy">
       <div class="player-silhouette-box" id="sil-player-${escapeHTML(p.id)}">
         <span class="silhouette-jersey">${escapeHTML(p.jersey || "★")}</span>
         <span class="silhouette-icon">👤</span>
       </div>`;

  const details = [
    { label: "Role", value: p.position || pos.code },
    { label: "Age", value: p.age },
    { label: "Height", value: p.height },
    { label: "Weight", value: p.weight },
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
    <div class="player-card"
         id="player-card-${escapeHTML(p.id)}"
         data-category="${escapeHTML(pos.code)}"
         data-name="${escapeHTML(p.name.toLowerCase())}"
         data-jersey="${escapeHTML(p.jersey || "")}">
      <div class="player-card-header">
        <span class="player-pos-badge ${pos.cls}">${escapeHTML(pos.label)}</span>
        ${jerseyDisplay ? `<span class="player-jersey-badge">${jerseyDisplay}</span>` : ""}
      </div>

      <div class="player-visual-wrap">
        ${imgHTML}
      </div>

      <div class="player-meta">
        <div class="player-name" title="${escapeHTML(p.name)}">${escapeHTML(p.name)}</div>
        <div class="player-country-row">
          ${flagHTML}
          <span class="player-country-text">${escapeHTML(p.citizenship || "")}</span>
        </div>
      </div>

      <div class="player-stats-grid">${details}</div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Portrait loader with cache
// ---------------------------------------------------------------------------

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

async function loadPortraitsBatched(players, batchSize = 4, delayMs = 120) {
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (player) => {
        if (player.resolvedImg) return;
        const pName = player.name;
        if (!pName) return;

        try {
          const res = await fetch(
            `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(pName)}`
          );
          if (!res.ok) return;
          const data = await res.json();
          const pData = data?.player?.[0];
          const cutout = pData?.strCutout || pData?.strRender || pData?.strThumb;
          if (cutout) {
            await setCachedPortrait(pName, cutout);
            const imgEl = document.getElementById(`img-player-${player.id}`);
            const silEl = document.getElementById(`sil-player-${player.id}`);
            if (imgEl) {
              imgEl.src = cutout;
              imgEl.style.display = "block";
              if (silEl) silEl.remove();
            }
          }
        } catch (_e) {}
      })
    );

    if (i + batchSize < players.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

// ---------------------------------------------------------------------------
// View init & tab controllers
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  container.innerHTML = renderShellHTML();

  const clubContent = container.querySelector("#club-content");
  const detailBtn   = container.querySelector("#detailBtn");
  const matchesBtn  = container.querySelector("#matchesBtn");
  const playersBtn  = container.querySelector("#playersBtn");
  const backBtn     = container.querySelector("#backBtn");

  backBtn.addEventListener("click", () => navigate("back"));

  const teamId = await Storage.get("teamId");
  const league = await Storage.get("leagueSlug");

  function setActiveTab(activeBtn) {
    [detailBtn, matchesBtn, playersBtn].forEach((btn) =>
      btn.classList.toggle("active", btn === activeBtn)
    );
  }

  // ---- 1. Load Club Detail View ----
  async function loadClubDetail() {
    if (!teamId || !league) {
      clubContent.innerHTML = `<div class="info-msg">No club or league selected.</div>`;
      return;
    }

    setActiveTab(detailBtn);
    clubContent.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>COMPILING CLUB PROFILE…</span>
      </div>
    `;

    try {
      const [teamData, rosterData, scheduleData] = await Promise.all([
        getTeamInfo(league, teamId).catch(() => null),
        getTeamRoster(league, teamId).catch(() => null),
        getTeamSchedule(teamId).catch(() => null),
      ]);

      const team = teamData?.team || teamData || {};
      let coachName = "";
      if (rosterData?.coach?.length) {
        const c = rosterData.coach[0];
        coachName = c.displayName || `${c.firstName || ""} ${c.lastName || ""}`.trim();
      }

      let venueName = "";
      if (scheduleData?.events?.length) {
        venueName = scheduleData.events[0]?.competitions?.[0]?.venue?.fullName || "";
      }

      clubContent.innerHTML = renderClubDetailContentHTML(team, coachName, venueName);
    } catch (err) {
      console.error("Error loading club detail:", err);
      clubContent.innerHTML = `<div class="error-msg">Failed to load club details.</div>`;
    }
  }

  // ---- 2. Load Fixtures View ----
  async function loadMatches() {
    if (!teamId) {
      clubContent.innerHTML = `<div class="info-msg">No club selected.</div>`;
      return;
    }

    setActiveTab(matchesBtn);
    clubContent.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>SCOUTING CLUB FIXTURES…</span>
      </div>
    `;

    try {
      const data = await getTeamSchedule(teamId);

      if (!data?.events?.length) {
        clubContent.innerHTML = `<div class="info-msg">No upcoming fixtures scheduled for this club.</div>`;
        return;
      }

      const matchDatas = data.events.map((match) => normalizeEspnEvent(match)).filter(Boolean);

      if (!matchDatas.length) {
        clubContent.innerHTML = `<div class="info-msg">No fixture details available.</div>`;
        return;
      }

      clubContent.innerHTML = `
        <div class="fixtures-list">
          ${matchDatas.map((d) => renderMatchCardHTML(d)).join("")}
        </div>
      `;
    } catch (err) {
      console.error("Error loading fixtures:", err);
      renderErrorState(clubContent, "Failed to load club fixtures. Please try again.", () => loadMatches());
    }
  }

  // ---- 3. Load Players View ----
  async function loadPlayers() {
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

      let rawAthletes = [];
      if (Array.isArray(rosterData?.athletes)) {
        if (rosterData.athletes[0]?.items) {
          rawAthletes = rosterData.athletes.flatMap((group) => group.items || []);
        } else {
          rawAthletes = rosterData.athletes;
        }
      }

      if (!rawAthletes.length) {
        clubContent.innerHTML = `<div class="info-msg">No squad roster data available for this team.</div>`;
        return;
      }

      const normalizedPlayers = await Promise.all(
        rawAthletes.map(async (a) => {
          const name = a.displayName || a.fullName || a.shortName || "Player";
          const id   = String(a.id || Math.random().toString(36).substring(2, 8));
          const cachedImg = await getCachedPortrait(name);
          const resolvedImg = cachedImg || a.headshot?.href || null;

          return {
            id,
            name,
            jersey:      a.jersey || "",
            position:    a.position?.displayName || a.position?.name || "Player",
            citizenship: a.citizenship || a.citizenshipCountry?.abbreviation || "",
            flag:        a.flag?.href || "",
            age:         a.age ? `${a.age} yrs` : "",
            height:      a.displayHeight || "",
            weight:      a.displayWeight || "",
            resolvedImg,
          };
        })
      );

      const counts = { ALL: normalizedPlayers.length, GK: 0, DEF: 0, MID: 0, FWD: 0 };
      normalizedPlayers.forEach((p) => {
        const cat = categorizePosition(p.position).code;
        if (counts[cat] !== undefined) counts[cat]++;
      });

      clubContent.innerHTML = `
        <div class="squad-container">
          <div class="squad-toolbar">
            <div class="squad-search-wrap">
              <span class="search-icon">🔍</span>
              <input type="text" id="squadSearch" class="squad-search-input" placeholder="Search player or jersey #…">
              <button class="clear-search-btn" id="squadClearSearch" style="display:none;" title="Clear search">✕</button>
            </div>
            <div class="squad-pos-filters">
              <button class="pos-filter-btn active" data-pos="ALL">ALL (${counts.ALL})</button>
              <button class="pos-filter-btn filter-gk" data-pos="GK">GK (${counts.GK})</button>
              <button class="pos-filter-btn filter-def" data-pos="DEF">DEF (${counts.DEF})</button>
              <button class="pos-filter-btn filter-mid" data-pos="MID">MID (${counts.MID})</button>
              <button class="pos-filter-btn filter-fwd" data-pos="FWD">FWD (${counts.FWD})</button>
            </div>
          </div>

          <div class="players-grid" id="playersGrid">
            ${normalizedPlayers.map(renderPlayerCardHTML).join("")}
          </div>
        </div>
      `;

      const searchInput  = clubContent.querySelector("#squadSearch");
      const clearSearch  = clubContent.querySelector("#squadClearSearch");
      const filterBtns   = clubContent.querySelectorAll(".pos-filter-btn");
      const cards        = clubContent.querySelectorAll(".player-card");

      let currentPos = "ALL";
      let currentQuery = "";

      function applyFilters() {
        let visibleCount = 0;
        cards.forEach((card) => {
          const cardPos    = card.getAttribute("data-category");
          const cardName   = card.getAttribute("data-name") || "";
          const cardJersey = card.getAttribute("data-jersey") || "";

          const matchesPos = (currentPos === "ALL" || cardPos === currentPos);
          const matchesQuery = !currentQuery ||
                               cardName.includes(currentQuery) ||
                               cardJersey.includes(currentQuery);

          if (matchesPos && matchesQuery) {
            card.style.display = "flex";
            visibleCount++;
          } else {
            card.style.display = "none";
          }
        });

        let emptyEl = clubContent.querySelector(".squad-empty-notice");
        if (visibleCount === 0) {
          if (!emptyEl) {
            emptyEl = document.createElement("div");
            emptyEl.className = "info-msg squad-empty-notice";
            emptyEl.textContent = "No players match your search filter.";
            clubContent.querySelector("#playersGrid").appendChild(emptyEl);
          }
        } else if (emptyEl) {
          emptyEl.remove();
        }
      }

      filterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          currentPos = btn.getAttribute("data-pos");
          applyFilters();
        });
      });

      searchInput.addEventListener("input", (e) => {
        currentQuery = e.target.value.trim().toLowerCase();
        clearSearch.style.display = currentQuery ? "block" : "none";
        applyFilters();
      });

      clearSearch.addEventListener("click", () => {
        searchInput.value = "";
        currentQuery = "";
        clearSearch.style.display = "none";
        applyFilters();
        searchInput.focus();
      });

      const needCutout = normalizedPlayers.filter((p) => !p.resolvedImg);
      if (needCutout.length) {
        loadPortraitsBatched(needCutout);
      }
    } catch (err) {
      console.error("Error loading squad:", err);
      clubContent.innerHTML = `<div class="error-msg">Failed to load squad roster.</div>`;
    }
  }

  // ---- Click delegation inside club content ----
  clubContent.addEventListener("click", async (e) => {
    // 1. Switch Club (when a team name is clicked in fixtures)
    const switchBtn = e.target.closest('[data-action="open-club"], [data-action="switch-team"]');
    if (switchBtn) {
      e.stopPropagation();
      const nextId = switchBtn.getAttribute("data-club-id") || switchBtn.getAttribute("data-team-id");
      if (nextId && nextId !== teamId) {
        await Storage.set("teamId", nextId);
        init(container, navigate);
      }
      return;
    }

    // 2. Quick Nav Jump Buttons from Club Detail tab
    const jumpBtn = e.target.closest('[data-action="jump-tab"]');
    if (jumpBtn) {
      const targetTab = jumpBtn.getAttribute("data-tab");
      if (targetTab === "fixtures") {
        loadMatches();
      } else if (targetTab === "players") {
        loadPlayers();
      }
      return;
    }

    // 3. Match Card click → Match Center (with timeline, stats & highlights)
    const card = e.target.closest('.match-card');
    if (card) {
      e.stopPropagation();
      const eventId = card.getAttribute("data-event-id");
      const matchName = card.getAttribute("data-match-name") || "Match Details";
      const kickoff = card.getAttribute("data-kickoff") || "";
      const venue = card.getAttribute("data-venue") || "";
      const state = card.getAttribute("data-state") || "pre";
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
        Storage.set("matchInitialTab", "h2h"),
      ]);
      navigate("match_detail");
      return;
    }
  });

  // Wire Tab Buttons
  detailBtn.addEventListener("click", loadClubDetail);
  matchesBtn.addEventListener("click", loadMatches);
  playersBtn.addEventListener("click", loadPlayers);

  // Default: Open Club Detail tab!
  loadClubDetail();
}




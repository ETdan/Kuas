/**
 * standing.js - Standings view module with Top Scorers & Top Assists leaders.
 * Matchday Edition / Football Art Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps } from "../utils.js";
import { getStandings, getTeamById, getLeagueStatistics } from "../api.js";

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function renderShellHTML() {
  return `
    <div class="standings-wrap">
      <!-- Sub Navigation Tabs -->
      <div class="standings-subnav">
        <button class="standings-tab-btn active" data-tab="table">
          <span class="tab-icon">📋</span> LEAGUE TABLE
        </button>
        <button class="standings-tab-btn" data-tab="goals">
          <span class="tab-icon">⚽</span> TOP SCORERS
        </button>
        <button class="standings-tab-btn" data-tab="assists">
          <span class="tab-icon">🎯</span> TOP ASSISTS
        </button>
      </div>

      <!-- Main Tab Content Area -->
      <div id="standingsContent" class="standings-content">
        <!-- Injected dynamically -->
      </div>
    </div>
  `;
}

function renderTableHTML() {
  return `
    <div class="standings-legend">
      <span class="legend-item"><span class="legend-pip ucl"></span> UCL / Top Tier</span>
      <span class="legend-item"><span class="legend-pip uel"></span> Continental</span>
      <span class="legend-item"><span class="legend-pip rel"></span> Danger Zone</span>
    </div>

    <div class="table-wrapper">
      <table id="standingTable">
        <thead>
          <tr>
            <th class="col-rk" title="Rank">#</th>
            <th class="col-team" title="Team">CLUB</th>
            <th class="col-pts" title="Points">PTS</th>
            <th title="Games Played">GP</th>
            <th title="Wins">W</th>
            <th title="Draws">D</th>
            <th title="Losses">L</th>
            <th title="Goals For">GF</th>
            <th title="Goals Against">GA</th>
            <th title="Goal Difference">GD</th>
            <th title="Current Form">STR</th>
            <th title="Home Wins">HW</th>
            <th title="Home Draws">HD</th>
            <th title="Home Losses">HL</th>
            <th title="Away Wins">AW</th>
            <th title="Away Draws">AD</th>
            <th title="Away Losses">AL</th>
          </tr>
        </thead>
        <tbody id="standingTableBody">
          <tr>
            <td colspan="17" class="info-msg">
              <div class="loader"></div>
              <span>CALCULATING LEAGUE TABLE…</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderStreakBadge(streak) {
  if (!streak || streak === "-") return `<span class="streak-pill streak-neutral">-</span>`;
  const s = String(streak).trim();
  const first = s.charAt(0).toUpperCase();
  if (first === "W") return `<span class="streak-pill streak-win">${escapeHTML(s)}</span>`;
  if (first === "L") return `<span class="streak-pill streak-loss">${escapeHTML(s)}</span>`;
  return `<span class="streak-pill streak-draw">${escapeHTML(s)}</span>`;
}

function isValidLogoUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    !lower.includes("default-team-logo") &&
    !lower.includes("default-league-logo") &&
    !lower.includes("missing")
  );
}

function getTeamAbbrev(name) {
  if (!name) return "FC";
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}

function renderRowHTML(row, index, totalRows) {
  const s = row.stats;
  const rank = Number(row.rank) || (index + 1);
  const hasValidLogo = isValidLogoUrl(row.logo);
  const logoHTML = hasValidLogo
    ? `<img class="team-logo" src="${escapeHTML(row.logo)}" alt="${escapeHTML(row.teamName)}" loading="lazy">`
    : `<span class="team-logo-placeholder" title="${escapeHTML(row.teamName)}">${escapeHTML(getTeamAbbrev(row.teamName))}</span>`;

  let zoneClass = "";
  if (rank <= 4) zoneClass = "row-ucl";
  else if (rank <= 6) zoneClass = "row-uel";
  else if (rank > totalRows - 3 && totalRows > 6) zoneClass = "row-rel";

  const teamIdAttr = row.teamId ? `data-team-id="${escapeHTML(String(row.teamId))}"` : "";

  return `
    <tr class="standing-row ${zoneClass}">
      <td class="col-rk">
        <span class="rank-badge">${escapeHTML(String(rank))}</span>
      </td>
      <td class="col-team">
        <div class="team-cell" ${teamIdAttr} role="button" tabindex="0" title="View ${escapeHTML(row.teamName)}">
          <div class="table-logo-wrap">${logoHTML}</div>
          <span class="team-name" title="${escapeHTML(row.teamName)}">${escapeHTML(row.teamName)}</span>
        </div>
      </td>
      <td class="col-pts"><strong>${escapeHTML(String(s.pts))}</strong></td>
      <td>${escapeHTML(String(s.gp))}</td>
      <td>${escapeHTML(String(s.w))}</td>
      <td>${escapeHTML(String(s.t))}</td>
      <td>${escapeHTML(String(s.l))}</td>
      <td>${escapeHTML(String(s.pf))}</td>
      <td>${escapeHTML(String(s.pa))}</td>
      <td class="col-gd">${escapeHTML(String(s.pd > 0 ? `+${s.pd}` : s.pd))}</td>
      <td>${renderStreakBadge(s.streak)}</td>
      <td>${escapeHTML(String(s.hw))}</td>
      <td>${escapeHTML(String(s.ht))}</td>
      <td>${escapeHTML(String(s.hl))}</td>
      <td>${escapeHTML(String(s.aw))}</td>
      <td>${escapeHTML(String(s.at))}</td>
      <td>${escapeHTML(String(s.al))}</td>
    </tr>
  `;
}

const PORTRAIT_CACHE_PREFIX = "player-cutout:v2:";
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

async function resolveLeaderPortraits(leaders) {
  for (let i = 0; i < leaders.length && i < 30; i += 4) {
    const batch = leaders.slice(i, i + 4);
    await Promise.all(
      batch.map(async (leader) => {
        if (leader.resolvedImg) return;
        const athlete = leader.athlete || {};
        const name = athlete.displayName;
        const athleteId = athlete.id || `idx-${leader.rank || Math.random()}`;
        if (!name) return;

        const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        let cutout = null;

        try {
          let searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(cleanName)}`;
          if (cleanName.toLowerCase().includes("joao pedro")) {
            searchUrl = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent("Joao Pedro Junqueira")}`;
          }
          const res = await fetch(searchUrl);
          if (res.ok) {
            const data = await res.json();
            const pList = data?.player || [];
            const withCutout = pList.find((p) => p.strCutout || p.strRender || p.strThumb) || pList[0];
            cutout = withCutout?.strCutout || withCutout?.strRender || withCutout?.strThumb;
          }
        } catch (_e) {}

        if (cutout) {
          await setCachedPortrait(name, cutout);
          leader.resolvedImg = cutout;
          const imgEl = document.getElementById(`avatar-leader-${athleteId}`);
          const silEl = document.getElementById(`sil-leader-${athleteId}`);
          if (imgEl) {
            imgEl.src = cutout;
            imgEl.style.display = "block";
            if (silEl) silEl.remove();
          }
        }
      })
    );

    if (i + 4 < leaders.length && i + 4 < 30) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

function renderLeaderboardHTML(leaders, title, icon, unitLabel) {
  if (!leaders || !leaders.length) {
    return `
      <div class="leaderboard-empty">
        <div class="empty-icon">${icon}</div>
        <p>No statistical leader data recorded yet for this competition.</p>
      </div>
    `;
  }

  const itemsHTML = leaders.map((leader, index) => {
    const rank = leader.rank || (index + 1);
    const athlete = leader.athlete || {};
    const name = athlete.displayName || "Unknown Player";
    const athleteId = athlete.id || `idx-${index}`;
    const team = athlete.team || {};
    const teamName = team.displayName || team.shortDisplayName || "Club";
    const teamLogo = team.logos?.[0]?.href ? ensureHttps(team.logos[0].href) : "";
    const headshot = leader.resolvedImg || (athlete.headshot?.href ? ensureHttps(athlete.headshot.href) : "");
    const jersey = athlete.jersey ? `#${athlete.jersey}` : "";
    const position = athlete.position?.abbreviation || "";
    const value = leader.displayValue || leader.value || "0";

    let podiumClass = "";
    if (rank === 1) podiumClass = "podium-gold";
    else if (rank === 2) podiumClass = "podium-silver";
    else if (rank === 3) podiumClass = "podium-bronze";

    return `
      <div class="leader-card ${podiumClass}">
        <div class="leader-rank">
          <span class="leader-rank-number">${rank}</span>
        </div>
        <div class="leader-avatar-wrap">
          ${headshot
            ? `<img class="leader-avatar" id="avatar-leader-${escapeHTML(String(athleteId))}" src="${escapeHTML(headshot)}" alt="${escapeHTML(name)}" loading="lazy">`
            : `<img class="leader-avatar" id="avatar-leader-${escapeHTML(String(athleteId))}" src="" alt="${escapeHTML(name)}" style="display:none;" loading="lazy">
               <div class="leader-avatar-placeholder" id="sil-leader-${escapeHTML(String(athleteId))}">👤</div>`}
        </div>
        <div class="leader-info">
          <div class="leader-name-row">
            <span class="leader-name" title="${escapeHTML(name)}">${escapeHTML(name)}</span>
            ${jersey ? `<span class="leader-jersey">${escapeHTML(jersey)}</span>` : ""}
            ${position ? `<span class="leader-pos">${escapeHTML(position)}</span>` : ""}
          </div>
          <div class="leader-team-row" ${team.id ? `data-team-id="${escapeHTML(String(team.id))}" role="button" tabindex="0" title="View ${escapeHTML(teamName)}"` : ""}>
            ${teamLogo ? `<img class="leader-team-logo" src="${escapeHTML(teamLogo)}" alt="${escapeHTML(teamName)}">` : ""}
            <span class="leader-team-name">${escapeHTML(teamName)}</span>
          </div>
        </div>
        <div class="leader-stat-box">
          <span class="leader-stat-val">${escapeHTML(String(value))}</span>
          <span class="leader-stat-unit">${escapeHTML(unitLabel)}</span>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="leaderboard-wrap">
      <div class="leaderboard-header">
        <span class="leaderboard-title">${icon} ${escapeHTML(title)}</span>
        <span class="leaderboard-count">${leaders.length} LEADERS</span>
      </div>
      <div class="leaderboard-list">
        ${itemsHTML}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// View init & controllers
// ---------------------------------------------------------------------------

let tableDataCache = null;
let statsDataCache = null;
let activeSlug = null;

async function loadTable(contentContainer, slug) {
  contentContainer.innerHTML = renderTableHTML();
  const tbody = contentContainer.querySelector("#standingTableBody");

  try {
    let rows = tableDataCache;
    if (!rows) {
      const data = await getStandings(slug);
      if (!data?.items?.length) {
        tbody.innerHTML = `<tr><td colspan="17" class="info-msg">No standings data available for this competition.</td></tr>`;
        return;
      }

      const year = new Date().getFullYear();
      const rowPromises = data.items.map(async (item) => {
        const teamData = (await getTeamById(slug, item.id, year)) || {};
        const teamName = teamData?.displayName || teamData?.name || `Team ${item.id}`;
        const logo = teamData?.logos?.length ? ensureHttps(teamData.logos[0].href) : "";
        const stats = item.records?.total?.stats || {};
        const val = (key, fb = 0) => stats[key]?.value ?? fb;
        const str = (key, fb = "-") => stats[key]?.displayValue ?? fb;

        return {
          teamId: item.id || teamData?.id || "",
          rank: val("rank", 999),
          teamName,
          logo,
          stats: {
            pts: val("points"),
            gp: val("gamesPlayed"),
            w: val("wins"),
            l: val("losses"),
            t: val("ties"),
            pf: val("pointsFor"),
            pa: val("pointsAgainst"),
            pd: val("pointDifferential"),
            hw: val("homeWins"),
            hl: val("homeLosses"),
            ht: val("homeTies"),
            aw: val("awayWins"),
            al: val("awayLosses"),
            at: val("awayTies"),
            streak: str("streak"),
          },
        };
      });

      rows = (await Promise.all(rowPromises)).sort((a, b) => a.rank - b.rank);
      tableDataCache = rows;
    }

    tbody.innerHTML = rows.map((r, i) => renderRowHTML(r, i, rows.length)).join("");
  } catch (err) {
    console.error("Error loading standings:", err);
    tbody.innerHTML = `<tr><td colspan="17" class="error-msg">Failed to load standings table.</td></tr>`;
  }
}

async function loadLeaderboard(contentContainer, slug, type) {
  contentContainer.innerHTML = `
    <div class="leaderboard-loader">
      <div class="loader"></div>
      <span>FETCHING LEAGUE LEADERS…</span>
    </div>
  `;

  try {
    if (!statsDataCache) {
      statsDataCache = await getLeagueStatistics(slug);
    }

    const categories = statsDataCache?.stats || [];
    let targetCat = null;
    let title = "";
    let icon = "";
    let unitLabel = "";

    if (type === "goals") {
      targetCat = categories.find((c) => c.name === "goalsLeaders" || c.name === "goals") || categories[0];
      title = "TOP GOAL SCORERS";
      icon = "⚽";
      unitLabel = "GOALS";
    } else {
      targetCat = categories.find((c) => c.name === "assistsLeaders" || c.name === "assists") || categories[1];
      title = "TOP PLAYMAKERS & ASSISTS";
      icon = "🎯";
      unitLabel = "ASSISTS";
    }

    const rawLeaders = targetCat?.leaders || [];

    // Pre-populate with cached portraits where already resolved
    const leadersWithImages = await Promise.all(
      rawLeaders.map(async (leader) => {
        const name = leader.athlete?.displayName || "";
        const espnImg = leader.athlete?.headshot?.href ? ensureHttps(leader.athlete.headshot.href) : null;
        const cachedImg = !espnImg && name ? await getCachedPortrait(name) : null;
        const resolvedImg = espnImg || cachedImg || null;
        return {
          ...leader,
          resolvedImg,
        };
      })
    );

    contentContainer.innerHTML = renderLeaderboardHTML(leadersWithImages, title, icon, unitLabel);

    // Launch background portrait resolver for any remaining missing photos
    const stillNeedPhotos = leadersWithImages.filter((l) => !l.resolvedImg);
    if (stillNeedPhotos.length > 0) {
      resolveLeaderPortraits(stillNeedPhotos);
    }
  } catch (err) {
    console.error("Error loading league leaders:", err);
    contentContainer.innerHTML = `
      <div class="leaderboard-empty">
        <p class="error-msg">Could not load league statistics.</p>
      </div>
    `;
  }
}

export async function init(container, navigate) {
  const slug = await Storage.get("leagueSlug");

  if (activeSlug !== slug || !tableDataCache?.[0]?.teamId) {
    activeSlug = slug;
    tableDataCache = null;
    statsDataCache = null;
  }

  container.innerHTML = renderShellHTML();

  const contentArea = container.querySelector("#standingsContent");
  const tabButtons = container.querySelectorAll(".standings-tab-btn");

  if (!slug) {
    contentArea.innerHTML = `<div class="leaderboard-empty"><p>No league selected.</p></div>`;
    return;
  }

  // Delegated club click listener for table cells and leaderboard team rows
  contentArea.addEventListener("click", async (e) => {
    const clubEl = e.target.closest("[data-team-id]");
    if (!clubEl) return;
    const teamId = clubEl.getAttribute("data-team-id");
    if (teamId) {
      await Storage.set("teamId", teamId);
      if (typeof navigate === "function") {
        navigate("club_detail");
      }
    }
  });

  contentArea.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const clubEl = e.target.closest("[data-team-id]");
      if (clubEl) {
        e.preventDefault();
        const teamId = clubEl.getAttribute("data-team-id");
        if (teamId) {
          await Storage.set("teamId", teamId);
          if (typeof navigate === "function") {
            navigate("club_detail");
          }
        }
      }
    }
  });

  // Handle Tab Switch
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      if (tab === "table") {
        loadTable(contentArea, slug);
      } else if (tab === "goals") {
        loadLeaderboard(contentArea, slug, "goals");
      } else if (tab === "assists") {
        loadLeaderboard(contentArea, slug, "assists");
      }
    });
  });

  // Default: load table
  await loadTable(contentArea, slug);
}


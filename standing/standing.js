/**
 * standing.js - Standings view module.
 * Matchday Edition / Football Art Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps } from "../utils.js";
import { getStandings, getTeamById } from "../api.js";

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function renderTableHTML() {
  return `
    <div class="standings-wrap">
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

function renderRowHTML(row, index, totalRows) {
  const s = row.stats;
  const rank = Number(row.rank) || (index + 1);
  const logoHTML = row.logo
    ? `<img class="team-logo" src="${escapeHTML(row.logo)}" alt="${escapeHTML(row.teamName)}" loading="lazy">`
    : `<span class="team-logo-placeholder">⚽</span>`;

  let zoneClass = "";
  if (rank <= 4) zoneClass = "row-ucl";
  else if (rank <= 6) zoneClass = "row-uel";
  else if (rank > totalRows - 3 && totalRows > 6) zoneClass = "row-rel";

  return `
    <tr class="standing-row ${zoneClass}">
      <td class="col-rk">
        <span class="rank-badge">${escapeHTML(String(rank))}</span>
      </td>
      <td class="col-team">
        <div class="team-cell">
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

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container) {
  const slug = await Storage.get("leagueSlug");

  container.innerHTML = renderTableHTML();

  const tbody = container.querySelector("#standingTableBody");

  if (!slug) {
    tbody.innerHTML = `<tr><td colspan="17" class="info-msg">No league selected.</td></tr>`;
    return;
  }

  try {
    const data = await getStandings(slug);

    if (!data?.items?.length) {
      tbody.innerHTML = `<tr><td colspan="17" class="info-msg">No standings data available for this competition.</td></tr>`;
      return;
    }

    const year = new Date().getFullYear();

    const rowPromises = data.items.map(async (item) => {
      const teamData  = (await getTeamById(slug, item.id, year)) || {};
      const teamName  = teamData?.displayName || teamData?.name || `Team ${item.id}`;
      const logo      = teamData?.logos?.length
        ? ensureHttps(teamData.logos[0].href)
        : "";

      const stats     = item.records?.total?.stats || {};
      const val  = (key, fb = 0)  => stats[key]?.value        ?? fb;
      const str  = (key, fb = "-") => stats[key]?.displayValue ?? fb;

      return {
        rank: val("rank", 999),
        teamName,
        logo,
        stats: {
          pts:    val("points"),
          gp:     val("gamesPlayed"),
          w:      val("wins"),
          l:      val("losses"),
          t:      val("ties"),
          pf:     val("pointsFor"),
          pa:     val("pointsAgainst"),
          pd:     val("pointDifferential"),
          hw:     val("homeWins"),
          hl:     val("homeLosses"),
          ht:     val("homeTies"),
          aw:     val("awayWins"),
          al:     val("awayLosses"),
          at:     val("awayTies"),
          streak: str("streak"),
        },
      };
    });

    const rows = (await Promise.all(rowPromises)).sort((a, b) => a.rank - b.rank);
    tbody.innerHTML = rows.map((r, i) => renderRowHTML(r, i, rows.length)).join("");
  } catch (err) {
    console.error("Error loading standings:", err);
    tbody.innerHTML = `<tr><td colspan="17" class="error-msg">Failed to load standings table.</td></tr>`;
  }
}

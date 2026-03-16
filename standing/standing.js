var slug = localStorage.getItem("leagueSlug");
var standingTable = document.getElementById("standingTableBody");
if (slug != null) {
  fetch(`https://sports.core.api.espn.com/v3/sports/soccer/${slug}/standings`)
    .then((response) => response.json())
    .then(async (data) => {
      console.log(data);
      const rows = [];
      for (const item of data.items) {
        // Get team info
        const teamData = await getTeam(
          `http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/teams/${item.id}`,
        );
        const teamName = teamData.displayName;
        const logo =
          teamData.logos && teamData.logos.length > 0
            ? teamData.logos[0].href
            : "";

        // Extract stats
        const stats = item.records.total.stats;
        const rank = stats.rank?.value ?? 999;
        // Create table row
        const tr = document.createElement("tr");
        tr.className = "standing-row";
        tr.innerHTML = `
           <td>${rank}</td>
           <td>
             <div class="team-cell">
               <img class="team-logo" src="${logo}" alt="${teamName} logo">
               <span class="team-name">${teamName}</span>
             </div>
           </td>
           <td>${stats.points.value}</td>
           <td>${stats.gamesPlayed.value}</td>
           <td>${stats.wins.value}</td>
           <td>${stats.losses.value}</td>
           <td>${stats.ties.value}</td>
           <td>${stats.pointsFor.value}</td>
           <td>${stats.pointsAgainst.value}</td>
           <td>${stats.pointDifferential.value}</td>
           <td>${stats.homeWins.value}</td>
           <td>${stats.homeLosses.value}</td>
           <td>${stats.homeTies.value}</td>
           <td>${stats.homeGamesPlayed.value}</td>
           <td>${stats.homePointsFor.value}</td>
           <td>${stats.homePointsAgainst.value}</td>
           <td>${stats.awayWins.value}</td>
           <td>${stats.awayLosses.value}</td>
           <td>${stats.awayTies.value}</td>
           <td>${stats.awayGamesPlayed.value}</td>
           <td>${stats.awayPointsFor.value}</td>
           <td>${stats.awayPointsAgainst.value}</td>
           <td>${stats.streak.displayValue}</td>
        `;
        rows.push({ rank, tr });
      }

      rows
        .sort((a, b) => a.rank - b.rank)
        .forEach((row) => standingTable.appendChild(row.tr));
    });
}
async function getTeam(url) {
  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      return data;
    });
}
{
  ("awayPointsFor");
  ("pointsAgainst");
  ("awayGamesPlayed");
  ("awayWins");
  ("losses");
  ("points");
  ("homeWins");
  ("pointDifferential");
  ("homePointsAgainst");
  ("gamesPlayed");
  ("ties");
  ("awayLosses");
  ("rank");
  ("homePointsFor");
  ("awayTies");
  ("wins");
  ("homeTies");
  ("pointsFor");
  ("homeLosses");
  ("streak");
  ("homeGamesPlayed");
  ("awayPointsAgainst");
}

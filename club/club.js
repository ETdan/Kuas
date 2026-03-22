var clubLeague = localStorage.getItem("leagueSlug");

// club matches

// players

var clubsContainer = document.getElementById("clubs-container");
var teams = [];
async function getTeams() {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${clubLeague}/teams`,
  );
  const res = await response.json();
  // console.log(res, "////////////////////res");
  const teams = res.sports[0].leagues[0].teams;
  renderTeams(teams);
  return teams;
}

function renderTeams(teams) {
  // console.log(teams, "////////////////////teams");

  for (const teamObj of teams) {
    let team = teamObj.team;
    var teamElement = document.createElement("div");
    teamElement.classList.add("club");

    var logo = document.createElement("img");
    logo.src = team.logos && team.logos[0] ? team.logos[0].href : "";
    logo.alt = team.displayName;
    logo.classList.add("club-logo");

    var teamName = document.createElement("div");
    teamName.classList.add("club-name");
    teamName.innerText = team.displayName;

    teamElement.appendChild(logo);
    teamElement.appendChild(teamName);
    teamElement.addEventListener("click", function (e) {
      e.preventDefault();
      console.log(team, "////////////team clicked");
      localStorage.setItem("teamId", team.id);
      // Ensure content is defined
      if (typeof content === "undefined" || !content) {
        var contentElem = document.getElementById("content");
        if (!contentElem) {
          alert("Content element not found.");
          return;
        }
        window.content = contentElem;
      }
      loadPage("club_detail");
    });
    clubsContainer.appendChild(teamElement);
  }
}

function loadPage(page) {
  const fullPagePath = "../" + page + "/" + page;
  setActiveNav(page);
  fetch(fullPagePath + ".html")
    .then((response) => response.text())
    .then((html) => {
      content.innerHTML = html;
      // Dynamically load JS
      const script = document.createElement("script");
      script.src = fullPagePath + ".js";
      content.appendChild(script);
      // Dynamically load CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = fullPagePath + ".css";
      document.head.appendChild(link);
    })
    .catch(() => {
      content.innerHTML = "<p>Page not found.</p>";
    });
}
getTeams();

// {
//     "id": "337",
//     "uid": "s:600~t:337",
//     "slug": "eng.brentford",
//     "abbreviation": "BRE",
//     "displayName": "Brentford",
//     "shortDisplayName": "Brentford",
//     "name": "Brentford",
//     "nickname": "Brentford",
//     "location": "Brentford",
//     "color": "f42727",
//     "alternateColor": "f8ced9",
//     "isActive": true,
//     "isAllStar": false,
//     "logos": [
//         {
//             "href": "https://a.espncdn.com/i/teamlogos/soccer/500/337.png",
//             "alt": "",
//             "rel": [
//                 "full",
//                 "default"
//             ],
//             "width": 500,
//             "height": 500
//         },
//         {
//             "href": "https://a.espncdn.com/i/teamlogos/soccer/500-dark/337.png",
//             "alt": "",
//             "rel": [
//                 "full",
//                 "dark"
//             ],
//             "width": 500,
//             "height": 500
//         }
//     ]
// }

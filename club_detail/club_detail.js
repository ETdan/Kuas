var matches = [];
var matchesContainer = document.getElementById("matchesBtn");
var playersContainer = document.getElementById("playersBtn");
var clubContent = document.getElementById("club-content");
var teamId = localStorage.getItem("teamId");
var league = localStorage.getItem("leagueSlug");
var cache = {
  team: new Map(),
  venue: new Map(),
  status: new Map(),
  match: new Map(),
  score: new Map(),
};

function formatKickoff(dateStr) {
  if (!dateStr) return "";
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return dateStr;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

async function loadMatches() {
  if (!teamId) return;

  // Clear current results before loading a new date range
  clubContent.innerHTML = "";
  matches = [];

  const teamsUrl = `http://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`;

  const response = await fetch(teamsUrl);
  const data = await response.json();

  for (const match of data?.events) {
    const card = await renderMatchCard(match);
    if (card) clubContent.appendChild(card);
  }
}

// async function loadPlayers() {
//   if (!teamId) return;

//   // Clear current results before loading a new date range
//   clubContent.innerHTML = "";
//   players = [];

//   const teamsUrl = `http://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`;

//   const response = await fetch(teamsUrl);
//   const data = await response.json();

//   for (const match of data?.events) {
//     const card = await renderPlayers(match);
//     if (card) clubContent.appendChild(card);
//   }
// }

async function renderMatchCard(match) {
  const competitions = match?.competitions[0] ?? [];

  if (
    !competitions ||
    !competitions.competitors ||
    competitions.competitors.length < 2
  )
    return null;
  // Find home/away teams (fallback to array order if not present)
  const homeTeam = competitions.competitors[0].team;
  const awayTeam = competitions.competitors[1].team;

  // Fetch referenced resources (team info, venue, and game status)
  const venue = competitions.venue;

  const kickoff = formatKickoff(competitions.date);
  const venueName = venue?.fullName ?? "";
  const venueText = venueName ? `${venueName}` : "";

  const homeName = homeTeam?.displayName ?? "Home";
  const awayName = awayTeam?.displayName ?? "Away";

  const homeSlug = homeTeam?.slug ?? "";
  const awaySlug = awayTeam?.slug ?? "";

  const homeLogo = homeTeam?.logos?.[0]?.href ?? "";
  const awayLogo = awayTeam?.logos?.[0]?.href ?? "";

  const card = document.createElement("div");
  card.className = "match-card";

  // --- top row (kickoff + status) ---
  const top = document.createElement("div");
  top.className = "match-top";

  const kickoffEl = document.createElement("div");
  kickoffEl.className = "match-kickoff";
  kickoffEl.textContent = kickoff;

  top.appendChild(kickoffEl);

  // --- teams row (home / score / away) ---
  const teams = document.createElement("div");
  teams.className = "match-teams";

  // Home team block
  const homeTeamEl = document.createElement("div");
  homeTeamEl.className = "match-team";

  const homeLogoEl = document.createElement("img");
  homeLogoEl.className = "team-logo";
  homeLogoEl.src = homeLogo;
  homeLogoEl.alt = `${homeName} logo`;

  const homeNameEl = document.createElement("span");
  homeNameEl.className = "team-name";
  homeNameEl.textContent = homeName;
  homeNameEl.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.setItem("clubSlug", homeSlug);
    localStorage.setItem("clubName", homeName);
    window.location.href = "../club/club.html";
  });

  const homeSideEl = document.createElement("span");
  homeSideEl.className = "team-side";
  homeSideEl.textContent = "HOME";

  homeTeamEl.appendChild(homeLogoEl);
  homeTeamEl.appendChild(homeNameEl);
  homeTeamEl.appendChild(homeSideEl);

  // Away team block
  const awayTeamEl = document.createElement("div");
  awayTeamEl.className = "match-team";

  const awayLogoEl = document.createElement("img");
  awayLogoEl.className = "team-logo";
  awayLogoEl.src = awayLogo;
  awayLogoEl.alt = `${awayName} logo`;

  const awayNameEl = document.createElement("span");
  awayNameEl.className = "team-name";
  awayNameEl.textContent = awayName;
  awayNameEl.addEventListener("click", (e) => {
    e.stopPropagation();
    localStorage.setItem("clubSlug", awaySlug);
    localStorage.setItem("clubName", awayName);
    window.location.href = "../club/club.html";
  });

  const awaySideEl = document.createElement("span");
  awaySideEl.className = "team-side";
  awaySideEl.textContent = "AWAY";

  awayTeamEl.appendChild(awayLogoEl);
  awayTeamEl.appendChild(awayNameEl);
  awayTeamEl.appendChild(awaySideEl);

  teams.appendChild(homeTeamEl);
  teams.appendChild(awayTeamEl);

  // --- bottom row (venue) ---
  const bottom = document.createElement("div");
  bottom.className = "match-bottom";

  const venueEl = document.createElement("div");
  venueEl.className = "match-venue";
  venueEl.title = venueText;
  venueEl.textContent = venueText;

  bottom.appendChild(venueEl);

  // Combine
  card.appendChild(top);
  card.appendChild(teams);
  card.appendChild(bottom);

  return card;
}
async function renderPlayers() {
  const playerUrl = `http://sports.core.api.espn.com/v2/sports/soccer/leagues/${league}/seasons/2025/teams/${teamId}/athletes?lang=en&region=us`;
  const response = await fetch(playerUrl);
  const data = await response.json();
  var players = [];
  for (const playerRef of data?.items) {
    const response = await fetch(playerRef.$ref);
    const data = await response.json();
    var player = await renderPlayerCard(data);
    players.push(player);
  }
  clubContent.innerHTML = "";
  clubContent.append(...players);
  // return players;
}
async function renderPlayerCard(player) {
  // Card container
  const card = document.createElement("div");
  card.className = "player-card";
  card.id = `player-${player.id}`;

  // Top: Player image, name, flag
  const top = document.createElement("div");
  top.className = "player-top";

  // Player image from TheSportsDB
  const imgWrap = document.createElement("div");
  imgWrap.className = "player-img-wrap";
  const playerImg = document.createElement("img");
  playerImg.className = "player-img";
  playerImg.alt = player.fullName || player.displayName;
  // Hide image by default
  playerImg.style.display = "none";
  fetch(
    `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(player.fullName || player.displayName)}`,
  )
    .then((res) => res.json())
    .then((data) => {
      if (data && data.player && data.player[0] && data.player[0].strThumb) {
        playerImg.src = data.player[0].strThumb;
        playerImg.onload = () => {
          playerImg.style.display = "block";
        };
        playerImg.onerror = () => {
          playerImg.style.display = "none";
        };
      }
    })
    .catch(() => {});
  imgWrap.appendChild(playerImg);
  top.appendChild(imgWrap);

  // Name and flag
  const nameFlag = document.createElement("div");
  nameFlag.className = "player-name-flag";
  const name = document.createElement("div");
  name.className = "player-name";
  name.textContent = player.fullName || player.displayName;
  nameFlag.appendChild(name);
  // Flag
  if (player.flag && player.flag.href) {
    const flag = document.createElement("img");
    flag.className = "player-flag";
    flag.src = player.flag.href;
    flag.alt = player.flag.alt || player.citizenship || "";
    nameFlag.appendChild(flag);
  }
  top.appendChild(nameFlag);

  // Details section
  const details = document.createElement("div");
  details.className = "player-details";
  // Add more details from player object
  const detailsList = [
    { label: "Position", value: player.position?.displayName },
    { label: "Jersey", value: player.jersey },
    { label: "Age", value: player.age },
    { label: "Height", value: player.displayHeight },
    { label: "Weight", value: player.displayWeight },
    {
      label: "Date of Birth",
      value: player.dateOfBirth
        ? new Date(player.dateOfBirth).toLocaleDateString()
        : undefined,
    },
    {
      label: "Nationality",
      value: player.citizenshipCountry?.abbreviation || player.citizenship,
    },
    { label: "Status", value: player.status?.name },
    { label: "Gender", value: player.gender },
  ];
  detailsList.forEach((item) => {
    if (item.value) {
      const row = document.createElement("div");
      row.className = "player-detail-row";
      const label = document.createElement("span");
      label.className = "player-detail-label";
      label.textContent = `${item.label}: `;
      const value = document.createElement("span");
      value.className = "player-detail-value";
      value.textContent = item.value;
      row.appendChild(label);
      row.appendChild(value);
      details.appendChild(row);
    }
  });

  // Assemble card
  card.appendChild(top);
  card.appendChild(details);

  return card;
}
/**
 * {
    "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/athletes/169532?lang=en&region=us",
    "id": "169532",
    "uid": "s:600~a:169532",
    "type": "soccer",
    "guid": "75eafe6b-51d5-f593-082b-6a4f1d789d52",
    "firstName": "Kepa",
    "middleName": "",
    "lastName": "Arrizabalaga",
    "fullName": "Kepa Arrizabalaga",
    "displayName": "Kepa Arrizabalaga",
    "shortName": "K Arrizabalaga",
    "weight": 183.0,
    "displayWeight": "183 lbs",
    "height": 74.0,
    "displayHeight": "6' 2\"",
    "age": 31,
    "dateOfBirth": "1994-10-03T07:00Z",
    "gender": "MALE",
    "links": [
        {
            "language": "en-US",
            "rel": [
                "playercard",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/_/id/169532/kepa-arrizabalaga",
            "text": "Player Card",
            "shortText": "Player Card",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "stats",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/stats/_/id/169532/kepa-arrizabalaga",
            "text": "Stats",
            "shortText": "Stats",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "splits",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/splits/_/id/169532/kepa-arrizabalaga",
            "text": "Splits",
            "shortText": "Splits",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "gamelog",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/matches/_/id/169532/kepa-arrizabalaga",
            "text": "Matches",
            "shortText": "Matches",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "news",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/news/_/id/169532/kepa-arrizabalaga",
            "text": "News",
            "shortText": "News",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "bio",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/bio/_/id/169532/kepa-arrizabalaga",
            "text": "Bio",
            "shortText": "Bio",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "overview",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/_/id/169532/kepa-arrizabalaga",
            "text": "Overview",
            "shortText": "Overview",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "transfers",
                "desktop",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/transfers/_/id/169532/kepa-arrizabalaga",
            "text": "Transfers",
            "shortText": "Transfers",
            "isExternal": false,
            "isPremium": false
        },
        {
            "language": "en-US",
            "rel": [
                "transfers",
                "mobile",
                "athlete"
            ],
            "href": "https://www.espn.com/soccer/player/transfers/_/id/169532/kepa-arrizabalaga",
            "text": "Transfers",
            "shortText": "Transfers",
            "isExternal": false,
            "isPremium": false
        }
    ],
    "birthPlace": {},
    "citizenship": "Spain",
    "citizenshipCountry": {
        "alternateId": "13",
        "abbreviation": "ESP"
    },
    "slug": "kepa-arrizabalaga",
    "jersey": "13",
    "flag": {
        "href": "https://a.espncdn.com/i/teamlogos/countries/500/esp.png",
        "alt": "Spain",
        "rel": [
            "country-flag"
        ]
    },
    "position": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/positions/1?lang=en&region=us",
        "id": "1",
        "name": "Goalkeeper",
        "displayName": "Goalkeeper",
        "abbreviation": "G",
        "leaf": true
    },
    "injuries": [],
    "linked": true,
    "team": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/teams/359?lang=en&region=us"
    },
    "statistics": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/types/1/athletes/169532/statistics?lang=en&region=us"
    },
    "notes": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/athletes/169532/notes?lang=en&region=us"
    },
    "active": true,
    "eventLog": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2025/athletes/169532/eventlog?lang=en&region=us"
    },
    "status": {
        "id": "1",
        "name": "Active",
        "type": "active",
        "abbreviation": "Active"
    },
    "seasons": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/athletes/169532/seasons?lang=en&region=us"
    },
    "leagues": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/athletes/169532/leagues?lang=en&region=us"
    },
    "transactions": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/athletes/169532/transactions?lang=en&region=us"
    },
    "events": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/athletes/169532/events?lang=en&region=us"
    },
    "defaultLeague": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1?lang=en&region=us"
    },
    "profiled": false,
    "defaultTeam": {
        "$ref": "http://sports.core.api.espn.com/v2/sports/soccer/teams/359?lang=en&region=us"
    }
}
 */
if (slug != null) {
  loadMatches();
}

matchesContainer.addEventListener("click", (e) => {
  loadMatches();
});

playersContainer.addEventListener("click", (e) => {
  renderPlayers();
});

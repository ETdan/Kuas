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
  clubContent.innerHTML = "Loading Fixtures...";
  matchesContainer.focus();
  matches = [];

  const teamsUrl = `http://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`;

  const response = await fetch(teamsUrl);
  const data = await response.json();
  clubContent.innerHTML = "";

  for (const match of data?.events) {
    const card = await renderMatchCard(match);
    if (card) clubContent.appendChild(card);
  }
}

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
    localStorage.setItem("teamId", homeTeam.id);
    loadPage("club_detail");
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
    localStorage.setItem("teamId", awayTeam.id);
    loadPage("club_detail");
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
  clubContent.innerHTML = "";
  clubContent.innerHTML = "Loading Players...";
  playersContainer.focus();
  var players = [];
  const playerUrl = `http://sports.core.api.espn.com/v2/sports/soccer/leagues/${league}/seasons/2025/teams/${teamId}/athletes?lang=en&region=us`;
  const response = await fetch(playerUrl);
  const data = await response.json();
  clubContent.innerHTML = "";
  for (const playerRef of data?.items) {
    const response = await fetch(playerRef.$ref);
    const data = await response.json();
    var player = await renderPlayerCard(data);
    players.push(player);
  }

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
if (slug != null) {
  loadMatches();
}

matchesContainer.addEventListener("click", (e) => {
  loadMatches();
});

playersContainer.addEventListener("click", (e) => {
  renderPlayers();
});

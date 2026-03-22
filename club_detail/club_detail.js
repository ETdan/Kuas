var matches = [];
var matchesContainer = document.getElementById("matchesContainer");
var fromInput = document.getElementById("fromDate");
var toInput = document.getElementById("toDate");
var dateError = document.getElementById("dateError");
var teamId = localStorage.getItem("teamId");
// console.log(teamId, "/////////");

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

function statusMeta(statusJson) {
  const state = statusJson?.type?.state ?? "pre";
  const desc = statusJson?.type?.description ?? "";
  const clock = statusJson?.displayClock ?? "";

  if (state === "in") {
    return {
      state,
      label: "LIVE",
      detail: clock ? `${desc} • ${clock}` : desc,
    };
  }
  if (state === "post") {
    return { state, label: "FT", detail: desc || "Finished" };
  }
  return { state: "pre", label: "UPCOMING", detail: desc || "Not started" };
}

function safeText(value) {
  return value == null ? "" : String(value);
}

function getScoreValue(scoreJson) {
  return scoreJson?.value ?? scoreJson?.displayValue ?? scoreJson?.score ?? "";
}

async function loadMatches() {
  if (!teamId) return;

  // Clear current results before loading a new date range
  matchesContainer.innerHTML = "";
  matches = [];

  const url = `http://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`;

  const response = await fetch(url);
  const data = await response.json();

  for (const match of data?.events) {
    const card = await renderMatchCard(match);
    if (card) matchesContainer.appendChild(card);
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
  card.addEventListener("click", () => {
    localStorage.setItem(
      "match-name",
      competitions.name + " " + formatKickoff(competitions.date),
    );
    window.location.href = "../highlight/highlight.html";
  });

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

async function getTeam(url) {
  if (!url) return null;
  if (cache.team.has(url)) return cache.team.get(url);
  const p = fetch(url).then((r) => r.json());
  cache.team.set(url, p);
  return p;
}
async function getMatches(url) {
  if (!url) return null;
  if (cache.match.has(url)) return cache.match.get(url);
  const p = fetch(url).then((r) => r.json());
  cache.match.set(url, p);
  return p;
}

async function getVenue(url) {
  if (!url) return null;
  if (cache.venue.has(url)) return cache.venue.get(url);
  const p = fetch(url).then((r) => r.json());
  cache.venue.set(url, p);
  return p;
}

async function getStatus(url) {
  if (!url) return null;
  if (cache.status.has(url)) return cache.status.get(url);
  const p = fetch(url).then((r) => r.json());
  cache.status.set(url, p);
  return p;
}

async function getScore(url) {
  if (!url) return null;
  if (cache.score.has(url)) return cache.score.get(url);
  const p = fetch(url).then((r) => r.json());
  cache.score.set(url, p);
  return p;
}

if (slug != null) {
  loadMatches();
}

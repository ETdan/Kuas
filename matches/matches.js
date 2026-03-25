var matches = [];
var matchesContainer = document.getElementById("matchesContainer");
var fromInput = document.getElementById("fromDate");
var toInput = document.getElementById("toDate");
var dateError = document.getElementById("dateError");
var slug = localStorage.getItem("leagueSlug");
// console.log(slug, "/////////");

var STORAGE_KEYS = {
  from: "matchesFromDate",
  to: "matchesToDate",
};

var cache = {
  team: new Map(),
  venue: new Map(),
  status: new Map(),
  match: new Map(),
  score: new Map(),
};

function toInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toApiDate(dateStr) {
  // from YYYY-MM-DD to YYYYMMDD
  return dateStr.replace(/-/g, "");
}

function validateDates() {
  dateError.textContent = "";
  if (!fromInput.value || !toInput.value) {
    return false;
  }
  if (fromInput.value > toInput.value) {
    dateError.textContent = "From date cannot be after To date.";
    return false;
  }
  return true;
}

function persistDates() {
  if (!fromInput?.value || !toInput?.value) return;
  localStorage.setItem(STORAGE_KEYS.from, fromInput.value);
  localStorage.setItem(STORAGE_KEYS.to, toInput.value);
}

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
  if (!slug) return;
  if (!validateDates()) return;

  // Clear current results before loading a new date range
  matchesContainer.innerHTML = "";
  matches = [];

  const fromApi = toApiDate(fromInput.value);
  const toApi = toApiDate(toInput.value);

  const url = `http://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/events?dates=${fromApi}-${toApi}`;

  const response = await fetch(url);
  const data = await response.json();

  // Load match detail refs in parallel (keeps UI snappy)
  const matchDatas = await Promise.all(
    (data.items ?? []).map((m) => getMatches(m.$ref)),
  );
  matches = matchDatas.filter(Boolean);

  for (const match of matches) {
    const card = await renderMatchCard(match);
    if (card) matchesContainer.appendChild(card);
  }
}

async function renderMatchCard(match) {
  // Each event has one or more competitions; we use the first one.
  const competition = match?.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  if (!competition || competitors.length < 2) return null;

  // Find home/away teams (fallback to array order if not present)
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  // Fetch referenced resources (team info, venue, and game status)
  const [homeTeam, awayTeam, venue, statusJson, homeScoreJson, awayScoreJson] =
    await Promise.all([
      getTeam(home.team?.$ref),
      getTeam(away.team?.$ref),
      competition.venue,
      getStatus(competition.status?.$ref),
      getScore(home.score?.$ref),
      getScore(away.score?.$ref),
    ]);

  const kickoff = formatKickoff(competition.date ?? formatKickoff(match.date));
  const venueName = venue?.fullName ?? venue?.shortName ?? "";
  const venueText = venueName ? `${venueName}` : "";

  const meta = statusMeta(statusJson);

  const homeName = homeTeam?.displayName ?? "Home";
  const awayName = awayTeam?.displayName ?? "Away";
  const homeSlug = homeTeam?.slug ?? "";
  const awaySlug = awayTeam?.slug ?? "";
  const homeLogo = homeTeam?.logos?.[0]?.href ?? "";
  const awayLogo = awayTeam?.logos?.[0]?.href ?? "";

  // Score is only relevant for LIVE or Finished matches.
  const homeScore = getScoreValue(homeScoreJson);
  const awayScore = getScoreValue(awayScoreJson);
  const showScore = meta.state === "in" || meta.state === "post";

  const card = document.createElement("div");
  card.className = "match-card";
  card.addEventListener("click", () => {
    localStorage.setItem("match-name", match.name);
    // localStorage.setItem(
    //   "match-name",
    //   match.name + " " + formatKickoff(match.date),
    // );
    window.location.href = "../highlight/highlight.html";
  });

  // --- top row (kickoff + status) ---
  const top = document.createElement("div");
  top.className = "match-top";

  const kickoffEl = document.createElement("div");
  kickoffEl.className = "match-kickoff";
  kickoffEl.textContent = kickoff;

  const statusEl = document.createElement("div");
  statusEl.className = `match-status status-${meta.state}`;
  statusEl.title = meta.detail;

  const statusPill = document.createElement("span");
  statusPill.className = "status-pill";
  statusPill.textContent = meta.label;

  const statusDetail = document.createElement("span");
  statusDetail.className = "status-detail";
  statusDetail.textContent = meta.detail;

  statusEl.appendChild(statusPill);
  statusEl.appendChild(statusDetail);

  top.appendChild(kickoffEl);
  top.appendChild(statusEl);

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

  // Middle block: score (LIVE/FT) or "vs" (UPCOMING)
  const middle = document.createElement("div");
  middle.className = showScore ? "match-score" : "match-vs";
  middle.textContent = showScore
    ? `${safeText(homeScore)} - ${safeText(awayScore)}`
    : "vs";

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
  teams.appendChild(middle);
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

// initialise default dates and listeners
if (fromInput && toInput) {
  const savedFrom = localStorage.getItem(STORAGE_KEYS.from);
  const savedTo = localStorage.getItem(STORAGE_KEYS.to);

  // Restore last selected range (fallback to today -> next 7 days)
  if (savedFrom && savedTo) {
    fromInput.value = savedFrom;
    toInput.value = savedTo;
    persistDates();
  } else {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    fromInput.value = toInputValue(today);
    toInput.value = toInputValue(nextWeek);
    persistDates();
  }

  fromInput.addEventListener("change", () => {
    persistDates();
    loadMatches();
  });
  toInput.addEventListener("change", () => {
    persistDates();
    loadMatches();
  });
}

if (slug != null) {
  loadMatches();
}

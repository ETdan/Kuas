/**
 * matches.js - Matches view module.
 * Matchday Edition / Football Art Theme
 */

import { Storage } from "../storage.js";
import { escapeHTML, ensureHttps, formatKickoff, toInputValue, toApiDate } from "../utils.js";
import { getEvents, getMatchRef, getTeamRef, getStatusRef, getScoreRef } from "../api.js";

const STORAGE_KEYS = { from: "matchesFromDate", to: "matchesToDate" };

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------

function renderMatchCardHTML(d) {
  const homeLogo = d.homeLogo
    ? `<img class="team-logo" src="${escapeHTML(d.homeLogo)}" alt="${escapeHTML(d.homeName)}" loading="lazy">`
    : `<div class="team-logo-placeholder">⚽</div>`;
  const awayLogo = d.awayLogo
    ? `<img class="team-logo" src="${escapeHTML(d.awayLogo)}" alt="${escapeHTML(d.awayName)}" loading="lazy">`
    : `<div class="team-logo-placeholder">⚽</div>`;

  const highlightsBadge = d.state === "post"
    ? `<span class="highlights-cue">HIGHLIGHTS ↗</span>`
    : "";

  return `
    <div class="match-card" data-action="open-highlights" data-match-name="${escapeHTML(d.matchName)}" role="button" tabindex="0">
      <div class="match-top">
        <div class="match-kickoff">
          <span class="clock-icon">⏱</span>
          <span>${escapeHTML(d.kickoff)}</span>
        </div>
        <div class="match-status status-${d.state}" title="${escapeHTML(d.detail)}">
          <span class="status-pill">${escapeHTML(d.label)}</span>
          <span class="status-detail">${escapeHTML(d.detail)}</span>
        </div>
      </div>

      <div class="match-teams">
        <div class="match-team home-team">
          <div class="team-logo-wrap">${homeLogo}</div>
          <div class="team-info">
            <span class="team-name" data-action="open-club"
                  data-club-slug="${escapeHTML(d.homeSlug)}"
                  data-club-id="${escapeHTML(d.homeId)}"
                  data-club-name="${escapeHTML(d.homeName)}">${escapeHTML(d.homeName)}</span>
            <span class="team-side-badge">HOME</span>
          </div>
        </div>

        <div class="match-score-board ${d.showScore ? "has-score" : "is-vs"}">
          ${d.showScore 
            ? `<span class="score-digit">${escapeHTML(String(d.homeScore))}</span>
               <span class="score-divider">:</span>
               <span class="score-digit">${escapeHTML(String(d.awayScore))}</span>`
            : `<span class="vs-text">VS</span>`}
        </div>

        <div class="match-team away-team">
          <div class="team-info team-info-away">
            <span class="team-name" data-action="open-club"
                  data-club-slug="${escapeHTML(d.awaySlug)}"
                  data-club-id="${escapeHTML(d.awayId)}"
                  data-club-name="${escapeHTML(d.awayName)}">${escapeHTML(d.awayName)}</span>
            <span class="team-side-badge">AWAY</span>
          </div>
          <div class="team-logo-wrap">${awayLogo}</div>
        </div>
      </div>

      <div class="match-bottom">
        <div class="match-venue" title="${escapeHTML(d.venueName)}">
          ${d.venueName ? `<span class="stadium-icon">🏟</span> ${escapeHTML(d.venueName)}` : ""}
        </div>
        ${highlightsBadge}
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

function statusMeta(statusJson) {
  const state = statusJson?.type?.state ?? "pre";
  const desc  = statusJson?.type?.description ?? "";
  const clock = statusJson?.displayClock ?? "";
  if (state === "in")   return { state, label: "● LIVE", detail: clock ? `${clock}'` : "IN PLAY" };
  if (state === "post") return { state, label: "FT",   detail: desc || "Finished" };
  return { state: "pre", label: "UPCOMING", detail: desc || "Not started" };
}

function getScoreValue(scoreJson) {
  return scoreJson?.value ?? scoreJson?.displayValue ?? scoreJson?.score ?? "0";
}

async function buildMatchData(match) {
  const competition  = match?.competitions?.[0];
  const competitors  = competition?.competitors ?? [];
  if (!competition || competitors.length < 2) return null;

  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];

  const [homeTeam, awayTeam, statusJson, homeScoreJson, awayScoreJson] = await Promise.all([
    getTeamRef(home.team?.$ref),
    getTeamRef(away.team?.$ref),
    getStatusRef(competition.status?.$ref),
    getScoreRef(home.score?.$ref),
    getScoreRef(away.score?.$ref),
  ]);

  const venue    = competition.venue;
  const kickoff  = formatKickoff(competition.date ?? match.date);
  const venueName = venue?.fullName ?? venue?.shortName ?? "";
  const meta     = statusMeta(statusJson);

  return {
    matchName: match.name || "",
    kickoff,
    state:     meta.state,
    label:     meta.label,
    detail:    meta.detail,
    homeName:  homeTeam?.displayName ?? "Home",
    homeSlug:  homeTeam?.slug ?? "",
    homeId:    homeTeam?.id ?? "",
    homeLogo:  ensureHttps(homeTeam?.logos?.[0]?.href ?? ""),
    awayName:  awayTeam?.displayName ?? "Away",
    awaySlug:  awayTeam?.slug ?? "",
    awayId:    awayTeam?.id ?? "",
    awayLogo:  ensureHttps(awayTeam?.logos?.[0]?.href ?? ""),
    showScore: meta.state === "in" || meta.state === "post",
    homeScore: getScoreValue(homeScoreJson),
    awayScore: getScoreValue(awayScoreJson),
    venueName,
  };
}

// ---------------------------------------------------------------------------
// View init
// ---------------------------------------------------------------------------

export async function init(container, navigate) {
  const slug = await Storage.get("leagueSlug");

  // Render view skeleton with date presets
  container.innerHTML = `
    <div class="matches-header-wrap">
      <div class="date-presets" id="date-presets">
        <button class="preset-btn" data-preset="yesterday">Yesterday</button>
        <button class="preset-btn" data-preset="today">Today</button>
        <button class="preset-btn" data-preset="tomorrow">Tomorrow</button>
        <button class="preset-btn" data-preset="week">7 Days</button>
      </div>

      <div id="date-filters">
        <div class="date-field">
          <label for="fromDate">From</label>
          <input type="date" id="fromDate">
        </div>
        <div class="date-sep">→</div>
        <div class="date-field">
          <label for="toDate">To</label>
          <input type="date" id="toDate">
        </div>
        <p id="dateError" class="date-error"></p>
      </div>
    </div>

    <div id="matchesContainer"></div>
  `;

  const matchesContainer = container.querySelector("#matchesContainer");
  const fromInput        = container.querySelector("#fromDate");
  const toInput          = container.querySelector("#toDate");
  const dateError        = container.querySelector("#dateError");
  const presetsContainer = container.querySelector("#date-presets");

  // ---- Date helpers ----

  function validateDates() {
    dateError.textContent = "";
    if (!fromInput.value || !toInput.value) return false;
    if (fromInput.value > toInput.value) {
      dateError.textContent = "From date cannot be after To date.";
      return false;
    }
    return true;
  }

  async function persistDates() {
    if (!fromInput.value || !toInput.value) return;
    await Promise.all([
      Storage.set(STORAGE_KEYS.from, fromInput.value),
      Storage.set(STORAGE_KEYS.to,   toInput.value),
    ]);
  }

  // ---- Load matches ----

  async function loadMatches() {
    if (!slug) {
      matchesContainer.innerHTML = `<div class="info-msg">No league selected.</div>`;
      return;
    }
    if (!validateDates()) return;

    matchesContainer.innerHTML = `
      <div class="info-msg">
        <div class="loader"></div>
        <span>CHECKING FIXTURES & RESULTS…</span>
      </div>
    `;

    try {
      const data = await getEvents(slug, toApiDate(fromInput.value), toApiDate(toInput.value));

      if (!data?.items?.length) {
        matchesContainer.innerHTML = `
          <div class="info-msg">
            <span>No fixtures or results found for selected dates.</span>
          </div>
        `;
        return;
      }

      const matchRefs  = await Promise.all(data.items.map((m) => getMatchRef(m.$ref)));
      const validRefs  = matchRefs.filter(Boolean);
      const cardsData  = await Promise.all(validRefs.map(buildMatchData));
      const validCards = cardsData.filter(Boolean);

      if (!validCards.length) {
        matchesContainer.innerHTML = `<div class="info-msg">No valid match details available.</div>`;
        return;
      }

      matchesContainer.innerHTML = validCards.map(renderMatchCardHTML).join("");
    } catch (err) {
      console.error("Error loading matches:", err);
      matchesContainer.innerHTML = `<div class="error-msg">Failed to load matches.</div>`;
    }
  }

  // ---- Presets handler ----
  presetsContainer?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".preset-btn");
    if (!btn) return;
    const preset = btn.getAttribute("data-preset");
    const now = new Date();

    if (preset === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      fromInput.value = toInputValue(y);
      toInput.value   = toInputValue(y);
    } else if (preset === "today") {
      fromInput.value = toInputValue(now);
      toInput.value   = toInputValue(now);
    } else if (preset === "tomorrow") {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      fromInput.value = toInputValue(t);
      toInput.value   = toInputValue(t);
    } else if (preset === "week") {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      fromInput.value = toInputValue(now);
      toInput.value   = toInputValue(end);
    }

    presetsContainer.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    await persistDates();
    loadMatches();
  });

  // ---- Event delegation ----

  matchesContainer.addEventListener("click", async (e) => {
    // Team name → Clubs view with that team pre-selected
    const clubElem = e.target.closest('[data-action="open-club"]');
    if (clubElem) {
      e.stopPropagation();
      await Storage.set("clubSlug",  clubElem.getAttribute("data-club-slug"));
      await Storage.set("clubName",  clubElem.getAttribute("data-club-name"));
      await Storage.set("teamId",    clubElem.getAttribute("data-club-id"));
      navigate("club_detail");
      return;
    }

    // Match card → Highlights view
    const matchCard = e.target.closest('[data-action="open-highlights"]');
    if (matchCard) {
      await Storage.set("match-name", matchCard.getAttribute("data-match-name"));
      navigate("highlight");
    }
  });

  // Keyboard accessibility
  matchesContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const card = e.target.closest(".match-card");
      if (card) {
        e.preventDefault();
        card.click();
      }
    }
  });

  // ---- Initialise date inputs from Storage ----

  const [savedFrom, savedTo] = await Promise.all([
    Storage.get(STORAGE_KEYS.from),
    Storage.get(STORAGE_KEYS.to),
  ]);

  if (savedFrom && savedTo) {
    fromInput.value = savedFrom;
    toInput.value   = savedTo;
  } else {
    const today    = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    fromInput.value = toInputValue(today);
    toInput.value   = toInputValue(nextWeek);
    await persistDates();
  }

  fromInput.addEventListener("change", async () => {
    presetsContainer.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    await persistDates();
    loadMatches();
  });
  toInput.addEventListener("change", async () => {
    presetsContainer.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
    await persistDates();
    loadMatches();
  });

  loadMatches();
}

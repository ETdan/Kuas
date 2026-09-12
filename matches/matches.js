/**
 * matches.js - Matches view module.
 * Matchday Edition / Football Art Theme
 */

import { Storage } from "../storage.js";
import { toInputValue, toApiDate, renderErrorState } from "../utils.js";
import { getEvents, getMatchRef, getTeamRef, getStatusRef, getScoreRef } from "../api.js";
import { renderMatchCardHTML, normalizeEspnEvent } from "../components/match_card.js";

const STORAGE_KEYS = { from: "matchesFromDate", to: "matchesToDate" };

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

  // Construct synthetic populated event to pass into normalizeEspnEvent
  const syntheticEvent = {
    id: match.id || competition.id,
    name: match.name,
    date: match.date || competition.date,
    competitions: [
      {
        ...competition,
        venue: competition.venue,
        status: statusJson || competition.status,
        competitors: [
          {
            ...home,
            homeAway: "home",
            team: homeTeam || home.team,
            score: homeScoreJson?.value ?? homeScoreJson?.displayValue ?? homeScoreJson?.score ?? home.score,
          },
          {
            ...away,
            homeAway: "away",
            team: awayTeam || away.team,
            score: awayScoreJson?.value ?? awayScoreJson?.displayValue ?? awayScoreJson?.score ?? away.score,
          },
        ],
      },
    ],
  };

  return normalizeEspnEvent(syntheticEvent);
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
      renderErrorState(
        matchesContainer,
        "Failed to load matches for the selected date range. Please try again.",
        () => loadMatches()
      );
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
    // 1. Team name → Clubs view with that team pre-selected
    const clubElem = e.target.closest('[data-action="open-club"]');
    if (clubElem) {
      e.stopPropagation();
      await Storage.set("clubSlug",  clubElem.getAttribute("data-club-slug"));
      await Storage.set("clubName",  clubElem.getAttribute("data-club-name"));
      await Storage.set("teamId",    clubElem.getAttribute("data-club-id"));
      navigate("club_detail");
      return;
    }

    // 2. Highlights button or cue → Match Center with Highlights tab
    const hlBtn = e.target.closest('[data-action="open-highlights"]');
    if (hlBtn) {
      e.stopPropagation();
      const matchName = hlBtn.getAttribute("data-match-name") || "Match Details";
      await Storage.set("matchName", matchName);
      await Storage.set("matchInitialTab", "highlights");
      navigate("match_detail");
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
        Storage.set("matchInitialTab", "timeline"),
      ]);
      navigate("match_detail");
      return;
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

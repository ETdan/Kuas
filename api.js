/**
 * api.js - Centralized ESPN API layer for the Kuas extension.
 *
 * Upgraded with persistent Storage caching (chrome.storage.local)
 * and in-flight request deduplication for instantaneous popup loads.
 */

import { Storage } from "./storage.js";
import { ensureHttps } from "./utils.js";

const _inFlight = new Map();

// Default TTLs in milliseconds
export const TTL = {
  LEAGUES:    24 * 60 * 60 * 1000, // 24 hours
  ROSTER:     2 * 60 * 60 * 1000,  // 2 hours
  STANDINGS:  30 * 60 * 1000,      // 30 minutes
  STATISTICS: 30 * 60 * 1000,      // 30 minutes (top scorers)
  TEAM_INFO:  2 * 60 * 60 * 1000,  // 2 hours
  MATCHES:    2 * 60 * 1000,       // 2 minutes
  SUMMARY:    2 * 60 * 1000,       // 2 minutes (live/recent)
  LIVE:       30 * 1000,           // 30 seconds (real-time in-play scores)
};

/** Clear the in-flight map. */
export function clearCache() {
  _inFlight.clear();
}

/**
 * Fetch a URL with persistent caching and concurrent deduplication.
 * @param {string} url
 * @param {number} ttlMs
 * @returns {Promise<object|null>}
 */
async function fetchCached(url, ttlMs = TTL.STANDINGS) {
  const safe = ensureHttps(url);
  if (!safe) return null;

  // 1. Check in-flight promise (concurrent deduplication)
  if (_inFlight.has(safe)) return _inFlight.get(safe);

  // 2. Check persistent Storage cache
  const cacheKey = `api-cache:v2:${safe}`;
  try {
    const cached = await Storage.get(cacheKey);
    if (cached && cached.data !== undefined && cached.expiresAt && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  } catch (_e) {}

  // 3. Initiate network request
  const p = (async () => {
    try {
      const res = await fetch(safe);
      if (!res.ok) return null;
      const data = await res.json();
      if (data) {
        await Storage.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttlMs,
        }).catch(() => {});
      }
      return data;
    } catch (_err) {
      return null;
    } finally {
      _inFlight.delete(safe);
    }
  })();

  _inFlight.set(safe, p);
  return p;
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

/** Fetch the full list of ESPN soccer leagues with 24h cache. */
export async function getLeagues() {
  const cacheKey = "api-cache:v2:all-leagues-resolved";
  try {
    const cached = await Storage.get(cacheKey);
    if (cached && cached.data?.length && cached.expiresAt && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  } catch (_e) {}

  const data = await fetchCached(
    "https://sports.core.api.espn.com/v2/sports/soccer/leagues",
    TTL.LEAGUES
  );
  if (!data?.items) return [];
  const items = await Promise.all(
    data.items.map((i) => fetchCached(i.$ref, TTL.LEAGUES))
  );
  const result = items.filter(Boolean);
  if (result.length > 0) {
    Storage.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + TTL.LEAGUES,
    }).catch(() => {});
  }
  return result;
}

// ---------------------------------------------------------------------------
// Matches / Scoreboard / Events
// ---------------------------------------------------------------------------

export function getMatchRef(url) {
  return fetchCached(url, TTL.MATCHES);
}

export function getTeamRef(url) {
  return fetchCached(url, TTL.ROSTER);
}

export function getStatusRef(url) {
  return fetchCached(url, TTL.MATCHES);
}

export function getScoreRef(url) {
  return fetchCached(url, TTL.MATCHES);
}

/** Fetch events for a league within a date range. */
export async function getEvents(slug, from, to) {
  return fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/events?dates=${from}-${to}`,
    TTL.MATCHES
  );
}

/** Fetch scoreboard for a league on a specific date (yyyymmdd) or today. */
export async function getScoreboard(slug, dateStr) {
  const query = dateStr ? `?dates=${dateStr}` : "";
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard${query}`,
    TTL.MATCHES
  );
}

/**
 * Fetch real-time live scoreboard for a specific league or worldwide ('all').
 * Uses a shorter 30-second cache TTL for responsive score and clock updates.
 * @param {string} slug League slug or 'all'
 */
export async function getLiveScoreboard(slug = "all") {
  const league = slug || "all";
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard`,
    TTL.LIVE
  );
}

/**
 * Fetch detailed match summary (goal scorers, cards, timeline, stats).
 * @param {string} slug
 * @param {string|number} eventId
 */
export async function getMatchSummary(slug, eventId) {
  const league = slug || "all";
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/summary?event=${eventId}`,
    TTL.SUMMARY
  );
}

// ---------------------------------------------------------------------------
// Standings & Statistics (Top Scorers / Assists)
// ---------------------------------------------------------------------------

export function getStandings(slug) {
  return fetchCached(
    `https://sports.core.api.espn.com/v3/sports/soccer/${slug}/standings`,
    TTL.STANDINGS
  );
}

/**
 * Fetch league statistics (goalsLeaders and assistsLeaders).
 * @param {string} slug
 */
export function getLeagueStatistics(slug) {
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics`,
    TTL.STATISTICS
  );
}

// ---------------------------------------------------------------------------
// Clubs / Teams
// ---------------------------------------------------------------------------

/** Fetch all teams in a league. */
export async function getLeagueTeams(slug) {
  const data = await fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`,
    TTL.TEAM_INFO
  );
  return (
    data?.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team).filter(Boolean) ?? []
  );
}

/** Fetch comprehensive team profile (record, venue, standingSummary). */
export async function getTeamInfo(slug, teamId) {
  const league = slug || "all";
  const data = await fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}`,
    TTL.TEAM_INFO
  );
  return data?.team ?? null;
}

/** Fetch upcoming fixture schedule for a team. */
export function getTeamSchedule(teamId) {
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`,
    TTL.MATCHES
  );
}

/**
 * Fetch the complete first-team squad roster for a team.
 * Uses ESPN Site API which returns the entire active roster in one call
 * with full player details, jerseys, positions, stats, and coach/manager.
 */
export async function getTeamRoster(slug, teamId) {
  const league = slug || "all";
  const data = await fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}/roster`,
    TTL.ROSTER
  );
  if (data?.athletes?.length) return data;

  if (league !== "all") {
    const fallback = await fetchCached(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/roster`,
      TTL.ROSTER
    );
    if (fallback?.athletes?.length) return fallback;
  }

  return data;
}

export async function getTeamById(slug, teamId, year) {
  const byYear = await fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${year}/teams/${teamId}`,
    TTL.TEAM_INFO
  );
  if (byYear) return byYear;
  return fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/teams/${teamId}`,
    TTL.TEAM_INFO
  );
}


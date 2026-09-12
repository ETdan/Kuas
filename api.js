/**
 * api.js - Centralized ESPN API layer for the Kuas extension.
 *
 * All network calls go through fetchCached(), which:
 *  - Rewrites http:// to https://
 *  - Stores the in-flight Promise so concurrent callers for the same URL
 *    share one request (request deduplication + in-memory cache).
 *  - Returns null on network/parse errors instead of throwing.
 *
 * Cache lives for the lifetime of the extension page (cleared on navigation
 * to a new shell page). Call clearCache() explicitly if needed.
 */

import { ensureHttps } from "./utils.js";

const _cache = new Map();

/** Clear the entire in-memory cache (e.g. on league change). */
export function clearCache() {
  _cache.clear();
}

/**
 * Fetch a URL, caching the Promise so duplicate calls share one request.
 * @param {string} url
 * @returns {Promise<object|null>}
 */
function fetchCached(url) {
  const safe = ensureHttps(url);
  if (!safe) return Promise.resolve(null);
  if (_cache.has(safe)) return _cache.get(safe);
  const p = fetch(safe)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  _cache.set(safe, p);
  return p;
}

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

/** Fetch the full list of ESPN soccer leagues. */
export async function getLeagues() {
  const data = await fetchCached(
    "https://sports.core.api.espn.com/v2/sports/soccer/leagues"
  );
  if (!data?.items) return [];
  const items = await Promise.all(data.items.map((i) => fetchCached(i.$ref)));
  return items.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Match-level references (used by Matches view)
// ---------------------------------------------------------------------------

export function getMatchRef(url) {
  return fetchCached(url);
}

export function getTeamRef(url) {
  return fetchCached(url);
}

export function getStatusRef(url) {
  return fetchCached(url);
}

export function getScoreRef(url) {
  return fetchCached(url);
}

/**
 * Fetch events (matches) for a league within a date range.
 * @param {string} slug  League slug (e.g. "eng.1")
 * @param {string} from  yyyymmdd
 * @param {string} to    yyyymmdd
 */
export async function getEvents(slug, from, to) {
  return fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/events?dates=${from}-${to}`
  );
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export function getStandings(slug) {
  return fetchCached(
    `https://sports.core.api.espn.com/v3/sports/soccer/${slug}/standings`
  );
}

/**
 * Fetch a team by ID, trying the season-scoped URL first then the base URL.
 * @param {string} slug
 * @param {string|number} teamId
 * @param {number} year
 */
export async function getTeamById(slug, teamId, year) {
  const byYear = await fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${year}/teams/${teamId}`
  );
  if (byYear) return byYear;
  return fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/teams/${teamId}`
  );
}

// ---------------------------------------------------------------------------
// Clubs / Teams
// ---------------------------------------------------------------------------

/**
 * Fetch all teams in a league using the ESPN Site API.
 * Returns an array of team objects.
 */
export async function getLeagueTeams(slug) {
  const data = await fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`
  );
  return (
    data?.sports?.[0]?.leagues?.[0]?.teams?.map((t) => t.team).filter(Boolean) ?? []
  );
}

/** Fetch upcoming fixture schedule for a team. */
export function getTeamSchedule(teamId) {
  return fetchCached(
    `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule?fixture=true`
  );
}

/**
 * Fetch the roster reference list for a team in the current season.
 * Returns the raw API response (items is an array of $ref objects).
 */
export function getTeamRoster(slug, teamId) {
  const year = new Date().getFullYear();
  return fetchCached(
    `https://sports.core.api.espn.com/v2/sports/soccer/leagues/${slug}/seasons/${year}/teams/${teamId}/athletes?lang=en&region=us`
  );
}

/** Fetch a single player from their $ref URL. */
export function getPlayer(refUrl) {
  return fetchCached(refUrl);
}

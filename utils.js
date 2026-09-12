/**
 * utils.js - Shared utility functions for the Kuas extension.
 * Imported as an ES module wherever needed.
 */

/** Rewrite http:// URLs to https:// to satisfy Mixed Content policy. */
export function ensureHttps(url) {
  return url ? url.replace(/^http:\/\//i, "https://") : "";
}

/** Escape user/API-supplied strings before inserting into innerHTML. */
export function escapeHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format an ISO date string to a human-readable kickoff time using the browser locale. */
export function formatKickoff(dateStr) {
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

/** Convert a Date object to a yyyy-mm-dd string for <input type="date">. */
export function toInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Convert yyyy-mm-dd to yyyymmdd for ESPN API date range params. */
export function toApiDate(dateStr) {
  return dateStr ? dateStr.replace(/-/g, "") : "";
}

/**
 * Render a standardized error state card with optional retry button and offline detection.
 * @param {HTMLElement|string} container Target DOM element
 * @param {string} message Error message
 * @param {Function|null} onRetry Retry callback
 */
export function renderErrorState(container, message = "Unable to load data at this time.", onRetry = null) {
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const displayMsg = isOffline
    ? "You appear to be offline. Please check your internet connection."
    : message;

  const html = `
    <div class="error-card">
      <div class="error-card-icon">${isOffline ? "📡" : "⚠️"}</div>
      <h3 class="error-card-title">${isOffline ? "NO INTERNET CONNECTION" : "TRANSMISSION ISSUE"}</h3>
      <p class="error-card-desc">${escapeHTML(displayMsg)}</p>
      ${onRetry ? `
        <button class="retry-action-btn" id="errRetryBtn">
          <span>🔄</span> RETRY
        </button>
      ` : ""}
    </div>
  `;

  if (typeof container === "string") return html;
  if (container) {
    container.innerHTML = html;
    if (onRetry) {
      container.querySelector("#errRetryBtn")?.addEventListener("click", () => onRetry());
    }
  }
  return html;
}


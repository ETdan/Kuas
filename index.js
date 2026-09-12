/**
 * index.js - Popup entry point.
 * Fetches all available soccer leagues from ESPN, renders the league cards,
 * and handles search/category filtering.
 */
import { Storage } from "./storage.js";
import { escapeHTML, ensureHttps } from "./utils.js";
import { getLeagues } from "./api.js";

const leaguesContainer = document.getElementById("leagues");
const searchInput = document.getElementById("league-search");
const clearSearchBtn = document.getElementById("clear-search");
const filterChips = document.getElementById("filter-chips");
const leagueCountBadge = document.getElementById("league-count");

if (!leaguesContainer) throw new Error("Missing #leagues container");

// Show initial animated loader
leaguesContainer.innerHTML = `
  <div class="info-msg">
    <div class="loader"></div>
    <span>SCOUTING COMPETITIONS…</span>
  </div>
`;

let allLeagues = [];
let activeFilter = "all";
let searchQuery = "";

// Categorization helper
function matchCategory(league, filter) {
  if (filter === "all") return true;
  const slug = (league.slug || "").toLowerCase();
  const name = (league.name || "").toLowerCase();

  if (filter === "europe") {
    const euroPrefixes = ["eng.", "esp.", "ita.", "ger.", "fra.", "ned.", "por.", "sco.", "tur.", "bel.", "uefa."];
    return euroPrefixes.some((p) => slug.startsWith(p)) || name.includes("premier") || name.includes("laliga") || name.includes("serie a") || name.includes("bundesliga");
  }

  if (filter === "americas") {
    const amPrefixes = ["usa.", "mex.", "bra.", "arg.", "col.", "chi.", "conmebol.", "concacaf."];
    return amPrefixes.some((p) => slug.startsWith(p)) || name.includes("mls") || name.includes("liga mx") || name.includes("libertadores");
  }

  if (filter === "cup") {
    return (
      name.includes("cup") ||
      name.includes("copa") ||
      name.includes("champions") ||
      name.includes("trophy") ||
      name.includes("shield") ||
      name.includes("pokal") ||
      slug.includes("uefa") ||
      slug.includes("fifa")
    );
  }

  return true;
}

function getLeagueSubLabel(slug) {
  if (!slug) return "LEAGUE";
  if (slug.startsWith("eng.")) return "ENGLAND";
  if (slug.startsWith("esp.")) return "SPAIN";
  if (slug.startsWith("ita.")) return "ITALY";
  if (slug.startsWith("ger.")) return "GERMANY";
  if (slug.startsWith("fra.")) return "FRANCE";
  if (slug.startsWith("usa.")) return "USA";
  if (slug.startsWith("uefa.")) return "UEFA";
  if (slug.startsWith("fifa.")) return "FIFA";
  if (slug.startsWith("mex.")) return "MEXICO";
  if (slug.startsWith("bra.")) return "BRAZIL";
  if (slug.startsWith("arg.")) return "ARGENTINA";
  return "SOCCER";
}

function renderLeagueCardHTML(league) {
  const logoUrl =
    league.logos && league.logos.length > 0
      ? ensureHttps(league.logos[0].href)
      : "icons/missing_logo.jpg";
  const name = escapeHTML(league.name || "League");
  const slug = escapeHTML(league.slug || "");
  const region = getLeagueSubLabel(league.slug || "");

  return `
    <div class="league-container ${slug}" data-slug="${slug}" role="button" tabindex="0"
         aria-label="${name}">
      <div class="league-logo-frame">
        <img class="league-image" src="${logoUrl}" alt="${name}" loading="lazy">
      </div>
      <span class="league-name" title="${name}">${name}</span>
      <span class="league-badge-pill">${region}</span>
    </div>
  `;
}

function applyFiltersAndRender() {
  const q = searchQuery.toLowerCase().trim();
  const filtered = allLeagues.filter((league) => {
    const matchesCat = matchCategory(league, activeFilter);
    if (!matchesCat) return false;
    if (!q) return true;
    const name = (league.name || "").toLowerCase();
    const slug = (league.slug || "").toLowerCase();
    return name.includes(q) || slug.includes(q);
  });

  if (leagueCountBadge) {
    leagueCountBadge.textContent = `${filtered.length} AVAILABLE`;
  }

  if (filtered.length === 0) {
    leaguesContainer.innerHTML = `
      <div class="info-msg">
        <span>No competitions found matching "${escapeHTML(searchQuery)}".</span>
      </div>
    `;
    return;
  }

  leaguesContainer.innerHTML = filtered.map(renderLeagueCardHTML).join("");
}

// Search interactions
searchInput?.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  if (clearSearchBtn) {
    clearSearchBtn.style.display = searchQuery ? "block" : "none";
  }
  applyFiltersAndRender();
});

clearSearchBtn?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  searchQuery = "";
  if (clearSearchBtn) clearSearchBtn.style.display = "none";
  applyFiltersAndRender();
  searchInput?.focus();
});

// Category chip filter interactions
filterChips?.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  filterChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  chip.classList.add("active");
  activeFilter = chip.getAttribute("data-filter") || "all";
  applyFiltersAndRender();
});

// Event delegation — league card click
leaguesContainer.addEventListener("click", async (e) => {
  const card = e.target.closest(".league-container");
  if (!card) return;
  const slug = card.getAttribute("data-slug");
  if (slug) {
    await Storage.set("leagueSlug", slug);
    window.location.href = "league/league.html";
  }
});

// Keyboard accessibility
leaguesContainer.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    e.target.closest(".league-container")?.click();
  }
});

// Load leagues from ESPN API
getLeagues().then((leagues) => {
  if (!leagues || leagues.length === 0) {
    leaguesContainer.innerHTML = `<div class="error-msg">Failed to load leagues from server.</div>`;
    return;
  }
  allLeagues = leagues;
  applyFiltersAndRender();
});

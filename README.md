# Kuas — Football Matchday Hub

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4.svg?logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)

**Kuas** is a fast, modern Chrome extension for football (soccer) fans. Track real-time scores, explore league tables, browse club rosters, and catch match video highlights across top global competitions — all from a single, lightweight browser popup.

---

## ⚡ Features

- **🏆 Multi-League Coverage:** Follow the Premier League, UEFA Champions League, La Liga, Serie A, Bundesliga, Ligue 1, and more.
- **⏱️ Live Matchday Hub:** Real-time scoreboard with live match clocks, goal notifications, and upcoming fixture dates.
- **📊 Interactive Standings & Stats:** Complete league tables (points, GD, form) plus goalscoring and assist leaderboards.
- **📋 Match Details & Line-ups:** Deep dive into completed and live matches with timeline events, starting XIs, substitutions, and team statistics.
- **🛡️ Club & Squad Profiles:** View comprehensive club profiles, managerial staff, upcoming team schedules, and full squad rosters with player headshots.
- **🎥 Curated Video Highlights:** Quick access to official YouTube match highlights and recaps for recent fixtures.
- **🔴 Background Live Match Indicator:** Service worker periodically checks for in-progress matches and displays a red badge on the extension icon.
- **⚡ Instant Loading & Smart Cache:** Multi-tier caching (`chrome.storage.local`) with TTL expiration and concurrent request deduplication for zero-latency popup opens.

---

## 📁 Project Structure

```text
Kuas/
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service worker (live match badge & alarms)
├── storage.js                 # chrome.storage.local wrapper with TTL caching
├── api.js                     # ESPN & TheSportsDB API integration layer
├── utils.js                   # Sanitization, time/date formatting helpers
├── common.css                 # Shared typography, design tokens, and components
├── index.html                 # Main landing page (league selection)
├── index.js                   # Landing page logic & league cards
├── index.css                  # Landing page styles
├── icons/                     # Extension branding icons (16, 48, 128 px)
├── components/
│   └── match_card.js          # Reusable match card UI component
├── league/
│   ├── league.html            # Main league dashboard container
│   ├── league.js              # Navigation, tab switching, and state sync
│   └── league.css             # League container layout
├── matches/
│   ├── matches.js             # Fixture lists, date picker, live filtering
│   ├── match_detail.js        # Detailed match events, lineups, and stats
│   └── matches.css            # Matchday styles and responsive grids
├── standing/
│   ├── standing.js            # League table and stat leaderboards
│   └── standing.css           # Table layout and leaderboard styling
├── club/
│   ├── club.js                # League team list grid
│   └── club.css               # Club directory styles
├── club_detail/
│   ├── club_detail.js         # Squad roster, player profiles, club schedule
│   └── club_detail.css        # Roster tables and player card styles
└── highlight/
    ├── highlights.js          # YouTube highlight search and video cards
    └── highlight.css          # Video card layout and highlight embeds
```

---

## 🚀 Local Installation & Development

To test or develop Kuas locally in Google Chrome:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/Kuas.git
   cd Kuas
   ```

2. **Open Chrome Extensions:**
   Navigate to `chrome://extensions` in the Chrome URL bar.

3. **Enable Developer Mode:**
   Toggle the **Developer mode** switch in the top-right corner.

4. **Load Unpacked:**
   Click **Load unpacked** and select the `Kuas` root directory.

5. **Pin Kuas:**
   Click the puzzle piece icon in Chrome's toolbar and pin **Kuas** for one-click access.

---

## 📦 Packaging for Chrome Web Store

Before publishing to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), create a clean production ZIP archive that excludes Git files and local configuration:

### Windows (PowerShell)
```powershell
Compress-Archive -Path "api.js", "background.js", "common.css", "index.css", "index.html", "index.js", "manifest.json", "storage.js", "utils.js", "club", "club_detail", "components", "highlight", "icons", "league", "live", "matches", "standing", "README.md" -DestinationPath "Kuas-v1.0.0.zip" -Force
```

### macOS / Linux (Terminal)
```bash
zip -r Kuas-v1.0.0.zip . -x "*.git*" "package*.json" "node_modules/*"
```

---

## 📝 Chrome Web Store Listing & Privacy Details

Use these exact, vetted entries when submitting Kuas to the Chrome Web Store:

### 1. Single Purpose Description
> **Kuas is a football (soccer) matchday companion that allows fans to track real-time scores, league standings, club rosters, and curated match highlights across major football competitions from a single popup interface.**

### 2. Permission Justifications

- **`storage` (`chrome.storage.local`)**
  > The `storage` permission is required to locally cache sports API responses (standings, matches, and squad rosters) with expiration timestamps to reduce redundant network calls and enable instant popup rendering, as well as to remember the user's selected league and view preferences between sessions.

- **`alarms` (`chrome.alarms`)**
  > The `alarms` permission is used to periodically trigger a 10-minute background check to update the extension icon badge when a live football match is underway.

### 3. Host Permissions Justification

- **`https://sports.core.api.espn.com/*` & `https://site.api.espn.com/*`**
  > Required to fetch live scores, match event timelines, league standings, club schedules, and squad rosters.
- **`https://www.youtube.com/*`**
  > Required to search for and display official match highlight video summaries for completed games in the Highlights tab.
- **`https://www.thesportsdb.com/*`**
  > Required to fetch player portrait headshots to illustrate team rosters and top-scorer leaderboards.

### 4. Promotional Store Descriptions

**Standard Version (61 words):**
> Stay connected to world football with Kuas. Follow top leagues, check live scores, browse updated standings, and view upcoming match schedules in seconds. Explore detailed club profiles, full squad rosters, and relive the action with curated match highlights. Designed for speed, convenience, and passionate football fans — all right inside your Chrome browser. Your ultimate matchday companion is always one click away.

**Compact Version (45 words):**
> Follow your favorite football leagues effortlessly with Kuas. Get instant live scores, fixtures, updated standings, team rosters, and video highlights in one clean popup. Lightweight, fast, and designed for every football fan — keep up with matchday action directly from your Chrome toolbar.

---

## 🛠️ Tech Stack

- **Platform:** Google Chrome Extension (Manifest V3)
- **Runtime:** Vanilla JavaScript (ES6+ Modules)
- **Background Worker:** Service Worker with `chrome.alarms` and `chrome.action` badge API
- **Styling:** Custom Vanilla CSS with dark theme tokens and responsive layouts
- **Data Providers:** ESPN Public Soccer APIs, TheSportsDB API, and YouTube

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

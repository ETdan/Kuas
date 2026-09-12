/**
 * storage.js - Unified storage abstraction for the Kuas extension.
 *
 * Uses chrome.storage.local when running as a Chrome extension,
 * falling back to localStorage for development/testing in a plain browser.
 *
 * Exported as an ES module so every page imports it directly.
 */
export const Storage = {
  async get(key, defaultValue = null) {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] !== undefined ? result[key] : defaultValue);
        });
      });
    }
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : defaultValue;
    } catch (_e) {
      return localStorage.getItem(key) ?? defaultValue;
    }
  },

  async set(key, value) {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      });
    }
    try {
      localStorage.setItem(
        key,
        typeof value === "object" ? JSON.stringify(value) : value
      );
    } catch (_e) {}
  },

  async remove(key) {
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], () => resolve());
      });
    }
    try {
      localStorage.removeItem(key);
    } catch (_e) {}
  },

  /**
   * Scan storage and purge all items that have an expiresAt timestamp in the past.
   * @returns {Promise<number>} Count of purged entries.
   */
  async pruneExpired() {
    const now = Date.now();
    if (typeof chrome !== "undefined" && chrome?.storage?.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(null, (all) => {
          const expiredKeys = [];
          for (const [k, v] of Object.entries(all || {})) {
            if (v && typeof v === "object" && v.expiresAt && v.expiresAt < now) {
              expiredKeys.push(k);
            }
          }
          if (expiredKeys.length > 0) {
            chrome.storage.local.remove(expiredKeys, () => {
              console.debug(`[Storage] Pruned ${expiredKeys.length} expired cache entries.`);
              resolve(expiredKeys.length);
            });
          } else {
            resolve(0);
          }
        });
      });
    }
    try {
      const expired = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        try {
          const val = JSON.parse(localStorage.getItem(k));
          if (val && typeof val === "object" && val.expiresAt && val.expiresAt < now) {
            expired.push(k);
          }
        } catch (_e) {}
      }
      expired.forEach((k) => localStorage.removeItem(k));
      return expired.length;
    } catch (_e) {
      return 0;
    }
  },
};

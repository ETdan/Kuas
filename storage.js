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
};

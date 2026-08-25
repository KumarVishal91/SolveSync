/**
 * SolveSync — storage module
 * Thin wrapper around chrome.storage.local. Keep all key names here so
 * there's a single source of truth.
 */

const KEYS = {
  SETTINGS: "solvesync_settings",
  HISTORY: "solvesync_history",
};

const DEFAULT_SETTINGS = {
  githubToken: "",
  repoOwner: "",
  repoName: "",
  branch: "main",
  autoSync: true,
};

async function getSettings() {
  const result = await chrome.storage.local.get(KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...(result[KEYS.SETTINGS] || {}) };
}

async function saveSettings(settings) {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [KEYS.SETTINGS]: merged });
  return merged;
}

async function getHistory() {
  const result = await chrome.storage.local.get(KEYS.HISTORY);
  return result[KEYS.HISTORY] || [];
}

async function addHistoryEntry(entry) {
  const history = await getHistory();
  history.unshift({ ...entry, timestamp: new Date().toISOString() });
  // Keep the last 200 entries so storage doesn't grow unbounded.
  const trimmed = history.slice(0, 200);
  await chrome.storage.local.set({ [KEYS.HISTORY]: trimmed });
  return trimmed;
}

// Exposed as `SolveSyncStorage` on globalThis so both the background
// service worker and popup can import it via importScripts / <script>.
self.SolveSyncStorage = {
  getSettings,
  saveSettings,
  getHistory,
  addHistoryEntry,
};

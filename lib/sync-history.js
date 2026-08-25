/**
 * SolveSync — sync history log
 * Records every sync attempt (success / skipped / failed) so the popup
 * can render a "recent activity" list. Keeps only the most recent N
 * entries to avoid unbounded storage growth.
 */

const HISTORY_KEY = "solvesync_sync_history";
const MAX_HISTORY_ENTRIES = 100;

/**
 * @param {"success"|"skipped"|"failed"} status
 * @param {object} payload - the sync payload (problem slug, platform, etc.)
 * @param {string} [detail] - optional extra info (e.g. error message, or "unchanged")
 */
export async function logSyncEvent(status, payload, detail = "") {
  const history = await getHistory();

  history.unshift({
    id: crypto.randomUUID(),
    status,
    platform: payload?.platform || "unknown",
    problemSlug: payload?.problemSlug || payload?.slug || "unknown",
    problemTitle: payload?.problemTitle || payload?.title || "",
    detail,
    timestamp: Date.now(),
  });

  // Trim to max length
  const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);

  await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
}

export async function getHistory() {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] || [];
}

export async function clearHistory() {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}

/** Convenience: last N entries, most recent first (already stored that way). */
export async function getRecentHistory(limit = 20) {
  const history = await getHistory();
  return history.slice(0, limit);
}
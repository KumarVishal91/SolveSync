/**
 * SolveSync — retry queue for failed syncs
 * Classic-worker style (matches storage.js / github-api.js), loaded via
 * importScripts() in background.js. Exposes self.SolveSyncRetryQueue.
 */

(function () {
  const QUEUE_KEY = "solvesync_retry_queue";
  const MAX_RETRIES = 5;
  const BASE_DELAY_MS = 30_000; // 30s, 1m, 2m, 4m, 8m...
  const ALARM_NAME = "solvesync-retry";

  async function getQueue() {
    const result = await chrome.storage.local.get(QUEUE_KEY);
    return result[QUEUE_KEY] || [];
  }

  async function saveQueue(queue) {
    await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  }

  function scheduleAlarm() {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  }

  async function enqueueFailedSync(payload, error) {
    const queue = await getQueue();
    queue.push({
      id: crypto.randomUUID(),
      payload,
      attempts: 0,
      lastError: String(error?.message || error),
      nextAttemptAt: Date.now() + BASE_DELAY_MS,
      createdAt: Date.now(),
    });
    await saveQueue(queue);
    scheduleAlarm();
  }

  // syncFn is the same syncSolution() function background.js already uses
  // for a fresh submission — reused here so retry logic never drifts out
  // of sync with the real commit flow.
  async function processQueue(syncFn) {
    const queue = await getQueue();
    if (queue.length === 0) {
      chrome.alarms.clear(ALARM_NAME);
      return;
    }

    const now = Date.now();
    const remaining = [];

    for (const item of queue) {
      if (item.nextAttemptAt > now) {
        remaining.push(item);
        continue;
      }

      try {
        await syncFn(item.payload);
        // success — dropped from queue, syncFn already logs its own history entry
      } catch (err) {
        item.attempts += 1;
        item.lastError = String(err?.message || err);

        if (item.attempts >= MAX_RETRIES) {
          console.warn("[SolveSync] Giving up after max retries:", item);
          continue; // drop it — syncFn's own catch already logged a "failed" history entry
        }

        item.nextAttemptAt = now + BASE_DELAY_MS * 2 ** item.attempts;
        remaining.push(item);
      }
    }

    await saveQueue(remaining);
    if (remaining.length === 0) chrome.alarms.clear(ALARM_NAME);
  }

  async function getQueueSummary() {
    const queue = await getQueue();
    return queue.map((item) => ({
      id: item.id,
      attempts: item.attempts,
      lastError: item.lastError,
      nextAttemptAt: item.nextAttemptAt,
      createdAt: item.createdAt,
    }));
  }

  self.SolveSyncRetryQueue = {
    enqueueFailedSync,
    processQueue,
    getQueueSummary,
  };
})();
/**
 * SolveSync — background service worker
 * Receives parsed submission payloads from content scripts and drives
 * the actual GitHub commit flow. Kept as the single place that decides
 * *where* things go in the repo (folder structure) and *when* commits
 * happen.
 */

importScripts(
  "lib/storage.js",
  "lib/github-api.js",
  "lib/readme-generator.js",
  "lib/retry-queue.js"
);

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildFolderPath(payload) {
  // e.g. leetcode/easy/two-sum/
  const difficulty = (payload.difficulty || "unknown").toLowerCase();
  return `${payload.platform}/${difficulty}/${slugify(payload.title)}`;
}

async function syncSolution(payload) {
  const settings = await self.SolveSyncStorage.getSettings();

  if (!settings.githubToken || !settings.repoOwner || !settings.repoName) {
    notify("SolveSync not configured", "Add your GitHub token and repo in the popup first.");
    return;
  }

  const folderPath = buildFolderPath(payload);
  const solutionPath = `${folderPath}/solution.${payload.fileExt}`;
  const readmePath = `${folderPath}/README.md`;

  const commitOpts = {
    token: settings.githubToken,
    owner: settings.repoOwner,
    repo: settings.repoName,
    branch: settings.branch,
  };

  try {
    // --- Duplicate detection ---
    // If the exact same code is already committed, skip the API calls
    // entirely rather than creating a no-op commit.
    const existing = await self.SolveSyncGitHub.getExistingFile({
      ...commitOpts,
      path: solutionPath,
    });

    if (existing && existing.content.trim() === payload.code.trim()) {
      await self.SolveSyncStorage.addHistoryEntry({
        title: payload.title,
        difficulty: payload.difficulty,
        platform: payload.platform,
        folderPath,
        status: "skipped",
        note: "Identical solution already committed",
      });
      notify("Skipped", `${payload.title}: no changes since last sync`);
      return;
    }

    const commitMessage = existing
      ? `Update solution: ${payload.title} (${payload.platform})`
      : `Add solution: ${payload.title} (${payload.platform})`;

    await self.SolveSyncGitHub.createOrUpdateFile({
      ...commitOpts,
      path: solutionPath,
      content: payload.code,
      message: commitMessage,
    });

    const readmeContent = self.SolveSyncReadme.buildProblemReadme(payload);
    await self.SolveSyncGitHub.createOrUpdateFile({
      ...commitOpts,
      path: readmePath,
      content: readmeContent,
      message: `${existing ? "Update" : "Add"} README: ${payload.title}`,
    });

    const history = await self.SolveSyncStorage.addHistoryEntry({
      title: payload.title,
      difficulty: payload.difficulty,
      platform: payload.platform,
      folderPath,
      status: "success",
    });

    // --- Root README index ---
    // Rebuild the repo's top-level README from full sync history so it
    // always reflects everything that's been committed so far.
    const successfulEntries = history.filter((h) => h.status === "success");
    const rootReadme = self.SolveSyncReadme.buildRootReadme(successfulEntries);
    await self.SolveSyncGitHub.createOrUpdateFile({
      ...commitOpts,
      path: "README.md",
      content: rootReadme,
      message: "Update README index",
    });

    notify("Synced ✅", `${payload.title} pushed to ${settings.repoOwner}/${settings.repoName}`);
  } catch (err) {
    console.error("[SolveSync] Sync failed:", err);
    await self.SolveSyncStorage.addHistoryEntry({
      title: payload.title,
      difficulty: payload.difficulty,
      platform: payload.platform,
      folderPath,
      status: "failed",
      error: String(err),
    });

    // Queue for automatic retry instead of just giving up. processQueue()
    // will call syncSolution(payload) again later with backoff.
    await self.SolveSyncRetryQueue.enqueueFailedSync(payload, err);

    notify("Sync failed ❌", `${payload.title}: retrying automatically`);
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SOLVESYNC_SYNC_SOLUTION") {
    syncSolution(message.payload);
  }
  if (message.type === "SOLVESYNC_TEST_CONNECTION") {
    self.SolveSyncGitHub.verifyAccess(message.payload)
      .then((repo) => sendResponse({ ok: true, repo }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  }
});

// Retry queue: fires every minute (only while items are pending — the
// queue itself clears the alarm once empty).
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "solvesync-retry") {
    self.SolveSyncRetryQueue.processQueue(syncSolution);
  }
});
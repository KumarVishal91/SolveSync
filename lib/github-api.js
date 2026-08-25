/**
 * SolveSync — GitHub API module
 * Talks to the GitHub REST "Contents" API directly using a
 * Personal Access Token (classic or fine-grained, needs `repo` scope).
 * No backend involved for v0 — the token lives in chrome.storage.local.
 */

const API_BASE = "https://api.github.com";

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function toBase64(str) {
  // handles UTF-8 content, not just ASCII
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Returns the blob SHA of an existing file, or null if it doesn't exist yet.
 * GitHub's Contents API requires the current SHA to update a file
 * (this is how it prevents accidental overwrites).
 */
async function getExistingFileSha({ token, owner, repo, path, branch }) {
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${branch}`;

  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  return data.sha;
}

/**
 * Returns { sha, content } for an existing file, or null if it doesn't exist.
 * Used for duplicate detection — lets us diff before committing.
 */
async function getExistingFile({ token, owner, repo, path, branch }) {
  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
    path
  )}?ref=${branch}`;

  const res = await fetch(url, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
  return { sha: data.sha, content };
}

/**
 * Creates a new file or updates an existing one at `path`.
 */
async function createOrUpdateFile({ token, owner, repo, branch, path, content, message }) {
  const existingSha = await getExistingFileSha({ token, owner, repo, path, branch });

  const url = `${API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: toBase64(content),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`GitHub PUT failed for ${path}: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

/**
 * Verifies the token + repo combination works, without writing anything.
 * Used by the popup's "Test connection" button.
 */
async function verifyAccess({ token, owner, repo }) {
  const url = `${API_BASE}/repos/${owner}/${repo}`;
  const res = await fetch(url, { headers: authHeaders(token) });
  if (!res.ok) {
    throw new Error(`Repo access check failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

self.SolveSyncGitHub = { createOrUpdateFile, verifyAccess, getExistingFileSha, getExistingFile };

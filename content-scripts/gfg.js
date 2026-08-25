/**
 * SolveSync — GeeksforGeeks content script
 *
 * Unlike LeetCode, GFG doesn't expose a public GraphQL API for problem
 * metadata, so this reads title/difficulty/tags straight from the DOM.
 * ⚠️ VERIFY BEFORE RELYING ON THIS: open a GFG practice problem, inspect
 * the elements below in DevTools, and fix selectors if they've drifted —
 * this file was written without live access to GFG's current markup and
 * is a starting point, not a guarantee.
 */

const SUBMIT_RESULT_PATTERN = /\/practice-api\/.*\/submit/; // TODO: confirm real endpoint in Network tab

function injectPageHook() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content-scripts/page-hook-gfg.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function getProblemSlugFromUrl() {
  // e.g. https://www.geeksforgeeks.org/problems/two-sum/1
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

function getProblemMetadataFromDom() {
  // TODO: confirm these selectors against the live page — GFG's practice
  // portal markup changes without notice.
  const titleEl = document.querySelector("div.problems_header_content__title h3, h2.problem-tab");
  const difficultyEl = document.querySelector("[class*='difficulty']");
  const tagEls = document.querySelectorAll("[class*='problems_tag'], .tag-container a");

  return {
    title: titleEl ? titleEl.textContent.trim() : document.title.replace(/ \| .*/, ""),
    difficulty: difficultyEl ? difficultyEl.textContent.trim() : "Unknown",
    tags: Array.from(tagEls).map((t) => t.textContent.trim()).filter(Boolean),
  };
}

function getSelectedLanguage() {
  // TODO: confirm selector — GFG's language dropdown markup.
  const langEl = document.querySelector("#language, select[name='language']");
  return langEl ? langEl.value || langEl.textContent.trim() : "unknown";
}

window.addEventListener("message", (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.source !== "solvesync-page-hook-gfg") return;
  if (event.data.type !== "SUBMISSION_ACCEPTED") return;

  try {
    const slug = getProblemSlugFromUrl();
    if (!slug) return;

    const meta = getProblemMetadataFromDom();
    const language = getSelectedLanguage();
    const code = event.data.code || "";

    const payload = {
      platform: "gfg",
      problemId: slug,
      title: meta.title,
      slug,
      difficulty: meta.difficulty,
      tags: meta.tags,
      language,
      fileExt: solveSyncExtForLanguage(language),
      code,
      url: window.location.href,
      solvedAt: new Date().toISOString(),
    };

    chrome.runtime.sendMessage({ type: "SOLVESYNC_SYNC_SOLUTION", payload });
  } catch (err) {
    console.error("[SolveSync] Failed to build GFG submission payload:", err);
  }
});

injectPageHook();

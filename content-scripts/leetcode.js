/**
 * SolveSync — LeetCode content script
 *
 * Runs in the isolated world, so it can't see the page's `fetch` calls directly.
 * We inject a small script into the page context to intercept LeetCode's
 * "submit" and "check" network calls, then relay the result back here via
 * window.postMessage.
 *
 * NOTE: LeetCode's internal endpoints/DOM are not a stable public API.
 * If detection stops working, check devtools > Network while submitting
 * and update SUBMIT_CHECK_PATTERN below.
 */

const SUBMIT_CHECK_PATTERN = /\/submissions\/detail\/(\d+)\/check\//;

function injectPageHook() {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content-scripts/page-hook.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

function getProblemSlugFromUrl() {
  const match = window.location.pathname.match(/\/problems\/([^/]+)\//);
  return match ? match[1] : null;
}

async function fetchProblemMetadata(slug) {
  const query = {
    query: `
      query getQuestionDetail($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          title
          titleSlug
          difficulty
          topicTags { name }
          content
        }
      }
    `,
    variables: { titleSlug: slug },
  };

  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
    credentials: "include",
  });

  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);
  const data = await res.json();
  return data.data.question;
}

function getSelectedLanguage() {
  // The language selector's visible label. Selector is fragile — LeetCode
  // periodically restyles this dropdown, so verify against the live DOM.
  const langBtn = document.querySelector("[id^='headlessui-listbox-button']");
  return langBtn ? langBtn.textContent.trim() : "unknown";
}

window.addEventListener("message", async (event) => {
  if (event.source !== window || !event.data) return;
  if (event.data.source !== "solvesync-page-hook") return;
  if (event.data.type !== "SUBMISSION_ACCEPTED") return;

  try {
    const slug = getProblemSlugFromUrl();
    if (!slug) return;

    const [meta] = await Promise.all([fetchProblemMetadata(slug)]);
    const language = getSelectedLanguage();
    const code = event.data.code || "";

    const payload = {
      platform: "leetcode",
      problemId: meta.questionId,
      title: meta.title,
      slug: meta.titleSlug,
      difficulty: meta.difficulty,
      tags: meta.topicTags.map((t) => t.name),
      language,
      fileExt: solveSyncExtForLanguage(language),
      code,
      url: window.location.href,
      solvedAt: new Date().toISOString(),
    };

    chrome.runtime.sendMessage({ type: "SOLVESYNC_SYNC_SOLUTION", payload });
  } catch (err) {
    console.error("[SolveSync] Failed to build submission payload:", err);
  }
});

injectPageHook();

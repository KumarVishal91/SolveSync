/**
 * Runs in GFG's page context. Same pattern as page-hook.js for LeetCode:
 * patch fetch, watch for a successful submission, grab the editor's code.
 *
 * ⚠️ The SUBMIT_RESULT_PATTERN regex and getEditorCode() below are
 * unverified against GFG's live site — check Network/DevTools and adjust.
 */
(function () {
  const originalFetch = window.fetch;

  function getEditorCode() {
    // GFG's practice editor commonly uses CodeMirror. Adjust if they've
    // switched to Monaco or something else.
    try {
      const cmEl = document.querySelector(".CodeMirror");
      if (cmEl && cmEl.CodeMirror) return cmEl.CodeMirror.getValue();
    } catch (e) {
      /* fall through */
    }
    return "";
  }

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

    if (/submit/i.test(url)) {
      response
        .clone()
        .json()
        .then((data) => {
          // TODO: confirm the actual shape of GFG's submit response —
          // this checks a couple of plausible field names as a starting
          // guess.
          const accepted =
            data?.status === "Accepted" ||
            data?.result === "Correct Answer" ||
            data?.verdict === "AC";

          if (accepted) {
            window.postMessage(
              {
                source: "solvesync-page-hook-gfg",
                type: "SUBMISSION_ACCEPTED",
                code: getEditorCode(),
              },
              "*"
            );
          }
        })
        .catch(() => {});
    }

    return response;
  };
})();

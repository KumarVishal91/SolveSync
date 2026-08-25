/**
 * Runs in the PAGE's own JS context (injected by leetcode.js), so it can
 * see and patch window.fetch as LeetCode's React app uses it.
 */
(function () {
  const originalFetch = window.fetch;

  function getEditorCode() {
  // LeetCode uses Monaco with multiple editor instances mounted at once
  // (the real code editor + at least one hidden/unused one — confirmed
  // via live testing). The reliable signal is DOM visibility, not
  // array index, since index order isn't guaranteed.
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      const visibleEditor = editors.find((e) => {
        const node = e.getDomNode();
        return node && node.offsetParent !== null;
      });
      if (visibleEditor) return visibleEditor.getModel().getValue();

      // Fallback: if nothing reports visible (e.g. hook fires before
      // layout settles), just take the model with non-empty content.
      const models = window.monaco.editor.getModels();
      const nonEmpty = models.find((m) => m.getValue().trim().length > 0);
      if (nonEmpty) return nonEmpty.getValue();
    }
  } catch (e) {
    /* fall through */
  }
  return "";
}

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

    if (/\/submissions\/detail\/\d+\/check\//.test(url)) {
      response
        .clone()
        .json()
        .then((data) => {
          if (data && data.state === "SUCCESS" && data.status_msg === "Accepted") {
            window.postMessage(
              {
                source: "solvesync-page-hook",
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

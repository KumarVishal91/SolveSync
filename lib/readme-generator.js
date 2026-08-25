/**
 * SolveSync — README generator
 * Builds a per-problem README.md from solution metadata. Kept separate
 * from the GitHub module so the templating logic is easy to change
 * without touching API code.
 */

function difficultyBadge(difficulty) {
  const colors = { Easy: "brightgreen", Medium: "yellow", Hard: "red" };
  const color = colors[difficulty] || "lightgrey";
  return `![Difficulty](https://img.shields.io/badge/Difficulty-${difficulty}-${color})`;
}

function buildProblemReadme(payload) {
  const { title, difficulty, tags, url, platform, language, solvedAt } = payload;

  const tagList = (tags || []).map((t) => `\`${t}\``).join(" ");
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);

  return `# ${title}

${difficultyBadge(difficulty)} ![Platform](https://img.shields.io/badge/Platform-${platformLabel}-blue)

**Source:** [${platformLabel} problem link](${url})
**Language:** ${language}
**Solved:** ${new Date(solvedAt).toLocaleDateString()}

## Tags
${tagList || "_none_"}

## Notes
<!-- Add your approach, complexity analysis, or edge cases here. -->

---
_Auto-generated and committed by SolveSync._
`;
}

/**
 * Builds/updates the repo root README.md table of contents.
 * `entries` is the full sync history array from storage.
 */
function buildRootReadme(entries) {
  const rows = entries
    .map(
      (e) =>
        `| ${e.title} | ${e.difficulty} | ${e.platform} | [Solution](./${e.folderPath}) |`
    )
    .join("\n");

  return `# My Coding Solutions

Auto-synced by [SolveSync](https://github.com/) — a browser extension that
commits accepted solutions straight from the problem page.

| Problem | Difficulty | Platform | Link |
|---|---|---|---|
${rows}
`;
}

self.SolveSyncReadme = { buildProblemReadme, buildRootReadme };

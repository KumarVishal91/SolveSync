/**
 * SolveSync — shared language → file-extension map.
 * Loaded as a plain content-script file (not a module), so it just
 * attaches a global function both leetcode.js and gfg.js can call.
 */
function solveSyncExtForLanguage(lang) {
  const map = {
    python3: "py",
    python: "py",
    "python 3": "py",
    java: "java",
    "c++": "cpp",
    c: "c",
    javascript: "js",
    typescript: "ts",
    go: "go",
    golang: "go",
    rust: "rs",
    kotlin: "kt",
    swift: "swift",
    "c#": "cs",
  };
  return map[(lang || "").toLowerCase()] || "txt";
}

# SolveSync (v0.1 — LeetCode MVP)

A browser extension that detects your accepted LeetCode submissions and
automatically commits them into a structured GitHub repo, with an
auto-generated README per problem.

## How it works

```
LeetCode page
     ↓
content-scripts/leetcode.js  (isolated world)
     ↓ injects
content-scripts/page-hook.js (page world — hooks fetch, catches "Accepted")
     ↓ postMessage
content-scripts/leetcode.js  (fetches problem metadata via LeetCode GraphQL)
     ↓ chrome.runtime.sendMessage
background.js                (service worker — decides folder path)
     ↓
lib/github-api.js            (PUT to GitHub Contents API)
     ↓
your-repo/leetcode/<difficulty>/<problem-slug>/solution.<ext>
your-repo/leetcode/<difficulty>/<problem-slug>/README.md
```

No backend server in this version — the extension talks to GitHub's API
directly using a Personal Access Token stored in `chrome.storage.local`.

## File structure

```
solvesync/
├── manifest.json              Extension config (MV3)
├── background.js              Orchestrates the sync flow
├── content-scripts/
│   ├── leetcode.js             Isolated-world script: metadata + messaging
│   └── page-hook.js            Page-world script: intercepts fetch, reads editor
├── lib/
│   ├── github-api.js           GitHub Contents API calls
│   ├── readme-generator.js     Builds per-problem + root README.md
│   └── storage.js              chrome.storage.local wrapper
├── popup/
│   ├── popup.html              Settings UI
│   ├── popup.js
│   └── popup.css
└── icons/                      Placeholder icons — swap these out
```

## Setup

1. **Create a GitHub repo** you want solutions pushed to (can be empty).
2. **Create a Personal Access Token**: GitHub → Settings → Developer
   settings → Personal access tokens → generate one with `repo` scope
   (or, for fine-grained tokens, Contents: read/write on that one repo).
3. **Load the extension**:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" → select the `solvesync/` folder
4. **Open the extension popup** and fill in:
   - GitHub Token
   - Repo Owner (your username or org)
   - Repo Name
   - Branch (defaults to `main`)
5. Click **Test Connection** to confirm it can see the repo, then **Save**.
6. Go solve a problem on LeetCode. On an **Accepted** submission, SolveSync
   fetches the problem metadata, grabs your code from the editor, and
   commits both a solution file and a README to your repo.

## Known fragile points (read before debugging)

LeetCode's frontend isn't a public API — these are the spots most likely
to break when LeetCode ships a redesign:

- `getSelectedLanguage()` in `leetcode.js` — reads the language-picker
  button's text; the DOM selector may drift.
- `page-hook.js`'s `getEditorCode()` — assumes Monaco is on
  `window.monaco`. If LeetCode changes their editor setup this needs
  updating.
- The submission-check endpoint regex
  (`/submissions/detail/\d+/check/`) — check the Network tab if
  detection silently stops firing.

## Roadmap

1. ✅ LeetCode detection + GitHub commit
2. ✅ Duplicate detection — `background.js` now fetches the existing
   file via `getExistingFile()` and skips the commit (status: `skipped`)
   if the code is unchanged
3. ✅ Root README table-of-contents — rebuilt from sync history and
   committed to the repo root after every successful sync
4. 🚧 GeeksforGeeks support — `content-scripts/gfg.js` and
   `page-hook-gfg.js` are scaffolded but **unverified against the live
   site**. Every selector and endpoint pattern in those two files is
   marked with a `TODO` comment — open a GFG problem, use DevTools to
   confirm the real DOM structure and the submit endpoint's response
   shape, then fix the TODOs. Do this before trusting it to commit
   anything.
5. Sync history UI polish + retry-on-failure queue for failed commits
6. CodeChef support (same pattern as GFG: DOM-based, needs live
   verification)

## Adding a new platform (the pattern to follow)

Each platform needs three pieces, following what GFG's scaffold shows:

1. `content-scripts/<platform>.js` — isolated-world script: reads the
   problem slug from the URL, fetches/reads metadata (title, difficulty,
   tags), listens for the page-hook's `postMessage`, and sends the final
   payload via `chrome.runtime.sendMessage`.
2. `content-scripts/page-hook-<platform>.js` — page-world script:
   patches `fetch`, detects a successful submission response, extracts
   the code from whatever editor the platform uses.
3. Manifest updates: add the platform's origin to `host_permissions`,
   add a `content_scripts` entry matching its problem-page URL pattern,
   and list the new page-hook file under `web_accessible_resources`.

`background.js` and `lib/*` don't need platform-specific changes —
`buildFolderPath()` already namespaces by `payload.platform`.

## Security note

The GitHub token is stored unencrypted in `chrome.storage.local`. That's
fine for a personal-use MVP but isn't something you'd ship to other
users — a real "v2" would move auth to a small backend doing GitHub
OAuth, so users never handle a raw PAT.

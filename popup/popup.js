const fields = ["githubToken", "repoOwner", "repoName", "branch"];

function el(id) {
  return document.getElementById(id);
}

async function loadSettings() {
  const settings = await chrome.storage.local.get("solvesync_settings");
  const s = settings.solvesync_settings || {};
  fields.forEach((f) => {
    if (s[f]) el(f).value = s[f];
  });
  if (!el("branch").value) el("branch").value = "main";
}

async function saveSettings() {
  const payload = {};
  fields.forEach((f) => (payload[f] = el(f).value.trim()));

  const current = await chrome.storage.local.get("solvesync_settings");
  const merged = { ...(current.solvesync_settings || {}), ...payload };
  await chrome.storage.local.set({ solvesync_settings: merged });

  el("testResult").textContent = "Saved.";
  el("testResult").className = "ok";
}

async function testConnection() {
  el("testResult").textContent = "Testing...";
  el("testResult").className = "";

  const payload = {
    token: el("githubToken").value.trim(),
    owner: el("repoOwner").value.trim(),
    repo: el("repoName").value.trim(),
  };

  chrome.runtime.sendMessage(
    { type: "SOLVESYNC_TEST_CONNECTION", payload },
    (response) => {
      if (response && response.ok) {
        el("testResult").textContent = `Connected to ${response.repo.full_name} ✅`;
        el("testResult").className = "ok";
        el("status-dot").classList.add("connected");
      } else {
        el("testResult").textContent = `Failed: ${response?.error || "unknown error"}`;
        el("testResult").className = "error";
        el("status-dot").classList.remove("connected");
      }
    }
  );
}

async function renderHistory() {
  const data = await chrome.storage.local.get("solvesync_history");
  const history = data.solvesync_history || [];
  const list = el("historyList");

  if (history.length === 0) {
    list.innerHTML = '<li class="empty">No syncs yet.</li>';
    return;
  }

  const statusIcon = { success: "✅", skipped: "⏭️", failed: "❌" };

  list.innerHTML = history
    .slice(0, 15)
    .map(
      (h) => `
      <li class="${h.status}">
        <strong>${h.title}</strong>
        <span class="meta">${h.platform} · ${h.difficulty}</span>
        <span class="status">${statusIcon[h.status] || "?"}</span>
      </li>`
    )
    .join("");
}

el("saveBtn").addEventListener("click", saveSettings);
el("testBtn").addEventListener("click", testConnection);

loadSettings();
renderHistory();

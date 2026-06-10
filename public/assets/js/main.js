import {
  login,
  logout,
  sendCommand,
  confirmAction,
  sendRconCommand,
  loadBackups,
  getStatus,
  pollLogs,
  LOG_INTERVAL_MS,
  STATUS_INTERVAL_MS,
  isAuthed,
  loadInstances,
  setInstance,
  getCurrentInstance,
} from "./api.js";

import { showToast, showTab, setTheme, initTheme, loadTerminal } from "./ui.js";
import { updateAuthState, setLogView } from "./utils.js";

// ── Expose to HTML onclick handlers ───────────────────────────────────────
Object.assign(window, {
  showTab,
  setTheme,
  sendCommand,
  confirmAction,
  sendRconCommand,
  reloadAll,
  selectInstance,
});

// ── Login wrapper (populates instances after token is stored) ─────────────
window.handleLogin = async function () {
  try {
    await login();
    showToast("Login successful!");
    updateAuthState(true);
    await populateInstances();
    showTab("control");
  } catch (err) {
    showToast(err.message);
  }
};

// ── Logout wrapper (clears instance selection) ────────────────────────────
window.logout = async function () {
  await logout();
  setInstance(null);
  const sel = document.getElementById("instance-select");
  if (sel)
    sel.innerHTML =
      '<option value="" disabled selected>Select Instance</option>';
};

// ── Instance selection ─────────────────────────────────────────────────────

async function selectInstance(id) {
  setInstance(id);
  localStorage.setItem("pref-instance", id);

  // Reset terminal if it was open for a different instance
  setLogView(true);
  const toggle = document.getElementById("log-toggle-button");
  if (toggle) toggle.checked = false;

  await Promise.all([loadBackups(), getStatus(), pollLogs(false)]);
}

async function populateInstances() {
  const instances = await loadInstances();
  const select = document.getElementById("instance-select");
  if (!select) return;

  select.innerHTML = "";

  if (!instances.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.disabled = true;
    opt.textContent = "No instances configured";
    select.appendChild(opt);
    return;
  }

  for (const { id, instanceName } of instances) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = instanceName || id;
    select.appendChild(opt);
  }

  // Restore saved preference, or fall back to first instance
  const savedId = localStorage.getItem("pref-instance");
  const validId =
    instances.find((i) => i.id === savedId)?.id ?? instances[0].id;
  select.value = validId;
  await selectInstance(validId);
}

// ── Reload all ─────────────────────────────────────────────────────────────

async function reloadAll() {
  await Promise.all([loadBackups(), getStatus(), pollLogs(false)]);
  showToast("Reloaded!");
}

// ── Auto-scroll ────────────────────────────────────────────────────────────

function setupAutoScroll(logOutput, checkbox) {
  let auto = true;
  checkbox.addEventListener("change", (e) => {
    auto = e.target.checked;
  });
  logOutput.addEventListener("scroll", () => {
    const atBottom =
      logOutput.scrollHeight - logOutput.scrollTop <=
      logOutput.clientHeight + 10;
    checkbox.checked = atBottom;
    auto = atBottom;
  });
  return () => auto;
}

// ── Form handlers ──────────────────────────────────────────────────────────

function setupForms() {
  document
    .getElementById("backup-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = getCurrentInstance();
      if (!id) return showToast("Select an instance first.");
      const archive = document.getElementById("archive-option").checked;
      try {
        const token = localStorage.getItem("token");
        await fetch(`/instances/${id}/backup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ archive }),
        });
        showToast("Backup created!");
      } catch (err) {
        showToast("Error: " + err.message);
      }
    });

  document
    .getElementById("restore-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = getCurrentInstance();
      if (!id) return showToast("Select an instance first.");
      const file = document.getElementById("backup-select").value;
      if (!file) return showToast("Select a backup first.");
      if (!confirm("Restore this backup? The server will be stopped.")) return;
      const token = localStorage.getItem("token");
      try {
        await fetch(`/instances/${id}/restore`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ file }),
        });
        showToast("Backup restored!");
      } catch (err) {
        showToast("Error: " + err.message);
      }
    });

  document
    .getElementById("download-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = getCurrentInstance();
      if (!id) return showToast("Select an instance first.");
      const file = document.getElementById("download-file").value;
      if (!file) return showToast("Select a backup first.");
      const token = localStorage.getItem("token");

      const progressContainer = document.getElementById("download-status");
      const progressBar = document.getElementById("download-progress");
      const statusText = document.getElementById("download-text");

      try {
        const res = await fetch(
          `/instances/${id}/download?file=${encodeURIComponent(file)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error(res.statusText);

        const total = +res.headers.get("Content-Length") || 0;
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;

        progressContainer.style.display = "block";
        progressBar.value = 0;
        statusText.textContent = "Starting...";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (total) {
            const pct = (received / total) * 100;
            progressBar.value = pct;
            const mb = (n) => (n / 1048576).toFixed(1);
            statusText.textContent = `${mb(received)} / ${mb(total)} MB (${pct.toFixed(1)}%)`;
          }
        }

        const blob = new Blob(chunks);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.split("/").pop();
        a.click();
        URL.revokeObjectURL(a.href);

        statusText.textContent = "Complete!";
        setTimeout(() => {
          progressContainer.style.display = "none";
        }, 2000);
        showToast("Download complete!");
      } catch (err) {
        showToast("Download failed: " + err.message);
        statusText.textContent = "Failed.";
      }
    });
}

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();

  const logOutput = document.getElementById("log-output");
  const scrollCheckbox = document.getElementById("auto-scroll-checkbox");
  const getAutoScroll = setupAutoScroll(logOutput, scrollCheckbox);

  const authed = await isAuthed();
  updateAuthState(authed);

  if (authed) {
    await populateInstances();
    showTab("control");
  }

  document
    .getElementById("log-toggle-button")
    .addEventListener("change", (e) => {
      if (e.target.checked) {
        loadTerminal(getCurrentInstance());
      } else {
        setLogView(true);
      }
    });

  document
    .getElementById("log-length")
    .addEventListener("change", () => pollLogs(getAutoScroll()));

  setupForms();

  // Non-overlapping polling loops
  (async function logLoop() {
    try {
      await pollLogs(getAutoScroll());
    } catch {
      /* */
    }
    setTimeout(logLoop, LOG_INTERVAL_MS);
  })();

  (async function statusLoop() {
    try {
      await getStatus();
    } catch {
      /* */
    }
    setTimeout(statusLoop, STATUS_INTERVAL_MS);
  })();
});

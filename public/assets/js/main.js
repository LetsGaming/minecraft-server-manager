import {
  login,
  logout,
  sendCommand,
  loadBackups,
  getStatus,
  pollLogs,
  LOG_POLL_INTERVAL_MS,
  STATUS_UPDATE_INTERVAL_MS,
  isAuthed,
} from "./api.js";

import { showToast, showTab, setTheme, initTheme } from "./ui.js";

import {
  updateLoginView,
  updateLogToggleView,
  updateLogsView,
} from "./utils.js";

window.HIDE_LOGS = false;

// Public window-bound methods
Object.assign(window, {
  showTab,
  reloadAll,
  sendCommand,
  login,
  logout,
  setTheme,
});

async function reloadAll() {
  await loadBackups();
  await getStatus();
  await pollLogs();
  showToast("Reloaded!");
}

function setupAutoScroll(logOutput, checkbox) {
  let autoScroll = true;

  checkbox.addEventListener("change", (e) => {
    autoScroll = e.target.checked;
  });

  logOutput.addEventListener("scroll", () => {
    const atBottom =
      logOutput.scrollHeight - logOutput.scrollTop <=
      logOutput.clientHeight + 10;
    checkbox.checked = atBottom;
    autoScroll = atBottom;
  });

  return () => autoScroll; // return function to access current state
}

async function setupUi() {
  initTheme();
  
  const authed = await isAuthed();
  updateLogToggleView(authed); // Hide log toggle at startup
  // Hide login-required elements at startup
  await updateLoginView(authed);
}

function setuplogToggle() {
  const logToggleButton = document.getElementById("log-toggle-button");

  logToggleButton.addEventListener("click", (e) => {
    const showTerminal = e.target.checked;
    updateLogsView(!showTerminal, false);
  });
}

function setupFormHandlers() {
  document
    .getElementById("backup-form")
    .addEventListener("submit", handleBackup);
  document
    .getElementById("restore-form")
    .addEventListener("submit", handleRestore);
  document
    .getElementById("download-form")
    .addEventListener("submit", handleDownload);
}

async function handleBackup(e) {
  e.preventDefault();
  const token = localStorage.getItem("token");
  const archive = document.getElementById("archive-option").checked;
  try {
    await fetch("/backup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ archive }),
    });
    showToast("Backup created successfully!");
  } catch (err) {
    showToast("Error: " + err);
  }
}

async function handleRestore(e) {
  e.preventDefault();
  const file = document.getElementById("backup-select").value;
  if (!file) return showToast("Please select a backup file to restore.");
  const token = localStorage.getItem("token");
  try {
    await fetch("/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ file }),
    });
    showToast("Backup restored successfully!");
  } catch (err) {
    showToast("Error: " + err);
  }
}

async function handleDownload(e) {
  e.preventDefault();
  const file = document.getElementById("download-file").value;
  if (!file) return showToast("Please select a backup file to download.");
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`/download?file=${encodeURIComponent(file)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error("Download failed: " + res.statusText);

    const contentLength = +res.headers.get("Content-Length") || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;

    // Elements
    const progressContainer = document.getElementById("download-status");
    const progressBar = document.getElementById("download-progress");
    const statusText = document.getElementById("download-text");

    if (progressContainer && progressBar && statusText) {
      progressContainer.style.display = "block";
      progressBar.value = 0;
      statusText.textContent = "Starting download...";
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;

      if (contentLength && progressBar) {
        const percent = (received / contentLength) * 100;
        progressBar.value = percent;

        // Force browser to render progress immediately
        requestAnimationFrame(() => {
          progressBar.value = percent;
        });
      }

      if (statusText) {
        const mb = (n) => (n / 1024 / 1024).toFixed(1);
        statusText.textContent = contentLength
          ? `Downloaded ${mb(received)} MB of ${mb(contentLength)} MB (${(
              (received / contentLength) *
              100
            ).toFixed(1)}%)`
          : `Downloaded ${mb(received)} MB`;
      }
    }

    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (statusText) statusText.textContent = "Download complete!";
    setTimeout(() => {
      if (progressContainer) progressContainer.style.display = "none";
    }, 2000);

    showToast("Download complete!");
  } catch (err) {
    console.error(err);
    showToast("Error: " + err.message);
    const statusText = document.getElementById("download-text");
    if (statusText) statusText.textContent = "Download failed.";
  }
}

async function initializeApp() {
  const logOutput = document.getElementById("log-output");
  const autoScrollCheckbox = document.getElementById("auto-scroll-checkbox");

  const getAutoScroll = setupAutoScroll(logOutput, autoScrollCheckbox);

  setupUi();
  setuplogToggle();

  await loadBackups();
  await getStatus();
  await pollLogs(getAutoScroll());

  // Start polling logs without overlapping
  (function startPollingLogs() {
    async function pollLoop() {
      try {
        await pollLogs(getAutoScroll());
      } catch (err) {
        console.error("Error polling logs:", err);
      } finally {
        setTimeout(pollLoop, LOG_POLL_INTERVAL_MS);
      }
    }
    pollLoop();
  })();

  // Start status updates without overlapping
  (function startStatusUpdates() {
    async function statusLoop() {
      try {
        await getStatus();
      } catch (err) {
        console.error("Error fetching status:", err);
      } finally {
        setTimeout(statusLoop, STATUS_UPDATE_INTERVAL_MS);
      }
    }
    statusLoop();
  })();

  setupFormHandlers();
  document
    .getElementById("log-length")
    .addEventListener("change", async (e) => {
      const logLength = e.target.value;
      if (logLength) {
        await pollLogs(getAutoScroll());
      }
    });
}

document.addEventListener("DOMContentLoaded", initializeApp);

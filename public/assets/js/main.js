import {
  isTokenSet,
  login,
  logout,
  sendCommand,
  loadBackups,
  getStatus,
  pollLogs,
  LOG_POLL_INTERVAL_MS,
  STATUS_UPDATE_INTERVAL_MS,
} from "./api.js";

import { showToast, showTab } from "./ui.js";

global.HIDE_LOGS = false;

// Public window-bound methods
Object.assign(window, {
  showTab,
  reloadAll,
  sendCommand,
  login,
  logout,
});

function reloadAll() {
  loadBackups();
  getStatus();
  pollLogs();
  showToast("Reloaded!");
}

function toggleLoginUi() {
  const loggedIn = isTokenSet();
  document.getElementById("logout-button").style.display = loggedIn
    ? "block"
    : "none";
  document.getElementById("login-tab-button").style.display = loggedIn
    ? "none"
    : "block";
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

function setupLogToggle() {
  const logToggleButton = document.getElementById("log-toggle-button");
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");

  logToggleButton.addEventListener("click", () => {
    const isHidden = logOutput.style.display === "none";
    logOutput.style.display = isHidden ? "block" : "none";
    logControls.forEach(
      (el) => (el.style.display = isHidden ? "block" : "none")
    );
    logToggleButton.textContent = isHidden ? "Hide Logs" : "Show Logs";
    global.HIDE_LOGS = !isHidden;
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
  const archive = document.getElementById("archive-option").checked;
  try {
    await fetch("/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  try {
    await fetch("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  try {
    const res = await fetch(`/download?file=${file}`);
    if (!res.ok) throw new Error("Error downloading file: " + res.statusText);
    const blob = await res.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast("Error: " + err);
  }
}

function initializeApp() {
  const logOutput = document.getElementById("log-output");
  const autoScrollCheckbox = document.getElementById("auto-scroll-checkbox");
  const getAutoScroll = setupAutoScroll(logOutput, autoScrollCheckbox);
  setupLogToggle();

  loadBackups();
  getStatus();
  pollLogs(getAutoScroll());

  setInterval(() => pollLogs(getAutoScroll()), LOG_POLL_INTERVAL_MS);
  setInterval(getStatus, STATUS_UPDATE_INTERVAL_MS);

  toggleLoginUi();
  setupFormHandlers();
}

document.addEventListener("DOMContentLoaded", initializeApp);

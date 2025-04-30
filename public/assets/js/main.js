import {
  sendCommand,
  loadBackups,
  getStatus,
  pollLogs,
  LOG_POLL_INTERVAL_MS,
  STATUS_UPDATE_INTERVAL_MS,
} from "./api.js";
import { showToast, showTab } from "./ui.js";

function reloadAll() {
  loadBackups();
  getStatus();
  pollLogs();
  showToast("Reloaded!");
}

window.showTab = showTab;
window.reloadAll = reloadAll;
window.sendCommand = sendCommand;

document.addEventListener("DOMContentLoaded", () => {
  const logOutput = document.getElementById("log-output");
  const autoScrollCheckbox = document.getElementById("auto-scroll-checkbox");

  let autoScroll = true;

  // Setup auto-scroll behavior
  autoScrollCheckbox.addEventListener("change", (e) => {
    autoScroll = e.target.checked;
  });

  logOutput.addEventListener("scroll", () => {
    const atBottom =
      logOutput.scrollHeight - logOutput.scrollTop <=
      logOutput.clientHeight + 10;
    autoScrollCheckbox.checked = atBottom;
    autoScroll = atBottom;
  });

  // Polling and loading
  loadBackups();
  getStatus();
  pollLogs(autoScroll);

  setInterval(() => pollLogs(autoScroll), LOG_POLL_INTERVAL_MS);
  setInterval(getStatus, STATUS_UPDATE_INTERVAL_MS);

  // Form submissions
  document.getElementById("backup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const archive = document.getElementById("archive-option").checked;
    fetch("/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive }),
    })
      .then((r) => r.json())
      .then(() => showToast("Backup created successfully!"))
      .catch((err) => showToast("Error: " + err));
  });

  document.getElementById("restore-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const file = document.getElementById("backup-select").value;
    if (!file) return showToast("Please select a backup file to restore.");
    fetch("/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    })
      .then((r) => r.json())
      .then(() => showToast("Backup restored successfully!"))
      .catch((err) => showToast("Error: " + err));
  });

  document.getElementById("download-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const file = document.getElementById("download-file").value;
    if (!file) return showToast("Please select a backup file to download.");

    fetch(`/download?file=${file}`)
      .then((r) => {
        if (!r.ok) throw new Error("Error downloading file: " + r.statusText);
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => showToast(err));
  });
});

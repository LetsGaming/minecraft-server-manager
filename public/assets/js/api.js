import { showToast } from "./ui.js";

export const STATUS_UPDATE_INTERVAL_S = 120;
export const STATUS_UPDATE_INTERVAL_MS = STATUS_UPDATE_INTERVAL_S * 1000;
export const LOG_POLL_INTERVAL_S = 15;
export const LOG_POLL_INTERVAL_MS = LOG_POLL_INTERVAL_S * 1000;

export function fetchWithErrorHandling(url, options = {}) {
  return fetch(url, options)
    .then((response) => {
      if (response.ok) return response.json();
      return Promise.reject("Error: " + response.statusText);
    })
    .catch((err) => showToast(err));
}

export function sendCommand(command) {
  fetchWithErrorHandling(`/${command}`, { method: "POST" }).then(() => {});
}

export function pollLogs(autoScroll) {
  const logLength = document.getElementById("log-length").value;
  const logOutput = document.getElementById("log-output");
  fetch(`/log?length=${logLength}`)
    .then((r) => r.text())
    .then((data) => {
      logOutput.textContent = data;
      if (autoScroll) logOutput.scrollTop = logOutput.scrollHeight;
    })
    .catch((err) => console.error("Failed to fetch logs:", err));
}

export function getStatus() {
  fetch("/status")
    .then((r) => r.json())
    .then((status) => {
      if (status.error)
        return console.error("Error fetching status:", status.error);
      document.getElementById("status").textContent =
        status.output || "Status: Unknown";
    })
    .catch((err) => console.error("Failed to fetch status:", err));
}

export function loadBackups() {
  fetchWithErrorHandling("/list-backups").then((backups) => {
    if (!Array.isArray(backups)) return console.info("Unexpected format");

    const restoreSelect = document.getElementById("backup-select");
    const downloadSelect = document.getElementById("download-file");
    restoreSelect.innerHTML = downloadSelect.innerHTML =
      '<option value="" disabled selected>Choose Backup</option>';

    backups.forEach(({ path, name }) => {
      [restoreSelect, downloadSelect].forEach((select) => {
        const option = document.createElement("option");
        option.value = path;
        option.textContent = name;
        select.appendChild(option);
      });
    });
  });
}

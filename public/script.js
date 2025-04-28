const STATUS_UPDATE_INTERVAL_S = 120;
const STATUS_UPDATE_INTERVAL_MS = STATUS_UPDATE_INTERVAL_S * 1000;
const LOG_POLL_INTERVAL_S = 15;
const LOG_POLL_INTERVAL_MS = LOG_POLL_INTERVAL_S * 1000;

document.addEventListener("DOMContentLoaded", () => {
  pollLogs();
  getStatus();
  loadBackups();

  setInterval(pollLogs, LOG_POLL_INTERVAL_MS);
  setInterval(getStatus, STATUS_UPDATE_INTERVAL_MS);
});

let autoScroll = true;

const toastQueue = [];
let isToastVisible = false;

function fetchWithErrorHandling(url, options = {}) {
  return fetch(url, options)
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        return Promise.reject("Error: " + response.statusText);
      }
    })
    .then((data) => {
      console.log("Response Data:", data);
      return data;
    })
    .catch((err) => showToast(err));
}

function showToast(message) {
  toastQueue.push(message);
  if (!isToastVisible) {
    displayNextToast();
  }
}

function displayNextToast() {
  if (toastQueue.length === 0) {
    isToastVisible = false;
    return;
  }

  isToastVisible = true;

  const message = toastQueue.shift();
  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
      displayNextToast();
    }, 500);
  }, 3000);
}

function showTab(tabId) {
  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => tab.classList.remove("active"));

  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((button) => button.classList.remove("active"));

  const activeTab = document.getElementById(tabId);
  activeTab.classList.add("active");

  const activeButton = document.querySelector(
    `.tab-button[onclick="showTab('${tabId}')"]`
  );
  activeButton.classList.add("active");
}

function sendCommand(command) {
  fetchWithErrorHandling(`/${command}`, { method: "POST" }).then(() => {});
}

const logOutput = document.getElementById("log-output");
const autoScrollCheckbox = document.getElementById("auto-scroll-checkbox");

autoScrollCheckbox.addEventListener("change", (e) => {
  autoScroll = e.target.checked;
});

logOutput.addEventListener("scroll", () => {
  const atBottom =
    logOutput.scrollHeight - logOutput.scrollTop <= logOutput.clientHeight + 10;
  autoScrollCheckbox.checked = atBottom;
  autoScroll = atBottom;
});

function pollLogs() {
  fetch("/log")
    .then((response) => response.text())
    .then((data) => {
      logOutput.textContent = data;
      if (autoScroll) {
        logOutput.scrollTop = logOutput.scrollHeight;
      }
    })
    .catch((err) => console.error("Failed to fetch logs:", err));
}

function getStatus() {
  fetch("/status")
    .then((response) => response.json())
    .then((status) => {
      if (status.error) {
        console.error("Error fetching status:", status.error);
        return;
      }
      const statusDiv = document.getElementById("status");
      statusDiv.textContent = `${status.output || "Status: Unknown"}`;
    })
    .catch((err) => console.error("Failed to fetch status:", err));
}

function loadBackups() {
  fetchWithErrorHandling("/list-backups")
    .then((backups) => {
      if (Array.isArray(backups)) {
        const restoreSelect = document.getElementById("backup-select");
        const downloadSelect = document.getElementById("download-file");

        restoreSelect.innerHTML =
          '<option value="" disabled selected>Choose Backup</option>';
        downloadSelect.innerHTML =
          '<option value="" disabled selected>Choose Backup</option>';

        backups.forEach((backup) => {
          const option = document.createElement("option");
          option.value = backup.name;
          option.textContent = backup.name;
          restoreSelect.appendChild(option);

          const downloadOption = document.createElement("option");
          downloadOption.value = backup.name;
          downloadOption.textContent = backup.name;
          downloadSelect.appendChild(downloadOption);
        });
      } else {
        console.info("Received unexpected response format for backups.");
      }
    })
    .catch((err) => showToast("Error loading backups: " + err));
}

// Reload button functionality
function reloadAll() {
  pollLogs();
  getStatus();
  loadBackups();
  showToast("Reloaded!");
}

document.getElementById("backup-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const archive = document.getElementById("archive-option").checked;
  fetch("/backup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archive }),
  })
    .then((response) => response.json())
    .then(() => showToast("Backup created successfully!"))
    .catch((err) => showToast("Error: " + err));
});

document.getElementById("restore-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const file = document.getElementById("backup-select").value;
  if (!file) {
    showToast("Please select a backup file to restore.");
    return;
  }
  fetch("/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file }),
  })
    .then((response) => response.json())
    .then(() => showToast("Backup restored successfully!"))
    .catch((err) => showToast("Error: " + err));
});

document.getElementById("download-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const file = document.getElementById("download-file").value;
  if (!file) {
    showToast("Please select a backup file to download.");
    return;
  }

  fetch(`/download?file=${file}`)
    .then((response) => {
      if (response.ok) {
        return response.blob();
      } else {
        throw new Error("Error downloading file: " + response.statusText);
      }
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch((err) => showToast(err));
});

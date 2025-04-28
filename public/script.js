// Constants
const STATUS_UPDATE_INTERVAL_S = 120; // seconds
const STATUS_UPDATE_INTERVAL_MS = STATUS_UPDATE_INTERVAL_S * 1000;

const LOG_POLL_INTERVAL_S = 15; // seconds
const LOG_POLL_INTERVAL_MS = LOG_POLL_INTERVAL_S * 1000;

document.addEventListener("DOMContentLoaded", () => {
  // Fetch logs immediately when the page loads
  pollLogs();

  // Fetch the server status immediately when the page loads
  getStatus();

  // Load backups when the page loads
  loadBackups();

  // Start the polling intervals
  setInterval(pollLogs, LOG_POLL_INTERVAL_MS); // Poll logs every 15 seconds
  setInterval(getStatus, STATUS_UPDATE_INTERVAL_MS); // Update status every 120 seconds
});

let autoScroll = true;

// Toast queue to manage the order of toast messages
const toastQueue = [];
let isToastVisible = false; // Track if a toast is currently visible

// Utility function to handle fetch requests with error handling
function fetchWithErrorHandling(url, options = {}) {
  return fetch(url, options)
    .then((response) => {
      if (response.ok) {
        return response.json(); // Parse JSON response
      } else {
        return Promise.reject("Error: " + response.statusText);
      }
    })
    .then((data) => {
      console.log("Response Data:", data); // Log the JSON response data
      return data;
    })
    .catch((err) => showToast(err)); // Use showToast instead of alert
}

// Toast functionality with queue management
function showToast(message) {
  // Add the message to the queue
  toastQueue.push(message);

  // If a toast isn't currently visible, show the next one
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

  const message = toastQueue.shift(); // Get the next message from the queue
  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.textContent = message;

  // Append toast to the body
  document.body.appendChild(toast);

  // Show the toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Remove the toast after 3 seconds and display the next one in the queue
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
      displayNextToast(); // Show the next toast after the current one disappears
    }, 500); // Wait for the fade-out transition to finish
  }, 3000); // Wait for the toast to display for 3 seconds
}

// Tab switching functionality
function showTab(tabId) {
  // Hide all tabs and remove 'active' class
  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => tab.classList.remove("active"));

  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((button) => button.classList.remove("active"));

  // Show selected tab and activate its button
  const activeTab = document.getElementById(tabId);
  activeTab.classList.add("active");

  const activeButton = document.querySelector(
    `.tab-button[onclick="showTab('${tabId}')"]`
  );
  activeButton.classList.add("active");
}

// Command sending functionality
function sendCommand(command) {
  fetchWithErrorHandling(`/${command}`, { method: "POST" }).then(() => {});
}

// Log auto-scroll behavior
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

// Poll logs periodically
function pollLogs() {
  fetch("/log")
    .then((response) => response.text())
    .then((data) => {
      logOutput.textContent = data; // Update log output with new data
      if (autoScroll) {
        logOutput.scrollTop = logOutput.scrollHeight; // Scroll to the bottom if auto-scroll is enabled
      }
    })
    .catch((err) => console.error("Failed to fetch logs:", err));
}

// Status update
function getStatus() {
  fetch("/status")
    .then((response) => response.json())
    .then((status) => {
      if (status.error) {
        console.error("Error fetching status:", status.error);
        return;
      }
      // Update status display
      const statusDiv = document.getElementById("status");
      statusDiv.textContent = `Status: ${status.output || "Unknown"}`;
    })
    .catch((err) => console.error("Failed to fetch status:", err));
}

// Populate backup options
function loadBackups() {
  fetchWithErrorHandling("/list-backups")
    .then((backups) => {
      if (Array.isArray(backups)) {
        const restoreSelect = document.getElementById("backup-select");
        const downloadSelect = document.getElementById("download-file");

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

// Restore form submission
document.getElementById("restore-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const file = document.getElementById("backup-select").value;

  if (!file || file === "") {
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
  if (!file || file === "") {
    showToast("Please select a backup file to download.");
    return;
  }

  fetch(`/download?file=${file}`)
    .then((response) => {
      if (response.ok) {
        return response.blob(); // Return the response as a blob
      } else {
        throw new Error("Error downloading file: " + response.statusText);
      }
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob); // Create a URL for the blob
      const a = document.createElement("a");
      a.href = url;
      a.download = file; // Set the filename for download
      document.body.appendChild(a);
      a.click(); // Trigger the download
      a.remove(); // Clean up the link element
      window.URL.revokeObjectURL(url); // Release the object URL
    })
    .catch((err) => showToast(err));
});

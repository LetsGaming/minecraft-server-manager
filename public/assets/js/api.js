import { showTab, showToast } from "./ui.js";
import { updateLogsView } from "./utils.js";

export const STATUS_UPDATE_INTERVAL_S = 120;
export const STATUS_UPDATE_INTERVAL_MS = STATUS_UPDATE_INTERVAL_S * 1000;
export const LOG_POLL_INTERVAL_S = 15;
export const LOG_POLL_INTERVAL_MS = LOG_POLL_INTERVAL_S * 1000;

const hideLogs = globalThis.HIDE_LOGS || false;

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
  if (hideLogs) return;
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

export function isTokenSet() {
  const token = localStorage.getItem("token");
  if (!token) {
    return false;
  }
  return true;
}

export async function isAuthed() {
  const token = localStorage.getItem("token");
  if (!token) return false;

  try {
    const res = await fetch("/isAuthenticated", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error(err);
    localStorage.removeItem("token");
    showToast("Session expired. Please log in again.");
    showTab("login");
    return false;
  }
}

export function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((res) => {
      if (res.status === 200) {
        const token = res
          .json()
          .then((data) => data.token)
          .then((token) => {
            localStorage.setItem("token", token);
            showToast("Login successful!");
          })
          .then(() => {
            showTab("control");
            document.getElementById("logout-button").style.display = "block";
            document.getElementById("login-tab-button").style.display = "none";
            updateLogsView(true);
          });
        return token;
      }
      throw new Error("Login failed");
    })
    .catch((err) => showToast(err.message));
}

export function logout() {
  fetch("/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  })
    .then((res) => {
      if (res.status === 201) {
        localStorage.removeItem("token");
        window.location.href = "/";
        updateLogsView(false);
      } else {
        throw new Error("Logout failed");
      }
    })
    .catch((err) => showToast(err.message));
}

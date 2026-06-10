import { showTab, showToast } from "./ui.js";
import { updateAuthState } from "./utils.js";

export const STATUS_INTERVAL_MS = 30000;
export const LOG_INTERVAL_MS = 10000;

// ── Current instance ───────────────────────────────────────────────────────

let _currentInstanceId = null;

export function setInstance(id) {
  _currentInstanceId = id;
}
export function getCurrentInstance() {
  return _currentInstanceId;
}

/** Returns the /instances/:id prefix, throws if no instance is selected. */
function iPath(suffix = "") {
  if (!_currentInstanceId) throw new Error("No instance selected");
  return `/instances/${_currentInstanceId}${suffix}`;
}

// ── Fetch wrapper ──────────────────────────────────────────────────────────

export function apiFetch(url, options = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(url, { ...options, headers }).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem("token");
      updateAuthState(false);
      showTab("login");
      throw new Error("Session expired");
    }
    return res;
  });
}

// ── Instance list ──────────────────────────────────────────────────────────

export async function loadInstances() {
  try {
    const res = await fetch("/instances");
    const data = await res.json();
    return data.instances || [];
  } catch {
    return [];
  }
}

// ── Server commands ────────────────────────────────────────────────────────

export async function sendCommand(command) {
  try {
    const res = await apiFetch(iPath(`/${command}`), {
      method: "POST",
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast(`"${command}" executed.`);
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

export async function confirmAction(command) {
  if (!confirm(`Are you sure you want to ${command}? This cannot be undone.`))
    return;
  await sendCommand(command);
}

export async function sendRconCommand() {
  const input = document.getElementById("rcon-command");
  const output = document.getElementById("rcon-response");
  const cmd = input.value.trim();
  if (!cmd) return;

  try {
    const res = await apiFetch(iPath("/command"), {
      method: "POST",
      body: JSON.stringify({ command: cmd }),
    });
    const data = await res.json();
    output.textContent = data.output || data.error || "No response.";
    input.value = "";
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
  }
}

// ── Status & Logs ──────────────────────────────────────────────────────────

export async function getStatus() {
  const statusEl = document.getElementById("status");
  if (!_currentInstanceId) {
    statusEl.textContent = "Select an instance above";
    return;
  }
  try {
    const res = await fetch(iPath("/status"));
    const data = await res.json();
    statusEl.textContent = data.output || "Status: Unknown";
  } catch {
    statusEl.textContent = "Status: Connection Error";
  }
}

export async function pollLogs(autoScroll) {
  if (!_currentInstanceId) return;
  const logLength = document.getElementById("log-length")?.value || 100;
  const logOutput = document.getElementById("log-output");
  try {
    const res = await fetch(iPath(`/log?length=${logLength}`));
    const text = await res.text();
    logOutput.textContent = text;
    if (autoScroll) logOutput.scrollTop = logOutput.scrollHeight;
  } catch {
    /* silent */
  }
}

export async function loadBackups() {
  if (!_currentInstanceId) return;
  try {
    const res = await apiFetch(iPath("/list-backups"));
    const backups = await res.json();
    if (!Array.isArray(backups)) return;

    const restoreSelect = document.getElementById("backup-select");
    const downloadSelect = document.getElementById("download-file");
    const defaultOpt =
      '<option value="" disabled selected>Choose Backup</option>';
    restoreSelect.innerHTML = defaultOpt;
    downloadSelect.innerHTML = defaultOpt;

    for (const backup of backups) {
      const makeOpt = (sel) => {
        const o = document.createElement("option");
        o.value = backup.path;
        o.textContent = backup.path;
        sel.appendChild(o);
      };
      makeOpt(restoreSelect);
      makeOpt(downloadSelect);
    }
  } catch {
    /* silent on load */
  }
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function isAuthed() {
  const token = localStorage.getItem("token");
  if (!token) return false;
  try {
    const res = await fetch("/isAuthenticated", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Authenticate and return true on success.
 * UI side-effects (toast, tab switch) are handled by main.js's handleLogin wrapper.
 */
export async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const { token } = await res.json();
  localStorage.setItem("token", token);
  return true;
}

export async function logout() {
  const token = localStorage.getItem("token");
  await fetch("/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
  localStorage.removeItem("token");
  updateAuthState(false);
  showTab("login");
  showToast("Logged out.");
}

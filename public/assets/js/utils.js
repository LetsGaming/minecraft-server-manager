import { isAuthed } from "./api.js";

export function isTokenSet() {
  const token = localStorage.getItem("token");
  if (!token) {
    return false;
  }
  return true;
}

export function updateLogsView(showLogs) {
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");
  const terminalContainer = document.getElementById("terminal-container");

  const shouldShowLogs = !!showLogs; // Normalize to boolean
  window.HIDE_LOGS = !shouldShowLogs;
  // Toggle log output and terminal
  if (logOutput) logOutput.style.display = shouldShowLogs ? "block" : "none";
  if (terminalContainer)
    terminalContainer.style.display = shouldShowLogs ? "none" : "block";
  // Toggle additional log controls
  logControls.forEach((el) => {
    if (el) el.style.display = shouldShowLogs ? "block" : "none";
  });
}

export function updateLogToggleView(show) {
  const logToggleButton = document.getElementById("log-toggle-container");
  logToggleButton.style.display = show ? "block" : "none";
}

export async function updateLoginView(
  show,
  updateToggle = true,
  useIsAuthed = false
) {
  const logToggleButton = document.getElementById("log-toggle-button");
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");
  const terminalContainer = document.getElementById("terminal-container");

  const shouldShowLogs = !!show; // Normalize to boolean

  window.HIDE_LOGS = !shouldShowLogs;

  // Toggle log output and terminal
  if (logOutput) logOutput.style.display = shouldShowLogs ? "block" : "none";
  if (terminalContainer)
    terminalContainer.style.display = shouldShowLogs ? "none" : "block";

  // Toggle additional log controls
  logControls.forEach((el) => {
    if (el) el.style.display = shouldShowLogs ? "block" : "none";
  });

  // Sync toggle button state
  if (updateToggle && logToggleButton) {
    logToggleButton.checked = shouldShowLogs;
  }

  // Update visibility of login-required elements if needed
  await updateTabsView(shouldShowLogs, useIsAuthed);
}

export async function updateTabsView(showLoginRequired, useIsAuthed = false) {
  const logoutButton = document.getElementById("logout-button");
  const loginTabButton = document.getElementById("login-tab-button");
  const loginRequiredElements = document.querySelectorAll(".login-required");
  const isLoggedIn = useIsAuthed ? isTokenSet() : await isAuthed();

  const shouldShowProtected = Boolean(showLoginRequired) && isLoggedIn;

  loginRequiredElements.forEach((el) => {
    el.style.display = shouldShowProtected ? "block" : "none";
  });

  if (loginTabButton) {
    loginTabButton.style.display = shouldShowProtected ? "none" : "block";
  }

  if (logoutButton) {
    logoutButton.style.display = shouldShowProtected ? "block" : "none";
  }
}

export function updateLogsView(show, updateToggle = true) {
  const logToggleButton = document.getElementById("log-toggle-button");
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");
  const terminalContainer = document.getElementById("terminal-container");

  const shouldShow = !!show; // ensures boolean

  window.HIDE_LOGS = !shouldShow;

  if (logOutput) logOutput.style.display = shouldShow ? "block" : "none";
  if (terminalContainer)
    terminalContainer.style.display = shouldShow ? "none" : "block";

  logControls.forEach((el) => {
    if (el) el.style.display = shouldShow ? "block" : "none";
  });

  if (updateToggle && logToggleButton) {
    logToggleButton.checked = shouldShow;
  }

  updateTabsView(shouldShow); // Update the tabs view
}

export function updateTabsView(showLoginRequired) {
  const loginRequiredElements = document.querySelectorAll(".login-required");
  const loginRequired = !!showLoginRequired;

  loginRequiredElements.forEach((el) => {
    el.style.display = loginRequired ? "block" : "none";
  });
}
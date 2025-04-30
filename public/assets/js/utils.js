export function updateLogsView(show, updateToggle = true) {
  const logToggleButton = document.getElementById("log-toggle-button");
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");
  const terminalContainer = document.getElementById("terminal-container");

  window.HIDE_LOGS = !show;
  logOutput.style.display = show ? "block" : "none";
  terminalContainer.style.display = show ? "none" : "block";
  logControls.forEach((el) => (el.style.display = show ? "block" : "none"));

  if (updateToggle) {
    logToggleButton.checked = show;
  }
}

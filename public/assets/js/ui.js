import { isAuthed } from "./api.js";
import { terminal } from "./terminal.js";

// Function to apply the theme
export function setTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('pref-theme', themeName);
    
    // Update the dropdown value if it exists
    const selector = document.getElementById('theme-select');
    if (selector) selector.value = themeName;
}

// Initialize theme on load
export function initTheme() {
    const savedTheme = localStorage.getItem('pref-theme') || 'emerald';
    setTheme(savedTheme);
}

let terminalLoaded = false;

export function showToast(message) {
  toastQueue.push(message);
  if (!isToastVisible) {
    displayNextToast();
  }
}

const toastQueue = [];
let isToastVisible = false;

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

  setTimeout(() => toast.classList.add("show"), 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
      displayNextToast();
    }, 500);
  }, 3000);
}

export async function showTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-button")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(tabId).classList.add("active");
  document
    .querySelector(`.tab-button[onclick="showTab('${tabId}')"]`)
    ?.classList.add("active");

  if (tabId === "log") {
    const authed = await isAuthed();

    replaceLogs(authed);
  }
}

function replaceLogs(showTerminal) {
  const terminalContainer = document.getElementById("terminal-container");
  const logOutput = document.getElementById("log-output");
  const logControls = document.querySelectorAll(".log-control-inputs");

  if (showTerminal) {
    logControls.forEach((el) => (el.style.display = "none"));
    logOutput.style.display = "none";
    terminalContainer.style.display = "block";
    terminalContainer.style.overflow = "hidden";

    loadTerminalInto();
  } else {
    terminalContainer.style.display = "none";
    document.getElementById("terminal").innerHTML = "";
    logOutput.style.display = "block";
    logControls.forEach((el) => (el.style.display = "block"));
  }
}

function loadTerminalInto() {
  if (terminalLoaded) {
    return;
  }
  terminal();
  terminalLoaded = true;
}

/**
 * Opens the sudo modal and waits for user input.
 * @returns {Promise<string|null>} Resolves with the password or null if cancelled.
 */
export async function requestSudoPassword() {
  return new Promise((resolve) => {
    const modal = document.getElementById('sudo-modal');
    const input = document.getElementById('sudo-password');
    const confirmBtn = document.getElementById('confirm-sudo-button');
    const cancelBtn = document.getElementById('cancel-sudo-button'); // Assuming cancel button

    modal.classList.add('active');
    input.focus();

    const cleanup = () => {
      modal.classList.remove('active');
      input.value = '';
      // Remove listeners to prevent memory leaks/duplicate calls
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      input.removeEventListener('keypress', onKeyPress);
    };

    const onConfirm = () => {
      const pass = input.value;
      cleanup();
      resolve(pass);
    };

    const onCancel = () => {
      cleanup();
      resolve(null); // User bailed out
    };

    const onKeyPress = (e) => {
      if (e.key === 'Enter') onConfirm();
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    input.addEventListener('keypress', onKeyPress);
  });
}

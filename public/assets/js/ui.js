import { isAuthed, getCurrentInstance } from "./api.js";
import { terminal, destroyTerminal, applyTerminalTheme } from "./terminal.js";
import { setLogView } from "./utils.js";

// ── Theme ──────────────────────────────────────────────────────────────────

export function setTheme(name) {
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("pref-theme", name);
  const sel = document.getElementById("theme-select");
  if (sel) sel.value = name;
  applyTerminalTheme(name); // live-update xterm canvas colours
}

export function initTheme() {
  setTheme(localStorage.getItem("pref-theme") || "emerald");
}

// ── Toast queue ────────────────────────────────────────────────────────────

const toastQueue = [];
let toastActive = false;

export function showToast(message) {
  toastQueue.push(message);
  if (!toastActive) drainToasts();
}

function drainToasts() {
  if (!toastQueue.length) {
    toastActive = false;
    return;
  }
  toastActive = true;

  const msg = toastQueue.shift();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add("show"));

  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => {
      el.remove();
      drainToasts();
    }, 400);
  }, 3000);
}

// ── Tabs ───────────────────────────────────────────────────────────────────

let terminalLoaded = false;

export async function showTab(tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-button")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(tabId)?.classList.add("active");
  document
    .querySelector(`.tab-button[onclick="showTab('${tabId}')"]`)
    ?.classList.add("active");

  if (tabId === "log") {
    const authed = await isAuthed();
    if (authed && !terminalLoaded) {
      const toggle = document.getElementById("log-toggle-button");
      if (toggle?.checked) {
        loadTerminal(getCurrentInstance());
      }
    }
  }
}

// ── Terminal ───────────────────────────────────────────────────────────────

/**
 * Open the terminal view for the given instance.
 * @param {string} instanceId
 */
export function loadTerminal(instanceId) {
  if (terminalLoaded) return;
  destroyTerminal(); // safety-net: clean up any lingering WS/xterm from a hidden state
  setLogView(false);
  terminalLoaded = true;
  terminal(() => {
    terminalLoaded = false;
    setLogView(true);
    const toggle = document.getElementById("log-toggle-button");
    if (toggle) toggle.checked = false;
  }, instanceId);
}

/**
 * Fully close the terminal view — tears down the WebSocket, disposes the xterm
 * instance, resets the loaded flag, and restores the log view.
 * Call this whenever the instance changes or the panel is reset.
 */
export function closeTerminalView() {
  terminalLoaded = false;
  destroyTerminal();
  setLogView(true);
  const toggle = document.getElementById("log-toggle-button");
  if (toggle) toggle.checked = false;
}

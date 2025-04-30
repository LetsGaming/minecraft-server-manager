import { isAuthed } from "./api.js";

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
    console.log("Log tab selected | authed:", authed);

    replaceLogs(authed);
  }
}

function replaceLogs(showTerminal) {
  const terminalContainer = document.getElementById("terminal-container");
  const logOutput = document.getElementById("log-output");
  const logControls = document.getElementById("log-controls");

  if (showTerminal) {
    logOutput.style.display = "none";
    logControls.style.display = "none";
    terminalContainer.style.display = "block";
    terminalContainer.style.overflow = "hidden";

    if (!terminalContainer.hasChildNodes()) {
      loadTerminalInto(terminalContainer);
    }
  } else {
    terminalContainer.style.display = "none";
    terminalContainer.innerHTML = ""; // Clear the terminal container
    logOutput.style.display = "block";
    logControls.style.display = "block";
  }
}

function loadTerminalInto(container) {
  fetch("terminal.html")
    .then((res) => res.text())
    .then((html) => {
      // Create a temporary element to extract and reorder scripts
      const temp = document.createElement("div");
      temp.innerHTML = html;

      // Separate scripts from content
      const scripts = Array.from(temp.querySelectorAll("script"));
      scripts.forEach((s) => s.remove()); // Remove from HTML fragment

      // Inject the HTML content (without scripts)
      container.innerHTML = temp.innerHTML;

      // Load external scripts sequentially
      const loadScript = (src) =>
        new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });

      // Identify and load all scripts with src
      const externalScripts = scripts.filter((s) => s.src).map((s) => s.src);
      const inlineScripts = scripts.filter((s) => !s.src);

      // Load all external scripts, then run inline scripts
      Promise.all(externalScripts.map(loadScript))
        .then(() => {
          inlineScripts.forEach((s) => {
            const inline = document.createElement("script");
            inline.textContent = s.textContent;
            document.body.appendChild(inline);
          });
        })
        .catch((err) => {
          console.error("Script loading failed:", err);
          container.innerText = "Failed to load terminal interface.";
        });
    })
    .catch((err) => {
      console.error("Failed to load terminal:", err);
      container.innerText = "Failed to load terminal interface.";
    });
}

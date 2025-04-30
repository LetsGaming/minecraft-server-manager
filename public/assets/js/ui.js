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

export function showTab(tabId) {
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
}

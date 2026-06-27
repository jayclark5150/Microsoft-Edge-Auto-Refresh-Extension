const targetUrlInput = document.getElementById("target-url");
const intervalInput = document.getElementById("interval");
const unitSelect = document.getElementById("unit");
const matchPrefixCheckbox = document.getElementById("match-prefix");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("status");

let currentTabId = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  currentTabId = tab.id;
  targetUrlInput.value = tab.url || "";

  const alarmName = `refresh-${currentTabId}`;
  const data = await chrome.storage.local.get(alarmName);
  if (data[alarmName]) {
    setActiveState(data[alarmName]);
  }
}

function setActiveState(entry) {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  targetUrlInput.disabled = true;
  intervalInput.disabled = true;
  unitSelect.disabled = true;
  matchPrefixCheckbox.disabled = true;
  statusEl.textContent = "Refreshing...";
  statusEl.className = "status active";

  if (entry) {
    targetUrlInput.value = entry.targetUrl || "";
    matchPrefixCheckbox.checked = !!entry.matchPrefix;
  }
}

function setInactiveState() {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  targetUrlInput.disabled = false;
  intervalInput.disabled = false;
  unitSelect.disabled = false;
  matchPrefixCheckbox.disabled = false;
  statusEl.textContent = "";
  statusEl.className = "status";
}

startBtn.addEventListener("click", async () => {
  const intervalValue = parseInt(intervalInput.value, 10);
  if (!intervalValue || intervalValue < 1) {
    statusEl.textContent = "Enter a valid interval";
    statusEl.className = "status error";
    return;
  }

  const granted = await chrome.permissions.request({ permissions: ["tabs"] });
  if (!granted) {
    statusEl.textContent = "Tab permission required for URL matching";
    statusEl.className = "status error";
    return;
  }

  const intervalSeconds = unitSelect.value === "minutes"
    ? intervalValue * 60
    : intervalValue;

  chrome.runtime.sendMessage({
    action: "startRefresh",
    tabId: currentTabId,
    targetUrl: targetUrlInput.value.trim(),
    matchPrefix: matchPrefixCheckbox.checked,
    intervalSeconds
  }, (response) => {
    if (response && response.success) {
      setActiveState(null);
    } else {
      statusEl.textContent = response?.error || "Failed to start";
      statusEl.className = "status error";
    }
  });
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    action: "stopRefresh",
    tabId: currentTabId,
    targetUrl: targetUrlInput.value.trim()
  }, (response) => {
    if (response && response.success) {
      setInactiveState();
    }
  });
});

init();

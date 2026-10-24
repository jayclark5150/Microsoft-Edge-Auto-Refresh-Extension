const targetUrlInput = document.getElementById("target-url");
const intervalInput = document.getElementById("interval");
const unitSelect = document.getElementById("unit");
const matchPrefixCheckbox = document.getElementById("match-prefix");
const bypassCacheCheckbox = document.getElementById("bypass-cache");
const startBtn = document.getElementById("start-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("status");

const MIN_INTERVAL_SECONDS = 30;

let currentTabId = null;
let countdownTimer = null;
let nextFireTime = null;
let badgePort = null;

function showError(msg) {
  statusEl.textContent = msg;
  statusEl.className = "status error";
}

function showActiveStatus(remainingSeconds) {
  statusEl.textContent = `Next refresh in ${remainingSeconds}s`;
  statusEl.className = "status active";
}

// While the popup is open it holds a port to the service worker. When the
// popup closes the port disconnects and the badge falls back to "ON".
function openBadgePort() {
  closeBadgePort();
  try {
    badgePort = chrome.runtime.connect({ name: `popup-countdown:${currentTabId}` });
  } catch (error) {
    console.error("connect failed:", error);
    badgePort = null;
  }
}

function closeBadgePort() {
  if (badgePort) {
    try {
      badgePort.disconnect();
    } catch {
      // Already disconnected
    }
    badgePort = null;
  }
}

function stopCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  nextFireTime = null;
  closeBadgePort();
}

function startCountdown(nextFireTimeMs) {
  stopCountdown();
  nextFireTime = nextFireTimeMs;
  openBadgePort();

  const tick = () => {
    if (!nextFireTime) return;
    let remaining = Math.max(0, Math.round((nextFireTime - Date.now()) / 1000));
    showActiveStatus(remaining);

    // Ask background to update the toolbar badge with the same countdown
    chrome.runtime.sendMessage({
      action: "updateBadge",
      tabId: currentTabId,
      remainingSeconds: remaining
    }, () => {
      // Ignore lastError silently; badge is best-effort
      void chrome.runtime.lastError;
    });

    // If we've hit zero, the alarm should have fired and background will
    // reset nextFireTime in storage — refetch state to re-sync.
    if (remaining <= 0) {
      chrome.runtime.sendMessage({
        action: "getState",
        tabId: currentTabId
      }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.active && response.nextFireTime) {
          nextFireTime = response.nextFireTime;
        }
      });
    }
  };

  tick();
  countdownTimer = setInterval(tick, 1000);
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    currentTabId = tab.id;
    targetUrlInput.value = tab.url || "";

    chrome.runtime.sendMessage({
      action: "getState",
      tabId: currentTabId
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.active) {
        setActiveState({
          targetUrl: response.targetUrl,
          matchPrefix: response.matchPrefix,
          bypassCache: response.bypassCache
        });
        if (response.nextFireTime) {
          startCountdown(response.nextFireTime);
        }
      }
    });
  } catch (error) {
    showError("Unable to initialize popup");
    console.error("init failed:", error);
  }
}

function setActiveState(entry) {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  targetUrlInput.disabled = true;
  intervalInput.disabled = true;
  unitSelect.disabled = true;
  matchPrefixCheckbox.disabled = true;
  bypassCacheCheckbox.disabled = true;
  statusEl.textContent = "Refreshing...";
  statusEl.className = "status active";
  if (entry) {
    targetUrlInput.value = entry.targetUrl || "";
    matchPrefixCheckbox.checked = !!entry.matchPrefix;
    bypassCacheCheckbox.checked = !!entry.bypassCache;
  }
}

function setInactiveState() {
  stopCountdown();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  targetUrlInput.disabled = false;
  intervalInput.disabled = false;
  unitSelect.disabled = false;
  matchPrefixCheckbox.disabled = false;
  bypassCacheCheckbox.disabled = false;
  statusEl.textContent = "";
  statusEl.className = "status";
}

startBtn.addEventListener("click", async () => {
  const intervalValue = parseInt(intervalInput.value, 10);
  if (!intervalValue || intervalValue < 1) {
    showError("Enter a valid interval");
    return;
  }

  const intervalSeconds = unitSelect.value === "minutes"
    ? intervalValue * 60
    : intervalValue;

  if (intervalSeconds < MIN_INTERVAL_SECONDS) {
    showError(`Minimum interval is ${MIN_INTERVAL_SECONDS} seconds`);
    return;
  }

  let granted = false;
  try {
    granted = await chrome.permissions.request({ permissions: ["tabs"] });
  } catch (error) {
    showError("Unable to request tab permission");
    console.error("permissions.request failed:", error);
    return;
  }

  if (!granted) {
    showError("Tab permission required for URL matching");
    return;
  }

  chrome.runtime.sendMessage({
    action: "startRefresh",
    tabId: currentTabId,
    targetUrl: targetUrlInput.value.trim(),
    matchPrefix: matchPrefixCheckbox.checked,
    bypassCache: bypassCacheCheckbox.checked,
    intervalSeconds
  }, (response) => {
    if (chrome.runtime.lastError) {
      showError(chrome.runtime.lastError.message || "Failed to start");
      return;
    }
    if (response && response.success) {
      setActiveState(null);
      if (response.nextFireTime) {
        startCountdown(response.nextFireTime);
      }
    } else {
      showError(response?.error || "Failed to start");
    }
  });
});

stopBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    action: "stopRefresh",
    tabId: currentTabId
  }, (response) => {
    if (chrome.runtime.lastError) {
      showError(chrome.runtime.lastError.message || "Failed to stop");
      return;
    }
    if (response && response.success) {
      setInactiveState();
    } else {
      showError(response?.error || "Failed to stop");
    }
  });
});

// Stop the countdown interval when popup is closed to avoid leaked timers
window.addEventListener("pagehide", () => {
  stopCountdown();
});

init();

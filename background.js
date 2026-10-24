const MIN_INTERVAL_SECONDS = 30;
const BADGE_ON_TEXT = "ON";
const BADGE_ON_COLOR = "#107c10"; // green

function parseAllowedUrl(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  return parsed;
}

// Prefix match on whole path segments: "/app" matches "/app" and "/app/x"
// but not "/application".
function pathMatchesPrefix(currentPath, targetPath) {
  const base = targetPath.replace(/\/+$/, "");
  if (base === "") return true;
  return currentPath === base || currentPath.startsWith(base + "/");
}

function urlsMatch(currentUrl, targetUrl, matchPrefix) {
  let current;
  let target;

  try {
    current = new URL(currentUrl);
    target = new URL(targetUrl);
  } catch {
    return false;
  }

  if (current.origin !== target.origin) {
    return false;
  }

  if (!matchPrefix) {
    return current.href === target.href;
  }

  return pathMatchesPrefix(current.pathname, target.pathname);
}

function createAlarmSafe(name, alarmInfo) {
  return new Promise((resolve, reject) => {
    chrome.alarms.create(name, alarmInfo, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function storageSetSafe(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function alarmClearSafe(name) {
  return new Promise((resolve, reject) => {
    chrome.alarms.clear(name, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function storageRemoveSafe(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(key, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

// Pick a badge color based on remaining seconds
// Green: plenty of time, Orange: getting close, Red: about to refresh
function badgeColorForSeconds(seconds) {
  if (seconds <= 5) return "#d13438";  // red
  if (seconds <= 10) return "#f7630c"; // orange
  return "#107c10";                     // green
}

function setBadge(tabId, text, color) {
  try {
    const badgeText = String(text || "");
    chrome.action.setBadgeBackgroundColor({ tabId, color: color || "#107c10" });
    // setBadgeTextColor requires Edge/Chrome 110+; guard it in case it's missing
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ tabId, color: "#ffffff" });
    }
    chrome.action.setBadgeText({ tabId, text: badgeText });
  } catch (error) {
    console.error("setBadge failed:", error);
  }
}

function clearBadge(tabId) {
  try {
    chrome.action.setBadgeText({ tabId, text: "" });
  } catch (error) {
    console.error("clearBadge failed:", error);
  }
}

// Shown while a refresh is active and the popup is closed. The live
// countdown only runs while the popup is open (a service worker cannot
// tick once per second).
function setActiveBadge(tabId) {
  setBadge(tabId, BADGE_ON_TEXT, BADGE_ON_COLOR);
}

// The popup keeps a port open while its countdown runs. When the popup
// closes, the port disconnects and the badge falls back to "ON".
chrome.runtime.onConnect.addListener((port) => {
  if (port.sender?.id !== chrome.runtime.id) return;

  const match = /^popup-countdown:(\d+)$/.exec(port.name);
  if (!match) return;

  const tabId = parseInt(match[1], 10);
  const key = `refresh-${tabId}`;

  port.onDisconnect.addListener(() => {
    chrome.storage.local.get(key, (data) => {
      if (data[key]) setActiveBadge(tabId);
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Validate sender is from this extension
  if (sender.id !== chrome.runtime.id) return;

  const { action, targetUrl, matchPrefix, bypassCache } = message;
  const tabId = parseInt(message.tabId, 10);

  // 2. Validate tabId
  if (!Number.isInteger(tabId) || tabId <= 0) {
    sendResponse({ success: false, error: "Invalid tabId" });
    return true;
  }

  const alarmName = `refresh-${tabId}`;

  // getState: return active refresh info for this tab (used by popup for countdown)
  if (action === "getState") {
    chrome.storage.local.get(alarmName, (data) => {
      const entry = data[alarmName];
      if (!entry) {
        sendResponse({ active: false });
        return;
      }
      sendResponse({
        active: true,
        targetUrl: entry.targetUrl,
        matchPrefix: !!entry.matchPrefix,
        bypassCache: !!entry.bypassCache,
        intervalSeconds: entry.intervalSeconds,
        nextFireTime: entry.nextFireTime
      });
    });
    return true;
  }

  // updateBadge: popup asks background to write live countdown to badge
  if (action === "updateBadge") {
    const remaining = Math.max(0, Number(message.remainingSeconds) || 0);
    setBadge(tabId, remaining, badgeColorForSeconds(remaining));
    sendResponse({ success: true });
    return true;
  }

  // stopRefresh: does not depend on the URL, so a stale or invalid URL
  // can never prevent a refresh from being stopped
  if (action === "stopRefresh") {
    Promise.all([
      alarmClearSafe(alarmName),
      storageRemoveSafe(alarmName)
    ])
      .then(() => {
        clearBadge(tabId);
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("stopRefresh failed:", error);
        sendResponse({ success: false, error: error.message || "Failed to stop refresh" });
      });
    return true;
  }

  if (action === "startRefresh") {
    // 3. Validate targetUrl (only http/https allowed)
    const parsedTargetUrl = parseAllowedUrl(targetUrl);
    if (!parsedTargetUrl) {
      sendResponse({ success: false, error: "Only HTTP and HTTPS URLs are supported" });
      return true;
    }

    // 4. Validate interval (browser alarms do not reliably fire more often
    // than every 30 seconds)
    const intervalSeconds = Number(message.intervalSeconds);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds < MIN_INTERVAL_SECONDS) {
      sendResponse({
        success: false,
        error: `Minimum interval is ${MIN_INTERVAL_SECONDS} seconds`
      });
      return true;
    }

    const nextFireTime = Date.now() + intervalSeconds * 1000;
    Promise.all([
      createAlarmSafe(alarmName, {
        delayInMinutes: intervalSeconds / 60,
        periodInMinutes: intervalSeconds / 60
      }),
      storageSetSafe({
        [alarmName]: {
          tabId,
          targetUrl,
          matchPrefix: !!matchPrefix,
          bypassCache: !!bypassCache,
          intervalSeconds,
          nextFireTime
        }
      })
    ])
      .then(() => {
        setActiveBadge(tabId);
        sendResponse({ success: true, nextFireTime, intervalSeconds });
      })
      .catch((error) => {
        console.error("startRefresh failed:", error);
        sendResponse({ success: false, error: error.message || "Failed to start refresh" });
      });
    return true;
  }

  // Unknown action fallback
  sendResponse({ success: false, error: "Unknown action" });
  return true;
});

function clearAlarmForTab(tabId) {
  const alarmName = `refresh-${tabId}`;
  chrome.alarms.clear(alarmName);
  chrome.storage.local.remove(alarmName);
  clearBadge(tabId);
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearAlarmForTab(tabId);
});

// A page load can clear the per-tab badge, so re-apply it once the page
// finishes loading while a refresh is active for that tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  const key = `refresh-${tabId}`;
  chrome.storage.local.get(key, (data) => {
    if (data[key]) setActiveBadge(tabId);
  });
});

// Clear all refresh alarms and storage on browser restart
// (matches documented behavior in README.md)
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(null, (data) => {
    for (const key of Object.keys(data)) {
      if (!key.startsWith("refresh-")) continue;
      chrome.alarms.clear(key);
      chrome.storage.local.remove(key);
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.local.get(alarm.name, (data) => {
    const entry = data[alarm.name];
    if (!entry) return;
    chrome.tabs.get(entry.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;
      const currentUrl = tab.url || "";
      if (urlsMatch(currentUrl, entry.targetUrl, entry.matchPrefix)) {
        chrome.tabs.reload(entry.tabId, { bypassCache: !!entry.bypassCache });
      }
      // Roll forward the next fire time
      const interval = Number(entry.intervalSeconds) || 60;
      const nextFireTime = Date.now() + interval * 1000;
      chrome.storage.local.set({
        [alarm.name]: { ...entry, nextFireTime }
      });
      setActiveBadge(entry.tabId);
    });
  });
});

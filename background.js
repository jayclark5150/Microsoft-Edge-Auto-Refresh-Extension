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

  return current.pathname.startsWith(target.pathname);
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Validate sender is from this extension
  if (sender.id !== chrome.runtime.id) return;

  const { action, targetUrl, matchPrefix } = message;
  const tabId = parseInt(message.tabId, 10);
  // Browser alarms do not reliably fire more often than every 30 seconds
  const intervalSeconds = Math.max(Number(message.intervalSeconds) || 60, 30);

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

  // 3. Validate targetUrl (only http/https allowed) — required for start/stop
  const parsedTargetUrl = parseAllowedUrl(targetUrl);
  if (!parsedTargetUrl) {
    sendResponse({ success: false, error: "Only HTTP and HTTPS URLs are supported" });
    return true;
  }

  if (action === "startRefresh") {
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
          intervalSeconds,
          nextFireTime
        }
      })
    ])
      .then(() => {
        setBadge(tabId, intervalSeconds, badgeColorForSeconds(intervalSeconds));
        sendResponse({ success: true, nextFireTime, intervalSeconds });
      })
      .catch((error) => {
        console.error("startRefresh failed:", error);
        sendResponse({ success: false, error: error.message || "Failed to start refresh" });
      });
    return true;
  }

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
        chrome.tabs.reload(entry.tabId);
      }
      // Roll forward the next fire time and reset the badge to the interval
      const interval = Number(entry.intervalSeconds) || 60;
      const nextFireTime = Date.now() + interval * 1000;
      chrome.storage.local.set({
        [alarm.name]: { ...entry, nextFireTime }
      });
      setBadge(entry.tabId, interval, badgeColorForSeconds(interval));
    });
  });
});
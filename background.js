chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Validate sender is from this extension
  if (sender.id !== chrome.runtime.id) return;

  const { action, targetUrl, matchPrefix } = message;
  const tabId = parseInt(message.tabId, 10);
  const intervalSeconds = Math.max(Number(message.intervalSeconds) || 60, 5);

  // 2. Validate tabId
  if (!Number.isInteger(tabId) || tabId <= 0) {
    sendResponse({ success: false, error: "Invalid tabId" });
    return true;
  }

  // 3. Validate targetUrl
  try { new URL(targetUrl); } catch {
    sendResponse({ success: false, error: "Invalid URL" });
    return true;
  }

  if (action === "startRefresh") {
    const alarmName = `refresh-${tabId}`;

    chrome.alarms.create(alarmName, {
      delayInMinutes: intervalSeconds / 60,
      periodInMinutes: intervalSeconds / 60
    });

    chrome.storage.local.set({
      [alarmName]: { tabId, targetUrl, matchPrefix }
    });

    sendResponse({ success: true });
  }

  if (action === "stopRefresh") {
    const alarmName = `refresh-${tabId}`;
    chrome.alarms.clear(alarmName);
    chrome.storage.local.remove(alarmName);
    sendResponse({ success: true });
  }

  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.local.get(alarm.name, (data) => {
    const entry = data[alarm.name];
    if (!entry) return;

    chrome.tabs.get(entry.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;

      const currentUrl = tab.url || "";
      const match = entry.matchPrefix
        ? currentUrl.startsWith(entry.targetUrl)
        : currentUrl === entry.targetUrl;

      if (match) {
        chrome.tabs.reload(entry.tabId);
      }
    });
  });
});

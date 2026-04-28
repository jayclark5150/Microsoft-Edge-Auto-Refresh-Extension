Message.addListener((message, sender, sendResponse) => {
  const { action, tabId, intervalSeconds, targetUrl, matchPrefix } = message;

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

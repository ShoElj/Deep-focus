chrome.runtime.onInstalled.addListener(() => {
  console.info("[Deep-Focus] Background service worker installed.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEEP_FOCUS_CLOSE_TAB") {
    return false;
  }

  const tabId = sender.tab?.id;

  if (!tabId) {
    sendResponse({ ok: false, error: "No sender tab found." });
    return false;
  }

  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ ok: true });
  });

  return true;
});

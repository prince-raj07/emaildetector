/**
 * PhishShield — background.js (Service Worker)
 * Handles extension lifecycle, badge updates, and inter-component messaging.
 */

// ── Badge helpers ──────────────────────────────────────────────────────────────

const BADGE_STYLES = {
  "High Risk":   { text: "!", color: "#f85149" },
  "Medium Risk": { text: "!!", color: "#d29922" },
  "Low Risk":    { text: "▲", color: "#E8510A" },
  "Safe":        { text: "✓", color: "#3fb950" },
};

function setBadge(tabId, riskLevel) {
  const style = BADGE_STYLES[riskLevel] || { text: "", color: "#8b949e" };
  chrome.action.setBadgeText({ tabId, text: style.text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: style.color });
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ tabId, text: "" });
}

// ── Message listener ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Popup → background: analysis result received, update badge + inject banner
  if (msg.action === "analysisComplete") {
    const tabId = msg.tabId;
    setBadge(tabId, msg.riskLevel);

    // Inject warning banner into the email page via content script
    if (msg.isPhishing) {
      chrome.tabs.sendMessage(tabId, {
        action: "showWarning",
        riskLevel: msg.riskLevel,
        reason: msg.reason,
      }).catch(() => {}); // Content script may not be injected on all pages
    }

    sendResponse({ ok: true });
    return true;
  }

  // Tab navigation: clear badge when user navigates away
  if (msg.action === "clearBadge") {
    clearBadge(sender.tab?.id);
    sendResponse({ ok: true });
    return true;
  }
});

// ── Tab lifecycle ──────────────────────────────────────────────────────────────

// Clear badge on navigation so stale results don't persist
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearBadge(tabId);
  }
});

// ── Install / Update ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    console.log("[PhishShield] Installed — ready to protect your inbox.");
  } else if (reason === "update") {
    console.log("[PhishShield] Updated to latest version.");
  }
});

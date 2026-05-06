/**
 * PhishShield — content.js
 * Injected into Gmail and Outlook pages.
 * Extracts the open email's subject, body, and sender.
 * Also injects an inline warning banner for detected phishing emails.
 */

// ── Email extractors per webmail client ───────────────────────────────────────

function extractGmail() {
  try {
    const subject = document.querySelector("h2.hP")?.innerText || document.title;
    const sender  = document.querySelector(".gD")?.getAttribute("email") || "";
    const body    = document.querySelector(".a3s.aiL")?.innerText
                 || document.querySelector(".ii.gt")?.innerText
                 || document.body.innerText.slice(0, 4000);
    return { subject, sender, body: body.slice(0, 4000) };
  } catch (_) {
    return { subject: document.title, sender: "", body: document.body.innerText.slice(0, 4000) };
  }
}

function extractOutlook() {
  try {
    const subject = document.querySelector("[data-testid='subject']")?.innerText
                 || document.querySelector(".allowTextSelection")?.innerText?.split("\n")[0]
                 || document.title;
    const sender  = document.querySelector(".ms-Persona-primaryText")?.innerText || "";
    const body    = document.querySelector("[data-testid='messageBody']")?.innerText
                 || document.querySelector(".ReadingPaneContent")?.innerText
                 || document.body.innerText.slice(0, 4000);
    return { subject, sender, body: body.slice(0, 4000) };
  } catch (_) {
    return { subject: document.title, sender: "", body: document.body.innerText.slice(0, 4000) };
  }
}

function extractEmail() {
  const host = window.location.hostname;
  if (host.includes("mail.google.com")) return extractGmail();
  if (host.includes("outlook")) return extractOutlook();
  return { subject: document.title, sender: "", body: document.body.innerText.slice(0, 4000) };
}

// ── Warning banner injection ───────────────────────────────────────────────────

function injectWarningBanner(riskLevel, reason) {
  // Remove any existing banner
  document.getElementById("ps-warning-banner")?.remove();

  if (riskLevel === "Safe") return;

  const colors = {
    "High Risk":   { bg: "rgba(248,81,73,0.12)", border: "#f85149", icon: "🚨" },
    "Medium Risk": { bg: "rgba(210,153,34,0.12)", border: "#d29922", icon: "⚠️" },
    "Low Risk":    { bg: "rgba(232,81,10,0.10)", border: "#E8510A", icon: "⚡" },
  };
  const { bg, border, icon } = colors[riskLevel] || colors["Low Risk"];

  const banner = document.createElement("div");
  banner.id = "ps-warning-banner";
  banner.style.cssText = `
    position: fixed; top: 60px; right: 16px; z-index: 999999;
    background: ${bg}; border: 1px solid ${border};
    border-radius: 8px; padding: 12px 16px;
    max-width: 300px; backdrop-filter: blur(8px);
    font-family: 'DM Sans', -apple-system, sans-serif;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    animation: ps-slide-in 0.3s ease;
  `;

  banner.innerHTML = `
    <style>
      @keyframes ps-slide-in {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    </style>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:16px">${icon}</span>
      <strong style="color:${border};font-size:13px">PhishShield — ${riskLevel}</strong>
      <button id="ps-close-btn"
  style="margin-left:auto;background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;padding:0">
</button>
        style="margin-left:auto;background:none;border:none;color:#8b949e;cursor:pointer;font-size:16px;padding:0">×</button>
    </div>
    <p style="font-size:12px;color:#e6edf3;line-height:1.4;margin:0">${reason}</p>
    <p style="font-size:11px;color:#8b949e;margin-top:6px">Powered by PhishShield AI + RAG</p>
  `;

  document.body.appendChild(banner);

  banner.querySelector("#ps-close-btn")
    .addEventListener("click", () => {
        banner.remove();
    });

  // Auto-dismiss after 12 seconds
  setTimeout(() => banner.remove(), 12000);
}

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "extractEmail") {
    sendResponse(extractEmail());
  }
  if (msg.action === "showWarning") {
    injectWarningBanner(msg.riskLevel, msg.reason);
  }
  return true;
});

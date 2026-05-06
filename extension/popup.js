/**
 * PhishShield — popup.js (Clean Version)
 */

const API_BASE = "http://localhost:8000";

// ── DOM refs ────────────────────────────────────────────────────────────────
const statusDot    = document.getElementById("statusDot");
const emailPreview = document.getElementById("emailPreview");
const analyzeBtn   = document.getElementById("analyzeBtn");
const loadingState = document.getElementById("loadingState");
const resultPanel  = document.getElementById("resultPanel");

const riskBadge   = document.getElementById("riskBadge");
const scoreValue  = document.getElementById("scoreValue");
const gaugeLabel  = document.getElementById("gaugeLabel");
const linksVal    = document.getElementById("linksVal");
const keywordsVal = document.getElementById("keywordsVal");
const ragVal      = document.getElementById("ragVal");
const xaiText     = document.getElementById("xaiText");

// ── Gauge ───────────────────────────────────────────────────────────────────
function drawGauge(score) {
  const canvas = document.getElementById("gaugeCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const W = 240, H = 120;
  const cx = W / 2, cy = H - 10;
  const R = 90;

  ctx.clearRect(0, 0, W, H);

  // background
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, 0);
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#21262d";
  ctx.stroke();

  // score arc
  const fraction = score / 10;
  const color = score >= 6 ? "#f85149" : score >= 3 ? "#d29922" : "#3fb950";
  const endAngle = Math.PI + fraction * Math.PI;

  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI, endAngle);
  ctx.lineWidth = 14;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.stroke();

  // needle
  const angle = Math.PI + fraction * Math.PI;
  const nx = cx + R * Math.cos(angle);
  const ny = cy + R * Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(nx, ny);
  ctx.strokeStyle = "#e6edf3";
  ctx.lineWidth = 2;
  ctx.stroke();

  // center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fillStyle = "#e6edf3";
  ctx.fill();
}

// ── Status ──────────────────────────────────────────────────────────────────
function setStatus(state, text) {
  if (!statusDot) return;
  const dot   = statusDot.querySelector(".dot");
  const label = statusDot.querySelector(".status-text");

  if (dot) dot.className = `dot dot--${state}`;
  if (label) label.textContent = text;
}

// ── Render Result ────────────────────────────────────────────────────────────
function renderResult(data) {
  loadingState.style.display = "none";
  analyzeBtn.style.display   = "flex";
  resultPanel.style.display  = "flex";

  const level = data.risk_level?.toLowerCase() || "safe";

  riskBadge.textContent = data.risk_level || "Safe";
  riskBadge.className = `risk-badge badge--${
    level.includes("high") ? "high" :
    level.includes("medium") ? "medium" :
    level.includes("low") ? "low" : "safe"
  }`;

  scoreValue.textContent = `${data.risk_score || 0}/10`;
  gaugeLabel.textContent = data.risk_level || "Safe";

  drawGauge(data.risk_score || 0);

  linksVal.textContent =
    data.links ? `${data.links.length} total, ${data.suspicious_links.length} suspicious` : "0";

  keywordsVal.textContent =
    data.keywords_found?.length ? data.keywords_found.slice(0, 3).join(", ") : "None";

  ragVal.textContent =
    data.rag_similarity ? `${(data.rag_similarity * 100).toFixed(0)}% match` : "0%";

  xaiText.textContent = data.xai_explanation || "No explanation available";

  setStatus(
    data.is_phishing ? "danger" : "safe",
    data.is_phishing ? "Threat Detected" : "All Clear"
  );

  // save history
  chrome.storage.local.get("scan_history", (res) => {
    const history = res.scan_history || [];
    history.unshift({ ...data, timestamp: Date.now() });
    chrome.storage.local.set({ scan_history: history.slice(0, 100) });
  });
}

// ── Analyze Email ────────────────────────────────────────────────────────────
async function analyzeEmail() {
  try {
    setStatus("scanning", "Scanning…");

    analyzeBtn.style.display   = "none";
    loadingState.style.display = "flex";
    resultPanel.style.display  = "none";

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.id) throw new Error("No active tab");

    let emailData;

    try {
      emailData = await chrome.tabs.sendMessage(tab.id, { action: "extractEmail" });
    } catch {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => ({
          body: document.body.innerText.slice(0, 4000),
          subject: document.title,
          sender: ""
        }),
      });
      emailData = result.result;
    }

    // preview
    emailPreview.innerHTML = `
      <p style="font-size:11px;color:#8b949e">${emailData.sender || "Unknown sender"}</p>
      <p style="font-size:12px;font-weight:600">${emailData.subject || "No subject"}</p>
    `;

    // API call
    const res = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(emailData),
    });

    if (!res.ok) throw new Error("API failed");

    const data = await res.json();

    renderResult(data);

    // trigger banner in page
    chrome.tabs.sendMessage(tab.id, {
      action: "showWarning",
      riskLevel: data.risk_level,
      reason: data.reason
    });

  } catch (err) {
    console.error(err);

    loadingState.style.display = "none";
    analyzeBtn.style.display   = "flex";

    setStatus("idle", "Error");

    emailPreview.innerHTML = `
      <p style="color:#f85149">
        ⚠️ Backend not reachable.<br>
        Run FastAPI on port 8000.
      </p>
    `;
  }
}

// ── Feedback ────────────────────────────────────────────────────────────────
async function sendFeedback(type) {
  try {
    await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ feedback: type, timestamp: Date.now() }),
    });
  } catch {}

  emailPreview.innerHTML = `<p>✓ Feedback sent</p>`;
}

// ── Init ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {

  // analyze button
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeEmail);
  }

  // feedback buttons
  document.getElementById("fbYes")
    ?.addEventListener("click", () => sendFeedback("correct"));

  document.getElementById("fbNo")
    ?.addEventListener("click", () => sendFeedback("incorrect"));

  // dashboard
  // Open Dashboard
document.getElementById("dashboardLink").addEventListener("click", () => {
  const url = chrome.runtime.getURL("dashboard.html");
  chrome.tabs.create({ url: url });
});

});
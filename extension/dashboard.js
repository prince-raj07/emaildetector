let scanHistory = [];

function loadHistory() {
  chrome.storage.local.get("scan_history", (res) => {
    scanHistory = res.scan_history || [];
    renderStats();
    renderTable();
  });
}

function renderStats() {
  const total = scanHistory.length;
  const phishing = scanHistory.filter(s => s.is_phishing).length;
  const safe = total - phishing;
  const avgScore = total ? (scanHistory.reduce((sum, s) => sum + s.risk_score, 0) / total).toFixed(1) : 0;

  document.getElementById("totalScans").textContent = total;
  document.getElementById("phishingCount").textContent = phishing;
  document.getElementById("safeCount").textContent = safe;
  document.getElementById("avgScore").textContent = avgScore;
}

function renderTable() {
  const tbody = document.getElementById("historyBody");
  tbody.innerHTML = "";

  scanHistory.forEach((scan, index) => {
    const row = document.createElement("tr");
    row.style.cursor = "pointer";
    row.innerHTML = `
      <td>${new Date(scan.timestamp).toLocaleDateString()}</td>
      <td>${scan.subject?.substring(0, 45) || "No subject"}</td>
      <td><span class="risk-${scan.risk_level.toLowerCase().replace(" ", "-")}">${scan.risk_level}</span></td>
      <td>${scan.risk_score}/10</td>
    `;
    row.onclick = () => showDetails(scan);
    tbody.appendChild(row);
  });

  if (scanHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:40px; color:#8b949e;">No scans yet. Analyze some emails!</td></tr>`;
  }
}

function showDetails(scan) {
  alert(`📧 Subject: ${scan.subject}\n\n` +
        `🔍 Risk Level: ${scan.risk_level} (${scan.risk_score}/10)\n\n` +
        `🧠 RAG Match: ${scan.rag_match}\n\n` +
        `📝 Explanation:\n${scan.xai_explanation}`);
}

function clearHistory() {
  if (confirm("Delete all scan history?")) {
    chrome.storage.local.set({ scan_history: [] }, () => {
      loadHistory();
    });
  }
}

// Load on start
document.addEventListener('DOMContentLoaded', loadHistory);

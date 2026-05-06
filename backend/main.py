"""
PhishShield — AI Phishing Email Detector
Backend: FastAPI + RAG + AI Agent Logic
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import re
import time

from rag_engine import RAGEngine
from agent import PhishingAgent

app = FastAPI(
    title="PhishShield API",
    description="AI-powered phishing email detection using RAG + Agentic AI",
    version="1.1.0"
)

# CORS — allow Chrome extension origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG + Agent (loaded once at startup)
rag = RAGEngine()
agent = PhishingAgent()


# ── Request / Response Models ─────────────────────────────────────────────────

class EmailPayload(BaseModel):
    subject: Optional[str] = ""
    body: str
    sender: Optional[str] = ""
    headers: Optional[dict] = {}

class AnalysisResult(BaseModel):
    is_phishing: bool
    risk_level: str          # "Safe" | "Low Risk" | "Medium Risk" | "High Risk"
    risk_score: int          # 0–10
    links: list[str]
    suspicious_links: list[str]
    keywords_found: list[str]
    rag_match: str
    rag_similarity: float
    decision_reason: str
    xai_explanation: str
    latency_ms: float


# ── Utility helpers ───────────────────────────────────────────────────────────

PHISHING_KEYWORDS = [
    "urgent", "immediately", "verify", "password", "bank",
    "account", "suspended", "click here", "login", "confirm",
    "update", "security alert", "unauthorized", "limited time",
    "act now", "winner", "prize", "free", "expire",
]

SUSPICIOUS_DOMAINS = [
    "bit.ly", "tinyurl.com", "t.co", "goo.gl",
    "phish", "fake", "secure-login", "account-verify",
    "paypal-security", "apple-id", "signin-",
]


def extract_links(text: str) -> list[str]:
    return re.findall(r"https?://\S+", text)


def is_suspicious_link(url: str) -> bool:
    url_lower = url.lower()
    return any(domain in url_lower for domain in SUSPICIOUS_DOMAINS)


def find_keywords(text: str) -> list[str]:
    text_lower = text.lower()
    return [kw for kw in PHISHING_KEYWORDS if kw in text_lower]


def score_email(keywords: list[str], suspicious_links: list[str], sender: str) -> int:
    score = 0
    score += min(len(keywords) * 1, 5)          # up to 5 pts from keywords
    score += min(len(suspicious_links) * 2, 4)  # up to 4 pts from bad links
    if sender and any(d in sender for d in SUSPICIOUS_DOMAINS):
        score += 1
    return min(score, 10)


# ── Main Analysis Endpoint ────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalysisResult)
async def analyze_email(payload: EmailPayload):
    t0 = time.time()

    full_text = f"{payload.subject} {payload.body}"

    # 1. Extract links
    links = extract_links(full_text)
    suspicious_links = [l for l in links if is_suspicious_link(l)]

    # 2. Keyword matching
    keywords = find_keywords(full_text)

    # 3. RAG lookup
    rag_match, rag_similarity = rag.query(full_text)

    # 4. Compute risk score
    rag_bonus = 1 if rag_similarity > 0.75 else 0
    score = score_email(keywords, suspicious_links, payload.sender) + rag_bonus
    score = min(score, 10)

    # 5. Agent decision
    risk_level, is_phishing, reason, explanation = agent.decide(
        score, rag_match, rag_similarity, keywords, suspicious_links
    )

    latency = round((time.time() - t0) * 1000, 2)

    return AnalysisResult(
        is_phishing=is_phishing,
        risk_level=risk_level,
        risk_score=score,
        links=links,
        suspicious_links=suspicious_links,
        keywords_found=keywords,
        rag_match=rag_match,
        rag_similarity=round(rag_similarity, 3),
        decision_reason=reason,
        xai_explanation=explanation,
        latency_ms=latency,
    )


# ── Health / Info Endpoints ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.1.0"}


@app.get("/stats")
def stats():
    return {
        "rag_documents": rag.doc_count(),
        "phishing_keywords": len(PHISHING_KEYWORDS),
        "suspicious_domains": len(SUSPICIOUS_DOMAINS),
    }


# ── Run locally ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

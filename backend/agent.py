"""
PhishShield — AI Agent (Decision + XAI)
Combines rule-based scoring, RAG similarity, and heuristics
to produce a final risk verdict with an explainable AI summary.
"""

from typing import Tuple, List


class PhishingAgent:
    """
    Autonomous decision agent that synthesizes:
      - Risk score (0–10) from keyword + link analysis
      - RAG similarity to known phishing patterns
      - Contextual heuristics
    into a final risk level + Explainable AI (XAI) summary.
    """

    # Thresholds
    HIGH_RISK_SCORE    = 6
    MEDIUM_RISK_SCORE  = 3
    HIGH_RAG_SIMILARITY = 0.75
    MEDIUM_RAG_SIMILARITY = 0.50

    def decide(
        self,
        score: int,
        rag_match: str,
        rag_similarity: float,
        keywords: List[str],
        suspicious_links: List[str],
    ) -> Tuple[str, bool, str, str]:
        """
        Returns (risk_level, is_phishing, short_reason, xai_explanation).
        """

        # ── Decision tree ──────────────────────────────────────────────────────

        if score >= self.HIGH_RISK_SCORE or rag_similarity >= self.HIGH_RAG_SIMILARITY:
            risk_level = "High Risk"
            is_phishing = True

        elif score >= self.MEDIUM_RISK_SCORE or rag_similarity >= self.MEDIUM_RAG_SIMILARITY:
            risk_level = "Medium Risk"
            is_phishing = True

        elif score >= 1:
            risk_level = "Low Risk"
            is_phishing = False

        else:
            risk_level = "Safe"
            is_phishing = False

        # ── Short reason ───────────────────────────────────────────────────────

        reasons = []
        if keywords:
            reasons.append(f"suspicious keywords: {', '.join(keywords[:3])}")
        if suspicious_links:
            reasons.append(f"{len(suspicious_links)} suspicious link(s)")
        if rag_similarity >= self.MEDIUM_RAG_SIMILARITY:
            reasons.append(f"high semantic similarity to known phishing ({rag_similarity:.0%})")

        reason = "; ".join(reasons) if reasons else "no significant indicators detected"

        # ── XAI Explanation ────────────────────────────────────────────────────

        xai_lines = [
            f"📊 Risk Score: {score}/10 → classified as '{risk_level}'.",
        ]

        if keywords:
            quoted_keywords = ', '.join(f'"{k}"' for k in keywords[:5])

            xai_lines.append(
              f"🔑 Found {len(keywords)} phishing keyword(s): {quoted_keywords}."
)
        else:
            xai_lines.append("🔑 No high-risk keywords detected.")

        if suspicious_links:
            xai_lines.append(
                f"🔗 {len(suspicious_links)} suspicious URL(s) detected. "
                "These may redirect to credential-harvesting pages."
            )
        else:
            xai_lines.append("🔗 No suspicious links found.")

        # Fixed: No backslash inside f-string
        if len(rag_match) > 80:
            rag_text = f"Closest match: \"{rag_match[:80]}...\""
        else:
            rag_text = f"match to: \"{rag_match}\""

        xai_lines.append(
            f"🧠 RAG Similarity: {rag_similarity:.1%} {rag_text}"
        )

        if is_phishing:
            xai_lines.append(
                "⚠️  Recommendation: Do NOT click any links or provide personal information. "
                "Report this email to your IT/security team."
            )
        else:
            xai_lines.append(
                "✅ Recommendation: Email appears legitimate. "
                "Always remain vigilant with unexpected attachments."
            )

        xai_explanation = "\n".join(xai_lines)

        return risk_level, is_phishing, reason, xai_explanation
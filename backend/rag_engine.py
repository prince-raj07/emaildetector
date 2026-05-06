"""
PhishShield — RAG Engine
Semantic similarity search over a phishing knowledge base.
Uses sentence-transformers + FAISS for fast vector retrieval.
"""

import numpy as np
from sentence_transformers import SentenceTransformer
import faiss


# ── Phishing Knowledge Base ───────────────────────────────────────────────────
# Extend this corpus from live threat feeds (e.g., PhishTank, OpenPhish).

PHISHING_CORPUS = [
    # Credential harvesting
    "Your bank account has been locked due to suspicious activity. Click here to verify your identity.",
    "Immediate action required: your PayPal account has been limited. Log in now to restore access.",
    "Your Apple ID password must be reset immediately to protect your account from unauthorized access.",
    "We noticed a sign-in attempt from an unrecognized device. Confirm your identity now.",
    "Your email password will expire in 24 hours. Click the link to update your credentials.",

    # Urgency / social engineering
    "URGENT: You have a pending payment. Verify your bank details to avoid suspension.",
    "Last reminder: your account will be permanently deleted unless you verify your information today.",
    "Winner notification: You have been selected. Claim your $1,000 prize by clicking this link.",
    "Act now — limited time offer. Provide your credit card details to claim your free gift.",
    "Security alert: we detected unauthorized access to your account. Reset your password immediately.",

    # CEO / BEC fraud
    "This is the CEO. I need you to urgently wire $50,000 to this account. Keep this confidential.",
    "Finance team: please process this invoice immediately. The vendor account has changed.",

    # Malware delivery
    "Your invoice is attached. Please download and open the document to view payment details.",
    "You have a new voicemail. Download the audio file to listen to your message.",
    "A package could not be delivered. Track your shipment by clicking the link below.",

    # Safe patterns (to reduce false positives in RAG)
    "Your order has been shipped and will arrive in 3-5 business days. No action required.",
    "Thank you for subscribing to our newsletter. You can unsubscribe at any time.",
    "Your monthly account statement is now available. Log in to view your balance.",
]


class RAGEngine:
    """
    Retrieval-Augmented Generation engine.
    Encodes the threat knowledge base into a FAISS index for similarity search.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        print("[RAG] Loading sentence transformer model...")
        self.model = SentenceTransformer(model_name)
        self.documents = PHISHING_CORPUS

        print("[RAG] Encoding knowledge base...")
        embeddings = self.model.encode(self.documents, show_progress_bar=False)
        self.dim = embeddings.shape[1]

        # Build FAISS L2 index
        self.index = faiss.IndexFlatL2(self.dim)
        self.index.add(np.array(embeddings, dtype="float32"))
        print(f"[RAG] Indexed {len(self.documents)} documents (dim={self.dim})")

    def query(self, text: str, top_k: int = 1) -> tuple[str, float]:
        """
        Return (best_matching_document, similarity_score 0–1).
        Converts L2 distance to a 0-1 cosine-like similarity.
        """
        q_emb = self.model.encode([text], show_progress_bar=False)
        distances, indices = self.index.search(np.array(q_emb, dtype="float32"), k=top_k)

        best_idx = indices[0][0]
        raw_dist = float(distances[0][0])

        # Convert L2 distance → similarity (bounded 0–1)
        similarity = max(0.0, 1.0 - (raw_dist / 4.0))

        return self.documents[best_idx], similarity

    def add_document(self, text: str):
        """Add a new threat pattern at runtime (e.g. from user feedback)."""
        embedding = self.model.encode([text], show_progress_bar=False)
        self.index.add(np.array(embedding, dtype="float32"))
        self.documents.append(text)

    def doc_count(self) -> int:
        return len(self.documents)

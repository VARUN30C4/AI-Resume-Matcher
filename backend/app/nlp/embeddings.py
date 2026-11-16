"""Text embedding backends.

Primary:  Sentence Transformers (all-MiniLM-L6-v2 by default) -> real dense semantic vectors.
Fallback: a deterministic offline embedder (hashed word + char n-grams, enriched with
          skill-taxonomy "concept tokens") used when the transformer model cannot be loaded
          (no internet / model not cached). The rest of the pipeline is identical, only the
          similarity calibration constants differ.

Choose with env vars:
  EMBEDDING_BACKEND = auto | sentence-transformers | offline   (default: auto)
  EMBEDDING_MODEL   = sentence-transformers/all-MiniLM-L6-v2   (default)
"""
from __future__ import annotations

import logging
import os
import threading

import numpy as np
from sklearn.feature_extraction.text import HashingVectorizer

from .skills import category_of, extract_skills

log = logging.getLogger(__name__)


class Embedder:
    name: str = "base"
    kind: str = "base"
    # raw cosine values mapped linearly to [0, 1]: (floor, ceiling)
    calibration: tuple[float, float] = (0.0, 1.0)
    supports_skill_similarity: bool = False

    def encode(self, texts: list[str]) -> np.ndarray:  # L2-normalised rows
        raise NotImplementedError

    def calibrate(self, cosine: float) -> float:
        lo, hi = self.calibration
        return float(min(1.0, max(0.0, (cosine - lo) / (hi - lo))))


class SentenceTransformerEmbedder(Embedder):
    kind = "sentence-transformers"
    # MiniLM cosine between a JD requirement and its best resume line is typically
    # 0.45-0.70 for a genuine match; unrelated text sits around 0.0-0.25.
    calibration = (0.20, 0.65)
    supports_skill_similarity = True

    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer

        self.name = model_name
        self.model = SentenceTransformer(model_name)

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)
        return np.asarray(
            self.model.encode(texts, normalize_embeddings=True, show_progress_bar=False),
            dtype=np.float32,
        )


class OfflineEmbedder(Embedder):
    """Stateless hashed n-gram embedder with taxonomy concept expansion."""

    kind = "offline"
    name = "offline-hashed-ngrams+taxonomy"
    calibration = (0.12, 0.48)
    supports_skill_similarity = False

    def __init__(self, dim: int = 2 ** 14):
        self.words = HashingVectorizer(
            n_features=dim, analyzer="word", ngram_range=(1, 2), alternate_sign=False,
            norm=None, lowercase=True, token_pattern=r"(?u)\b[\w+#.]{2,}\b",
        )
        self.chars = HashingVectorizer(
            n_features=dim, analyzer="char_wb", ngram_range=(4, 5), alternate_sign=False,
            norm=None, lowercase=True,
        )

    @staticmethod
    def _expand(text: str) -> str:
        skills = extract_skills(text)
        concepts = []
        for s in skills:
            concepts.append("skill_" + s.lower().replace(" ", "_"))
            concepts.append("concept_" + category_of(s))
        return text + " " + " ".join(concepts)

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)
        docs = [self._expand(t) for t in texts]
        w = self.words.transform(docs)
        c = self.chars.transform(docs)
        w.data = np.log1p(w.data)
        c.data = np.log1p(c.data)
        mat = (w.multiply(1.0) + c.multiply(0.5)).tocsr()
        norms = np.sqrt(mat.multiply(mat).sum(axis=1)).A1
        norms[norms == 0] = 1.0
        mat = mat.multiply(1.0 / norms[:, None]).tocsr()
        return mat.toarray().astype(np.float32)


_lock = threading.Lock()
_embedder: Embedder | None = None


def get_embedder() -> Embedder:
    global _embedder
    if _embedder is not None:
        return _embedder
    with _lock:
        if _embedder is not None:
            return _embedder
        mode = os.getenv("EMBEDDING_BACKEND", "auto").lower()
        model = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        if mode in ("auto", "sentence-transformers"):
            try:
                _embedder = SentenceTransformerEmbedder(model)
                log.info("Embedding backend: sentence-transformers (%s)", model)
            except Exception as exc:  # no network / model missing / lib missing
                if mode == "sentence-transformers":
                    raise
                log.warning("Could not load %s (%s). Using offline embedder.", model, exc.__class__.__name__)
        if _embedder is None:
            _embedder = OfflineEmbedder()
            log.info("Embedding backend: offline")
        return _embedder


def set_embedder(e: Embedder | None) -> None:  # used by tests
    global _embedder
    _embedder = e

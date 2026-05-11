import hashlib
import math
import re
from typing import List

EMBEDDING_DIM = 256
EMBEDDING_MODEL = "career-os-hash-embed"
EMBEDDING_VERSION = "v1"

WORD_RE = re.compile(r"[\w\-\+\.]{2,}", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return WORD_RE.findall((text or "").lower())


def _bucket(token: str) -> int:
    h = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return int(h[:8], 16) % EMBEDDING_DIM


def embed_text(text: str) -> List[float]:
    vec = [0.0] * EMBEDDING_DIM
    tokens = tokenize(text)
    if not tokens:
        return vec

    for token in tokens:
        idx = _bucket(token)
        vec[idx] += 1.0

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    return max(0.0, min(1.0, sum(x * y for x, y in zip(a, b))))

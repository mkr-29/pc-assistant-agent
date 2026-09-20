"""
Vector memory store providing vector indexing, TF-IDF / subword embeddings,
and cosine similarity semantic search.
"""
import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

class SearchResult(dict):
    """Dict result that also supports tuple unpacking and index subscription (e.g. res[0], res[1])."""
    def __getitem__(self, item):
        if isinstance(item, int):
            if item == 0:
                return self.get("id")
            elif item == 1:
                return self.get("similarity_score")
        return super().__getitem__(item)

class SimpleTextVectorizer:
    """
    Lightweight, self-contained text vectorizer combining word tokens
    and subword character n-grams with TF-IDF weighting and L2 normalization.
    Runs 100% locally with zero external C++ dependencies.
    """

    def __init__(self, ngram_range: Tuple[int, int] = (3, 4)):
        self.ngram_range = ngram_range
        self.doc_count = 0
        self.doc_frequencies: Counter = Counter()

    def _tokenize(self, text: str) -> List[str]:
        """Extract clean word tokens and character n-grams."""
        clean = text.lower()
        words = re.findall(r'\b[a-z0-9_]+\b', clean)

        features = list(words)
        # Subword n-grams for typo resilience and morphological matching
        min_n, max_n = self.ngram_range
        for word in words:
            if len(word) >= min_n:
                for n in range(min_n, min(len(word) + 1, max_n + 1)):
                    for i in range(len(word) - n + 1):
                        features.append(f"#{word[i:i+n]}")

        return features

    def compute_tf(self, text: str) -> Dict[str, float]:
        """Compute term frequency normalized by document length."""
        tokens = self._tokenize(text)
        if not tokens:
            return {}
        counts = Counter(tokens)
        total = len(tokens)
        return {term: count / total for term, count in counts.items()}

    def update_idf(self, documents: List[str]) -> None:
        """Update inverse document frequencies across documents."""
        self.doc_count = len(documents)
        self.doc_frequencies = Counter()
        for doc in documents:
            terms = set(self._tokenize(doc))
            for term in terms:
                self.doc_frequencies[term] += 1

    def fit(self, documents: List[str]) -> None:
        """Fit vocabulary and compute inverse document frequencies."""
        self.update_idf(documents)

    def vectorize(self, text: str) -> Dict[str, float]:
        """Produce an L2-normalized vector from text."""
        tf = self.compute_tf(text)
        if not tf:
            return {}

        vector: Dict[str, float] = {}
        for term, term_tf in tf.items():
            # Standard smoothed IDF
            df = self.doc_frequencies.get(term, 1)
            idf = math.log((self.doc_count + 1) / (df + 1)) + 1.0
            vector[term] = term_tf * idf

        # L2 Normalize
        norm = math.sqrt(sum(v * v for v in vector.values()))
        if norm > 0:
            return {term: v / norm for term, v in vector.items()}
        return vector

    def transform(self, text: str) -> Dict[str, float]:
        """Transform text into normalized TF-IDF vector."""
        return self.vectorize(text)

    @property
    def vocabulary(self) -> List[str]:
        """Return vocabulary features."""
        return list(self.doc_frequencies.keys())

    @staticmethod
    def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
        """Calculate cosine similarity between two unit vectors (dot product)."""
        if not v1 or not v2:
            return 0.0

        # Iterate over smaller dictionary for speed
        smaller, larger = (v1, v2) if len(v1) < len(v2) else (v2, v1)
        dot_product = sum(weight * larger[term] for term, weight in smaller.items() if term in larger)
        return max(0.0, min(1.0, dot_product))

class VectorMemoryStore:
    """
    Vector storage and semantic search engine for knowledge memories.
    Persists document vectors and provides ranked similarity retrieval.
    """

    def __init__(self, storage_path: Optional[str] = None, index_path: Optional[str] = None):
        target_path = index_path or storage_path or ".data/vector_index.json"
        self.storage_path = Path(target_path)
        self.vectorizer = SimpleTextVectorizer()
        self.documents: Dict[str, Dict[str, Any]] = {}
        self._load()

    def count(self) -> int:
        """Return total count of indexed documents."""
        return len(self.documents)

    def _load(self) -> None:
        """Load indexed vectors from disk."""
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.documents = data.get("documents", {})
                    # Recompute IDF based on current docs
                    all_texts = [d["text"] for d in self.documents.values() if "text" in d]
                    self.vectorizer.update_idf(all_texts)
            except Exception:
                self.documents = {}

    def _save(self) -> None:
        """Persist vector index to disk."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump({"documents": self.documents}, f, indent=2)
        except Exception:
            pass

    def add_document(self, doc_id: str, text: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        """Index a document and compute its vector representation."""
        clean_text = str(text or "").strip()
        if not clean_text:
            return

        all_texts = [d["text"] for d in self.documents.values()] + [clean_text]
        self.vectorizer.update_idf(all_texts)

        vector = self.vectorizer.vectorize(clean_text)
        self.documents[doc_id] = {
            "id": doc_id,
            "text": clean_text,
            "vector": vector,
            "metadata": metadata or {}
        }
        self._save()

    index_document = add_document

    def delete_document(self, doc_id: str) -> bool:
        """Remove a document from the vector index."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            all_texts = [d["text"] for d in self.documents.values()]
            self.vectorizer.update_idf(all_texts)
            self._save()
            return True
        return False

    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.05,
        min_similarity: Optional[float] = None
    ) -> List[SearchResult]:
        """
        Perform cosine similarity semantic search across all indexed documents.

        Args:
            query: Natural language query string
            top_k: Maximum number of ranked results
            min_score: Minimum similarity score threshold
            min_similarity: Alias for min_score

        Returns:
            List of matching document SearchResult dicts with similarity_score
        """
        effective_min = min_similarity if min_similarity is not None else min_score
        clean_query = str(query or "").strip()
        if not clean_query or not self.documents:
            return []

        query_vector = self.vectorizer.vectorize(clean_query)
        if not query_vector:
            return []

        scored_results: List[Tuple[float, Dict[str, Any]]] = []

        for doc in self.documents.values():
            doc_vec = doc.get("vector", {})
            similarity = self.vectorizer.cosine_similarity(query_vector, doc_vec)

            if similarity >= effective_min:
                scored_results.append((
                    similarity,
                    {
                        "id": doc["id"],
                        "text": doc["text"],
                        "similarity_score": round(similarity, 4),
                        "metadata": doc.get("metadata", {})
                    }
                ))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [SearchResult(res[1]) for res in scored_results[:top_k]]

    def clear(self) -> None:
        """Clear all documents from the vector store."""
        self.documents.clear()
        self._save()

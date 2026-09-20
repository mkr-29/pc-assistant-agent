"""
Unit tests for Vector Memory Store, Embeddings, and Semantic Search
"""
import os
import shutil
import tempfile
import pytest
from memory.vector_store import SimpleTextVectorizer, VectorMemoryStore
from memory.stores import KnowledgeMemoryStore
from tools.registry import tool_registry

@pytest.fixture
def temp_vector_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)

def test_simple_text_vectorizer():
    vectorizer = SimpleTextVectorizer()
    corpus = [
        "python programming and artificial intelligence",
        "deep learning neural networks and machine intelligence",
        "culinary recipes and cooking italian pasta"
    ]
    vectorizer.fit(corpus)
    assert len(vectorizer.vocabulary) > 0

    vec1 = vectorizer.transform("python artificial intelligence")
    vec2 = vectorizer.transform("machine intelligence and neural networks")
    vec3 = vectorizer.transform("cooking pasta in italy")

    # Vector norms should be ~1.0 (L2 normalized)
    norm1 = sum(v * v for v in vec1.values()) ** 0.5
    assert 0.99 <= norm1 <= 1.01

    # Dot products for semantic similarity
    sim_tech = sum(vec1.get(t, 0.0) * vec2.get(t, 0.0) for t in vec1)
    sim_unrelated = sum(vec1.get(t, 0.0) * vec3.get(t, 0.0) for t in vec1)
    assert sim_tech > sim_unrelated

def test_vector_memory_store(temp_vector_dir):
    index_path = os.path.join(temp_vector_dir, "test_vector_index.json")
    store = VectorMemoryStore(index_path=index_path)

    store.index_document("mem_1", "User prefers dark mode and high contrast themes in VS Code")
    store.index_document("mem_2", "Project uses Python 3.14 with LangGraph and FastAPI")
    store.index_document("mem_3", "User likes to drink Earl Grey tea in the morning")

    assert store.count() == 3

    # Query matching coding / python
    results = store.search("python programming language", top_k=2, min_similarity=0.05)
    assert len(results) >= 1
    assert results[0][0] == "mem_2"

    # Query matching editor theme
    theme_results = store.search("VS Code theme darkmode", top_k=2, min_similarity=0.05)
    assert len(theme_results) >= 1
    assert theme_results[0][0] == "mem_1"

    # Test deletion
    deleted = store.delete_document("mem_3")
    assert deleted is True
    assert store.count() == 2

    # Verify persistence by reloading
    reloaded_store = VectorMemoryStore(index_path=index_path)
    assert reloaded_store.count() == 2
    assert "mem_3" not in reloaded_store.documents

def test_knowledge_memory_store_semantic_search(temp_vector_dir):
    km_path = os.path.join(temp_vector_dir, "knowledge.json")
    vec_path = os.path.join(temp_vector_dir, "vector.json")

    km = KnowledgeMemoryStore(file_path=km_path, vector_index_path=vec_path)

    km.addMemory("The deployment server IP is 192.168.1.100 running Ubuntu 24.04")
    km.addMemory("Database PostgreSQL port is 5432 with replica on 5433")
    km.addMemory("Favourite color is midnight blue")

    # Perform semantic search
    matches = km.semanticSearchMemories("Postgres database configuration", top_k=2, min_similarity=0.05)
    assert len(matches) >= 1
    assert "PostgreSQL" in matches[0]["fact"]
    assert "similarity_score" in matches[0]

    # Semantic search with query matching nothing relevant
    empty_matches = km.semanticSearchMemories("quantum astrophysics supernova", min_similarity=0.8)
    assert len(empty_matches) == 0

def test_semantic_search_tool_registered(temp_vector_dir):
    assert "semantic_search_knowledge_memories" in tool_registry.tools
    tool_entry = tool_registry.get_tool("semantic_search_knowledge_memories")
    assert tool_entry is not None
    assert callable(tool_entry)
    assert "semantic_search_knowledge_memories" in tool_registry._tool_categories.get("memory", [])

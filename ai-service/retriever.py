"""
retriever.py
=============
Cari pasal yang relevan dari database berdasarkan pertanyaan user.
Menggunakan BM25 (keyword search) — tidak butuh AI atau API key.

Cara pakai standalone:
    python retriever.py "status pegawai tetap setelah 5 tahun kerja"
"""

import sqlite3
import re
import math
from pathlib import Path
from collections import Counter

DB_PATH = Path("data/uu_database.db")


# =============================================================================
# BM25 — Algoritma pencarian teks (tanpa AI, tanpa API)
# =============================================================================

class BM25:
    """
    BM25 ranking algorithm untuk pencarian teks.
    Lebih akurat dari simple keyword matching untuk teks hukum.
    """
    def __init__(self, k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b  = b

    def tokenize(self, text: str) -> list[str]:
        """Tokenisasi sederhana: lowercase, split kata."""
        text = text.lower()
        # Hapus karakter non-alfanumerik kecuali spasi
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        tokens = text.split()
        # Hapus stopwords Bahasa Indonesia yang umum
        stopwords = {
            'yang', 'dan', 'di', 'ke', 'dari', 'dalam', 'untuk',
            'adalah', 'ini', 'itu', 'dengan', 'pada', 'atau', 'juga',
            'saya', 'aku', 'kamu', 'dia', 'mereka', 'kita', 'kami',
            'tidak', 'bisa', 'akan', 'sudah', 'telah', 'sedang',
            'ada', 'oleh', 'sebagai', 'lebih', 'dapat', 'setelah',
            'serta', 'bahwa', 'tersebut', 'antara', 'setiap', 'karena'
        }
        return [t for t in tokens if t not in stopwords and len(t) > 1]

    def score(self, query_tokens: list[str],
              doc_tokens: list[str],
              avg_doc_len: float,
              doc_freq: dict,
              total_docs: int) -> float:
        """Hitung BM25 score untuk satu dokumen."""
        score   = 0.0
        doc_len = len(doc_tokens)
        tf_map  = Counter(doc_tokens)

        for token in query_tokens:
            if token not in tf_map:
                continue

            # Term frequency
            tf = tf_map[token]
            tf_norm = (tf * (self.k1 + 1)) / (
                tf + self.k1 * (1 - self.b + self.b * doc_len / avg_doc_len)
            )

            # Inverse document frequency
            df  = doc_freq.get(token, 0)
            idf = math.log((total_docs - df + 0.5) / (df + 0.5) + 1)

            score += idf * tf_norm

        return score


# =============================================================================
# RETRIEVER UTAMA
# =============================================================================

def retrieve_docs(question: str, top_k: int = 5) -> list[dict]:
    """
    Cari pasal paling relevan berdasarkan pertanyaan user.

    Parameters:
        question : pertanyaan dari user (bahasa bebas)
        top_k    : jumlah pasal teratas yang dikembalikan

    Returns:
        list of dict berisi pasal-pasal relevan + metadata
    """
    if not DB_PATH.exists():
        print(f"❌ Database tidak ditemukan: {DB_PATH}")
        return []

    conn   = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Ambil semua chunks dari database
    cursor.execute("""
        SELECT id, uu_id, judul, tentang, bab, pasal, isi, sumber
        FROM peraturan
    """)
    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return []

    # Inisialisasi BM25
    bm25 = BM25()
    query_tokens = bm25.tokenize(question)

    if not query_tokens:
        return []

    # Tokenisasi semua dokumen
    docs_tokens = [bm25.tokenize(row[6]) for row in rows]  # row[6] = isi

    # Hitung statistik untuk BM25
    total_docs  = len(docs_tokens)
    avg_doc_len = sum(len(d) for d in docs_tokens) / total_docs if total_docs else 1

    # Document frequency: berapa dokumen yang mengandung tiap token
    doc_freq = {}
    for tokens in docs_tokens:
        for token in set(tokens):
            doc_freq[token] = doc_freq.get(token, 0) + 1

    # Score semua dokumen
    scored = []
    for i, (row, doc_tokens) in enumerate(zip(rows, docs_tokens)):
        score = bm25.score(
            query_tokens, doc_tokens,
            avg_doc_len, doc_freq, total_docs
        )
        if score > 0:
            scored.append((score, row))

    # Sort by score tertinggi
    scored.sort(key=lambda x: x[0], reverse=True)

    # Ambil top_k
    results = []
    for score, row in scored[:top_k]:
        results.append({
            "id"      : row[0],
            "uu_id"   : row[1],
            "judul"   : row[2],
            "tentang" : row[3],
            "bab"     : row[4],
            "pasal"   : row[5],
            "isi"     : row[6],
            "sumber"  : row[7],
            "score"   : round(score, 4)
        })

    return results


def format_for_prompt(docs: list[dict]) -> str:
    """
    Format hasil retrieval menjadi teks yang siap di-inject ke prompt.
    Dipanggil oleh prompt_builder.py
    """
    if not docs:
        return "Tidak ada dokumen hukum yang relevan ditemukan."

    formatted = []
    for doc in docs:
        formatted.append(
            f"--- {doc['judul']} ---\n"
            f"{doc['pasal']}\n"
            f"{doc['isi']}\n"
            f"[Sumber: {doc['sumber']}]"
        )

    return "\n\n".join(formatted)


def get_available_uu() -> list[dict]:
    """
    Tampilkan daftar UU yang tersedia di database.
    Berguna untuk logging dan debugging.
    """
    if not DB_PATH.exists():
        return []

    conn   = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT uu_id, judul, tentang, COUNT(*) as jumlah_pasal
        FROM peraturan
        GROUP BY uu_id
        ORDER BY uu_id
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "uu_id"        : row[0],
            "judul"        : row[1],
            "tentang"      : row[2],
            "jumlah_pasal" : row[3]
        }
        for row in rows
    ]


# =============================================================================
# TEST LANGSUNG DARI TERMINAL
# =============================================================================

if __name__ == "__main__":
    import sys

    # Cek database tersedia
    uu_list = get_available_uu()
    if not uu_list:
        print("❌ Database kosong atau tidak ditemukan.")
        print("   Jalankan dulu: python scraper_pipeline.py")
        sys.exit(1)

    print("📚 UU tersedia di database:")
    for uu in uu_list:
        print(f"   [{uu['uu_id']}] {uu['judul']} — {uu['jumlah_pasal']} pasal")

    # Ambil pertanyaan dari argument atau pakai default
    if len(sys.argv) > 1:
        question = " ".join(sys.argv[1:])
    else:
        question = "status pegawai tetap setelah 5 tahun bekerja"

    print(f"\n🔍 Pertanyaan : {question}")
    print("-" * 50)

    results = retrieve_docs(question, top_k=3)

    if not results:
        print("❌ Tidak ada hasil ditemukan.")
    else:
        print(f"✅ Ditemukan {len(results)} pasal relevan:\n")
        for i, doc in enumerate(results, 1):
            print(f"[{i}] {doc['judul']} — {doc['pasal']} (score: {doc['score']})")
            print(f"    {doc['isi'][:200]}...")
            print()

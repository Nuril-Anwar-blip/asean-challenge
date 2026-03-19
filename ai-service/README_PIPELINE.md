# AI Service — Panduan Menjalankan

## Struktur Folder

```
ai-service/
├── scraper_pipeline.py   ← konversi PDF/DOCX → database
├── retriever.py          ← cari pasal relevan dari database
├── requirements.txt      ← semua dependency
├── data/
│   ├── raw/              ← TARUH FILE PDF/DOCX KAMU DI SINI
│   └── uu_database.db    ← database hasil pipeline (auto-dibuat)
└── .env                  ← API key (nanti)
```

---

## Langkah 1 — Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Langkah 2 — Taruh File UU

Taruh semua file PDF atau DOCX kamu ke folder `data/raw/`:

```
data/raw/
├── uu_cipta_kerja_2023.pdf
├── uu_ketenagakerjaan_2003.pdf
├── uu_perlindungan_konsumen_1999.docx
└── kuh_perdata.pdf
```

Nama file bebas — sistem akan auto-detect formatnya.

---

## Langkah 3 — Jalankan Pipeline Konversi

```bash
python scraper_pipeline.py
```

Output yang diharapkan:
```
=======================================================
🚀 SCRAPER PIPELINE — Konversi UU ke Database
=======================================================
✅ Database siap: data/uu_database.db

📁 Ditemukan 3 file di data/raw/

📄 Memproses file: uu_cipta_kerja_2023.pdf
   ID      : uu_cipta_kerja_2023
   Tentang : uu_cipta_kerja_2023
   Teks    : 85432 karakter diekstrak
   Chunks  : 127 pasal ditemukan
   ✅ 127 pasal berhasil disimpan

=======================================================
📊 RINGKASAN DATABASE
=======================================================
  [uu_cipta_kerja_2023]
   uu_cipta_kerja_2023 — uu_cipta_kerja_2023
   127 pasal tersimpan

  TOTAL: 127 pasal dari 1 UU
=======================================================

✅ Pipeline selesai! Database siap dipakai retriever.
```

---

## Langkah 4 — Test Retriever

```bash
# Test dengan pertanyaan default
python retriever.py

# Test dengan pertanyaan kamu sendiri
python retriever.py "status pegawai tetap setelah 5 tahun kerja"
python retriever.py "hak konsumen kalau barang rusak"
python retriever.py "syarat perjanjian kerja waktu tertentu"
```

Output yang diharapkan:
```
📚 UU tersedia di database:
   [uu_cipta_kerja_2023] UU No.6 Tahun 2023 — 127 pasal

🔍 Pertanyaan : status pegawai tetap setelah 5 tahun kerja
--------------------------------------------------
✅ Ditemukan 3 pasal relevan:

[1] UU No.6 Tahun 2023 — Pasal 59 (score: 8.2341)
    Perjanjian kerja untuk waktu tertentu hanya dapat dibuat...

[2] UU No.6 Tahun 2023 — Pasal 56 (score: 6.1204)
    Perjanjian kerja dibuat untuk waktu tertentu atau...
```

---

## Tips Troubleshooting

**"Tidak ada pasal yang terdeteksi"**
→ Pastikan PDF-mu mengandung teks "Pasal X" di dalamnya
→ Cek apakah PDF bisa dibuka dan teksnya bisa di-select di PDF reader
→ Kalau PDF scan, perlu OCR dulu (lihat catatan di requirements.txt)

**"Database tidak ditemukan"**
→ Pastikan sudah jalankan `python scraper_pipeline.py` dulu

**"Teks sangat sedikit — kemungkinan PDF scan"**
→ PDF-mu kemungkinan hasil scan, bukan teks digital
→ Cari versi teks dari sumber lain (hukumonline, dpr.go.id)
→ Atau aktifkan OCR di requirements.txt

---

## Setelah Database Siap

Lanjut ke pengembangan:
- `prompt_builder.py` — rakit prompt untuk DeepSeek
- `deepseek_client.py` — koneksi ke DeepSeek API
- `main.py` — FastAPI endpoint untuk teman backend

<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Chat;
use App\Models\Message;

class ApilaController extends Controller
{
    private function getAiServiceBaseUrl(): string
    {
        return rtrim((string) env('AI_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
    }

    /**
     * Menampilkan antarmuka obrolan APILA.
     */
    public function index()
    {
        return Inertia::render('Apila/Index');
    }

    /**
     * Menangani pengiriman pesan dari sistem frontend.
     * Mendukung: text, gambar, PDF, Word document
     */
    public function store(Request $request)
    {
        $request->validate([
            'message' => 'nullable|string|required_without:file',
            'file' => 'nullable|file|max:10240',
        ]);

        $userMessage = trim((string) $request->input('message', ''));
        $file = $request->file('file');

        try {
            // Jika ada file, proses dengan endpoint document
            if ($file) {
                $response = $this->processWithDocument($userMessage, $file);
            } else {
                // Chat normal tanpa dokumen
                $response = $this->chatWithAI($userMessage);
            }

            if (($response['status'] ?? null) === 'success') {
                return response()->json([
                    'status' => 'success',
                    'data' => [
                        'role' => 'ai',
                        'content' => $response['data']['content'] ?? 'Terjadi kesalahan pada sistem AI.',
                        'sources' => $response['data']['sources'] ?? []
                    ]
                ]);
            }
        } catch (\Exception $e) {
            Log::error('APILA Error: ' . $e->getMessage());
        }

        // Fallback respons
        return $this->generateFallbackResponse($userMessage);
    }

    /**
     * Proses pesan dengan dokumen (gambar, PDF, Word)
     */
    private function processWithDocument(string $question, $file): array
    {
        try {
            // Validasi tipe file
            $allowedTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            $mimeType = $file->getMimeType();
            if (!in_array($mimeType, $allowedTypes)) {
                throw new \Exception('Tipe file tidak didukung');
            }

            // Kirim ke Python API
            $response = Http::timeout(60)->attach(
                'file',
                file_get_contents($file->getRealPath()),
                $file->getClientOriginalName()
            )->post($this->getAiServiceBaseUrl() . '/process-document', [
                'question' => $question,
            ]);

            if ($response->successful()) {
                return $this->normalizeAiServiceResponse($response->json(), true);
            }
        } catch (\Exception $e) {
            Log::error('Document processing error: ' . $e->getMessage());
        }

        return ['status' => 'error'];
    }

    /**
     * Chat normal tanpa dokumen
     */
    private function chatWithAI(string $message): array
    {
        try {
            $response = Http::timeout(30)->post($this->getAiServiceBaseUrl() . '/chat', [
                'message' => $message,
                'history' => []
            ]);

            if ($response->successful()) {
                return $this->normalizeAiServiceResponse($response->json(), false);
            }
        } catch (\Exception $e) {
            Log::error('AI Chat error: ' . $e->getMessage());
        }

        return ['status' => 'error'];
    }

    /**
     * Normalisasi format respons AI service agar seragam ke frontend.
     */
    private function normalizeAiServiceResponse(array $payload, bool $isDocumentRequest): array
    {
        // Format v2 /chat -> {content, sources}
        if (isset($payload['content']) && is_string($payload['content'])) {
            return [
                'status' => 'success',
                'data' => [
                    'content' => $payload['content'],
                    'sources' => $payload['sources'] ?? [],
                ],
            ];
        }

        // Format /process-document -> {status, response, sources}
        if (
            ($payload['status'] ?? null) === 'success'
            && isset($payload['response'])
            && is_string($payload['response'])
        ) {
            return [
                'status' => 'success',
                'data' => [
                    'content' => $payload['response'],
                    'sources' => $payload['sources'] ?? [],
                ],
            ];
        }

        // Jika dokumen hanya diekstrak tanpa jawaban, beri respons informatif.
        if (
            $isDocumentRequest
            && ($payload['status'] ?? null) === 'success'
            && isset($payload['extracted_text'])
            && is_string($payload['extracted_text'])
        ) {
            return [
                'status' => 'success',
                'data' => [
                    'content' => "Dokumen berhasil diproses.\n\nRingkasan isi:\n" . $payload['extracted_text'],
                    'sources' => [],
                ],
            ];
        }

        return ['status' => 'error'];
    }

    /**
     * Generate fallback response
     */
    private function generateFallbackResponse(string $question): \Illuminate\Http\JsonResponse
    {
        $questionLower = strtolower($question);

        if ($this->containsKeyword($questionLower, ['pekerja', 'karyawan', 'tenaga kerja', 'ketenagakerjaan', 'phk', 'upah'])) {
            $content = $this->getKetenagakerjaanResponse();
        } elseif ($this->containsKeyword($questionLower, ['kontrak', 'perjanjian', 'surat perjanjian'])) {
            $content = $this->getKontrakResponse();
        } elseif ($this->containsKeyword($questionLower, ['izin', 'usaha', 'pendirian', 'pt', 'cv', 'company'])) {
            $content = $this->getIzinUsahaResponse();
        } elseif ($this->containsKeyword($questionLower, ['pidana', 'kriminal', 'penjara', 'laporan', 'polisi'])) {
            $content = $this->getPidanaResponse();
        } elseif ($this->containsKeyword($questionLower, ['perceraian', 'cerai', 'pernikahan', 'keluarga', 'nikah'])) {
            $content = $this->getPerceraianResponse();
        } elseif ($this->containsKeyword($questionLower, ['tanah', 'property', 'rumah', 'sertifikat', 'shm', 'shgb', 'bangunan'])) {
            $content = $this->getPertanahanResponse();
        } elseif ($this->containsKeyword($questionLower, ['umkm', 'usaha', 'bisnis', 'dagang', 'entrepreneur'])) {
            $content = $this->getUmkmResponse();
        } else {
            $content = $this->getDefaultResponse();
        }

        return response()->json([
            'status' => 'success',
            'data' => [
                'role' => 'ai',
                'content' => $content,
                'sources' => [
                    ['title' => 'UUD 1945 Pasal 1', 'snippet' => 'Negara Indonesia Negeri Kesatuan, yang berbentuk Republik.'],
                    ['title' => 'UUD 1945 Pasal 28D', 'snippet' => 'Setiap orang berhak atas perlindungan diri pribadi, keluarga, kehormatan, martabat, dan hak miliknya.']
                ]
            ]
        ]);
    }

    private function containsKeyword(string $text, array $keywords): bool
    {
        foreach ($keywords as $keyword) {
            if (strpos($text, $keyword) !== false) {
                return true;
            }
        }
        return false;
    }

    private function getKetenagakerjaanResponse(): string
    {
        return "Berdasarkan **UU No. 13 Tahun 2003 tentang Ketenagakerjaan**:\n\n" .
            "Beberapa hak dasar pekerja antara lain:\n\n" .
            "1. **Upah** - Pekerja berhak atas upah yang layak dan sesuai dengan perjanjian kerja\n\n" .
            "2. **Jaminan Sosial** - BPJS Kesehatan dan BPJS Ketenagakerjaan\n\n" .
            "3. **Cuti** - Termasuk cuti tahunan, cuti sakit, dan cuti melahirkan\n\n" .
            "4. **Keselamatan Kerja** - Lingkungan kerja yang aman dan sehat\n\n" .
            "5. **Pesangon** - Jika terjadi PHK yang tidak sesuai prosedur\n\n" .
            "Untuk informasi lebih lanjut, Anda dapat menghubungi Dinas Tenaga Kerja terdekat.";
    }

    private function getKontrakResponse(): string
    {
        return "Mengenai **kontrak/perjanjian**, berikut hal-hal penting yang perlu Anda perhatikan:\n\n" .
            "1. **Objek Perjanjian** - Apa yang menjadi subjek agreement\n\n" .
            "2. **Para Pihak** - Identitas lengkap kedua belah pihak\n\n" .
            "3. **Hak dan Kewajiban** - Setiap pihak harus jelas hak dan kewajibannya\n\n" .
            "4. **Jangka Waktu** - Mulai dan berakhir kapan\n\n" .
            "5. **Penyelesaian Sengketa** - Bagaimana jika terjadi perselisihan\n\n" .
            "Sangat disarankan untuk konsultasi dengan notaris atau lawyer untuk kontrak bernilai besar.";
    }

    private function getIzinUsahaResponse(): string
    {
        return "Untuk **mendirikan izin usaha**, berikut persyaratan umumnya:\n\n" .
            "1. **Akta Pendirian** - Dari Notaris (untuk PT/CV)\n\n" .
            "2. **SK Kemenkumham** - Untuk legalitas badan hukum\n\n" .
            "3. **NPWP** - Nomor Pokok Wajib Pajak\n\n" .
            "4. **NIB** - Nomor Induk Berusaha (melalui OSS)\n\n" .
            "5. **Izin Khusus** - Sesuai sektor usaha (IUJK, dll)\n\n" .
            "Anda dapat mengurus ini melalui sistem OSS (Online Single Submission) di oss.go.id";
    }

    private function getPidanaResponse(): string
    {
        return "Mengenai **pidana/kriminal**:\n\n" .
            "1. **Laporan Polisi** - Dapat diajukan di kepolisian terdekat dengan membawa kronologi dan bukti\n\n" .
            "2. **SPKT** - Surat Pemberitahuan dimulainya Penyidikan\n\n" .
            "3. **Penuntut Umum** - Jaksa akan menuntut di pengadilan\n\n" .
            "4. **Pengacara** - Sangat disarankan untuk memiliki kuasa hukum\n\n" .
            "Untuk bantuan hukum gratis, Anda dapat menghubungi **LBH (Lembaga Bantuan Hukum)** terdekat.";
    }

    private function getPerceraianResponse(): string
    {
        return "Mengenai **perceraian dan keluarga** berdasarkan **UU No. 1 Tahun 1974**:\n\n" .
            "Perceraian dapat dilakukan melalui:\n\n" .
            "1. **Gugatan Cerai** - Melalui Pengadilan Negeri\n\n" .
            "2. **Permohonan Cerai Talak** - Melalui Pengadilan Agama (untuk Muslim)\n\n" .
            "**SYARAT utama:**\n" .
            "- Alasan yang sah (zina, kekerasan, dll)\n" .
            "- Upaya perdamaian yang tidak berhasil\n" .
            "- Minimal 2 tahun pernikahan\n\n" .
            "Disarankan untuk konsultasi dengan pengacara.";
    }

    private function getPertanahanResponse(): string
    {
        return "Mengenai **pertanahan dan property**:\n\n" .
            "**Jenis Hak atas Tanah:**\n\n" .
            "1. **SHM (Hak Milik)** - Hak tertinggi, bisa dipergunakan selamanya\n\n" .
            "2. **SHGB (Hak Guna Bangunan)** - Biasa 30 tahun, bisa diperpanjang\n\n" .
            "3. **HGU (Hak Guna Usaha)** - Untuk pertanian/perkembangan\n\n" .
            "4. **Hak Pakai** - Untuk penggunaan tertentu\n\n" .
            "Pastikan sertifikat tanah terverifikasi di BPN (Badan Pertanahan Nasional).";
    }

    private function getUmkmResponse(): string
    {
        return "Untuk **UMKM dan bisnis**, berikut dukungan hukum yang tersedia:\n\n" .
            "1. **UU No. 20 Tahun 2008** - Definisi dan pemberdayaan UMKM\n\n" .
            "2. **Peraturan Pemerintah** - Larangan monopoli dan persaingan usaha tidak sehat\n\n" .
            "3. **Perlindungan Konsumen** - UU No. 8 Tahun 1999\n\n" .
            "4. **Pembiayaan** - Akses ke bank dan lembaga keuangan mikro\n\n" .
            "Dapatkan bantuan melalui **KUKM** (Koperasi dan UKM) di daerah Anda.";
    }

    private function getDefaultResponse(): string
    {
        return "Terima kasih atas pertanyaan Anda. Untuk informasi hukum yang lebih akurat dan lengkap, saya sarankan Anda:\n\n" .
            "1. Mengunjungi website resmi pemerintah seperti **djpp.kemenkumham.go.id**\n\n" .
            "2. Berkonsultasi dengan **Legal Aid Institute (LBH)** terdekat\n\n" .
            "3. Menghubungi pihak yang lebih kompeten untuk kasus spesifik Anda\n\n" .
            "**Disclaimer:** Jawaban ini hanya untuk informasi umum, bukan saran hukum resmi.";
    }
}

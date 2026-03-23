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
    private function getAiServiceProvider(): string
    {
        return (string) env('AI_SERVICE_PROVIDER', 'ai-service');
    }

    private function getAiServiceBaseUrl(): string
    {
        $provider = $this->getAiServiceProvider();

        if ($provider === 'ai-asean') {
            return rtrim((string) env('AI_ASEAN_URL', 'http://127.0.0.1:8000'), '/');
        }

        return rtrim((string) env('AI_SERVICE_URL', 'http://127.0.0.1:8001'), '/');
    }

    private function isUsingAiAsean(): bool
    {
        return $this->getAiServiceProvider() === 'ai-asean';
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
            // Check which provider is configured
            if ($this->isUsingAiAsean()) {
                // Use AI-ASEAN service
                if ($file) {
                    $response = $this->processWithDocumentAsean($userMessage, $file);
                } else {
                    $response = $this->chatWithAiAsean($userMessage);
                }
            } else {
                // Use ai-service (default)
                if ($file) {
                    $response = $this->processWithDocument($userMessage, $file);
                } else {
                    $response = $this->chatWithAI($userMessage);
                }
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
     * Chat dengan AI-ASEAN service (port 8002)
     * Menggunakan endpoint /chat yang kompatibel dengan format ApilaController
     */
    private function chatWithAiAsean(string $message): array
    {
        try {
            // Menggunakan endpoint /chat (format sama dengan ai-service)
            $response = Http::timeout(30)->post($this->getAiServiceBaseUrl() . '/chat', [
                'message' => $message,
                'history' => []
            ]);

            if ($response->successful()) {
                return $this->normalizeAiServiceResponse($response->json(), false);
            }
        } catch (\Exception $e) {
            Log::error('AI-ASEAN Chat error: ' . $e->getMessage());
        }

        return ['status' => 'error'];
    }

    /**
     * Proses dokumen dengan AI-ASEAN service (port 8002)
     * Menggunakan endpoint /process-document yang kompatibel
     */
    private function processWithDocumentAsean(string $question, $file): array
    {
        try {
            // Mendukung lebih banyak tipe file sekarang
            $allowedTypes = [
                'application/pdf',
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            ];

            $mimeType = $file->getMimeType();
            if (!in_array($mimeType, $allowedTypes)) {
                throw new \Exception('Tipe file tidak didukung: ' . $mimeType);
            }

            // Menggunakan endpoint /process-document (format sama dengan ai-service)
            $response = Http::timeout(60)->attach(
                'file',
                file_get_contents($file->getRealPath()),
                $file->getClientOriginalName()
            )->post($this->getAiServiceBaseUrl() . '/process-document', [
                'question' => $question
            ]);

            if ($response->successful()) {
                return $this->normalizeAiServiceResponse($response->json(), true);
            }
        } catch (\Exception $e) {
            Log::error('AI-ASEAN Document processing error: ' . $e->getMessage());
        }

        return ['status' => 'error'];
    }

    // Note: normalizeAiAseanResponse sudah tidak digunakan karena
    // sekarang menggunakan format yang sama dengan ai-service (/chat dan /process-document)
    // Fungsi normalizeAiServiceResponse sudah menangani format ini

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
     * Mendukung berbagai format: {content, sources} atau {answer, sources}
     */
    private function normalizeAiServiceResponse(array $payload, bool $isDocumentRequest): array
    {
        // Format /chat baru -> {content, sources}
        if (isset($payload['content']) && is_string($payload['content'])) {
            return [
                'status' => 'success',
                'data' => [
                    'content' => $payload['content'],
                    'sources' => $payload['sources'] ?? [],
                ],
            ];
        }

        // Format AI-ASEAN /chat -> {answer, sources}
        if (isset($payload['answer']) && is_string($payload['answer'])) {
            return [
                'status' => 'success',
                'data' => [
                    'content' => $payload['answer'],
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
        return "Berdasarkan UU No. 13 Tahun 2003 tentang Ketenagakerjaan dan regulasi cipta kerja terbaru:\n\n" .
            "Hukum ketenagakerjaan di Indonesia didesain untuk memberikan keseimbangan dan pelindungan yang adil bagi pengusaha maupun pekerja. Perjanjian kerja, baik PKWT (Kontrak) maupun PKWTT (Tetap), merupakan landasan utama yang harus disepakati secara tertulis.\n\n" .
            "Beberapa hak dasar pekerja antara lain:\n" .
            "1. Hak Atas Upah - Pekerja berhak atas upah yang layak dan minimal sesuai dengan UMP/UMK daerah terkait.\n" .
            "2. Jaminan Sosial - Pekerja wajib didaftarkan pada BPJS Kesehatan dan BPJS Ketenagakerjaan oleh perusahaan.\n" .
            "3. Hak Cuti - Meliputi cuti tahunan (minimal 12 hari), cuti sakit dengan surat keterangan dokter, dan cuti melahirkan.\n" .
            "4. Keselamatan Kerja - Pekerja berhak atas lingkungan kerja yang menerapkan K3 (Kesehatan dan Keselamatan Kerja).\n" .
            "5. Pesangon - Apabila terjadi Pemutusan Hubungan Kerja (PHK), pekerja memiliki hak atas uang pesangon, penghargaan masa kerja, dan penggantian hak sesuai UU.\n\n" .
            "Saran Praktis:\n" .
            "Jika Anda mengalami perselisihan hubungan industrial (misal: penahanan ijazah, upah di bawah UMR, atau PHK sepihak), kumpulkan semua bukti kerja (kontrak, slip gaji). Anda bisa memulai dengan perundingan bipartit dengan HRD, dan jika gagal, segera buat laporan tertulis ke Dinas Tenaga Kerja (Disnaker) setempat untuk dimediasi.";
    }

    private function getKontrakResponse(): string
    {
        return "Mengenai hukum kontrak dan perjanjian (Hukum Perikatan), hal ini diatur secara utama dalam Kitab Undang-Undang Hukum Perdata (KUHPerdata). Berdasarkan Pasal 1320 KUHPerdata, suatu perjanjian dianggap sah di mata hukum apabila memenuhi empat syarat kumulatif: adanya kesepakatan kedua belah pihak, kecakapan untuk membuat perikatan, suatu hal (objek) tertentu, dan suatu sebab atau tujuan yang halal.\n\n" .
            "Berikut prinsip dan hal krusial yang perlu Anda perhatikan sebelum menandatangani kontrak:\n" .
            "1. Objek Perjanjian Harus Jelas - Pastikan barang, jasa, atau nilai yang menjadi subjek kesepakatan tertulis sangat berdasar, terukur, dan tidak melanggar hukum.\n" .
            "2. Identitas Para Pihak - Cantumkan KTP, kedudukan hukum, serta pastikan pihak tersebut memang berwenang menandatangani kontrak.\n" .
            "3. Hak, Kewajiban & Sanksi - Setiap belah pihak harus tertulis jelas apa yang didapat, apa yang harus dilakukan, serta konsekuensi denda bila melanggar (wanprestasi).\n" .
            "4. Klausul Penyelesaian Sengketa - Jelaskan secara spesifik apakah perselisihan akan diselesaikan secara musyawarah, melalui Badan Arbitrase (BANI), atau melalui jalur Pengadilan Negeri.\n\n" .
            "Saran Praktis:\n" .
            "Selalu baca seluruh draf klausa kontrak berulang kali sebelum tanda tangan. Jika kontrak ini bernilai besar atau berisiko tinggi bagi bisnis/aset Anda, sangat disarankan untuk menyewa jasa _Legal Counsel_ atau berkonsultasi dengan Notaris guna meninjau draf tersebut agar Anda terlindungi dari celah hukum di masa depan.";
    }

    private function getIzinUsahaResponse(): string
    {
        return "Berdasarkan regulasi terkait perizinan usaha di Indonesia (termasuk UU Cipta Kerja dan PP Penyelenggaraan Perizinan Berusaha Berbasis Risiko), berikut adalah panduan lengkap dan persyaratan untuk mendirikan izin usaha:\n\n" .
            "1. Akta Pendirian Perusahaan\n" .
            "Ini adalah dokumen hukum autentik yang dibuat oleh Notaris. Akta ini berfungsi sebagai 'bukti lahirnya' suatu badan usaha (seperti PT, CV, atau Firma). Di dalamnya tertuang kesepakatan para pendiri, modal awal, struktur pengurus (Direktur & Komisaris), serta bidang usaha yang akan dijalankan.\n\n" .
            "2. SK Kemenkumham (Surat Keputusan Kementerian Hukum dan HAM)\n" .
            "Setelah Notaris membuat Akta Pendirian, akta tersebut harus didaftarkan ke sistem AHU (Administrasi Hukum Umum) Kemenkumham. SK ini sangat penting karena merupakan pengesahan resmi dari negara yang memberikan status 'Badan Hukum' yang sah bagi perusahaan Anda.\n\n" .
            "3. NPWP Badan (Nomor Pokok Wajib Pajak)\n" .
            "Sebagai entitas hukum, perusahaan Anda wajib memiliki identitas pajak sendiri yang terpisah dari pendirinya. NPWP Badan ini mutlak diperlukan untuk mengurus perizinan selanjutnya dan untuk pelaporan pajak usaha (seperti PPh dan PPN).\n\n" .
            "4. NIB (Nomor Induk Berusaha)\n" .
            "NIB adalah identitas tunggal pelaku usaha (seperti KTP untuk perusahaan) yang diterbitkan secara elektronik melalui sistem OSS (Online Single Submission). NIB sekaligus berlaku sebagai Angka Pengenal Impor (API) dan Hak Akses Kepabeanan jika Anda melakukan ekspor-impor, serta bukti pendaftaran jaminan sosial (BPJS).\n\n" .
            "5. Izin Khusus / Izin Komersial\n" .
            "Bergantung pada tingkat risiko bisnis Anda (Rendah, Menengah, atau Tinggi), Anda mungkin memerlukan izin tambahan dari kementerian terkait, misalnya Sertifikat Halal, Izin Edar BPOM (untuk makanan/obat), atau IUJK (untuk jasa konstruksi).\n\n" .
            "Saran Praktis:\n" .
            "Langkah pertama yang harus Anda lakukan adalah menentukan nama perusahaan dan bidang usaha, lalu kunjungi Notaris terdekat untuk membuat Akta Pendirian. Setelah SK Kemenkumham dan NPWP terbit, Anda dapat mendaftarkan NIB perusahaan Anda secara gratis dan mandiri melalui portal resmi pemerintah di oss.go.id.";
    }

    private function getPidanaResponse(): string
    {
        return "Terkait masalah Hukum Pidana (tindak kejahatan seperti penipuan, penggelapan, pencurian, atau kekerasan), sistem peradilan pidana di Indonesia diatur dalam Kitab Undang-Undang Hukum Acara Pidana (KUHAP).\n\n" .
            "Dalam kasus pidana, negara yang akan bertindak mengeksekusi pelanggar melalui aparat penegak hukum, alih-alih penyelesaian privat seperti kasus perdata.\n\n" .
            "1. Laporan Polisi & Penyelidikan\n" .
            "Proses dimulai ketika adanya Laporan atau Pengaduan ke Kepolisian. Polisi kemudian menelusuri apakah peristiwa tersebut merupakan tindak pidana (Penyelidikan).\n" .
            "2. Penyidikan & Penetapan Tersangka\n" .
            "Jika ditemukan unsur pidana, status naik ke Penyidikan (ditandai dengan dokumen SPDP - Surat Pemberitahuan Dimulainya Penyidikan). Di tahap ini, polisi mengumpulkan bukti untuk menetapkan tersangka.\n" .
            "3. Penuntutan oleh Kejaksaan\n" .
            "Bila berkas perkara kepolisian dinyatakan lengkap (P21), tersangka dilimpahkan ke Jaksa Penuntut Umum (JPU) untuk kemudian disidangkan di Pengadilan Negeri.\n\n" .
            "Saran Praktis:\n" .
            "Jika Anda adalah **korban**: Segera kumpulkan bukti (chat, dokumen transfer, foto, saksi), buat kronologi tertulis, lalu hubungi Sentra Pelayanan Kepolisian Terpadu (SPKT) di Polres/Polda terdekat untuk membuat Laporan Polisi resmi. \n" .
            "Jika Anda **diduga/dituduh tersangka**: Anda memiliki hak mutlak untuk diam dan hak didampingi Penasihat Hukum. Segera hubungi pengacara atau Lembaga Bantuan Hukum (LBH) sebelum menjawab BAP dari penyidik kepolisian.";
    }

    private function getPerceraianResponse(): string
    {
        return "Mengenai Hukum Keluarga dan Perceraian di Indonesia, ketentuan utamanya mengacu pada UU No. 1 Tahun 1974 tentang Perkawinan dan perubahannya pada UU No. 16 Tahun 2019.\n\n" .
            "Menurut hukum, perceraian hanya dapat dilakukan dan diakui sah jika diputus di depan sidang pengadilan setelah pengadilan tersebut tidak berhasil mendamaikan kedua belah pihak. Ada perbedaan jalur peradilan berdasarkan agama:\n\n" .
            "1. Gugatan Cerai (Pengadilan Negeri)\n" .
            "Ini ditujukan bagi pasangan non-Muslim. Pihak istri atau suami mengajukan Surat Gugatan Cerai ke Pengadilan Negeri di wilayah kediaman tergugat.\n" .
            "2. Cerai Talak / Gugat (Pengadilan Agama)\n" .
            "Ditujukan khusus bagi pasangan beragama Islam. Suami mengajukan Permohonan Cerai Talak, atau Istri mengajukan Gugatan Cerai ke Pengadilan Agama.\n\n" .
            "Alasan Sah Perceraian yang Diterima Hakim:\n" .
            "Perpisahan tidak bisa semena-mena. Harus ada alasan kuat menurut UU, antara lain: salah satu pihak berbuat zina, menjadi pemabuk/penjudi, meninggalkan pihak lain selama 2 tahun berturut-turut tanpa izin, melakukan KDRT (Kekerasan Dalam Rumah Tangga), atau terjadi perselisihan terus-menerus tanpa harapan rukun kembali.\n\n" .
            "Saran Praktis:\n" .
            "Kumpulkan dokumen pokok seperti Buku Nikah/Akta Perkawinan asli, Kartu Keluarga, dan KTP. Jika ada masalah terkait Hak Asuh Anak atau Harta Gono-gini, siapkan juga akta kelahiran anak dan bukti kepemilikan aset. Sangat direkomendasikan untuk menunjuk Advokat spesialis hukum keluarga agar proses administrasi dan perundingan di pengadilan berjalan lebih terarah.";
    }

    private function getPertanahanResponse(): string
    {
        return "Dalam Hukum Agraria dan Pertanahan di Indonesia (UU Pokok Agraria No. 5 Tahun 1960), negara membagi jenis-jenis penguasaan dan kepemilikan hak atas tanah menjadi beberapa tingkatan yang memiliki kekuatan dan batas waktu yang berbeda.\n\n" .
            "Berikut adalah sertifikat tanah utama yang diakui oleh Badan Pertanahan Nasional (BPN):\n\n" .
            "1. SHM (Sertifikat Hak Milik)\n" .
            "Ini adalah kasta tertinggi kepemilikan tanah. SHM berlaku diwariskan turun-temurun, tanpa batas waktu aktif, dan hanya bisa dimiliki oleh Warga Negara Indonesia (WNI) secara perorangan (bukan perusahaan/PT).\n" .
            "2. SHGB (Sertifikat Hak Guna Bangunan)\n" .
            "Hak untuk mendirikan dan memiliki bangunan di atas tanah negara atau tanah milik orang lain. SHGB memiliki batas waktu maksimum 30 tahun (bisa diperpanjang maksimal 20 tahun), dan jenis ini paling sering digunakan oleh *developer* apartemen atau perusahaan PT.\n" .
            "3. HGU (Hak Guna Usaha)\n" .
            "Diberikan khusus bagi perusahaan untuk mengusahakan lahan milik negara, biasanya untuk perusahaan kelapa sawit, perkebunan, pertambakan, atau peternakan skala masif.\n" .
            "4. Sertifikat Hak Pakai\n" .
            "Hak untuk menggunakan atau memungut hasil dari tanah yang langsung dikuasai negara atau tanah milik orang lain, sering digunakan oleh Warga Negara Asing (WNA) yang berkedudukan di Indonesia.\n\n" .
            "Saran Praktis:\n" .
            "Jika Anda hendak membeli properti atau tanah, mintalah fotokopi sertifikat tanahnya dan bawa ke kantor BPN (Badan Pertanahan Nasional) setempat atau melalui PPAT (Pejabat Pembuat Akta Tanah) untuk dilakukan *Pengecekan Sertifikat* terlebih dahulu. Ini vital untuk memastikan tanah tidak sedang berada dalam sengketa hukum, pemblokiran aparat, atau disita oleh bank.";
    }

    private function getUmkmResponse(): string
    {
        return "Berdasarkan UU No. 20 Tahun 2008 tentang UMKM yang kini disempurnakan pelaksanaannya melalui UU Cipta Kerja, pemerintah berusaha keras memberikan kemudahan berupa insentif pajak, penyederhanaan izin, dan perlindungan hukum bagi para pelaku usaha kecil menengah.\n\n" .
            "Bentuk dukungan dan regulasi krusial bagi UMKM antara lain:\n\n" .
            "1. Pendirian PT Perorangan\n" .
            "Saat ini klasifikasi UMK (Usaha Mikro dan Kecil) bisa mendirikan Badan Hukum 'PT Perorangan' (Perseroan Terbatas dengan satu pendiri/pemegang saham tunggal) tanpa butuh modal dasar selangit, dan tanpa akta Notaris. Cukup mengisi pernyataan pendirian secara elektronik di Kemenkumham.\n" .
            "2. Perlindungan Konsumen & Merek (HAKI)\n" .
            "Sangat disarankan bagi UMKM mendaftarkan merek dagangnya di DJKI untuk menghindari pencaplokan merek oleh kompetitor. Merek menganut prinsip *first-to-file* (siapa yang daftar duluan, dialah pemilik sahnya, bukan siapa yang pakai duluan).\n" .
            "3. Kemitraan Anti-Eksploitasi\n" .
            "Hukum juga mengatur agar kerja sama ritel modern/perusahaan masif dan UMKM bersifat adil, diawasi oleh KPPU agar terhindar dari monopoli bisnis yang mematikan warung lokal.\n\n" .
            "Saran Praktis:\n" .
            "Legalitaskan bisnis UMKM Anda secepatnya untuk membuka peluang modal bank. Masuklah ke sistem oss.go.id untuk mencetak NIB, manfaatkan pengajuan Sertifikasi Halal Gratis (SEHATI) dari Kemenag, dan daftarkan permohonan Merek Dagang Anda di pdki-indonesia.dgip.go.id mumpung ada tarif diskon khusus UMKM.";
    }

    private function getDefaultResponse(): string
    {
        return "Topik hukum yang Anda sebutkan memiliki kompleksitas tertentu dalam regulasi dan yurisprudensi di Indonesia. Asisten Hukum APILA saat ini mencerna kata kunci dari pertanyaan Anda namun belum menemukan konteks spesifik dalam database utama untuk merincikannya secara ahli.\n\n" .
            "Hukum Indonesia berlaku secara progresif dan kasus Anda mungkin melibatkan hukum perdata khusus, administrasi negara, atau ketetapan Mahkamah Agung (Yurisprudensi) yang membutuhkan analisis bedah kasus mendalam.\n\n" .
            "Saran Praktis:\n" .
            "Silakan ajukan pertanyaan yang lebih spesifik dengan menyebutkan subjek masalah secara jelas (misal: 'Hukum asuransi telat bayar', 'Pajak tanah warisan', dsb). Jika menyangkut masalah urgen yang berpotensi melibatkan kerugian material besar atau mengancam kebebasan fisik, sangat disarankan segera menghubungi Legal Aid (Lembaga Bantuan Hukum setempat) atau advokat berlisensi Peradi.";
    }
}

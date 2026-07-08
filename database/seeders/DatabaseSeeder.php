<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Reset all tables
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('log_aktivitas')->truncate();
        DB::table('template_capaian')->truncate();
        DB::table('master_indikator')->truncate();
        DB::table('master_konteks')->truncate();
        DB::table('users')->truncate();
        DB::table('units')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // ---------- A. SEED UNITS ----------
        $units = [
            ['kode_unit' => 'UNPAK', 'nama_unit' => 'Universitas Pakuan (Institusi)', 'jenjang' => 'INSTITUSI', 'unit_induk' => null],
            ['kode_unit' => 'LPM', 'nama_unit' => 'Lembaga Penjaminan Mutu', 'jenjang' => 'LEMBAGA', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'LPPM', 'nama_unit' => 'Lembaga Penelitian & Pengabdian Masyarakat', 'jenjang' => 'LEMBAGA', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'BAAK', 'nama_unit' => 'Biro Administrasi Akademik & Kemahasiswaan', 'jenjang' => 'UNIT_KERJA', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'BKAU', 'nama_unit' => 'Biro Keuangan & Aset Universitas', 'jenjang' => 'UNIT_KERJA', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'FT', 'nama_unit' => 'Fakultas Teknik', 'jenjang' => 'FAKULTAS', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'FT-TI', 'nama_unit' => 'Program Studi Teknik Informatika', 'jenjang' => 'PRODI', 'unit_induk' => 'FT'],
            ['slide_show_unit' => 'FT-TS', 'nama_unit' => 'Program Studi Teknik Sipil', 'jenjang' => 'PRODI', 'unit_induk' => 'FT'],
            ['kode_unit' => 'FT-TE', 'nama_unit' => 'Program Studi Teknik Elektro', 'jenjang' => 'PRODI', 'unit_induk' => 'FT'],
            ['kode_unit' => 'FEB', 'nama_unit' => 'Fakultas Ekonomi dan Bisnis', 'jenjang' => 'FAKULTAS', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'FEB-MNJ', 'nama_unit' => 'Program Studi Manajemen', 'jenjang' => 'PRODI', 'unit_induk' => 'FEB'],
            ['kode_unit' => 'FEB-AKT', 'nama_unit' => 'Program Studi Akuntansi', 'jenjang' => 'PRODI', 'unit_induk' => 'FEB'],
            ['kode_unit' => 'FMIPA', 'nama_unit' => 'Fakultas Matematika dan Ilmu Pengetahuan Alam', 'jenjang' => 'FAKULTAS', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'FMIPA-BIO', 'nama_unit' => 'Program Studi Biologi', 'jenjang' => 'PRODI', 'unit_induk' => 'FMIPA'],
            ['kode_unit' => 'FMIPA-MTK', 'nama_unit' => 'Program Studi Matematika', 'jenjang' => 'PRODI', 'unit_induk' => 'FMIPA'],
            ['kode_unit' => 'PASCA', 'nama_unit' => 'Sekolah Pascasarjana', 'jenjang' => 'FAKULTAS', 'unit_induk' => 'UNPAK'],
            ['kode_unit' => 'PASCA-MM', 'nama_unit' => 'Program Studi Magister Manajemen', 'jenjang' => 'PRODI', 'unit_induk' => 'PASCA']
        ];
        foreach ($units as $u) {
            unset($u['slide_show_unit']);
            if ($u['nama_unit'] === 'Program Studi Teknik Sipil') {
                $u['kode_unit'] = 'FT-TS';
            }
            DB::table('units')->insert(array_merge($u, [
                'created_at' => now(),
                'updated_at' => now()
            ]));
        }

        // ---------- B. SEED USERS ----------
        $users = [
            ['username' => 'admin', 'password' => Hash::make('admin123'), 'name' => 'Administrator Sistem', 'role' => 'ADMIN', 'kode_unit' => 'UNPAK', 'email' => 'admin@unpak.ac.id'],
            ['username' => 'lpm', 'password' => Hash::make('lpm123'), 'name' => 'Kepala Lembaga Penjaminan Mutu', 'role' => 'LPM', 'kode_unit' => 'LPM', 'email' => 'lpm@unpak.ac.id'],
            ['username' => 'fakultas_ft', 'password' => Hash::make('fakultas123'), 'name' => 'Wakil Dekan I - Fakultas Teknik', 'role' => 'FAKULTAS', 'kode_unit' => 'FT', 'email' => 'wadek1.ft@unpak.ac.id'],
            ['username' => 'prodi_ti', 'password' => Hash::make('prodi123'), 'name' => 'Ketua Program Studi Teknik Informatika', 'role' => 'PRODI', 'kode_unit' => 'FT-TI', 'email' => 'kaprodi.ti@unpak.ac.id'],
            ['username' => 'prodi_ts', 'password' => Hash::make('prodi123'), 'name' => 'Ketua Program Studi Teknik Sipil', 'role' => 'PRODI', 'kode_unit' => 'FT-TS', 'email' => 'kaprodi.ts@unpak.ac.id']
        ];
        foreach ($users as $us) {
            DB::table('users')->insert(array_merge($us, [
                'created_at' => now(),
                'updated_at' => now()
            ]));
        }

        // ---------- C. SEED MASTER KONTEKS & INDIKATOR ----------
        $jsonPath = base_path('scraped_master_indicators.json');
        if (!file_exists($jsonPath)) {
            throw new \Exception("scraped_master_indicators.json not found in base path!");
        }

        $scrapedData = json_decode(file_get_contents($jsonPath), true);

        // 1. Contexts Seeding
        $contextMap = [];
        foreach ($scrapedData['contexts'] as $ctxName) {
            $ctxId = DB::table('master_konteks')->insertGetId([
                'nama' => $ctxName,
                'created_at' => now(),
                'updated_at' => now()
            ]);
            $contextMap[$ctxName] = $ctxId;
        }

        // 2. Indicators Seeding
        $indicatorCodeToIdMap = [];
        foreach ($scrapedData['indicators'] as $ind) {
            $ctxId = $contextMap[$ind['context']] ?? 1;
            
            $parentDbId = null;
            if ($ind['parent_iku'] !== null) {
                $parentDbId = $indicatorCodeToIdMap[$ind['parent_iku']] ?? null;
            }

            $baseline = str_replace(',', '.', $ind['baseline']);
            $target = str_replace(',', '.', $ind['target']);

            // Image 2 format for full_kategori:
            // If parent_iku is defined, e.g. parent_iku = "IKU 1", kategori = "a. D1*", full_kategori = "IKU 1 - a. D1*"
            // Otherwise, it is "[iku] - [kategori]"
            if ($ind['parent_iku'] !== null) {
                $fullKategori = $ind['parent_iku'] . ' - ' . $ind['kategori'];
            } else {
                $fullKategori = $ind['iku'] . ' - ' . $ind['kategori'];
            }

            $indId = DB::table('master_indikator')->insertGetId([
                'id_konteks' => $ctxId,
                'iku' => $ind['iku'],
                'kategori' => $ind['kategori'],
                'id_sub' => $parentDbId,
                'full_kategori' => $fullKategori,
                'satuan' => $ind['satuan'],
                'base_line' => $baseline,
                'target' => $target,
                'target_d3' => ($ind['iku'] === 'IKU 1 - c') ? '90' : null,
                'target_d4' => ($ind['iku'] === 'IKU 1 - d') ? '12' : null,
                'target_s1' => ($ind['iku'] === 'IKU 1 - e') ? '90' : null,
                'target_s2' => ($ind['iku'] === 'IKU 1 - f') ? '80' : null,
                'target_s3' => ($ind['iku'] === 'IKU 1 - g') ? '85' : null,
                'target_profesi' => ($ind['iku'] === 'IKU 1 - h') ? '100' : null,
                'target_unit' => null,
                'target_fakultas' => null,
                'target_prodi' => null,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $indicatorCodeToIdMap[$ind['iku']] = $indId;
        }

        // ---------- D. SEED TEMPLATE CAPAIAN ----------
        $unitProdi = ['FT-TI', 'FT-TS'];
        $triwulanList = ['Q1', 'Q2', 'Q3', 'Q4'];
        $statusByTw = [
            'Q1' => 'DISAHKAN',
            'Q2' => 'DISAHKAN',
            'Q3' => 'DIVERIFIKASI',
            'Q4' => 'DRAFT'
        ];

        $topIndicators = DB::table('master_indikator')->whereNull('id_sub')->get();
        
        foreach ($unitProdi as $unit) {
            foreach ($topIndicators as $ind) {
                $targetVal = (float)$ind->target ?: 50.0;
                $penyebut = 100 + rand(0, 50);

                foreach ($triwulanList as $idx => $tw) {
                    $rasio = max(5, min(95, $targetVal + rand(-10, 10) - (3 - $idx) * 2));
                    $pembilang = round(($rasio / 100) * $penyebut);

                    DB::table('template_capaian')->insert([
                        'id_indikator' => $ind->id,
                        'kode_unit' => $unit,
                        'tahun' => 2026,
                        'triwulan' => $tw,
                        'pembilang' => $pembilang,
                        'penyebut' => $penyebut,
                        'nilai_capaian' => round(($pembilang / $penyebut) * 100, 2),
                        'catatan' => 'Analisis performa triwulan untuk indikator ' . $ind->iku,
                        'file_url' => 'https://drive.google.com/test_doc_file',
                        'status_validasi' => $statusByTw[$tw],
                        'diinput_oleh' => 'seed',
                        'diverifikasi_oleh' => $statusByTw[$tw] !== 'DRAFT' ? 'lpm' : null,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }
        }
    }
}

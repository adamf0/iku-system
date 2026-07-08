<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

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
        DB::table('penugasan_target')->truncate();
        DB::table('master_tahun')->truncate();
        DB::table('master_indikator')->truncate();
        DB::table('master_konteks')->truncate();
        DB::table('users')->truncate();
        DB::table('units')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // ---------- A. SEED BASE TABLES FROM JSON DUMPS ----------
        
        // 1. m_fakultas
        $fakJson = base_path('scraped_m_fakultas.json');
        if (!file_exists($fakJson)) {
            throw new \Exception("scraped_m_fakultas.json not found in base path!");
        }
        $fakData = json_decode(file_get_contents($fakJson), true);
        foreach ($fakData as $f) {
            DB::table('m_fakultas')->insert([
                'kode_fakultas' => $f['kode_fakultas'],
                'kode_pt' => $f['kode_pt'],
                'nama_fakultas' => $f['nama_fakultas'],
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // 2. m_program_studi
        $prodJson = base_path('scraped_m_program_studi.json');
        if (!file_exists($prodJson)) {
            throw new \Exception("scraped_m_program_studi.json not found in base path!");
        }
        $prodData = json_decode(file_get_contents($prodJson), true);
        foreach ($prodData as $p) {
            DB::table('m_program_studi')->insert([
                'kode_prodi' => $p['kode_prodi'],
                'kode_pt' => $p['kode_pt'],
                'kode_fak' => $p['kode_fak'],
                'kode_jenjang' => $p['kode_jenjang'],
                'kode_jurusan' => $p['kode_jurusan'],
                'nama_prodi' => $p['nama_prodi'],
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // 3. sijamu_fakultas_unit
        $sfuJson = base_path('scraped_sijamu_fakultas_unit.json');
        if (!file_exists($sfuJson)) {
            throw new \Exception("scraped_sijamu_fakultas_unit.json not found in base path!");
        }
        $sfuData = json_decode(file_get_contents($sfuJson), true);
        foreach ($sfuData as $s) {
            DB::table('sijamu_fakultas_unit')->insert([
                'id' => $s['id'],
                'kode_fakultas' => $s['kode_fakultas'],
                'kode_prodi' => $s['kode_prodi'],
                'nama' => $s['nama'],
                'id_m_prodi' => $s['id_m_prodi'],
                'standalone' => $s['standalone'],
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // ---------- B. SEED USERS ----------
        $users = [
            // admin: fakultas_unit = 64 (Sekretaris Universitas)
            ['username' => 'admin', 'password' => Hash::make('123'), 'name' => 'Administrator Sistem', 'role' => 'ADMIN', 'fakultas_unit' => 64, 'email' => 'admin@unpak.ac.id'],
            // lpm: fakultas_unit = 69 (LPM)
            ['username' => 'lpm', 'password' => Hash::make('123'), 'name' => 'Kepala Lembaga Penjaminan Mutu', 'role' => 'LPM', 'fakultas_unit' => 69, 'email' => 'lpm@unpak.ac.id'],
        ];
        foreach ($users as $us) {
            DB::table('users')->insert(array_merge($us, [
                'created_at' => now(),
                'updated_at' => now()
            ]));
        }

        // Create accounts for all v_fakultas_unit records dynamically
        $createdUsernames = ['admin' => true, 'lpm' => true];
        $unitsDb = DB::table('v_fakultas_unit')->get();
        foreach ($unitsDb as $u) {
            $role = strtoupper($u->type); // 'FAKULTAS', 'PRODI', or 'UNIT'

            // Exclude already created static unit IDs (admin / lpm)
            if (in_array($u->id, [64, 69])) {
                continue;
            }

            // Generate clean name
            $cleanName = preg_replace('/[^a-zA-Z0-9]/', ' ', strtolower($u->nama_fak_prod_unit));
            $cleanName = preg_replace('/\s+/', '_', trim($cleanName));
            $cleanName = trim($cleanName, '_');
            
            if (empty($cleanName)) {
                $cleanName = 'user_' . $u->id;
            }

            // Apply prefix and suffix formatting based on type
            if ($u->type === 'fakultas') {
                $cleanName = 'f_' . $cleanName;
            } elseif ($u->type === 'prodi') {
                $jenjangSuffix = strtolower($u->jenjang);
                $cleanName = 'p_' . $cleanName . ($jenjangSuffix ? '_' . $jenjangSuffix : '');
            }

            $baseName = $cleanName;
            $counter = 2;
            while (isset($createdUsernames[$cleanName])) {
                $cleanName = $baseName . '_' . $counter;
                $counter++;
            }
            $createdUsernames[$cleanName] = true;

            DB::table('users')->insertOrIgnore([
                'username' => $cleanName,
                'password' => Hash::make('123'),
                'name' => $u->nama_fak_prod_unit,
                'role' => $role,
                'fakultas_unit' => $u->id,
                'email' => $cleanName . '@unpak.ac.id',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // ---------- C. SEED MASTER TAHUN ----------
        DB::table('master_tahun')->insert([
            ['tahun' => 2026, 'created_at' => now(), 'updated_at' => now()],
            ['tahun' => 2027, 'created_at' => now(), 'updated_at' => now()]
        ]);

        // ---------- D. SEED MASTER KONTEKS & INDIKATOR ----------
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

            if ($ind['parent_iku'] !== null) {
                $fullKategori = $ind['parent_iku'] . ' - ' . $ind['kategori'];
            } else {
                $fullKategori = $ind['iku'] . ' - ' . $ind['kategori'];
            }

            $formula = "Tingkat Pencapaian " . $ind['iku'] . " = (Realisasi / Target) * 100%";
            $sumber = "Data akademik PDDikti / SIAKAD / Dokumen pendukung prodi";

            if (strpos($ind['iku'], 'IKU 1') !== false) {
                $formula = "Tingkat Pencapaian AEE(i) = (AEE Realisasi / AEE Ideal) x 100% | AEE PT = SUM(Tingkat Pencapaian i) / n";
                $sumber = "Data mahasiswa masuk & lulus per program studi (PDDikti/SIAKAD)";
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
                'formula_text' => $formula,
                'sumber_data' => $sumber,
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

        // ---------- E. SEED PENUGASAN TARGET & TEMPLATE CAPAIAN ----------
        $unitProdiIds = [25, 17];
        $triwulanList = ['TW1', 'TW2', 'TW3', 'TW4'];
        $statusByTw = [
            'TW1' => 'DISAHKAN',
            'TW2' => 'DISAHKAN',
            'TW3' => 'DIVERIFIKASI',
            'TW4' => 'DRAFT'
        ];

        $topIndicators = DB::table('master_indikator')->whereNull('id_sub')->get();
        
        foreach ($unitProdiIds as $unitId) {
            foreach ($topIndicators as $ind) {
                // 1. Assign this indicator to the unit
                DB::table('penugasan_target')->insert([
                    'fakultas_unit' => $unitId,
                    'id_indikator' => $ind->id,
                    'tahun' => 2026,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);

                // 2. Also assign its child indicators (if any)
                $childs = DB::table('master_indikator')->where('id_sub', $ind->id)->get();
                foreach ($childs as $child) {
                    DB::table('penugasan_target')->insert([
                        'fakultas_unit' => $unitId,
                        'id_indikator' => $child->id,
                        'tahun' => 2026,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                // 3. Seed demo CAPAIAN transactions
                $targetVal = (float)$ind->target ?: 50.0;
                $penyebut = 100 + rand(0, 50);

                foreach ($triwulanList as $idx => $tw) {
                    $rasio = max(5, min(95, $targetVal + rand(-10, 10) - (3 - $idx) * 2));
                    $pembilang = round(($rasio / 100) * $penyebut);

                    DB::table('template_capaian')->insert([
                        'id_indikator' => $ind->id,
                        'fakultas_unit' => $unitId,
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

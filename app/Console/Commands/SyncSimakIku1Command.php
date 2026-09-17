<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Services\GoogleDriveService;
use App\Services\SimpleXlsxWriter;

class SyncSimakIku1Command extends Command
{
    protected $signature = 'iku:sync-simak-iku1 {--tahun= : Tahun spesifik untuk sinkronisasi} {--skip-drive : Lewati upload Google Drive (upload via cronjob terpisah)}';
    protected $description = 'Sinkronisasi otomatis data IKU 1 dari SIMAK dengan cut-off tanggal per triwulan dan export Excel data.xlsx & summary.xlsx';

    public function handle()
    {
        $tahunParam = $this->option('tahun');
        $skipDrive = $this->option('skip-drive');
        $targetYears = $tahunParam 
            ? [(int)$tahunParam] 
            : DB::table('master_tahun')->pluck('tahun')->toArray();

        if (empty($targetYears)) {
            $targetYears = [];
        }

        $triwulanCutOffs = [
            'TW1' => '-03-31 23:59:59',
            'TW2' => '-06-30 23:59:59',
            'TW3' => '-09-30 23:59:59',
            'TW4' => '-12-31 23:59:59',
        ];

        $driveService = new GoogleDriveService();
        $syncedCount = 0;

        foreach ($targetYears as $tahun) {
            $this->info("=== Memproses Sinkronisasi SIMAK IKU 1 Tahun {$tahun} ===");

            $yearFolderId = null;
            if (!$skipDrive) {
                $driveService->ensureYearFolderStructure($tahun);
                $yearFolderId = $driveService->findFolder((string)$tahun);
            }

            // Find all assigned IKU 1 indicators for this year across ALL units
            $iku1Indicators = DB::table('penugasan_target')
                ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
                ->where('penugasan_target.tahun', $tahun)
                ->where(function($q) {
                    $q->where('master_indikator.iku', 'IKU 1')
                      ->orWhere('master_indikator.iku', 'LIKE', 'IKU 1 -%')
                      ->orWhere('master_indikator.iku', 'LIKE', 'Sub IKU 1%')
                      ->orWhere('master_indikator.id', 1);
                })
                ->whereNull('penugasan_target.deleted_at')
                ->distinct()
                ->pluck('master_indikator.id');

            if ($iku1Indicators->isEmpty()) {
                $this->line("Tidak ada penugasan IKU 1 untuk tahun {$tahun}.");
                continue;
            }

            foreach ($triwulanCutOffs as $tw => $dateSuffix) {
                $cutOffDate = $tahun . $dateSuffix;
                $twFolderId = (!$skipDrive && $yearFolderId) ? $driveService->findFolder($tw, $yearFolderId) : null;

                // Semester Ajar Kampus: TW1 & TW2 = Genap tahun sebelumnya ((tahun - 1) . '2'), TW3 & TW4 = Ganjil tahun berjalan (tahun . '1')
                $targetTahunId = in_array($tw, ['TW1', 'TW2']) ? (($tahun - 1) . '2') : ($tahun . '1');

                foreach ($iku1Indicators as $indId) {
                    $indObj = DB::table('master_indikator')->where('id', $indId)->first();
                    $indikatorName = $indObj ? trim($indObj->iku) : 'IKU 1';

                    $indFolderId = null;
                    if (!$skipDrive && $twFolderId) {
                        $indFolderId = $driveService->findFolder($indikatorName, $twFolderId);
                        if (!$indFolderId) {
                            $indFolderId = $driveService->createFolder($indikatorName, $twFolderId);
                        }
                    }

                    // Get all assigned units for this indicator and year
                    $assignedPenugasan = DB::table('penugasan_target')
                        ->where('id_indikator', $indId)
                        ->where('tahun', $tahun)
                        ->whereNull('deleted_at')
                        ->get();

                    if ($assignedPenugasan->isEmpty()) continue;

                    $indicatorTotalMhs = 0;
                    $indicatorTotalLulusTepat = 0;
                    $indicatorTotalTidakTepat = 0;
                    $indicatorFirstJenjang = null;
                    $indicatorFirstProdiName = null;

                    $targetObj = DB::table('target_indikator_tahun')
                        ->where('id_indikator', $indId)
                        ->where('tahun', $tahun)
                        ->first();
                    $baseLineVal = $targetObj ? ($targetObj->base_line ?? '-') : '-';

                    $summaryHeaders = [
                        'tahun',
                        'tw',
                        'unit',
                        'jenjang',
                        'target semester',
                        'mahasiswa terdaftar (penyebut)',
                        'lulus tepat waktu (pembilang)',
                        'tidak tepat waktu',
                        'aee realisasi (%)',
                        'aee ideal (%)',
                        'tingkat pencapaian aee (%)',
                        'base line',
                        'target',
                        'status'
                    ];

                    $summaryRows = [];

                    $dataHeaders = [
                        'prodi', 
                        'jenjang', 
                        'target semester', 
                        'semester digunakan', 
                        'mahasiswa terdaftar (penyebut)', 
                        'lulus tepat waktu (pembilang)', 
                        'tidak tepat waktu'
                    ];

                    foreach ($assignedPenugasan as $penugasan) {
                        $unitId = $penugasan->fakultas_unit;
                        $vUnit = DB::table('v_fakultas_unit')->where('id', $unitId)->first();
                        $sijamuUnit = DB::table('sijamu_fakultas_unit')->where('id', $unitId)->first();

                        if (!$sijamuUnit || empty($sijamuUnit->kode_fakultas)) continue;

                        $unitName = trim($vUnit->nama_fak_prod_unit ?? "Unit {$unitId}");
                        $this->line(" -> Processing {$indikatorName} ({$tw} - {$targetTahunId}) - {$unitName}...");

                        try {
                            // Query penyebut: Total Mahasiswa Terdaftar pada tahun_id (semester ajar) dari t_mahasiswa_status (semua status)
                            $usedTahunId = $targetTahunId;
                            $mhsStatsQuery = DB::connection('simak')->table('t_mahasiswa_status')
                                ->selectRaw("COALESCE(kode_prodi, '') as kode_prodi, COUNT(DISTINCT NIM) as total_mhs")
                                ->where('kode_fak', $sijamuUnit->kode_fakultas)
                                ->where('tahun_id', $targetTahunId);

                            if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                                $mhsStatsQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                            }
                            $baseStatsGrouped = $mhsStatsQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');

                            // Fallback 1: Jika semester Genap (e.g. 20262) belum ada data di t_mahasiswa_status, gunakan semester Ganjil
                            // if ($baseStatsGrouped->isEmpty()) {
                            //     $usedTahunId = "{$tahun}1";
                            //     $mhsStatsQueryFB = DB::connection('simak')->table('t_mahasiswa_status')
                            //         ->selectRaw("COALESCE(kode_prodi, '') as kode_prodi, COUNT(DISTINCT NIM) as total_mhs")
                            //         ->where('kode_fak', $sijamuUnit->kode_fakultas)
                            //         ->where('tahun_id', $usedTahunId);

                            //     if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                            //         $mhsStatsQueryFB->where('kode_prodi', $sijamuUnit->kode_prodi);
                            //     }
                            //     $baseStatsGrouped = $mhsStatsQueryFB->groupBy('kode_prodi')->get()->keyBy('kode_prodi');
                            // }

                            // Fallback 2: Jika t_mahasiswa_status kosong, fallback ke m_mahasiswa
                            // if ($baseStatsGrouped->isEmpty()) {
                            //     $usedTahunId = "All SIMAK";
                            //     $mhsStatsQueryAll = DB::connection('simak')->table('m_mahasiswa')
                            //         ->selectRaw("COALESCE(kode_prodi, '') as kode_prodi, COUNT(*) as total_mhs")
                            //         ->where('kode_fak', $sijamuUnit->kode_fakultas);

                            //     if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                            //         $mhsStatsQueryAll->where('kode_prodi', $sijamuUnit->kode_prodi);
                            //     }
                            //     $baseStatsGrouped = $mhsStatsQueryAll->groupBy('kode_prodi')->get()->keyBy('kode_prodi');
                            // }

                            $dropOutGrouped = collect();
                            try {
                                $dropOutQuery = DB::connection('simak')->table('m_mahasiswa')
                                    ->selectRaw("COALESCE(kode_prodi, '') as kode_prodi, COUNT(*) as drop_out")
                                    ->where('kode_fak', $sijamuUnit->kode_fakultas)
                                    ->whereIn('status_mhs', ['DO', 'DROP OUT', 'KELUAR', 'Non-Aktif']);

                                if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                                    $dropOutQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                                }
                                $dropOutGrouped = $dropOutQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');
                            } catch (\Throwable $eDo) {}

                            // Query lulusan: Mengambil data lulusan dari t_mahasiswa_status_lulus_do (status 'L') per tahun_id
                            $graduatesQuery = DB::connection('simak')->table('t_mahasiswa_status_lulus_do as s')
                                ->join('m_mahasiswa as m', function($j) {
                                    $j->on('s.NIM', '=', 'm.NIM')->on('s.kode_fak', '=', 'm.kode_fak');
                                })
                                ->selectRaw("COALESCE(s.kode_prodi, '') as kode_prodi, DATEDIFF(s.tanggal_lulus, m.tanggal_masuk) as masa_studi_hari")
                                ->where('s.kode_fak', $sijamuUnit->kode_fakultas)
                                ->where('s.status', 'L')
                                ->where('s.tahun_id', $targetTahunId);

                            if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                                $graduatesQuery->where('s.kode_prodi', $sijamuUnit->kode_prodi);
                            }
                            $graduates = $graduatesQuery->get();
                            $graduatesByProdi = $graduates->groupBy('kode_prodi');

                            // Fetch prodis in this unit
                            $prodiListQuery = DB::table('sijamu_fakultas_unit as s')
                                ->leftJoin('v_fakultas_unit as v', 's.id', '=', 'v.id')
                                ->where('s.kode_fakultas', $sijamuUnit->kode_fakultas);

                            if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                                $prodiListQuery->where('s.kode_prodi', $sijamuUnit->kode_prodi);
                            }

                            $prodis = $prodiListQuery->select('v.nama_fak_prod_unit as nama_prodi', 's.kode_fakultas', 's.kode_prodi', 'v.type', 'v.jenjang')->get();

                            $unitTotalMhs = $baseStatsGrouped->sum('total_mhs');
                            $unitTotalLulusTepat = 0;
                            $unitTotalTidakTepat = 0;
                            $unitDataRows = [];

                            foreach ($prodis as $p) {
                                $baseP = $baseStatsGrouped->get($p->kode_prodi);
                                $totMhsP = $baseP ? (int)$baseP->total_mhs : 0;

                                $prodiGrads = $graduatesByProdi->get($p->kode_prodi, collect());
                                $maxHariTepat = $this->getMasaStudiTepatWaktuHari($p->jenjang, $p->nama_prodi);
                                $lulusTepatP = 0;
                                $lulusTidakTepatP = 0;

                                foreach ($prodiGrads as $grad) {
                                    if ($grad->masa_studi_hari !== null && $grad->masa_studi_hari <= $maxHariTepat) {
                                        $lulusTepatP++;
                                    } else {
                                        $lulusTidakTepatP++;
                                    }
                                }

                                $unitTotalLulusTepat += $lulusTepatP;
                                $unitTotalTidakTepat += $lulusTidakTepatP;

                                $jenjang = !empty($p->jenjang) ? $p->jenjang : 'S1';
                                if (preg_match('/\b(D3|D4|S1|S2|S3|Profesi)\b/i', $p->nama_prodi ?? '', $mj)) {
                                    $jenjang = strtoupper($mj[1]);
                                }

                                if (!$indicatorFirstJenjang) {
                                    $indicatorFirstJenjang = $jenjang;
                                    $indicatorFirstProdiName = $p->nama_prodi;
                                }

                                // data.xlsx row (spesifik prodi, tanpa kolom AEE Realisasi, AEE Ideal, Tingkat Pencapaian, Base Line, Target, Status)
                                $unitDataRows[] = [
                                    $p->nama_prodi,
                                    $jenjang,
                                    $targetTahunId,
                                    $usedTahunId,
                                    $totMhsP,
                                    $lulusTepatP,
                                    $lulusTidakTepatP
                                ];
                            }

                            $indicatorTotalMhs += $unitTotalMhs;
                            $indicatorTotalLulusTepat += $unitTotalLulusTepat;
                            $indicatorTotalTidakTepat += $unitTotalTidakTepat;

                            $unitAeeRealisasiPct = $unitTotalMhs > 0 ? round(($unitTotalLulusTepat / $unitTotalMhs) * 100, 2) : 0;
                            $unitJenjang = count($prodis) > 0 ? ($prodis[0]->jenjang ?? 'S1') : 'S1';
                            if (preg_match('/\b(D3|D4|S1|S2|S3|Profesi)\b/i', $unitName ?? '', $mjU)) {
                                $unitJenjang = strtoupper($mjU[1]);
                            }
                            $unitAeeIdealPct = $this->getAeeIdeal($unitJenjang, count($prodis) > 0 ? $prodis[0]->nama_prodi : '');
                            $unitTingkatPencapaianPct = $unitAeeIdealPct > 0 ? round(($unitAeeRealisasiPct / $unitAeeIdealPct) * 100, 2) : 0;

                            $unitTargetVal = '-';
                            if ($targetObj) {
                                $jUpper = strtoupper($unitJenjang);
                                if (str_contains($jUpper, 'D3')) $unitTargetVal = $targetObj->target_d3 ?? $targetObj->target;
                                elseif (str_contains($jUpper, 'D4')) $unitTargetVal = $targetObj->target_d4 ?? $targetObj->target;
                                elseif (str_contains($jUpper, 'S1')) $unitTargetVal = $targetObj->target_s1 ?? $targetObj->target;
                                elseif (str_contains($jUpper, 'S2')) $unitTargetVal = $targetObj->target_s2 ?? $targetObj->target;
                                elseif (str_contains($jUpper, 'S3')) $unitTargetVal = $targetObj->target_s3 ?? $targetObj->target;
                                elseif (str_contains($jUpper, 'PROFESI')) $unitTargetVal = $targetObj->target_profesi ?? $targetObj->target;
                                else $unitTargetVal = $targetObj->target;
                            }
                            if ($unitTargetVal === null || $unitTargetVal === '') $unitTargetVal = '-';

                            $unitStatusCapaian = 'BELUM TERCAPAI';
                            if (is_numeric($unitTargetVal)) {
                                $unitStatusCapaian = ($unitTingkatPencapaianPct >= (float)$unitTargetVal) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                            } else {
                                $unitStatusCapaian = ($unitTingkatPencapaianPct > 0) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                            }

                            // Add row to summary.xlsx for this unit
                            $summaryRows[] = [
                                $tahun,
                                $tw,
                                $unitName,
                                $unitJenjang,
                                $targetTahunId,
                                $unitTotalMhs,
                                $unitTotalLulusTepat,
                                $unitTotalTidakTepat,
                                $unitAeeRealisasiPct . '%',
                                $unitAeeIdealPct . '%',
                                $unitTingkatPencapaianPct . '%',
                                $baseLineVal,
                                $unitTargetVal !== '-' ? ($unitTargetVal . '%') : '-',
                                $unitStatusCapaian
                            ];

                            // 1. Create /[tahun]/[tw]/[indikator]/[unit]/data.xlsx
                            $unitTempDir = storage_path("app/temp/{$tahun}/{$tw}/{$indikatorName}/{$unitName}");
                            $unitTempPath = "{$unitTempDir}/data.xlsx";
                            SimpleXlsxWriter::create($unitTempPath, $dataHeaders, $unitDataRows);

                            $unitFolderUrl = null;
                            $unitFileUrl = null;

                            if (!$skipDrive && $indFolderId && file_exists($unitTempPath)) {
                                $unitFolderId = $driveService->findFolder($unitName, $indFolderId);
                                if (!$unitFolderId) {
                                    $unitFolderId = $driveService->createFolder($unitName, $indFolderId);
                                }
                                $targetParentId = $unitFolderId ?: $indFolderId;
                                $unitFileUrl = $driveService->uploadFile($unitTempPath, 'data.xlsx', $targetParentId);
                                if ($unitFolderId) {
                                    $unitFolderUrl = "https://drive.google.com/drive/folders/{$unitFolderId}";
                                }

                                if ($unitFileUrl) {
                                    @unlink($unitTempPath);
                                }
                            }

                            $finalUrl = $unitFolderUrl ?? $unitFileUrl;

                            // Update template_capaian for this specific unit
                            $exists = DB::table('template_capaian')
                                ->where('id_indikator', $indId)
                                ->where('fakultas_unit', $unitId)
                                ->where('tahun', $tahun)
                                ->where('triwulan', $tw)
                                ->first();

                            $updatePayload = [
                                'nilai_capaian' => $unitTingkatPencapaianPct,
                                'pembilang' => $unitTotalLulusTepat,
                                'penyebut' => $unitTotalMhs,
                                'file_url' => $finalUrl,
                                'catatan' => "Perhitungan otomatis SIMAK (Cut-off {$tw} {$tahun}, Semester {$targetTahunId}): AEE Realisasi {$unitAeeRealisasiPct}%, AEE Ideal {$unitAeeIdealPct}%, Tingkat Pencapaian AEE {$unitTingkatPencapaianPct}%",
                                'updated_at' => now(),
                            ];

                            if (!$exists) {
                                $updatePayload['id_indikator'] = $indId;
                                $updatePayload['fakultas_unit'] = $unitId;
                                $updatePayload['tahun'] = $tahun;
                                $updatePayload['triwulan'] = $tw;
                                $updatePayload['status_validasi'] = 'DIAJUKAN';
                                $updatePayload['diinput_oleh'] = 'system_simak';
                                $updatePayload['created_at'] = now();
                                DB::table('template_capaian')->insert($updatePayload);
                            } else {
                                if (!in_array($exists->status_validasi, ['DIVERIFIKASI', 'DISAHKAN'])) {
                                    DB::table('template_capaian')
                                        ->where('id', $exists->id)
                                        ->update($updatePayload);
                                }
                            }

                            // Log gdrive_folder_logs status
                            if ($finalUrl) {
                                DB::table('gdrive_folder_logs')->updateOrInsert(
                                    [
                                        'fakultas_unit' => $unitId,
                                        'tahun' => $tahun,
                                        'id_indikator' => $indId,
                                    ],
                                    [
                                        'status' => 'CREATED',
                                        'folder_url' => $finalUrl,
                                        'error_message' => null,
                                        'updated_at' => now()
                                    ]
                                );
                            }

                            $syncedCount++;
                        } catch (\Throwable $e) {
                            $this->warn("Akses SIMAK unit {$unitName} ({$unitId}) gagal: " . $e->getMessage());
                        }
                    }

                    $summaryTempDir = storage_path("app/temp/{$tahun}/{$tw}/{$indikatorName}");
                    $summaryTempPath = "{$summaryTempDir}/summary.xlsx";
                    SimpleXlsxWriter::create($summaryTempPath, $summaryHeaders, $summaryRows);

                    if (!$skipDrive && $indFolderId && file_exists($summaryTempPath)) {
                        $summaryFileUrl = $driveService->uploadFile($summaryTempPath, 'summary.xlsx', $indFolderId);
                        if ($summaryFileUrl) {
                            @unlink($summaryTempPath);
                        }
                    }
                }
            }
        }

        $this->info("Sinkronisasi IKU 1 SIMAK selesai. Total record diproses: {$syncedCount}");
    }

    protected function getAeeIdeal($jenjang, $namaProdi = '')
    {
        $j = strtoupper($jenjang ?? '');
        $nama = strtoupper($namaProdi ?? '');

        if (str_contains($j, 'PROFESI') || str_contains($nama, 'PROFESI')) {
            return 100.0;
        }
        if (str_contains($j, 'S2') || str_contains($j, 'MAGISTER') || str_contains($nama, 'S2') || str_contains($nama, 'MAGISTER')) {
            return 50.0;
        }
        if (str_contains($j, 'D3') || str_contains($j, 'DIPLOMA TIGA') || str_contains($nama, 'D3') || str_contains($nama, 'D-III')) {
            return 33.0;
        }
        if (str_contains($j, 'S3') || str_contains($j, 'DOKTOR') || str_contains($nama, 'S3') || str_contains($nama, 'DOKTOR')) {
            return 33.0;
        }

        return 25.0; // S1 / D4
    }

    protected function getMasaStudiTepatWaktuHari($jenjang, $namaProdi = '')
    {
        $j = strtoupper($jenjang ?? '');
        $nama = strtoupper($namaProdi ?? '');

        if (str_contains($j, 'PROFESI') || str_contains($nama, 'PROFESI')) {
            return 366; // 1 tahun (Profesi)
        }
        if (str_contains($j, 'S2') || str_contains($j, 'MAGISTER') || str_contains($nama, 'S2') || str_contains($nama, 'MAGISTER')) {
            return 731; // 2 tahun (Magister / S2)
        }
        if (str_contains($j, 'D3') || str_contains($j, 'DIPLOMA TIGA') || str_contains($nama, 'D3') || str_contains($nama, 'D-III')) {
            return 1096; // 3 tahun (Diploma 3 / D3)
        }
        if (str_contains($j, 'S3') || str_contains($j, 'DOKTOR') || str_contains($nama, 'S3') || str_contains($nama, 'DOKTOR')) {
            return 1096; // 3 tahun (Doktor / S3)
        }

        // Default S1 / D4
        return 1461; // 4 tahun (Sarjana / S1 / D4)
    }
}

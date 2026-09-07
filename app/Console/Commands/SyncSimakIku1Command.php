<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncSimakIku1Command extends Command
{
    protected $signature = 'iku:sync-simak-iku1 {--tahun= : Tahun spesifik untuk sinkronisasi} {--skip-drive : Lewati upload Google Drive (upload via cronjob terpisah)}';
    protected $description = 'Sinkronisasi otomatis data IKU 1 dari SIMAK dengan cut-off tanggal per triwulan';

    public function handle()
    {
        $tahunParam = $this->option('tahun');
        $skipDrive = $this->option('skip-drive');
        $targetYears = $tahunParam 
            ? [(int)$tahunParam] 
            : DB::table('master_tahun')->pluck('tahun')->toArray();

        if (empty($targetYears)) {
            $targetYears = [2025, 2026];
        }

        $units = DB::table('v_fakultas_unit')->get();
        $triwulanCutOffs = [
            'TW1' => '-03-31 23:59:59',
            'TW2' => '-06-30 23:59:59',
            'TW3' => '-09-30 23:59:59',
            'TW4' => '-12-31 23:59:59',
        ];

        $driveService = new \App\Services\GoogleDriveService();
        $syncedCount = 0;

        foreach ($targetYears as $tahun) {
            $this->info("=== Memproses Sinkronisasi SIMAK IKU 1 Tahun {$tahun} ===");
            
            $yearFolderId = null;
            if (!$skipDrive) {
                // Ensure year folder structure exists in Google Drive
                $driveService->ensureYearFolderStructure($tahun);
                $yearFolderId = $driveService->findFolder((string)$tahun);
            }

            foreach ($units as $vUnit) {
                $unitId = $vUnit->id;

                // Find assigned IKU 1 indicators for this unit and year
                $iku1Assigned = DB::table('penugasan_target')
                    ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
                    ->where('penugasan_target.fakultas_unit', $unitId)
                    ->where('penugasan_target.tahun', $tahun)
                    ->where(function($q) {
                        $q->where('master_indikator.iku', 'IKU 1')
                          ->orWhere('master_indikator.iku', 'LIKE', 'IKU 1 -%')
                          ->orWhere('master_indikator.iku', 'LIKE', 'Sub IKU 1%')
                          ->orWhere('master_indikator.id', 1);
                    })
                    ->whereNull('penugasan_target.deleted_at')
                    ->pluck('master_indikator.id');

                if ($iku1Assigned->isEmpty()) continue;

                $sijamuUnit = DB::table('sijamu_fakultas_unit')->where('id', $unitId)->first();
                if (!$sijamuUnit || empty($sijamuUnit->kode_fakultas)) continue;

                $unitName = $vUnit->nama_fak_prod_unit ?? "Unit {$unitId}";
                $this->line(" -> Processing {$unitName}...");

                foreach ($triwulanCutOffs as $tw => $dateSuffix) {
                    $cutOffDate = $tahun . $dateSuffix;
                    $twFolderId = $yearFolderId ? $driveService->findFolder($tw, $yearFolderId) : null;

                    try {
                        $mhsStatsQuery = DB::connection('simak')->table('m_mahasiswa')
                            ->selectRaw("
                                COALESCE(kode_prodi, '') as kode_prodi,
                                COUNT(*) as total_mhs
                            ")
                            ->where('kode_fak', $sijamuUnit->kode_fakultas);

                        if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                            $mhsStatsQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                        }
                        $baseStatsGrouped = $mhsStatsQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');

                        $dropOutGrouped = collect();
                        try {
                            $dropOutQuery = DB::connection('simak')->table('m_mahasiswa')
                                ->selectRaw("COALESCE(kode_prodi, '') as kode_prodi, COUNT(*) as drop_out")
                                ->where('kode_fak', $sijamuUnit->kode_fakultas)
                                ->whereIn('status_mhs', ['DO', 'DROP OUT', 'KELUAR', 'Non-Aktif']);

                            if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                                $dropOutQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                            }
                            $dropOutGrouped = $dropOutQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');
                        } catch (\Throwable $eDo) {}

                        $graduatesQuery = DB::connection('simak')->table('m_mahasiswa')
                            ->selectRaw("
                                COALESCE(kode_prodi, '') as kode_prodi,
                                DATEDIFF(tanggal_lulus, tanggal_masuk) as masa_studi_hari
                            ")
                            ->where('kode_fak', $sijamuUnit->kode_fakultas)
                            ->whereNotNull('tanggal_lulus')
                            ->whereNotNull('tanggal_masuk')
                            ->where('tanggal_lulus', '<=', $cutOffDate);

                        if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                            $graduatesQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                        }
                        $graduates = $graduatesQuery->get();
                        $graduatesByProdi = $graduates->groupBy('kode_prodi');

                        $totalMhs = $baseStatsGrouped->sum('total_mhs');
                        $totalLulus = $graduates->count();
                    } catch (\Throwable $e) {
                        $this->warn("Akses SIMAK unit {$unitName} ({$unitId}) gagal: " . $e->getMessage());
                        continue;
                    }

                    $capaianPct = $totalMhs > 0 ? round(($totalLulus / $totalMhs) * 100, 2) : 0;

                    // Build detailed prodi breakdown for Excel export
                    $excelRows = [];
                    $prodiListQuery = DB::table('sijamu_fakultas_unit as s')
                        ->leftJoin('v_fakultas_unit as v', 's.id', '=', 'v.id')
                        ->where('s.kode_fakultas', $sijamuUnit->kode_fakultas);

                    if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                        $prodiListQuery->where('s.kode_prodi', $sijamuUnit->kode_prodi);
                    }

                    $prodis = $prodiListQuery->select('v.nama_fak_prod_unit as nama_prodi', 's.kode_fakultas', 's.kode_prodi', 'v.type', 'v.jenjang')->get();

                    foreach ($prodis as $p) {
                        $baseP = $baseStatsGrouped->get($p->kode_prodi);
                        $totMhsP = $baseP ? (int)$baseP->total_mhs : 0;

                        $doP = $dropOutGrouped->get($p->kode_prodi);
                        $dropOutP = $doP ? (int)$doP->drop_out : 0;

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

                        $jenjang = !empty($p->jenjang) ? $p->jenjang : 'S1';
                        if (preg_match('/\b(D3|D4|S1|S2|S3|Profesi)\b/i', $p->nama_prodi ?? '', $mj)) {
                            $jenjang = strtoupper($mj[1]);
                        }

                        $excelRows[] = [
                            $p->nama_prodi,
                            $jenjang,
                            $totMhsP,
                            $lulusTepatP,
                            $dropOutP,
                            $lulusTidakTepatP
                        ];
                    }

                    $headers = ['prodi', 'jenjang', 'total mahasiswa', 'total lulus tepat waktu', 'total drop out', 'total lulus tidak tepat waktu'];

                    foreach ($iku1Assigned as $indId) {
                        $indObj = DB::table('master_indikator')->where('id', $indId)->first();
                        $indikatorName = $indObj ? $indObj->iku : 'IKU 1';
                        $fileName = "{$indikatorName}.xlsx";

                        $tempPath = storage_path("app/temp/simak_{$tahun}_{$tw}_{$indId}.xlsx");
                        \App\Services\SimpleXlsxWriter::create($tempPath, $headers, $excelRows);

                        $fileUrl = null;
                        if (!$skipDrive && $twFolderId && file_exists($tempPath)) {
                            $ikuFolderId = $driveService->findFolder($indikatorName, $twFolderId);
                            if (!$ikuFolderId) {
                                $ikuFolderId = $driveService->createFolder($indikatorName, $twFolderId);
                            }
                            $targetParentId = $ikuFolderId ?: $twFolderId;

                            $fileUrl = $driveService->uploadFile($tempPath, $fileName, $targetParentId);
                            if ($fileUrl) {
                                @unlink($tempPath);
                            }
                        }

                        $exists = DB::table('template_capaian')
                            ->where('id_indikator', $indId)
                            ->where('fakultas_unit', $unitId)
                            ->where('tahun', $tahun)
                            ->where('triwulan', $tw)
                            ->first();

                        $updatePayload = [
                            'nilai_capaian' => $capaianPct,
                            'pembilang' => $totalLulus,
                            'penyebut' => $totalMhs,
                            'catatan' => "Perhitungan otomatis SIMAK (Cut-off {$tw} {$tahun}): Total Lulus {$totalLulus} / Total Mahasiswa {$totalMhs}",
                            'updated_at' => now(),
                        ];

                        if ($fileUrl) {
                            $updatePayload['file_url'] = $fileUrl;
                        }

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
                        $syncedCount++;
                    }
                }
            }
        }

        $this->info("Sinkronisasi IKU 1 SIMAK selesai. Total record diproses: {$syncedCount}");
    }

    protected function getMasaStudiTepatWaktuHari($jenjang, $namaProdi)
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

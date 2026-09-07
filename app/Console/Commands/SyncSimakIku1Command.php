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
                                COUNT(*) as total_mhs,
                                SUM(CASE WHEN tanggal_lulus IS NOT NULL AND tanggal_masuk IS NOT NULL AND tanggal_lulus <= ? THEN 1 ELSE 0 END) as total_lulus,
                                SUM(CASE WHEN tanggal_lulus IS NOT NULL AND tanggal_masuk IS NOT NULL AND tanggal_lulus <= ? AND DATEDIFF(tanggal_lulus, tanggal_masuk) <= 1461 THEN 1 ELSE 0 END) as lulus_tepat,
                                SUM(CASE WHEN tanggal_lulus IS NOT NULL AND tanggal_masuk IS NOT NULL AND tanggal_lulus <= ? AND DATEDIFF(tanggal_lulus, tanggal_masuk) > 1461 THEN 1 ELSE 0 END) as lulus_tidak_tepat,
                                SUM(CASE WHEN status_mhs IN ('DO', 'DROP OUT', 'KELUAR', 'Non-Aktif') THEN 1 ELSE 0 END) as drop_out
                            ", [$cutOffDate, $cutOffDate, $cutOffDate])
                            ->where('kode_fak', $sijamuUnit->kode_fakultas);

                        if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                            $mhsStatsQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                        }

                        $simakStatsGrouped = $mhsStatsQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');
                        $totalMhs = $simakStatsGrouped->sum('total_mhs');
                        $totalLulus = $simakStatsGrouped->sum('total_lulus');
                    } catch (\Throwable $e) {
                        $this->warn("Akses tabel unpak_simak.m_mahasiswa ditolak/gagal: " . $e->getMessage());
                        break 2;
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
                        $statP = $simakStatsGrouped->get($p->kode_prodi);
                        $totMhsP = $statP ? (int)$statP->total_mhs : 0;
                        $lulusTepatP = $statP ? (int)$statP->lulus_tepat : 0;
                        $lulusTidakTepatP = $statP ? (int)$statP->lulus_tidak_tepat : 0;
                        $dropOutP = $statP ? (int)$statP->drop_out : 0;

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
                            $fileUrl = $driveService->uploadFile($tempPath, $fileName, $twFolderId);
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
}

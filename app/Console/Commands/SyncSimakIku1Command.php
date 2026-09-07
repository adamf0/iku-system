<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SyncSimakIku1Command extends Command
{
    protected $signature = 'iku:sync-simak-iku1 {--tahun= : Tahun spesifik untuk sinkronisasi}';
    protected $description = 'Sinkronisasi otomatis data IKU 1 dari SIMAK dengan cut-off tanggal per triwulan';

    public function handle()
    {
        $tahunParam = $this->option('tahun');
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

        $syncedCount = 0;

        foreach ($targetYears as $tahun) {
            foreach ($units as $vUnit) {
                $unitId = $vUnit->id;

                // Find assigned IKU 1 indicators for this unit and year
                $iku1Assigned = DB::table('penugasan_target')
                    ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
                    ->where('penugasan_target.fakultas_unit', $unitId)
                    ->where('penugasan_target.tahun', $tahun)
                    ->where(function($q) {
                        $q->where('master_indikator.iku', 'LIKE', 'IKU 1%')
                          ->orWhere('master_indikator.id', 1);
                    })
                    ->whereNull('penugasan_target.deleted_at')
                    ->pluck('master_indikator.id');

                if ($iku1Assigned->isEmpty()) continue;

                $sijamuUnit = DB::table('sijamu_fakultas_unit')->where('id', $unitId)->first();
                if (!$sijamuUnit || empty($sijamuUnit->kode_fakultas)) continue;

                foreach ($triwulanCutOffs as $tw => $dateSuffix) {
                    $cutOffDate = $tahun . $dateSuffix;

                    try {
                        $mQuery = DB::table('unpak_simak.m_mahasiswa')
                            ->where('kode_fak', $sijamuUnit->kode_fakultas);

                        if (!empty($sijamuUnit->kode_prodi) && (strtolower($vUnit->type) === 'prodi')) {
                            $mQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                        }

                        $totalMhs = (clone $mQuery)->count();
                        $totalLulus = (clone $mQuery)
                            ->whereNotNull('tanggal_lulus')
                            ->whereNotNull('tanggal_masuk')
                            ->where('tanggal_lulus', '<=', $cutOffDate)
                            ->count();
                    } catch (\Throwable $e) {
                        $this->warn("Akses tabel unpak_simak.m_mahasiswa ditolak/gagal: " . $e->getMessage());
                        break 2;
                    }

                    $capaianPct = $totalMhs > 0 ? round(($totalLulus / $totalMhs) * 100, 2) : 0;

                    foreach ($iku1Assigned as $indId) {
                        $exists = DB::table('template_capaian')
                            ->where('id_indikator', $indId)
                            ->where('fakultas_unit', $unitId)
                            ->where('tahun', $tahun)
                            ->where('triwulan', $tw)
                            ->first();

                        if (!$exists) {
                            DB::table('template_capaian')->insert([
                                'id_indikator' => $indId,
                                'fakultas_unit' => $unitId,
                                'tahun' => $tahun,
                                'triwulan' => $tw,
                                'nilai_capaian' => $capaianPct,
                                'pembilang' => $totalLulus,
                                'penyebut' => $totalMhs,
                                'catatan' => "Perhitungan otomatis SIMAK (Cut-off {$tw} {$tahun}): Total Lulus {$totalLulus} / Total Mahasiswa {$totalMhs}",
                                'status_validasi' => 'DIAJUKAN',
                                'diinput_oleh' => 'system_simak',
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        } else {
                            if (!in_array($exists->status_validasi, ['DIVERIFIKASI', 'DISAHKAN'])) {
                                DB::table('template_capaian')
                                    ->where('id', $exists->id)
                                    ->update([
                                        'nilai_capaian' => $capaianPct,
                                        'pembilang' => $totalLulus,
                                        'penyebut' => $totalMhs,
                                        'catatan' => "Perhitungan otomatis SIMAK (Cut-off {$tw} {$tahun}): Total Lulus {$totalLulus} / Total Mahasiswa {$totalMhs}",
                                        'updated_at' => now(),
                                    ]);
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

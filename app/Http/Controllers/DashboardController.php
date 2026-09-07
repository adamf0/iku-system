<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    private $TRIWULAN = ['TW1', 'TW2', 'TW3', 'TW4'];

    private function getScopedCapaian(Request $request, $tahun)
    {
        $user = $request->user();
        $scope = $user->scopeUnits();

        $query = DB::table('template_capaian')
            ->where('tahun', $tahun);

        if ($request->filled('unit')) {
            $query->where('fakultas_unit', $request->query('unit'));
        } else {
            $query->whereIn('fakultas_unit', $scope);
        }

        return $query->get();
    }

    private function getUnitTarget($iku, $unitObj, $targetYearRecord = null)
    {
        if (!$unitObj) {
            $t = (float)($targetYearRecord->target ?? $iku->target);
            return $t > 0 ? $t : 1;
        }

        $type = strtoupper($unitObj->type ?? '');
        $jenjang = strtoupper($unitObj->jenjang ?? '');

        if ($type === 'PRODI') {
            $col = match ($jenjang) {
                'S1' => 'target_s1',
                'S2' => 'target_s2',
                'S3' => 'target_s3',
                'D3' => 'target_d3',
                'D4' => 'target_d4',
                'PROFESI' => 'target_profesi',
                default => null
            };

            if ($col) {
                if ($targetYearRecord && isset($targetYearRecord->$col) && is_numeric($targetYearRecord->$col) && (float)$targetYearRecord->$col > 0) {
                    return (float)$targetYearRecord->$col;
                }
                if (isset($iku->$col) && is_numeric($iku->$col) && (float)$iku->$col > 0) {
                    return (float)$iku->$col;
                }
            }

            if ($targetYearRecord && isset($targetYearRecord->target_prodi) && is_numeric($targetYearRecord->target_prodi) && (float)$targetYearRecord->target_prodi > 0) {
                return (float)$targetYearRecord->target_prodi;
            }
            if (isset($iku->target_prodi) && is_numeric($iku->target_prodi) && (float)$iku->target_prodi > 0) {
                return (float)$iku->target_prodi;
            }
        } elseif ($type === 'FAKULTAS') {
            if ($targetYearRecord && isset($targetYearRecord->target_fakultas) && is_numeric($targetYearRecord->target_fakultas) && (float)$targetYearRecord->target_fakultas > 0) {
                return (float)$targetYearRecord->target_fakultas;
            }
            if (isset($iku->target_fakultas) && is_numeric($iku->target_fakultas) && (float)$iku->target_fakultas > 0) {
                return (float)$iku->target_fakultas;
            }
        } elseif ($type === 'UNIT') {
            if ($targetYearRecord && isset($targetYearRecord->target_unit) && is_numeric($targetYearRecord->target_unit) && (float)$targetYearRecord->target_unit > 0) {
                return (float)$targetYearRecord->target_unit;
            }
            if (isset($iku->target_unit) && is_numeric($iku->target_unit) && (float)$iku->target_unit > 0) {
                return (float)$iku->target_unit;
            }
        }

        $t = (float)($targetYearRecord->target ?? $iku->target);
        return $t > 0 ? $t : 1;
    }

    public function summaryData(Request $request)
    {
        $tahunParam = $request->query('tahun', date('Y'));
        $tahun = $tahunParam === 'ALL' ? 'ALL' : (int)$tahunParam;
        
        $triwulanParam = strtoupper($request->query('triwulan', $request->query('tw', 'ALL')));

        $user = $request->user();
        $scope = $user ? $user->scopeUnits() : [1];

        // Fetch template_capaian in scope for user status counts & per_iku table
        $allCapaianRows = DB::table('template_capaian')
            ->whereIn('fakultas_unit', $scope)
            ->get();

        $data = $allCapaianRows;
        if ($request->filled('unit')) {
            $data = $data->where('fakultas_unit', $request->query('unit'));
        }
        if ($tahun !== 'ALL') {
            $data = $data->where('tahun', $tahun);
        }

        // Fetch ALL template_capaian across all units for executive multi-prodi aggregate chart
        $sebaranQuery = DB::table('template_capaian');
        if ($request->filled('chart_unit')) {
            $sebaranQuery->where('fakultas_unit', $request->query('chart_unit'));
        }
        $sebaranCapaianRows = $sebaranQuery->get();

        // Fetch ALL master indicators, units, and years ONCE
        $allIkuList = DB::table('master_indikator')->orderBy('id', 'asc')->get();
        $unitsMap = DB::table('v_fakultas_unit')->get()->keyBy('id');
        $targetYearMap = DB::table('target_indikator_tahun')->get()->groupBy('id_indikator');

        $registeredYears = DB::table('master_tahun')->orderBy('tahun', 'asc')->pluck('tahun')->toArray();
        if (empty($registeredYears)) {
            $registeredYears = [2025, 2026];
        }

        $statusCount = [
            'DRAFT' => 0,
            'DIAJUKAN' => 0,
            'DIVERIFIKASI' => 0,
            'DISAHKAN' => 0,
            'DITOLAK' => 0
        ];

        foreach ($data as $c) {
            if (isset($statusCount[$c->status_validasi])) {
                $statusCount[$c->status_validasi]++;
            }
        }

        $perIku = [];
        $sebaranPerIku = [];

        foreach ($allIkuList as $iku) {
            $rows = $data->filter(function ($item) use ($iku) {
                return $item->id_indikator === $iku->id;
            });

            // Get triwulan specific values across user scope
            $twDetails = [];
            foreach ($this->TRIWULAN as $tw) {
                $rowsTw = $rows->where('triwulan', $tw);
                if ($rowsTw->count() > 0) {
                    $avgNilai = round($rowsTw->avg('nilai_capaian'), 2);
                    $firstSah = $rowsTw->where('status_validasi', 'DISAHKAN')->first();
                    $statusVal = $firstSah ? 'DISAHKAN' : ($rowsTw->first() ? $rowsTw->first()->status_validasi : null);
                    $twDetails[$tw] = [
                        'nilai' => $avgNilai,
                        'status_validasi' => $statusVal
                    ];
                } else {
                    $twDetails[$tw] = [
                        'nilai' => null,
                        'status_validasi' => null
                    ];
                }
            }

            $rowsSah = $rows->where('status_validasi', 'DISAHKAN');
            $capaianRata = $rowsSah->count() > 0 ? round($rowsSah->avg('nilai_capaian'), 2) : ($rows->count() > 0 ? round($rows->avg('nilai_capaian'), 2) : null);

            $target = (float)$iku->target;
            $baseLine = (float)$iku->base_line;
            
            $status = 'BELUM ADA DATA SAH';
            if ($capaianRata !== null) {
                $status = $capaianRata >= $target ? 'TERCAPAI' : 'BELUM TERCAPAI';
            }

            // Clean code label for X-axis
            $kodeLabel = $iku->iku;
            $hasData = ($rows->count() > 0 && $capaianRata !== null);

            // Calculate Multi-Prodi Aggregate Capaian % for Sebaran Per IKU
            // Formula: (sum(realisasi_i) / sum(target_i)) * 100%
            $rowsSebaran = $sebaranCapaianRows->filter(function ($item) use ($iku) {
                return $item->id_indikator === $iku->id;
            });
            $rowsSebaranTahun = ($tahun !== 'ALL') ? $rowsSebaran->where('tahun', $tahun) : $rowsSebaran;

            $twPcts = [];
            foreach ($this->TRIWULAN as $tw) {
                $rowsTw = $rowsSebaranTahun->where('triwulan', $tw);
                if ($rowsTw->count() > 0) {
                    $sumRealisasiTw = 0;
                    $sumTargetTw = 0;
                    foreach ($rowsTw as $r) {
                        $uObj = $unitsMap->get($r->fakultas_unit);
                        $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                        $sumRealisasiTw += (float)$r->nilai_capaian;
                        $sumTargetTw += $this->getUnitTarget($iku, $uObj, $tObj);
                    }
                    $twPcts[$tw] = $sumTargetTw > 0 ? min(100, round(($sumRealisasiTw / $sumTargetTw) * 100, 1)) : 0;
                } else {
                    $twPcts[$tw] = 0;
                }
            }

            $targetPct = ($target > 0) ? 100 : 0;
            $baselinePct = ($target > 0 && $baseLine > 0) ? min(100, round(($baseLine / $target) * 100, 1)) : min(100, $baseLine);

            if ($rowsSebaranTahun->count() > 0) {
                $sumRealisasiTotal = 0;
                $sumTargetTotal = 0;
                foreach ($rowsSebaranTahun as $r) {
                    $uObj = $unitsMap->get($r->fakultas_unit);
                    $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                    $sumRealisasiTotal += (float)$r->nilai_capaian;
                    $sumTargetTotal += $this->getUnitTarget($iku, $uObj, $tObj);
                }
                $allPct = $sumTargetTotal > 0 ? min(100, round(($sumRealisasiTotal / $sumTargetTotal) * 100, 1)) : 0;
            } else {
                $allPct = 0;
            }

            // Generate multi-year breakdown (yearsData)
            $yearsData = [];
            foreach ($registeredYears as $yr) {
                $rowsYr = $rowsSebaran->where('tahun', $yr);
                $twPctsYr = [];
                $targetYr = (float)$iku->target;

                foreach ($this->TRIWULAN as $tw) {
                    $rowsYrTw = $rowsYr->where('triwulan', $tw);
                    if ($rowsYrTw->count() > 0) {
                        $sumRealisasiTw = 0;
                        $sumTargetTw = 0;
                        foreach ($rowsYrTw as $r) {
                            $uObj = $unitsMap->get($r->fakultas_unit);
                            $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $yr) : null;
                            $sumRealisasiTw += (float)$r->nilai_capaian;
                            $sumTargetTw += $this->getUnitTarget($iku, $uObj, $tObj);
                        }
                        $twPctsYr[$tw] = $sumTargetTw > 0 ? min(100, round(($sumRealisasiTw / $sumTargetTw) * 100, 1)) : 0;
                    } else {
                        $twPctsYr[$tw] = 0;
                    }
                }

                $capaianYr = $rowsYr->count() > 0 ? (float)$rowsYr->avg('nilai_capaian') : null;
                $baselineYr = (float)$iku->base_line;

                if ($rowsYr->count() > 0) {
                    $sumRealisasiYr = 0;
                    $sumTargetYr = 0;
                    foreach ($rowsYr as $r) {
                        $uObj = $unitsMap->get($r->fakultas_unit);
                        $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $yr) : null;
                        $sumRealisasiYr += (float)$r->nilai_capaian;
                        $sumTargetYr += $this->getUnitTarget($iku, $uObj, $tObj);
                    }
                    $capaianPctYr = $sumTargetYr > 0 ? min(100, round(($sumRealisasiYr / $sumTargetYr) * 100, 1)) : 0;
                } else {
                    $capaianPctYr = 0;
                }

                $baselinePctYr = ($targetYr > 0 && $baselineYr > 0) ? min(100, round(($baselineYr / $targetYr) * 100, 1)) : min(100, $baselineYr);

                $yearsData[$yr] = [
                    'tahun' => $yr,
                    'target' => $targetYr,
                    'target_pct' => ($targetYr > 0) ? 100 : 0,
                    'base_line' => $baselineYr,
                    'baseline_pct' => $baselinePctYr,
                    'capaian' => $capaianYr ?? 0,
                    'capaian_pct' => $capaianPctYr,
                    'has_data' => ($capaianYr !== null),
                    'TW1' => $twPctsYr['TW1'],
                    'TW2' => $twPctsYr['TW2'],
                    'TW3' => $twPctsYr['TW3'],
                    'TW4' => $twPctsYr['TW4'],
                    'ALL' => $capaianPctYr
                ];
            }

            $perIkuItem = [
                'id' => $iku->id,
                'kode_iku' => $kodeLabel,
                'raw_kode' => $iku->iku,
                'nama_indikator' => $iku->kategori ?: $iku->full_kategori,
                'full_kategori' => $iku->full_kategori,
                'jenis_iku' => $iku->jenis_iku ?? 'WAJIB',
                'sifat' => $iku->jenis_iku ?? 'WAJIB',
                'satuan' => $iku->satuan,
                'base_line' => $baseLine,
                'target' => $target,
                'capaian_rata' => $capaianRata,
                'capaian_tw1' => $twDetails['TW1']['nilai'] ?? null,
                'status_tw1' => $twDetails['TW1']['status_validasi'] ?? null,
                'capaian_tw2' => $twDetails['TW2']['nilai'] ?? null,
                'status_tw2' => $twDetails['TW2']['status_validasi'] ?? null,
                'capaian_tw3' => $twDetails['TW3']['nilai'] ?? null,
                'status_tw3' => $twDetails['TW3']['status_validasi'] ?? null,
                'capaian_tw4' => $twDetails['TW4']['nilai'] ?? null,
                'status_tw4' => $twDetails['TW4']['status_validasi'] ?? null,
                'status' => $status
            ];

            $perIku[] = $perIkuItem;

            $sebaranPerIku[] = [
                'id' => $iku->id,
                'kode_iku' => $kodeLabel,
                'nama' => $iku->full_kategori ?: $iku->kategori,
                'base_line' => $baseLine,
                'baseline_pct' => $baselinePct,
                'target' => $target,
                'target_pct' => $targetPct,
                'capaian' => $capaianRata ?? 0,
                'capaian_pct' => $allPct,
                'has_data' => $hasData,
                'years_data' => $yearsData,
                'TW1' => $twPcts['TW1'],
                'TW2' => $twPcts['TW2'],
                'TW3' => $twPcts['TW3'],
                'TW4' => $twPcts['TW4'],
                'ALL' => $allPct
            ];
        }

        $totalTercapai = count(array_filter($perIku, function($x) { return $x['status'] === 'TERCAPAI'; }));
        $totalAdaData = count(array_filter($perIku, function($x) { return $x['capaian_rata'] !== null; }));

        $totalIkus = max(1, $allIkuList->count());
        $twSummary = [];
        $totalCapaianSum = 0;
        $totalCapaianCount = 0;

        // Executive TW Summary & Overall Capaian calculated across all units from template_capaian for selected year
        $execCapaianRows = ($tahun !== 'ALL') ? $sebaranCapaianRows->where('tahun', $tahun) : $sebaranCapaianRows;

        foreach ($this->TRIWULAN as $tw) {
            $rowsTw = $execCapaianRows->where('triwulan', $tw);
            $filledCount = $rowsTw->pluck('id_indikator')->unique()->count();
            $isianPct = round(($filledCount / $totalIkus) * 100, 1);

            $capaianPctList = [];
            foreach ($rowsTw as $r) {
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef) {
                    $uObj = $unitsMap->get($r->fakultas_unit);
                    $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                    $targetVal = $this->getUnitTarget($ikuDef, $uObj, $tObj);
                    if ($targetVal > 0) {
                        $pct = min(100, round(((float)$r->nilai_capaian / $targetVal) * 100, 2));
                        $capaianPctList[] = $pct;
                    }
                }
            }

            $capaianAvg = count($capaianPctList) > 0 ? round(array_sum($capaianPctList) / count($capaianPctList), 2) : 0;
            if ($capaianAvg > 0) {
                $totalCapaianSum += $capaianAvg;
                $totalCapaianCount++;
            }

            $hasSubmitted = $rowsTw->whereIn('status_validasi', ['DIAJUKAN', 'DIVERIFIKASI', 'DISAHKAN'])->count() > 0;
            $status = $hasSubmitted ? 'SUBMITTED' : 'DRAFT';
            $isClosed = in_array($tw, ['TW1', 'TW2']) || ($hasSubmitted && $isianPct >= 100);

            $twSummary[$tw] = [
                'triwulan' => $tw,
                'capaian' => $capaianAvg,
                'isian_percent' => $isianPct,
                'status' => $status,
                'is_closed' => $isClosed,
                'days_remaining' => ($tw === 'TW3' && !$isClosed) ? 43 : null
            ];
        }

        $overallCapaian = $totalCapaianCount > 0 ? round($totalCapaianSum / $totalCapaianCount, 2) : 0;

        // Fetch SIMAK student study duration statistics (tanggal_lulus - tanggal_masuk) per unit
        try {
            $mStats = DB::connection('simak')->table('m_mahasiswa')
                ->select(
                    'kode_fak',
                    'kode_prodi',
                    DB::raw('COUNT(NIM) as total_lulusan'),
                    DB::raw('ROUND(AVG(DATEDIFF(tanggal_lulus, tanggal_masuk)/365.25), 2) as avg_lama_kuliah')
                )
                ->whereNotNull('tanggal_lulus')
                ->whereNotNull('tanggal_masuk')
                ->groupBy('kode_fak', 'kode_prodi')
                ->get();

            $sijamuUnits = DB::table('sijamu_fakultas_unit')->get();
            $simakStats = collect();

            foreach ($sijamuUnits as $s) {
                $stat = $mStats->first(function($item) use ($s) {
                    if (!empty($s->kode_prodi)) {
                        return $item->kode_fak == $s->kode_fakultas && $item->kode_prodi == $s->kode_prodi;
                    }
                    return $item->kode_fak == $s->kode_fakultas;
                });

                if ($stat) {
                    $simakStats->put($s->id, (object)[
                        'unit_id' => $s->id,
                        'total_lulusan' => (int)$stat->total_lulusan,
                        'avg_lama_kuliah' => (float)$stat->avg_lama_kuliah
                    ]);
                }
            }
        } catch (\Throwable $e) {
            $simakStats = collect();
        }

        // Capaian Semua Unit (Evaluated per year & triwulan filter)
        $unitTwParam = strtoupper($request->query('unit_tw', 'ALL'));
        $unitsList = DB::table('v_fakultas_unit');
        if (!in_array($user->role ?? '', ['ADMIN', 'LPM'])) {
            $unitsList->whereIn('id', $scope);
        }
        $unitsList = $unitsList->get();

        $capaianPerUnit = [];
        foreach ($unitsList as $u) {
            $rowsUnit = $sebaranCapaianRows->where('fakultas_unit', $u->id);
            if ($tahun !== 'ALL') {
                $rowsUnit = $rowsUnit->where('tahun', $tahun);
            }
            if ($unitTwParam !== 'ALL') {
                $rowsUnit = $rowsUnit->where('triwulan', $unitTwParam);
            }

            $unitPcts = [];
            foreach ($rowsUnit as $r) {
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef) {
                    $uObj = $unitsMap->get($r->fakultas_unit);
                    $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                    $targetVal = $this->getUnitTarget($ikuDef, $uObj, $tObj);
                    if ($targetVal > 0) {
                        $pct = min(100, round(((float)$r->nilai_capaian / $targetVal) * 100, 1));
                        $unitPcts[] = $pct;
                    }
                }
            }

            $capaianAvg = count($unitPcts) > 0 ? round(array_sum($unitPcts) / count($unitPcts), 1) : 0;
            $stat = $simakStats->get($u->id);

            $capaianPerUnit[] = [
                'id' => $u->id,
                'nama_unit' => $u->nama_fak_prod_unit,
                'type' => strtoupper($u->type),
                'capaian' => $capaianAvg,
                'total_laporan' => $rowsUnit->count(),
                'total_lulusan' => $stat ? (int)$stat->total_lulusan : 0,
                'avg_lama_kuliah' => $stat ? (float)$stat->avg_lama_kuliah : null,
            ];
        }

        $isAssigned = true;
        if ($user && !in_array($user->role, ['ADMIN', 'LPM'])) {
            $isAssigned = DB::table('penugasan_target')
                ->where('fakultas_unit', $user->fakultas_unit)
                ->where('tahun', $tahun)
                ->whereNull('deleted_at')
                ->exists();
        }

        return [
            'tahun' => $tahunParam,
            'overall_capaian' => $overallCapaian,
            'triwulan_summary' => $twSummary,
            'sebaran_per_iku' => $sebaranPerIku,
            'capaian_per_unit' => $capaianPerUnit,
            'total_unit_terpantau' => count($scope),
            'total_iku_dipantau' => $allIkuList->count(),
            'total_laporan' => $data->count(),
            'status_count' => $statusCount,
            'persentase_iku_tercapai' => $totalAdaData ? round(($totalTercapai / $totalAdaData) * 100, 1) : 0,
            'per_iku' => $perIku,
            'is_assigned' => $isAssigned
        ];
    }

    public function summary(Request $request)
    {
        if ($request->header('Accept') === 'text/event-stream' || $request->query('stream') == '1' || $request->query('sse') == '1') {
            return $this->streamSummary($request);
        }

        return response()->json($this->summaryData($request));
    }

    // Real-time Stream for Executive Dashboard (High efficiency, zero OOM, instant release)
    public function streamSummary(Request $request)
    {
        return new StreamedResponse(function () use ($request) {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }

            set_time_limit(0);
            ignore_user_abort(false); // Clean termination on client disconnect

            $lastHash = null;
            $maxLoops = 15; // 15 loops * 2 sec = 30 seconds connection lifecycle max
            $count = 0;

            while ($count < $maxLoops) {
                if (connection_aborted()) {
                    break;
                }

                $summaryData = $this->summaryData($request);
                $currentHash = md5(json_encode($summaryData));

                if ($lastHash === null || $lastHash !== $currentHash) {
                    echo "event: dashboard_update\ndata: " . json_encode($summaryData) . "\n\n";
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                    $lastHash = $currentHash;
                } else {
                    echo "event: ping\ndata: {\"timestamp\":" . time() . "}\n\n";
                    if (ob_get_level() > 0) ob_flush();
                    flush();
                }

                $count++;
                gc_collect_cycles(); // Force memory garbage collection
                sleep(2);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'close',
            'X-Accel-Buffering' => 'no'
        ]);
    }

    public function rekapMatriks(Request $request)
    {
        $tahun = $request->query('tahun', date('Y'));
        $triwulan = $request->query('triwulan', 'Q1');
        
        $data = $this->getScopedCapaian($request, $tahun)->where('triwulan', $triwulan);
        $user = $request->user();
        $scope = $user->scopeUnits();

        $unitsToShow = DB::table('units')->whereIn('id', $scope)->get();
        $ikuList = DB::table('master_indikator')->whereNull('id_sub')->get();

        $matriks = [];
        foreach ($unitsToShow as $u) {
            $row = [
                'id' => $u->id,
                'nama_unit' => $u->nama_fak_prod_unit,
                'jenjang' => $u->jenjang,
                'nilai' => []
            ];

            foreach ($ikuList as $iku) {
                $found = $data->where('fakultas_unit', $u->id)->where('id_indikator', $iku->id)->first();
                $row['nilai'][$iku->id] = $found ? [
                    'capaian' => (float)$found->nilai_capaian,
                    'target' => (float)$iku->target,
                    'status' => $found->status_validasi
                ] : null;
            }
            $matriks[] = $row;
        }

        return response()->json([
            'tahun' => (int)$tahun,
            'triwulan' => $triwulan,
            'iku_columns' => $ikuList->map(function ($i) {
                return ['id' => $i->id, 'kode_iku' => $i->iku, 'nama' => $i->kategori];
            }),
            'matriks' => $matriks
        ]);
    }

    public function antreanVerifikasi(Request $request)
    {
        $user = $request->user();
        if (!in_array($user->role, ['LPM', 'ADMIN'])) {
            return response()->json(['error' => 'Hanya LPM/Admin yang dapat mengakses antrean verifikasi.'], 403);
        }

        $query = DB::table('template_capaian')
            ->join('v_fakultas_unit', 'template_capaian.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->join('master_indikator', 'template_capaian.id_indikator', '=', 'master_indikator.id')
            ->leftJoin('target_indikator_tahun', function($join) {
                $join->on('template_capaian.id_indikator', '=', 'target_indikator_tahun.id_indikator')
                     ->on('template_capaian.tahun', '=', 'target_indikator_tahun.tahun');
            })
            ->select(
                'template_capaian.id as id_capaian',
                'template_capaian.fakultas_unit',
                'template_capaian.id_indikator',
                'template_capaian.tahun',
                'template_capaian.triwulan',
                'template_capaian.nilai_capaian',
                'template_capaian.file_url',
                'template_capaian.status_validasi',
                'template_capaian.diinput_oleh',
                'template_capaian.alasan_penolakan',
                'template_capaian.created_at',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'v_fakultas_unit.type as type_unit',
                'master_indikator.iku as kode_iku',
                'master_indikator.kategori as nama_iku',
                'master_indikator.full_kategori',
                'master_indikator.satuan',
                'master_indikator.jenis_iku',
                DB::raw('COALESCE(target_indikator_tahun.base_line, master_indikator.base_line) as base_line'),
                DB::raw('COALESCE(target_indikator_tahun.target, master_indikator.target) as target')
            )
            ->orderBy("template_capaian.triwulan","asc")
            ->orderBy("template_capaian.tahun","asc");

        if ($request->filled('tahun') && $request->query('tahun') !== 'ALL') {
            $query->where('template_capaian.tahun', $request->query('tahun'));
        }
        if ($request->filled('triwulan') && $request->query('triwulan') !== 'ALL') {
            $query->where('template_capaian.triwulan', $request->query('triwulan'));
        }
        if ($request->filled('unit')) {
            $query->where('template_capaian.fakultas_unit', $request->query('unit'));
        }
        if ($request->filled('indikator')) {
            $query->where('template_capaian.id_indikator', $request->query('indikator'));
        }
        if ($request->filled('status') && $request->query('status') !== 'ALL') {
            $query->where('template_capaian.status_validasi', $request->query('status'));
        }

        $data = $query->orderBy('template_capaian.created_at', 'desc')->get();

        return response()->json($data);
    }

    private function extractGdriveFileId($url) {
        if (preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $url, $m)) {
            return $m[1];
        }
        if (preg_match('/[?&]id=([a-zA-Z0-9_-]+)/', $url, $m)) {
            return $m[1];
        }
        return null;
    }

    public function exportTwZip(Request $request)
    {
        $tw = strtoupper($request->query('tw', 'TW1'));
        if (!in_array($tw, ['TW1', 'TW2', 'TW3', 'TW4'])) {
            $tw = 'TW1';
        }
        $tahun = $request->query('tahun', date('Y'));
        if ($tahun === 'ALL') {
            $tahun = date('Y');
        }

        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        $parentFolderId = config('services.google.parent_folder_id', '1T1W4rzlCHZUa8VYQ7qCbij7aRPyuJtNf');
        $redirectUri = config('services.google.redirect_uri', 'http://localhost:8000/gdrive-callback');

        $tokenFile = storage_path('app/gdrive_token.json');
        $accessToken = null;

        if (file_exists($tokenFile)) {
            $tokenData = json_decode(file_get_contents($tokenFile), true);
            $accessToken = $tokenData['access_token'] ?? null;
            
            // Check if token expired and refresh_token is present
            if (isset($tokenData['created_at'], $tokenData['expires_in']) && (time() - $tokenData['created_at'] > $tokenData['expires_in'] - 60)) {
                if (!empty($tokenData['refresh_token'])) {
                    $ch = curl_init('https://oauth2.googleapis.com/token');
                    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                        'client_id' => $clientId,
                        'client_secret' => $clientSecret,
                        'refresh_token' => $tokenData['refresh_token'],
                        'grant_type' => 'refresh_token'
                    ]));
                    $res = curl_exec($ch);
                    curl_close($ch);
                    if ($res) {
                        $newToken = json_decode($res, true);
                        if (isset($newToken['access_token'])) {
                            $accessToken = $newToken['access_token'];
                            $tokenData['access_token'] = $accessToken;
                            $tokenData['created_at'] = time();
                            file_put_contents($tokenFile, json_encode($tokenData, JSON_PRETTY_PRINT));
                        }
                    }
                }
            }
        }

        // If no access token, redirect user to Google OAuth consent
        if (!$accessToken) {
            $authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" . http_build_query([
                'response_type' => 'code',
                'client_id' => $clientId,
                'redirect_uri' => $redirectUri,
                'scope' => 'https://www.googleapis.com/auth/drive',
                'access_type' => 'offline',
                'prompt' => 'consent',
                'state' => urlencode(json_encode(['tw' => $tw, 'tahun' => $tahun]))
            ]);
            return redirect($authUrl);
        }

        // 1. Resolve Year Folder (e.g. 2026) under parent
        $yearFolderId = null;
        $urlYear = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("'$parentFolderId' in parents and name = '$tahun' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
        $ch = curl_init($urlYear);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        $resYear = json_decode(curl_exec($ch), true);
        curl_close($ch);

        if (!empty($resYear['files'][0]['id'])) {
            $yearFolderId = $resYear['files'][0]['id'];
        }

        // 2. Resolve TW Folder (e.g. TW1) under year folder or parent folder
        $twFolderId = null;
        $searchParents = array_filter([$yearFolderId, $parentFolderId]);

        foreach ($searchParents as $pId) {
            $urlTw = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("'$pId' in parents and name = '$tw' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
            $ch = curl_init($urlTw);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
            $resTw = json_decode(curl_exec($ch), true);
            curl_close($ch);

            if (!empty($resTw['files'][0]['id'])) {
                $twFolderId = $resTw['files'][0]['id'];
                break;
            }
        }

        // Fallback global search for TW folder if needed
        if (!$twFolderId) {
            $urlTwGlobal = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("name = '$tw' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
            $ch = curl_init($urlTwGlobal);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
            $resTwG = json_decode(curl_exec($ch), true);
            curl_close($ch);
            if (!empty($resTwG['files'][0]['id'])) {
                $twFolderId = $resTwG['files'][0]['id'];
            }
        }

        // Create ZIP Archive
        $zipFileName = "IKU_System_{$tw}_{$tahun}.zip";
        $tempDir = storage_path('app/temp');
        if (!file_exists($tempDir)) {
            mkdir($tempDir, 0777, true);
        }
        $zipPath = $tempDir . '/' . $zipFileName;

        $zip = new \ZipArchive();
        if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return response()->json(['error' => 'Gagal membuat archive ZIP.'], 500);
        }

        $baseDirName = "{$tw}-{$tahun}";

        // Add 40 IKU empty subfolder structure to ZIP
        $ikuList = DB::table('master_indikator')->orderBy('id', 'asc')->get();
        foreach ($ikuList as $iku) {
            $folderName = $iku->iku;
            $zip->addEmptyDir("{$baseDirName}/{$folderName}");
        }

        // If Google Drive TW folder exists, pull subfolders and files
        if ($twFolderId) {
            $urlSub = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("'$twFolderId' in parents and trashed = false") . "&pageSize=1000";
            $ch = curl_init($urlSub);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
            $resSub = json_decode(curl_exec($ch), true);
            curl_close($ch);

            foreach ($resSub['files'] ?? [] as $subItem) {
                if ($subItem['mimeType'] === 'application/vnd.google-apps.folder') {
                    $subName = $subItem['name'];
                    $subFolderId = $subItem['id'];
                    $zip->addEmptyDir("{$baseDirName}/{$subName}");

                    // Fetch files inside this subfolder
                    $urlFiles = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("'$subFolderId' in parents and trashed = false") . "&pageSize=1000";
                    $chF = curl_init($urlFiles);
                    curl_setopt($chF, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chF, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                    $resFiles = json_decode(curl_exec($chF), true);
                    curl_close($chF);

                    foreach ($resFiles['files'] ?? [] as $fileItem) {
                        if ($fileItem['mimeType'] !== 'application/vnd.google-apps.folder') {
                            $fId = $fileItem['id'];
                            $fName = $fileItem['name'];

                            // Check Google Workspace export
                            if (str_contains($fileItem['mimeType'], 'google-apps.spreadsheet')) {
                                $dlUrl = "https://www.googleapis.com/drive/v3/files/{$fId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                                if (!str_contains($fName, '.')) $fName .= '.xlsx';
                            } elseif (str_contains($fileItem['mimeType'], 'google-apps.document')) {
                                $dlUrl = "https://www.googleapis.com/drive/v3/files/{$fId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                                if (!str_contains($fName, '.')) $fName .= '.docx';
                            } else {
                                $dlUrl = "https://www.googleapis.com/drive/v3/files/{$fId}?alt=media";
                            }

                            $chDl = curl_init($dlUrl);
                            curl_setopt($chDl, CURLOPT_RETURNTRANSFER, true);
                            curl_setopt($chDl, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                            curl_setopt($chDl, CURLOPT_FOLLOWLOCATION, true);
                            $fContent = curl_exec($chDl);
                            curl_close($chDl);

                            if ($fContent) {
                                $zip->addFromString("{$baseDirName}/{$subName}/{$fName}", $fContent);
                            }
                        }
                    }
                }
            }
        }

        // Also check DB template_capaian for files submitted for this TW and year
        $dbRows = DB::table('template_capaian')
            ->join('master_indikator', 'template_capaian.id_indikator', '=', 'master_indikator.id')
            ->where('template_capaian.triwulan', $tw)
            ->where('template_capaian.tahun', $tahun)
            ->whereNotNull('template_capaian.file_url')
            ->select('template_capaian.*', 'master_indikator.iku as kode_iku')
            ->get();

        foreach ($dbRows as $row) {
            $gdriveId = $this->extractGdriveFileId($row->file_url);
            if ($gdriveId) {
                // Fetch file metadata from Google Drive
                $urlMeta = "https://www.googleapis.com/drive/v3/files/{$gdriveId}?fields=id,name,mimeType";
                $chM = curl_init($urlMeta);
                curl_setopt($chM, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($chM, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                $resMeta = json_decode(curl_exec($chM), true);
                curl_close($chM);

                if (!empty($resMeta['name'])) {
                    $fName = $resMeta['name'];
                    $mime = $resMeta['mimeType'] ?? '';
                    
                    if (str_contains($mime, 'google-apps.spreadsheet')) {
                        $dlUrl = "https://www.googleapis.com/drive/v3/files/{$gdriveId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                        if (!str_contains($fName, '.')) $fName .= '.xlsx';
                    } elseif (str_contains($mime, 'google-apps.document')) {
                        $dlUrl = "https://www.googleapis.com/drive/v3/files/{$gdriveId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                        if (!str_contains($fName, '.')) $fName .= '.docx';
                    } else {
                        $dlUrl = "https://www.googleapis.com/drive/v3/files/{$gdriveId}?alt=media";
                    }

                    $chDl = curl_init($dlUrl);
                    curl_setopt($chDl, CURLOPT_RETURNTRANSFER, true);
                    curl_setopt($chDl, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                    curl_setopt($chDl, CURLOPT_FOLLOWLOCATION, true);
                    $fContent = curl_exec($chDl);
                    curl_close($chDl);

                    if ($fContent) {
                        $zip->addFromString("{$baseDirName}/{$row->kode_iku}/{$fName}", $fContent);
                        continue;
                    }
                }
            }

            if ($row->file_url && !str_contains($row->file_url, 'test_doc_file')) {
                $zip->addFromString("{$baseDirName}/{$row->kode_iku}/drive_link.url", "[InternetShortcut]\nURL={$row->file_url}\n");
            }
        }

        $zip->close();

        return response()->download($zipPath, $zipFileName)->deleteFileAfterSend(true);
    }
}

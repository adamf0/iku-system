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

    public function summaryData(Request $request)
    {
        $tahunParam = $request->query('tahun', date('Y'));
        $tahun = $tahunParam === 'ALL' ? 'ALL' : (int)$tahunParam;
        
        $triwulanParam = strtoupper($request->query('triwulan', $request->query('tw', 'ALL')));

        $user = $request->user();
        $scope = $user ? $user->scopeUnits() : [1];

        // Fetch ALL template_capaian in scope ONCE (Single batch query)
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

        // Fetch ALL master indicators and years ONCE
        $allIkuList = DB::table('master_indikator')->orderBy('id', 'asc')->get();
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

            // Get triwulan specific values across all reporting prodis/units
            $twDetails = [];
            $twPcts = [];
            $targetVal = (float)$iku->target;

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

                    $sumRealisasi = $rowsTw->sum('nilai_capaian');
                    $sumTarget = $rowsTw->count() * ($targetVal > 0 ? $targetVal : 1);
                    $twPcts[$tw] = min(100, round(($sumRealisasi / $sumTarget) * 100, 1));
                } else {
                    $twDetails[$tw] = [
                        'nilai' => null,
                        'status_validasi' => null
                    ];
                    $twPcts[$tw] = 0;
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

            // Normalized 0-100% values (Ratio of sum of realisasi over sum of targets)
            $targetPct = ($target > 0) ? 100 : 0;
            $baselinePct = ($target > 0 && $baseLine > 0) ? min(100, round(($baseLine / $target) * 100, 1)) : min(100, $baseLine);
            
            if ($rows->count() > 0 && $target > 0) {
                $sumRealisasiTotal = $rows->sum('nilai_capaian');
                $sumTargetTotal = $rows->count() * $target;
                $allPct = min(100, round(($sumRealisasiTotal / $sumTargetTotal) * 100, 1));
            } else {
                $allPct = 0;
            }

            // Generate multi-year breakdown from in-memory collection (NO subqueries!)
            $yearsData = [];
            foreach ($registeredYears as $yr) {
                $rowsYr = $allCapaianRows
                    ->where('id_indikator', $iku->id)
                    ->where('tahun', $yr);
                
                if ($request->filled('unit')) {
                    $rowsYr = $rowsYr->where('fakultas_unit', $request->query('unit'));
                }

                $twPctsYr = [];
                $targetYr = (float)$iku->target;
                foreach ($this->TRIWULAN as $tw) {
                    $rowsYrTw = $rowsYr->where('triwulan', $tw);
                    if ($rowsYrTw->count() > 0 && $targetYr > 0) {
                        $sumRealisasiTw = $rowsYrTw->sum('nilai_capaian');
                        $sumTargetTw = $rowsYrTw->count() * $targetYr;
                        $twPctsYr[$tw] = min(100, round(($sumRealisasiTw / $sumTargetTw) * 100, 1));
                    } else {
                        $twPctsYr[$tw] = 0;
                    }
                }

                $capaianYr = $rowsYr->count() > 0 ? (float)$rowsYr->avg('nilai_capaian') : null;
                $baselineYr = (float)$iku->base_line;

                if ($rowsYr->count() > 0 && $targetYr > 0) {
                    $sumRealisasiYr = $rowsYr->sum('nilai_capaian');
                    $sumTargetYr = $rowsYr->count() * $targetYr;
                    $capaianPctYr = min(100, round(($sumRealisasiYr / $sumTargetYr) * 100, 1));
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

        foreach ($this->TRIWULAN as $tw) {
            $rowsTw = $data->where('triwulan', $tw);
            $filledCount = $rowsTw->pluck('id_indikator')->unique()->count();
            $isianPct = round(($filledCount / $totalIkus) * 100, 1);

            $capaianPctList = [];
            foreach ($rowsTw as $r) {
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef && (float)$ikuDef->target > 0) {
                    $pct = min(100, round(((float)$r->nilai_capaian / (float)$ikuDef->target) * 100, 2));
                    $capaianPctList[] = $pct;
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
            $simakStats = DB::table('sijamu_fakultas_unit as s')
                ->select(
                    's.id as unit_id',
                    's.kode_fakultas',
                    's.kode_prodi',
                    DB::raw('COUNT(m.NIM) as total_lulusan'),
                    DB::raw('ROUND(AVG(DATEDIFF(m.tanggal_lulus, m.tanggal_masuk)/365.25), 2) as avg_lama_kuliah')
                )
                ->leftJoin('unpak_simak.m_mahasiswa as m', function($j) {
                    $j->on('m.kode_fak', '=', 's.kode_fakultas')
                      ->on('m.kode_prodi', '=', 's.kode_prodi');
                })
                ->whereNotNull('m.tanggal_lulus')
                ->whereNotNull('m.tanggal_masuk')
                ->groupBy('s.id', 's.kode_fakultas', 's.kode_prodi')
                ->get()
                ->keyBy('unit_id');
        } catch (\Throwable $e) {
            $simakStats = collect();
        }

        // Capaian Semua Unit (Evaluated from memory)
        $unitsList = DB::table('v_fakultas_unit')->whereIn('id', $scope)->get();
        $capaianPerUnit = [];
        foreach ($unitsList as $u) {
            $rowsUnit = $allCapaianRows->where('fakultas_unit', $u->id);
            if ($tahun !== 'ALL') {
                $rowsUnit = $rowsUnit->where('tahun', $tahun);
            }

            $unitPcts = [];
            foreach ($rowsUnit as $r) {
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef && (float)$ikuDef->target > 0) {
                    $pct = min(100, round(((float)$r->nilai_capaian / (float)$ikuDef->target) * 100, 1));
                    $unitPcts[] = $pct;
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
}

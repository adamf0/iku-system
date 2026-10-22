<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

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

    private function resolveUnitTargetValue($iku, $unitObj, $targetYearRecord = null)
    {
        if ($unitObj) {
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
                    if ($targetYearRecord && isset($targetYearRecord->$col) && $targetYearRecord->$col !== null && $targetYearRecord->$col !== '') {
                        return $targetYearRecord->$col;
                    }
                    if (isset($iku->$col) && $iku->$col !== null && $iku->$col !== '') {
                        return $iku->$col;
                    }
                }

                if ($targetYearRecord && isset($targetYearRecord->target_prodi) && $targetYearRecord->target_prodi !== null && $targetYearRecord->target_prodi !== '') {
                    return $targetYearRecord->target_prodi;
                }
                if (isset($iku->target_prodi) && $iku->target_prodi !== null && $iku->target_prodi !== '') {
                    return $iku->target_prodi;
                }
            } elseif ($type === 'FAKULTAS') {
                if ($targetYearRecord && isset($targetYearRecord->target_fakultas) && $targetYearRecord->target_fakultas !== null && $targetYearRecord->target_fakultas !== '') {
                    return $targetYearRecord->target_fakultas;
                }
                if (isset($iku->target_fakultas) && $iku->target_fakultas !== null && $iku->target_fakultas !== '') {
                    return $iku->target_fakultas;
                }
            } elseif ($type === 'UNIT') {
                if ($targetYearRecord && isset($targetYearRecord->target_unit) && $targetYearRecord->target_unit !== null && $targetYearRecord->target_unit !== '') {
                    return $targetYearRecord->target_unit;
                }
                if (isset($iku->target_unit) && $iku->target_unit !== null && $iku->target_unit !== '') {
                    return $iku->target_unit;
                }
            }
        }

        if ($targetYearRecord && isset($targetYearRecord->target) && $targetYearRecord->target !== null && $targetYearRecord->target !== '') {
            return $targetYearRecord->target;
        }

        return $iku->target ?? '-';
    }

    private function getUnitJenjang($u)
    {
        if (!$u) return null;
        $j = strtolower(trim($u->jenjang ?? ''));
        if (preg_match('/\b(d1|d2|d3|d4|s1|s2|s3|profesi)\b/i', $u->nama_fak_prod_unit ?? '', $m)) {
            $j = strtolower($m[1]);
        }
        if (empty($j) && ($u->kode_prodi ?? '') === '85202') {
            $j = 's1';
        }
        return $j ?: null;
    }

    public function summaryData(Request $request)
    {
        $tahunParam = $request->query('tahun', date('Y'));
        $tahun = $tahunParam === 'ALL' ? 'ALL' : (int)$tahunParam;
        
        $triwulanParam = strtoupper($request->query('triwulan', $request->query('tw', 'ALL')));

        $user = $request->user();
        $scope = $user ? $user->scopeUnits() : [1];

        $calcTahun = ($tahun !== 'ALL') ? (int)$tahun : (int)date('Y');

        // Preload live SIMAK IKU 1 data across all 4 quarters (cached 5 min for SSE / streaming efficiency)
        $simakByTw = [];
        foreach ($this->TRIWULAN as $tKey) {
            $simakByTw[$tKey] = \Illuminate\Support\Facades\Cache::remember(
                "simak_iku1_v4_{$calcTahun}_{$tKey}",
                300,
                function() use ($calcTahun, $tKey) {
                    return $this->calculateSimakIku1All($calcTahun, $tKey);
                }
            );
        }

        $jenjangIkuMap = [
            'd1' => ['id' => 2, 'kode' => 'IKU 1 - a'],
            'd2' => ['id' => 3, 'kode' => 'IKU 1 - b'],
            'd3' => ['id' => 4, 'kode' => 'IKU 1 - c'],
            'd4' => ['id' => 5, 'kode' => 'IKU 1 - d'],
            's1' => ['id' => 6, 'kode' => 'IKU 1 - e'],
            's2' => ['id' => 7, 'kode' => 'IKU 1 - f'],
            's3' => ['id' => 8, 'kode' => 'IKU 1 - g'],
            'profesi' => ['id' => 9, 'kode' => 'IKU 1 - h'],
        ];

        // Determine if a specific unit is selected or scoped for the user
        $selectedUnitId = $request->filled('unit') 
            ? (int)$request->query('unit') 
            : ($user && !in_array($user->role, ['ADMIN', 'LPM', 'FAKULTAS']) ? (int)$user->fakultas_unit : null);

        // Fetch assigned indicator IDs from penugasan_target if a specific unit is selected
        $assignedIkuIds = null;
        if ($selectedUnitId) {
            $assignedIkuQuery = DB::table('penugasan_target')
                ->leftJoin('gdrive_folder_logs', function($join) {
                    $join->on('penugasan_target.fakultas_unit', '=', 'gdrive_folder_logs.fakultas_unit')
                         ->on('penugasan_target.tahun', '=', 'gdrive_folder_logs.tahun')
                         ->on('penugasan_target.id_indikator', '=', 'gdrive_folder_logs.id_indikator');
                })
                ->where('penugasan_target.fakultas_unit', $selectedUnitId)
                ->whereNull('penugasan_target.deleted_at');
            if ($tahun !== 'ALL') {
                $assignedIkuQuery->where('penugasan_target.tahun', $tahun);
            }
            $assignedIkuIds = $assignedIkuQuery->orderByRaw('COALESCE(gdrive_folder_logs.id, penugasan_target.id) ASC')
                ->pluck('penugasan_target.id_indikator')->unique()->values()->toArray();

            // Sertakan indikator IKU 1 sesuai jenjang untuk prodi terpilih (misal IKU 1 - e untuk S1 KIMIA)
            $selectedUnitRow = DB::table('v_fakultas_unit')->where('id', $selectedUnitId)->first();
            if ($selectedUnitRow && strtolower($selectedUnitRow->type ?? '') === 'prodi') {
                $j = $this->getUnitJenjang($selectedUnitRow);
                if (isset($jenjangIkuMap[$j])) {
                    $prodiIku1Id = $jenjangIkuMap[$j]['id'];
                    if (!in_array($prodiIku1Id, $assignedIkuIds)) {
                        array_unshift($assignedIkuIds, $prodiIku1Id);
                    }
                }
            } elseif ($selectedUnitRow && strtolower($selectedUnitRow->type ?? '') === 'fakultas') {
                $facProdis = DB::table('v_fakultas_unit')
                    ->where(function($w) { $w->whereNull('is_active')->orWhere('is_active', 1); })
                    ->where('type', 'prodi')
                    ->where(function($w) use ($selectedUnitRow) {
                        $w->where('fakultas', $selectedUnitRow->nama_fak_prod_unit)
                          ->orWhere('kode_fakultas', $selectedUnitRow->kode_fakultas);
                    })
                    ->get();
                $facIku1Ids = [];
                foreach ($facProdis as $fp) {
                    $fpJ = $this->getUnitJenjang($fp);
                    if (isset($jenjangIkuMap[$fpJ])) {
                        $facIku1Ids[] = $jenjangIkuMap[$fpJ]['id'];
                    }
                }
                $facIku1Ids = array_unique($facIku1Ids);
                foreach (array_reverse($facIku1Ids) as $fId) {
                    if (!in_array($fId, $assignedIkuIds)) {
                        array_unshift($assignedIkuIds, $fId);
                    }
                }
            }
        }

        // Fetch template_capaian in scope for user status counts & per_iku table
        $allCapaianRows = DB::table('template_capaian')
            ->whereIn('fakultas_unit', $scope)
            ->get();

        $data = $allCapaianRows;
        if ($selectedUnitId) {
            $data = $data->where('fakultas_unit', $selectedUnitId);
            if (!empty($assignedIkuIds)) {
                $data = $data->whereIn('id_indikator', $assignedIkuIds);
            } else {
                $data = collect();
            }
        } elseif ($request->filled('unit')) {
            $data = $data->where('fakultas_unit', $request->query('unit'));
        }
        if ($tahun !== 'ALL') {
            $data = $data->where('tahun', $tahun);
        }

        // Fetch ALL template_capaian across active units for executive multi-prodi aggregate chart
        $activeUnitIds = DB::table('v_fakultas_unit')
            ->where(function($w) {
                $w->whereNull('is_active')->orWhere('is_active', 1);
            })
            ->pluck('id')
            ->toArray();

        $sebaranQuery = DB::table('template_capaian')->whereIn('fakultas_unit', $activeUnitIds);
        if ($request->filled('chart_unit')) {
            $sebaranQuery->where('fakultas_unit', $request->query('chart_unit'));
        }
        $sebaranCapaianRows = $sebaranQuery->get();

        // Fetch ALL master indicators, units, and years ONCE
        $allIkuList = DB::table('master_indikator')->orderBy('id', 'asc')->get();
        $unitsMap = DB::table('v_fakultas_unit')
            ->where(function($w) {
                $w->whereNull('is_active')->orWhere('is_active', 1);
            })
            ->get()
            ->keyBy('id');
        $targetYearMap = DB::table('target_indikator_tahun')->get()->groupBy('id_indikator');

        $registeredYears = DB::table('master_tahun')->orderBy('tahun', 'asc')->pluck('tahun')->toArray();
        if (empty($registeredYears)) {
            $registeredYears = [];
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

        // 1. Multi-Prodi / University-wide Sebaran Per IKU for aggregate distribution chart
        foreach ($allIkuList as $iku) {
            $isSimakIku = in_array($iku->id, range(1, 9));

            if ($isSimakIku) {
                $tObj = isset($targetYearMap[$iku->id]) ? $targetYearMap[$iku->id]->firstWhere('tahun', $calcTahun) : null;
                $target = ($tObj && is_numeric($tObj->target) && (float)$tObj->target > 0) ? (float)$tObj->target : ((float)$iku->target > 0 ? (float)$iku->target : 1);
                $baseLine = ($tObj && is_numeric($tObj->base_line) && (float)$tObj->base_line > 0) ? (float)$tObj->base_line : ((float)$iku->base_line > 0 ? (float)$iku->base_line : 0);

                $twPcts = [];
                foreach ($this->TRIWULAN as $tw) {
                    if ($iku->id === 1) {
                        $realVal = (float)($simakByTw[$tw]['aee_pt'] ?? 0);
                    } else {
                        $realVal = (float)($simakByTw[$tw]['by_id'][$iku->id]['tingkat_pencapaian'] ?? 0);
                    }
                    $twPcts[$tw] = $target > 0 ? min(100, round(($realVal / $target) * 100, 1)) : 0;
                }

                $targetPct = ($target > 0) ? 100 : 0;
                $baselinePct = ($target > 0 && $baseLine > 0) ? min(100, round(($baseLine / $target) * 100, 1)) : min(100, $baseLine);

                $activeTwFilter = in_array($triwulanParam, ['TW1', 'TW2', 'TW3', 'TW4']) ? $triwulanParam : 'TW3';
                if ($iku->id === 1) {
                    $capaianVal = (float)($simakByTw[$activeTwFilter]['aee_pt'] ?? 0);
                } else {
                    $capaianVal = (float)($simakByTw[$activeTwFilter]['by_id'][$iku->id]['tingkat_pencapaian'] ?? 0);
                }
                $allPct = $twPcts[$activeTwFilter] ?? (count($twPcts) > 0 ? round(array_sum($twPcts) / count($twPcts), 1) : 0);

                $yearsData = [];
                foreach ($registeredYears as $yr) {
                    $yearsData[$yr] = [
                        'tahun' => $yr,
                        'target' => $target,
                        'target_pct' => $targetPct,
                        'base_line' => $baseLine,
                        'baseline_pct' => $baselinePct,
                        'capaian' => $capaianVal,
                        'capaian_pct' => $allPct,
                        'has_data' => true,
                        'TW1' => $twPcts['TW1'],
                        'TW2' => $twPcts['TW2'],
                        'TW3' => $twPcts['TW3'],
                        'TW4' => $twPcts['TW4'],
                        'ALL' => $allPct
                    ];
                }

                $sebaranPerIku[] = [
                    'id' => $iku->id,
                    'kode_iku' => $iku->iku,
                    'nama' => $iku->full_kategori ?: $iku->kategori,
                    'base_line' => $baseLine,
                    'baseline_pct' => $baselinePct,
                    'target' => $target,
                    'target_pct' => $targetPct,
                    'capaian' => $capaianVal,
                    'capaian_pct' => $allPct,
                    'has_data' => true,
                    'years_data' => $yearsData,
                    'TW1' => $twPcts['TW1'],
                    'TW2' => $twPcts['TW2'],
                    'TW3' => $twPcts['TW3'],
                    'TW4' => $twPcts['TW4'],
                    'ALL' => $allPct
                ];
            } else {
                $rows = $data->filter(function ($item) use ($iku) {
                    return $item->id_indikator === $iku->id;
                });
                $rowsSah = $rows->where('status_validasi', 'DISAHKAN');
                $capaianRata = $rowsSah->count() > 0 ? round($rowsSah->avg('nilai_capaian'), 2) : ($rows->count() > 0 ? round($rows->avg('nilai_capaian'), 2) : null);

                $target = (float)$iku->target;
                $baseLine = (float)$iku->base_line;
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
                            $realVal = (float)$r->nilai_capaian;
                            if ($realVal <= 0) continue; // Hilangkan realisasi 0
                            $uObj = $unitsMap->get($r->fakultas_unit);
                            $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                            $targetVal = $this->getUnitTarget($iku, $uObj, $tObj);
                            if ($targetVal > 0) {
                                $sumRealisasiTw += $realVal;
                                $sumTargetTw += $targetVal;
                            }
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
                        $realVal = (float)$r->nilai_capaian;
                        if ($realVal <= 0) continue; // Hilangkan realisasi 0
                        $uObj = $unitsMap->get($r->fakultas_unit);
                        $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                        $targetVal = $this->getUnitTarget($iku, $uObj, $tObj);
                        if ($targetVal > 0) {
                            $sumRealisasiTotal += $realVal;
                            $sumTargetTotal += $targetVal;
                        }
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
                                $realVal = (float)$r->nilai_capaian;
                                if ($realVal <= 0) continue; // Hilangkan realisasi 0
                                $uObj = $unitsMap->get($r->fakultas_unit);
                                $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $yr) : null;
                                $targetVal = $this->getUnitTarget($iku, $uObj, $tObj);
                                if ($targetVal > 0) {
                                    $sumRealisasiTw += $realVal;
                                    $sumTargetTw += $targetVal;
                                }
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
                            $realVal = (float)$r->nilai_capaian;
                            if ($realVal <= 0) continue; // Hilangkan realisasi 0
                            $uObj = $unitsMap->get($r->fakultas_unit);
                            $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $yr) : null;
                            $targetVal = $this->getUnitTarget($iku, $uObj, $tObj);
                            if ($targetVal > 0) {
                                $sumRealisasiYr += $realVal;
                                $sumTargetYr += $targetVal;
                            }
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
        }

        // 2. Performance Distribution Table strictly matching penugasan_target for selected unit
        $targetUnitObj = $selectedUnitId ? $unitsMap->get($selectedUnitId) : null;
        $ikuListForPerIku = $selectedUnitId ? collect($assignedIkuIds ?? [])->map(fn($id) => $allIkuList->firstWhere('id', $id))->filter() : $allIkuList;

        foreach ($ikuListForPerIku as $iku) {
            $isSimakIku = in_array($iku->id, range(1, 9));

            if ($isSimakIku) {
                $twDetails = [];
                foreach ($this->TRIWULAN as $tw) {
                    if ($iku->id === 1) {
                        $val = (float)($simakByTw[$tw]['aee_pt'] ?? 0);
                    } else {
                        $val = (float)($simakByTw[$tw]['by_id'][$iku->id]['tingkat_pencapaian'] ?? 0);
                    }
                    $twDetails[$tw] = [
                        'nilai' => $val,
                        'status_validasi' => 'DISAHKAN'
                    ];
                }

                $activeTw = in_array($triwulanParam, ['TW1', 'TW2', 'TW3', 'TW4']) ? $triwulanParam : 'TW3';
                $capaianRata = $twDetails[$activeTw]['nilai'];

                $tObj = isset($targetYearMap[$iku->id]) ? $targetYearMap[$iku->id]->firstWhere('tahun', $calcTahun) : null;
                $rawTarget = $this->resolveUnitTargetValue($iku, $targetUnitObj, $tObj);
                $rawBaseLine = ($tObj && isset($tObj->base_line) && $tObj->base_line !== null && $tObj->base_line !== '') ? $tObj->base_line : ($iku->base_line ?? '-');

                $status = 'BELUM TERCAPAI';
                if (is_numeric($rawTarget) && (float)$rawTarget > 0) {
                    $status = ($capaianRata >= (float)$rawTarget) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                } else {
                    $status = ($capaianRata > 0) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                }

                $perIku[] = [
                    'id' => $iku->id,
                    'kode_iku' => $iku->iku,
                    'raw_kode' => $iku->iku,
                    'nama_indikator' => $iku->kategori ?: $iku->full_kategori,
                    'full_kategori' => $iku->full_kategori,
                    'jenis_iku' => $iku->jenis_iku ?? 'WAJIB',
                    'sifat' => $iku->jenis_iku ?? 'WAJIB',
                    'satuan' => $iku->satuan ?? '%',
                    'base_line' => $rawBaseLine,
                    'target' => $rawTarget,
                    'capaian_rata' => $capaianRata,
                    'capaian_tw1' => $twDetails['TW1']['nilai'],
                    'status_tw1' => $twDetails['TW1']['status_validasi'],
                    'capaian_tw2' => $twDetails['TW2']['nilai'],
                    'status_tw2' => $twDetails['TW2']['status_validasi'],
                    'capaian_tw3' => $twDetails['TW3']['nilai'],
                    'status_tw3' => $twDetails['TW3']['status_validasi'],
                    'capaian_tw4' => $twDetails['TW4']['nilai'],
                    'status_tw4' => $twDetails['TW4']['status_validasi'],
                    'status' => $status
                ];
            } else {
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

                $tObj = isset($targetYearMap[$iku->id]) ? $targetYearMap[$iku->id]->firstWhere('tahun', $tahun !== 'ALL' ? $tahun : date('Y')) : null;

                $rawTarget = $this->resolveUnitTargetValue($iku, $targetUnitObj, $tObj);
                $rawBaseLine = ($tObj && isset($tObj->base_line) && $tObj->base_line !== null && $tObj->base_line !== '') ? $tObj->base_line : ($iku->base_line ?? '-');

                $status = 'BELUM ADA DATA SAH';
                if ($capaianRata !== null) {
                    if (is_numeric($rawTarget) && (float)$rawTarget > 0) {
                        $status = $capaianRata >= (float)$rawTarget ? 'TERCAPAI' : 'BELUM TERCAPAI';
                    } else {
                        $status = 'DIPERIKSA';
                    }
                }

                $perIku[] = [
                    'id' => $iku->id,
                    'kode_iku' => $iku->iku,
                    'raw_kode' => $iku->iku,
                    'nama_indikator' => $iku->kategori ?: $iku->full_kategori,
                    'full_kategori' => $iku->full_kategori,
                    'jenis_iku' => $iku->jenis_iku ?? 'WAJIB',
                    'sifat' => $iku->jenis_iku ?? 'WAJIB',
                    'satuan' => $iku->satuan,
                    'base_line' => $rawBaseLine,
                    'target' => $rawTarget,
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
            }
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

            // Gabungkan ID indikator dari template_capaian dan indikator IKU 1 SIMAK (ID 1 s/d 9)
            $filledInds = $rowsTw->pluck('id_indikator')->merge(range(1, 9))->unique();
            $filledCount = $filledInds->count();
            $isianPct = round(($filledCount / $totalIkus) * 100, 1);

            $capaianPctList = [];
            foreach ($rowsTw as $r) {
                // Jangan hitung ganda ID 1-9 dari template_capaian, gunakan data resmi terverifikasi SIMAK
                if (in_array((int)$r->id_indikator, range(1, 9))) {
                    continue;
                }
                $realVal = (float)$r->nilai_capaian;
                // Hilangkan dari perhitungan jika realisasi bernilai 0
                if ($realVal <= 0) {
                    continue;
                }
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef) {
                    $uObj = $unitsMap->get($r->fakultas_unit);
                    $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $r->tahun) : null;
                    $targetVal = $this->getUnitTarget($ikuDef, $uObj, $tObj);
                    if ($targetVal > 0) {
                        $pct = min(100, round(($realVal / $targetVal) * 100, 2));
                        $capaianPctList[] = $pct;
                    }
                }
            }

            // Tambahkan persentase ketercapaian resmi SIMAK IKU 1 (AEE PT - ID 1) jika > 0
            $aeePt = (float)($simakByTw[$tw]['aee_pt'] ?? 0);
            if ($aeePt > 0) {
                $tObj1 = isset($targetYearMap[1]) ? $targetYearMap[1]->firstWhere('tahun', $calcTahun) : null;
                $targetVal1 = ($tObj1 && is_numeric($tObj1->target) && (float)$tObj1->target > 0) ? (float)$tObj1->target : (float)($allIkuList->firstWhere('id', 1)->target ?? 86);
                if ($targetVal1 > 0) {
                    $capaianPctList[] = min(100, round(($aeePt / $targetVal1) * 100, 2));
                }
            }

            // Tambahkan persentase ketercapaian resmi SIMAK Sub-IKU (ID 2 s/d 9) yang memiliki target dan realisasi > 0
            foreach (range(2, 9) as $subId) {
                $subVal = (float)($simakByTw[$tw]['by_id'][$subId]['tingkat_pencapaian'] ?? 0);
                if ($subVal <= 0) {
                    continue;
                }
                $subDef = $allIkuList->firstWhere('id', $subId);
                $tObjSub = isset($targetYearMap[$subId]) ? $targetYearMap[$subId]->firstWhere('tahun', $calcTahun) : null;
                $targetSub = ($tObjSub && is_numeric($tObjSub->target) && (float)$tObjSub->target > 0) 
                    ? (float)$tObjSub->target 
                    : (is_numeric($subDef->target ?? null) ? (float)$subDef->target : 0);
                if ($targetSub > 0) {
                    $capaianPctList[] = min(100, round(($subVal / $targetSub) * 100, 2));
                }
            }

            $capaianAvg = count($capaianPctList) > 0 ? round(array_sum($capaianPctList) / count($capaianPctList), 2) : 0;
            if ($capaianAvg > 0) {
                $totalCapaianSum += $capaianAvg;
                $totalCapaianCount++;
            }

            $hasSubmitted = true; // SIMAK IKU 1 terintegrasi otomatis dan sah
            $status = 'SUBMITTED';
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

        // Capaian Semua Unit (Evaluated per year & triwulan filter, only active units)
        // Rumus persentase bar: jumlah data status diajukan / indikator yg ditugaskan ke fakultas unit
        $unitTwParam = strtoupper($request->query('unit_tw', 'TW3'));
        if (!in_array($unitTwParam, ['TW1', 'TW2', 'TW3', 'TW4'])) {
            $unitTwParam = 'TW3';
        }
        $unitsList = DB::table('v_fakultas_unit')
            ->where(function($w) {
                $w->whereNull('is_active')->orWhere('is_active', 1);
            });
        if (!in_array($user->role ?? '', ['ADMIN', 'LPM'])) {
            $unitsList->whereIn('id', $scope);
        }
        $unitsList = $unitsList->get();

        $unitIds = $unitsList->pluck('id')->all();

        // 1. Ambil data penugasan indikator (penugasan_target) sebagai penyebut
        $penugasanByUnit = !empty($unitIds)
            ? DB::table('penugasan_target')
                ->whereIn('fakultas_unit', $unitIds)
                ->whereNull('deleted_at')
                ->when($tahun !== 'ALL', fn($q) => $q->where('tahun', $tahun))
                ->get()
                ->groupBy('fakultas_unit')
            : collect();

        // 2. Ambil data realisasi capaian (template_capaian) sebagai pembilang
        $capaianByUnit = !empty($unitIds)
            ? DB::table('template_capaian')
                ->whereIn('fakultas_unit', $unitIds)
                ->when($tahun !== 'ALL', fn($q) => $q->where('tahun', $tahun))
                ->when($unitTwParam !== 'ALL', fn($q) => $q->where('triwulan', $unitTwParam))
                ->get()
                ->groupBy('fakultas_unit')
            : collect();

        $capaianPerUnit = [];
        foreach ($unitsList as $u) {
            $unitAssignments = $penugasanByUnit->get($u->id, collect());
            $unitRows = $capaianByUnit->get($u->id, collect());

            $assignedIkuIds = $unitAssignments->pluck('id_indikator')->unique()->values()->toArray();

            // Identifikasi indikator IKU 1 jenjang jika unit bertipe prodi
            $prodiIku1Id = null;
            if (strtolower($u->type ?? '') === 'prodi') {
                $j = $this->getUnitJenjang($u);
                if (isset($jenjangIkuMap[$j])) {
                    $prodiIku1Id = $jenjangIkuMap[$j]['id'];
                    if (!in_array($prodiIku1Id, $assignedIkuIds)) {
                        $assignedIkuIds[] = $prodiIku1Id;
                    }
                }
            }

            $totalAssigned = count($assignedIkuIds);

            // Status yang tergolong telah diajukan oleh unit kerja dari template_capaian (kecualikan 1-9 agar tidak ganda)
            $submittedRows = $unitRows->filter(function($r) {
                $status = strtoupper(trim($r->status_validasi ?? ''));
                return in_array($status, ['DIAJUKAN', 'DIVERIFIKASI', 'DISAHKAN']);
            });

            $submittedIds = $submittedRows->whereIn('id_indikator', $assignedIkuIds)->pluck('id_indikator')->unique()->toArray();
            if ($prodiIku1Id && !in_array($prodiIku1Id, $submittedIds)) {
                $submittedIds[] = $prodiIku1Id; // SIMAK terintegrasi otomatis dan sah
            }

            if ($unitTwParam !== 'ALL') {
                $denominator = $totalAssigned;
                $diajukanCount = $denominator > 0 ? count($submittedIds) : 0;
            } else {
                if ($tahun !== 'ALL') {
                    $denominator = $totalAssigned * 4;
                } else {
                    $assignedRecords = $unitAssignments->map(fn($a) => ($a->tahun ?? '') . '_' . $a->id_indikator)->unique()->count();
                    if ($prodiIku1Id) $assignedRecords += 1;
                    $denominator = $assignedRecords * 4;
                }

                $diajukanCount = $denominator > 0
                    ? $submittedRows->whereIn('id_indikator', $assignedIkuIds)
                        ->whereNotIn('id_indikator', range(1, 9))
                        ->map(fn($r) => ($r->tahun ?? '') . '_' . ($r->triwulan ?? '') . '_' . $r->id_indikator)
                        ->unique()
                        ->count() + ($prodiIku1Id ? 4 : 0)
                    : 0;
            }

            // 1. Persentase data yang statusnya diajukan: (jumlah data diajukan / indikator ditugaskan) * 100%
            $persentaseDiajukan = $denominator > 0 ? min(100, round(($diajukanCount / $denominator) * 100, 1)) : 0;

            // 2. Ketercapaian antara realisasi terhadap target:
            // Dihitung terhadap seluruh indikator yang ditugaskan (indikator yang belum ada data dihitung 0%)
            $submittedUnique = ($unitTwParam !== 'ALL')
                ? $submittedRows->whereIn('id_indikator', $assignedIkuIds)->whereNotIn('id_indikator', range(1, 9))->keyBy('id_indikator')
                : $submittedRows->whereIn('id_indikator', $assignedIkuIds)->whereNotIn('id_indikator', range(1, 9))->keyBy(fn($r) => ($r->tahun ?? '') . '_' . ($r->triwulan ?? '') . '_' . $r->id_indikator);

            $unitRealPcts = [];
            foreach ($submittedUnique as $r) {
                $realVal = (float)$r->nilai_capaian;
                // Hilangkan dari perhitungan jika realisasi bernilai 0
                if ($realVal <= 0) {
                    continue;
                }
                $ikuDef = $allIkuList->firstWhere('id', $r->id_indikator);
                if ($ikuDef) {
                    $uObj = $unitsMap->get($u->id);
                    $targetYear = $r->tahun ?? ($tahun !== 'ALL' ? $tahun : date('Y'));
                    $tObj = isset($targetYearMap[$r->id_indikator]) ? $targetYearMap[$r->id_indikator]->firstWhere('tahun', $targetYear) : null;
                    $targetVal = $this->getUnitTarget($ikuDef, $uObj, $tObj);
                    if ($targetVal > 0) {
                        $pct = min(100, round(($realVal / $targetVal) * 100, 1));
                        $unitRealPcts[] = $pct;
                    }
                }
            }

            // Tambahkan realisasi IKU 1 jenjang resmi dari SIMAK untuk prodi jika > 0
            if ($prodiIku1Id && !(str_contains(strtoupper($u->nama_fak_prod_unit), 'BPSI') || $u->id == 41)) {
                if ($unitTwParam !== 'ALL') {
                    $simakTwData = $simakByTw[$unitTwParam] ?? ($simakByTw['TW3'] ?? reset($simakByTw));
                    $realisasiVal = (float)($simakTwData['by_id'][$prodiIku1Id]['tingkat_pencapaian'] ?? 0);
                    if ($realisasiVal > 0) {
                        $ikuDef = $allIkuList->firstWhere('id', $prodiIku1Id);
                        $tObj = isset($targetYearMap[$prodiIku1Id]) ? $targetYearMap[$prodiIku1Id]->firstWhere('tahun', $calcTahun) : null;
                        $targetVal = $this->getUnitTarget($ikuDef, $u, $tObj);
                        if ($targetVal > 0) {
                            $pct = min(100, round(($realisasiVal / $targetVal) * 100, 1));
                            $unitRealPcts[] = $pct;
                        }
                    }
                } else {
                    foreach ($this->TRIWULAN as $twKey) {
                        $simakTwData = $simakByTw[$twKey] ?? reset($simakByTw);
                        $realisasiVal = (float)($simakTwData['by_id'][$prodiIku1Id]['tingkat_pencapaian'] ?? 0);
                        if ($realisasiVal > 0) {
                            $ikuDef = $allIkuList->firstWhere('id', $prodiIku1Id);
                            $tObj = isset($targetYearMap[$prodiIku1Id]) ? $targetYearMap[$prodiIku1Id]->firstWhere('tahun', $calcTahun) : null;
                            $targetVal = $this->getUnitTarget($ikuDef, $u, $tObj);
                            if ($targetVal > 0) {
                                $pct = min(100, round(($realisasiVal / $targetVal) * 100, 1));
                                $unitRealPcts[] = $pct;
                            }
                        }
                    }
                }
            }

            // BPSI adalah unit (bukan prodi), sehingga realisasinya adalah 0 sesuai aturan sistem
            if (str_contains(strtoupper($u->nama_fak_prod_unit), 'BPSI') || $u->id == 41) {
                $persentaseRealisasi = 0;
            } else {
                $countValid = count($unitRealPcts);
                $persentaseRealisasi = $countValid > 0 ? min(100, round(array_sum($unitRealPcts) / $countValid, 1)) : 0;
            }

            $stat = $simakStats->get($u->id);

            $capaianPerUnit[] = [
                'id' => $u->id,
                'nama_unit' => $u->nama_fak_prod_unit,
                'type' => strtoupper($u->type),
                'capaian_diajukan' => $persentaseDiajukan,
                'capaian_realisasi' => $persentaseRealisasi,
                'capaian' => $persentaseRealisasi, // default capaian value
                'total_laporan' => $diajukanCount,
                'total_assigned' => $denominator,
                'total_lulusan' => $stat ? (int)$stat->total_lulusan : 0,
                'avg_lama_kuliah' => $stat ? (float)$stat->avg_lama_kuliah : null,
                'is_active' => (bool)($u->is_active ?? true),
            ];
        }

        $isAssigned = true;
        if ($selectedUnitId) {
            $isAssigned = !empty($assignedIkuIds);
        } elseif ($user && !in_array($user->role, ['ADMIN', 'LPM'])) {
            $isAssigned = DB::table('penugasan_target')
                ->where('fakultas_unit', $user->fakultas_unit)
                ->whereNull('deleted_at');
            if ($tahun !== 'ALL') {
                $isAssigned->where('tahun', $tahun);
            }
            $isAssigned = $isAssigned->exists();
        }

        return [
            'tahun' => $tahunParam,
            'overall_capaian' => $overallCapaian,
            'triwulan_summary' => $twSummary,
            'sebaran_per_iku' => $sebaranPerIku,
            'capaian_per_unit' => $capaianPerUnit,
            'total_unit_terpantau' => count($scope),
            'total_iku_dipantau' => $selectedUnitId ? ($assignedIkuIds !== null ? count($assignedIkuIds) : 0) : $allIkuList->count(),
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

        $triwulanFilter = $request->query('triwulan');
        $isSingleTw = !empty($triwulanFilter) && $triwulanFilter !== 'ALL';

        if ($isSingleTw) {
            $twSubquery = "(SELECT '" . addslashes($triwulanFilter) . "' AS triwulan) AS tw";
        } else {
            $twSubquery = "(SELECT 'TW1' AS triwulan UNION ALL SELECT 'TW2' UNION ALL SELECT 'TW3' UNION ALL SELECT 'TW4') AS tw";
        }

        $query = DB::table('penugasan_target as pt')
            ->crossJoin(DB::raw($twSubquery))
            ->join('v_fakultas_unit as vfu', 'pt.fakultas_unit', '=', 'vfu.id')
            ->join('master_indikator as mi', 'pt.id_indikator', '=', 'mi.id')
            ->leftJoin('gdrive_folder_logs as gfl', function($join) {
                $join->on('pt.fakultas_unit', '=', 'gfl.fakultas_unit')
                     ->on('pt.tahun', '=', 'gfl.tahun')
                     ->on('pt.id_indikator', '=', 'gfl.id_indikator');
            })
            ->leftJoin('target_indikator_tahun as tit', function($join) {
                $join->on('pt.id_indikator', '=', 'tit.id_indikator')
                     ->on('pt.tahun', '=', 'tit.tahun');
            })
            ->leftJoin('template_capaian as tc', function($join) {
                $join->on('pt.fakultas_unit', '=', 'tc.fakultas_unit')
                     ->on('pt.id_indikator', '=', 'tc.id_indikator')
                     ->on('pt.tahun', '=', 'tc.tahun')
                     ->on('tw.triwulan', '=', 'tc.triwulan');
            })
            ->whereNull('pt.deleted_at')
            ->where(function($w) {
                $w->whereNull('vfu.is_active')->orWhere('vfu.is_active', 1);
            })
            ->select(
                DB::raw("COALESCE(CAST(tc.id AS CHAR), CONCAT('pt_', pt.id, '_', tw.triwulan)) as id_capaian"),
                'tc.id as real_capaian_id',
                'pt.id as id_penugasan',
                'pt.fakultas_unit',
                'pt.id_indikator',
                'pt.tahun',
                'tw.triwulan',
                DB::raw('COALESCE(tc.nilai_capaian, 0) as nilai_capaian'),
                'tc.file_url',
                DB::raw("COALESCE(tc.status_validasi, 'BELUM DIISI') as status_validasi"),
                'tc.diinput_oleh',
                'tc.alasan_penolakan',
                'tc.created_at',
                'vfu.nama_fak_prod_unit as nama_unit',
                'vfu.type as type_unit',
                'vfu.jenjang',
                'vfu.fakultas',
                'mi.iku as kode_iku',
                'mi.kategori as nama_iku',
                'mi.full_kategori',
                'mi.satuan',
                'mi.jenis_iku',
                DB::raw('COALESCE(tit.base_line, mi.base_line) as base_line'),
                DB::raw('COALESCE(tit.target, mi.target) as target')
            );

        if ($request->filled('tahun') && $request->query('tahun') !== 'ALL') {
            $query->where('pt.tahun', $request->query('tahun'));
        }
        if ($request->filled('unit')) {
            $query->where('pt.fakultas_unit', $request->query('unit'));
        }
        if ($request->filled('indikator')) {
            $query->where('pt.id_indikator', $request->query('indikator'));
        }
        if ($request->filled('status') && $request->query('status') !== 'ALL') {
            $statusVal = $request->query('status');
            if ($statusVal === 'BELUM DIISI') {
                $query->whereNull('tc.id');
            } else {
                $query->where('tc.status_validasi', $statusVal);
            }
        }

        $data = $query->orderBy('pt.tahun', 'desc')
            ->orderBy('tw.triwulan', 'asc')
            ->orderBy('vfu.nama_fak_prod_unit', 'asc')
            ->orderByRaw('COALESCE(gfl.id, pt.id) asc')
            ->get();

        return response()->json($data);
    }

    private function extractGdriveId($url)
    {
        $service = new \App\Services\ExportTwZipService();
        return $service->extractGdriveId($url);
    }

    private function extractGdriveFileId($url)
    {
        return $this->extractGdriveId($url);
    }

    public function startExportTwZip(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak. Fitur export ZIP hanya untuk Admin.'], 403);
        }

        $tw = strtoupper($request->input('tw', 'TW1'));
        if (!in_array($tw, ['TW1', 'TW2', 'TW3', 'TW4'])) {
            $tw = 'TW1';
        }
        $tahun = $request->input('tahun', date('Y'));
        if ($tahun === 'ALL') {
            $tahun = date('Y');
        }
        $force = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);

        $clientId = config('services.google.client_id');
        $redirectUri = config('services.google.redirect_uri', 'http://localhost:8000/gdrive-callback');

        $driveService = new \App\Services\GoogleDriveService();
        $accessToken = $driveService->getAccessToken();

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
            return response()->json([
                'need_auth' => true,
                'auth_url' => $authUrl
            ]);
        }

        $exportService = new \App\Services\ExportTwZipService();

        if (!$force) {
            $recent = $exportService->findRecentJob($tw, $tahun);
            if ($recent) {
                return response()->json([
                    'job_id' => $recent['job_id'],
                    'status' => $recent['status'],
                    'progress' => $recent['progress'] ?? 0,
                    'message' => $recent['message'] ?? '',
                    'total_chunks' => $recent['total_chunks'] ?? 0,
                    'file_size' => $recent['file_size'] ?? 0,
                    'zip_filename' => $recent['zip_filename'] ?? "IKU_System_{$tw}_{$tahun}.zip",
                    'reused' => true
                ]);
            }
        }

        $jobId = $exportService->createJob($tw, $tahun);
        $exportService->dispatchJob($jobId);

        return response()->json([
            'job_id' => $jobId,
            'status' => 'processing',
            'progress' => 5,
            'message' => 'Memulai proses ekspor berkas...'
        ]);
    }

    public function statusExportTwZip(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $jobId = $request->query('job_id');
        if (!$jobId || !preg_match('/^[a-zA-Z0-9_-]+$/', $jobId)) {
            return response()->json(['error' => 'Job ID tidak valid.'], 400);
        }

        $exportService = new \App\Services\ExportTwZipService();
        $status = $exportService->getStatus($jobId);

        if (!$status) {
            return response()->json(['error' => 'Proses ekspor tidak ditemukan.'], 404);
        }

        return response()->json($status);
    }

    public function downloadExportTwZipChunk(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $jobId = $request->query('job_id');
        if (!$jobId || !preg_match('/^[a-zA-Z0-9_-]+$/', $jobId)) {
            return response()->json(['error' => 'Job ID tidak valid.'], 400);
        }

        $exportService = new \App\Services\ExportTwZipService();
        $status = $exportService->getStatus($jobId);

        if (!$status || ($status['status'] ?? '') !== 'completed') {
            return response()->json(['error' => 'Berkas ekspor belum selesai diproses atau tidak ditemukan.'], 404);
        }

        $zipPath = storage_path("app/exports/{$jobId}.zip");
        if (!file_exists($zipPath)) {
            return response()->json(['error' => 'Berkas ZIP tidak ditemukan pada server.'], 404);
        }

        $zipFilename = $status['zip_filename'] ?? "IKU_System_{$status['tw']}_{$status['tahun']}.zip";

        if ($request->query('download') === '1') {
            return response()->download($zipPath, $zipFilename);
        }

        $fileSize = filesize($zipPath);
        $chunkSize = (int)($status['chunk_size'] ?? (5 * 1024 * 1024));
        $totalChunks = (int)ceil(max(1, $fileSize) / $chunkSize);
        $chunkIndex = (int)$request->query('chunk', 0);

        $offset = $chunkIndex * $chunkSize;
        if ($offset >= $fileSize) {
            return response('', 416, [
                'Content-Range' => "bytes */{$fileSize}",
                'X-Total-Chunks' => $totalChunks,
            ]);
        }

        $length = min($chunkSize, $fileSize - $offset);

        $fp = fopen($zipPath, 'rb');
        fseek($fp, $offset);
        $chunkData = fread($fp, $length);
        fclose($fp);

        return response($chunkData, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => $length,
            'Content-Disposition' => 'attachment; filename="' . $zipFilename . '"',
            'X-Chunk-Index' => $chunkIndex,
            'X-Total-Chunks' => $totalChunks,
            'X-Chunk-Size' => $length,
            'X-File-Size' => $fileSize,
        ]);
    }

    public function exportTwZip(Request $request)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak. Fitur export ZIP hanya untuk Admin.'], 403);
        }

        $tw = strtoupper($request->query('tw', 'TW1'));
        if (!in_array($tw, ['TW1', 'TW2', 'TW3', 'TW4'])) {
            $tw = 'TW1';
        }
        $tahun = $request->query('tahun', date('Y'));
        if ($tahun === 'ALL') {
            $tahun = date('Y');
        }

        $exportService = new \App\Services\ExportTwZipService();

        $recent = $exportService->findRecentJob($tw, $tahun);
        if ($recent && ($recent['status'] ?? '') === 'completed') {
            $zipPath = storage_path("app/exports/{$recent['job_id']}.zip");
            if (file_exists($zipPath)) {
                return response()->download($zipPath, $recent['zip_filename'] ?? "IKU_System_{$tw}_{$tahun}.zip");
            }
        }

        $jobId = $exportService->createJob($tw, $tahun);
        $success = $exportService->runExport($jobId);

        if (!$success) {
            $status = $exportService->getStatus($jobId);
            return response()->json(['error' => $status['error'] ?? 'Gagal memproses ekspor ZIP.'], 500);
        }

        $zipPath = storage_path("app/exports/{$jobId}.zip");
        $zipFilename = "IKU_System_{$tw}_{$tahun}.zip";

        return response()->download($zipPath, $zipFilename)->deleteFileAfterSend(false);
    }

    public function exportCapaianUnit(Request $request)
    {
        $tw = $request->input('tw', 'TW1');
        $tahun = $request->input('tahun', date('Y'));
        $type = $request->input('type', 'ALL');
        $rowsData = $request->input('rows', []);

        $headers = [
            'No',
            'Nama Unit Kerja',
            'Tipe Unit',
            'Triwulan',
            'Data Diajukan',
            'Total Indikator Ditugaskan',
            'Persentase Diajukan (%)',
            'Ketercapaian Realisasi thd Target (%)',
            'Kategori Status'
        ];

        $rows = [];
        $no = 1;
        foreach ($rowsData as $r) {
            $rows[] = [
                $no++,
                $r['nama_unit'] ?? '-',
                $r['type'] ?? '-',
                $r['triwulan'] ?? $tw,
                $r['data_diajukan'] ?? 0,
                $r['total_penugasan'] ?? 0,
                $r['persentase_diajukan'] ?? '0%',
                $r['persentase_realisasi'] ?? '0%',
                $r['status_ketercapaian'] ?? '-'
            ];
        }

        $typeSuffix = ($type && $type !== 'ALL') ? "_{$type}" : '';
        $filename = "Capaian_Unit_Kerja_{$tw}_{$tahun}{$typeSuffix}.xlsx";
        $tempPath = storage_path("app/exports/temp_" . uniqid() . ".xlsx");

        \App\Services\SimpleXlsxWriter::create($tempPath, $headers, $rows, "Capaian Unit Kerja");

        return response()->download($tempPath, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    /**
     * Menghitung capaian SIMAK IKU 1 (IKU 1 dan IKU 1 - a s/d IKU 1 - h)
     * Mengikuti logika SyncSimakIku1Command (tanpa upload GDrive)
     * Menjumlahkan masing-masing kolom: total mahasiswa, total lulus tepat waktu, total lulus tidak tepat waktu
     * Menghitung sesuai rumus:
     * 1) AEE Realisasi = (Total Lulus Tepat / Total Mhs) x 100%
     * 2) Tingkat Pencapaian AEE = (AEE Realisasi / AEE Ideal) x 100%
     * 3) AEE PT (IKU 1) = Rata-rata Tingkat Pencapaian across all active jenjangs
     */
    public function calculateSimakIku1All($tahun = null, $tw = 'TW1')
    {
        // Sanitasi parameter tahun & triwulan
        if (empty($tahun) || $tahun === 'ALL' || !is_numeric($tahun)) {
            $tahun = (int)date('Y');
        } else {
            $tahun = (int)$tahun;
        }

        if (empty($tw) || $tw === 'ALL') {
            $tw = 'TW1';
        }

        // Semester Ajar Kampus sesuai SyncSimakIku1Command:
        // TW1 & TW2 = Genap tahun sebelumnya ((tahun - 1) . '2'), TW3 & TW4 = Ganjil tahun berjalan (tahun . '1')
        $targetTahunId = in_array($tw, ['TW1', 'TW2']) ? (($tahun - 1) . '2') : ($tahun . '1');

        $triwulanDates = [
            'TW1' => ['start' => "{$tahun}-01-01", 'end' => "{$tahun}-04-01"],
            'TW2' => ['start' => "{$tahun}-04-01", 'end' => "{$tahun}-07-01"],
            'TW3' => ['start' => "{$tahun}-07-01", 'end' => "{$tahun}-10-01"],
            'TW4' => ['start' => "{$tahun}-10-01", 'end' => ($tahun + 1) . "-01-01"],
            'ALL' => ['start' => "{$tahun}-01-01", 'end' => ($tahun + 1) . "-01-01"],
        ];
        $twRange = $triwulanDates[$tw] ?? $triwulanDates['TW1'];

        $jenjangConfig = [
            'd1' => [
                'kode_iku' => 'IKU 1 - a',
                'id_indikator' => 2,
                'jenjang' => 'D1',
                'ideal' => 100.0,
                'years' => 1,
            ],
            'd2' => [
                'kode_iku' => 'IKU 1 - b',
                'id_indikator' => 3,
                'jenjang' => 'D2',
                'ideal' => 50.0,
                'years' => 2,
            ],
            'd3' => [
                'kode_iku' => 'IKU 1 - c',
                'id_indikator' => 4,
                'jenjang' => 'D3',
                'ideal' => 33.0,
                'years' => 3,
            ],
            'd4' => [
                'kode_iku' => 'IKU 1 - d',
                'id_indikator' => 5,
                'jenjang' => 'D4',
                'ideal' => 25.0,
                'years' => 4,
            ],
            's1' => [
                'kode_iku' => 'IKU 1 - e',
                'id_indikator' => 6,
                'jenjang' => 'S1',
                'ideal' => 25.0,
                'years' => 4,
            ],
            's2' => [
                'kode_iku' => 'IKU 1 - f',
                'id_indikator' => 7,
                'jenjang' => 'S2',
                'ideal' => 50.0,
                'years' => 2,
            ],
            's3' => [
                'kode_iku' => 'IKU 1 - g',
                'id_indikator' => 8,
                'jenjang' => 'S3',
                'ideal' => 33.0,
                'years' => 3,
            ],
            'profesi' => [
                'kode_iku' => 'IKU 1 - h',
                'id_indikator' => 9,
                'jenjang' => 'Profesi',
                'ideal' => 100.0,
                'years' => 1,
            ],
        ];

        try {
            // 1. Total Mahasiswa Terdaftar per prodi dari SIMAK (m_mahasiswa)
            $simakMhs = DB::connection('simak')->table('m_mahasiswa')
                ->selectRaw("
                    COALESCE(kode_prodi, '') as kode_prodi,
                    COUNT(*) as total_mhs
                ")
                ->groupBy('kode_prodi')
                ->get()
                ->keyBy('kode_prodi');

            // 2. Query lulusan dari m_mahasiswa berdasarkan rentang tanggal lulus per triwulan
            $simakGrads = DB::connection('simak')->table('m_mahasiswa')
                ->selectRaw("
                    COALESCE(kode_prodi, '') as kode_prodi,
                    tanggal_masuk,
                    tanggal_lulus,
                    TIMESTAMPDIFF(MONTH, tanggal_masuk, tanggal_lulus) as lama_studi_bulan
                ")
                ->where('tanggal_lulus', '>=', $twRange['start'])
                ->where('tanggal_lulus', '<', $twRange['end'])
                ->whereNotNull('tanggal_lulus')
                ->whereNotNull('tanggal_masuk')
                ->where('tanggal_lulus', '!=', '0000-00-00')
                ->where('tanggal_masuk', '!=', '0000-00-00')
                ->get()
                ->groupBy('kode_prodi');
        } catch (\Throwable $eSimak) {
            \Log::warning("SIMAK Query warning in calculateSimakIku1All: " . $eSimak->getMessage());
            $simakMhs = collect();
            $simakGrads = collect();
        }

        $allProdis = DB::table('v_fakultas_unit')
            ->whereNotNull('kode_prodi')
            ->where('kode_prodi', '!=', '')
            ->where('standalone', 0)
            ->select('nama_fak_prod_unit', 'kode_fakultas', 'kode_prodi', 'jenjang', 'type')
            ->orderBy('jenjang')
            ->orderBy('nama_fak_prod_unit')
            ->get()
            ->filter(function($p) {
                return strtolower(trim($p->type ?? 'prodi')) === 'prodi';
            });

        $statsByJenjang = [];
        foreach ($jenjangConfig as $jKey => $cfg) {
            $statsByJenjang[$jKey] = [
                'config' => $cfg,
                'tot_mhs' => 0,
                'lulus_tepat' => 0,
                'lulus_tidak_tepat' => 0,
                'prodis' => [],
            ];
        }

        foreach ($allProdis as $p) {
            $j = strtolower(trim($p->jenjang ?? ''));
            if (preg_match('/\b(d1|d2|d3|d4|s1|s2|s3|profesi)\b/i', $p->nama_fak_prod_unit ?? '', $m)) {
                $j = strtolower($m[1]);
            }
            if (empty($j) && $p->kode_prodi === '85202') {
                $j = 's1';
            }
            if (!isset($statsByJenjang[$j])) {
                continue;
            }

            $mRecord = $simakMhs->get($p->kode_prodi);
            $tot = $mRecord ? (int)$mRecord->total_mhs : 0;

            $pGrads = $simakGrads->get($p->kode_prodi, collect());
            $years = $jenjangConfig[$j]['years'];

            $tepat = 0;
            $tidak = 0;
            foreach ($pGrads as $g) {
                // Sesuai SQL: WHEN tanggal_lulus <= DATE_ADD(tanggal_masuk, INTERVAL X YEAR) THEN 'Tepat Waktu' ELSE 'Terlambat'
                $limitDate = date('Y-m-d', strtotime("+{$years} years", strtotime($g->tanggal_masuk)));
                if ($g->tanggal_lulus <= $limitDate) {
                    $tepat++;
                } else {
                    $tidak++;
                }
            }

            $statsByJenjang[$j]['tot_mhs'] += $tot;
            $statsByJenjang[$j]['lulus_tepat'] += $tepat;
            $statsByJenjang[$j]['lulus_tidak_tepat'] += $tidak;
            $statsByJenjang[$j]['prodis'][] = [
                'nama_prodi' => $p->nama_fak_prod_unit,
                'kode_fakultas' => $p->kode_fakultas,
                'kode_prodi' => $p->kode_prodi,
                'jenjang' => $jenjangConfig[$j]['jenjang'],
                'kode_iku' => $jenjangConfig[$j]['kode_iku'],
                'tot_mhs' => $tot,
                'lulus_tepat' => $tepat,
                'lulus_tidak_tepat' => $tidak,
            ];
        }

        $byKode = [];
        $byId = [];
        $activeCapaian = [];

        $subRealValues = [];
        foreach ($jenjangConfig as $jKey => $cfg) {
            $s = $statsByJenjang[$jKey];
            $den = (int)$s['tot_mhs'];
            $aeeReal = $den > 0 ? round(($s['lulus_tepat'] / $den) * 100, 2) : 0;
            $capaian = $cfg['ideal'] > 0 ? round(($aeeReal / $cfg['ideal']) * 100, 2) : 0;

            $subRealValues[$cfg['kode_iku']] = $capaian;

            $catatan = "Perhitungan SIMAK ({$tw} {$tahun}, Periode {$twRange['start']} s/d {$twRange['end']}, Semester {$targetTahunId}): Total Mhs {$s['tot_mhs']}, Lulus Tepat {$s['lulus_tepat']}, Tidak Tepat {$s['lulus_tidak_tepat']}. AEE Realisasi {$aeeReal}%, AEE Ideal {$cfg['ideal']}%, Tingkat Pencapaian AEE {$capaian}%";

            $itemData = [
                'id_indikator' => $cfg['id_indikator'],
                'kode_iku' => $cfg['kode_iku'],
                'jenjang' => $cfg['jenjang'],
                'target_tahun_id' => $targetTahunId,
                'tot_mhs' => $s['tot_mhs'],
                'lulus_tepat' => $s['lulus_tepat'],
                'lulus_tidak_tepat' => $s['lulus_tidak_tepat'],
                'penyebut' => $den,
                'aee_realisasi' => $aeeReal,
                'aee_ideal' => $cfg['ideal'],
                'tingkat_pencapaian' => $capaian,
                'catatan' => $catatan,
            ];

            $byKode[$cfg['kode_iku']] = $itemData;
            $byId[$cfg['id_indikator']] = $itemData;

        }

        // IKU 1 (AEE PT) = rata-rata realisasi IKU 1 - a sampai IKU 1 - h (sum / count)
        $aeePt = !empty($subRealValues) ? round(array_sum($subRealValues) / count($subRealValues), 2) : 0;
        $iku1Data = [
            'id_indikator' => 1,
            'kode_iku' => 'IKU 1',
            'jenjang' => 'PT',
            'target_tahun_id' => $targetTahunId,
            'tot_mhs' => array_sum(array_column($statsByJenjang, 'tot_mhs')),
            'lulus_tepat' => array_sum(array_column($statsByJenjang, 'lulus_tepat')),
            'lulus_tidak_tepat' => array_sum(array_column($statsByJenjang, 'lulus_tidak_tepat')),
            'penyebut' => 0,
            'aee_realisasi' => 0,
            'aee_ideal' => 0,
            'tingkat_pencapaian' => $aeePt,
            'catatan' => "Perhitungan SIMAK (Cut-off {$tw} {$tahun}, Semester {$targetTahunId}): AEE PT (Rata-rata Realisasi IKU 1 - a s/d IKU 1 - h): {$aeePt}%",
        ];
        $byKode['IKU 1'] = $iku1Data;
        $byId[1] = $iku1Data;

        return [
            'by_kode' => $byKode,
            'by_id' => $byId,
            'stats_by_jenjang' => $statsByJenjang,
            'aee_pt' => $aeePt,
        ];
    }

    public function exportVerifikasiXlsx(Request $request)
    {
        try {
            $tw = $request->input('triwulan', 'TW1');
            $rawTahun = $request->input('tahun');
            $itemsData = $request->input('items', []);

            if (empty($itemsData)) {
                $request->query->add($request->all());
                $antreanResponse = $this->antreanVerifikasi($request);
                $itemsData = json_decode($antreanResponse->getContent(), true) ?: [];
            }

            if (empty($itemsData)) {
                return response()->json(['message' => 'Tidak ada data verifikasi untuk diexport.'], 400);
            }

            // Sanitasi tahun: jika bernilai ALL atau kosong/non-numerik, ambil dari salah satu item antrean atau tahun berjalan
            $tahun = null;
            if (!empty($rawTahun) && $rawTahun !== 'ALL' && is_numeric($rawTahun)) {
                $tahun = (int)$rawTahun;
            } else {
                foreach ($itemsData as $it) {
                    if (!empty($it['tahun']) && is_numeric($it['tahun'])) {
                        $tahun = (int)$it['tahun'];
                        break;
                    }
                }
                if (!$tahun) {
                    $tahun = (int)date('Y');
                }
            }

            // Kumpulkan triwulan unik yang dibutuhkan untuk sinkronisasi live SIMAK IKU 1
            $uniqueTws = [];
            foreach ($itemsData as $item) {
                $itemTw = $item['triwulan'] ?? $tw;
                if ($itemTw && $itemTw !== 'ALL') {
                    $uniqueTws[$itemTw] = true;
                }
            }
            if (empty($uniqueTws)) {
                $uniqueTws[$tw === 'ALL' ? 'TW1' : $tw] = true;
            }

            // Hitung data SIMAK IKU 1 untuk setiap triwulan
            $simakLookup = [];
            foreach (array_keys($uniqueTws) as $targetTw) {
                $simakLookup[$targetTw] = $this->calculateSimakIku1All($tahun, $targetTw);
            }

            $spreadsheet = new Spreadsheet();

            // ====================================================
            // LEMBAR 1: Detail Data Verifikasi Capaian per Unit
            // ====================================================
            $sheet1 = $spreadsheet->getActiveSheet();
            $sheet1->setTitle('Lembar 1');
            $sheet1->setShowGridLines(true);

            $headersSheet1 = [
                'Unit Pelapor',
                'Kode IKU',
                'Nama Indikator',
                'Triwulan',
                'Baseline',
                'Target',
                'Realisasi',
                'Satuan',
                'Status Validasi',
                'Diinput Oleh'
            ];

            // Header Styling Sheet 1
            $colIdx = 1;
            foreach ($headersSheet1 as $h) {
                $cellRef = Coordinate::stringFromColumnIndex($colIdx) . '1';
                $sheet1->setCellValue($cellRef, $h);
                $colIdx++;
            }
            $highestCol1 = $sheet1->getHighestColumn();
            $sheet1->getStyle("A1:{$highestCol1}1")->getFont()->setBold(true);
            $sheet1->getStyle("A1:{$highestCol1}1")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('EAEAEA');

            $rowIdx1 = 2;
            $sheet1Rows = [];
            foreach ($itemsData as $item) {
                $unit = $item['nama_unit'] ?? '-';
                $kode = trim($item['kode_iku'] ?? '-');
                $idInd = (int)($item['id_indikator'] ?? 0);
                $nama = $item['nama_iku'] ?? $item['full_kategori'] ?? '-';
                $triwulan = $item['triwulan'] ?? $tw;
                $base = $item['base_line'] ?? '-';
                $target = $item['target'] ?? '-';
                $realisasi = isset($item['nilai_capaian']) && is_numeric($item['nilai_capaian']) 
                    ? (float)$item['nilai_capaian'] 
                    : 0;
                $satuan = $item['satuan'] ?? '%';
                $status = $item['status_validasi'] ?? 'BELUM DIISI';
                $diinputOleh = $item['diinput_oleh'] ?? '-';

                // BPSI adalah unit (bukan prodi), sehingga realisasinya pada Lembar 1 adalah 0
                if (strtoupper($unit) === 'BPSI' || str_contains(strtoupper($unit), 'BPSI')) {
                    $realisasi = 0;
                    if ($status === 'DIAJUKAN' && $diinputOleh === 'system_simak') {
                        $status = 'BELUM DIISI';
                        $diinputOleh = '-';
                    }
                }

                $rowData = [
                    $unit,
                    $kode,
                    $nama,
                    $triwulan,
                    is_numeric($base) ? (float)$base : (string)$base,
                    is_numeric($target) ? (float)$target : (string)$target,
                    $realisasi,
                    $satuan,
                    $status,
                    $diinputOleh
                ];

                $sheet1Rows[] = [
                    'unit' => $unit,
                    'id_indikator' => $idInd,
                    'kode_iku' => $kode,
                    'nama_indikator' => $nama,
                    'triwulan' => $triwulan,
                    'base_line' => $base,
                    'target' => $target,
                    'realisasi' => $realisasi,
                    'status_validasi' => $status
                ];

                $c = 1;
                foreach ($rowData as $val) {
                    $cellRef = Coordinate::stringFromColumnIndex($c) . $rowIdx1;
                    if (is_numeric($val) && !preg_match('/^0\d+/', (string)$val)) {
                        $sheet1->setCellValue($cellRef, (float)$val);
                    } else {
                        $sheet1->setCellValue($cellRef, (string)($val ?? ''));
                    }
                    $c++;
                }
                $rowIdx1++;
            }

            // Auto-fit column widths Sheet 1
            for ($col = 1; $col <= count($headersSheet1); $col++) {
                $colLetter = Coordinate::stringFromColumnIndex($col);
                $sheet1->getColumnDimension($colLetter)->setAutoSize(true);
            }

            // ====================================================
            // LEMBAR 2: Rekap Rata-Rata Realisasi Capaian Indikator
            // Kolom: Kode IKU, Nama Indikator, Triwulan, Baseline, Target, Realisasi
            // Aturan:
            // 1) Untuk IKU 1 dan sub-indikatornya (IKU 1 - a s/d IKU 1 - h), Realisasi diambil dari hasil perhitungan SIMAK
            // 2) Untuk IKU lainnya, Realisasi merupakan rata-rata realisasi pada Sheet 1
            // ====================================================
            $sheet2 = $spreadsheet->createSheet();
            $sheet2->setTitle('Lembar 2');
            $sheet2->setShowGridLines(true);

            $headersSheet2 = [
                'Kode IKU',
                'Nama Indikator',
                'Triwulan',
                'Baseline',
                'Target',
                'Realisasi'
            ];

            // Header Styling Sheet 2
            $colIdx = 1;
            foreach ($headersSheet2 as $h) {
                $cellRef = Coordinate::stringFromColumnIndex($colIdx) . '1';
                $sheet2->setCellValue($cellRef, $h);
                $colIdx++;
            }
            $highestCol2 = $sheet2->getHighestColumn();
            $sheet2->getStyle("A1:{$highestCol2}1")->getFont()->setBold(true);
            $sheet2->getStyle("A1:{$highestCol2}1")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('EAEAEA');

            // Grouping data Sheet 1 berdasarkan indikator & triwulan
            $grouped = [];
            foreach ($sheet1Rows as $r) {
                $groupKey = ($r['id_indikator'] ?: $r['kode_iku']) . '___' . $r['triwulan'];
                if (!isset($grouped[$groupKey])) {
                    $grouped[$groupKey] = [
                        'id_indikator' => $r['id_indikator'],
                        'kode_iku' => $r['kode_iku'],
                        'nama_indikator' => $r['nama_indikator'],
                        'triwulan' => $r['triwulan'],
                        'base_line' => $r['base_line'],
                        'target' => $r['target'],
                        'realisasi_values' => []
                    ];
                }
                $grouped[$groupKey]['realisasi_values'][] = (float)$r['realisasi'];
            }

            // Urutkan Sheet 2 berdasarkan triwulan lalu ID indikator agar IKU 1 dan sub-indikatornya selalu berurutan
            uasort($grouped, function($a, $b) {
                if ($a['triwulan'] !== $b['triwulan']) {
                    return strcmp($a['triwulan'], $b['triwulan']);
                }
                return $a['id_indikator'] <=> $b['id_indikator'];
            });

            $rowIdx2 = 2;
            $iku1ParentRows = []; // [triwulan => rowNumber]
            $iku1SubRows = [];    // [triwulan => [rowNumbers]]

            foreach ($grouped as $g) {
                $count = count($g['realisasi_values']);
                $avgRealisasi = $count > 0 ? round(array_sum($g['realisasi_values']) / $count, 2) : 0;

                $kodeIku = trim($g['kode_iku']);
                $itemTw = $g['triwulan'] ?? $tw;
                $simakData = $simakLookup[$itemTw] ?? reset($simakLookup);

                // Override nilai Realisasi pada Sheet 2 khusus IKU 1 & IKU 1 - a s/d IKU 1 - h dari perhitungan SIMAK
                if ($simakData) {
                    if (isset($simakData['by_kode'][$kodeIku])) {
                        $avgRealisasi = (float)$simakData['by_kode'][$kodeIku]['tingkat_pencapaian'];
                    } elseif (isset($simakData['by_id'][(int)$g['id_indikator']])) {
                        $avgRealisasi = (float)$simakData['by_id'][(int)$g['id_indikator']]['tingkat_pencapaian'];
                    }
                }

                if ($kodeIku === 'IKU 1' || (int)$g['id_indikator'] === 1) {
                    $iku1ParentRows[$itemTw] = $rowIdx2;
                } elseif (str_starts_with($kodeIku, 'IKU 1 -') || ((int)$g['id_indikator'] >= 2 && (int)$g['id_indikator'] <= 9)) {
                    $iku1SubRows[$itemTw][] = $rowIdx2;
                }

                $row2Data = [
                    $g['kode_iku'],
                    $g['nama_indikator'],
                    $g['triwulan'],
                    is_numeric($g['base_line']) ? (float)$g['base_line'] : (string)$g['base_line'],
                    is_numeric($g['target']) ? (float)$g['target'] : (string)$g['target'],
                    $avgRealisasi
                ];

                $c = 1;
                foreach ($row2Data as $val) {
                    $cellRef = Coordinate::stringFromColumnIndex($c) . $rowIdx2;
                    if (is_numeric($val) && !preg_match('/^0\d+/', (string)$val)) {
                        $sheet2->setCellValue($cellRef, (float)$val);
                    } else {
                        $sheet2->setCellValue($cellRef, (string)($val ?? ''));
                    }
                    $c++;
                }
                $rowIdx2++;
            }

            // Terapkan formula Excel =ROUND(AVERAGE(F{start}:F{end}), 2) untuk Realisasi IKU 1 pada Sheet 2
            foreach ($iku1ParentRows as $twKey => $pRow) {
                if (!empty($iku1SubRows[$twKey])) {
                    $startSub = min($iku1SubRows[$twKey]);
                    $endSub = max($iku1SubRows[$twKey]);
                    $sheet2->setCellValue("F{$pRow}", "=ROUND(AVERAGE(F{$startSub}:F{$endSub}), 2)");
                }
            }

            // Auto-fit column widths Sheet 2
            for ($col = 1; $col <= count($headersSheet2); $col++) {
                $colLetter = Coordinate::stringFromColumnIndex($col);
                $sheet2->getColumnDimension($colLetter)->setAutoSize(true);
            }

            // ====================================================
            // LEMBAR 3: Rincian Data SIMAK IKU 1 (Sesuai Gambar 2, 3, 4)
            // Menampilkan rincian prodi, sum kolom per jenjang, serta
            // rekapitulasi perhitungan rumus AEE Realisasi, AEE Ideal, dan Tingkat Pencapaian
            // ====================================================
            $sheet3 = $spreadsheet->createSheet();
            $sheet3->setTitle('Rincian SIMAK IKU 1');
            $sheet3->setShowGridLines(true);

            $mainSimak = $simakLookup[$tw] ?? reset($simakLookup);
            $statsByJenjang = $mainSimak['stats_by_jenjang'] ?? [];

            // Header Banner Lembar 3
            $mainTargetTahunId = in_array(($tw === 'ALL' ? 'TW1' : $tw), ['TW1', 'TW2']) ? (($tahun - 1) . '2') : ($tahun . '1');
            $sheet3->setCellValue('A1', "DATA RINCIAN IKU 1 DARI SIMAK (TAHUN {$tahun} - " . ($tw === 'ALL' ? 'TW1' : $tw) . " - SEMESTER {$mainTargetTahunId})");
            $sheet3->mergeCells('A1:G1');
            $sheet3->getStyle('A1')->getFont()->setBold(true)->setSize(14);

            $sheet3->setCellValue('A2', "Sumber: unpak_simak.m_mahasiswa | Rumus: AEE Realisasi = (Lulus Tepat / Total Mhs) x 100% | Tingkat Pencapaian = (AEE Real / AEE Ideal) x 100%");
            $sheet3->mergeCells('A2:G2');
            $sheet3->getStyle('A2')->getFont()->setItalic(true)->setSize(10);

            $headersTable1 = [
                'No',
                'Kode IKU',
                'Jenjang',
                'Program Studi',
                'Total Mahasiswa',
                'Total Lulus Tepat Waktu',
                'Total Lulus Tidak Tepat Waktu'
            ];

            $colIdx = 1;
            foreach ($headersTable1 as $h) {
                $cellRef = Coordinate::stringFromColumnIndex($colIdx) . '4';
                $sheet3->setCellValue($cellRef, $h);
                $colIdx++;
            }
            $sheet3->getStyle("A4:G4")->getFont()->setBold(true);
            $sheet3->getStyle("A4:G4")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('EAEAEA');

            $rowIdx3 = 5;
            $globalNo = 1;

            foreach ($statsByJenjang as $jKey => $s) {
                $cfg = $s['config'];
                $prodis = $s['prodis'];

                if (!empty($prodis)) {
                    foreach ($prodis as $p) {
                        $sheet3->setCellValue("A{$rowIdx3}", $globalNo++);
                        $sheet3->setCellValue("B{$rowIdx3}", $cfg['kode_iku']);
                        $sheet3->setCellValue("C{$rowIdx3}", $cfg['jenjang']);
                        $sheet3->setCellValue("D{$rowIdx3}", $p['nama_prodi']);
                        $sheet3->setCellValue("E{$rowIdx3}", (int)$p['tot_mhs']);
                        $sheet3->setCellValue("F{$rowIdx3}", (int)$p['lulus_tepat']);
                        $sheet3->setCellValue("G{$rowIdx3}", (int)$p['lulus_tidak_tepat']);
                        $rowIdx3++;
                    }
                }

                // Subtotal / SUM row per jenjang
                $sheet3->setCellValue("A{$rowIdx3}", '');
                $sheet3->setCellValue("B{$rowIdx3}", $cfg['kode_iku']);
                $sheet3->setCellValue("C{$rowIdx3}", $cfg['jenjang']);
                $sheet3->setCellValue("D{$rowIdx3}", "TOTAL / SUM " . strtoupper($cfg['jenjang']));
                $sheet3->setCellValue("E{$rowIdx3}", (int)$s['tot_mhs']);
                $sheet3->setCellValue("F{$rowIdx3}", (int)$s['lulus_tepat']);
                $sheet3->setCellValue("G{$rowIdx3}", (int)$s['lulus_tidak_tepat']);

                $sheet3->getStyle("A{$rowIdx3}:G{$rowIdx3}")->getFont()->setBold(true);
                $sheet3->getStyle("A{$rowIdx3}:G{$rowIdx3}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('D9E1F2');
                $rowIdx3++;
            }

            $rowIdx3 += 2; // Spasi sebelum tabel rekapitulasi

            // ====================================================
            // Tabel Rekapitulasi Rumus AEE per Jenjang (Gambar 2 & Gambar 3)
            // ====================================================
            $sheet3->setCellValue("A{$rowIdx3}", "REKAPITULASI CAPAIAN AEE PER JENJANG");
            $sheet3->mergeCells("A{$rowIdx3}:J{$rowIdx3}");
            $sheet3->getStyle("A{$rowIdx3}")->getFont()->setBold(true)->setSize(12);
            $rowIdx3++;

            $headersTable2 = [
                'Kode IKU',
                'Jenjang',
                'Total Mahasiswa',
                'Lulus Tepat Waktu',
                'Lulus Tidak Tepat',
                'AEE Realisasi (%)',
                'AEE Ideal (%)',
                'Tingkat Pencapaian AEE (%)',
                'Target (%)',
                'Status Capaian'
            ];

            $colIdx = 1;
            foreach ($headersTable2 as $h) {
                $cellRef = Coordinate::stringFromColumnIndex($colIdx) . $rowIdx3;
                $sheet3->setCellValue($cellRef, $h);
                $colIdx++;
            }
            $sheet3->getStyle("A{$rowIdx3}:J{$rowIdx3}")->getFont()->setBold(true);
            $sheet3->getStyle("A{$rowIdx3}:J{$rowIdx3}")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('EAEAEA');
            $rowIdx3++;

            foreach ($statsByJenjang as $jKey => $s) {
                $cfg = $s['config'];
                $kode = $cfg['kode_iku'];
                $simakItem = $mainSimak['by_kode'][$kode] ?? null;

                // Target indikator
                $tObj = DB::table('target_indikator_tahun')
                    ->where('id_indikator', $cfg['id_indikator'])
                    ->where('tahun', $tahun)
                    ->first();
                if (!$tObj) {
                    $tObj = DB::table('master_indikator')->where('id', $cfg['id_indikator'])->first();
                }
                $targetVal = $tObj->target ?? '-';
                if ($targetVal === null || $targetVal === '') $targetVal = '-';

                $capaianPct = $simakItem['tingkat_pencapaian'] ?? 0;
                $statusCapaian = 'BELUM TERCAPAI';
                if (is_numeric($targetVal)) {
                    $statusCapaian = ($capaianPct >= (float)$targetVal) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                } else {
                    $statusCapaian = ($capaianPct > 0) ? 'TERCAPAI' : 'BELUM TERCAPAI';
                }

                $sheet3->setCellValue("A{$rowIdx3}", $cfg['kode_iku']);
                $sheet3->setCellValue("B{$rowIdx3}", $cfg['jenjang']);
                $sheet3->setCellValue("C{$rowIdx3}", (int)$s['tot_mhs']);
                $sheet3->setCellValue("D{$rowIdx3}", (int)$s['lulus_tepat']);
                $sheet3->setCellValue("E{$rowIdx3}", (int)$s['lulus_tidak_tepat']);
                $sheet3->setCellValue("F{$rowIdx3}", (float)($simakItem['aee_realisasi'] ?? 0));
                $sheet3->setCellValue("G{$rowIdx3}", (float)$cfg['ideal']);
                $sheet3->setCellValue("H{$rowIdx3}", (float)$capaianPct);
                $sheet3->setCellValue("I{$rowIdx3}", is_numeric($targetVal) ? (float)$targetVal : (string)$targetVal);
                $sheet3->setCellValue("J{$rowIdx3}", $statusCapaian);
                $rowIdx3++;
            }

            // Baris AEE PT (IKU 1 Utama)
            $aeePt = $mainSimak['aee_pt'] ?? 0;
            $tIku1 = DB::table('target_indikator_tahun')->where('id_indikator', 1)->where('tahun', $tahun)->first();
            if (!$tIku1) $tIku1 = DB::table('master_indikator')->where('id', 1)->first();
            $targetIku1 = $tIku1->target ?? 86;
            $statusIku1 = (is_numeric($targetIku1) && $aeePt >= (float)$targetIku1) ? 'TERCAPAI' : 'BELUM TERCAPAI';

            $startTable2 = $rowIdx3 - count($statsByJenjang);
            $endTable2 = $rowIdx3 - 1;

            $sheet3->setCellValue("A{$rowIdx3}", "IKU 1");
            $sheet3->setCellValue("B{$rowIdx3}", "AEE PT (Rata-rata Realisasi IKU 1 - a s/d IKU 1 - h)");
            $sheet3->mergeCells("B{$rowIdx3}:G{$rowIdx3}");
            $sheet3->setCellValue("H{$rowIdx3}", "=ROUND(AVERAGE(H{$startTable2}:H{$endTable2}), 2)");
            $sheet3->setCellValue("I{$rowIdx3}", is_numeric($targetIku1) ? (float)$targetIku1 : (string)$targetIku1);
            $sheet3->setCellValue("J{$rowIdx3}", $statusIku1);

            $sheet3->getStyle("A{$rowIdx3}:J{$rowIdx3}")->getFont()->setBold(true);
            $sheet3->getStyle("A{$rowIdx3}:J{$rowIdx3}")->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('C6EFCE');
            $rowIdx3++;

            // Auto-fit column widths Sheet 3
            for ($col = 1; $col <= 10; $col++) {
                $colLetter = Coordinate::stringFromColumnIndex($col);
                $sheet3->getColumnDimension($colLetter)->setAutoSize(true);
            }

            // Kembalikan active sheet ke Lembar 1 saat file dibuka
            $spreadsheet->setActiveSheetIndex(0);

            $dir = storage_path('app/exports');
            if (!file_exists($dir)) {
                @mkdir($dir, 0777, true);
            }

            $filename = "Verifikasi_Capaian_{$tw}.xlsx";
            $tempPath = $dir . '/temp_' . uniqid() . '.xlsx';

            $writer = new Xlsx($spreadsheet);
            $writer->save($tempPath);

            return response()->download($tempPath, $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(true);
        } catch (\Throwable $e) {
            \Log::error("Export Verifikasi XLSX failed: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            return response()->json([
                'message' => 'Gagal memproses ekspor Excel: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }
}

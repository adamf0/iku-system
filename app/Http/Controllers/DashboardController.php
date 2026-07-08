<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    private $TRIWULAN = ['TW1', 'TW2', 'TW3', 'TW4'];

    private function getScopedCapaian(Request $request, $tahun)
    {
        $user = $request->user();
        $scope = $user->scopeUnits();

        return DB::table('template_capaian')
            ->whereIn('fakultas_unit', $scope)
            ->where('tahun', $tahun)
            ->get();
    }

    public function summary(Request $request)
    {
        $tahun = $request->query('tahun', date('Y'));
        $data = $this->getScopedCapaian($request, $tahun);
        $user = $request->user();
        $scope = $user->scopeUnits();

        $ikuList = DB::table('master_indikator')->whereNull('id_sub')->get();

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
        foreach ($ikuList as $iku) {
            $rows = $data->filter(function ($item) use ($iku) {
                return $item->id_indikator === $iku->id && $item->status_validasi === 'DISAHKAN';
            });

            $latestTw = null;
            foreach (array_reverse($this->TRIWULAN) as $tw) {
                if (!$latestTw && $rows->contains('triwulan', $tw)) {
                    $latestTw = $tw;
                }
            }

            $rowsLatest = $latestTw ? $rows->where('triwulan', $latestTw) : collect();
            
            $rataCapaian = null;
            if ($rowsLatest->count() > 0) {
                $rataCapaian = round($rowsLatest->avg('nilai_capaian'), 2);
            }

            $capaianTw1 = null;
            $rowsTw1 = $rows->where('triwulan', 'TW1');
            if ($rowsTw1->count() > 0) {
                $capaianTw1 = round($rowsTw1->avg('nilai_capaian'), 2);
            }

            $capaianTw2 = null;
            $rowsTw2 = $rows->where('triwulan', 'TW2');
            if ($rowsTw2->count() > 0) {
                $capaianTw2 = round($rowsTw2->avg('nilai_capaian'), 2);
            }

            $capaianTw3 = null;
            $rowsTw3 = $rows->where('triwulan', 'TW3');
            if ($rowsTw3->count() > 0) {
                $capaianTw3 = round($rowsTw3->avg('nilai_capaian'), 2);
            }

            $capaianTw4 = null;
            $rowsTw4 = $rows->where('triwulan', 'TW4');
            if ($rowsTw4->count() > 0) {
                $capaianTw4 = round($rowsTw4->avg('nilai_capaian'), 2);
            }

            $target = (float)$iku->target;
            
            $status = 'BELUM ADA DATA SAH';
            if ($rataCapaian !== null) {
                $status = $rataCapaian >= $target ? 'TERCAPAI' : 'BELUM TERCAPAI';
            }

            $perIku[] = [
                'id' => $iku->id,
                'kode_iku' => $iku->iku,
                'nama_indikator' => $iku->kategori,
                'sifat' => 'WAJIB',
                'satuan' => $iku->satuan,
                'triwulan_terakhir' => $latestTw,
                'capaian_rata' => $rataCapaian,
                'capaian_tw1' => $capaianTw1,
                'capaian_tw2' => $capaianTw2,
                'capaian_tw3' => $capaianTw3,
                'capaian_tw4' => $capaianTw4,
                'target' => $target,
                'status' => $status
            ];
        }

        $totalTercapai = count(array_filter($perIku, function($x) { return $x['status'] === 'TERCAPAI'; }));
        $totalAdaData = count(array_filter($perIku, function($x) { return $x['capaian_rata'] !== null; }));

        $isAssigned = true;
        if (!in_array($user->role, ['ADMIN', 'LPM'])) {
            $isAssigned = DB::table('penugasan_target')
                ->where('fakultas_unit', $user->fakultas_unit)
                ->where('tahun', $tahun)
                ->whereNull('deleted_at')
                ->exists();
        }

        return response()->json([
            'tahun' => (int)$tahun,
            'total_unit_terpantau' => count($scope),
            'total_iku_dipantau' => $ikuList->count(),
            'total_laporan' => $data->count(),
            'status_count' => $statusCount,
            'persentase_iku_tercapai' => $totalAdaData ? round(($totalTercapai / $totalAdaData) * 100, 1) : 0,
            'per_iku' => $perIku,
            'is_assigned' => $isAssigned
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

        $data = DB::table('template_capaian')->where('status_validasi', 'DIAJUKAN')->get();
        
        $units = DB::table('units')->pluck('nama_fak_prod_unit', 'id');
        $ikus = DB::table('master_indikator')->pluck('kategori', 'id');
        $ikuCodes = DB::table('master_indikator')->pluck('iku', 'id');

        $enriched = [];
        foreach ($data as $c) {
            $c->nama_unit = $units[$c->fakultas_unit] ?? $c->fakultas_unit;
            $c->nama_iku = $ikus[$c->id_indikator] ?? $c->id_indikator;
            $c->kode_iku = $ikuCodes[$c->id_indikator] ?? '';
            $enriched[] = $c;
        }

        return response()->json($enriched);
    }
}

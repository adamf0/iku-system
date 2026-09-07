<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CapaianController extends Controller
{
    private function syncAutoIku1Data($scopeUnits, $tahun = 2026)
    {
        if (empty($scopeUnits)) return;

        $triwulanCutOffs = [
            'TW1' => '-03-31 23:59:59',
            'TW2' => '-06-30 23:59:59',
            'TW3' => '-09-30 23:59:59',
            'TW4' => '-12-31 23:59:59',
        ];

        foreach ((array)$scopeUnits as $unitId) {
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
            $vUnit = DB::table('v_fakultas_unit')->where('id', $unitId)->first();

            if (!$sijamuUnit || empty($sijamuUnit->kode_fakultas)) continue;

            foreach ($triwulanCutOffs as $tw => $dateSuffix) {
                $cutOffDate = $tahun . $dateSuffix;

                try {
                    $mQuery = DB::table('unpak_simak.m_mahasiswa')
                        ->where('kode_fak', $sijamuUnit->kode_fakultas);
                    
                    if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                        $mQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                    }

                    $totalMhs = (clone $mQuery)->count();
                    $totalLulus = (clone $mQuery)
                        ->whereNotNull('tanggal_lulus')
                        ->whereNotNull('tanggal_masuk')
                        ->where('tanggal_lulus', '<=', $cutOffDate)
                        ->count();
                } catch (\Throwable $e) {
                    $totalMhs = 0;
                    $totalLulus = 0;
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
                }
            }
        }
    }

    public function index(Request $request)
    {
        $tahun = $request->query('tahun', date('Y'));
        $triwulan = $request->query('triwulan', 'TW1');
        
        $user = $request->user();
        $scope = $user->scopeUnits();

        $this->syncAutoIku1Data($scope, $tahun === 'ALL' ? 2000 : (int)$tahun);

        $data = DB::table('template_capaian')
            ->whereIn('fakultas_unit', $scope)
            ->where('tahun', $tahun)
            ->where('triwulan', $triwulan)
            ->get();

        return response()->json($data);
    }

    // SSE Stream for Capaian table
    public function streamCapaian(Request $request)
    {
        $user = $request->user();
        $scope = $user->scopeUnits();

        $tahunParam = $request->query('tahun', date('Y'));
        $this->syncAutoIku1Data($scope, $tahunParam === 'ALL' ? 2000 : (int)$tahunParam);

        $query = DB::table('template_capaian')
            ->join('v_fakultas_unit', 'template_capaian.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->join('master_indikator', 'template_capaian.id_indikator', '=', 'master_indikator.id')
            ->select(
                'template_capaian.*',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'master_indikator.iku',
                'master_indikator.kategori',
                'master_indikator.full_kategori',
                'master_indikator.satuan'
            )
            ->whereIn('template_capaian.fakultas_unit', $scope);

        if ($request->filled('unit')) {
            $query->where('template_capaian.fakultas_unit', $request->query('unit'));
        }
        if ($request->filled('tahun')) {
            $query->where('template_capaian.tahun', $request->query('tahun'));
        }
        if ($request->filled('triwulan')) {
            $query->where('template_capaian.triwulan', $request->query('triwulan'));
        }
        if ($request->filled('iku')) {
            $kw = '%' . $request->query('iku') . '%';
            $query->where(function($q) use ($kw) {
                $q->where('master_indikator.iku', 'like', $kw)
                  ->orWhere('master_indikator.full_kategori', 'like', $kw);
            });
        }

        return new StreamedResponse(function () use ($query) {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }
            
            echo "event: start\ndata: {}\n\n";
            flush();

            foreach ($query->cursor() as $row) {
                echo "event: row\ndata: " . json_encode($row) . "\n\n";
                flush();
            }

            echo "event: end\ndata: {}\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no'
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'id_indikator' => 'required|integer|exists:master_indikator,id',
            'fakultas_unit' => 'required|integer',
            'tahun' => 'required|integer',
            'triwulan' => 'required|string',
            'nilai_capaian' => 'required|numeric',
            'catatan' => 'nullable|string',
            'file_url' => 'nullable|string',
        ]);

        $user = $request->user();
        if (in_array($user->role, ['ADMIN', 'LPM'])) {
            return response()->json(['error' => 'Akses Ditolak: Admin atau LPM tidak dapat menginput capaian kinerja.'], 403);
        }

        $isIku1 = DB::table('master_indikator')
            ->where('id', $validated['id_indikator'])
            ->where(function($q) {
                $q->where('iku', 'LIKE', 'IKU 1%')
                  ->orWhere('id', 1);
            })
            ->exists();

        if ($isIku1 && !in_array($user->role, ['ADMIN'])) {
            return response()->json(['error' => 'IKU 1 dihitung secara otomatis dari SIMAK dan tidak dapat diinput manual.'], 422);
        }

        // Verify if this unit is indeed assigned to the requested indicator and year
        $isAssigned = DB::table('penugasan_target')
            ->where('fakultas_unit', $user->fakultas_unit)
            ->where('id_indikator', $validated['id_indikator'])
            ->where('tahun', $validated['tahun'])
            ->whereNull('deleted_at')
            ->exists();

        if (!$isAssigned) {
            return response()->json(['error' => 'Unit Anda tidak ditugaskan untuk indikator ini pada tahun ' . $validated['tahun'] . '.'], 403);
        }

        $existing = DB::table('template_capaian')
            ->where('id_indikator', $validated['id_indikator'])
            ->where('fakultas_unit', $validated['fakultas_unit'])
            ->where('tahun', $validated['tahun'])
            ->where('triwulan', $validated['triwulan'])
            ->first();

        if ($existing) {
            if (in_array($existing->status_validasi, ['DIAJUKAN', 'DIVERIFIKASI', 'DISAHKAN'])) {
                return response()->json(['error' => 'Data sedang diverifikasi atau sudah disahkan dan tidak dapat diedit.'], 422);
            }

            DB::table('template_capaian')
                ->where('id', $existing->id)
                ->update(array_merge($validated, [
                    'pembilang' => 0,
                    'penyebut' => 1,
                    'status_validasi' => 'DRAFT',
                    'diinput_oleh' => $user->username,
                    'updated_at' => now()
                ]));
            
            $id = $existing->id;
        } else {
            $id = DB::table('template_capaian')->insertGetId(array_merge($validated, [
                'pembilang' => 0,
                'penyebut' => 1,
                'status_validasi' => 'DRAFT',
                'diinput_oleh' => $user->username,
                'created_at' => now(),
                'updated_at' => now()
            ]));
        }

        return response()->json(['message' => 'Capaian berhasil disimpan.', 'id_capaian' => $id]);
    }

    public function submit(Request $request, $id)
    {
        DB::table('template_capaian')
            ->where('id', $id)
            ->update([
                'status_validasi' => 'DIAJUKAN',
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Capaian berhasil diajukan untuk verifikasi.']);
    }

    public function verify(Request $request, $id)
    {
        $user = $request->user();
        if (!in_array($user->role, ['LPM', 'ADMIN'])) {
            return response()->json(['error' => 'Hanya LPM/Admin yang dapat memverifikasi capaian.'], 403);
        }

        $action = $request->input('action');
        $catatan = $request->input('catatan', '');

        if ($action === 'APPROVE') {
            DB::table('template_capaian')
                ->where('id', $id)
                ->update([
                    'status_validasi' => 'DIVERIFIKASI',
                    'diverifikasi_oleh' => $user->username,
                    'alasan_penolakan' => null,
                    'updated_at' => now()
                ]);
        } else {
            DB::table('template_capaian')
                ->where('id', $id)
                ->update([
                    'status_validasi' => 'DITOLAK',
                    'alasan_penolakan' => $catatan,
                    'updated_at' => now()
                ]);
        }

        return response()->json(['message' => 'Status verifikasi berhasil diperbarui.']);
    }

    public function sahkan(Request $request, $id)
    {
        $user = $request->user();
        if (!in_array($user->role, ['LPM', 'ADMIN'])) {
            return response()->json(['error' => 'Hanya LPM/Admin yang dapat mengesahkan capaian.'], 403);
        }

        DB::table('template_capaian')
            ->where('id', $id)
            ->update([
                'status_validasi' => 'DISAHKAN',
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Capaian berhasil disahkan.']);
    }

    // ---------- PENUGASAN CAPAIAN TARGET ----------

    public function listPenugasan(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengakses data penugasan.'], 403);
        }

        $showDeleted = $request->query('show_deleted') === 'true';

        $query = DB::table('penugasan_target')
            ->join('v_fakultas_unit', 'penugasan_target.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
            ->select(
                'penugasan_target.id',
                'penugasan_target.fakultas_unit',
                'penugasan_target.id_indikator',
                'penugasan_target.tahun',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'master_indikator.iku',
                'master_indikator.full_kategori',
                'master_indikator.jenis_iku'
            );

        if ($showDeleted) {
            $query->whereNotNull('penugasan_target.deleted_at');
        } else {
            $query->whereNull('penugasan_target.deleted_at');
        }

        $data = $query->get();
        return response()->json($data);
    }

    // SSE Stream for Penugasan Table
    public function streamPenugasan(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengakses data penugasan.'], 403);
        }

        $showDeleted = $request->query('show_deleted') === 'true';

        $query = DB::table('penugasan_target')
            ->join('v_fakultas_unit', 'penugasan_target.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
            ->select(
                'penugasan_target.id',
                'penugasan_target.fakultas_unit',
                'penugasan_target.id_indikator',
                'penugasan_target.tahun',
                'penugasan_target.deleted_at',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'master_indikator.iku',
                'master_indikator.full_kategori',
                'master_indikator.jenis_iku'
            );

        if ($showDeleted) {
            $query->whereNotNull('penugasan_target.deleted_at');
        } else {
            $query->whereNull('penugasan_target.deleted_at');
        }

        if ($request->filled('unit')) {
            $query->where('penugasan_target.fakultas_unit', $request->query('unit'));
        }
        if ($request->filled('tahun')) {
            $query->where('penugasan_target.tahun', $request->query('tahun'));
        }
        if ($request->filled('jenis_iku')) {
            $query->where('master_indikator.jenis_iku', $request->query('jenis_iku'));
        }
        if ($request->filled('iku')) {
            $kw = '%' . $request->query('iku') . '%';
            $query->where(function($q) use ($kw) {
                $q->where('master_indikator.iku', 'like', $kw)
                  ->orWhere('master_indikator.full_kategori', 'like', $kw);
            });
        }

        return new StreamedResponse(function () use ($query) {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }
            
            echo "event: start\ndata: {}\n\n";
            flush();

            foreach ($query->cursor() as $row) {
                echo "event: row\ndata: " . json_encode($row) . "\n\n";
                flush();
            }

            echo "event: end\ndata: {}\n\n";
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no'
        ]);
    }

    public function storePenugasan(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menyimpan penugasan.'], 403);
        }

        $validated = $request->validate([
            'fakultas_unit' => 'required|integer',
            'tahun' => 'required|integer',
            'id_indikator' => 'required|array',
            'id_indikator.*' => 'integer|exists:master_indikator,id'
        ]);

        $unitId = $validated['fakultas_unit'];
        $tahun = $validated['tahun'];
        $indicatorIds = $validated['id_indikator'];

        // Sync to master_tahun dynamically to keep it unique
        DB::table('master_tahun')->updateOrInsert(
            ['tahun' => $tahun],
            ['created_at' => now(), 'updated_at' => now()]
        );

        // Delete existing active/soft-deleted for this unit and year
        DB::table('penugasan_target')
            ->where('fakultas_unit', $unitId)
            ->where('tahun', $tahun)
            ->delete();

        $inserts = [];
        foreach ($indicatorIds as $indId) {
            $inserts[] = [
                'fakultas_unit' => $unitId,
                'id_indikator' => $indId,
                'tahun' => $tahun,
                'created_at' => now(),
                'updated_at' => now()
            ];
        }
        
        if (count($inserts) > 0) {
            DB::table('penugasan_target')->insert($inserts);
        }

        return response()->json(['message' => 'Penugasan berhasil disimpan.']);
    }

    public function deletePenugasan(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menghapus penugasan.'], 403);
        }

        $mode = $request->query('mode', 'soft');

        if ($mode === 'hard') {
            DB::table('penugasan_target')->where('id', $id)->delete();
            return response()->json(['message' => 'Penugasan berhasil dihapus secara permanen.']);
        } else {
            DB::table('penugasan_target')->where('id', $id)->update([
                'deleted_at' => now(),
                'updated_at' => now()
            ]);
            return response()->json(['message' => 'Penugasan berhasil dihapus sementara (Soft Delete).']);
        }
    }

    public function restorePenugasan(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat memulihkan penugasan.'], 403);
        }

        DB::table('penugasan_target')->where('id', $id)->update([
            'deleted_at' => null,
            'updated_at' => now()
        ]);

        return response()->json(['message' => 'Penugasan berhasil dipulihkan.']);
    }
}

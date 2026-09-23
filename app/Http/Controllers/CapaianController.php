<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Jobs\ProcessGdriveFolderJob;

class CapaianController extends Controller
{
    public function index(Request $request)
    {
        $tahun = $request->query('tahun', date('Y'));
        $triwulan = $request->query('triwulan', 'TW1');
        
        $user = $request->user();
        $scope = $user->scopeUnits();

        // $this->syncAutoIku1Data($scope, $tahun === 'ALL' ? 2000 : (int)$tahun);

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
        // $this->syncAutoIku1Data($scope, $tahunParam === 'ALL' ? 2000 : (int)$tahunParam);

        $query = DB::table('template_capaian')
            ->join('v_fakultas_unit', 'template_capaian.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->join('master_indikator', 'template_capaian.id_indikator', '=', 'master_indikator.id')
            ->select(
                'template_capaian.*',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'v_fakultas_unit.type as type_unit',
                'v_fakultas_unit.jenjang',
                'v_fakultas_unit.kode_jenjang',
                'v_fakultas_unit.fakultas',
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
            'nilai_capaian' => 'required|numeric|min:0',
            'catatan' => 'nullable|string',
            'file_url' => 'required|string',
        ]);

        $user = $request->user();
        if (in_array($user->role, ['ADMIN', 'LPM'])) {
            return response()->json(['error' => 'Akses Ditolak: Admin atau LPM tidak dapat menginput capaian kinerja.'], 403);
        }

        $isIku1 = DB::table('master_indikator')
            ->where('id', $validated['id_indikator'])
            ->where(function($q) {
                $q->where('iku', 'IKU 1')
                  ->orWhere('iku', 'LIKE', 'IKU 1 -%')
                  ->orWhere('iku', 'LIKE', 'Sub IKU 1%')
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

        $gdriveLog = DB::table('gdrive_folder_logs')
            ->where('fakultas_unit', $validated['fakultas_unit'])
            ->where('tahun', $validated['tahun'])
            ->where('id_indikator', $validated['id_indikator'])
            ->first();

        if ($gdriveLog && !empty($gdriveLog->folder_url)) {
            $validated['file_url'] = $gdriveLog->folder_url;
        }

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

    public function getDriveLink(Request $request)
    {
        $user = $request->user();
        $unitId = $request->query('unit');
        $tahun = $request->query('tahun', 2026);
        $idIndikator = $request->query('id_indikator');

        if ($user && !in_array($user->role, ['ADMIN', 'LPM'])) {
            $unitId = $user->fakultas_unit;
        } else if (empty($unitId) && $user) {
            $unitId = $user->fakultas_unit;
        }

        if (empty($unitId) || empty($idIndikator)) {
            return response()->json(['drive_url' => null]);
        }

        $gdriveLog = DB::table('gdrive_folder_logs')
            ->where('fakultas_unit', $unitId)
            ->where('tahun', $tahun)
            ->where('id_indikator', $idIndikator)
            ->first();

        if ($gdriveLog && !empty($gdriveLog->folder_url)) {
            return response()->json(['drive_url' => $gdriveLog->folder_url]);
        }

        return response()->json(['drive_url' => null]);
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
            ->leftJoin('gdrive_folder_logs', function($join) {
                $join->on('penugasan_target.fakultas_unit', '=', 'gdrive_folder_logs.fakultas_unit')
                     ->on('penugasan_target.tahun', '=', 'gdrive_folder_logs.tahun')
                     ->on('penugasan_target.id_indikator', '=', 'gdrive_folder_logs.id_indikator');
            })
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

        if ($request->filled('unit')) {
            $query->where('penugasan_target.fakultas_unit', $request->query('unit'));
        }
        if ($request->filled('tahun')) {
            $query->where('penugasan_target.tahun', $request->query('tahun'));
        }

        $data = $query->orderByRaw('COALESCE(gdrive_folder_logs.id, penugasan_target.id) ASC')->get();
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
            ->leftJoin('gdrive_folder_logs', function($join) {
                $join->on('penugasan_target.fakultas_unit', '=', 'gdrive_folder_logs.fakultas_unit')
                     ->on('penugasan_target.tahun', '=', 'gdrive_folder_logs.tahun')
                     ->on('penugasan_target.id_indikator', '=', 'gdrive_folder_logs.id_indikator');
            })
            ->select(
                'penugasan_target.id',
                'penugasan_target.fakultas_unit',
                'penugasan_target.id_indikator',
                'penugasan_target.tahun',
                'penugasan_target.deleted_at',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'v_fakultas_unit.type as type_unit',
                'v_fakultas_unit.jenjang',
                'v_fakultas_unit.kode_jenjang',
                'v_fakultas_unit.fakultas',
                'master_indikator.iku',
                'master_indikator.full_kategori',
                'master_indikator.jenis_iku',
                'gdrive_folder_logs.status as gdrive_status',
                'gdrive_folder_logs.folder_url as gdrive_url',
                'gdrive_folder_logs.error_message as gdrive_error',
                'gdrive_folder_logs.history as gdrive_history'
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
            $rawKw = trim($request->query('iku'));
            if ($rawKw !== '') {
                $lastChar = substr($rawKw, -1);
                $escapedKw = preg_quote($rawKw, '/');
                $regexpPattern = ctype_alnum($lastChar) 
                    ? $escapedKw . '([^a-zA-Z0-9]|$)' 
                    : $escapedKw . '($|[^a-zA-Z0-9])';

                $query->where(function($q) use ($rawKw, $regexpPattern) {
                    $q->where('master_indikator.iku', 'REGEXP', $regexpPattern)
                      ->orWhere('master_indikator.full_kategori', 'REGEXP', $regexpPattern)
                      ->orWhere('master_indikator.kategori', 'REGEXP', $regexpPattern)
                      ->orWhereRaw('CONVERT(v_fakultas_unit.nama_fak_prod_unit USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', ['%' . $rawKw . '%']);
                });
            }
        }

        $query->orderByRaw('COALESCE(gdrive_folder_logs.id, penugasan_target.id) ASC');

        return new StreamedResponse(function () use ($query) {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }
            
            echo "event: start\ndata: {}\n\n";
            flush();

            $rows = $query->get();
            $chunks = array_chunk($rows->toArray(), 50);

            foreach ($chunks as $chunk) {
                echo "event: batch\n";
                echo "data: " . json_encode($chunk) . "\n\n";
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

    public function streamGdriveStatus(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengakses.'], 403);
        }

        return new StreamedResponse(function () {
            if (ob_get_level() > 0) {
                ob_end_clean();
            }

            for ($i = 0; $i < 30; $i++) {
                if (connection_aborted()) {
                    break;
                }

                $logs = DB::table('gdrive_folder_logs')
                    ->select('fakultas_unit', 'tahun', 'id_indikator', 'status', 'folder_url', 'error_message', 'history')
                    ->get();

                echo "event: gdrive_status_update\n";
                echo "data: " . json_encode($logs) . "\n\n";
                flush();

                sleep(2);
            }
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
        $nowStr = now()->format('Y-m-d H:i:s');
        foreach ($indicatorIds as $indId) {
            $inserts[] = [
                'fakultas_unit' => $unitId,
                'id_indikator' => $indId,
                'tahun' => $tahun,
                'created_at' => now(),
                'updated_at' => now()
            ];

            // Initialize or update gdrive_folder_logs with WAITING status
            $existingLog = DB::table('gdrive_folder_logs')
                ->where('fakultas_unit', $unitId)
                ->where('tahun', $tahun)
                ->where('id_indikator', $indId)
                ->first();

            if ($existingLog && $existingLog->status === 'CREATED' && !empty($existingLog->folder_url)) {
                continue;
            }

            $history = [];
            if ($existingLog && !empty($existingLog->history)) {
                $history = json_decode($existingLog->history, true) ?: [];
            }
            $history[] = [
                'status' => 'WAITING',
                'timestamp' => $nowStr,
                'note' => 'Penugasan disimpan. Memulai proses background pembuatan folder Google Drive'
            ];

            DB::table('gdrive_folder_logs')->updateOrInsert(
                [
                    'fakultas_unit' => $unitId,
                    'tahun' => $tahun,
                    'id_indikator' => $indId,
                ],
                [
                    'status' => 'WAITING',
                    'history' => json_encode($history),
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }
        
        if (count($inserts) > 0) {
            DB::table('penugasan_target')->insert($inserts);
            ProcessGdriveFolderJob::dispatch($unitId, $tahun);
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

    public function deleteGroupPenugasan(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menghapus penugasan.'], 403);
        }

        $validated = $request->validate([
            'fakultas_unit' => 'required|integer',
            'tahun' => 'required|integer',
            'mode' => 'nullable|string'
        ]);

        $mode = $validated['mode'] ?? 'soft';
        $unitId = $validated['fakultas_unit'];
        $tahun = $validated['tahun'];

        if ($mode === 'hard') {
            DB::table('penugasan_target')
                ->where('fakultas_unit', $unitId)
                ->where('tahun', $tahun)
                ->delete();
            return response()->json(['message' => 'Semua penugasan untuk unit dan tahun ini berhasil dihapus secara permanen.']);
        } else {
            DB::table('penugasan_target')
                ->where('fakultas_unit', $unitId)
                ->where('tahun', $tahun)
                ->whereNull('deleted_at')
                ->update([
                    'deleted_at' => now(),
                    'updated_at' => now()
                ]);
            return response()->json(['message' => 'Semua penugasan untuk unit dan tahun ini berhasil dihapus sementara (Soft Delete).']);
        }
    }

    public function restoreGroupPenugasan(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat memulihkan penugasan.'], 403);
        }

        $validated = $request->validate([
            'fakultas_unit' => 'required|integer',
            'tahun' => 'required|integer'
        ]);

        DB::table('penugasan_target')
            ->where('fakultas_unit', $validated['fakultas_unit'])
            ->where('tahun', $validated['tahun'])
            ->whereNotNull('deleted_at')
            ->update([
                'deleted_at' => null,
                'updated_at' => now()
            ]);

        return response()->json(['message' => 'Semua penugasan untuk unit dan tahun ini berhasil dipulihkan.']);
    }

    public function retryGdriveFolder(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat memproses ulang pembuatan folder.'], 403);
        }

        $validated = $request->validate([
            'fakultas_unit' => 'required|integer',
            'tahun' => 'required|integer',
            'id_indikator' => 'required|integer',
        ]);

        $unitId = $validated['fakultas_unit'];
        $tahun = $validated['tahun'];
        $indId = $validated['id_indikator'];

        $existingLog = DB::table('gdrive_folder_logs')
            ->where('fakultas_unit', $unitId)
            ->where('tahun', $tahun)
            ->where('id_indikator', $indId)
            ->first();

        $history = [];
        if ($existingLog && !empty($existingLog->history)) {
            $history = json_decode($existingLog->history, true) ?: [];
        }
        $history[] = [
            'status' => 'WAITING',
            'timestamp' => now()->format('Y-m-d H:i:s'),
            'note' => 'User meminta retry manual pembuatan folder Google Drive'
        ];

        DB::table('gdrive_folder_logs')->updateOrInsert(
            [
                'fakultas_unit' => $unitId,
                'tahun' => $tahun,
                'id_indikator' => $indId,
            ],
            [
                'status' => 'WAITING',
                'history' => json_encode($history),
                'updated_at' => now()
            ]
        );

        ProcessGdriveFolderJob::dispatch($unitId, $tahun, $indId);

        return response()->json(['message' => 'Proses pembuatan folder Google Drive telah dimasukkan ke background job.']);
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

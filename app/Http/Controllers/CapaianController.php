<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Services\GoogleDriveService;

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

        $driveService = new \App\Services\GoogleDriveService();
        $driveService->ensureYearFolderStructure($tahun);
        $yearFolderId = $driveService->findFolder((string)$tahun);

        foreach ((array)$scopeUnits as $unitId) {
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
            $vUnit = DB::table('v_fakultas_unit')->where('id', $unitId)->first();

            if (!$sijamuUnit || empty($sijamuUnit->kode_fakultas)) continue;

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

                    if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                        $mhsStatsQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                    }
                    $baseStatsGrouped = $mhsStatsQuery->groupBy('kode_prodi')->get()->keyBy('kode_prodi');

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

                    $graduatesQuery = DB::connection('simak')->table('m_mahasiswa')
                        ->selectRaw("
                            COALESCE(kode_prodi, '') as kode_prodi,
                            DATEDIFF(tanggal_lulus, tanggal_masuk) as masa_studi_hari
                        ")
                        ->where('kode_fak', $sijamuUnit->kode_fakultas)
                        ->whereNotNull('tanggal_lulus')
                        ->whereNotNull('tanggal_masuk')
                        ->where('tanggal_lulus', '<=', $cutOffDate);

                    if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
                        $graduatesQuery->where('kode_prodi', $sijamuUnit->kode_prodi);
                    }
                    $graduates = $graduatesQuery->get();
                    $graduatesByProdi = $graduates->groupBy('kode_prodi');

                    $totalMhs = $baseStatsGrouped->sum('total_mhs');
                    $totalLulus = $graduates->count();
                } catch (\Throwable $e) {
                    $totalMhs = 0;
                    $totalLulus = 0;
                    $baseStatsGrouped = collect();
                    $dropOutGrouped = collect();
                    $graduatesByProdi = collect();
                }

                $capaianPct = $totalMhs > 0 ? round(($totalLulus / $totalMhs) * 100, 2) : 0;

                // Build detailed prodi breakdown for Excel export
                $excelRows = [];
                $prodiListQuery = DB::table('sijamu_fakultas_unit as s')
                    ->leftJoin('v_fakultas_unit as v', 's.id', '=', 'v.id')
                    ->where('s.kode_fakultas', $sijamuUnit->kode_fakultas);

                if (!empty($sijamuUnit->kode_prodi) && ($vUnit && strtolower($vUnit->type) === 'prodi')) {
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
                    if ($twFolderId && file_exists($tempPath)) {
                        $fileUrl = $driveService->uploadFile($tempPath, $fileName, $twFolderId);
                        @unlink($tempPath);
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
                'v_fakultas_unit.type as type_unit',
                'v_fakultas_unit.jenjang',
                'v_fakultas_unit.kode_jenjang',
                'v_fakultas_unit.fakultas',
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

        // Check and create Google Drive folder structure for the year if it doesn't exist
        $ikuList = GoogleDriveService::defaultIkuList();
        $twList = GoogleDriveService::defaultTwList();

        try {
            $driveService = new GoogleDriveService();
            $driveService->ensureYearFolderStructure($tahun, $ikuList, $twList);
        } catch (\Throwable $e) {
            Log::error("Google Drive structure check/creation error: " . $e->getMessage());
        }

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

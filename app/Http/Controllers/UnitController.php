<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UnitController extends Controller
{
    /**
     * Get list of all units from v_fakultas_unit with optional filtering
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $query = DB::table('v_fakultas_unit');

        if ($request->filled('search')) {
            $search = '%' . trim($request->query('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->whereRaw('CONVERT(nama_fak_prod_unit USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', [$search])
                  ->orWhereRaw('CONVERT(fakultas USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', [$search])
                  ->orWhereRaw('CONVERT(type USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', [$search])
                  ->orWhereRaw('CONVERT(kode_fakultas USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', [$search])
                  ->orWhereRaw('CONVERT(kode_prodi USING utf8mb4) COLLATE utf8mb4_unicode_ci LIKE ?', [$search]);
            });
        }

        if ($request->filled('type') && $request->query('type') !== 'ALL') {
            $query->whereRaw('CONVERT(type USING utf8mb4) COLLATE utf8mb4_unicode_ci = ?', [$request->query('type')]);
        }

        if ($request->filled('status') && $request->query('status') !== 'ALL') {
            $isActive = $request->query('status') === '1' || $request->query('status') === 'active' ? 1 : 0;
            $query->where('is_active', $isActive);
        }

        $data = $query->orderBy('type', 'asc')->orderBy('nama_fak_prod_unit', 'asc')->get();

        return response()->json($data);
    }

    /**
     * Get reference options (m_fakultas and m_program_studi) for unit form selects
     */
    public function options(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        try {
            $fakultas = DB::connection('simak')->table('m_fakultas')
                ->select('kode_fakultas', 'nama_fakultas')
                ->orderBy('nama_fakultas', 'asc')
                ->get();

            $prodi = DB::connection('simak')->table('m_program_studi')
                ->select(
                    'kode_prodi',
                    'kode_fak',
                    'nama_prodi',
                    'kode_jenjang',
                    DB::raw("CASE 
                        WHEN kode_jenjang = 'C' THEN 's1' 
                        WHEN kode_jenjang = 'B' THEN 's2' 
                        WHEN kode_jenjang = 'A' THEN 's3' 
                        WHEN kode_jenjang = 'E' THEN 'd3' 
                        WHEN kode_jenjang = 'D' THEN 'd4' 
                        WHEN kode_jenjang = 'J' THEN 'profesi' 
                        ELSE '' 
                    END AS jenjang")
                )
                ->orderBy('nama_prodi', 'asc')
                ->get();
        } catch (\Throwable $e) {
            Log::warning('Gagal query database SIMAK, fallback ke database default: ' . $e->getMessage());

            $fakultas = DB::table('m_fakultas')
                ->select('kode_fakultas', 'nama_fakultas')
                ->orderBy('nama_fakultas', 'asc')
                ->get();

            $prodi = DB::table('m_program_studi')
                ->select(
                    'kode_prodi',
                    'kode_fak',
                    'nama_prodi',
                    'kode_jenjang',
                    DB::raw("CASE 
                        WHEN kode_jenjang = 'C' THEN 's1' 
                        WHEN kode_jenjang = 'B' THEN 's2' 
                        WHEN kode_jenjang = 'A' THEN 's3' 
                        WHEN kode_jenjang = 'E' THEN 'd3' 
                        WHEN kode_jenjang = 'D' THEN 'd4' 
                        WHEN kode_jenjang = 'J' THEN 'profesi' 
                        ELSE '' 
                    END AS jenjang")
                )
                ->orderBy('nama_prodi', 'asc')
                ->get();
        }

        return response()->json([
            'fakultas' => $fakultas,
            'prodi' => $prodi
        ]);
    }

    /**
     * Create a new unit in sijamu_fakultas_unit
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:fakultas,prodi,unit',
            'kode_fakultas' => 'nullable|string|max:9',
            'kode_prodi' => 'nullable|string|max:10',
            'nama' => 'nullable|string|max:100',
            'is_active' => 'boolean'
        ]);

        $type = $validated['type'];
        $standalone = ($type === 'fakultas') ? 1 : 0;
        $nama = $validated['nama'] ?? null;
        $kodeFakultas = $validated['kode_fakultas'] ?? null;
        $kodeProdi = $validated['kode_prodi'] ?? null;

        if ($type === 'unit' && empty($nama)) {
            return response()->json(['error' => 'Nama unit wajib diisi.'], 422);
        }

        if ($type === 'prodi' && empty($kodeProdi)) {
            return response()->json(['error' => 'Program studi wajib dipilih.'], 422);
        }

        if ($type === 'fakultas' && empty($kodeFakultas)) {
            return response()->json(['error' => 'Fakultas wajib dipilih.'], 422);
        }

        // Check if duplicate entry already exists
        $duplicateQuery = DB::table('sijamu_fakultas_unit')
            ->where('standalone', $standalone);

        if ($kodeFakultas) $duplicateQuery->where('kode_fakultas', $kodeFakultas);
        else $duplicateQuery->whereNull('kode_fakultas');

        if ($kodeProdi) $duplicateQuery->where('kode_prodi', $kodeProdi);
        else $duplicateQuery->whereNull('kode_prodi');

        if ($nama) $duplicateQuery->where('nama', $nama);
        else $duplicateQuery->whereNull('nama');

        if ($duplicateQuery->exists()) {
            return response()->json(['error' => 'Unit dengan kombinasi data ini sudah terdaftar.'], 422);
        }

        $id = DB::table('sijamu_fakultas_unit')->insertGetId([
            'kode_fakultas' => $kodeFakultas,
            'kode_prodi' => $kodeProdi,
            'nama' => $nama,
            'standalone' => $standalone,
            'is_active' => $request->boolean('is_active', true),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Unit berhasil ditambahkan.',
            'id' => $id
        ]);
    }

    /**
     * Update an existing unit in sijamu_fakultas_unit
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $unit = DB::table('sijamu_fakultas_unit')->where('id', $id)->first();
        if (!$unit) {
            return response()->json(['error' => 'Unit tidak ditemukan.'], 444);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:fakultas,prodi,unit',
            'kode_fakultas' => 'nullable|string|max:9',
            'kode_prodi' => 'nullable|string|max:10',
            'nama' => 'nullable|string|max:100',
            'is_active' => 'boolean'
        ]);

        $type = $validated['type'];
        $standalone = ($type === 'fakultas') ? 1 : 0;
        $nama = $validated['nama'] ?? null;
        $kodeFakultas = $validated['kode_fakultas'] ?? null;
        $kodeProdi = $validated['kode_prodi'] ?? null;

        if ($type === 'unit' && empty($nama)) {
            return response()->json(['error' => 'Nama unit wajib diisi.'], 422);
        }

        if ($type === 'prodi' && empty($kodeProdi)) {
            return response()->json(['error' => 'Program studi wajib dipilih.'], 422);
        }

        if ($type === 'fakultas' && empty($kodeFakultas)) {
            return response()->json(['error' => 'Fakultas wajib dipilih.'], 422);
        }

        DB::table('sijamu_fakultas_unit')->where('id', $id)->update([
            'kode_fakultas' => $kodeFakultas,
            'kode_prodi' => $kodeProdi,
            'nama' => $nama,
            'standalone' => $standalone,
            'is_active' => $request->boolean('is_active', true),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Unit berhasil diperbarui.'
        ]);
    }

    /**
     * Toggle unit active/non-active status
     */
    public function toggleStatus(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $unit = DB::table('sijamu_fakultas_unit')->where('id', $id)->first();
        if (!$unit) {
            return response()->json(['error' => 'Unit tidak ditemukan.'], 404);
        }

        $newStatus = !$unit->is_active;

        DB::table('sijamu_fakultas_unit')->where('id', $id)->update([
            'is_active' => $newStatus,
            'updated_at' => now()
        ]);

        $statusLabel = $newStatus ? 'diaktifkan' : 'dinonaktifkan';
        return response()->json([
            'message' => "Unit berhasil {$statusLabel}.",
            'is_active' => $newStatus
        ]);
    }

    /**
     * Delete unit from sijamu_fakultas_unit with safety checks
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        // Check if unit is assigned in penugasan_target
        $hasPenugasan = DB::table('penugasan_target')->where('fakultas_unit', $id)->whereNull('deleted_at')->exists();
        if ($hasPenugasan) {
            return response()->json(['error' => 'Gagal menghapus: Unit ini memiliki penugasan target IKU aktif. Non-aktifkan unit sebagai gantinya.'], 422);
        }

        // Check if unit is linked to users
        $hasUsers = DB::table('users')->where('fakultas_unit', $id)->exists();
        if ($hasUsers) {
            return response()->json(['error' => 'Gagal menghapus: Unit ini masih terhubung dengan akun pengguna. Non-aktifkan unit sebagai gantinya.'], 422);
        }

        DB::table('sijamu_fakultas_unit')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Unit berhasil dihapus.'
        ]);
    }
}

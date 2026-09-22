<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MasterController extends Controller
{
    // List contexts
    public function contexts(Request $request)
    {
        $data = DB::table('master_konteks')->get();
        return response()->json($data);
    }

    // List indicators
    // List indicators with year-specific target parameter override
    public function iku(Request $request)
    {
        $tahun = $request->query('tahun', 2026);
        $indicators = DB::table('master_indikator')->get();

        $targets = DB::table('target_indikator_tahun')
            ->where('tahun', $tahun)
            ->get()
            ->keyBy('id_indikator');

        $result = $indicators->map(function ($iku) use ($targets) {
            $t = $targets->get($iku->id);
            $iku->base_line = $t ? $t->base_line : $iku->base_line;
            $iku->target = $t ? $t->target : $iku->target;
            $iku->target_d3 = $t ? $t->target_d3 : $iku->target_d3;
            $iku->target_d4 = $t ? $t->target_d4 : $iku->target_d4;
            $iku->target_s1 = $t ? $t->target_s1 : $iku->target_s1;
            $iku->target_s2 = $t ? $t->target_s2 : $iku->target_s2;
            $iku->target_s3 = $t ? $t->target_s3 : $iku->target_s3;
            $iku->target_profesi = $t ? $t->target_profesi : $iku->target_profesi;
            $iku->target_unit = $t ? $t->target_unit : $iku->target_unit;
            $iku->target_fakultas = $t ? $t->target_fakultas : $iku->target_fakultas;
            $iku->target_prodi = $t ? $t->target_prodi : $iku->target_prodi;
            $iku->catatan_justifikasi = $t ? $t->catatan_justifikasi : $iku->catatan_justifikasi;
            $iku->file_justifikasi = $t ? $t->file_justifikasi : $iku->file_justifikasi;
            return $iku;
        });

        return response()->json($result);
    }

    // List indicators assigned to active user's unit
    public function assignedIku(Request $request)
    {
        $user = $request->user();
        $unitId = $request->query('unit');
        $tahun = $request->query('tahun');
        
        if ($user && !in_array($user->role, ['ADMIN', 'LPM'])) {
            $unitId = $user->fakultas_unit;
        } else if (empty($unitId) && $user) {
            $unitId = $user->fakultas_unit;
        }
        
        $query = DB::table('penugasan_target')
            ->join('master_indikator', 'penugasan_target.id_indikator', '=', 'master_indikator.id')
            ->leftJoin('gdrive_folder_logs', function($join) {
                $join->on('penugasan_target.fakultas_unit', '=', 'gdrive_folder_logs.fakultas_unit')
                     ->on('penugasan_target.tahun', '=', 'gdrive_folder_logs.tahun')
                     ->on('penugasan_target.id_indikator', '=', 'gdrive_folder_logs.id_indikator');
            })
            ->where('penugasan_target.fakultas_unit', $unitId)
            ->whereNull('penugasan_target.deleted_at');

        if (!empty($tahun)) {
            $query->where('penugasan_target.tahun', $tahun);
        }

        $indicators = $query->select('master_indikator.*')
            ->orderByRaw('COALESCE(gdrive_folder_logs.id, penugasan_target.id) ASC')
            ->get()
            ->unique('id')
            ->values();

        $targetYear = $tahun ?: 2026;

        $targets = DB::table('target_indikator_tahun')
            ->where('tahun', $targetYear)
            ->get()
            ->keyBy('id_indikator');

        $result = $indicators->map(function ($iku) use ($targets) {
            $t = $targets->get($iku->id);
            if ($t) {
                $iku->base_line = $t->base_line;
                $iku->target = $t->target;
                $iku->catatan_justifikasi = $t->catatan_justifikasi ?? ($iku->catatan_justifikasi ?? null);
                $iku->file_justifikasi = $t->file_justifikasi ?? ($iku->file_justifikasi ?? null);
            } else {
                $iku->catatan_justifikasi = $iku->catatan_justifikasi ?? null;
                $iku->file_justifikasi = $iku->file_justifikasi ?? null;
            }
            return $iku;
        });
        
        return response()->json($result);
    }

    // Create indicator (Menu 1: Management Indikator)
    public function createIku(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat membuat master indikator.'], 403);
        }

        $validated = $request->validate([
            'id_konteks' => 'required|integer|exists:master_konteks,id',
            'iku' => 'required|string',
            'kategori' => 'nullable|string',
            'id_sub' => 'nullable|integer|exists:master_indikator,id',
            'satuan' => 'required|string',
            'jenis_iku' => 'nullable|string',
            'base_line' => 'nullable|string',
            'target' => 'nullable|string',
            'formula_text' => 'nullable|string',
            'sumber_data' => 'nullable|string',
        ]);

        $parentIkuCode = null;
        if (!empty($validated['id_sub'])) {
            $parent = DB::table('master_indikator')->where('id', $validated['id_sub'])->first();
            if ($parent) {
                $parentIkuCode = $parent->iku;
            }
        }

        $kategori = $validated['kategori'] ?? '';
        $fullKategori = $parentIkuCode 
            ? ($kategori ? $parentIkuCode . ' - ' . $kategori : $parentIkuCode)
            : ($kategori ? $validated['iku'] . ' - ' . $kategori : $validated['iku']);

        $id = DB::table('master_indikator')->insertGetId(array_merge($validated, [
            'full_kategori' => $fullKategori,
            'created_at' => now(),
            'updated_at' => now()
        ]));

        // Insert default target in target_indikator_tahun for 2026
        DB::table('target_indikator_tahun')->updateOrInsert(
            ['id_indikator' => $id, 'tahun' => 2026],
            [
                'base_line' => $validated['base_line'] ?? null,
                'target' => $validated['target'] ?? null,
                'created_at' => now(),
                'updated_at' => now()
            ]
        );

        return response()->json(['message' => 'Indikator berhasil dibuat.', 'id' => $id]);
    }

    // Update indicator (Menu 1: Management Indikator & Menu 2: Management Target)
    public function updateIku(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengubah master indikator.'], 403);
        }

        $tahun = $request->input('tahun', $request->query('tahun', 2026));

        $validatedMaster = $request->only([
            'id_konteks', 'iku', 'kategori', 'id_sub', 'satuan', 'jenis_iku', 'formula_text', 'sumber_data'
        ]);

        $validatedTarget = $request->only([
            'base_line', 'target', 'target_d3', 'target_d4', 'target_s1', 'target_s2', 
            'target_s3', 'target_profesi', 'target_unit', 'target_fakultas', 'target_prodi'
        ]);

        $current = DB::table('master_indikator')->where('id', $id)->first();
        if ($current) {
            $idSub = array_key_exists('id_sub', $validatedMaster) ? $validatedMaster['id_sub'] : $current->id_sub;
            $kategori = array_key_exists('kategori', $validatedMaster) ? ($validatedMaster['kategori'] ?? '') : ($current->kategori ?? '');
            $iku = isset($validatedMaster['iku']) ? $validatedMaster['iku'] : $current->iku;

            $parentIkuCode = null;
            if (!empty($idSub)) {
                $parent = DB::table('master_indikator')->where('id', $idSub)->first();
                if ($parent) {
                    $parentIkuCode = $parent->iku;
                }
            }

            $validatedMaster['full_kategori'] = $parentIkuCode 
                ? ($kategori ? $parentIkuCode . ' - ' . $kategori : $parentIkuCode)
                : ($kategori ? $iku . ' - ' . $kategori : $iku);
        }

        if (!empty($validatedMaster)) {
            DB::table('master_indikator')
                ->where('id', $id)
                ->update(array_merge($validatedMaster, ['updated_at' => now()]));
        }

        if (!empty($validatedTarget)) {
            DB::table('target_indikator_tahun')->updateOrInsert(
                ['id_indikator' => $id, 'tahun' => $tahun],
                array_merge($validatedTarget, ['updated_at' => now()])
            );
        }

        return response()->json(['message' => 'Indikator berhasil diperbarui.']);
    }

    // Delete indicator (Menu 1: Management Indikator)
    public function deleteIku(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menghapus master indikator.'], 403);
        }

        $current = DB::table('master_indikator')->where('id', $id)->first();
        if ($current && !empty($current->file_berkas)) {
            $oldPath = public_path(ltrim($current->file_berkas, '/'));
            if (file_exists($oldPath) && is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        DB::table('master_indikator')->where('id', $id)->delete();
        DB::table('target_indikator_tahun')->where('id_indikator', $id)->delete();
        return response()->json(['message' => 'Indikator berhasil dihapus.']);
    }

    // Upload berkas/pedoman/template for master indicator (Menu 1: Management Indikator)
    public function uploadBerkas(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengunggah berkas indikator.'], 403);
        }

        $request->validate([
            'file_berkas' => 'required|file|mimes:pdf,xls,xlsx|max:5120',
        ], [
            'file_berkas.required' => 'File berkas wajib dipilih.',
            'file_berkas.file' => 'Berkas yang diunggah tidak valid.',
            'file_berkas.mimes' => 'Format file harus berupa PDF atau Excel (.pdf, .xls, .xlsx).',
            'file_berkas.max' => 'Ukuran berkas maksimal adalah 5MB.',
        ]);

        $file = $request->file('file_berkas');
        $filename = time() . '_' . preg_replace('/[^A-Za-z0-9_\.-]/', '_', $file->getClientOriginalName());
        $uploadDir = public_path('uploads/berkas_indikator');
        if (!file_exists($uploadDir)) {
            @mkdir($uploadDir, 0775, true);
        }

        $current = DB::table('master_indikator')->where('id', $id)->first();
        if ($current && !empty($current->file_berkas)) {
            $oldPath = public_path(ltrim($current->file_berkas, '/'));
            if (file_exists($oldPath) && is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        try {
            $file->move($uploadDir, $filename);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Gagal menyimpan berkas di server. Pastikan folder public/uploads memiliki hak akses tulis (write permission). ' . $e->getMessage()
            ], 500);
        }

        $fileUrl = '/uploads/berkas_indikator/' . $filename;

        DB::table('master_indikator')->where('id', $id)->update([
            'file_berkas' => $fileUrl,
            'updated_at' => now()
        ]);

        return response()->json([
            'message' => 'Berkas indikator berhasil diunggah.',
            'file_berkas' => $fileUrl,
            'file_name' => $file->getClientOriginalName()
        ]);
    }

    // Delete berkas from master indicator
    public function deleteBerkas(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menghapus berkas indikator.'], 403);
        }

        $current = DB::table('master_indikator')->where('id', $id)->first();
        if ($current && !empty($current->file_berkas)) {
            $oldPath = public_path(ltrim($current->file_berkas, '/'));
            if (file_exists($oldPath) && is_file($oldPath)) {
                @unlink($oldPath);
            }
        }

        DB::table('master_indikator')->where('id', $id)->update([
            'file_berkas' => null,
            'updated_at' => now()
        ]);

        return response()->json(['message' => 'Berkas indikator berhasil dihapus.']);
    }

    // Save justifikasi for indicator target per year (Menu 2: Management Target)
    public function saveJustifikasi(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $tahun = $request->input('tahun', $request->query('tahun', 2026));

        $validated = $request->validate([
            'catatan_justifikasi' => 'nullable|string',
            'file_justifikasi' => 'nullable|file|max:20480',
        ]);

        $updateData = [
            'catatan_justifikasi' => $validated['catatan_justifikasi'] ?? null,
            'updated_at' => now()
        ];

        if ($request->hasFile('file_justifikasi')) {
            $file = $request->file('file_justifikasi');
            $filename = time() . '_' . preg_replace('/[^A-Za-z0-9_\.-]/', '_', $file->getClientOriginalName());
            $uploadDir = public_path('uploads/justifikasi');
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            $file->move($uploadDir, $filename);
            $updateData['file_justifikasi'] = '/uploads/justifikasi/' . $filename;
        }

        DB::table('target_indikator_tahun')->updateOrInsert(
            ['id_indikator' => $id, 'tahun' => $tahun],
            $updateData
        );

        return response()->json([
            'message' => 'Justifikasi target berhasil disimpan.',
            'catatan_justifikasi' => $updateData['catatan_justifikasi'],
            'file_justifikasi' => $updateData['file_justifikasi'] ?? null
        ]);
    }

    // Fetch units from v_fakultas_unit view (Scoped per user role & unit, only active units)
    public function units(Request $request)
    {
        $user = $request->user();
        $query = DB::table('v_fakultas_unit')
            ->where(function($w) {
                $w->whereNull('is_active')->orWhere('is_active', 1);
            });

        if ($user) {
            $scope = $user->scopeUnits();
            $query->whereIn('id', $scope);
        }

        $data = $query->get();
        return response()->json($data);
    }

    // Fetch unique years registered
    public function tahun(Request $request)
    {
        $data = DB::table('master_tahun')->orderBy('tahun', 'asc')->get();
        return response()->json($data);
    }
}

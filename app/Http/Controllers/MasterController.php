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
    public function iku(Request $request)
    {
        $data = DB::table('master_indikator')->get();
        return response()->json($data);
    }

    // List indicators assigned to active user's unit
    public function assignedIku(Request $request)
    {
        $user = $request->user();
        $unitId = $request->query('unit');
        $tahun = $request->query('tahun');
        
        if (empty($unitId)) {
            $unitId = $user->fakultas_unit;
        }
        
        $query = DB::table('master_indikator')
            ->join('penugasan_target', 'master_indikator.id', '=', 'penugasan_target.id_indikator')
            ->where('penugasan_target.fakultas_unit', $unitId)
            ->whereNull('penugasan_target.deleted_at');

        if (!empty($tahun)) {
            $query->where('penugasan_target.tahun', $tahun);
        }

        $data = $query->select('master_indikator.*')->get();
        
        return response()->json($data);
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

        return response()->json(['message' => 'Indikator berhasil dibuat.', 'id' => $id]);
    }

    // Update indicator (Menu 1: Management Indikator & Menu 2: Management Target)
    public function updateIku(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat mengubah master indikator.'], 403);
        }

        $validated = $request->validate([
            'id_konteks' => 'sometimes|integer|exists:master_konteks,id',
            'iku' => 'sometimes|string',
            'kategori' => 'nullable|string',
            'id_sub' => 'nullable|integer|exists:master_indikator,id',
            'satuan' => 'sometimes|string',
            'base_line' => 'nullable|string',
            'target' => 'nullable|string',
            'formula_text' => 'nullable|string',
            'sumber_data' => 'nullable|string',
            
            // targets level overrides (Menu 2)
            'target_d3' => 'nullable|string',
            'target_d4' => 'nullable|string',
            'target_s1' => 'nullable|string',
            'target_s2' => 'nullable|string',
            'target_s3' => 'nullable|string',
            'target_profesi' => 'nullable|string',
            'target_unit' => 'nullable|string',
            'target_fakultas' => 'nullable|string',
            'target_prodi' => 'nullable|string',
        ]);

        $current = DB::table('master_indikator')->where('id', $id)->first();
        if ($current) {
            $idSub = array_key_exists('id_sub', $validated) ? $validated['id_sub'] : $current->id_sub;
            $kategori = array_key_exists('kategori', $validated) ? ($validated['kategori'] ?? '') : ($current->kategori ?? '');
            $iku = isset($validated['iku']) ? $validated['iku'] : $current->iku;

            $parentIkuCode = null;
            if (!empty($idSub)) {
                $parent = DB::table('master_indikator')->where('id', $idSub)->first();
                if ($parent) {
                    $parentIkuCode = $parent->iku;
                }
            }

            $validated['full_kategori'] = $parentIkuCode 
                ? ($kategori ? $parentIkuCode . ' - ' . $kategori : $parentIkuCode)
                : ($kategori ? $iku . ' - ' . $kategori : $iku);
        }

        DB::table('master_indikator')
            ->where('id', $id)
            ->update(array_merge($validated, ['updated_at' => now()]));

        return response()->json(['message' => 'Indikator berhasil diperbarui.']);
    }

    // Delete indicator (Menu 1: Management Indikator)
    public function deleteIku(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Hanya Admin yang dapat menghapus master indikator.'], 403);
        }

        DB::table('master_indikator')->where('id', $id)->delete();
        return response()->json(['message' => 'Indikator berhasil dihapus.']);
    }

    // Fetch units from v_fakultas_unit view
    public function units(Request $request)
    {
        $data = DB::table('v_fakultas_unit')->get();
        return response()->json($data);
    }

    // Fetch unique years registered
    public function tahun(Request $request)
    {
        $data = DB::table('master_tahun')->orderBy('tahun', 'asc')->get();
        return response()->json($data);
    }
}

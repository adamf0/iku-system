<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AccountController extends Controller
{
    /**
     * Get list of user accounts with unit details
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $query = DB::table('users')
            ->leftJoin('v_fakultas_unit', 'users.fakultas_unit', '=', 'v_fakultas_unit.id')
            ->select(
                'users.id',
                'users.name',
                'users.username',
                'users.email',
                'users.role',
                'users.fakultas_unit',
                'users.is_active',
                'users.created_at',
                'v_fakultas_unit.nama_fak_prod_unit as nama_unit',
                'v_fakultas_unit.type as unit_type',
                'v_fakultas_unit.fakultas'
            );

        if ($request->filled('search')) {
            $search = '%' . trim($request->query('search')) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', $search)
                  ->orWhere('users.username', 'like', $search)
                  ->orWhere('users.email', 'like', $search)
                  ->orWhere('v_fakultas_unit.nama_fak_prod_unit', 'like', $search);
            });
        }

        if ($request->filled('role') && $request->query('role') !== 'ALL') {
            $query->where('users.role', $request->query('role'));
        }

        if ($request->filled('status') && $request->query('status') !== 'ALL') {
            $isActive = $request->query('status') === '1' || $request->query('status') === 'active' ? 1 : 0;
            $query->where('users.is_active', $isActive);
        }

        $users = $query->orderBy('users.id', 'desc')->get();

        return response()->json($users);
    }

    /**
     * Create a new user account
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => 'required|string|max:255|unique:users,username',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => 'required|string|in:ADMIN,FAKULTAS,PRODI,UNIT',
            'fakultas_unit' => 'nullable|integer|exists:sijamu_fakultas_unit,id',
            'is_active' => 'boolean',
        ]);

        if (in_array($validated['role'], ['FAKULTAS', 'PRODI', 'UNIT']) && empty($validated['fakultas_unit'])) {
            return response()->json(['error' => 'Unit Pelapor wajib dipilih untuk peran ini.'], 422);
        }

        $newUser = User::create([
            'name' => $validated['name'],
            'username' => strtolower(trim($validated['username'])),
            'email' => strtolower(trim($validated['email'])),
            'password' => Hash::make($validated['password']),
            'role' => strtoupper($validated['role']),
            'fakultas_unit' => $validated['fakultas_unit'] ?? null,
            'is_active' => $request->boolean('is_active', true),
        ]);

        return response()->json([
            'message' => 'Akun berhasil dibuat.',
            'user' => $newUser
        ]);
    }

    /**
     * Update an existing user account
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if ($user->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['error' => 'Akun tidak ditemukan.'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'username' => ['required', 'string', 'max:255', Rule::unique('users')->ignore($targetUser->id)],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($targetUser->id)],
            'password' => 'nullable|string|min:6',
            'role' => 'required|string|in:ADMIN,FAKULTAS,PRODI,UNIT',
            'fakultas_unit' => 'nullable|integer|exists:sijamu_fakultas_unit,id',
            'is_active' => 'boolean',
        ]);

        if (in_array($validated['role'], ['FAKULTAS', 'PRODI', 'UNIT']) && empty($validated['fakultas_unit'])) {
            return response()->json(['error' => 'Unit Pelapor wajib dipilih untuk peran ini.'], 422);
        }

        $updateData = [
            'name' => $validated['name'],
            'username' => strtolower(trim($validated['username'])),
            'email' => strtolower(trim($validated['email'])),
            'role' => strtoupper($validated['role']),
            'fakultas_unit' => $validated['fakultas_unit'] ?? null,
            'is_active' => $request->boolean('is_active', true),
        ];

        if ($request->filled('password')) {
            $updateData['password'] = Hash::make($request->input('password'));
        }

        $targetUser->update($updateData);

        return response()->json([
            'message' => 'Akun berhasil diperbarui.'
        ]);
    }

    /**
     * Toggle active status of user account
     */
    public function toggleStatus(Request $request, $id)
    {
        $currentUser = $request->user();
        if ($currentUser->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        if ((int)$currentUser->id === (int)$id) {
            return response()->json(['error' => 'Anda tidak dapat menonaktifkan akun Anda sendiri.'], 422);
        }

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['error' => 'Akun tidak ditemukan.'], 404);
        }

        $newStatus = !$targetUser->is_active;
        $targetUser->update(['is_active' => $newStatus]);

        $statusLabel = $newStatus ? 'diaktifkan' : 'dinonaktifkan';
        return response()->json([
            'message' => "Akun {$targetUser->username} berhasil {$statusLabel}.",
            'is_active' => $newStatus
        ]);
    }

    /**
     * Delete user account
     */
    public function destroy(Request $request, $id)
    {
        $currentUser = $request->user();
        if ($currentUser->role !== 'ADMIN') {
            return response()->json(['error' => 'Akses ditolak.'], 403);
        }

        if ((int)$currentUser->id === (int)$id) {
            return response()->json(['error' => 'Anda tidak dapat menghapus akun Anda sendiri.'], 422);
        }

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['error' => 'Akun tidak ditemukan.'], 404);
        }

        $targetUser->delete();

        return response()->json([
            'message' => 'Akun berhasil dihapus.'
        ]);
    }
}

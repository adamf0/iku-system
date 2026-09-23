<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Add is_active column to sijamu_fakultas_unit
        if (!Schema::hasColumn('sijamu_fakultas_unit', 'is_active')) {
            Schema::table('sijamu_fakultas_unit', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->after('standalone');
            });
        }

        // 2. Add is_active column to users
        if (!Schema::hasColumn('users', 'is_active')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('is_active')->default(true)->after('fakultas_unit');
            });
        }

        // 3. Re-create v_fakultas_unit database view
        DB::statement("DROP VIEW IF EXISTS v_fakultas_unit");
        try {
            DB::statement("SET collation_connection = 'utf8mb4_unicode_ci'");
        } catch (\Throwable $e) {}

        DB::statement("
            CREATE VIEW v_fakultas_unit AS 
            SELECT 
                sfu.id AS id,
                CASE 
                    WHEN sfu.standalone = 1 THEN fak.nama_fakultas 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NULL THEN prod.nama_prodi 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NOT NULL THEN sfu.nama 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NULL AND sfu.nama IS NOT NULL THEN sfu.nama 
                    ELSE COALESCE(sfu.nama, 'tidak diketahui')
                END AS nama_fak_prod_unit,
                prod.kode_jenjang AS kode_jenjang,
                CASE 
                    WHEN prod.kode_jenjang = 'C' THEN 's1' 
                    WHEN prod.kode_jenjang = 'B' THEN 's2' 
                    WHEN prod.kode_jenjang = 'A' THEN 's3' 
                    WHEN prod.kode_jenjang = 'E' THEN 'd3' 
                    WHEN prod.kode_jenjang = 'D' THEN 'd4' 
                    WHEN prod.kode_jenjang = 'J' THEN 'profesi' 
                    ELSE '' 
                END AS jenjang,
                CASE 
                    WHEN prod.kode_jenjang = 'C' THEN '1' 
                    WHEN prod.kode_jenjang = 'B' THEN '2' 
                    WHEN prod.kode_jenjang = 'A' THEN '3' 
                    WHEN prod.kode_jenjang = 'E' THEN '4' 
                    WHEN prod.kode_jenjang = 'D' THEN '5' 
                    WHEN prod.kode_jenjang = 'J' THEN '6' 
                    ELSE '7' 
                END AS jenjang_int,
                CASE 
                    WHEN sfu.standalone = 1 THEN 'fakultas' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NULL THEN 'prodi' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NOT NULL THEN 'prodi' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NULL AND sfu.nama IS NOT NULL THEN 'unit' 
                    ELSE 'unit'
                END AS type,
                CASE 
                    WHEN sfu.standalone = 1 THEN fak.nama_fakultas 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL THEN fak.nama_fakultas 
                    ELSE NULL 
                END AS fakultas,
                sfu.is_active AS is_active,
                sfu.kode_fakultas AS kode_fakultas,
                sfu.kode_prodi AS kode_prodi,
                sfu.nama AS nama_custom,
                sfu.standalone AS standalone
            FROM sijamu_fakultas_unit sfu
            LEFT JOIN m_fakultas fak ON sfu.kode_fakultas = fak.kode_fakultas
            LEFT JOIN m_program_studi prod ON sfu.kode_prodi = prod.kode_prodi
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("DROP VIEW IF EXISTS v_fakultas_unit");

        // Revert v_fakultas_unit to original definition
        DB::statement("
            CREATE VIEW v_fakultas_unit AS 
            SELECT 
                sfu.id AS id,
                CASE 
                    WHEN sfu.standalone = 1 THEN fak.nama_fakultas 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NULL THEN prod.nama_prodi 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NOT NULL THEN sfu.nama 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NULL AND sfu.nama IS NOT NULL THEN sfu.nama 
                    ELSE 'tidak diketahui' 
                END AS nama_fak_prod_unit,
                prod.kode_jenjang AS kode_jenjang,
                CASE 
                    WHEN prod.kode_jenjang = 'C' THEN 's1' 
                    WHEN prod.kode_jenjang = 'B' THEN '2' 
                    WHEN prod.kode_jenjang = 'A' THEN 's3' 
                    WHEN prod.kode_jenjang = 'E' THEN 'd3' 
                    WHEN prod.kode_jenjang = 'D' THEN 'd4' 
                    WHEN prod.kode_jenjang = 'J' THEN 'profesi' 
                    ELSE '' 
                END AS jenjang,
                CASE 
                    WHEN prod.kode_jenjang = 'C' THEN '1' 
                    WHEN prod.kode_jenjang = 'B' THEN '2' 
                    WHEN prod.kode_jenjang = 'A' THEN '3' 
                    WHEN prod.kode_jenjang = 'E' THEN '4' 
                    WHEN prod.kode_jenjang = 'D' THEN '5' 
                    WHEN prod.kode_jenjang = 'J' THEN '6' 
                    ELSE '7' 
                END AS jenjang_int,
                CASE 
                    WHEN sfu.standalone = 1 THEN 'fakultas' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NULL THEN 'prodi' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL AND sfu.nama IS NOT NULL THEN 'prodi' 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NULL AND sfu.nama IS NOT NULL THEN 'unit' 
                END AS type,
                CASE 
                    WHEN sfu.standalone = 1 THEN fak.nama_fakultas 
                    WHEN sfu.kode_fakultas IS NOT NULL AND sfu.kode_prodi IS NOT NULL THEN fak.nama_fakultas 
                    ELSE NULL 
                END AS fakultas 
            FROM sijamu_fakultas_unit sfu
            LEFT JOIN m_fakultas fak ON sfu.kode_fakultas = fak.kode_fakultas
            LEFT JOIN m_program_studi prod ON sfu.kode_prodi = prod.kode_prodi
        ");

        if (Schema::hasColumn('users', 'is_active')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }

        if (Schema::hasColumn('sijamu_fakultas_unit', 'is_active')) {
            Schema::table('sijamu_fakultas_unit', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }
    }
};

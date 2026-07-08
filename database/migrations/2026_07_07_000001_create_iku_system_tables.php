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
        // 1. Create Base Tables for v_fakultas_unit view
        Schema::create('m_fakultas', function (Blueprint $table) {
            $table->string('kode_fakultas', 9)->primary();
            $table->string('kode_pt', 10)->nullable();
            $table->string('nama_fakultas', 100);
            $table->string('pejabat', 50)->nullable();
            $table->string('jabatan', 1)->nullable();
            $table->string('wakil_pejabat', 50)->nullable();
            $table->string('wakil_pejabat_adm', 50)->nullable();
            $table->string('logo', 50)->nullable();
            $table->timestamps();
        });

        Schema::create('m_program_studi', function (Blueprint $table) {
            $table->string('kode_prodi', 10)->primary();
            $table->string('kode_pt', 10)->nullable();
            $table->string('kode_fak', 9)->nullable();
            $table->string('kode_jenjang', 1)->nullable();
            $table->string('kode_jurusan', 5)->nullable();
            $table->string('nama_prodi', 100);
            $table->string('alamat', 100)->nullable();
            $table->integer('kode_kabupaten')->nullable();
            $table->integer('kode_propinsi')->nullable();
            $table->integer('kode_negara')->nullable();
            $table->string('kode_pos', 10)->nullable();
            $table->string('telepon', 20)->nullable();
            $table->string('fax', 20)->nullable();
            $table->string('email', 50)->nullable();
            $table->string('website', 50)->nullable();
            $table->integer('sks_lulus')->nullable();
            $table->string('status_prodi', 1)->nullable();
            $table->date('tgl_awal_berdiri')->nullable();
            $table->string('semester_awal', 5)->nullable();
            $table->string('mulai_semester', 5)->nullable();
            $table->string('no_sk_dikti', 40)->nullable();
            $table->date('tgl_sk_dikti')->nullable();
            $table->date('tgl_akhir_sk_dikti')->nullable();
            $table->string('no_sk_ban', 40)->nullable();
            $table->date('tgl_sk_ban')->nullable();
            $table->date('tgl_akhir_sk_ban')->nullable();
            $table->string('kode_akreditasi', 1)->nullable();
            $table->string('frekuensi_kurikulum', 1)->nullable();
            $table->string('pelaksanaan_kurikulum', 1)->nullable();
            $table->string('idd_ketua_prodi', 50)->nullable();
            $table->string('hp_ketua', 20)->nullable();
            $table->string('idd_nama_operator', 50)->nullable();
            $table->string('telepon_operator', 20)->nullable();
            $table->string('nama_sesi', 20)->nullable();
            $table->integer('jumlah_sesi')->nullable();
            $table->integer('batas_sesi')->nullable();
            $table->string('gelar', 20)->nullable();
            $table->string('gelar_panjang', 200)->nullable();
            $table->string('no_sk_ban_lama', 40)->nullable();
            $table->string('logo', 50)->nullable();
            $table->string('nama_prodi_ing', 50)->nullable();
            $table->timestamps();
        });

        Schema::create('sijamu_fakultas_unit', function (Blueprint $table) {
            $table->id(); // Auto increment ID
            $table->string('kode_fakultas', 9)->nullable();
            $table->string('kode_prodi', 10)->nullable();
            $table->string('nama', 100)->nullable();
            $table->integer('id_m_prodi')->nullable();
            $table->boolean('standalone')->default(false);
            $table->timestamps();
        });

        // 2. Create the v_fakultas_unit database view
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

        // 3. Create IKU Master Tables
        Schema::create('master_konteks', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->timestamps();
        });

        Schema::create('master_indikator', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_konteks');
            $table->string('iku'); // e.g. "IKU 1", "Sub IKU 1.1", "-"
            $table->text('kategori'); // Description of indicator
            $table->unsignedBigInteger('id_sub')->nullable(); // Self-referencing parent
            $table->text('full_kategori')->nullable();
            $table->string('satuan');
            $table->string('base_line')->nullable();
            $table->string('target')->nullable();
            
            // Formula & Sumber Data
            $table->text('formula_text')->nullable();
            $table->text('sumber_data')->nullable();
            
            // Targets level configurations
            $table->string('target_d3')->nullable();
            $table->string('target_d4')->nullable();
            $table->string('target_s1')->nullable();
            $table->string('target_s2')->nullable();
            $table->string('target_s3')->nullable();
            $table->string('target_profesi')->nullable();
            $table->string('target_unit')->nullable();
            $table->string('target_fakultas')->nullable();
            $table->string('target_prodi')->nullable();
            
            $table->timestamps();

            $table->foreign('id_konteks')->references('id')->on('master_konteks')->onDelete('cascade');
            $table->foreign('id_sub')->references('id')->on('master_indikator')->onDelete('cascade');
        });

        // 4. Create Master Tahun Table
        Schema::create('master_tahun', function (Blueprint $table) {
            $table->integer('tahun')->primary();
            $table->timestamps();
        });

        // 5. Create Penugasan Capaian Target table
        Schema::create('penugasan_target', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fakultas_unit'); // References sijamu_fakultas_unit.id
            $table->unsignedBigInteger('id_indikator'); // References master_indikator.id
            $table->integer('tahun');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['fakultas_unit', 'id_indikator', 'tahun']);
            $table->foreign('fakultas_unit')->references('id')->on('sijamu_fakultas_unit')->onDelete('cascade');
            $table->foreign('id_indikator')->references('id')->on('master_indikator')->onDelete('cascade');
            $table->foreign('tahun')->references('tahun')->on('master_tahun')->onDelete('cascade');
        });

        // 6. Create Template Capaian table
        Schema::create('template_capaian', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_indikator');
            $table->unsignedBigInteger('fakultas_unit'); // References sijamu_fakultas_unit.id
            $table->integer('tahun');
            $table->string('triwulan'); // TW1, TW2, TW3, TW4 (screenshot style)
            $table->decimal('pembilang', 12, 2)->default(0);
            $table->decimal('penyebut', 12, 2)->default(1);
            $table->decimal('nilai_capaian', 8, 2)->default(0);
            $table->text('catatan')->nullable();
            $table->string('file_url')->nullable();
            
            $table->string('status_validasi')->default('DRAFT'); // DRAFT, DIAJUKAN, DIVERIFIKASI, DISAHKAN, DITOLAK
            $table->text('alasan_penolakan')->nullable();
            $table->string('diinput_oleh')->nullable();
            $table->string('diverifikasi_oleh')->nullable();
            $table->timestamps();

            $table->foreign('id_indikator')->references('id')->on('master_indikator')->onDelete('cascade');
            $table->foreign('fakultas_unit')->references('id')->on('sijamu_fakultas_unit')->onDelete('cascade');
            $table->foreign('tahun')->references('tahun')->on('master_tahun')->onDelete('cascade');
        });

        // 7. Create Activity Log table
        Schema::create('log_aktivitas', function (Blueprint $table) {
            $table->id();
            $table->string('username');
            $table->string('aksi');
            $table->text('detail');
            $table->timestamp('tanggal')->useCurrent();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('log_aktivitas');
        Schema::dropIfExists('template_capaian');
        Schema::dropIfExists('penugasan_target');
        Schema::dropIfExists('master_tahun');
        Schema::dropIfExists('master_indikator');
        Schema::dropIfExists('master_konteks');
        
        // Drop the view and base tables
        DB::statement("DROP VIEW IF EXISTS v_fakultas_unit");
        Schema::dropIfExists('sijamu_fakultas_unit');
        Schema::dropIfExists('m_program_studi');
        Schema::dropIfExists('m_fakultas');
    }
};

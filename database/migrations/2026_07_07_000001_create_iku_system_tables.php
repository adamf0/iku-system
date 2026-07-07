<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->string('kode_unit')->primary();
            $table->string('nama_unit');
            $table->string('jenjang'); // INSTITUSI, FAKULTAS, PRODI, UNIT_KERJA
            $table->string('unit_induk')->nullable();
            $table->timestamps();
        });

        Schema::create('master_konteks', function (Blueprint $table) {
            $table->id();
            $table->string('nama');
            $table->timestamps();
        });

        Schema::create('master_indikator', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_konteks');
            $table->string('iku'); // e.g. "iku 1", "sub iku 1.1", "-"
            $table->text('kategori'); // Description of indicator
            $table->unsignedBigInteger('id_sub')->nullable(); // Self-referencing parent
            $table->text('full_kategori')->nullable();
            $table->string('satuan');
            $table->string('base_line')->nullable();
            $table->string('target')->nullable();
            
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

        Schema::create('template_capaian', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_indikator');
            $table->string('kode_unit');
            $table->integer('tahun');
            $table->string('triwulan'); // Q1, Q2, Q3, Q4
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
            $table->foreign('kode_unit')->references('kode_unit')->on('units')->onDelete('cascade');
        });

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
        Schema::dropIfExists('master_indikator');
        Schema::dropIfExists('master_konteks');
        Schema::dropIfExists('units');
    }
};

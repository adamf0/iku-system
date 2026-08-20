<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('target_indikator_tahun')) {
            Schema::create('target_indikator_tahun', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('id_indikator');
                $table->integer('tahun')->default(2026);
                $table->string('base_line')->nullable();
                $table->string('target')->nullable();
                $table->string('target_d3')->nullable();
                $table->string('target_d4')->nullable();
                $table->string('target_s1')->nullable();
                $table->string('target_s2')->nullable();
                $table->string('target_s3')->nullable();
                $table->string('target_profesi')->nullable();
                $table->string('target_unit')->nullable();
                $table->string('target_fakultas')->nullable();
                $table->string('target_prodi')->nullable();
                $table->text('catatan_justifikasi')->nullable();
                $table->string('file_justifikasi')->nullable();
                $table->timestamps();

                $table->unique(['id_indikator', 'tahun']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('target_indikator_tahun');
    }
};

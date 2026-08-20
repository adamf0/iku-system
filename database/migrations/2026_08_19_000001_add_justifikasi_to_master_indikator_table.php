<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('master_indikator', function (Blueprint $table) {
            if (!Schema::hasColumn('master_indikator', 'catatan_justifikasi')) {
                $table->text('catatan_justifikasi')->nullable()->after('target_prodi');
            }
            if (!Schema::hasColumn('master_indikator', 'file_justifikasi')) {
                $table->string('file_justifikasi')->nullable()->after('catatan_justifikasi');
            }
        });
    }

    public function down(): void
    {
        Schema::table('master_indikator', function (Blueprint $table) {
            $table->dropColumn(['catatan_justifikasi', 'file_justifikasi']);
        });
    }
};

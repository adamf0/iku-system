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
        if (!Schema::hasColumn('master_indikator', 'file_berkas')) {
            Schema::table('master_indikator', function (Blueprint $table) {
                $table->string('file_berkas', 500)->nullable()->after('sumber_data');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('master_indikator', 'file_berkas')) {
            Schema::table('master_indikator', function (Blueprint $table) {
                $table->dropColumn('file_berkas');
            });
        }
    }
};

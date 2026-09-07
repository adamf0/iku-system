<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Services\GoogleDriveService;

class UploadGdriveCommand extends Command
{
    protected $signature = 'iku:upload-gdrive {--tahun= : Tahun spesifik untuk upload}';
    protected $description = 'Upload file Excel capaian IKU yang tersimpan di storage lokal ke Google Drive';

    public function handle()
    {
        $tahunParam = $this->option('tahun');
        $tempDir = storage_path('app/temp');

        if (!is_dir($tempDir)) {
            $this->info("Folder temporary {$tempDir} tidak ditemukan.");
            return;
        }

        $files = glob("{$tempDir}/simak_*.xlsx");
        if (empty($files)) {
            $this->info("Tidak ada file Excel pending di storage/app/temp/ untuk diupload.");
            return;
        }

        $driveService = new GoogleDriveService();
        $this->info("Ditemukan " . count($files) . " file Excel pending. Memulai upload ke Google Drive...");

        $uploadedCount = 0;
        foreach ($files as $filePath) {
            $basename = basename($filePath, '.xlsx');
            // Format file: simak_{tahun}_{tw}_{indId}.xlsx
            $parts = explode('_', $basename);
            if (count($parts) < 4) continue;

            $tahun = $parts[1];
            $tw = $parts[2];
            $indId = $parts[3];

            if ($tahunParam && $tahun != $tahunParam) {
                continue;
            }

            $yearFolderId = $driveService->findFolder((string)$tahun);
            if (!$yearFolderId) {
                $driveService->ensureYearFolderStructure($tahun);
                $yearFolderId = $driveService->findFolder((string)$tahun);
            }

            $twFolderId = $yearFolderId ? $driveService->findFolder($tw, $yearFolderId) : null;
            if (!$twFolderId) continue;

            $indObj = DB::table('master_indikator')->where('id', $indId)->first();
            $indikatorName = $indObj ? $indObj->iku : 'IKU 1';
            $fileName = "{$indikatorName}.xlsx";
            $ikuFolderId = $driveService->findFolder($indikatorName, $twFolderId);
            if (!$ikuFolderId) {
                $ikuFolderId = $driveService->createFolder($indikatorName, $twFolderId);
            }
            $targetParentId = $ikuFolderId ?: $twFolderId;

            $this->line(" -> Uploading: {$fileName} (Tahun {$tahun}, {$tw} -> {$indikatorName})...");
            $fileUrl = $driveService->uploadFile($filePath, $fileName, $targetParentId);

            if ($fileUrl) {
                DB::table('template_capaian')
                    ->where('id_indikator', $indId)
                    ->where('tahun', $tahun)
                    ->where('triwulan', $tw)
                    ->update([
                        'file_url' => $fileUrl,
                        'updated_at' => now(),
                    ]);

                @unlink($filePath);
                $uploadedCount++;
                $this->info("    [OK] Uploaded: {$fileUrl}");
            } else {
                $this->warn("    [FAIL] Gagal upload {$fileName}");
            }
        }

        $this->info("Proses upload ke Google Drive selesai. Total file diupload: {$uploadedCount}");
    }
}

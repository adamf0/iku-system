<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\GoogleDriveService;

class ProcessGdriveFolderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $unitId;
    protected $tahun;
    protected $indicatorId;

    public function __construct($unitId = null, $tahun = null, $indicatorId = null)
    {
        $this->unitId = $unitId ? (int)$unitId : null;
        $this->tahun = $tahun ? (int)$tahun : null;
        $this->indicatorId = $indicatorId ? (int)$indicatorId : null;
    }

    public function handle()
    {
        $query = DB::table('gdrive_folder_logs');

        if ($this->unitId) {
            $query->where('fakultas_unit', $this->unitId);
        }
        if ($this->tahun) {
            $query->where('tahun', $this->tahun);
        }
        if ($this->indicatorId) {
            $query->where('id_indikator', $this->indicatorId);
        } else {
            $query->whereIn('status', ['WAITING', 'FAILED']);
        }

        $logs = $query->get();
        if ($logs->isEmpty()) {
            return;
        }

        $driveService = new GoogleDriveService();
        $twList = GoogleDriveService::defaultTwList();

        foreach ($logs as $log) {
            $uId = $log->fakultas_unit;
            $yr = $log->tahun;
            $indId = $log->id_indikator;
            $history = json_decode($log->history ?? '[]', true) ?: [];

            try {
                $firstUrl = null;
                foreach ($twList as $tw) {
                    $url = $driveService->getOrCreateUnitFolderUrl($yr, $tw, $uId, $indId);
                    if ($url && !$firstUrl) {
                        $firstUrl = $url;
                    }
                }

                if ($firstUrl) {
                    $history[] = [
                        'status' => 'CREATED',
                        'timestamp' => now()->format('Y-m-d H:i:s'),
                        'note' => 'Folder unit berhasil dibuat / ditemukan di Google Drive'
                    ];

                    DB::table('gdrive_folder_logs')
                        ->where('id', $log->id)
                        ->update([
                            'status' => 'CREATED',
                            'folder_url' => $firstUrl,
                            'error_message' => null,
                            'history' => json_encode($history),
                            'updated_at' => now()
                        ]);
                } else {
                    throw new \Exception("Google Drive service returned null URL.");
                }
            } catch (\Throwable $e) {
                Log::error("Gdrive folder creation failed for unit {$uId}, year {$yr}, ind {$indId}: " . $e->getMessage());

                $history[] = [
                    'status' => 'FAILED',
                    'timestamp' => now()->format('Y-m-d H:i:s'),
                    'note' => 'Gagal: ' . $e->getMessage()
                ];

                DB::table('gdrive_folder_logs')
                    ->where('id', $log->id)
                    ->update([
                        'status' => 'FAILED',
                        'error_message' => $e->getMessage(),
                        'history' => json_encode($history),
                        'updated_at' => now()
                    ]);
            }
        }
    }
}

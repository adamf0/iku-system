<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ExportTwZipService
{
    protected $storageDir;
    protected $chunkSize;

    public function __construct()
    {
        $this->storageDir = storage_path('app/exports');
        if (!file_exists($this->storageDir)) {
            @mkdir($this->storageDir, 0777, true);
        }
        $this->chunkSize = 5 * 1024 * 1024; // 5 MB per chunk
    }

    /**
     * Clean up export zip and json files older than 24 hours
     */
    public function cleanUpOldExports()
    {
        try {
            $files = glob($this->storageDir . '/*');
            $now = time();
            foreach ($files as $file) {
                if (is_file($file) && ($now - filemtime($file) > 86400)) {
                    @unlink($file);
                }
            }
        } catch (\Throwable $e) {
            // Ignore cleanup errors
        }
    }

    /**
     * Check if a recent export job exists for this TW and year
     */
    public function findRecentJob($tw, $tahun)
    {
        $tw = strtoupper(trim($tw));
        $tahun = (string)$tahun;

        $files = glob($this->storageDir . '/*.json');
        $now = time();

        foreach ($files as $file) {
            $content = @file_get_contents($file);
            if (!$content) continue;
            $data = json_decode($content, true);
            if (!$data) continue;

            if (($data['tw'] ?? '') === $tw && (string)($data['tahun'] ?? '') === $tahun) {
                $updatedAt = $data['updated_at'] ?? 0;
                $status = $data['status'] ?? '';

                // If completed within last 3 hours and zip file exists
                if ($status === 'completed' && ($now - $updatedAt < 10800)) {
                    $zipPath = $this->storageDir . '/' . $data['job_id'] . '.zip';
                    if (file_exists($zipPath) && filesize($zipPath) > 0) {
                        return $data;
                    }
                }

                // If currently processing and active within last 2 minutes
                if ($status === 'processing' && ($now - $updatedAt < 120)) {
                    return $data;
                }
            }
        }

        return null;
    }

    /**
     * Initialize a new export job
     */
    public function createJob($tw, $tahun)
    {
        $this->cleanUpOldExports();

        $tw = strtoupper(trim($tw));
        $tahun = (string)$tahun;
        $jobId = 'export_' . $tw . '_' . $tahun . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3));
        $zipFilename = "IKU_System_{$tw}_{$tahun}.zip";

        $initialData = [
            'job_id' => $jobId,
            'tw' => $tw,
            'tahun' => $tahun,
            'status' => 'processing',
            'progress' => 5,
            'message' => 'Menyiapkan proses ekspor berkas...',
            'file_size' => 0,
            'chunk_size' => $this->chunkSize,
            'total_chunks' => 0,
            'zip_filename' => $zipFilename,
            'error' => null,
            'created_at' => time(),
            'updated_at' => time()
        ];

        $jsonPath = $this->storageDir . '/' . $jobId . '.json';
        file_put_contents($jsonPath, json_encode($initialData, JSON_PRETTY_PRINT));

        return $jobId;
    }

    /**
     * Get job status
     */
    public function getStatus($jobId)
    {
        $jsonPath = $this->storageDir . '/' . $jobId . '.json';
        if (!file_exists($jsonPath)) {
            return null;
        }

        $content = @file_get_contents($jsonPath);
        return $content ? json_decode($content, true) : null;
    }

    /**
     * Update job progress
     */
    public function updateProgress($jobId, array $data)
    {
        $jsonPath = $this->storageDir . '/' . $jobId . '.json';
        $current = $this->getStatus($jobId) ?: [];

        $merged = array_merge($current, $data, [
            'updated_at' => time()
        ]);

        @file_put_contents($jsonPath, json_encode($merged, JSON_PRETTY_PRINT));
        return $merged;
    }

    /**
     * Find PHP CLI binary path
     */
    protected function findPhpCli()
    {
        if (defined('PHP_BINARY') && PHP_BINARY) {
            $bin = PHP_BINARY;
            if (!str_contains($bin, 'fpm') && !str_contains($bin, 'cgi')) {
                return $bin;
            }
        }

        $candidates = [
            '/Applications/XAMPP/xamppfiles/bin/php',
            '/usr/local/bin/php',
            '/usr/bin/php',
            'php'
        ];

        foreach ($candidates as $candidate) {
            if ($candidate === 'php' || file_exists($candidate)) {
                return $candidate;
            }
        }

        return 'php';
    }

    /**
     * Dispatch job to background process
     */
    public function dispatchJob($jobId)
    {
        $php = $this->findPhpCli();
        $artisan = base_path('artisan');

        $cmd = escapeshellcmd($php) . ' ' . escapeshellarg($artisan) . ' iku:export-tw-zip ' . escapeshellarg($jobId) . ' > /dev/null 2>&1 &';

        if (function_exists('exec')) {
            @exec($cmd);
        }

        // Also try Laravel queue if worker is listening
        try {
            \App\Jobs\ExportTwZipJob::dispatch($jobId);
        } catch (\Throwable $e) {
            // Queue table or worker not ready, CLI fallback handles it
        }
    }

    /**
     * Extract Google Drive ID from any URL format
     */
    public function extractGdriveId($url)
    {
        if (empty($url)) return null;

        if (preg_match('/\/folders\/([a-zA-Z0-9_-]+)/', $url, $m)) {
            return $m[1];
        }
        if (preg_match('/\/d\/([a-zA-Z0-9_-]+)/', $url, $m)) {
            return $m[1];
        }
        if (preg_match('/[?&]id=([a-zA-Z0-9_-]+)/', $url, $m)) {
            return $m[1];
        }
        if (preg_match('/^[a-zA-Z0-9_-]{25,}$/', trim($url))) {
            return trim($url);
        }
        return null;
    }

    /**
     * Make Google Drive cURL request with automatic 401 token refresh
     */
    public function executeDriveCurl($url, &$accessToken, GoogleDriveService $driveService)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 60);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 401) {
            $accessToken = $driveService->refreshAccessToken(true);
            if ($accessToken) {
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
                curl_setopt($ch, CURLOPT_TIMEOUT, 60);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
                $res = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
            }
        } elseif ($httpCode === 429 || $httpCode === 503) {
            sleep(1);
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
            curl_setopt($ch, CURLOPT_TIMEOUT, 60);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
            $res = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return $res;
        }

        Log::warning("Drive API request failed ({$httpCode}) for URL: {$url}");
        return false;
    }

    /**
     * Prepare download or export URL for Google Workspace or binary files
     */
    public function prepareDriveDownloadUrl($fileId, $mimeType, $fileName)
    {
        if (str_contains($mimeType, 'google-apps.spreadsheet')) {
            $url = "https://www.googleapis.com/drive/v3/files/{$fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            if (!preg_match('/\.(xlsx|xls)$/i', $fileName)) {
                $fileName .= '.xlsx';
            }
        } elseif (str_contains($mimeType, 'google-apps.document')) {
            $url = "https://www.googleapis.com/drive/v3/files/{$fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (!preg_match('/\.(docx|doc)$/i', $fileName)) {
                $fileName .= '.docx';
            }
        } elseif (str_contains($mimeType, 'google-apps.presentation')) {
            $url = "https://www.googleapis.com/drive/v3/files/{$fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.presentationml.presentation";
            if (!preg_match('/\.(pptx|ppt)$/i', $fileName)) {
                $fileName .= '.pptx';
            }
        } else {
            $url = "https://www.googleapis.com/drive/v3/files/{$fileId}?alt=media";
        }

        return [
            'url' => $url,
            'fileName' => $fileName,
        ];
    }

    /**
     * Recursively traverse Google Drive folder and add all directories & files to ZIP
     */
    public function downloadDriveFolderRecursively(
        $folderId,
        \ZipArchive $zip,
        $zipPathPrefix,
        &$accessToken,
        GoogleDriveService $driveService,
        array &$visitedFolderIds,
        array &$visitedFiles,
        $maxDepth = 6,
        $currentDepth = 0,
        $jobId = null
    ) {
        if (empty($folderId) || $currentDepth > $maxDepth || isset($visitedFolderIds[$folderId])) {
            return;
        }
        $visitedFolderIds[$folderId] = true;

        $cleanPrefix = trim($zipPathPrefix, '/');
        if ($cleanPrefix !== '') {
            $zip->addEmptyDir($cleanPrefix);
        }

        $pageToken = null;
        do {
            $escapedFolderId = str_replace("'", "\\'", $folderId);
            $q = urlencode("'{$escapedFolderId}' in parents and trashed = false");
            $url = "https://www.googleapis.com/drive/v3/files?q={$q}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)";
            if ($pageToken) {
                $url .= "&pageToken=" . urlencode($pageToken);
            }

            $res = $this->executeDriveCurl($url, $accessToken, $driveService);
            if (!$res) break;

            $data = json_decode($res, true);
            $files = $data['files'] ?? [];

            foreach ($files as $item) {
                $itemId = $item['id'] ?? null;
                $itemName = $item['name'] ?? '';
                $mimeType = $item['mimeType'] ?? '';

                if (!$itemId || $itemName === '') continue;

                // Handle Google Drive shortcut
                if ($mimeType === 'application/vnd.google-apps.shortcut' && !empty($item['shortcutDetails'])) {
                    $itemId = $item['shortcutDetails']['targetId'] ?? $itemId;
                    $mimeType = $item['shortcutDetails']['targetMimeType'] ?? $mimeType;
                }

                $safeName = str_replace(['/', '\\'], '-', $itemName);
                $safeName = trim(preg_replace('/[\x00-\x1F\x7F]/', '', $safeName));
                if ($safeName === '') {
                    $safeName = 'item_' . $itemId;
                }

                if ($mimeType === 'application/vnd.google-apps.folder') {
                    $subPrefix = $cleanPrefix !== '' ? "{$cleanPrefix}/{$safeName}" : $safeName;
                    $this->downloadDriveFolderRecursively(
                        $itemId,
                        $zip,
                        $subPrefix,
                        $accessToken,
                        $driveService,
                        $visitedFolderIds,
                        $visitedFiles,
                        $maxDepth,
                        $currentDepth + 1,
                        $jobId
                    );
                } else {
                    $downloadInfo = $this->prepareDriveDownloadUrl($itemId, $mimeType, $safeName);
                    $fileZipPath = $cleanPrefix !== '' ? "{$cleanPrefix}/{$downloadInfo['fileName']}" : $downloadInfo['fileName'];

                    if (isset($visitedFiles[$fileZipPath])) {
                        $pathInfo = pathinfo($downloadInfo['fileName']);
                        $base = $pathInfo['filename'] ?? 'file';
                        $ext = !empty($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';
                        $counter = 1;
                        do {
                            $uniqueName = "{$base}_{$counter}{$ext}";
                            $fileZipPath = $cleanPrefix !== '' ? "{$cleanPrefix}/{$uniqueName}" : $uniqueName;
                            $counter++;
                        } while (isset($visitedFiles[$fileZipPath]));
                    }
                    $visitedFiles[$fileZipPath] = true;

                    $content = $this->executeDriveCurl($downloadInfo['url'], $accessToken, $driveService);
                    if ($content !== false && $content !== null) {
                        $zip->addFromString($fileZipPath, $content);
                        unset($content);
                    }
                }
            }

            $pageToken = $data['nextPageToken'] ?? null;
        } while ($pageToken);
    }

    /**
     * Main background runner for the export job
     */
    public function runExport($jobId)
    {
        $statusData = $this->getStatus($jobId);
        if (!$statusData) {
            Log::error("Export job not found: {$jobId}");
            return false;
        }

        if (($statusData['status'] ?? '') === 'completed') {
            return true;
        }

        // Prevent parallel execution of the same job with a cache lock
        $lockKey = "export_lock_{$jobId}";
        $lock = Cache::lock($lockKey, 1800);

        if (!$lock->get()) {
            Log::info("Export job {$jobId} is already running in another process.");
            return true;
        }

        @ini_set('memory_limit', '1024M');
        @set_time_limit(0);

        try {
            $tw = $statusData['tw'];
            $tahun = $statusData['tahun'];
            $parentFolderId = config('services.google.parent_folder_id', '1T1W4rzlCHZUa8VYQ7qCbij7aRPyuJtNf');

            $this->updateProgress($jobId, [
                'status' => 'processing',
                'progress' => 8,
                'message' => 'Menghubungkan ke layanan Google Drive...'
            ]);

            $driveService = new GoogleDriveService();
            $accessToken = $driveService->getAccessToken();

            if (!$accessToken) {
                throw new \Exception("Token akses Google Drive belum terotentikasi. Silakan otentikasi akun Google Drive terlebih dahulu.");
            }

            // 1. Resolve Year Folder
            $this->updateProgress($jobId, [
                'progress' => 12,
                'message' => "Mencari folder Tahun {$tahun} di Google Drive..."
            ]);

            $yearFolderId = $driveService->findFolder((string)$tahun, $parentFolderId);
            if (!$yearFolderId) {
                $escapedTahun = str_replace("'", "\\'", (string)$tahun);
                $urlYear = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("name = '{$escapedTahun}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
                $resYear = $this->executeDriveCurl($urlYear, $accessToken, $driveService);
                if ($resYear) {
                    $dataYear = json_decode($resYear, true);
                    $yearFolderId = $dataYear['files'][0]['id'] ?? null;
                }
            }

            // 2. Resolve TW Folder
            preg_match('/(\d+)/', (string)$tw, $mTw);
            $twNum = $mTw[1] ?? '1';

            $twCandidates = [
                $tw,
                "TW{$twNum}",
                "TW {$twNum}",
                "Triwulan {$twNum}",
                "Triwulan{$twNum}",
            ];
            $twCandidates = array_unique(array_filter($twCandidates));

            $this->updateProgress($jobId, [
                'progress' => 16,
                'message' => "Mencari folder Triwulan {$tw} ({$tahun})..."
            ]);

            $twFolderId = null;
            $searchParents = array_filter([$yearFolderId, $parentFolderId]);

            foreach ($searchParents as $pId) {
                foreach ($twCandidates as $candidate) {
                    $twFolderId = $driveService->findFolder($candidate, $pId);
                    if ($twFolderId) break 2;
                }

                $childFolders = $driveService->listChildFoldersMap($pId);
                foreach ($childFolders as $cName => $cId) {
                    preg_match('/(\d+)/', $cName, $cm);
                    if (($cm[1] ?? null) === $twNum) {
                        $twFolderId = $cId;
                        break 2;
                    }
                }
            }

            if (!$twFolderId) {
                foreach ($twCandidates as $candidate) {
                    $escapedCand = str_replace("'", "\\'", $candidate);
                    $urlTwG = "https://www.googleapis.com/drive/v3/files?q=" . urlencode("name = '{$escapedCand}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
                    $resTwG = $this->executeDriveCurl($urlTwG, $accessToken, $driveService);
                    if ($resTwG) {
                        $dataTwG = json_decode($resTwG, true);
                        if (!empty($dataTwG['files'][0]['id'])) {
                            $twFolderId = $dataTwG['files'][0]['id'];
                            break;
                        }
                    }
                }
            }

            // 3. Initialize ZIP Archive
            $zipPath = $this->storageDir . '/' . $jobId . '.zip';
            $zip = new \ZipArchive();

            if ($zip->open($zipPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
                throw new \Exception("Gagal membuat berkas arsip ZIP di server.");
            }

            $baseDirName = "{$tw}-{$tahun}";

            // Pre-create all standard IKU folders in ZIP
            $allIkus = DB::table('master_indikator')->orderBy('id', 'asc')->get();
            $ikuNormalizedMap = [];
            foreach ($allIkus as $iku) {
                $folderName = trim($iku->iku);
                $zip->addEmptyDir("{$baseDirName}/{$folderName}");
                $norm = strtolower(preg_replace('/\s+/', ' ', $folderName));
                $ikuNormalizedMap[$norm] = $folderName;
            }

            $visitedFolderIds = [];
            $visitedFiles = [];

            // 4. Recursive traversal from Google Drive TW Folder
            if ($twFolderId) {
                $visitedFolderIds[$twFolderId] = true;

                $this->updateProgress($jobId, [
                    'progress' => 20,
                    'message' => "Membaca struktur folder di dalam Google Drive {$tw}..."
                ]);

                $pageToken = null;
                $twItems = [];

                do {
                    $escapedTwId = str_replace("'", "\\'", $twFolderId);
                    $q = urlencode("'{$escapedTwId}' in parents and trashed = false");
                    $urlSub = "https://www.googleapis.com/drive/v3/files?q={$q}&pageSize=1000&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)";
                    if ($pageToken) {
                        $urlSub .= "&pageToken=" . urlencode($pageToken);
                    }

                    $resSub = $this->executeDriveCurl($urlSub, $accessToken, $driveService);
                    if (!$resSub) break;

                    $subData = json_decode($resSub, true);
                    foreach ($subData['files'] ?? [] as $subItem) {
                        $twItems[] = $subItem;
                    }

                    $pageToken = $subData['nextPageToken'] ?? null;
                } while ($pageToken);

                $totalItems = count($twItems);
                $itemIndex = 0;

                foreach ($twItems as $subItem) {
                    $itemIndex++;
                    $subId = $subItem['id'] ?? null;
                    $subName = trim($subItem['name'] ?? '');
                    $subMime = $subItem['mimeType'] ?? '';

                    if (!$subId || $subName === '') continue;

                    if ($subMime === 'application/vnd.google-apps.shortcut' && !empty($subItem['shortcutDetails'])) {
                        $subId = $subItem['shortcutDetails']['targetId'] ?? $subId;
                        $subMime = $subItem['shortcutDetails']['targetMimeType'] ?? $subMime;
                    }

                    // Progress calculation (20% to 85%)
                    $stepPercent = 20 + (int)round(($itemIndex / max(1, $totalItems)) * 65);
                    $this->updateProgress($jobId, [
                        'progress' => min(85, $stepPercent),
                        'message' => "Mengunduh berkas folder: {$subName}..."
                    ]);

                    if ($subMime === 'application/vnd.google-apps.folder') {
                        $normSub = strtolower(preg_replace('/\s+/', ' ', $subName));
                        $canonicalIku = $ikuNormalizedMap[$normSub] ?? $subName;
                        $ikuZipPrefix = "{$baseDirName}/{$canonicalIku}";

                        $this->downloadDriveFolderRecursively(
                            $subId,
                            $zip,
                            $ikuZipPrefix,
                            $accessToken,
                            $driveService,
                            $visitedFolderIds,
                            $visitedFiles,
                            6,
                            0,
                            $jobId
                        );
                    } else {
                        $downloadInfo = $this->prepareDriveDownloadUrl($subId, $subMime, $subName);
                        $fileZipPath = "{$baseDirName}/{$downloadInfo['fileName']}";

                        if (!isset($visitedFiles[$fileZipPath])) {
                            $visitedFiles[$fileZipPath] = true;
                            $fContent = $this->executeDriveCurl($downloadInfo['url'], $accessToken, $driveService);
                            if ($fContent !== false && $fContent !== null) {
                                $zip->addFromString($fileZipPath, $fContent);
                                unset($fContent);
                            }
                        }
                    }
                }
            }

            // 5. Also check DB template_capaian for any submitted folder/file links not yet downloaded
            $this->updateProgress($jobId, [
                'progress' => 88,
                'message' => 'Memeriksa berkas capaian dari pangkalan data...'
            ]);

            $dbRows = DB::table('template_capaian')
                ->join('master_indikator', 'template_capaian.id_indikator', '=', 'master_indikator.id')
                ->leftJoin('v_fakultas_unit', 'template_capaian.fakultas_unit', '=', 'v_fakultas_unit.id')
                ->where('template_capaian.triwulan', $tw)
                ->where('template_capaian.tahun', $tahun)
                ->whereNotNull('template_capaian.file_url')
                ->select(
                    'template_capaian.*',
                    'master_indikator.iku as kode_iku',
                    'v_fakultas_unit.nama_fak_prod_unit'
                )
                ->get();

            foreach ($dbRows as $row) {
                $gdriveId = $this->extractGdriveId($row->file_url);

                if ($gdriveId) {
                    if (isset($visitedFolderIds[$gdriveId])) {
                        continue;
                    }

                    $urlMeta = "https://www.googleapis.com/drive/v3/files/{$gdriveId}?fields=id,name,mimeType,shortcutDetails";
                    $resMetaStr = $this->executeDriveCurl($urlMeta, $accessToken, $driveService);

                    if ($resMetaStr) {
                        $resMeta = json_decode($resMetaStr, true);
                        if (!empty($resMeta['name'])) {
                            $mId = $resMeta['id'];
                            $mMime = $resMeta['mimeType'] ?? '';
                            $mName = $resMeta['name'];

                            if ($mMime === 'application/vnd.google-apps.shortcut' && !empty($resMeta['shortcutDetails'])) {
                                $mId = $resMeta['shortcutDetails']['targetId'] ?? $mId;
                                $mMime = $resMeta['shortcutDetails']['targetMimeType'] ?? $mMime;
                            }

                            $ikuDir = trim($row->kode_iku);
                            $unitDir = trim($row->nama_fak_prod_unit ?: $mName);
                            $safeUnitDir = str_replace(['/', '\\'], '-', $unitDir);

                            if ($mMime === 'application/vnd.google-apps.folder') {
                                $targetPath = "{$baseDirName}/{$ikuDir}/{$safeUnitDir}";
                                $this->downloadDriveFolderRecursively(
                                    $mId,
                                    $zip,
                                    $targetPath,
                                    $accessToken,
                                    $driveService,
                                    $visitedFolderIds,
                                    $visitedFiles,
                                    6,
                                    0,
                                    $jobId
                                );
                            } else {
                                $downloadInfo = $this->prepareDriveDownloadUrl($mId, $mMime, $mName);
                                $fileZipPath = "{$baseDirName}/{$ikuDir}/{$safeUnitDir}/{$downloadInfo['fileName']}";

                                if (!isset($visitedFiles[$fileZipPath])) {
                                    $visitedFiles[$fileZipPath] = true;
                                    $fContent = $this->executeDriveCurl($downloadInfo['url'], $accessToken, $driveService);
                                    if ($fContent !== false && $fContent !== null) {
                                        $zip->addFromString($fileZipPath, $fContent);
                                        unset($fContent);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 6. Close ZIP archive
            $this->updateProgress($jobId, [
                'progress' => 95,
                'message' => 'Mengompres dan memfinalisasi berkas arsip ZIP...'
            ]);

            $zip->close();

            $fileSize = file_exists($zipPath) ? filesize($zipPath) : 0;
            $totalChunks = (int)ceil(max(1, $fileSize) / $this->chunkSize);

            $this->updateProgress($jobId, [
                'status' => 'completed',
                'progress' => 100,
                'message' => 'Selesai! Berkas ZIP siap diunduh.',
                'file_size' => $fileSize,
                'total_chunks' => $totalChunks,
                'chunk_size' => $this->chunkSize,
            ]);

            try { $lock->release(); } catch (\Throwable $e) {}
            return true;
        } catch (\Throwable $e) {
            Log::error("ExportTwZip failed for job {$jobId}: " . $e->getMessage() . "\n" . $e->getTraceAsString());
            $this->updateProgress($jobId, [
                'status' => 'failed',
                'progress' => 0,
                'message' => 'Gagal memproses ekspor ZIP: ' . $e->getMessage(),
                'error' => $e->getMessage(),
            ]);

            try { $lock->release(); } catch (\Throwable $eL) {}
            return false;
        }
    }
}

<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class GoogleDriveService
{
    protected $clientId;
    protected $clientSecret;
    protected $parentFolderId;
    protected $tokenFile;

    public static function defaultIkuList()
    {
        return [
            "IKU 1",
            "IKU 1 - a",
            "IKU 1 - b",
            "IKU 1 - c",
            "IKU 1 - d",
            "IKU 1 - e",
            "IKU 1 - f",
            "IKU 1 - g",
            "IKU 1 - h",
            "Sub IKU 1.1",
            "Sub IKU 1.1 - a",
            "Sub IKU 1.1 - b",
            "Sub IKU 1.2",
            "IKU 2",
            "IKU 3",
            "IKU 4",
            "Sub IKU 4.1",
            "IKU 5",
            "IKU 6",
            "Sub IKU 6.1",
            "Sub IKU 6.1.1 - a",
            "Sub IKU 6.1.2 - b",
            "Sub IKU 6.2",
            "IKU 7",
            "Sub IKU 7.1",
            "Sub IKU 7.2",
            "IKU 8",
            "IKU 9",
            "Sub IKU 9.1",
            "Sub IKU 9.1.2 - a",
            "Sub IKU 9.1.3 - b",
            "Sub IKU 9.2",
            "Sub IKU 9.2.1 - a",
            "Sub IKU 9.2.2 - b",
            "Sub IKU 9.2.3 - c",
            "IKU 10",
            "IKU 11 - a",
            "IKU 11 - c",
            "IKU 11 - d",
            "IKU 12"
        ];
    }

    public static function defaultTwList()
    {
        return ["TW1", "TW2", "TW3", "TW4"];
    }

    public function __construct()
    {
        $this->clientId = config('services.google.client_id');
        $this->clientSecret = config('services.google.client_secret');
        $this->parentFolderId = config('services.google.parent_folder_id', '1T1W4rzlCHZUa8VYQ7qCbij7aRPyuJtNf');
        $this->tokenFile = storage_path('app/gdrive_token.json');
    }

    /**
     * Get valid access token (refreshing if expired)
     */
    public function getAccessToken()
    {
        if (!file_exists($this->tokenFile)) {
            return null;
        }

        $tokenData = json_decode(file_get_contents($this->tokenFile), true);
        $accessToken = $tokenData['access_token'] ?? null;

        // Auto-refresh token if expired or near expiration
        if (isset($tokenData['created_at'], $tokenData['expires_in']) && (time() - $tokenData['created_at'] > $tokenData['expires_in'] - 60)) {
            if (!empty($tokenData['refresh_token'])) {
                $ch = curl_init('https://oauth2.googleapis.com/token');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
                    'client_id' => $this->clientId,
                    'client_secret' => $this->clientSecret,
                    'refresh_token' => $tokenData['refresh_token'],
                    'grant_type' => 'refresh_token'
                ]));
                $res = curl_exec($ch);
                curl_close($ch);

                if ($res) {
                    $newToken = json_decode($res, true);
                    if (isset($newToken['access_token'])) {
                        $accessToken = $newToken['access_token'];
                        $tokenData['access_token'] = $accessToken;
                        $tokenData['created_at'] = time();
                        file_put_contents($this->tokenFile, json_encode($tokenData, JSON_PRETTY_PRINT));
                    }
                }
            }
        }

        return $accessToken;
    }

    /**
     * Check if a folder exists by name under a parent folder
     */
    public function findFolder($name, $parentId = null)
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) return null;

        $parentId = $parentId ?: $this->parentFolderId;
        $q = urlencode("'$parentId' in parents and name = '$name' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
        $url = "https://www.googleapis.com/drive/v3/files?q={$q}";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        $res = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($res, true);
        return $data['files'][0]['id'] ?? null;
    }

    /**
     * Create a single folder in Google Drive
     */
    public function createFolder($name, $parentId = null)
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) return null;

        $parentId = $parentId ?: $this->parentFolderId;
        $url = "https://www.googleapis.com/drive/v3/files";

        $body = json_encode([
            'name' => $name,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ]);

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            "Authorization: Bearer {$accessToken}",
            "Content-Type: application/json"
        ]);
        $res = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($res, true);
        return $data['id'] ?? null;
    }

    /**
     * Batch create folders concurrently using curl_multi for max performance
     */
    public function createSubfoldersParallel(array $folderNames, $parentId)
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken || empty($folderNames) || !$parentId) return [];

        $createdIds = [];
        $chunks = array_chunk($folderNames, 15);

        foreach ($chunks as $chunk) {
            $mh = curl_multi_init();
            $handles = [];

            foreach ($chunk as $name) {
                $ch = curl_init("https://www.googleapis.com/drive/v3/files");
                $body = json_encode([
                    'name' => $name,
                    'mimeType' => 'application/vnd.google-apps.folder',
                    'parents' => [$parentId]
                ]);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    "Authorization: Bearer {$accessToken}",
                    "Content-Type: application/json"
                ]);
                curl_multi_add_handle($mh, $ch);
                $handles[$name] = $ch;
            }

            $running = null;
            do {
                curl_multi_exec($mh, $running);
                curl_multi_select($mh);
            } while ($running > 0);

            foreach ($handles as $name => $ch) {
                $content = curl_multi_getcontent($ch);
                $data = json_decode($content, true);
                if (!empty($data['id'])) {
                    $createdIds[$name] = $data['id'];
                }
                curl_multi_remove_handle($mh, $ch);
                curl_close($ch);
            }

            curl_multi_close($mh);
        }

        return $createdIds;
    }

    /**
     * List child folder names under a parent folder
     */
    public function listChildFolderNames($parentId)
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) return [];

        $q = urlencode("'$parentId' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
        $url = "https://www.googleapis.com/drive/v3/files?q={$q}&pageSize=1000";

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        $res = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($res, true);
        $names = [];
        foreach ($data['files'] ?? [] as $file) {
            $names[] = $file['name'];
        }
        return $names;
    }

    /**
     * Ensure year folder and TW + IKU folder structure exists in Google Drive
     */
    public function ensureYearFolderStructure($tahun, array $ikuList = null, array $twList = null)
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            Log::warning("Google Drive token not available for year structure creation.");
            return false;
        }

        $ikuList = $ikuList ?: self::defaultIkuList();
        $twList = $twList ?: self::defaultTwList();

        // 1. Check if Year Folder exists under Parent Folder
        $yearFolderId = $this->findFolder((string)$tahun);

        if (!$yearFolderId) {
            // Create Year Folder (e.g. "2026")
            $yearFolderId = $this->createFolder((string)$tahun);
            if (!$yearFolderId) {
                Log::error("Failed to create year folder on Google Drive for year: {$tahun}");
                return false;
            }
        }

        // 2. Ensure TW folders exist and populate missing IKU folders inside each TW folder
        foreach ($twList as $twName) {
            $twFolderId = $this->findFolder($twName, $yearFolderId);

            if (!$twFolderId) {
                $twFolderId = $this->createFolder($twName, $yearFolderId);
            }

            if ($twFolderId) {
                $existingSubfolders = $this->listChildFolderNames($twFolderId);
                $missingIkus = array_diff($ikuList, $existingSubfolders);

                if (!empty($missingIkus)) {
                    $this->createSubfoldersParallel(array_values($missingIkus), $twFolderId);
                }
            }
        }

        return true;
    }

    /**
     * Upload or update a file on Google Drive in [tahun] > [TW] folder structure
     * Returns Google Drive webViewLink or null
     */
    public function uploadFile($filePath, $fileName, $parentId, $mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    {
        $accessToken = $this->getAccessToken();
        if (!$accessToken || !file_exists($filePath)) return null;

        // Check if file already exists in parent folder
        $existingFileId = null;
        $q = urlencode("'$parentId' in parents and name = '$fileName' and trashed = false");
        $urlSearch = "https://www.googleapis.com/drive/v3/files?q={$q}";
        $chS = curl_init($urlSearch);
        curl_setopt($chS, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($chS, CURLOPT_HTTPHEADER, ["Authorization: Bearer {$accessToken}"]);
        $resS = curl_exec($chS);
        curl_close($chS);
        $dataS = json_decode($resS, true);
        if (!empty($dataS['files'][0]['id'])) {
            $existingFileId = $dataS['files'][0]['id'];
        }

        $fileData = file_get_contents($filePath);

        if ($existingFileId) {
            // Update existing file content
            $urlUpload = "https://www.googleapis.com/upload/drive/v3/files/{$existingFileId}?uploadType=media";
            $ch = curl_init($urlUpload);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
            curl_setopt($ch, CURLOPT_POSTFIELDS, $fileData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$accessToken}",
                "Content-Type: {$mimeType}"
            ]);
            $res = curl_exec($ch);
            curl_close($ch);
            $fileId = $existingFileId;
        } else {
            // Multipart upload for new file
            $boundary = '-------' . microtime(true);
            $delimiter = "\r\n--" . $boundary . "\r\n";
            $closeDelimiter = "\r\n--" . $boundary . "--";

            $metadata = [
                'name' => $fileName,
                'parents' => [$parentId]
            ];

            $postData = $delimiter .
                "Content-Type: application/json; charset=UTF-8\r\n\r\n" .
                json_encode($metadata) .
                $delimiter .
                "Content-Type: {$mimeType}\r\n\r\n" .
                $fileData .
                $closeDelimiter;

            $urlUpload = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
            $ch = curl_init($urlUpload);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$accessToken}",
                "Content-Type: multipart/related; boundary=" . $boundary,
                "Content-Length: " . strlen($postData)
            ]);
            $res = curl_exec($ch);
            curl_close($ch);

            $data = json_decode($res, true);
            $fileId = $data['id'] ?? null;
        }

        if ($fileId) {
            // Make file readable to anyone with link
            $urlPerm = "https://www.googleapis.com/drive/v3/files/{$fileId}/permissions";
            $chP = curl_init($urlPerm);
            curl_setopt($chP, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($chP, CURLOPT_POST, true);
            curl_setopt($chP, CURLOPT_POSTFIELDS, json_encode([
                'role' => 'reader',
                'type' => 'anyone'
            ]));
            curl_setopt($chP, CURLOPT_HTTPHEADER, [
                "Authorization: Bearer {$accessToken}",
                "Content-Type: application/json"
            ]);
            curl_exec($chP);
            curl_close($chP);

            return "https://drive.google.com/file/d/{$fileId}/view?usp=sharing";
        }

        return null;
    }
}

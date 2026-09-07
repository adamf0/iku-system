<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CapaianController;
use App\Http\Controllers\MasterController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// Google Drive OAuth Callback
Route::get('/gdrive-callback', function (\Illuminate\Http\Request $request) {
    $code = $request->query('code');
    if ($code) {
        $pyPath = base_path('gdrive_folder_creator.py');
        $redirectUri = config('services.google.redirect_uri', 'http://localhost:8000/gdrive-callback');
        $cmd = 'python3 ' . escapeshellarg($pyPath) . ' --code ' . escapeshellarg($code) . ' --redirect-uri ' . escapeshellarg($redirectUri) . ' > /dev/null 2>&1 &';
        exec($cmd);

        // Store token in storage/app/gdrive_token.json for ZIP exports
        $clientId = config('services.google.client_id');
        $clientSecret = config('services.google.client_secret');
        
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'code' => trim($code),
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code'
        ]));
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $tokenData = json_decode($response, true);
            if (isset($tokenData['access_token'])) {
                $tokenData['created_at'] = time();
                if (!file_exists(storage_path('app'))) {
                    mkdir(storage_path('app'), 0777, true);
                }
                file_put_contents(storage_path('app/gdrive_token.json'), json_encode($tokenData, JSON_PRETTY_PRINT));
            }
        }

        $state = $request->query('state');
        if ($state) {
            $decodedState = json_decode(urldecode($state), true);
            if (isset($decodedState['tw']) && isset($decodedState['tahun'])) {
                return redirect('/api/dashboard/export-tw-zip?tw=' . urlencode($decodedState['tw']) . '&tahun=' . urlencode($decodedState['tahun']));
            }
        }

        return response('<html><body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc;">' .
            '<div style="max-width:520px; margin:0 auto; background:white; padding:32px; border-radius:16px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">' .
            '<h2 style="color:#059669; margin-top:0;">Otentikasi Google Drive Berhasil!</h2>' .
            '<p style="color:#475569; line-height:1.6;">Otentikasi Google Drive berhasil. Pembuatan & penyelarasan folder <strong>TW1 - TW4 (40 subfolder IKU)</strong> sedang diproses.</p>' .
            '<p style="margin-top:20px;"><a href="/dashboard" style="display:inline-block; background:#005bb1; color:white; font-weight:bold; padding:10px 20px; border-radius:8px; text-decoration:none;">Kembali ke Dashboard</a></p>' .
            '</div></body></html>');
    }
    return response('Kode otentikasi tidak ditemukan.', 400);
});

// Home redirect
Route::get('/', function () {
    return redirect()->route('login');
});

// Authenticated Routes
Route::middleware(['auth'])->group(function () {
    
    // Inertia Pages
    Route::get('/dashboard', function () {
        return Inertia::render('Dashboard');
    })->name('dashboard');

    Route::get('/analytics', function () {
        return Inertia::render('Analytics');
    })->name('analytics');

    Route::get('/reporting', function () {
        return Inertia::render('Reporting');
    })->name('reporting');

    Route::get('/capaian/edit', function (\Illuminate\Http\Request $request) {
        $user = $request->user();
        if (in_array($user->role, ['ADMIN', 'LPM'])) {
            abort(403, 'Akses Ditolak: Halaman ini hanya untuk Unit Pelapor.');
        }

        // Check if this unit is assigned in active penugasan_target
        $isAssigned = \Illuminate\Support\Facades\DB::table('penugasan_target')
            ->where('fakultas_unit', $user->fakultas_unit)
            ->whereNull('deleted_at')
            ->exists();

        if (!$isAssigned) {
            abort(403, 'Akses Ditolak: Unit Anda belum ditugaskan untuk pelaporan target IKU.');
        }

        return Inertia::render('Capaian/EditCapaian');
    })->name('capaian.edit');

    Route::get('/master', function () {
        return Inertia::render('Master');
    })->name('master');

    Route::get('/management-target', function () {
        return Inertia::render('ManagementTarget');
    })->name('management-target');

    Route::get('/penugasan-target', function () {
        return Inertia::render('PenugasanTarget');
    })->name('penugasan-target');

    Route::get('/verifikasi', function () {
        return Inertia::render('Verifikasi');
    })->name('verifikasi');

    // Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // API - Dashboard
    Route::prefix('api/dashboard')->group(function () {
        Route::get('/summary', [DashboardController::class, 'summary']);
        Route::get('/stream', [DashboardController::class, 'streamSummary']);
        Route::get('/rekap-matriks', [DashboardController::class, 'rekapMatriks']);
        Route::get('/antrean-verifikasi', [DashboardController::class, 'antreanVerifikasi']);
        Route::get('/export-tw-zip', [DashboardController::class, 'exportTwZip']);
    });

    // API - Capaian & Penugasan
    Route::prefix('api/capaian')->group(function () {
        Route::get('/', [CapaianController::class, 'index']);
        Route::get('/stream', [CapaianController::class, 'streamCapaian']);
        Route::post('/', [CapaianController::class, 'store']);
        Route::post('/{id}/submit', [CapaianController::class, 'submit']);
        Route::post('/{id}/verify', [CapaianController::class, 'verify']);
        Route::post('/{id}/sahkan', [CapaianController::class, 'sahkan']);
    });

    // API - Penugasan Target
    Route::prefix('api/penugasan')->group(function () {
        Route::get('/', [CapaianController::class, 'listPenugasan']);
        Route::get('/stream', [CapaianController::class, 'streamPenugasan']);
        Route::post('/', [CapaianController::class, 'storePenugasan']);
        Route::delete('/{id}', [CapaianController::class, 'deletePenugasan']);
        Route::post('/{id}/restore', [CapaianController::class, 'restorePenugasan']);
    });

    // Target Management routes (Bypasses WAF REST blocks)
    Route::post('/target/justifikasi/{id}', [MasterController::class, 'saveJustifikasi']);
    Route::post('/target/save/{id}', [MasterController::class, 'updateIku']);

    // API - Master Data
    Route::prefix('api/master')->group(function () {
        Route::get('/contexts', [MasterController::class, 'contexts']);
        Route::get('/iku', [MasterController::class, 'iku']);
        Route::get('/iku/assigned', [MasterController::class, 'assignedIku']);
        Route::post('/iku', [MasterController::class, 'createIku']);
        Route::post('/iku/{id}', [MasterController::class, 'updateIku']);
        Route::post('/iku/{id}/justifikasi', [MasterController::class, 'saveJustifikasi']);
        Route::delete('/iku/{id}', [MasterController::class, 'deleteIku']);
        Route::get('/units', [MasterController::class, 'units']);
        Route::get('/users', [MasterController::class, 'users']);
        Route::get('/tahun', [MasterController::class, 'tahun']);
    });
});

require __DIR__.'/auth.php';

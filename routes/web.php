<?php

use App\Http\Controllers\ProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CapaianController;
use App\Http\Controllers\MasterController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

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

    Route::get('/capaian/edit', function () {
        return Inertia::render('Capaian/EditCapaian');
    })->name('capaian.edit');

    Route::get('/master', function () {
        return Inertia::render('Master');
    })->name('master');

    Route::get('/management-target', function () {
        return Inertia::render('ManagementTarget');
    })->name('management-target');

    // Profile
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // API - Dashboard
    Route::prefix('api/dashboard')->group(function () {
        Route::get('/summary', [DashboardController::class, 'summary']);
        Route::get('/rekap-matriks', [DashboardController::class, 'rekapMatriks']);
        Route::get('/antrean-verifikasi', [DashboardController::class, 'antreanVerifikasi']);
    });

    // API - Capaian
    Route::prefix('api/capaian')->group(function () {
        Route::get('/', [CapaianController::class, 'index']);
        Route::post('/', [CapaianController::class, 'store']);
        Route::post('/{id}/submit', [CapaianController::class, 'submit']);
        Route::post('/{id}/verify', [CapaianController::class, 'verify']);
        Route::post('/{id}/sahkan', [CapaianController::class, 'sahkan']);
    });

    // API - Master Data
    Route::prefix('api/master')->group(function () {
        Route::get('/contexts', [MasterController::class, 'contexts']);
        Route::get('/iku', [MasterController::class, 'iku']);
        Route::post('/iku', [MasterController::class, 'createIku']);
        Route::post('/iku/{id}', [MasterController::class, 'updateIku']);
        Route::delete('/iku/{id}', [MasterController::class, 'deleteIku']);
        Route::get('/units', [MasterController::class, 'units']);
        Route::get('/users', [MasterController::class, 'users']);
    });
});

require __DIR__.'/auth.php';

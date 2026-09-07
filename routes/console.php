<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Sync IKU 1 from SIMAK every 5 minutes automatically
Schedule::command('iku:sync-simak-iku1')->everyFiveMinutes();

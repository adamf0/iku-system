<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Jobs\ProcessGdriveFolderJob;

class ProcessGdriveFolderJobCommand extends Command
{
    protected $signature = 'iku:process-gdrive-job {unitId?} {tahun?} {indicatorId?}';
    protected $description = 'Dispatch ProcessGdriveFolderJob to Laravel Queue worker';

    public function handle()
    {
        $unitId = $this->argument('unitId') ? (int)$this->argument('unitId') : null;
        $tahun = $this->argument('tahun') ? (int)$this->argument('tahun') : null;
        $singleIndId = $this->argument('indicatorId') ? (int)$this->argument('indicatorId') : null;

        ProcessGdriveFolderJob::dispatch($unitId, $tahun, $singleIndId);
        $this->info("Pushed Google Drive folder creation task to Laravel Queue.");
        return 0;
    }
}

<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\ExportTwZipService;

class ExportTwZipCommand extends Command
{
    protected $signature = 'iku:export-tw-zip {jobId}';
    protected $description = 'Process and build IKU Triwulan ZIP export in background';

    public function handle()
    {
        $jobId = $this->argument('jobId');
        $this->info("Starting export job: {$jobId}");

        $service = new ExportTwZipService();
        $success = $service->runExport($jobId);

        if ($success) {
            $this->info("Export job {$jobId} completed successfully.");
            return 0;
        } else {
            $this->error("Export job {$jobId} failed.");
            return 1;
        }
    }
}

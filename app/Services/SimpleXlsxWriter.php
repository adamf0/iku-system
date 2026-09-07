<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class SimpleXlsxWriter
{
    /**
     * Create an .xlsx file at $outputPath using PhpOffice\PhpSpreadsheet
     */
    public static function create($outputPath, array $headers, array $rows)
    {
        $dir = dirname($outputPath);
        if (!file_exists($dir)) {
            @mkdir($dir, 0777, true);
            @chmod($dir, 0777);
        }
        if (file_exists($outputPath)) {
            @unlink($outputPath);
        }

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Capaian IKU 1');

        $rowIdx = 1;

        // Header Row
        if (!empty($headers)) {
            $colIdx = 1;
            foreach ($headers as $h) {
                $cell = $sheet->getCellByColumnAndRow($colIdx, 1);
                $cell->setValue((string)$h);
                $colIdx++;
            }

            $highestCol = $sheet->getHighestColumn();
            $headerRange = "A1:{$highestCol}1";
            $sheet->getStyle($headerRange)->getFont()->setBold(true);
            $sheet->getStyle($headerRange)->getFill()
                ->setFillType(Fill::FILL_SOLID)
                ->getStartColor()->setARGB('EAEAEA');

            $rowIdx++;
        }

        // Data Rows
        foreach ($rows as $row) {
            $colIdx = 1;
            foreach ($row as $val) {
                $cell = $sheet->getCellByColumnAndRow($colIdx, $rowIdx);
                if (is_numeric($val) && !preg_match('/^0\d+/', (string)$val)) {
                    $cell->setValue((float)$val);
                } else {
                    $cell->setValue((string)($val ?? ''));
                }
                $colIdx++;
            }
            $rowIdx++;
        }

        // Auto-fit column widths
        $maxCols = !empty($headers) ? count($headers) : 6;
        for ($col = 1; $col <= $maxCols; $col++) {
            $sheet->getColumnDimensionByColumn($col)->setAutoSize(true);
        }

        $writer = new Xlsx($spreadsheet);
        $writer->save($outputPath);

        return file_exists($outputPath);
    }
}

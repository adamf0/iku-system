<?php

namespace App\Services;

class SimpleXlsxWriter
{
    /**
     * Create an .xlsx file at $outputPath with given headers and rows data
     */
    public static function create($outputPath, array $headers, array $rows)
    {
        $dir = dirname($outputPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        $zip = new \ZipArchive();
        if ($zip->open($outputPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        // 1. [Content_Types].xml
        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>';
        $zip->addFromString('[Content_Types].xml', $contentTypes);

        // 2. _rels/.rels
        $rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>';
        $zip->addFromString('_rels/.rels', $rels);

        // 3. xl/_rels/workbook.xml.rels
        $wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>';
        $zip->addFromString('xl/_rels/workbook.xml.rels', $wbRels);

        // 4. xl/workbook.xml
        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Sheet1" sheetId="1" r:id="rId1"/>
</sheets>
</workbook>';
        $zip->addFromString('xl/workbook.xml', $workbook);

        // 5. xl/styles.xml
        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>';
        $zip->addFromString('xl/styles.xml', $styles);

        // 6. xl/worksheets/sheet1.xml
        $sheetData = '<sheetData>';
        $rowIdx = 1;

        // Header Row
        if (!empty($headers)) {
            $sheetData .= '<row r="1">';
            $colIdx = 0;
            foreach ($headers as $h) {
                $cellRef = self::colName($colIdx) . '1';
                $safeH = htmlspecialchars((string)$h, ENT_QUOTES | ENT_XML1, 'UTF-8');
                $sheetData .= '<c r="' . $cellRef . '" t="inlineStr"><is><t>' . $safeH . '</t></is></c>';
                $colIdx++;
            }
            $sheetData .= '</row>';
            $rowIdx++;
        }

        // Data Rows
        foreach ($rows as $row) {
            $sheetData .= '<row r="' . $rowIdx . '">';
            $colIdx = 0;
            foreach ($row as $val) {
                $cellRef = self::colName($colIdx) . $rowIdx;
                if (is_numeric($val) && !preg_match('/^0\d+/', (string)$val)) {
                    $sheetData .= '<c r="' . $cellRef . '"><v>' . $val . '</v></c>';
                } else {
                    $safeVal = htmlspecialchars((string)($val ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8');
                    $sheetData .= '<c r="' . $cellRef . '" t="inlineStr"><is><t>' . $safeVal . '</t></is></c>';
                }
                $colIdx++;
            }
            $sheetData .= '</row>';
            $rowIdx++;
        }

        $sheetData .= '</sheetData>';

        $sheet1 = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
' . $sheetData . '
</worksheet>';

        $zip->addFromString('xl/worksheets/sheet1.xml', $sheet1);
        $zip->close();

        return file_exists($outputPath);
    }

    private static function colName($index)
    {
        $letters = '';
        while ($index >= 0) {
            $letters = chr($index % 26 + 65) . $letters;
            $index = intval($index / 26) - 1;
        }
        return $letters;
    }
}

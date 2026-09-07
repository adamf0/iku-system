<?php

namespace App\Services;

class SimpleXlsxWriter
{
    /**
     * Create a 100% OpenXML-compliant .xlsx file at $outputPath
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

        $zip = new \ZipArchive();
        if ($zip->open($outputPath, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) {
            return false;
        }

        // Shared Strings collection
        $stringMap = [];
        $stringList = [];

        $getStringIndex = function($str) use (&$stringMap, &$stringList) {
            $str = (string)($str ?? '');
            if (isset($stringMap[$str])) {
                return $stringMap[$str];
            }
            $idx = count($stringList);
            $stringMap[$str] = $idx;
            $stringList[] = $str;
            return $idx;
        };

        // 1. [Content_Types].xml
        $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
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
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>';
        $zip->addFromString('xl/_rels/workbook.xml.rels', $wbRels);

        // 4. xl/workbook.xml
        $workbook = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <fileVersion appName="xl" lastEdited="5" lowestEdited="5" rupBuild="9303"/>
  <workbookPr defaultThemeVersion="124226"/>
  <bookViews>
    <workbookView xWindow="0" yWindow="0" windowWidth="15000" windowHeight="10000"/>
  </bookViews>
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
  <calcPr calcId="124519"/>
</workbook>';
        $zip->addFromString('xl/workbook.xml', $workbook);

        // 5. xl/styles.xml
        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>';
        $zip->addFromString('xl/styles.xml', $styles);

        // 6. Build xl/worksheets/sheet1.xml
        $sheetData = '<sheetData>';
        $rowIdx = 1;

        // Header Row
        if (!empty($headers)) {
            $sheetData .= '<row r="1">';
            $colIdx = 0;
            foreach ($headers as $h) {
                $cellRef = self::colName($colIdx) . '1';
                $sIdx = $getStringIndex((string)$h);
                $sheetData .= '<c r="' . $cellRef . '" t="s"><v>' . $sIdx . '</v></c>';
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
                    $sIdx = $getStringIndex((string)($val ?? ''));
                    $sheetData .= '<c r="' . $cellRef . '" t="s"><v>' . $sIdx . '</v></c>';
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

        // 7. Build xl/sharedStrings.xml
        $sstXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' . count($stringList) . '" uniqueCount="' . count($stringList) . '">';
        foreach ($stringList as $str) {
            $safeStr = htmlspecialchars($str, ENT_QUOTES | ENT_XML1, 'UTF-8');
            $sstXml .= '<si><t xml:space="preserve">' . $safeStr . '</t></si>';
        }
        $sstXml .= '</sst>';
        $zip->addFromString('xl/sharedStrings.xml', $sstXml);

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

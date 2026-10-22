import React, { useState, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import SearchableSelect from '@/Components/SearchableSelect';
import axios from 'axios';
import { buildGroupedUnitOptions, formatUnitTargetName } from '@/Utils/unitHelper';

export const TW_PERIOD_LABELS = {
    TW1: 'Januari - Maret',
    TW2: 'April - Juni',
    TW3: 'Juli - September',
    TW4: 'Oktober - Desember'
};

// Combo Chart: Grouped Bars for Realisasi + Threshold Lines for Target & Baseline per year
function SebaranCapaianChart({ data, filterTw, selectedTahun }) {
    const [hoverIndex, setHoverIndex] = useState(null);

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-xs text-[#717785] italic">
                Belum ada data sebaran IKU
            </div>
        );
    }

    const items = data;
    const isAllYears = (selectedTahun === 'ALL');
    const availableYears = isAllYears
        ? (items[0]?.years_data ? Object.keys(items[0].years_data).map(Number) : [])
        : [Number(selectedTahun)];

    const COLOR_PALETTES = [
        { bar: '#6366f1', targetLine: '#10b981', baseLine: '#f59e0b' },
        { bar: '#a855f7', targetLine: '#0d9488', baseLine: '#ea580c' },
        { bar: '#ec4899', targetLine: '#0284c7', baseLine: '#e11d48' },
        { bar: '#3b82f6', targetLine: '#16a34a', baseLine: '#d97706' },
        { bar: '#8b5cf6', targetLine: '#059669', baseLine: '#dc2626' },
        { bar: '#06b6d4', targetLine: '#84cc16', baseLine: '#f97316' },
    ];

    const yearColors = {};
    availableYears.forEach((yr, idx) => {
        const palette = COLOR_PALETTES[idx % COLOR_PALETTES.length];
        yearColors[yr] = {
            ...palette,
            label: String(yr)
        };
    });

    const height = 370;
    const itemWidth = isAllYears ? 95 : 80;
    const paddingLeft = 55;
    const paddingRight = 45;
    const paddingTop = 40;
    const paddingBottom = 85;

    const width = Math.max(980, paddingLeft + paddingRight + items.length * itemWidth);
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Calculate layout points
    const points = items.map((item, idx) => {
        const x = paddingLeft + (idx / Math.max(1, items.length - 1)) * chartWidth;

        const yearMetrics = {};
        availableYears.forEach(yr => {
            const yData = (item.years_data && item.years_data[yr]) || {};
            let capVal = yData.capaian || (yr === Number(selectedTahun) ? item.capaian : 0);
            let capPct = yData.capaian_pct || (yr === Number(selectedTahun) ? item.capaian_pct : 0);

            if (filterTw && filterTw !== 'ALL') {
                if (yData && yData[filterTw] !== undefined && yData[filterTw] !== null) {
                    capPct = Number(yData[filterTw]) || 0;
                } else if (item[filterTw] !== undefined && item[filterTw] !== null) {
                    capPct = Number(item[filterTw]) || 0;
                }

                const twKeyLower = filterTw.toLowerCase();
                if (item[`capaian_${twKeyLower}`] !== null && item[`capaian_${twKeyLower}`] !== undefined) {
                    capVal = item[`capaian_${twKeyLower}`];
                }
            }

            const tgtVal = yData.target || item.target || 100;
            const tgtPct = yData.target_pct || item.target_pct || 100;
            const baseVal = yData.base_line || item.base_line || 0;
            const basePct = yData.baseline_pct || item.baseline_pct || 0;

            const yCapaian = paddingTop + (1 - Math.min(100, Math.max(0, capPct)) / 100) * chartHeight;
            const yTarget = paddingTop + (1 - Math.min(100, Math.max(0, tgtPct)) / 100) * chartHeight;
            const yBase = paddingTop + (1 - Math.min(100, Math.max(0, basePct)) / 100) * chartHeight;

            yearMetrics[yr] = {
                yr,
                capVal,
                capPct,
                tgtVal,
                tgtPct,
                baseVal,
                basePct,
                yCapaian,
                yTarget,
                yBase,
                hasData: yData.has_data || capPct > 0
            };
        });

        return { x, yearMetrics, item };
    });

    const yTicks = [100, 80, 60, 40, 20, 0];

    return (
        <div className="space-y-4">
            {/* Line Chart Legend */}
            <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold px-2 border-b border-[#c0c6d6]/15 pb-3">
                <div className="flex flex-wrap items-center gap-6">
                    {/* Realisasi Legend (Line) */}
                    <div className="flex items-center gap-3 border-r border-[#c0c6d6]/30 pr-4">
                        <span className="text-[#535f71] uppercase tracking-wider text-[10px]">Realisasi (Line):</span>
                        {availableYears.map(yr => (
                            <span key={`bar-leg-${yr}`} className="flex items-center gap-1.5" style={{ color: yearColors[yr]?.bar || '#a855f7' }}>
                                <span className="w-4 h-1 rounded-full" style={{ backgroundColor: yearColors[yr]?.bar || '#a855f7' }}></span>
                                Realisasi {yr}
                            </span>
                        ))}
                    </div>

                    {/* Lines Legend (Threshold Target & Baseline) */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[#535f71] uppercase tracking-wider text-[10px]">Threshold (Line):</span>
                        {availableYears.map(yr => (
                            <React.Fragment key={`line-leg-${yr}`}>
                                <span className="flex items-center gap-1.5" style={{ color: yearColors[yr]?.targetLine || '#10b981' }}>
                                    <span className="w-3.5 h-1 rounded-full" style={{ backgroundColor: yearColors[yr]?.targetLine || '#10b981' }}></span>
                                    Target {yr}
                                </span>
                                <span className="flex items-center gap-1.5" style={{ color: yearColors[yr]?.baseLine || '#f59e0b' }}>
                                    <span className="w-3.5 h-1 rounded-full border-t border-dashed" style={{ backgroundColor: yearColors[yr]?.baseLine || '#f59e0b' }}></span>
                                    Baseline {yr}
                                </span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Full-width Scrollable Container */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
                <div className="relative" style={{ width: `${width}px` }}>
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto text-xs font-sans select-none">
                        {/* Horizontal Grid lines */}
                        {yTicks.map((tick) => {
                            const y = paddingTop + (1 - tick / 100) * chartHeight;
                            return (
                                <g key={tick}>
                                    <line 
                                        x1={paddingLeft} 
                                        y1={y} 
                                        x2={width - paddingRight} 
                                        y2={y} 
                                        stroke="#e8ecf4" 
                                        strokeDasharray="3 3"
                                    />
                                    <text 
                                        x={paddingLeft - 10} 
                                        y={y + 4} 
                                        textAnchor="end" 
                                        fill="#717785" 
                                        className="text-[10px] font-bold"
                                    >
                                        {tick}%
                                    </text>
                                </g>
                            );
                        })}

                        {/* 1. TARGET & BASELINE THRESHOLD LINES */}
                        {availableYears.map(yr => {
                            const targetPath = points.reduce((acc, p, i) => {
                                const y = p.yearMetrics[yr]?.yTarget || (paddingTop + chartHeight);
                                return i === 0 ? `M ${p.x} ${y}` : `${acc} L ${p.x} ${y}`;
                            }, '');

                            const basePath = points.reduce((acc, p, i) => {
                                const y = p.yearMetrics[yr]?.yBase || (paddingTop + chartHeight);
                                return i === 0 ? `M ${p.x} ${y}` : `${acc} L ${p.x} ${y}`;
                            }, '');

                            const tgtColor = yearColors[yr]?.targetLine || '#10b981';
                            const baseColor = yearColors[yr]?.baseLine || '#f59e0b';

                            return (
                                <g key={`threshold-lines-${yr}`}>
                                    {/* Baseline Dotted Line */}
                                    <path d={basePath} fill="none" stroke={baseColor} strokeWidth="2" strokeDasharray="3 3" opacity="0.8" />

                                    {/* Target Dashed Line */}
                                    <path d={targetPath} fill="none" stroke={tgtColor} strokeWidth="2.5" strokeDasharray="6 4" opacity="0.9" />

                                    {/* Baseline & Target points */}
                                    {points.map((p, i) => (
                                        <g key={`pts-${yr}-${i}`}>
                                            <circle cx={p.x} cy={p.yearMetrics[yr]?.yBase} r="3" fill={baseColor} />
                                            <circle cx={p.x} cy={p.yearMetrics[yr]?.yTarget} r="3.5" fill={tgtColor} />
                                        </g>
                                    ))}
                                </g>
                            );
                        })}

                        {/* 2. REALISASI CAPAIAN SOLID LINE & DOTS */}
                        {availableYears.map(yr => {
                            const realPath = points.reduce((acc, p, i) => {
                                const y = p.yearMetrics[yr]?.yCapaian || (paddingTop + chartHeight);
                                return i === 0 ? `M ${p.x} ${y}` : `${acc} L ${p.x} ${y}`;
                            }, '');

                            const realColor = yearColors[yr]?.bar || '#a855f7';

                            return (
                                <g key={`realisasi-lines-${yr}`}>
                                    {/* Realisasi Solid Line */}
                                    <path 
                                        d={realPath} 
                                        fill="none" 
                                        stroke={realColor} 
                                        strokeWidth="3" 
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.95" 
                                    />

                                    {/* Realisasi Data Point Circles */}
                                    {points.map((p, i) => {
                                        const ym = p.yearMetrics[yr];
                                        if (!ym) return null;
                                        return (
                                            <circle 
                                                key={`real-pts-${yr}-${i}`}
                                                cx={p.x} 
                                                cy={ym.yCapaian} 
                                                r="4.5" 
                                                fill={realColor} 
                                                stroke="#ffffff"
                                                strokeWidth="2"
                                            />
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* X Axis Labels (Rotated -35deg to prevent overlapping) */}
                        {points.map((p, idx) => (
                            <g key={`x-lbl-${idx}`}>
                                <line 
                                    x1={p.x} 
                                    y1={paddingTop + chartHeight} 
                                    x2={p.x} 
                                    y2={paddingTop + chartHeight + 6} 
                                    stroke="#c0c6d6" 
                                />
                                <text 
                                    x={p.x - 4} 
                                    y={paddingTop + chartHeight + 18} 
                                    transform={`rotate(-35, ${p.x - 4}, ${paddingTop + chartHeight + 18})`}
                                    textAnchor="end" 
                                    fill="#181c23" 
                                    className="text-[11px] font-extrabold tracking-tight"
                                >
                                    {p.item.kode_iku}
                                </text>
                            </g>
                        ))}

                        {/* Hover Overlay Columns */}
                        {points.map((p, idx) => (
                            <rect 
                                key={`hvr-${idx}`}
                                x={p.x - itemWidth / 2} 
                                y={paddingTop} 
                                width={itemWidth} 
                                height={chartHeight} 
                                fill="transparent" 
                                className="cursor-pointer"
                                onMouseEnter={() => setHoverIndex(idx)} 
                                onMouseLeave={() => setHoverIndex(null)}
                            />
                        ))}
                    </svg>

                    {/* Rich Floating Tooltip */}
                    {hoverIndex !== null && points[hoverIndex] && (
                        <div 
                            className="absolute z-30 bg-[#181c23]/95 backdrop-blur-md text-white text-xs p-3.5 rounded-2xl shadow-xl pointer-events-none transition-all border border-white/10"
                            style={{ 
                                left: `${Math.min(width - 260, Math.max(10, points[hoverIndex].x - 120))}px`,
                                top: '20px'
                            }}
                        >
                            <p className="font-extrabold text-[#d6e3ff] text-[11px] border-b border-white/10 pb-1 mb-2 leading-tight">
                                {(() => {
                                    const item = points[hoverIndex].item;
                                    const rawNama = item.nama || '';
                                    if (rawNama.startsWith(item.kode_iku)) return rawNama;
                                    if (/^(IKU|Sub IKU)\s+/i.test(rawNama)) return rawNama;
                                    return `${item.kode_iku} - ${rawNama}`;
                                })()}
                            </p>

                            <div className="space-y-2 text-[10px]">
                                {availableYears.map(yr => {
                                    const ym = points[hoverIndex].yearMetrics[yr];
                                    if (!ym) return null;
                                    return (
                                        <div key={`tt-${yr}`} className="border-b border-white/10 pb-1.5 last:border-0 last:pb-0 space-y-0.5">
                                            <div className="font-extrabold text-[#93c5fd] flex items-center justify-between">
                                                <span>PERIODE {yr}</span>
                                                <span className="font-mono text-white">{ym.hasData ? `${ym.capPct}% Realisasi` : 'Belum ada data'}</span>
                                            </div>
                                            <div className="flex justify-between gap-4 text-white/80">
                                                <span>Target: <strong className="text-[#34d399] font-mono">{ym.tgtVal}</strong></span>
                                                <span>Baseline: <strong className="text-[#fbbf24] font-mono">{ym.baseVal}</strong></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Capaian Semua Unit Bar Chart Component with UX/UI Enhancements
function CapaianSemuaUnitBarChart({ data, selectedTw = 'TW1', selectedTahun = '2026' }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'HIGH' | 'MED' | 'LOW'
    const [sortBy, setSortBy] = useState('REALISASI_DESC');
    const [isExpanded, setIsExpanded] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
    const [isExporting, setIsExporting] = useState(false);

    const getProgressStyles = (val) => {
        const num = Number(val) || 0;
        if (num >= 80) {
            return {
                barColor: 'bg-emerald-500',
                badgeColor: 'bg-emerald-100 text-emerald-700',
                textColor: 'text-emerald-700'
            };
        }
        if (num >= 50) {
            return {
                barColor: 'bg-[#005bb1]',
                badgeColor: 'bg-blue-100 text-[#005bb1]',
                textColor: 'text-[#005bb1]'
            };
        }
        return {
            barColor: 'bg-red-500',
            badgeColor: 'bg-red-100 text-red-700',
            textColor: 'text-red-700'
        };
    };

    // Filter only active units
    const activeData = useMemo(() => {
        return (data || []).filter(u => u.is_active !== false && u.is_active !== 0);
    }, [data]);

    if (!activeData || activeData.length === 0) {
        return (
            <div className="p-8 text-center text-xs text-[#717785] italic">
                Belum ada data capaian unit kerja aktif.
            </div>
        );
    }

    // Unique unit types for tabs
    const unitTypes = ['ALL', ...Array.from(new Set(activeData.map(u => u.type).filter(Boolean)))];

    // Filter units based on selectedType (ALL, PRODI, UNIT, FAKULTAS)
    const currentTypeData = useMemo(() => {
        if (selectedType === 'ALL') return activeData;
        return activeData.filter(u => (u.type || '').toUpperCase() === selectedType.toUpperCase());
    }, [activeData, selectedType]);

    // Counts by performance status (berdasarkan realisasi thd target) per selected unit type!
    const highCount = currentTypeData.filter(u => (Number(u.capaian_realisasi ?? u.capaian) || 0) >= 80).length;
    const medCount = currentTypeData.filter(u => (Number(u.capaian_realisasi ?? u.capaian) || 0) >= 50 && (Number(u.capaian_realisasi ?? u.capaian) || 0) < 80).length;
    const lowCount = currentTypeData.filter(u => (Number(u.capaian_realisasi ?? u.capaian) || 0) < 50).length;

    // Filter & Sort logic
    let filteredData = currentTypeData.filter(unit => {
        const matchSearch = (unit.nama_unit || '').toLowerCase().includes(searchQuery.toLowerCase());
        
        let matchStatus = true;
        const real = Number(unit.capaian_realisasi ?? unit.capaian) || 0;
        if (statusFilter === 'HIGH') matchStatus = real >= 80;
        else if (statusFilter === 'MED') matchStatus = real >= 50 && real < 80;
        else if (statusFilter === 'LOW') matchStatus = real < 50;

        return matchSearch && matchStatus;
    });

    filteredData = [...filteredData].sort((a, b) => {
        const realA = Number(a.capaian_realisasi ?? a.capaian) || 0;
        const realB = Number(b.capaian_realisasi ?? b.capaian) || 0;
        const diajukanA = Number(a.capaian_diajukan) || 0;
        const diajukanB = Number(b.capaian_diajukan) || 0;

        if (sortBy === 'REALISASI_DESC' || sortBy === 'CAPAIAN_DESC') return realB - realA;
        if (sortBy === 'REALISASI_ASC' || sortBy === 'CAPAIAN_ASC') return realA - realB;
        if (sortBy === 'DIAJUKAN_DESC') return diajukanB - diajukanA;
        if (sortBy === 'DIAJUKAN_ASC') return diajukanA - diajukanB;
        if (sortBy === 'NAME_ASC') return (a.nama_unit || '').localeCompare(b.nama_unit || '');
        return 0;
    });

    const handleExportXlsx = async () => {
        if (!filteredData || filteredData.length === 0) {
            alert('Tidak ada data capaian unit kerja untuk diexport.');
            return;
        }

        setIsExporting(true);

        const rowsForExport = filteredData.map((u, index) => {
            const pctDiajukan = Number(u.capaian_diajukan) || 0;
            const pctRealisasi = Number(u.capaian_realisasi ?? u.capaian) || 0;
            let statusText = 'Perlu Perhatian (<50%)';
            if (pctRealisasi >= 80) statusText = 'Tinggi (≥80%)';
            else if (pctRealisasi >= 50) statusText = 'Sedang (50-79%)';

            return {
                no: index + 1,
                nama_unit: u.nama_unit || '-',
                type: u.type || '-',
                triwulan: selectedTw || 'TW1',
                data_diajukan: u.total_laporan || 0,
                total_penugasan: u.total_assigned || 0,
                persentase_diajukan: `${pctDiajukan}%`,
                persentase_realisasi: `${pctRealisasi}%`,
                status_ketercapaian: statusText
            };
        });

        try {
            const res = await fetch('/api/dashboard/export-capaian-unit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tw: selectedTw || 'TW1',
                    tahun: selectedTahun || '2026',
                    type: selectedType,
                    status_filter: statusFilter,
                    rows: rowsForExport
                })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const typeSuffix = selectedType !== 'ALL' ? `_${selectedType}` : '';
                a.download = `Capaian_Unit_Kerja_${selectedTw || 'TW1'}_${selectedTahun || '2026'}${typeSuffix}.xlsx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                return;
            }
            throw new Error('Server export failed');
        } catch (err) {
            console.warn('Fallback to client-side CSV export:', err);
            let csv = "data:text/csv;charset=utf-8,\uFEFF";
            csv += "No;Nama Unit Kerja;Tipe Unit;Triwulan;Data Diajukan;Total Indikator Ditugaskan;Persentase Diajukan;Ketercapaian Realisasi thd Target;Kategori Status\n";
            rowsForExport.forEach(r => {
                csv += `${r.no};"${(r.nama_unit || '').replace(/"/g, '""')}";"${r.type}";"${r.triwulan}";${r.data_diajukan};${r.total_penugasan};"${r.persentase_diajukan}";"${r.persentase_realisasi}";"${r.status_ketercapaian}"\n`;
            });
            const encodedUri = encodeURI(csv);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            const typeSuffix = selectedType !== 'ALL' ? `_${selectedType}` : '';
            link.setAttribute('download', `Capaian_Unit_Kerja_${selectedTw || 'TW1'}_${selectedTahun || '2026'}${typeSuffix}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } finally {
            setIsExporting(false);
        }
    };

    const DEFAULT_LIMIT = 6;
    const visibleData = isExpanded ? filteredData : filteredData.slice(0, DEFAULT_LIMIT);
    const hiddenCount = filteredData.length - DEFAULT_LIMIT;

    return (
        <div className="space-y-5">
            {/* Status Summary Pill Badges & View Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#f9f9ff] p-3 rounded-2xl border border-[#c0c6d6]/20">
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="text-[#535f71] mr-1 font-extrabold uppercase text-[10px] tracking-wider">
                        Ringkasan Status {selectedType !== 'ALL' ? `(${selectedType})` : ''}:
                    </span>

                    {/* Button High */}
                    <button
                        type="button"
                        onClick={() => {
                            setStatusFilter(prev => prev === 'HIGH' ? 'ALL' : 'HIGH');
                            setIsExpanded(false);
                        }}
                        className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                            statusFilter === 'HIGH'
                                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/40 font-black'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                        title={statusFilter === 'HIGH' ? "Klik untuk membatalkan filter" : "Klik untuk memfilter unit status Tinggi"}
                    >
                        <span className={`w-2 h-2 rounded-full ${statusFilter === 'HIGH' ? 'bg-white' : 'bg-emerald-500'}`}></span>
                        <span>Tinggi (≥80%):</span>
                        <strong className={`font-mono ${statusFilter === 'HIGH' ? 'text-white' : 'text-emerald-900'}`}>{highCount}</strong>
                    </button>

                    {/* Button Medium */}
                    <button
                        type="button"
                        onClick={() => {
                            setStatusFilter(prev => prev === 'MED' ? 'ALL' : 'MED');
                            setIsExpanded(false);
                        }}
                        className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                            statusFilter === 'MED'
                                ? 'bg-[#005bb1] text-white shadow-xs ring-2 ring-[#005bb1]/40 font-black'
                                : 'bg-blue-100 text-[#005bb1] hover:bg-blue-200'
                        }`}
                        title={statusFilter === 'MED' ? "Klik untuk membatalkan filter" : "Klik untuk memfilter unit status Sedang"}
                    >
                        <span className={`w-2 h-2 rounded-full ${statusFilter === 'MED' ? 'bg-white' : 'bg-[#005bb1]'}`}></span>
                        <span>Sedang (50-79%):</span>
                        <strong className={`font-mono ${statusFilter === 'MED' ? 'text-white' : 'text-[#001b3d]'}`}>{medCount}</strong>
                    </button>

                    {/* Button Low */}
                    <button
                        type="button"
                        onClick={() => {
                            setStatusFilter(prev => prev === 'LOW' ? 'ALL' : 'LOW');
                            setIsExpanded(false);
                        }}
                        className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer ${
                            statusFilter === 'LOW'
                                ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-600/40 font-black'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        title={statusFilter === 'LOW' ? "Klik untuk membatalkan filter" : "Klik untuk memfilter unit status Perlu Perhatian"}
                    >
                        <span className={`w-2 h-2 rounded-full ${statusFilter === 'LOW' ? 'bg-white' : 'bg-red-500'}`}></span>
                        <span>Perlu Perhatian (&lt;50%):</span>
                        <strong className={`font-mono ${statusFilter === 'LOW' ? 'text-white' : 'text-red-900'}`}>{lowCount}</strong>
                    </button>

                    {/* Reset Status Filter Button if active */}
                    {statusFilter !== 'ALL' && (
                        <button
                            type="button"
                            onClick={() => {
                                setStatusFilter('ALL');
                                setIsExpanded(false);
                            }}
                            className="text-[10px] text-[#535f71] hover:text-[#181c23] hover:underline flex items-center gap-0.5 ml-1 cursor-pointer font-bold"
                            title="Tampilkan semua status"
                        >
                            <span className="material-symbols-outlined text-[13px]">close</span>
                            Reset Filter Status
                        </button>
                    )}
                </div>

                {/* Right controls: Export XLSX & View Mode Switcher */}
                <div className="flex items-center gap-2 self-end md:self-auto">
                    <button
                        type="button"
                        onClick={handleExportXlsx}
                        disabled={isExporting}
                        className="flex items-center gap-1.5 bg-[#005bb1] text-white hover:bg-[#0073dd] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Download Rekap Capaian Unit Kerja format Excel (.xlsx)"
                    >
                        <span className={`material-symbols-outlined text-[16px] ${isExporting ? 'animate-spin' : ''}`}>
                            {isExporting ? 'progress_activity' : 'download'}
                        </span>
                        <span>{isExporting ? 'Mengunduh...' : 'Export XLSX'}</span>
                    </button>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#c0c6d6]/30 shadow-2xs">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-[#005bb1] text-white' : 'text-[#535f71] hover:bg-[#f1f3fe]'}`}
                            title="Tampilan Grid Kartu"
                        >
                            <span className="material-symbols-outlined text-sm block">grid_view</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-[#005bb1] text-white' : 'text-[#535f71] hover:bg-[#f1f3fe]'}`}
                            title="Tampilan Ranking List"
                        >
                            <span className="material-symbols-outlined text-sm block">format_list_bulleted</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Filtering & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Unit Type Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                    {unitTypes.map(type => {
                        const count = type === 'ALL' ? activeData.length : activeData.filter(u => u.type === type).length;
                        const label = type === 'ALL' ? 'Semua Unit' : type;
                        return (
                            <button
                                key={type}
                                onClick={() => {
                                    setSelectedType(type);
                                    setIsExpanded(false);
                                    setStatusFilter('ALL');
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                                    selectedType === type
                                        ? 'bg-[#005bb1] text-white shadow-xs'
                                        : 'bg-[#f1f3fe] text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                {label} ({count})
                            </button>
                        );
                    })}
                </div>

                {/* Search & Sort Input Controls */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-grow sm:w-48">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#717785] text-base pointer-events-none">search</span>
                        <input
                            type="text"
                            placeholder="Cari Unit Kerja..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-[#c0c6d6]/40 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-[#181c23] placeholder-[#717785] outline-none focus:border-[#005bb1] focus:ring-1 focus:ring-[#005bb1]"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#717785] hover:text-[#181c23]"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        )}
                    </div>

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-white border border-[#c0c6d6]/40 rounded-xl px-3 py-1.5 text-xs font-bold text-[#181c23] outline-none cursor-pointer focus:border-[#005bb1]"
                    >
                        <option value="REALISASI_DESC">Realisasi Tertinggi</option>
                        <option value="REALISASI_ASC">Realisasi Terendah</option>
                        <option value="DIAJUKAN_DESC">Pengajuan Tertinggi</option>
                        <option value="DIAJUKAN_ASC">Pengajuan Terendah</option>
                        <option value="NAME_ASC">Nama (A-Z)</option>
                    </select>
                </div>
            </div>

            {/* Empty Search Result State */}
            {filteredData.length === 0 ? (
                <div className="p-8 text-center bg-[#f9f9ff] rounded-2xl border border-[#c0c6d6]/20 space-y-2">
                    <span className="material-symbols-outlined text-[#717785] text-3xl">search_off</span>
                    <p className="text-xs text-[#535f71] font-medium">Tidak ada unit kerja yang sesuai dengan kata kunci "{searchQuery}".</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* GRID CARD VIEW (2 BARS: DIAJUKAN & REALISASI TARGET) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleData.map((unit, idx) => {
                        const pctDiajukan = Number(unit.capaian_diajukan) || 0;
                        const pctRealisasi = Number(unit.capaian_realisasi ?? unit.capaian) || 0;

                        const styleDiajukan = getProgressStyles(pctDiajukan);
                        const styleRealisasi = getProgressStyles(pctRealisasi);

                        return (
                            <div key={unit.id} className="bg-[#f9f9ff] border border-[#c0c6d6]/25 rounded-2xl p-4 space-y-3.5 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-extrabold text-[#181c23] truncate" title={unit.nama_unit}>{unit.nama_unit}</h4>
                                        <span className="text-[9px] font-bold text-[#717785] uppercase tracking-wider">{unit.type}</span>
                                    </div>
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex-shrink-0 ${styleRealisasi.badgeColor}`}>
                                        {pctRealisasi}%
                                    </span>
                                </div>

                                {/* 2 Progress Bars */}
                                <div className="space-y-3 pt-0.5">
                                    {/* Bar 1: Total Status Diajukan */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-[#535f71] flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs text-[#005bb1]">upload_file</span>
                                                Data Diajukan ({unit.total_laporan || 0}/{unit.total_assigned || 0})
                                            </span>
                                            <span className={`font-black ${styleDiajukan.textColor}`}>
                                                {pctDiajukan}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#e8ecf4] h-2 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${styleDiajukan.barColor}`} 
                                                style={{ width: `${Math.min(100, Math.max(0, pctDiajukan))}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Bar 2: Ketercapaian Realisasi thd Target */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-[#535f71] flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs text-emerald-600">track_changes</span>
                                                Realisasi thd Target
                                            </span>
                                            <span className={`font-black ${styleRealisasi.textColor}`}>
                                                {pctRealisasi}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-[#e8ecf4] h-2 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${styleRealisasi.barColor}`} 
                                                style={{ width: `${Math.min(100, Math.max(0, pctRealisasi))}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between items-center text-[9px] text-[#717785] font-semibold pt-0.5">
                                            <span>Ketercapaian Kinerja</span>
                                            <span>Target 100%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* RANKING LIST VIEW (2 BARS) */
                <div className="bg-[#f9f9ff] border border-[#c0c6d6]/25 rounded-2xl divide-y divide-[#c0c6d6]/15 overflow-hidden">
                    {visibleData.map((unit, idx) => {
                        const pctDiajukan = Number(unit.capaian_diajukan) || 0;
                        const pctRealisasi = Number(unit.capaian_realisasi ?? unit.capaian) || 0;

                        const styleDiajukan = getProgressStyles(pctDiajukan);
                        const styleRealisasi = getProgressStyles(pctRealisasi);

                        return (
                            <div key={unit.id} className="p-3.5 flex items-center gap-4 hover:bg-white transition-colors">
                                <span className="w-6 text-center text-xs font-black text-[#717785]">#{idx + 1}</span>
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h4 className="text-xs font-bold text-[#181c23] truncate">{unit.nama_unit}</h4>
                                            <span className="text-[9px] font-bold text-[#717785] bg-[#ebedf8] px-2 py-0.5 rounded uppercase flex-shrink-0">{unit.type}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${styleRealisasi.badgeColor}`}>
                                            {pctRealisasi}%
                                        </span>
                                    </div>

                                    {/* 2 Progress Bars in List View */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                                        {/* Bar 1: Status Diajukan */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[9px] font-bold text-[#535f71]">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs text-[#005bb1]">upload_file</span>
                                                    Diajukan ({unit.total_laporan || 0}/{unit.total_assigned || 0})
                                                </span>
                                                <span className={styleDiajukan.textColor}>{pctDiajukan}%</span>
                                            </div>
                                            <div className="w-full bg-[#e8ecf4] h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${styleDiajukan.barColor}`} 
                                                    style={{ width: `${Math.min(100, Math.max(0, pctDiajukan))}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Bar 2: Realisasi thd Target */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center text-[9px] font-bold text-[#535f71]">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs text-emerald-600">track_changes</span>
                                                    Realisasi thd Target
                                                </span>
                                                <span className={styleRealisasi.textColor}>{pctRealisasi}%</span>
                                            </div>
                                            <div className="w-full bg-[#e8ecf4] h-1.5 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${styleRealisasi.barColor}`} 
                                                    style={{ width: `${Math.min(100, Math.max(0, pctRealisasi))}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Show More / Show Less Toggle Button */}
            {filteredData.length > DEFAULT_LIMIT && (
                <div className="flex justify-center pt-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="inline-flex items-center gap-2 bg-[#f1f3fe] hover:bg-[#005bb1] text-[#005bb1] hover:text-white border border-[#005bb1]/20 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 shadow-2xs group"
                    >
                        <span>
                            {isExpanded 
                                ? 'Tampilkan Ringkas (Top 6 Unit)' 
                                : `Tampilkan Selengkapnya (${hiddenCount} Unit Lainnya)`
                            }
                        </span>
                        <span className="material-symbols-outlined text-base transition-transform group-hover:scale-110">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}



export default function Dashboard() {
    const user = usePage().props.auth.user;

    const [stats, setStats] = useState(null);
    const [units, setUnits] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedTahun, setSelectedTahun] = useState('2026');

    const isWarekUser = Boolean(
        stats?.is_warek ||
        (user?.nama_unit && user.nama_unit.toUpperCase().includes('WAKIL REKTOR')) ||
        (user?.name && user.name.toUpperCase().includes('WAKIL REKTOR')) ||
        (user?.username && user.username.toUpperCase().includes('WAKIL_REKTOR')) ||
        (user?.role && user.role.toUpperCase().includes('WAKIL REKTOR'))
    );
    const isFacultyUser = Boolean(
        (user && user.role === 'FAKULTAS') ||
        stats?.is_faculty ||
        (user?.nama_unit && user.nama_unit.toUpperCase().includes('FAKULTAS')) ||
        (user?.name && user.name.toUpperCase().includes('FAKULTAS'))
    );
    const isAdminUser = Boolean(user && ['ADMIN', 'LPM'].includes(user.role));
    const isPrivilegedScope = Boolean(isFacultyUser || stats?.is_faculty || isAdminUser || isWarekUser || stats?.is_privileged);
    const isSingleUnitUser = Boolean(user && !['ADMIN', 'LPM', 'FAKULTAS'].includes(user.role) && !isWarekUser);

    const canToggleSelfOnly = Boolean(!isAdminUser && (isFacultyUser || isWarekUser || stats?.is_faculty || stats?.is_warek));
    const [onlyCurrentUnit, setOnlyCurrentUnit] = useState(true);

    const [selectedUnit, setSelectedUnit] = useState(isSingleUnitUser ? (user?.fakultas_unit || '') : '');
    const [loading, setLoading] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);

    const [activePeriod, setActivePeriod] = useState('TW3');
    const [chartTwFilter, setChartTwFilter] = useState('ALL');
    const [unitTwFilter, setUnitTwFilter] = useState('TW3');
    const [capaianTab, setCapaianTab] = useState('trim'); // 'trim' | 'real'

    // Global Scoped State for Faculty View
    const [scopeTab, setScopeTab] = useState('fakultas');
    const [selectedProdi, setSelectedProdi] = useState('ALL');
    const [selectedIkuFilter4, setSelectedIkuFilter4] = useState('');

    const activeUnitId = useMemo(() => {
        if (selectedUnit && Number(selectedUnit) !== Number(user?.fakultas_unit)) {
            return Number(selectedUnit);
        }
        return Number(user?.fakultas_unit || (isFacultyUser && stats?.faculty_unit?.id) || selectedUnit);
    }, [selectedUnit, user, isFacultyUser, stats]);

    // Export ZIP Background & Chunk Download State
    const [exportModalState, setExportModalState] = useState({
        isOpen: false,
        tw: null,
        tahun: null,
        jobId: null,
        status: 'idle', // 'idle' | 'initiating' | 'processing' | 'downloading' | 'completed' | 'failed'
        progress: 0,
        message: '',
        chunkProgress: null, // { current: 1, total: 5, percent: 20 }
        error: null,
        zipFilename: null,
        fileSize: 0,
        needAuth: false,
        authUrl: null,
    });

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleStartExportZip = async (twKey, force = false) => {
        setExportModalState({
            isOpen: true,
            tw: twKey,
            tahun: selectedTahun,
            jobId: null,
            status: 'initiating',
            progress: 5,
            message: 'Menghubungkan ke server untuk memulai proses ekspor...',
            chunkProgress: null,
            error: null,
            zipFilename: null,
            fileSize: 0,
            needAuth: false,
            authUrl: null,
        });

        try {
            const res = await axios.post('/api/dashboard/export-tw-zip/start', {
                tw: twKey,
                tahun: selectedTahun,
                force: force
            });

            if (res.data.need_auth) {
                setExportModalState(prev => ({
                    ...prev,
                    status: 'failed',
                    needAuth: true,
                    authUrl: res.data.auth_url,
                    message: 'Otentikasi Google Drive Diperlukan',
                    error: 'Akun Google Drive belum dihubungkan atau izin akses telah kedaluwarsa.'
                }));
                return;
            }

            const { job_id, status, progress, message, total_chunks, file_size, zip_filename } = res.data;

            if (status === 'completed') {
                setExportModalState(prev => ({
                    ...prev,
                    jobId: job_id,
                    status: 'downloading',
                    progress: 100,
                    message: 'Berkas arsip siap! Memulai unduhan bertahap (chunk download)...',
                    zipFilename: zip_filename,
                    fileSize: file_size
                }));
                startChunkedDownload(job_id, total_chunks, zip_filename, file_size);
            } else {
                setExportModalState(prev => ({
                    ...prev,
                    jobId: job_id,
                    status: 'processing',
                    progress: progress || 10,
                    message: message || 'Server sedang mengunduh dan menyusun berkas dari Google Drive...'
                }));
                startStatusPolling(job_id);
            }
        } catch (err) {
            console.error('Failed to start export zip', err);
            setExportModalState(prev => ({
                ...prev,
                status: 'failed',
                error: err.response?.data?.error || err.message || 'Terjadi kesalahan saat memulai proses ekspor.'
            }));
        }
    };

    const startStatusPolling = (jobId) => {
        let isCancelled = false;

        const interval = setInterval(async () => {
            if (isCancelled) return;

            try {
                const res = await axios.get(`/api/dashboard/export-tw-zip/status?job_id=${encodeURIComponent(jobId)}`);
                const data = res.data;

                if (data.status === 'completed') {
                    clearInterval(interval);
                    isCancelled = true;

                    setExportModalState(prev => ({
                        ...prev,
                        status: 'downloading',
                        progress: 100,
                        message: 'Pembuatan berkas ZIP di server selesai! Memulai unduhan ke browser...',
                        zipFilename: data.zip_filename,
                        fileSize: data.file_size
                    }));

                    startChunkedDownload(jobId, data.total_chunks, data.zip_filename, data.file_size);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    isCancelled = true;

                    setExportModalState(prev => ({
                        ...prev,
                        status: 'failed',
                        error: data.error || data.message || 'Gagal membuat arsip ZIP di server.'
                    }));
                } else {
                    setExportModalState(prev => ({
                        ...prev,
                        status: 'processing',
                        progress: data.progress || prev.progress,
                        message: data.message || prev.message
                    }));
                }
            } catch (err) {
                console.error('Polling export status error', err);
            }
        }, 2000);
    };

    const startChunkedDownload = async (jobId, totalChunks, zipFilename, fileSize) => {
        const total = totalChunks || 1;
        const chunkBuffers = [];

        try {
            for (let i = 0; i < total; i++) {
                const currentPercent = Math.round((i / total) * 100);
                setExportModalState(prev => ({
                    ...prev,
                    status: 'downloading',
                    chunkProgress: {
                        current: i + 1,
                        total: total,
                        percent: currentPercent
                    },
                    message: `Mengunduh bagian data ${i + 1} dari ${total} (${currentPercent}%)...`
                }));

                const response = await fetch(`/api/dashboard/export-tw-zip/chunk?job_id=${encodeURIComponent(jobId)}&chunk=${i}`);
                if (!response.ok) {
                    throw new Error(`Gagal mengunduh bagian data ${i + 1} (HTTP ${response.status})`);
                }

                const arrayBuffer = await response.arrayBuffer();
                chunkBuffers.push(arrayBuffer);
            }

            setExportModalState(prev => ({
                ...prev,
                status: 'completed',
                progress: 100,
                chunkProgress: {
                    current: total,
                    total: total,
                    percent: 100
                },
                message: 'Semua bagian data lengkap! Menyimpan berkas ke komputer Anda...'
            }));

            const blob = new Blob(chunkBuffers, { type: 'application/zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = zipFilename || `IKU_System.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 30000);

            setExportModalState(prev => ({
                ...prev,
                message: `Berkas ${zipFilename || 'ZIP'} berhasil diunduh dan disimpan di komputer!`
            }));

        } catch (err) {
            console.error('Chunk download error', err);
            setExportModalState(prev => ({
                ...prev,
                status: 'failed',
                error: err.message || 'Gagal mengunduh bagian data berkas ZIP.'
            }));
        }
    };

    useEffect(() => {
        Promise.all([
            fetch('/api/master/units').then(res => res.json()),
            fetch('/api/master/tahun').then(res => res.json())
        ])
        .then(([unitsData, yearsData]) => {
            setUnits(unitsData);
            if (yearsData.length > 0) setYears(yearsData);
            if (!isAdminUser && user?.fakultas_unit) {
                setSelectedUnit(user.fakultas_unit);
            }
        })
        .catch(err => console.error(err));
    }, []);

    // Real-time EventSource WebSocket / SSE Data Stream
    useEffect(() => {
        loadSummary();

        let streamUrl = `/api/dashboard/summary?stream=1&tahun=${selectedTahun}&triwulan=${chartTwFilter}&unit_tw=${unitTwFilter}`;
        if (selectedUnit) streamUrl += `&unit=${selectedUnit}`;

        const eventSource = new EventSource(streamUrl);
        setIsStreaming(true);

        eventSource.addEventListener('dashboard_update', (e) => {
            try {
                const data = JSON.parse(e.data);
                setStats(data);
                setLoading(false);
            } catch (err) {
                console.error("Dashboard stream error", err);
            }
        });

        eventSource.onerror = () => {
            setIsStreaming(false);
            eventSource.close();
        };

        // Instantly close EventSource connection on Inertia page navigation start!
        const removeStartListener = router.on('start', () => {
            setIsStreaming(false);
            eventSource.close();
        });

        return () => {
            setIsStreaming(false);
            eventSource.close();
            if (typeof removeStartListener === 'function') {
                removeStartListener();
            }
        };
    }, [selectedTahun, selectedUnit, chartTwFilter, unitTwFilter]);

    const loadSummary = () => {
        setLoading(true);
        let url = `/api/dashboard/summary?tahun=${selectedTahun}&triwulan=${chartTwFilter}&unit_tw=${unitTwFilter}`;
        if (selectedUnit) url += `&unit=${selectedUnit}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const resolveScopedData = (tab, prodiId) => {
        if (!stats?.views) {
            return stats;
        }
        if (tab === 'fakultas') {
            return stats.views.fakultas || stats;
        }
        if (prodiId === 'ALL' || !prodiId) {
            return stats.views.prodi_all || stats;
        }
        return stats.views.by_prodi?.[prodiId] || stats.views.prodi_all || stats;
    };

    // Scoped Data for Dashboard (Fakultas vs Prodi)
    const scopedData = resolveScopedData(scopeTab, selectedProdi);

    // Scoped Data for Card 1 (Ringkasan Capaian Triwulan & Keseluruhan)
    const twSummary1 = capaianTab === 'real'
        ? (scopedData?.triwulan_summary_real ?? scopedData?.triwulan_summary ?? {})
        : (scopedData?.triwulan_summary_trim ?? scopedData?.triwulan_summary ?? {});
    const overallCapaian1 = capaianTab === 'real'
        ? (scopedData?.overall_capaian_real ?? scopedData?.overall_capaian ?? 0)
        : (scopedData?.overall_capaian_trim ?? scopedData?.overall_capaian ?? 0);

    // Scoped Data for Card 2 (Sebaran Capaian Per IKU)
    const sebaranPerIku2 = capaianTab === 'real'
        ? (scopedData?.sebaran_per_iku_real ?? scopedData?.sebaran_per_iku ?? [])
        : (scopedData?.sebaran_per_iku_trim ?? scopedData?.sebaran_per_iku ?? []);

    // Scoped Data for Card 3 (Capaian Realisasi Unit Kerja)
    const capaianPerUnit3 = capaianTab === 'real'
        ? (scopedData?.capaian_per_unit_real ?? scopedData?.capaian_per_unit ?? [])
        : (scopedData?.capaian_per_unit_trim ?? scopedData?.capaian_per_unit ?? []);

    // Scoped Data for Card 4 (Performance Distribution)
    const perIku4 = useMemo(() => {
        if (!stats) return [];
        if (stats.views && scopeTab === 'prodi' && selectedProdi && selectedProdi !== 'ALL') {
            return stats.views.by_prodi?.[selectedProdi]?.per_iku || stats.per_iku || [];
        }
        return stats.per_iku || [];
    }, [stats, scopeTab, selectedProdi]);

    const ikuOptions4 = useMemo(() => {
        if (!perIku4 || perIku4.length === 0) return [];
        const seen = new Set();
        const options = [];
        perIku4.forEach(iku => {
            const idKey = String(iku.id_indikator || iku.id);
            if (!seen.has(idKey)) {
                seen.add(idKey);
                const desc = iku.full_kategori || iku.nama_indikator || '';
                const searchStr = `${iku.kode_iku || ''} ${desc} ${iku.kategori || ''} ${iku.satuan || ''}`.toLowerCase();
                options.push({
                    value: idKey,
                    label: iku.kode_iku ? `${iku.kode_iku} - ${desc}` : desc,
                    badge: null,
                    searchStr: searchStr
                });
            }
        });
        return options;
    }, [perIku4]);

    const displayedPerIku4 = useMemo(() => {
        if (!perIku4) return [];
        let items = perIku4;

        if (canToggleSelfOnly && onlyCurrentUnit && activeUnitId) {
            if (selectedUnit !== '') {
                items = items.filter(iku => Number(iku.unit_id) === Number(activeUnitId));
            }
        }

        if (selectedIkuFilter4) {
            items = items.filter(iku => String(iku.id_indikator || iku.id) === String(selectedIkuFilter4));
        }
        return items;
    }, [perIku4, canToggleSelfOnly, onlyCurrentUnit, activeUnitId, selectedUnit, selectedIkuFilter4]);

    useEffect(() => {
        if (selectedIkuFilter4) {
            const exists = perIku4 && perIku4.some(i => String(i.id_indikator || i.id) === String(selectedIkuFilter4));
            if (!exists) {
                setSelectedIkuFilter4('');
            }
        }
    }, [perIku4, selectedIkuFilter4]);

    // Fallbacks
    const twSummary = twSummary1;
    const overallCapaian = overallCapaian1;
    const sebaranPerIku = sebaranPerIku2;
    const capaianPerUnit = capaianPerUnit3;

    const renderStatusBadge = (status) => {
        if (!status) {
            return (
                <span className="bg-gray-100 text-gray-500 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                    BELUM ADA DATA
                </span>
            );
        }
        switch (status) {
            case 'DISAHKAN':
                return (
                    <span className="bg-green-100 text-green-700 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-200">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                        DISAHKAN
                    </span>
                );
            case 'DIVERIFIKASI':
                return (
                    <span className="bg-blue-100 text-blue-700 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-200">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                        DIVERIFIKASI
                    </span>
                );
            case 'DIAJUKAN':
                return (
                    <span className="bg-amber-100 text-amber-700 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-200">
                        <span className="w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                        DIAJUKAN
                    </span>
                );
            default:
                return (
                    <span className="bg-gray-100 text-gray-700 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-gray-200">
                        {status}
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout pageTitle="Executive Dashboard">
            <Head title="Executive Dashboard - Performance Portal" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-[#181c23]">Monitoring Performa IKU</h2>
                        {isStreaming && (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase shadow-2xs animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                LIVE REALTIME DATA
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[#535f71] mt-0.5">Evaluasi realisasi capaian secara real-time</p>
                </div>

                {/* Header Actions: Tab Switcher & Filter Tahun */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Mode Tabs Switcher in Header */}
                    <div className="flex items-center bg-white border border-[#c0c6d6]/40 rounded-xl p-1 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setCapaianTab('real')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
                                capaianTab === 'real'
                                    ? 'bg-[#005bb1] text-white shadow-xs'
                                    : 'text-[#535f71] hover:text-[#181c23]'
                            }`}
                            title="Tampilkan data apa adanya (termasuk realisasi 0)"
                        >
                            <span className="material-symbols-outlined text-[15px]">bar_chart</span>
                            <span>Tab Real</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setCapaianTab('trim')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-200 cursor-pointer ${
                                capaianTab === 'trim'
                                    ? 'bg-[#005bb1] text-white shadow-xs'
                                    : 'text-[#535f71] hover:text-[#181c23]'
                            }`}
                            title="Tampilkan data tanpa mengikutsertakan realisasi 0"
                        >
                            <span className="material-symbols-outlined text-[15px]">tune</span>
                            <span>Tab Trim</span>
                        </button>
                    </div>

                    {stats?.is_faculty && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center bg-white border border-[#c0c6d6]/40 rounded-xl p-1 shadow-xs">
                                <span className="text-[10px] font-extrabold text-[#717785] uppercase tracking-wider px-2">Set Semua Section:</span>
                                <button
                                    type="button"
                                    onClick={() => setScopeTab('fakultas')}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        scopeTab === 'fakultas'
                                            ? 'bg-[#005bb1] text-white shadow-xs'
                                            : 'text-[#535f71] hover:text-[#181c23]'
                                    }`}
                                    title="Tampilkan Fakultas pada seluruh section"
                                >
                                    <span className="material-symbols-outlined text-[14px]">apartment</span>
                                    <span>Fakultas</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScopeTab('prodi')}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        scopeTab === 'prodi'
                                            ? 'bg-[#005bb1] text-white shadow-xs'
                                            : 'text-[#535f71] hover:text-[#181c23]'
                                    }`}
                                    title="Tampilkan Program Studi pada seluruh section"
                                >
                                    <span className="material-symbols-outlined text-[14px]">school</span>
                                    <span>Prodi</span>
                                </button>
                            </div>

                            {/* Dropdown prodi saat tab Prodi dipilih */}
                            {scopeTab === 'prodi' && (
                                <div className="flex items-center gap-1.5 bg-white border border-[#005bb1]/30 rounded-xl px-3 py-1.5 text-xs font-bold shadow-xs animate-in fade-in duration-200">
                                    <span className="material-symbols-outlined text-[#005bb1] text-base">filter_alt</span>
                                    <select
                                        value={selectedProdi}
                                        onChange={(e) => setSelectedProdi(e.target.value)}
                                        className="bg-transparent border-none text-xs font-extrabold text-[#005bb1] outline-none cursor-pointer pr-2 max-w-[240px] truncate"
                                    >
                                        <option value="ALL">-- Semua Prodi ({stats?.faculty_unit?.nama || 'Fakultas'}) --</option>
                                        {(stats?.prodi_units || []).map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.jenjang ? `${p.jenjang.toUpperCase()} - ` : ''}{p.nama_fak_prod_unit}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-white border border-[#c0c6d6]/40 rounded-xl px-4 py-2 text-xs font-bold text-[#181c23] shadow-xs">
                        <span className="material-symbols-outlined text-[#005bb1] text-lg">calendar_today</span>
                        <span className="text-xs font-bold text-[#717785]">Tahun:</span>
                        <select 
                            value={selectedTahun} 
                            onChange={(e) => setSelectedTahun(e.target.value)}
                            className="bg-transparent border-none text-xs font-extrabold text-[#005bb1] outline-none cursor-pointer pr-2"
                        >
                            {years.map(y => (
                                <option key={y.tahun} value={y.tahun}>Tahun {y.tahun}</option>
                            ))}
                            <option value="ALL">Semua Tahun</option>
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[400px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-4xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* CARD 1: OVERALL CAPAIAN & 4 TRIWULAN CARDS (FULL WIDTH 1 COLUMN) */}
                    <div className="bg-white rounded-2xl sm:rounded-[2rem] p-4 sm:p-8 shadow-sm border border-[#c0c6d6]/20 space-y-6">
                        {/* Section Header with Tab Real / Tab Trim Switcher */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#c0c6d6]/15">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#005bb1]/10 flex items-center justify-center text-[#005bb1]">
                                    <span className="material-symbols-outlined text-lg">insights</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-extrabold text-[#181c23] uppercase tracking-wider">
                                        Ringkasan Capaian Triwulan & Keseluruhan
                                    </h3>
                                    <p className="text-[11px] text-[#717785]">
                                        {capaianTab === 'real'
                                            ? 'Mode Tab Real: Menghitung seluruh capaian indikator apa adanya (termasuk nilai 0)'
                                            : 'Mode Tab Trim: Mengabaikan indikator dengan realisasi 0 dari pembagi rata-rata capaian'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Dual Tabs Control */}
                                <div className="flex items-center bg-[#f1f3fe] p-1.5 rounded-2xl border border-[#c0c6d6]/30 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setCapaianTab('real')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${
                                            capaianTab === 'real'
                                                ? 'bg-white text-[#005bb1] shadow-xs ring-1 ring-black/5'
                                                : 'text-[#535f71] hover:text-[#181c23]'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">bar_chart</span>
                                        <span>Tab Real</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                                            capaianTab === 'real' ? 'bg-[#005bb1]/10 text-[#005bb1]' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            Semua Data
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCapaianTab('trim')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer ${
                                            capaianTab === 'trim'
                                                ? 'bg-[#005bb1] text-white shadow-xs'
                                                : 'text-[#535f71] hover:text-[#181c23]'
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-sm">tune</span>
                                        <span>Tab Trim</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
                                            capaianTab === 'trim' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                                        }`}>
                                            Tanpa Realisasi 0
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            {/* Overall Capaian Banner */}
                            <div className="lg:col-span-4 bg-[#005bb1] text-white p-6 rounded-[1.8rem] shadow-lg relative overflow-hidden flex flex-col justify-between h-52">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                                            OVERALL CAPAIAN ({selectedTahun === 'ALL' ? 'SEMUA TAHUN' : selectedTahun})
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-xs">
                                            {capaianTab === 'real' ? 'MODE REAL' : 'MODE TRIM'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1">
                                        <span className="text-5xl font-extrabold tracking-tight">
                                            {overallCapaian1.toString().replace('.', ',')}
                                        </span>
                                        <span className="text-2xl font-bold opacity-80">%</span>
                                    </div>
                                </div>
                                <p className="text-xs text-white/80 mt-1 font-medium">
                                    {capaianTab === 'real' 
                                        ? 'Rata-rata kumulatif capaian realisasi (termasuk indikator bernilai 0)'
                                        : 'Rata-rata kumulatif capaian realisasi (indikator bernilai 0 tidak dihitung)'}
                                </p>
                            </div>

                            {/* 4 Triwulan Grid Cards */}
                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {['TW1', 'TW2', 'TW3', 'TW4'].map((twKey, idx) => {
                                    const twData = twSummary1[twKey] || {
                                        capaian: 0,
                                        isian_percent: 0,
                                        status: 'DRAFT',
                                        is_closed: true
                                    };
                                    const isTw3 = twKey === 'TW3';
                                    return (
                                        <div 
                                            key={twKey} 
                                            className={`bg-[#f9f9ff] p-4 rounded-[1.5rem] border transition-all ${
                                                isTw3 ? 'border-[#3b44c6] ring-2 ring-[#3b44c6]/20' : 'border-[#c0c6d6]/20'
                                            }`}
                                        >
                                            {/* Progress Circle & Badge */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                                                    <svg className="w-12 h-12 -rotate-90">
                                                        <circle 
                                                            cx="24" 
                                                            cy="24" 
                                                            r="20" 
                                                            fill="transparent" 
                                                            stroke="#e8ecf4" 
                                                            strokeWidth="4" 
                                                        />
                                                        {Math.round(twData.capaian) > 0 && (
                                                            <circle 
                                                                cx="24" 
                                                                cy="24" 
                                                                r="20" 
                                                                fill="transparent" 
                                                                stroke="#f43f5e" 
                                                                strokeWidth="4" 
                                                                strokeDasharray={125.6} 
                                                                strokeDashoffset={125.6 - (125.6 * Math.min(100, Math.round(twData.capaian))) / 100} 
                                                                strokeLinecap="round" 
                                                            />
                                                        )}
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                                        <span className="text-[13px] font-extrabold text-[#1e293b] leading-none">{Math.round(twData.capaian)}</span>
                                                        <span className="text-[9px] font-extrabold text-[#94a3b8] leading-none mt-0.5">%</span>
                                                    </div>
                                                </div>

                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                                    twData.status === 'SUBMITTED' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {twData.status}
                                                </span>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0"></span>
                                                    <div className="min-w-0">
                                                        <span className="font-extrabold text-sm text-[#181c23] block leading-tight">TW {idx + 1}</span>
                                                        <span className="text-[10px] font-semibold text-[#717785] block leading-tight mt-0.5 whitespace-nowrap">
                                                            {TW_PERIOD_LABELS[twKey]}
                                                        </span>
                                                    </div>
                                                </div>
                                                {user?.role === 'ADMIN' && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleStartExportZip(twKey)}
                                                        title={`Export ${twKey} Google Drive Folder (ZIP)`}
                                                        className="inline-flex items-center gap-1 bg-[#005bb1]/10 hover:bg-[#005bb1] text-[#005bb1] hover:text-white px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all duration-200 shadow-2xs flex-shrink-0 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">folder_zip</span>
                                                        <span>Export</span>
                                                    </button>
                                                )}
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-[#c0c6d6]/20 grid grid-cols-2 gap-2 text-center text-xs">
                                                <div>
                                                    <span className="text-[9px] font-bold text-[#717785] uppercase tracking-wider block">CAPAIAN</span>
                                                    <span className="font-extrabold text-xs text-[#181c23] mt-0.5 block">
                                                        {twData.capaian.toFixed(2).replace('.', ',')}%
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-[#717785] uppercase tracking-wider block">ISIAN</span>
                                                    <span className="font-extrabold text-xs text-[#181c23] mt-0.5 block">
                                                        {twData.isian_percent.toFixed(1).replace('.', ',')}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* CARD 2: SEBARAN CAPAIAN PER IKU CHART (FULL WIDTH 1 COLUMN) */}
                    <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] shadow-sm border border-[#c0c6d6]/20 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#c0c6d6]/15">
                            <div className="flex items-center gap-2 text-[#181c23] font-extrabold text-sm uppercase tracking-wider">
                                <span className="material-symbols-outlined text-[#005bb1] text-xl">show_chart</span>
                                <span>SEBARAN CAPAIAN PER IKU (BASELINE, TARGET & REALISASI)</span>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                    capaianTab === 'real'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                    {capaianTab === 'real' ? 'Mode Real' : 'Mode Trim'}
                                </span>
                            </div>

                            {/* Filter Triwulan Chart */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#f1f3fe] border border-[#c0c6d6]/30 rounded-xl px-3.5 py-2 text-xs font-bold text-[#181c23]">
                                    <span className="material-symbols-outlined text-[#005bb1] text-base">filter_list</span>
                                    <select 
                                        value={chartTwFilter}
                                        onChange={(e) => setChartTwFilter(e.target.value)}
                                        className="bg-transparent border-none text-xs font-extrabold text-[#181c23] outline-none cursor-pointer pr-2"
                                    >
                                        <option value="TW1">TW1 (Jan - Mar)</option>
                                        <option value="TW2">TW2 (Apr - Jun)</option>
                                        <option value="TW3">TW3 (Jul - Sep)</option>
                                        <option value="TW4">TW4 (Okt - Des)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Full Width Multi-Line Chart */}
                        <SebaranCapaianChart 
                            data={sebaranPerIku2} 
                            filterTw={chartTwFilter} 
                            selectedTahun={selectedTahun}
                        />
                    </div>

                    {/* CARD 3: CAPAIAN REALISASI SEMUA UNIT KERJA (BAR CHART FULL WIDTH WITH TW FILTER) */}
                    <section className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm p-4 sm:p-8 border border-[#c0c6d6]/15 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c0c6d6]/15 pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-extrabold text-[#181c23]">
                                        {stats?.is_faculty
                                            ? (scopeTab === 'fakultas' 
                                                ? `Capaian Realisasi Fakultas (${stats?.faculty_unit?.nama || 'Fakultas'})` 
                                                : (selectedProdi === 'ALL' 
                                                    ? `Capaian Realisasi Semua Prodi (${stats?.faculty_unit?.nama || 'Fakultas'})` 
                                                    : `Capaian Realisasi Prodi (${stats?.prodi_units?.find(p => p.id == selectedProdi)?.nama_fak_prod_unit || 'Program Studi'})`))
                                            : 'Capaian Realisasi Semua Unit Kerja'}
                                    </h3>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                        capaianTab === 'real'
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    }`}>
                                        {capaianTab === 'real' ? 'Mode Real' : 'Mode Trim'}
                                    </span>
                                </div>
                                <p className="text-xs text-[#535f71]">
                                    {stats?.is_faculty
                                        ? (scopeTab === 'fakultas'
                                            ? `Evaluasi ketercapaian dan data diajukan untuk unit ${stats?.faculty_unit?.nama || 'Fakultas'}.`
                                            : 'Perbandingan persentase data diajukan serta ketercapaian realisasi untuk Program Studi.')
                                        : 'Perbandingan persentase data diajukan serta ketercapaian realisasi terhadap target untuk seluruh Fakultas & Unit Kerja.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#f1f3fe] border border-[#c0c6d6]/30 rounded-xl px-3.5 py-2 text-xs font-bold text-[#181c23]">
                                    <span className="material-symbols-outlined text-[#005bb1] text-base">filter_list</span>
                                    <select 
                                        value={unitTwFilter}
                                        onChange={(e) => setUnitTwFilter(e.target.value)}
                                        className="bg-transparent border-none text-xs font-extrabold text-[#181c23] outline-none cursor-pointer pr-2"
                                    >
                                        <option value="TW1">TW1 (Jan - Mar)</option>
                                        <option value="TW2">TW2 (Apr - Jun)</option>
                                        <option value="TW3">TW3 (Jul - Sep)</option>
                                        <option value="TW4">TW4 (Okt - Des)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <CapaianSemuaUnitBarChart 
                            data={capaianPerUnit3} 
                            selectedTw={unitTwFilter} 
                            selectedTahun={selectedTahun} 
                        />
                    </section>

                    {/* CARD 4: PERFORMANCE DISTRIBUTION TABLE (FULL WIDTH) */}
                    <section className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm overflow-hidden border border-[#c0c6d6]/10">
                        <div className="p-4 sm:p-8 border-b border-[#c0c6d6]/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-[#181c23]">Performance Distribution</h3>
                                <p className="text-xs text-[#535f71]">
                                    Distribusi capaian performa realisasi IKU perguruan tinggi dari database
                                    {selectedIkuFilter4 && displayedPerIku4.length > 0 && (
                                        <span className="ml-1 text-[#005bb1] font-bold">
                                            (Filter: {displayedPerIku4[0].kode_iku})
                                        </span>
                                    )}
                                    .
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-4">
                                {isSingleUnitUser ? (
                                    <div className="bg-[#ebedf8] text-[#005bb1] px-4 py-2 rounded-xl border border-[#005bb1]/20 flex items-center gap-2 text-xs font-extrabold shadow-2xs">
                                        <span className="material-symbols-outlined text-base">apartment</span>
                                        <span>{units.find(u => Number(u.id) === Number(selectedUnit || user?.fakultas_unit))?.nama_fak_prod_unit || user?.nama_unit || 'Unit Anda'}</span>
                                    </div>
                                ) : (
                                    <div className="w-64">
                                        <SearchableSelect 
                                            options={buildGroupedUnitOptions(units, isFacultyUser ? '-- Semua Prodi Fakultas --' : '-- Semua Unit Kerja --')}
                                            value={selectedUnit}
                                            onChange={(val) => setSelectedUnit(val)}
                                            placeholder={isFacultyUser ? '-- Semua Prodi Fakultas --' : '-- Semua Unit Kerja --'}
                                            searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                                        />
                                    </div>
                                )}

                                {/* Dropdown Search Indikator IKU - Hanya muncul di level fakultas, admin dan Unit Pelapor Terkait "WAKIL REKTOR *" */}
                                {isPrivilegedScope && (
                                    <div className="w-64 sm:w-72 md:w-80">
                                        <SearchableSelect 
                                            options={ikuOptions4}
                                            value={selectedIkuFilter4}
                                            onChange={(val) => setSelectedIkuFilter4(val)}
                                            placeholder="-- Semua Indikator IKU --"
                                            searchPlaceholder="Cari Indikator IKU (kode / nama)..."
                                            disabled={!perIku4 || perIku4.length === 0}
                                        />
                                    </div>
                                )}

                                {/* Input Checkbox/On-Off Samping Pilih Indikator (Hanya untuk Fakultas dan Warek, default ON) */}
                                {canToggleSelfOnly && (
                                    <label 
                                        className={`inline-flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all duration-200 shadow-sm ${
                                            onlyCurrentUnit 
                                                ? 'bg-[#ebedf8] border-[#005bb1]/30 text-[#005bb1]' 
                                                : 'bg-white border-[#c0c6d6] text-[#535f71] hover:border-[#005bb1]'
                                        }`}
                                        title={onlyCurrentUnit 
                                            ? `Hanya menampilkan data unit saat ini login (${user?.nama_unit || 'Unit Login'})` 
                                            : (isFacultyUser 
                                                ? 'Menampilkan data fakultas dan seluruh prodi' 
                                                : 'Menampilkan data wakil rektor dan seluruh fakultas')
                                        }
                                    >
                                        <div className="relative inline-flex items-center flex-shrink-0">
                                            <input 
                                                type="checkbox" 
                                                checked={onlyCurrentUnit} 
                                                onChange={(e) => setOnlyCurrentUnit(e.target.checked)}
                                                className="sr-only" 
                                            />
                                            <div className={`w-9 h-5 rounded-full transition-colors duration-200 ease-in-out relative ${
                                                onlyCurrentUnit ? 'bg-[#005bb1]' : 'bg-gray-300'
                                            }`}>
                                                <span 
                                                    className={`inline-block w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out absolute top-0.5 left-0.5 ${
                                                        onlyCurrentUnit ? 'translate-x-4' : 'translate-x-0'
                                                    }`} 
                                                />
                                            </div>
                                        </div>
                                        <span className="whitespace-nowrap font-bold">
                                            Hanya Unit Saya
                                        </span>
                                    </label>
                                )}

                                <div className="bg-[#f1f3fe] p-1 rounded-xl flex items-center gap-1 text-[11px] font-bold text-[#535f71]">
                                    {['TW1', 'TW2', 'TW3', 'TW4'].map((p) => (
                                        <button 
                                            key={p} 
                                            onClick={() => setActivePeriod(p)}
                                            className={`px-3 py-1.5 rounded-lg transition-all duration-200 uppercase tracking-wider text-[10px] ${
                                                activePeriod === p 
                                                    ? 'bg-[#005bb1] text-white shadow-sm font-extrabold' 
                                                    : 'opacity-70 hover:opacity-100 text-[#535f71]'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#f1f3fe]/40 border-b border-[#c0c6d6]/15 text-[#717785] font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4 w-32">KODE IKU</th>
                                        <th className="px-6 py-4">DESKRIPSI INDIKATOR</th>
                                        {isPrivilegedScope && (
                                            <th className="px-6 py-4">TARGET</th>
                                        )}
                                        <th className="px-6 py-4 text-center w-28">BASELINE</th>
                                        <th className="px-6 py-4 text-center w-28">TARGET</th>
                                        <th className="px-6 py-4 text-center w-44">CAPAIAN & %</th>
                                        <th className="px-6 py-4 text-center w-36">STATUS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#c0c6d6]/10">
                                    {!displayedPerIku4 || displayedPerIku4.length === 0 ? (
                                        <tr>
                                            <td colSpan={isPrivilegedScope ? 7 : 6} className="p-8 text-center text-[#717785] italic">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <span>
                                                        {selectedIkuFilter4 
                                                            ? 'Tidak ada data indikator yang sesuai dengan filter pencarian.' 
                                                            : 'Belum ada data indikator terpilih.'}
                                                    </span>
                                                    {canToggleSelfOnly && onlyCurrentUnit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setOnlyCurrentUnit(false)}
                                                            className="inline-flex items-center gap-1.5 text-xs text-[#005bb1] font-bold hover:underline not-italic cursor-pointer bg-[#ebedf8] px-3 py-1.5 rounded-lg border border-[#005bb1]/20 mt-1"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">visibility</span>
                                                            <span>Tampilkan data seluruh unit terkait (matikan toggle "Hanya Unit Saya")</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedPerIku4.map((iku, index) => {
                                            const twKey = activePeriod.toLowerCase();
                                            const nilaiCapaian = iku[`capaian_${twKey}`];
                                            const itemData = {
                                                capaian: nilaiCapaian,
                                                status: iku[`status_${twKey}`]
                                            };

                                            return (
                                                <tr key={iku.row_key || `${iku.id}_${iku.unit_id || index}`} className="hover:bg-[#f9f9ff] transition-colors">
                                                    <td className="px-6 py-4 font-bold text-[#005bb1]">
                                                        {iku.kode_iku}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-[#181c23]">
                                                        {iku.full_kategori || iku.nama_indikator}
                                                    </td>

                                                    {isPrivilegedScope && (
                                                        <td className="px-6 py-4 font-bold text-[#181c23]">
                                                            {formatUnitTargetName(units.find(u => Number(u.id) === Number(iku.unit_id)) || iku.nama_unit || iku.nama_fak_prod_unit || '-')}
                                                        </td>
                                                    )}

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#535f71] font-bold text-xs inline-block min-w-[64px]">
                                                            {(!iku.base_line || iku.base_line === '-' || iku.base_line === '0' || iku.base_line === 0) ? '-' : iku.base_line}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#181c23] font-extrabold text-xs inline-block min-w-[64px]">
                                                            {(!iku.target || iku.target === '-' || iku.target === '0' || iku.target === 0) ? '-' : iku.target}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {nilaiCapaian !== null ? (
                                                            <div className="relative bg-[#ebedf8] border border-[#005bb1]/20 rounded-2xl px-3 py-2 inline-block w-full max-w-[150px]">
                                                                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded-full text-[8px] font-extrabold text-[#181c23] uppercase tracking-wider border border-[#c0c6d6]/30 shadow-2xs">
                                                                    Realisasi
                                                                </span>
                                                                <div className="text-sm font-extrabold text-[#005bb1] mt-0.5">
                                                                    {nilaiCapaian}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm font-bold text-[#717785]">-</span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {renderStatusBadge(itemData.status)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}

            {/* Floating Action Button */}
            <Link 
                href={route('reporting')} 
                className="fixed bottom-8 right-8 w-14 h-14 bg-[#005bb1] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
            >
                <span className="material-symbols-outlined text-2xl">add</span>
            </Link>

            {/* Modal Export ZIP dengan Background Processing & Chunked Download */}
            {exportModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-[#c0c6d6]/30 overflow-hidden transform transition-all">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#005bb1] to-[#003e7e] px-6 py-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-2xl bg-white/10 p-2 rounded-xl">folder_zip</span>
                                <div>
                                    <h3 className="font-extrabold text-base leading-tight">Export Google Drive Folder (ZIP)</h3>
                                    <p className="text-xs text-white/80 font-medium mt-0.5">
                                        Triwulan {exportModalState.tw} • Tahun {exportModalState.tahun}
                                    </p>
                                </div>
                            </div>
                            {['completed', 'failed'].includes(exportModalState.status) && (
                                <button 
                                    onClick={() => setExportModalState(prev => ({ ...prev, isOpen: false }))}
                                    className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            )}
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-6">
                            {/* Status Icon & Message */}
                            <div className="text-center space-y-2">
                                {exportModalState.status === 'initiating' && (
                                    <div className="w-14 h-14 bg-[#005bb1]/10 rounded-2xl flex items-center justify-center mx-auto text-[#005bb1] animate-pulse">
                                        <span className="material-symbols-outlined text-3xl">sync</span>
                                    </div>
                                )}
                                {exportModalState.status === 'processing' && (
                                    <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 animate-spin">
                                        <span className="material-symbols-outlined text-3xl">cloud_sync</span>
                                    </div>
                                )}
                                {exportModalState.status === 'downloading' && (
                                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-[#005bb1] animate-bounce">
                                        <span className="material-symbols-outlined text-3xl">downloading</span>
                                    </div>
                                )}
                                {exportModalState.status === 'completed' && (
                                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
                                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                                    </div>
                                )}
                                {exportModalState.status === 'failed' && (
                                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto text-red-600">
                                        <span className="material-symbols-outlined text-3xl">error</span>
                                    </div>
                                )}

                                <h4 className="font-extrabold text-base text-[#181c23]">
                                    {exportModalState.status === 'initiating' && 'Menyiapkan Ekspor...'}
                                    {exportModalState.status === 'processing' && 'Memproses Berkas di Server...'}
                                    {exportModalState.status === 'downloading' && 'Mengunduh Bagian Berkas (Chunk Download)...'}
                                    {exportModalState.status === 'completed' && 'Unduhan Berhasil Selesai!'}
                                    {exportModalState.status === 'failed' && 'Proses Ekspor Terkendala'}
                                </h4>

                                <p className="text-xs text-[#717785] leading-relaxed max-w-sm mx-auto">
                                    {exportModalState.message || 'Mohon tunggu, proses penelusuran Google Drive sedang berjalan...'}
                                </p>
                            </div>

                            {/* Server Processing Progress Bar */}
                            {['processing', 'initiating'].includes(exportModalState.status) && (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold text-[#717785]">
                                        <span>Progres Server</span>
                                        <span>{exportModalState.progress}%</span>
                                    </div>
                                    <div className="w-full bg-[#f1f3fe] h-3 rounded-full overflow-hidden p-0.5 border border-[#c0c6d6]/20">
                                        <div 
                                            className="bg-gradient-to-r from-[#005bb1] to-[#3b82f6] h-full rounded-full transition-all duration-300"
                                            style={{ width: `${Math.max(5, exportModalState.progress)}%` }}
                                        />
                                    </div>
                                    <p className="text-[11px] text-[#717785] italic text-center">
                                        Server sedang menelusuri folder Google Drive dan menyusun arsip ZIP di latar belakang.
                                    </p>
                                </div>
                            )}

                            {/* Chunk Download Progress Bar */}
                            {exportModalState.status === 'downloading' && exportModalState.chunkProgress && (
                                <div className="space-y-2 bg-[#f8fafc] p-4 rounded-xl border border-[#c0c6d6]/30">
                                    <div className="flex justify-between items-center text-xs font-bold text-[#181c23]">
                                        <span>Bagian Data {exportModalState.chunkProgress.current} dari {exportModalState.chunkProgress.total}</span>
                                        <span className="text-[#005bb1]">{exportModalState.chunkProgress.percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                                        <div 
                                            className="bg-emerald-500 h-full rounded-full transition-all duration-200"
                                            style={{ width: `${Math.max(2, exportModalState.chunkProgress.percent)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-[#717785] pt-1">
                                        <span>Total Ukuran: {formatBytes(exportModalState.fileSize)}</span>
                                        <span>Potongan @ 5 MB</span>
                                    </div>
                                </div>
                            )}

                            {/* Error Alert & Google Drive Auth */}
                            {exportModalState.error && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <span className="material-symbols-outlined text-base mt-0.5 flex-shrink-0">warning</span>
                                        <span>{exportModalState.error}</span>
                                    </div>
                                    {exportModalState.needAuth && exportModalState.authUrl && (
                                        <div className="pt-2">
                                            <a 
                                                href={exportModalState.authUrl}
                                                className="inline-flex items-center gap-1.5 bg-[#005bb1] hover:bg-[#00488c] text-white px-3.5 py-2 rounded-lg font-bold text-xs shadow-sm transition-all"
                                            >
                                                <span className="material-symbols-outlined text-sm">login</span>
                                                <span>Hubungkan Akun Google Drive</span>
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Direct Download fallback link when completed */}
                            {exportModalState.status === 'completed' && exportModalState.jobId && (
                                <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-xl text-center space-y-1">
                                    <p className="text-xs text-emerald-800 font-semibold">
                                        Unduhan tidak otomatis muncul di peramban Anda?
                                    </p>
                                    <a 
                                        href={`/api/dashboard/export-tw-zip/chunk?job_id=${encodeURIComponent(exportModalState.jobId)}&download=1`}
                                        className="text-xs text-[#005bb1] hover:underline font-bold inline-flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        <span>Klik di sini untuk mengunduh berkas utuh secara langsung</span>
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="bg-[#f8fafc] px-6 py-4 border-t border-[#c0c6d6]/20 flex items-center justify-between gap-3">
                            <div className="text-[11px] text-[#717785]">
                                {exportModalState.zipFilename && <span>File: <strong>{exportModalState.zipFilename}</strong></span>}
                            </div>
                            <div className="flex items-center gap-2">
                                {exportModalState.status === 'failed' && (
                                    <button 
                                        type="button"
                                        onClick={() => handleStartExportZip(exportModalState.tw, true)}
                                        className="inline-flex items-center gap-1 bg-[#005bb1] hover:bg-[#00488c] text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-sm">refresh</span>
                                        <span>Coba Lagi</span>
                                    </button>
                                )}
                                {['completed', 'failed'].includes(exportModalState.status) ? (
                                    <button 
                                        type="button"
                                        onClick={() => setExportModalState(prev => ({ ...prev, isOpen: false }))}
                                        className="bg-white border border-[#c0c6d6]/60 hover:bg-gray-100 text-[#181c23] px-4 py-1.5 rounded-xl font-bold text-xs transition-all shadow-xs cursor-pointer"
                                    >
                                        Tutup
                                    </button>
                                ) : (
                                    <span className="text-[11px] text-[#717785] italic">
                                        Jangan tutup jendela ini hingga unduhan selesai...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </AuthenticatedLayout>
    );
}

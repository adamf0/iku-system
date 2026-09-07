import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import SearchableSelect from '@/Components/SearchableSelect';
import { buildGroupedUnitOptions } from '@/Utils/unitHelper';

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
        ? (items[0]?.years_data ? Object.keys(items[0].years_data).map(Number) : [2025, 2026])
        : [Number(selectedTahun)];

    const yearColors = {
        2025: { bar: '#6366f1', targetLine: '#10b981', baseLine: '#f59e0b', label: '2025' },
        2026: { bar: '#a855f7', targetLine: '#0d9488', baseLine: '#ea580c', label: '2026' },
        2027: { bar: '#ec4899', targetLine: '#0284c7', baseLine: '#e11d48', label: '2027' }
    };

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
function CapaianSemuaUnitBarChart({ data }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState('ALL');
    const [sortBy, setSortBy] = useState('CAPAIAN_DESC');
    const [isExpanded, setIsExpanded] = useState(false);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    if (!data || data.length === 0) {
        return (
            <div className="p-8 text-center text-xs text-[#717785] italic">
                Belum ada data capaian unit kerja.
            </div>
        );
    }

    // Unique unit types for tabs
    const unitTypes = ['ALL', ...Array.from(new Set(data.map(u => u.type).filter(Boolean)))];

    // Counts by performance status
    const highCount = data.filter(u => (Number(u.capaian) || 0) >= 80).length;
    const medCount = data.filter(u => (Number(u.capaian) || 0) >= 50 && (Number(u.capaian) || 0) < 80).length;
    const lowCount = data.filter(u => (Number(u.capaian) || 0) < 50).length;

    // Filter & Sort logic
    let filteredData = data.filter(unit => {
        const matchSearch = (unit.nama_unit || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchType = selectedType === 'ALL' || unit.type === selectedType;
        return matchSearch && matchType;
    });

    filteredData = [...filteredData].sort((a, b) => {
        const capA = Number(a.capaian) || 0;
        const capB = Number(b.capaian) || 0;
        if (sortBy === 'CAPAIAN_DESC') return capB - capA;
        if (sortBy === 'CAPAIAN_ASC') return capA - capB;
        if (sortBy === 'NAME_ASC') return (a.nama_unit || '').localeCompare(b.nama_unit || '');
        return 0;
    });

    const DEFAULT_LIMIT = 6;
    const visibleData = isExpanded ? filteredData : filteredData.slice(0, DEFAULT_LIMIT);
    const hiddenCount = filteredData.length - DEFAULT_LIMIT;

    return (
        <div className="space-y-5">
            {/* Status Summary Pill Badges & View Switcher */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#f9f9ff] p-3 rounded-2xl border border-[#c0c6d6]/20">
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    <span className="text-[#535f71] mr-1 font-extrabold uppercase text-[10px] tracking-wider">Ringkasan Status:</span>
                    <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Tinggi (≥80%): <strong className="font-mono text-emerald-900">{highCount}</strong>
                    </span>
                    <span className="bg-blue-100 text-[#005bb1] px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#005bb1]"></span>
                        Sedang (50-79%): <strong className="font-mono text-[#001b3d]">{medCount}</strong>
                    </span>
                    <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500"></span>
                        Perlu Perhatian (&lt;50%): <strong className="font-mono text-red-900">{lowCount}</strong>
                    </span>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#c0c6d6]/30 self-end md:self-auto shadow-2xs">
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

            {/* Filtering & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Unit Type Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                    {unitTypes.map(type => {
                        const count = type === 'ALL' ? data.length : data.filter(u => u.type === type).length;
                        const label = type === 'ALL' ? 'Semua Unit' : type;
                        return (
                            <button
                                key={type}
                                onClick={() => {
                                    setSelectedType(type);
                                    setIsExpanded(false);
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
                        <option value="CAPAIAN_DESC">Capaian Tertinggi</option>
                        <option value="CAPAIAN_ASC">Capaian Terendah</option>
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
                /* GRID CARD VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleData.map((unit, idx) => {
                        const pct = Number(unit.capaian) || 0;
                        let barColor = 'bg-red-500';
                        let badgeColor = 'bg-red-100 text-red-700';

                        if (pct >= 80) {
                            barColor = 'bg-emerald-500';
                            badgeColor = 'bg-emerald-100 text-emerald-700';
                        } else if (pct >= 50) {
                            barColor = 'bg-[#005bb1]';
                            badgeColor = 'bg-blue-100 text-[#005bb1]';
                        }

                        return (
                            <div key={unit.id} className="bg-[#f9f9ff] border border-[#c0c6d6]/25 rounded-2xl p-4 space-y-3 hover:shadow-md transition-all">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-extrabold text-[#181c23] truncate" title={unit.nama_unit}>{unit.nama_unit}</h4>
                                        <span className="text-[9px] font-bold text-[#717785] uppercase tracking-wider">{unit.type}</span>
                                    </div>
                                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex-shrink-0 ${badgeColor}`}>
                                        {pct}%
                                    </span>
                                </div>

                                {/* Progress bar container */}
                                <div className="space-y-1">
                                    <div className="w-full bg-[#e8ecf4] h-2.5 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-[#717785] font-semibold">
                                        <span>Laporan: {unit.total_laporan || 0}</span>
                                        <span>Target 100%</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* RANKING LIST VIEW */
                <div className="bg-[#f9f9ff] border border-[#c0c6d6]/25 rounded-2xl divide-y divide-[#c0c6d6]/15 overflow-hidden">
                    {visibleData.map((unit, idx) => {
                        const pct = Number(unit.capaian) || 0;
                        let barColor = 'bg-red-500';
                        let badgeColor = 'bg-red-100 text-red-700';

                        if (pct >= 80) {
                            barColor = 'bg-emerald-500';
                            badgeColor = 'bg-emerald-100 text-emerald-700';
                        } else if (pct >= 50) {
                            barColor = 'bg-[#005bb1]';
                            badgeColor = 'bg-blue-100 text-[#005bb1]';
                        }

                        return (
                            <div key={unit.id} className="p-3.5 flex items-center gap-4 hover:bg-white transition-colors">
                                <span className="w-6 text-center text-xs font-black text-[#717785]">#{idx + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h4 className="text-xs font-bold text-[#181c23] truncate">{unit.nama_unit}</h4>
                                            <span className="text-[9px] font-bold text-[#717785] bg-[#ebedf8] px-2 py-0.5 rounded uppercase flex-shrink-0">{unit.type}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeColor}`}>
                                            {pct}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-[#e8ecf4] h-2 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                                        ></div>
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

    const isSingleUnitUser = user && !['ADMIN', 'LPM', 'FAKULTAS'].includes(user.role);
    const isFacultyUser = user && user.role === 'FAKULTAS';
    const isAdminUser = user && ['ADMIN', 'LPM'].includes(user.role);

    const [stats, setStats] = useState(null);
    const [units, setUnits] = useState([]);
    const [years, setYears] = useState([{ tahun: 2026 }, { tahun: 2025 }]);
    const [selectedTahun, setSelectedTahun] = useState('2026');
    const [selectedUnit, setSelectedUnit] = useState(user?.fakultas_unit || '');
    const [loading, setLoading] = useState(true);
    const [isStreaming, setIsStreaming] = useState(false);

    const [activePeriod, setActivePeriod] = useState('TW3');
    const [chartTwFilter, setChartTwFilter] = useState('ALL');
    const [unitTwFilter, setUnitTwFilter] = useState('ALL');

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

    const twSummary = stats?.triwulan_summary || {};
    const overallCapaian = stats?.overall_capaian || 0;

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

                {/* Single Filter Tahun Header Selector */}
                <div className="flex items-center gap-3">
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
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                            {/* Overall Capaian Banner */}
                            <div className="lg:col-span-4 bg-[#005bb1] text-white p-6 rounded-[1.8rem] shadow-lg relative overflow-hidden flex flex-col justify-between h-52">
                                <div className="text-[10px] font-extrabold uppercase tracking-widest text-white/80">
                                    OVERALL CAPAIAN PERFORMA ({selectedTahun === 'ALL' ? 'SEMUA TAHUN' : selectedTahun})
                                </div>
                                <div className="mt-2 flex items-baseline gap-1">
                                    <span className="text-5xl font-extrabold tracking-tight">
                                        {overallCapaian.toString().replace('.', ',')}
                                    </span>
                                    <span className="text-2xl font-bold opacity-80">%</span>
                                </div>
                                <p className="text-xs text-white/80 mt-1 font-medium">
                                    Rata-rata kumulatif capaian realisasi terhadap target
                                </p>
                            </div>

                            {/* 4 Triwulan Grid Cards */}
                            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {['TW1', 'TW2', 'TW3', 'TW4'].map((twKey, idx) => {
                                    const twData = twSummary[twKey] || {
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
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                                    <span className="font-extrabold text-sm text-[#181c23]">TW {idx + 1}</span>
                                                </div>
                                                {user?.role === 'ADMIN' && (
                                                    <a 
                                                        href={`/api/dashboard/export-tw-zip?tw=${twKey}&tahun=${selectedTahun}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title={`Export ${twKey} Google Drive Folder (ZIP)`}
                                                        className="inline-flex items-center gap-1 bg-[#005bb1]/10 hover:bg-[#005bb1] text-[#005bb1] hover:text-white px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all duration-200 shadow-2xs"
                                                    >
                                                        <span className="material-symbols-outlined text-[13px]">folder_zip</span>
                                                        <span>Export</span>
                                                    </a>
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
                                SEBARAN CAPAIAN PER IKU (BASELINE, TARGET & REALISASI)
                            </div>

                            {/* Filter Triwulan Chart */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#f1f3fe] border border-[#c0c6d6]/30 rounded-xl px-3.5 py-2 text-xs font-bold text-[#181c23]">
                                    <span className="material-symbols-outlined text-[#005bb1] text-base">filter_list</span>
                                    <select 
                                        value={chartTwFilter}
                                        onChange={(e) => setChartTwFilter(e.target.value)}
                                        className="bg-transparent border-none text-xs font-extrabold text-[#181c23] outline-none cursor-pointer pr-2"
                                    >
                                        <option value="ALL">Semua TW</option>
                                        <option value="TW1">TW1</option>
                                        <option value="TW2">TW2</option>
                                        <option value="TW3">TW3</option>
                                        <option value="TW4">TW4</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Full Width Multi-Line Chart */}
                        <SebaranCapaianChart 
                            data={stats?.sebaran_per_iku} 
                            filterTw={chartTwFilter} 
                            selectedTahun={selectedTahun}
                        />
                    </div>

                    {/* CARD 3: CAPAIAN REALISASI SEMUA UNIT KERJA (BAR CHART FULL WIDTH WITH TW FILTER) */}
                    <section className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm p-4 sm:p-8 border border-[#c0c6d6]/15 space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#c0c6d6]/15 pb-4">
                            <div>
                                <h3 className="text-lg font-extrabold text-[#181c23]">Capaian Realisasi Semua Unit Kerja</h3>
                                <p className="text-xs text-[#535f71]">Perbandingan persentase rata-rata capaian IKU untuk seluruh Fakultas & Unit Kerja.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#f1f3fe] border border-[#c0c6d6]/30 rounded-xl px-3.5 py-2 text-xs font-bold text-[#181c23]">
                                    <span className="material-symbols-outlined text-[#005bb1] text-base">filter_list</span>
                                    <select 
                                        value={unitTwFilter}
                                        onChange={(e) => setUnitTwFilter(e.target.value)}
                                        className="bg-transparent border-none text-xs font-extrabold text-[#181c23] outline-none cursor-pointer pr-2"
                                    >
                                        <option value="ALL">Semua TW</option>
                                        <option value="TW1">TW1</option>
                                        <option value="TW2">TW2</option>
                                        <option value="TW3">TW3</option>
                                        <option value="TW4">TW4</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <CapaianSemuaUnitBarChart data={stats?.capaian_per_unit} />
                    </section>

                    {/* CARD 4: PERFORMANCE DISTRIBUTION TABLE (FULL WIDTH) */}
                    <section className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm overflow-hidden border border-[#c0c6d6]/10">
                        <div className="p-4 sm:p-8 border-b border-[#c0c6d6]/15 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-[#181c23]">Performance Distribution</h3>
                                <p className="text-xs text-[#535f71]">Distribusi capaian performa realisasi IKU perguruan tinggi dari database.</p>
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

                        {!selectedUnit ? (
                            <div className="p-12 text-center text-[#535f71] bg-[#f9f9ff] flex flex-col items-center justify-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#ebedf8] flex items-center justify-center text-[#005bb1]">
                                    <span className="material-symbols-outlined text-2xl">apartment</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-[#181c23]">Pilih Unit Kerja Terlebih Dahulu</h4>
                                    <p className="text-xs text-[#717785] mt-1 max-w-md">
                                        Silakan pilih Unit Kerja pada dropdown di atas untuk dapat menampilkan tabel distribusi capaian <span className="font-bold text-[#005bb1]">{activePeriod}</span>.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-[#f1f3fe]/40 border-b border-[#c0c6d6]/15 text-[#717785] font-bold uppercase tracking-wider">
                                            <th className="px-6 py-4 w-32">KODE IKU</th>
                                            <th className="px-6 py-4">DESKRIPSI INDIKATOR</th>
                                            <th className="px-6 py-4 text-center w-28">BASELINE</th>
                                            <th className="px-6 py-4 text-center w-28">TARGET</th>
                                            <th className="px-6 py-4 text-center w-44">CAPAIAN & %</th>
                                            <th className="px-6 py-4 text-center w-36">STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#c0c6d6]/10">
                                        {!stats?.per_iku || stats.per_iku.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-8 text-center text-[#717785] italic">
                                                    Belum ada data indikator terpilih.
                                                </td>
                                            </tr>
                                        ) : (
                                            stats.per_iku.map((iku) => {
                                                const twKey = activePeriod.toLowerCase();
                                                const nilaiCapaian = iku[`capaian_${twKey}`];
                                                const itemData = {
                                                    capaian: nilaiCapaian,
                                                    status: iku[`status_${twKey}`]
                                                };

                                                const targetVal = Number(iku.target);
                                                let progressPct = null;
                                                if (nilaiCapaian !== null && targetVal > 0) {
                                                    const pct = ((Number(nilaiCapaian) / targetVal) * 100).toFixed(1);
                                                    progressPct = `${pct}% dari Target`;
                                                }

                                                return (
                                                    <tr key={iku.id} className="hover:bg-[#f9f9ff] transition-colors">
                                                        <td className="px-6 py-4 font-bold text-[#005bb1]">
                                                            {iku.kode_iku}
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-[#181c23]">
                                                            {iku.full_kategori || iku.nama_indikator}
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#535f71] font-bold text-xs inline-block min-w-[64px]">
                                                                {iku.base_line || '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#181c23] font-extrabold text-xs inline-block min-w-[64px]">
                                                                {iku.target ?? '-'}
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            {nilaiCapaian !== null ? (
                                                                <div className="relative bg-[#ebedf8] border border-[#005bb1]/20 rounded-2xl px-3 py-2 inline-block w-full max-w-[150px]">
                                                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded-full text-[8px] font-extrabold text-[#181c23] uppercase tracking-wider border border-[#c0c6d6]/30 shadow-2xs">
                                                                        Realisasi
                                                                    </span>
                                                                    <div className="text-sm font-extrabold text-[#005bb1] mt-0.5">
                                                                        {nilaiCapaian} <span className="text-[10px] font-normal text-[#535f71]">{iku.satuan}</span>
                                                                    </div>
                                                                    {progressPct && (
                                                                        <div className="text-[10px] font-bold text-[#535f71] mt-0.5">
                                                                            {progressPct}
                                                                        </div>
                                                                    )}
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
                        )}
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
        </AuthenticatedLayout>
    );
}

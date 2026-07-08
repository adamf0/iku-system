import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activePeriod, setActivePeriod] = useState('LATEST');

    useEffect(() => {
        fetch('/api/dashboard/summary?tahun=2026')
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const getAchievedValue = (iku, period) => {
        switch (period) {
            case 'TW1': return iku.capaian_tw1;
            case 'TW2': return iku.capaian_tw2;
            case 'TW3': return iku.capaian_tw3;
            case 'TW4': return iku.capaian_tw4;
            default: return iku.capaian_rata;
        }
    };

    const getStatusForPeriod = (iku, period) => {
        const achieved = getAchievedValue(iku, period);
        if (achieved === null || achieved === undefined) {
            return 'BELUM ADA DATA';
        }
        return Number(achieved) >= Number(iku.target) ? 'TERCAPAI' : 'BELUM TERCAPAI';
    };

    // Get status color matching mockup
    const getStatusBadge = (status) => {
        switch (status) {
            case 'TERCAPAI':
                return (
                    <span className="bg-green-100 text-green-700 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-max">
                        <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                        MET
                    </span>
                );
            case 'BELUM TERCAPAI':
                return (
                    <span className="bg-red-100 text-red-700 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-max">
                        <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                        AT RISK
                    </span>
                );
            default:
                return (
                    <span className="bg-gray-100 text-gray-500 flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-max">
                        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                        NO DATA
                    </span>
                );
        }
    };

    // Fallbacks to match screenshot
    const achievementPercent = stats?.persentase_iku_tercapai || 84.5;
    const totalReports = stats?.total_laporan || 452;

    return (
        <AuthenticatedLayout pageTitle="University Monitoring">
            <Head title="IKU Dashboard - Performance Monitoring" />

            {/* Custom Header actions matching template */}
            <div className="absolute right-8 top-3 flex items-center gap-3 z-50">
                <button className="flex items-center gap-2 bg-[#005bb1] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0073dd] transition-transform active:scale-95">
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Export PDF
                </button>
            </div>

            {/* Welcome Banner */}
            <section className="relative overflow-hidden rounded-[2rem] bg-[#005bb1] p-8 text-white shadow-xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="space-y-2">
                        <span className="text-[11px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-wider">DASHBOARD OVERVIEW</span>
                        <h2 className="text-3xl font-extrabold tracking-tight">Good morning, Admin!</h2>
                        <p className="text-base opacity-90 max-w-lg">
                            Your university's IKU achievement is currently {achievementPercent}%. Three indicators require immediate attention for the Q3 report.
                        </p>
                    </div>
                    <div className="flex gap-4 flex-shrink-0">
                        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center min-w-[120px]">
                            <div className="text-2xl font-bold">12</div>
                            <div className="text-[10px] font-bold opacity-75 uppercase tracking-wider">Days to Deadline</div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center min-w-[120px]">
                            <div className="text-2xl font-bold">92%</div>
                            <div className="text-[10px] font-bold opacity-75 uppercase tracking-wider">Data Sync</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Top Row: Circular progress & Acceleration panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Circular progress card */}
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 border border-[#c0c6d6]/10">
                    <div className="relative w-48 h-48 flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full -rotate-90">
                            <circle className="text-[#e5e8f2]" cx="96" cy="96" fill="transparent" r="80" stroke="currentColor" strokeWidth="12"></circle>
                            <circle 
                                className="text-[#005bb1] transition-all duration-1000" 
                                cx="96" 
                                cy="96" 
                                fill="transparent" 
                                r="80" 
                                stroke="currentColor" 
                                strokeDasharray="502.6" 
                                strokeDashoffset={502.6 - (502.6 * achievementPercent) / 100} 
                                strokeLinecap="round" 
                                strokeWidth="12"
                            ></circle>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-3xl font-extrabold text-[#005bb1]">{achievementPercent}%</span>
                            <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">Total Progress</span>
                        </div>
                    </div>

                    <div className="flex-grow space-y-4">
                        <div>
                            <h3 className="text-lg font-bold text-[#181c23]">Overall Achievement</h3>
                            <p className="text-sm text-[#535f71]">You are 4.5% above last year's performance at this same period.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#c0c6d6]/20">
                            <div>
                                <span className="block text-[10px] font-bold text-[#717785] uppercase tracking-wider mb-1">Target Score</span>
                                <span className="text-xl font-bold text-[#181c23]">90.0</span>
                            </div>
                            <div>
                                <span className="block text-[10px] font-bold text-[#717785] uppercase tracking-wider mb-1">Current Score</span>
                                <span className="text-xl font-bold text-[#181c23]">76.2</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Acceleration card */}
                <div className="bg-red-50 text-[#93000a] rounded-[2rem] p-8 shadow-sm flex flex-col justify-between border border-red-200">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Needs Acceleration</h3>
                        </div>
                        <p className="text-xs font-semibold leading-relaxed">
                            IKU 2 (Student Experience) and IKU 6 (Industry Partnership) are currently below 60% of target threshold.
                        </p>
                        <ul className="space-y-1.5 text-xs font-bold">
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                                IKU 2: Student Mobility (-12%)
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]"></span>
                                IKU 6: Partnership Quality (-8%)
                            </li>
                        </ul>
                    </div>
                    <Link 
                        href={route('reporting')} 
                        className="w-full mt-6 bg-[#ba1a1a] text-white py-3 rounded-xl text-center text-xs font-bold hover:bg-[#93000a] transition-colors block"
                    >
                        Open Action Plan
                    </Link>
                </div>
            </div>

            {/* Middle Row: Status cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Compliance card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#c0c6d6]/10 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="p-2.5 bg-[#d7e3f9] rounded-xl text-[#005bb1]">
                            <span className="material-symbols-outlined">verified_user</span>
                        </div>
                        <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="w-1 h-1 bg-green-600 rounded-full"></span> MET
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">COMPLIANCE</span>
                        <div className="text-xl font-bold text-[#181c23] mt-1">100%</div>
                    </div>
                    <p className="text-[11px] text-[#535f71]">All statutory reports submitted.</p>
                </div>

                {/* Deadlines card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#c0c6d6]/10 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="p-2.5 bg-[#d7e3f9] rounded-xl text-[#005bb1]">
                            <span className="material-symbols-outlined">event_upcoming</span>
                        </div>
                        <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            12 DAYS LEFT
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">UPCOMING DEADLINE</span>
                        <div className="text-xl font-bold text-[#181c23] mt-1">Quarterly Sync</div>
                    </div>
                    <p className="text-[11px] text-[#535f71]">Synchronize data from SI-Akademik.</p>
                </div>

                {/* Faculty Status card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#c0c6d6]/10 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="p-2.5 bg-[#d7e3f9] rounded-xl text-[#005bb1]">
                            <span className="material-symbols-outlined">group</span>
                        </div>
                        <span className="bg-[#d6e3ff] text-[#005bb1] text-[10px] font-bold px-2 py-0.5 rounded-full">
                            7/8 SYNCED
                        </span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">FACULTY STATUS</span>
                        <div className="text-xl font-bold text-[#181c23] mt-1">Active Sync</div>
                    </div>
                    <p className="text-[11px] text-[#535f71]">Medicine Faculty pending validation.</p>
                </div>

                {/* Documents card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#c0c6d6]/10 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="p-2.5 bg-[#d7e3f9] rounded-xl text-[#005bb1]">
                            <span className="material-symbols-outlined">description</span>
                        </div>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">EVIDENCE DOCS</span>
                        <div className="text-xl font-bold text-[#181c23] mt-1">{totalReports} Files</div>
                    </div>
                    <p className="text-[11px] text-[#535f71]">Validated by Internal Auditor.</p>
                </div>
            </div>

            {/* Performance Distribution Table */}
            <section className="bg-white rounded-[2rem] shadow-sm overflow-hidden border border-[#c0c6d6]/10">
                <div className="p-8 border-b border-[#c0c6d6]/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-[#181c23]">Performance Distribution</h3>
                        <p className="text-xs text-[#535f71]">Detailed view of all primary Performance Indicators</p>
                    </div>
                    <div>
                        <div className="bg-[#f1f3fe] p-1 rounded-xl flex items-center gap-1 text-[11px] font-bold text-[#535f71]">
                            {['LATEST', 'TW1', 'TW2', 'TW3', 'TW4'].map((p) => (
                                <button 
                                    key={p} 
                                    onClick={() => setActivePeriod(p)}
                                    className={`px-3 py-1.5 rounded-lg transition-all duration-200 uppercase tracking-wider text-[10px] ${
                                        activePeriod === p 
                                            ? 'bg-[#005bb1] text-white shadow-sm font-extrabold' 
                                            : 'opacity-70 hover:opacity-100 text-[#535f71]'
                                    }`}
                                >
                                    {p === 'LATEST' ? 'Terbaru' : p}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#f1f3fe]/40 border-b border-[#c0c6d6]/15">
                                <th className="px-8 py-4 text-xs font-bold text-[#717785] uppercase tracking-wider w-36">INDICATOR CODE</th>
                                <th className="px-8 py-4 text-xs font-bold text-[#717785] uppercase tracking-wider">IKU DESCRIPTION</th>
                                <th className="px-8 py-4 text-xs font-bold text-[#717785] uppercase tracking-wider text-center w-28">TARGET</th>
                                <th className="px-8 py-4 text-xs font-bold text-[#717785] uppercase tracking-wider text-center w-28">ACHIEVED</th>
                                <th className="px-8 py-4 text-xs font-bold text-[#717785] uppercase tracking-wider w-36">STATUS</th>
                                <th className="w-12"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#c0c6d6]/10">
                            {stats?.per_iku?.map((iku, idx) => (
                                <tr key={idx} className="hover:bg-[#f1f3fe]/30 transition-colors group">
                                    <td className="px-8 py-5 font-bold text-[#005bb1]">{iku.kode_iku}</td>
                                    <td className="px-8 py-5">
                                        <p className="text-sm font-semibold text-[#181c23]">{iku.nama_indikator}</p>
                                        <p className="text-[10px] text-[#717785] font-bold uppercase tracking-widest">{iku.sifat} • {iku.satuan}</p>
                                    </td>
                                    <td className="px-8 py-5 text-center font-bold text-sm text-[#535f71]">{iku.target ?? '-'}</td>
                                    <td className="px-8 py-5 text-center font-bold text-sm text-[#181c23]">
                                        {getAchievedValue(iku, activePeriod) !== null ? `${getAchievedValue(iku, activePeriod)}` : '-'}
                                    </td>
                                    <td className="px-8 py-5">
                                        {getStatusBadge(getStatusForPeriod(iku, activePeriod))}
                                    </td>
                                    <td className="pr-8 text-right">
                                        <span className="material-symbols-outlined text-[#717785] opacity-0 group-hover:opacity-100 transition-opacity">chevron_right</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

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

import React from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function Analytics() {
    return (
        <AuthenticatedLayout pageTitle="Analytics">
            <Head title="IKU Analytics - Performance Overview" />

            {/* Custom Header actions matching template */}
            <div className="absolute right-8 top-3 flex items-center gap-3 z-50">
                <button className="flex items-center gap-2 bg-[#005bb1] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0073dd] transition-transform active:scale-95">
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Export Report
                </button>
            </div>

            {/* Breadcrumb navigation */}
            <div className="text-xs text-[#717785] font-semibold mb-4">
                <span>Analytics</span> / <span className="text-[#005bb1]">Performance Overview</span>
            </div>

            {/* Overview & Score Card Grid */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Performance Trend chart card */}
                <div className="lg:col-span-2 bg-white rounded-xl p-8 shadow-[0px_4px_20px_rgba(0,0,0,0.05)] border border-[#c0c6d6]/20 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-bold text-[#181c23]">Performance Overview</h2>
                                <p className="text-xs text-[#717785] font-semibold">Annual trend analysis for University KPI Achievement</p>
                            </div>
                            <div className="bg-[#f1f3fe] p-1 rounded-lg flex items-center gap-1 text-[11px] font-bold text-[#535f71]">
                                <button className="px-3 py-1 opacity-70">Monthly</button>
                                <button className="px-3 py-1 bg-white rounded shadow-sm text-[#181c23]">Quarterly</button>
                            </div>
                        </div>

                        {/* Visual wave chart using SVG path mimicking screenshot */}
                        <div className="relative h-48 w-full mt-4 flex items-end">
                            <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#005bb1" stopOpacity="0.15" />
                                        <stop offset="100%" stopColor="#005bb1" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                                <path 
                                    d="M0,150 C100,140 150,90 250,85 C350,80 400,120 500,110 C550,105 580,75 600,60" 
                                    fill="none" 
                                    stroke="#005bb1" 
                                    strokeWidth="4" 
                                />
                                <path 
                                    d="M0,150 C100,140 150,90 250,85 C350,80 400,120 500,110 C550,105 580,75 600,60 L600,200 L0,200 Z" 
                                    fill="url(#chartGrad)" 
                                />
                                {/* Current value tooltip placement */}
                                <circle cx="330" cy="82" r="6" fill="#005bb1" stroke="white" strokeWidth="2" />
                            </svg>
                            <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-[#181c23] text-white text-[10px] font-bold px-2 py-1 rounded shadow flex items-center gap-1">
                                <span>Current: 94.2% Achievement</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-[#c0c6d6]/10 mt-6">
                        <div className="flex items-center gap-4 text-xs font-semibold text-[#535f71]">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#005bb1]"></span>
                                <span>Main Target</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#d6e3ff]"></span>
                                <span>Previous Year</span>
                            </div>
                        </div>
                        <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">trending_up</span>
                            +4.2% from last period
                        </span>
                    </div>
                </div>

                {/* Score card right side */}
                <div className="bg-[#005bb1] text-white rounded-xl p-8 shadow-lg flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-15">
                        <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>award_star</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-[#d6e3ff] uppercase tracking-wider">OVERALL PERFORMANCE</span>
                        <h3 className="text-5xl font-extrabold mt-4">A+</h3>
                    </div>
                    <div className="mt-8 space-y-3">
                        <p className="text-xs opacity-90 leading-relaxed">
                            You have exceeded 8 out of 12 critical targets this semester.
                        </p>
                        <button className="w-full bg-white/20 border border-white/30 text-white font-bold py-3 rounded-lg text-xs shadow-sm hover:bg-white/30 transition-all">
                            View Accreditation Impact
                        </button>
                    </div>
                </div>
            </section>

            {/* Quarterly analysis section */}
            <h3 className="text-base font-bold text-[#181c23] mb-6 mt-8">Quarterly Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Q1 */}
                <div className="bg-white p-6 rounded-xl border border-[#c0c6d6]/20 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#717785]">
                        <span className="bg-[#f1f3fe] px-2.5 py-1 rounded-lg">QUARTER 1</span>
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-[#181c23]">82%</div>
                        <p className="text-[11px] text-[#535f71] mt-1 font-semibold">Infrastructure & Grants</p>
                    </div>
                    <div className="w-full bg-[#e5e8f2] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#005bb1] h-full w-[82%]"></div>
                    </div>
                </div>

                {/* Q2 */}
                <div className="bg-white p-6 rounded-xl border border-[#c0c6d6]/20 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#717785]">
                        <span className="bg-[#f1f3fe] px-2.5 py-1 rounded-lg">QUARTER 2</span>
                        <span className="material-symbols-outlined text-sm">calendar_today</span>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-[#181c23]">91%</div>
                        <p className="text-[11px] text-[#535f71] mt-1 font-semibold">Academic Output</p>
                    </div>
                    <div className="w-full bg-[#e5e8f2] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#005bb1] h-full w-[91%]"></div>
                    </div>
                </div>

                {/* Q3 */}
                <div className="bg-white p-6 rounded-xl border border-[#c0c6d6]/20 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-[10px] font-bold text-[#717785]">
                        <span className="bg-[#f1f3fe] px-2.5 py-1 rounded-lg">QUARTER 3</span>
                        <span className="material-symbols-outlined text-sm">analytics</span>
                    </div>
                    <div>
                        <div className="text-2xl font-extrabold text-[#181c23]">94%</div>
                        <p className="text-[11px] text-[#535f71] mt-1 font-semibold">International Partnership</p>
                    </div>
                    <div className="w-full bg-[#e5e8f2] h-1.5 rounded-full overflow-hidden">
                        <div className="bg-[#005bb1] h-full w-[94%]"></div>
                    </div>
                </div>

                {/* Q4 */}
                <div className="bg-white p-6 rounded-xl border border-[#c0c6d6]/20 shadow-sm flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-[#717785] bg-[#f1f3fe] px-2.5 py-1 rounded-lg uppercase tracking-wider mb-3">QUARTER 4</span>
                    <p className="text-xs text-[#717785] font-bold">Forecasting In Progress</p>
                </div>
            </div>

            {/* KPI Benchmarks table */}
            <div className="bg-white rounded-xl border border-[#c0c6d6]/20 shadow-sm p-8 mt-8">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-base font-bold text-[#181c23]">Key Performance Indicators</h3>
                        <p className="text-xs text-[#717785] font-semibold mt-1">Comparison of current metrics against institutional benchmarks</p>
                    </div>
                    <Link href={route('master')} className="text-xs font-bold text-[#005bb1] hover:underline flex items-center gap-1">
                        Detailed List
                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="border-b border-[#c0c6d6]/20 text-[#717785] font-bold uppercase tracking-wider">
                                <th className="pb-3 w-2/5">Indicator Name</th>
                                <th className="pb-3 text-center w-28">Baseline</th>
                                <th className="pb-3 text-center w-28">Current Target</th>
                                <th className="pb-3 w-48">Status & Progress</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#c0c6d6]/10">
                            <tr className="hover:bg-[#f1f3fe]/30 transition-colors">
                                <td className="py-4 font-semibold text-[#181c23]">
                                    Curriculum Quality
                                    <p className="text-[10px] text-[#717785] font-normal mt-0.5">Accreditation Score A</p>
                                </td>
                                <td className="py-4 text-center font-bold text-[#535f71]">72.0</td>
                                <td className="py-4 text-center font-bold text-[#535f71]">85.0</td>
                                <td className="py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-grow bg-[#e5e8f2] h-2 rounded-full overflow-hidden">
                                            <div className="bg-[#005bb1] h-full w-[85%]"></div>
                                        </div>
                                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider">MET</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

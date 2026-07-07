import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';

export default function Reporting() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tahun, setTahun] = useState(2026);

    useEffect(() => {
        fetch(`/api/dashboard/summary?tahun=${tahun}`)
            .then(res => res.json())
            .then(data => {
                setSummary(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [tahun]);

    // Compute status count for triwulan (mock/calculated based on demo seed)
    const getTwStatus = (tw) => {
        if (tw === 'Q1' || tw === 'Q2') return 'SELESAI';
        if (tw === 'Q3') return 'DIAJUKAN';
        return 'IN_PROGRESS';
    };

    return (
        <AuthenticatedLayout pageTitle="Capaian Kinerja">
            <Head title="Capaian Kinerja - IKU Portal" />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Pelaporan Capaian Kinerja</h2>
                    <p className="text-sm text-[#535f71]">Pilih triwulan pelaporan aktif untuk mengisi data capaian indikator.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Annual progress banner */}
                    <div className="bg-gradient-to-r from-[#005bb1] to-[#0073dd] rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-wider">ANNUAL CYCLE {tahun}</span>
                            <h3 className="text-2xl font-extrabold tracking-tight">Pelaporan Capaian Triwulan Q1 - Q4</h3>
                            <p className="text-xs opacity-90">Laporkan realisasi dan data dukung bukti secara bertahap setiap periode triwulan.</p>
                        </div>
                        <div className="flex gap-4 text-center">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[120px]">
                                <p className="text-[10px] opacity-75 font-bold uppercase">Rata Capaian</p>
                                <p className="text-3xl font-extrabold mt-1">{summary?.persentase_iku_tercapai || '78.4'}%</p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[120px]">
                                <p className="text-[10px] opacity-75 font-bold uppercase">Laporan Masuk</p>
                                <p className="text-3xl font-extrabold mt-1">{summary?.total_laporan || '0'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quarters grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((tw, idx) => {
                            const status = getTwStatus(tw);
                            return (
                                <div key={tw} className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-6 flex flex-col justify-between h-56 hover:border-[#005bb1]/30 transition-all">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">TRIWULAN {idx + 1}</span>
                                            {status === 'SELESAI' && (
                                                <span className="bg-green-100 text-green-700 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">SELESAI</span>
                                            )}
                                            {status === 'DIAJUKAN' && (
                                                <span className="bg-orange-100 text-orange-700 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">VERIFIKASI</span>
                                            )}
                                            {status === 'IN_PROGRESS' && (
                                                <span className="bg-[#d6e3ff] text-[#00468a] text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">IN PROGRESS</span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-bold text-[#181c23]">{tw} Reporting</h4>
                                        <p className="text-xs text-[#535f71]">Periode pengisian data capaian dan bukti pendukung untuk triwulan ke-{idx + 1}.</p>
                                    </div>

                                    <Link 
                                        href={route('capaian.edit') + `?triwulan=${tw}`}
                                        className="w-full bg-[#f1f3fe] text-[#005bb1] text-xs font-bold py-2.5 rounded-xl block text-center hover:bg-[#005bb1]/5 transition-colors uppercase tracking-wider"
                                    >
                                        Isi Capaian {tw}
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

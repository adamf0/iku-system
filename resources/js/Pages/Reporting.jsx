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

    // Active Triwulan based on current month:
    // TW1: Jan - Mar (1-3)
    // TW2: Apr - Jun (4-6)
    // TW3: Jul - Sep (7-9)
    // TW4: Okt - Des (10-12)
    const getActiveTriwulan = () => {
        const month = new Date().getMonth() + 1;
        if (month >= 1 && month <= 3) return 'TW1';
        if (month >= 4 && month <= 6) return 'TW2';
        if (month >= 7 && month <= 9) return 'TW3';
        return 'TW4';
    };

    const activeTw = getActiveTriwulan();

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
            ) : !summary?.is_assigned ? (
                <div className="bg-white border border-[#c0c6d6]/20 rounded-2xl p-12 text-center text-[#535f71] space-y-4 max-w-2xl mx-auto shadow-sm">
                    <span className="material-symbols-outlined text-[#005bb1] text-6xl">info</span>
                    <h3 className="text-base font-extrabold text-[#181c23] uppercase tracking-wider">Belum Ada Penugasan Target</h3>
                    <p className="text-xs text-[#717785] leading-relaxed">
                        Unit Anda belum ditugaskan untuk pelaporan target IKU pada tahun {tahun} ini oleh Administrator. 
                        Silakan hubungi pihak admin untuk mendapatkan penugasan target terlebih dahulu.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Annual progress banner (Mengambil data real dari DB) */}
                    <div className="bg-gradient-to-r from-[#005bb1] to-[#0073dd] rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase tracking-wider">ANNUAL CYCLE {tahun}</span>
                            <h3 className="text-2xl font-extrabold tracking-tight">Pelaporan Capaian Triwulan TW1 - TW4</h3>
                            <p className="text-xs opacity-90">Laporkan realisasi dan data dukung bukti secara bertahap setiap periode triwulan.</p>
                        </div>
                        <div className="flex gap-4 text-center">
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[130px]">
                                <p className="text-[10px] opacity-75 font-bold uppercase tracking-wider">Rata Capaian</p>
                                <p className="text-3xl font-extrabold mt-1">
                                    {(summary?.persentase_iku_tercapai !== undefined ? summary.persentase_iku_tercapai : 0).toString().replace('.', ',')}%
                                </p>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 min-w-[130px]">
                                <p className="text-[10px] opacity-75 font-bold uppercase tracking-wider">Laporan Masuk</p>
                                <p className="text-3xl font-extrabold mt-1">{summary?.total_laporan ?? 0}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quarters grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {[
                            { id: 'TW1', name: 'TW1 Reporting', dateRange: 'Januari – Maret' },
                            { id: 'TW2', name: 'TW2 Reporting', dateRange: 'April – Juni' },
                            { id: 'TW3', name: 'TW3 Reporting', dateRange: 'Juli – September' },
                            { id: 'TW4', name: 'TW4 Reporting', dateRange: 'Oktober – Desember' }
                        ].map((twItem, idx) => {
                            const isActive = (twItem.id === activeTw);
                            return (
                                <div 
                                    key={twItem.id} 
                                    className={`bg-white rounded-2xl border shadow-sm p-6 flex flex-col justify-between h-60 transition-all ${
                                        isActive ? 'border-[#005bb1] ring-2 ring-[#005bb1]/20' : 'border-[#c0c6d6]/20 opacity-85'
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">TRIWULAN {idx + 1}</span>
                                            {isActive ? (
                                                <span className="bg-indigo-100 text-indigo-700 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">IN PROGRESS</span>
                                            ) : (
                                                <span className="bg-gray-100 text-gray-500 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[10px]">lock</span> TERKUNCI
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-lg font-bold text-[#181c23]">{twItem.name}</h4>
                                        <p className="text-xs text-[#535f71]">Periode: <span className="font-semibold text-[#181c23]">{twItem.dateRange}</span></p>
                                    </div>

                                    {isActive ? (
                                        <Link 
                                            href={route('capaian.edit') + `?triwulan=${twItem.id}`}
                                            className="w-full bg-[#005bb1] text-white text-xs font-extrabold py-3 rounded-xl block text-center hover:bg-[#0073dd] transition-all uppercase tracking-wider shadow-sm"
                                        >
                                            Isi Capaian {twItem.id}
                                        </Link>
                                    ) : (
                                        <button 
                                            disabled
                                            className="w-full bg-gray-100 text-gray-400 text-xs font-bold py-3 rounded-xl block text-center uppercase tracking-wider cursor-not-allowed opacity-60"
                                            title="Periode pengisian ini belum aktif atau telah ditutup."
                                        >
                                            Isi Capaian {twItem.id}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

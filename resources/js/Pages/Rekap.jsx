import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Rekap() {
    const [triwulan, setTriwulan] = useState('TW1');
    const [tahun, setTahun] = useState(2026);
    const [rekap, setRekap] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/dashboard/rekap-matriks?tahun=${tahun}&triwulan=${triwulan}`)
            .then(res => res.json())
            .then(data => {
                setRekap(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [triwulan, tahun]);

    const getHeatmapColor = (nilai) => {
        if (!nilai) return 'bg-gray-100 text-gray-400'; // No data
        const ratio = nilai.capaian;
        const target = nilai.target;

        if (ratio >= target) return 'bg-green-100 text-green-700 font-bold'; // Achieved
        if (ratio >= target * 0.8) return 'bg-blue-100 text-blue-700 font-bold'; // Near target
        return 'bg-red-100 text-red-700 font-bold'; // Low
    };

    return (
        <AuthenticatedLayout pageTitle="Rekap & Matriks Capaian Unit">
            <Head title="Rekap Matriks Heatmap - Performance Management" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Heatmap Matriks Unit Kerja</h2>
                    <p className="text-sm text-[#535f71]">Visualisasi perbandingan pencapaian target IKU per unit.</p>
                </div>
                <div className="flex gap-2">
                    <select 
                        value={triwulan} 
                        onChange={(e) => setTriwulan(e.target.value)}
                        className="bg-white border border-[#c0c6d6] rounded-xl text-xs font-bold px-4 py-2 text-[#535f71]"
                    >
                        <option value="TW1">TW1</option>
                        <option value="TW2">TW2</option>
                        <option value="TW3">TW3</option>
                        <option value="TW4">TW4</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <section className="bg-white rounded-[2rem] shadow-sm border border-[#c0c6d6]/10 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[#f1f3fe] border-b border-[#c0c6d6]/20">
                                    <th className="p-4 font-bold text-[#535f71] w-48">Unit Kerja</th>
                                    {rekap?.iku_columns?.map(col => (
                                        <th key={col.kode_iku} className="p-4 font-bold text-[#535f71] text-center w-24" title={col.nama}>
                                            {col.kode_iku}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#c0c6d6]/10">
                                {rekap?.matriks?.map(row => (
                                    <tr key={row.kode_unit} className="hover:bg-[#f1f3fe]/20">
                                        <td className="p-4 font-bold text-[#181c23]">{row.nama_unit}</td>
                                        {rekap?.iku_columns?.map(col => {
                                            const nilai = row.nilai[col.kode_iku];
                                            return (
                                                <td 
                                                    key={col.kode_iku} 
                                                    className={`p-4 text-center border-l border-[#c0c6d6]/10 ${getHeatmapColor(nilai)}`}
                                                >
                                                    {nilai ? `${nilai.capaian}%` : '-'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </AuthenticatedLayout>
    );
}

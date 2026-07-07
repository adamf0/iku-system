import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Verifikasi() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadQueue();
    }, []);

    const loadQueue = () => {
        setLoading(true);
        fetch('/api/dashboard/antrean-verifikasi')
            .then(res => res.json())
            .then(data => {
                setQueue(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const handleVerify = (id, action) => {
        const catatan = action === 'REJECT' ? prompt('Masukkan alasan penolakan:') : '';
        if (action === 'REJECT' && !catatan) return;

        fetch(`/api/capaian/${id}/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            },
            body: JSON.stringify({ action, catatan })
        })
        .then(res => res.json())
        .then(() => {
            alert('Status verifikasi berhasil diperbarui!');
            loadQueue();
        })
        .catch(err => console.error(err));
    };

    const handleSahkan = (id) => {
        fetch(`/api/capaian/${id}/sahkan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(() => {
            alert('Capaian berhasil disahkan!');
            loadQueue();
        })
        .catch(err => console.error(err));
    };

    return (
        <AuthenticatedLayout pageTitle="Persetujuan & Pengesahan LPM">
            <Head title="Verifikasi Capaian - Performance Management" />

            <div>
                <h2 className="text-xl font-bold text-[#181c23]">Antrean Verifikasi LPM</h2>
                <p className="text-sm text-[#535f71]">Tinjau ajukan capaian unit kerja sebelum disahkan secara triwulanan.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[200px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : queue.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-[#c0c6d6]/20 text-center text-[#535f71]">
                    Tidak ada ajukan capaian baru untuk diverifikasi.
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#c0c6d6]/10">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-[#f1f3fe] border-b border-[#c0c6d6]/20">
                                <th className="p-4 font-bold text-[#535f71]">Unit</th>
                                <th className="p-4 font-bold text-[#535f71]">Indikator</th>
                                <th className="p-4 font-bold text-[#535f71] text-center">Triwulan</th>
                                <th className="p-4 font-bold text-[#535f71] text-center">Nilai Capaian</th>
                                <th className="p-4 font-bold text-[#535f71] text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#c0c6d6]/10">
                            {queue.map(item => (
                                <tr key={item.id_capaian} className="hover:bg-[#f1f3fe]/20">
                                    <td className="p-4 font-bold text-[#181c23]">{item.nama_unit}</td>
                                    <td className="p-4">
                                        <p className="font-semibold text-[#181c23]">{item.kode_iku} - {item.nama_iku}</p>
                                        <p className="text-[10px] text-[#717785]">Diinput oleh: {item.diinput_oleh}</p>
                                    </td>
                                    <td className="p-4 text-center font-bold text-[#535f71]">{item.triwulan}</td>
                                    <td className="p-4 text-center font-extrabold text-[#005bb1] text-sm">{item.nilai_capaian}%</td>
                                    <td className="p-4 text-center space-x-2">
                                        <button 
                                            onClick={() => handleVerify(item.id_capaian, 'APPROVE')}
                                            className="px-3 py-1.5 bg-[#005bb1] text-white rounded-lg font-bold hover:bg-[#0073dd]"
                                        >
                                            Setujui
                                        </button>
                                        <button 
                                            onClick={() => handleVerify(item.id_capaian, 'REJECT')}
                                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200"
                                        >
                                            Tolak
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

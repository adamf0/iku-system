import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';

export default function ManagementTarget() {
    const user = usePage().props.auth.user;
    const [ikus, setIkus] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal Edit State
    const [editingTargetId, setEditingTargetId] = useState(null);
    const [formData, setFormData] = useState({
        base_line: '',
        target: '',
        target_d3: '',
        target_d4: '',
        target_s1: '',
        target_s2: '',
        target_s3: '',
        target_profesi: '',
        target_unit: '',
        target_fakultas: '',
        target_prodi: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/master/contexts').then(res => res.json()),
            fetch('/api/master/iku').then(res => res.json())
        ])
        .then(([ctxData, ikuData]) => {
            setContexts(ctxData);
            setIkus(ikuData);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    const handleEditTargetClick = (iku) => {
        setEditingTargetId(iku.id);
        setFormData({
            base_line: iku.base_line || '',
            target: iku.target || '',
            target_d3: iku.target_d3 || '',
            target_d4: iku.target_d4 || '',
            target_s1: iku.target_s1 || '',
            target_s2: iku.target_s2 || '',
            target_s3: iku.target_s3 || '',
            target_profesi: iku.target_profesi || '',
            target_unit: iku.target_unit || '',
            target_fakultas: iku.target_fakultas || '',
            target_prodi: iku.target_prodi || ''
        });
    };

    const handleInputChange = (field, val) => {
        setFormData(prev => ({
            ...prev,
            [field]: val
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        
        fetch(`/api/master/iku/${editingTargetId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(() => {
            alert('Target indikator berhasil diperbarui!');
            setEditingTargetId(null);
            loadData();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan target.');
        });
    };

    return (
        <AuthenticatedLayout pageTitle="Management Target">
            <Head title="Management Target - IKU Portal" />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Pengaturan Target Jenjang & Unit</h2>
                    <p className="text-sm text-[#535f71]">Tentukan baseline dan target performa untuk D3, D4, S1, S2, S3, Profesi, Unit, Fakultas, dan Prodi.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {contexts.map(ctx => {
                        const ctxIkus = ikus.filter(i => i.id_konteks === ctx.id);
                        return (
                            <div key={ctx.id} className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8 space-y-6">
                                <h3 className="text-base font-extrabold text-[#005bb1] border-b border-[#c0c6d6]/20 pb-3 uppercase tracking-wider">
                                    {ctx.nama}
                                </h3>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-[#c0c6d6]/20 text-[#717785] font-bold uppercase tracking-wider bg-[#f1f3fe]/40">
                                                <th className="p-3 w-1/4">Indikator</th>
                                                <th className="p-3 text-center">Baseline</th>
                                                <th className="p-3 text-center">Target 2026</th>
                                                <th className="p-3 text-center">D3</th>
                                                <th className="p-3 text-center">D4</th>
                                                <th className="p-3 text-center">S1</th>
                                                <th className="p-3 text-center">S2</th>
                                                <th className="p-3 text-center">S3</th>
                                                <th className="p-3 text-center">Profesi</th>
                                                <th className="p-3 text-center">Unit</th>
                                                <th className="p-3 text-center">Fakultas</th>
                                                <th className="p-3 text-center">Prodi</th>
                                                <th className="p-3 w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#c0c6d6]/10">
                                            {ctxIkus.length === 0 ? (
                                                <tr>
                                                    <td colSpan="13" className="p-3 text-center text-[#717785] italic">Belum ada data.</td>
                                                </tr>
                                            ) : (
                                                ctxIkus.map(iku => (
                                                    <tr key={iku.id} className="hover:bg-[#f1f3fe]/20">
                                                        <td className="p-3">
                                                            <div className="font-bold text-[#181c23]">{iku.full_kategori}</div>
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-[#535f71]">{iku.base_line || '-'}</td>
                                                        <td className="p-3 text-center font-bold text-[#005bb1]">{iku.target || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_d3 || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_d4 || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_s1 || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_s2 || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_s3 || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_profesi || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_unit || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_fakultas || '-'}</td>
                                                        <td className="p-3 text-center text-[#535f71]">{iku.target_prodi || '-'}</td>
                                                        <td className="p-3 text-center">
                                                            {user.role === 'ADMIN' && (
                                                                <button 
                                                                    onClick={() => handleEditTargetClick(iku)}
                                                                    className="text-xs font-bold text-[#005bb1] hover:underline"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Target Editor Modal */}
            {editingTargetId && (
                <div className="fixed inset-0 bg-[#181c23]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-[#c0c6d6]/20 relative max-h-[95vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-base font-bold text-[#181c23]">Edit Target Parameter: Indikator #{editingTargetId}</h3>
                            <button onClick={() => setEditingTargetId(null)} className="text-[#717785] hover:text-[#181c23]">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Baseline</label>
                                    <input 
                                        type="text" value={formData.base_line} onChange={(e) => handleInputChange('base_line', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Target 2026</label>
                                    <input 
                                        type="text" value={formData.target} onChange={(e) => handleInputChange('target', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t border-[#c0c6d6]/10 space-y-4">
                                <p className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">Breakdown Target Jenjang</p>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target D3</label>
                                        <input 
                                            type="text" value={formData.target_d3} onChange={(e) => handleInputChange('target_d3', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target D4</label>
                                        <input 
                                            type="text" value={formData.target_d4} onChange={(e) => handleInputChange('target_d4', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target S1</label>
                                        <input 
                                            type="text" value={formData.target_s1} onChange={(e) => handleInputChange('target_s1', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target S2</label>
                                        <input 
                                            type="text" value={formData.target_s2} onChange={(e) => handleInputChange('target_s2', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target S3</label>
                                        <input 
                                            type="text" value={formData.target_s3} onChange={(e) => handleInputChange('target_s3', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target Profesi</label>
                                        <input 
                                            type="text" value={formData.target_profesi} onChange={(e) => handleInputChange('target_profesi', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target Unit</label>
                                        <input 
                                            type="text" value={formData.target_unit} onChange={(e) => handleInputChange('target_unit', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target Fakultas</label>
                                        <input 
                                            type="text" value={formData.target_fakultas} onChange={(e) => handleInputChange('target_fakultas', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-bold text-[#535f71] uppercase">Target Prodi</label>
                                        <input 
                                            type="text" value={formData.target_prodi} onChange={(e) => handleInputChange('target_prodi', e.target.value)}
                                            className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-2.5 py-1.5 text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-[#c0c6d6]/10 flex justify-end gap-3">
                                <button 
                                    type="button" onClick={() => setEditingTargetId(null)}
                                    className="px-5 py-2.5 rounded-lg border border-[#c0c6d6] text-[#535f71] font-bold text-xs hover:bg-[#f1f3fe]"
                                >
                                    BATAL
                                </button>
                                <button 
                                    type="submit"
                                    className="px-6 py-2.5 rounded-lg bg-[#005bb1] text-white font-bold text-xs hover:bg-[#0073dd] shadow-sm uppercase tracking-wider"
                                >
                                    SIMPAN
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

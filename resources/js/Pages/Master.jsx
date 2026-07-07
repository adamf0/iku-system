import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';

export default function Master() {
    const user = usePage().props.auth.user;
    const [ikus, setIkus] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal Edit/Create State
    const [editingIkuId, setEditingIkuId] = useState(null);
    const [isCreate, setIsCreate] = useState(false);
    const [formData, setFormData] = useState({
        id_konteks: '',
        iku: '',
        kategori: '',
        id_sub: '',
        satuan: '',
        base_line: '',
        target: ''
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

    const handleCreateClick = () => {
        setIsCreate(true);
        setEditingIkuId(null);
        setFormData({
            id_konteks: contexts[0]?.id || '',
            iku: '',
            kategori: '',
            id_sub: '',
            satuan: '%',
            base_line: '',
            target: ''
        });
    };

    const handleEditClick = (iku) => {
        setIsCreate(false);
        setEditingIkuId(iku.id);
        setFormData({
            id_konteks: iku.id_konteks || '',
            iku: iku.iku || '',
            kategori: iku.kategori || '',
            id_sub: iku.id_sub || '',
            satuan: iku.satuan || '',
            base_line: iku.base_line || '',
            target: iku.target || ''
        });
    };

    const handleDeleteClick = (id) => {
        if (!confirm('Apakah anda yakin ingin menghapus indikator ini? Semua sub-indikator dan data capaian terkait juga akan dihapus.')) return;
        
        fetch(`/api/master/iku/${id}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            }
        })
        .then(res => res.json())
        .then(() => {
            alert('Indikator berhasil dihapus.');
            loadData();
        })
        .catch(err => console.error(err));
    };

    const handleInputChange = (field, val) => {
        setFormData(prev => ({
            ...prev,
            [field]: val
        }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        const url = isCreate ? '/api/master/iku' : `/api/master/iku/${editingIkuId}`;
        
        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            },
            body: JSON.stringify(formData)
        })
        .then(res => res.json())
        .then(() => {
            alert(isCreate ? 'Indikator berhasil dibuat!' : 'Indikator berhasil diperbarui!');
            setEditingIkuId(null);
            setIsCreate(false);
            loadData();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan indikator.');
        });
    };

    // Helper: find context name by ID
    const getContextName = (id) => {
        const ctx = contexts.find(c => c.id === id);
        return ctx ? ctx.nama : 'Lainnya';
    };

    return (
        <AuthenticatedLayout pageTitle="Management Indikator">
            <Head title="Management Indikator - IKU Portal" />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Daftar Master Indikator Kinerja Utama</h2>
                    <p className="text-sm text-[#535f71]">Buat, edit, dan hapus indikator serta struktur hirarki sub-indikator.</p>
                </div>
                {user.role === 'ADMIN' && (
                    <button 
                        onClick={handleCreateClick}
                        className="bg-[#005bb1] text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] shadow-sm uppercase tracking-wider"
                    >
                        Tambah Indikator
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-8">
                    {contexts.map(ctx => {
                        const ctxIkus = ikus.filter(i => i.id_konteks === ctx.id && !i.id_sub);
                        return (
                            <div key={ctx.id} className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8 space-y-6">
                                <h3 className="text-base font-extrabold text-[#005bb1] border-b border-[#c0c6d6]/20 pb-3 uppercase tracking-wider">
                                    {ctx.nama}
                                </h3>

                                <div className="space-y-4 divide-y divide-[#c0c6d6]/10">
                                    {ctxIkus.length === 0 ? (
                                        <p className="text-xs text-[#717785] italic py-2">Belum ada indikator terdaftar di konteks ini.</p>
                                    ) : (
                                        ctxIkus.map(iku => {
                                            const subRows = ikus.filter(s => s.id_sub === iku.id);
                                            return (
                                                <div key={iku.id} className="pt-4 first:pt-0 space-y-3">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex items-start gap-3">
                                                            <span className="text-[10px] font-bold bg-[#f1f3fe] text-[#005bb1] px-2.5 py-1 rounded-lg uppercase tracking-wider flex-shrink-0">
                                                                {iku.iku}
                                                            </span>
                                                            <div>
                                                                <h4 className="text-sm font-bold text-[#181c23]">{iku.kategori}</h4>
                                                                <p className="text-[10px] text-[#717785] font-semibold uppercase mt-0.5">Satuan: {iku.satuan} • Baseline: {iku.base_line || '-'} • Target: {iku.target || '-'}</p>
                                                            </div>
                                                        </div>
                                                        {user.role === 'ADMIN' && (
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => handleEditClick(iku)}
                                                                    className="text-xs font-bold text-[#005bb1] hover:underline"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <span className="text-[#c0c6d6]">|</span>
                                                                <button 
                                                                    onClick={() => handleDeleteClick(iku.id)}
                                                                    className="text-xs font-bold text-red-600 hover:underline"
                                                                >
                                                                    Hapus
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Sub indicators rendering (recursively or list childs) */}
                                                    {subRows.length > 0 && (
                                                        <div className="pl-8 space-y-2 border-l-2 border-[#f1f3fe] ml-4">
                                                            {subRows.map(sub => {
                                                                const subSubs = ikus.filter(ss => ss.id_sub === sub.id);
                                                                return (
                                                                    <div key={sub.id} className="space-y-1">
                                                                        <div className="flex justify-between items-start text-xs bg-[#f9f9ff] px-4 py-2 rounded-lg border border-[#c0c6d6]/10 hover:border-[#005bb1]/30 transition-all">
                                                                            <div>
                                                                                <strong className="text-[#005bb1] mr-1.5">{sub.iku}</strong> 
                                                                                <span className="text-[#535f71] font-semibold">{sub.kategori}</span>
                                                                                <span className="text-[10px] text-[#717785] ml-2">(Satuan: {sub.satuan} • B: {sub.base_line || '-'} • T: {sub.target || '-'})</span>
                                                                            </div>
                                                                            {user.role === 'ADMIN' && (
                                                                                <div className="flex items-center gap-2 font-bold">
                                                                                    <button onClick={() => handleEditClick(sub)} className="text-[#005bb1] hover:underline text-[10px]">Edit</button>
                                                                                    <button onClick={() => handleDeleteClick(sub.id)} className="text-red-600 hover:underline text-[10px]">Hapus</button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Nested Level 3 (e.g. child rows under Sub IKU 1.1) */}
                                                                        {subSubs.length > 0 && (
                                                                            <div className="pl-8 space-y-1.5 border-l border-[#c0c6d6]/20 ml-3 pt-1">
                                                                                {subSubs.map(ss => (
                                                                                    <div key={ss.id} className="flex justify-between items-center text-[11px] bg-[#f9f9ff] px-3 py-1.5 rounded border border-[#c0c6d6]/10 hover:border-[#005bb1]/20">
                                                                                        <div>
                                                                                            <span className="text-[#005bb1] font-bold mr-1.5">{ss.iku}</span>
                                                                                            <span className="text-[#535f71]">{ss.kategori}</span>
                                                                                            <span className="text-[9px] text-[#717785] ml-2">(B: {ss.base_line || '-'} • T: {ss.target || '-'})</span>
                                                                                        </div>
                                                                                        {user.role === 'ADMIN' && (
                                                                                            <div className="flex items-center gap-2 font-bold text-[9px]">
                                                                                                <button onClick={() => handleEditClick(ss)} className="text-[#005bb1] hover:underline">Edit</button>
                                                                                                <button onClick={() => handleDeleteClick(ss.id)} className="text-red-600 hover:underline">Hapus</button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal Dialog */}
            {(editingIkuId || isCreate) && (
                <div className="fixed inset-0 bg-[#181c23]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-[#c0c6d6]/20 relative max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-base font-bold text-[#181c23]">
                                {isCreate ? 'Tambah Indikator Master' : `Edit Indikator: #${editingIkuId}`}
                            </h3>
                            <button onClick={() => { setEditingIkuId(null); setIsCreate(false); }} className="text-[#717785] hover:text-[#181c23]">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Konteks Indikator</label>
                                <select 
                                    value={formData.id_konteks}
                                    onChange={(e) => handleInputChange('id_konteks', e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    required
                                >
                                    {contexts.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Kode IKU (e.g. IKU 1)</label>
                                    <input 
                                        type="text" 
                                        value={formData.iku}
                                        onChange={(e) => handleInputChange('iku', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                        placeholder="IKU 1"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Satuan</label>
                                    <input 
                                        type="text" 
                                        value={formData.satuan}
                                        onChange={(e) => handleInputChange('satuan', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                        placeholder="%"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Deskripsi / Kategori</label>
                                <textarea 
                                    value={formData.kategori}
                                    onChange={(e) => handleInputChange('kategori', e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl p-3 text-xs h-20 resize-none outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    placeholder="Masukkan deskripsi lengkap indikator..."
                                    required
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Parent Indikator (Sub Dari)</label>
                                <select 
                                    value={formData.id_sub}
                                    onChange={(e) => handleInputChange('id_sub', e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                >
                                    <option value="">-- Tanpa Induk (Top Level) --</option>
                                    {ikus.filter(i => i.id !== editingIkuId).map(i => (
                                        <option key={i.id} value={i.id}>{i.iku} - {i.kategori.substring(0, 50)}...</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Baseline</label>
                                    <input 
                                        type="text" 
                                        value={formData.base_line}
                                        onChange={(e) => handleInputChange('base_line', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs"
                                        placeholder="-"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Target 2026</label>
                                    <input 
                                        type="text" 
                                        value={formData.target}
                                        onChange={(e) => handleInputChange('target', e.target.value)}
                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs"
                                        placeholder="-"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-[#c0c6d6]/10 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => { setEditingIkuId(null); setIsCreate(false); }}
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

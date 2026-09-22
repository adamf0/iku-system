import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';

export default function Master() {
    const user = usePage().props.auth.user;
    const [ikus, setIkus] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(true);

    const [filterTab, setFilterTab] = useState('ALL');

    // Modal Edit/Create State
    const [editingIkuId, setEditingIkuId] = useState(null);
    const [isCreate, setIsCreate] = useState(false);
    const [formData, setFormData] = useState({
        id_konteks: '',
        iku: '',
        kategori: '',
        id_sub: '',
        satuan: '',
        jenis_iku: 'WAJIB',
        formula_text: '',
        sumber_data: '',
        file_berkas: null
    });

    // Modal Upload Berkas State
    const [uploadModalIku, setUploadModalIku] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    const handleOpenUploadModal = (iku) => {
        setUploadModalIku(iku);
        setSelectedFile(null);
        setUploadError('');
    };

    const handleCloseUploadModal = () => {
        setUploadModalIku(null);
        setSelectedFile(null);
        setUploadError('');
        setIsUploading(false);
    };

    const handleUploadBerkas = (e) => {
        e.preventDefault();
        if (!selectedFile || !uploadModalIku) return;

        const allowedExtensions = ['pdf', 'xls', 'xlsx'];
        const fileExt = selectedFile.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExt)) {
            setUploadError('Hanya file berkas PDF dan Excel (.pdf, .xls, .xlsx) yang diperbolehkan.');
            return;
        }

        if (selectedFile.size > 5 * 1024 * 1024) {
            setUploadError('Ukuran berkas tidak boleh melebihi 5MB.');
            return;
        }

        setIsUploading(true);
        setUploadError('');

        const data = new FormData();
        data.append('file_berkas', selectedFile);

        axios.post(`/api/master/iku/${uploadModalIku.id}/berkas`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        .then(res => {
            setIsUploading(false);
            alert('Berkas indikator berhasil diunggah!');
            const newUrl = res.data.file_berkas;
            setIkus(prev => prev.map(item => item.id === uploadModalIku.id ? { ...item, file_berkas: newUrl } : item));
            setUploadModalIku(prev => prev ? { ...prev, file_berkas: newUrl } : null);
            setSelectedFile(null);
            loadData();
        })
        .catch(err => {
            setIsUploading(false);
            const msg = err.response?.data?.message || err.response?.data?.error || 'Gagal mengunggah berkas.';
            setUploadError(msg);
        });
    };

    const handleDeleteBerkas = () => {
        if (!uploadModalIku || !uploadModalIku.file_berkas) return;
        if (!confirm('Apakah anda yakin ingin menghapus berkas indikator ini?')) return;

        setIsUploading(true);
        axios.delete(`/api/master/iku/${uploadModalIku.id}/berkas`)
        .then(() => {
            setIsUploading(false);
            alert('Berkas berhasil dihapus.');
            setIkus(prev => prev.map(item => item.id === uploadModalIku.id ? { ...item, file_berkas: null } : item));
            setUploadModalIku(prev => prev ? { ...prev, file_berkas: null } : null);
            loadData();
        })
        .catch(err => {
            setIsUploading(false);
            alert(err.response?.data?.error || 'Gagal menghapus berkas.');
        });
    };

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
            jenis_iku: 'WAJIB',
            formula_text: '',
            sumber_data: '',
            file_berkas: null
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
            jenis_iku: iku.jenis_iku || 'WAJIB',
            formula_text: iku.formula_text || '',
            sumber_data: iku.sumber_data || '',
            file_berkas: iku.file_berkas || null
        });
    };

    const handleDeleteClick = (id) => {
        if (!confirm('Apakah anda yakin ingin menghapus indikator ini? Semua sub-indikator dan data capaian terkait juga akan dihapus.')) return;
        
        axios.delete(`/api/master/iku/${id}`)
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
        
        axios.post(url, formData)
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
    const renderJenisBadge = (jenis) => {
        const val = (jenis || 'WAJIB').toUpperCase();
        if (val === 'PILIHAN') {
            return <span className="text-[9px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-2 border border-purple-200">PILIHAN</span>;
        } else if (val === 'PARTISIPATIF') {
            return <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-2 border border-amber-200">PARTISIPATIF</span>;
        }
        return <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-2 border border-blue-200">WAJIB</span>;
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

            {/* Tab Filter Kelompok (Wajib, Pilihan, Partisipatif) */}
            <div className="flex items-center gap-2 mb-6 bg-[#f1f3fe]/60 p-1.5 rounded-2xl w-fit border border-[#c0c6d6]/20">
                {[
                    { id: 'ALL', label: 'Semua Indikator' },
                    { id: 'WAJIB', label: 'Wajib' },
                    { id: 'PILIHAN', label: 'Pilihan' },
                    { id: 'PARTISIPATIF', label: 'Partisipatif' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setFilterTab(tab.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                            filterTab === tab.id
                                ? 'bg-[#005bb1] text-white shadow-sm'
                                : 'text-[#535f71] hover:text-[#181c23] hover:bg-white/50'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-8">
                    {contexts.map(ctx => {
                        const ctxIkus = ikus.filter(i => {
                            if (i.id_konteks !== ctx.id || i.id_sub) return false;
                            if (filterTab !== 'ALL' && (i.jenis_iku || 'WAJIB').toUpperCase() !== filterTab) return false;
                            return true;
                        });
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
                                                                <div className="flex items-center">
                                                                    <h4 className="text-sm font-bold text-[#181c23]">{iku.kategori}</h4>
                                                                    {renderJenisBadge(iku.jenis_iku)}
                                                                </div>
                                                                <p className="text-[10px] text-[#717785] font-semibold uppercase mt-0.5 flex flex-wrap items-center gap-2">
                                                                    <span>Satuan: {iku.satuan} • Baseline: {iku.base_line || '-'} • Target: {iku.target || '-'}</span>
                                                                    {iku.file_berkas && (
                                                                        <a 
                                                                            href={iku.file_berkas} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 text-[#005bb1] hover:underline bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold normal-case"
                                                                            title="Buka Berkas"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[13px]">attachment</span>
                                                                            <span>Berkas: {iku.file_berkas.split('/').pop().replace(/^\d+_/, '')}</span>
                                                                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>
                                                                        </a>
                                                                    )}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {user.role === 'ADMIN' && (
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleOpenUploadModal(iku)}
                                                                    className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                                                                        iku.file_berkas 
                                                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100' 
                                                                            : 'text-[#005bb1] bg-[#005bb1]/10 border-[#005bb1]/30 hover:bg-[#005bb1]/20'
                                                                    }`}
                                                                    title={iku.file_berkas ? 'Lihat / Kelola Berkas' : 'Upload Berkas Indikator'}
                                                                >
                                                                    <span className="material-symbols-outlined text-[15px]">
                                                                        {iku.file_berkas ? 'task' : 'upload_file'}
                                                                    </span>
                                                                    <span>{iku.file_berkas ? 'Berkas Ada' : 'Upload Berkas'}</span>
                                                                </button>
                                                                <span className="text-[#c0c6d6]">|</span>
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

                                                    {/* Sub indicators rendering */}
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
                                                                                {renderJenisBadge(sub.jenis_iku)}
                                                                                <span className="text-[10px] text-[#717785] ml-2">(Satuan: {sub.satuan} • B: {sub.base_line || '-'} • T: {sub.target || '-'})</span>
                                                                                {sub.file_berkas && (
                                                                                    <a 
                                                                                        href={sub.file_berkas} 
                                                                                        target="_blank" 
                                                                                        rel="noopener noreferrer"
                                                                                        className="inline-flex items-center gap-1 text-[#005bb1] hover:underline bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-bold ml-2"
                                                                                        title="Buka Berkas"
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[11px]">attachment</span>
                                                                                        <span>Berkas</span>
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                            {user.role === 'ADMIN' && (
                                                                                <div className="flex items-center gap-2 font-bold flex-shrink-0">
                                                                                    <button 
                                                                                        type="button"
                                                                                        onClick={() => handleOpenUploadModal(sub)}
                                                                                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                                                                                            sub.file_berkas 
                                                                                                ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100' 
                                                                                                : 'text-[#005bb1] bg-[#005bb1]/10 border-[#005bb1]/30 hover:bg-[#005bb1]/20'
                                                                                        }`}
                                                                                        title={sub.file_berkas ? 'Lihat / Kelola Berkas' : 'Upload Berkas'}
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[13px]">
                                                                                            {sub.file_berkas ? 'task' : 'upload_file'}
                                                                                        </span>
                                                                                        <span>{sub.file_berkas ? 'Berkas Ada' : 'Upload Berkas'}</span>
                                                                                    </button>
                                                                                    <span className="text-[#c0c6d6]">|</span>
                                                                                    <button onClick={() => handleEditClick(sub)} className="text-[#005bb1] hover:underline text-[10px]">Edit</button>
                                                                                    <span className="text-[#c0c6d6]">|</span>
                                                                                    <button onClick={() => handleDeleteClick(sub.id)} className="text-red-600 hover:underline text-[10px]">Hapus</button>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Nested Level 3 */}
                                                                        {subSubs.length > 0 && (
                                                                            <div className="pl-8 space-y-1.5 border-l border-[#c0c6d6]/20 ml-3 pt-1">
                                                                                {subSubs.map(ss => (
                                                                                    <div key={ss.id} className="flex justify-between items-center text-[11px] bg-[#f9f9ff] px-3 py-1.5 rounded border border-[#c0c6d6]/10 hover:border-[#005bb1]/20">
                                                                                        <div>
                                                                                            <span className="text-[#005bb1] font-bold mr-1.5">{ss.iku}</span>
                                                                                            <span className="text-[#535f71]">{ss.kategori}</span>
                                                                                            {renderJenisBadge(ss.jenis_iku)}
                                                                                            <span className="text-[9px] text-[#717785] ml-2">(B: {ss.base_line || '-'} • T: {ss.target || '-'})</span>
                                                                                            {ss.file_berkas && (
                                                                                                <a 
                                                                                                    href={ss.file_berkas} 
                                                                                                    target="_blank" 
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="inline-flex items-center gap-0.5 text-[#005bb1] hover:underline bg-blue-50 border border-blue-200 px-1 py-0.5 rounded text-[8px] font-bold ml-1.5"
                                                                                                    title="Buka Berkas"
                                                                                                >
                                                                                                    <span className="material-symbols-outlined text-[10px]">attachment</span>
                                                                                                    <span>Berkas</span>
                                                                                                </a>
                                                                                            )}
                                                                                        </div>
                                                                                        {user.role === 'ADMIN' && (
                                                                                            <div className="flex items-center gap-1.5 font-bold text-[9px] flex-shrink-0">
                                                                                                <button 
                                                                                                    type="button"
                                                                                                    onClick={() => handleOpenUploadModal(ss)}
                                                                                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-all ${
                                                                                                        ss.file_berkas 
                                                                                                            ? 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100' 
                                                                                                            : 'text-[#005bb1] bg-[#005bb1]/10 border-[#005bb1]/30 hover:bg-[#005bb1]/20'
                                                                                                    }`}
                                                                                                    title={ss.file_berkas ? 'Lihat / Kelola Berkas' : 'Upload Berkas'}
                                                                                                >
                                                                                                    <span className="material-symbols-outlined text-[12px]">
                                                                                                        {ss.file_berkas ? 'task' : 'upload_file'}
                                                                                                    </span>
                                                                                                    <span>{ss.file_berkas ? 'Berkas' : 'Upload'}</span>
                                                                                                </button>
                                                                                                <span className="text-[#c0c6d6]">|</span>
                                                                                                <button onClick={() => handleEditClick(ss)} className="text-[#005bb1] hover:underline">Edit</button>
                                                                                                <span className="text-[#c0c6d6]">|</span>
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
                                <SearchableSelect 
                                    options={contexts.map(c => ({ id: c.id, label: c.nama }))}
                                    value={formData.id_konteks}
                                    onChange={(val) => handleInputChange('id_konteks', val)}
                                    placeholder="-- Pilih Konteks --"
                                    searchPlaceholder="Cari Konteks..."
                                />
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
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Parent Indikator (Sub Dari)</label>
                                <SearchableSelect 
                                    options={[
                                        { id: '', label: '-- Tanpa Induk (Top Level) --' },
                                        ...ikus.filter(i => i.id !== editingIkuId).map(i => ({ id: i.id, label: `${i.iku} - ${i.kategori.substring(0, 50)}...` }))
                                    ]}
                                    value={formData.id_sub}
                                    onChange={(val) => handleInputChange('id_sub', val)}
                                    placeholder="-- Tanpa Induk (Top Level) --"
                                    searchPlaceholder="Cari Indikator Induk..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Kelompok / Jenis Indikator</label>
                                <SearchableSelect 
                                    options={[
                                        { id: 'WAJIB', label: 'Wajib' },
                                        { id: 'PILIHAN', label: 'Pilihan' },
                                        { id: 'PARTISIPATIF', label: 'Partisipatif' }
                                    ]}
                                    value={formData.jenis_iku}
                                    onChange={(val) => handleInputChange('jenis_iku', val)}
                                    placeholder="-- Pilih Kelompok --"
                                    searchPlaceholder="Cari Kelompok..."
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Formula Perhitungan</label>
                                <input 
                                    type="text" 
                                    value={formData.formula_text}
                                    onChange={(e) => handleInputChange('formula_text', e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    placeholder="e.g. Tingkat Pencapaian = (Realisasi / Target) * 100%"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Sumber Data</label>
                                <input 
                                    type="text" 
                                    value={formData.sumber_data}
                                    onChange={(e) => handleInputChange('sumber_data', e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    placeholder="e.g. Data tracer study, PDDikti, dsb."
                                />
                            </div>

                            {!isCreate && editingIkuId && (
                                <div className="space-y-1.5 pt-2 border-t border-[#c0c6d6]/20">
                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Berkas / Dokumen Pendukung</label>
                                    {formData.file_berkas ? (
                                        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="material-symbols-outlined text-emerald-600 text-lg flex-shrink-0">description</span>
                                                <a href={formData.file_berkas} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-800 hover:underline truncate">
                                                    {formData.file_berkas.split('/').pop().replace(/^\d+_/, '')}
                                                </a>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const ikuObj = ikus.find(i => i.id === editingIkuId);
                                                    if (ikuObj) handleOpenUploadModal(ikuObj);
                                                }}
                                                className="text-[11px] font-bold text-[#005bb1] hover:underline flex-shrink-0 ml-2"
                                            >
                                                Kelola Berkas
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#717785]">
                                            <span>Belum ada berkas pendukung terunggah.</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const ikuObj = ikus.find(i => i.id === editingIkuId);
                                                    if (ikuObj) handleOpenUploadModal(ikuObj);
                                                }}
                                                className="text-[11px] font-bold text-[#005bb1] hover:underline"
                                            >
                                                Upload Sekarang
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

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

            {/* Upload Berkas Modal Dialog */}
            {uploadModalIku && (
                <div className="fixed inset-0 bg-[#181c23]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#c0c6d6]/20 relative">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#c0c6d6]/20">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#005bb1] text-2xl">upload_file</span>
                                <h3 className="text-base font-bold text-[#181c23]">
                                    Upload Berkas Indikator
                                </h3>
                            </div>
                            <button 
                                onClick={handleCloseUploadModal}
                                className="text-[#717785] hover:text-[#181c23] p-1 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="mb-4 bg-[#f9f9ff] p-3.5 rounded-xl border border-[#c0c6d6]/20 text-xs">
                            <div className="font-bold text-[#005bb1] flex items-center gap-1.5 mb-1">
                                <span className="bg-[#005bb1]/10 px-2 py-0.5 rounded text-[11px] font-bold">{uploadModalIku.iku}</span>
                                <span className="truncate">{uploadModalIku.kategori}</span>
                            </div>
                            <p className="text-[#535f71] text-[11px] mt-1">
                                Berkas yang diunggah akan dapat diakses dan diunduh oleh unit saat mengisi capaian di halaman Capaian (tepat di bawah Sumber Data).
                            </p>
                        </div>

                        {/* Current File if exists */}
                        {uploadModalIku.file_berkas && (
                            <div className="mb-4 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                                <div className="text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                                    Berkas Terpasang Saat Ini:
                                </div>
                                <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-emerald-100">
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="material-symbols-outlined text-[#005bb1] text-lg flex-shrink-0">description</span>
                                        <a 
                                            href={uploadModalIku.file_berkas} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-[#005bb1] hover:underline truncate"
                                            title="Buka file"
                                        >
                                            {uploadModalIku.file_berkas.split('/').pop().replace(/^\d+_/, '')}
                                        </a>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <a 
                                            href={uploadModalIku.file_berkas} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-bold text-[#005bb1] hover:underline px-2.5 py-1 bg-[#005bb1]/10 rounded-md flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                                            Buka
                                        </a>
                                        <button
                                            type="button"
                                            disabled={isUploading}
                                            onClick={handleDeleteBerkas}
                                            className="text-[11px] font-bold text-red-600 hover:underline px-2.5 py-1 bg-red-50 rounded-md flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[13px]">delete</span>
                                            Hapus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Upload Form */}
                        <form onSubmit={handleUploadBerkas} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">
                                    {uploadModalIku.file_berkas ? 'Ganti dengan Berkas Baru' : 'Pilih File Berkas / Template / Pedoman'}
                                </label>
                                <div className="border-2 border-dashed border-[#c0c6d6] hover:border-[#005bb1] rounded-xl p-5 text-center transition-colors bg-[#f9f9ff]">
                                    <input
                                        type="file"
                                        id="modal_file_berkas_input"
                                        onChange={(e) => {
                                            const file = e.target.files[0] || null;
                                            if (file) {
                                                const allowedExtensions = ['pdf', 'xls', 'xlsx'];
                                                const ext = file.name.split('.').pop().toLowerCase();
                                                if (!allowedExtensions.includes(ext)) {
                                                    setUploadError('Hanya file PDF dan Excel (.pdf, .xls, .xlsx) yang diperbolehkan.');
                                                    setSelectedFile(null);
                                                    e.target.value = '';
                                                    return;
                                                }
                                                if (file.size > 5 * 1024 * 1024) {
                                                    setUploadError('Ukuran file melebihi batas maksimal 5MB.');
                                                    setSelectedFile(null);
                                                    e.target.value = '';
                                                    return;
                                                }
                                            }
                                            setUploadError('');
                                            setSelectedFile(file);
                                        }}
                                        className="hidden"
                                        accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    />
                                    <label 
                                        htmlFor="modal_file_berkas_input" 
                                        className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                                    >
                                        <span className="material-symbols-outlined text-3xl text-[#005bb1]">
                                            {selectedFile ? 'task_alt' : 'cloud_upload'}
                                        </span>
                                        {selectedFile ? (
                                            <div className="text-xs font-bold text-[#181c23]">
                                                <p className="text-emerald-700">{selectedFile.name}</p>
                                                <p className="text-[10px] text-[#717785] font-normal">
                                                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-xs font-bold text-[#005bb1] hover:underline">
                                                    Pilih file dari komputer
                                                </span>
                                                <span className="text-[10px] text-[#717785]">
                                                    Format: PDF atau Excel (.pdf, .xls, .xlsx) (Maks. 5MB)
                                                </span>
                                            </>
                                        )}
                                    </label>
                                </div>
                            </div>

                            {uploadError && (
                                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">error</span>
                                    <span>{uploadError}</span>
                                </div>
                            )}

                            <div className="pt-3 border-t border-[#c0c6d6]/10 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleCloseUploadModal}
                                    disabled={isUploading}
                                    className="px-4 py-2 rounded-lg border border-[#c0c6d6] text-[#535f71] font-bold text-xs hover:bg-[#f1f3fe]"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={!selectedFile || isUploading}
                                    className={`px-5 py-2 rounded-lg text-white font-bold text-xs flex items-center gap-1.5 shadow-sm uppercase tracking-wider ${
                                        !selectedFile || isUploading
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-[#005bb1] hover:bg-[#0073dd]'
                                    }`}
                                >
                                    {isUploading ? (
                                        <>
                                            <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Mengunggah...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[16px]">upload</span>
                                            <span>{uploadModalIku.file_berkas ? 'Simpan & Ganti' : 'Unggah Berkas'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

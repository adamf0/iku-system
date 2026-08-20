import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';

export default function ManagementTarget() {
    const user = usePage().props.auth.user;
    const [ikus, setIkus] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTab, setFilterTab] = useState('ALL');

    // Expanded justification view per row
    const [expandedJustifIds, setExpandedJustifIds] = useState(new Set());

    // Modal Edit Target State
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

    // Modal Justifikasi State (Gambar 2)
    const [justifikasiModalIku, setJustifikasiModalIku] = useState(null);
    const [catatanJustifikasi, setCatatanJustifikasi] = useState('');
    const [fileJustifikasi, setFileJustifikasi] = useState(null);
    const [submittingJustif, setSubmittingJustif] = useState(false);

    const [years, setYears] = useState([{ tahun: 2026 }, { tahun: 2025 }]);
    const [selectedTahun, setSelectedTahun] = useState(2026);

    useEffect(() => {
        fetch('/api/master/tahun')
            .then(res => res.json())
            .then(data => {
                if (data.length > 0) setYears(data);
            })
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedTahun]);

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/master/contexts').then(res => res.json()),
            fetch(`/api/master/iku?tahun=${selectedTahun}`).then(res => res.json())
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

    const handleOpenJustifikasiModal = (iku) => {
        setJustifikasiModalIku(iku);
        setCatatanJustifikasi(iku.catatan_justifikasi || '');
        setFileJustifikasi(null);
    };

    const toggleExpandJustification = (id) => {
        setExpandedJustifIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleInputChange = (field, val) => {
        setFormData(prev => ({
            ...prev,
            [field]: val
        }));
    };

    const handleSaveTarget = (e) => {
        e.preventDefault();
        
        axios.post(`/api/master/iku/${editingTargetId}`, { ...formData, tahun: selectedTahun })
        .then(() => {
            alert(`Target indikator tahun ${selectedTahun} berhasil diperbarui!`);
            setEditingTargetId(null);
            loadData();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan target.');
        });
    };

    const handleSaveJustifikasi = (e) => {
        e.preventDefault();
        if (!justifikasiModalIku) return;

        setSubmittingJustif(true);
        const data = new FormData();
        data.append('catatan_justifikasi', catatanJustifikasi);
        data.append('tahun', selectedTahun);
        if (fileJustifikasi) {
            data.append('file_justifikasi', fileJustifikasi);
        }

        axios.post(`/api/master/iku/${justifikasiModalIku.id}/justifikasi`, data)
        .then(() => {
            alert(`Justifikasi target tahun ${selectedTahun} berhasil disimpan!`);
            setJustifikasiModalIku(null);
            setCatatanJustifikasi('');
            setFileJustifikasi(null);
            setSubmittingJustif(false);
            loadData();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan justifikasi.');
            setSubmittingJustif(false);
        });
    };

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
        <AuthenticatedLayout pageTitle="Management Target">
            <Head title="Management Target - IKU Portal" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Pengaturan Target Jenjang & Unit</h2>
                    <p className="text-sm text-[#535f71]">Tentukan baseline, target performa, serta justifikasi penetapan target per tahun.</p>
                </div>

                {/* Filter Tahun Selector (Gambar 2) */}
                <div className="flex items-center gap-2 bg-white border border-[#c0c6d6]/30 px-3.5 py-2 rounded-2xl shadow-xs">
                    <span className="material-symbols-outlined text-[#005bb1] text-lg">calendar_today</span>
                    <select 
                        value={selectedTahun}
                        onChange={(e) => setSelectedTahun(Number(e.target.value))}
                        className="bg-transparent border-none text-xs font-extrabold text-[#181c23] outline-none cursor-pointer pr-4"
                    >
                        {years.map(y => (
                            <option key={y.tahun} value={y.tahun}>Tahun {y.tahun}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tab Filter Kelompok (Wajib, Pilihan, Partisipatif) */}
            <div className="flex items-center gap-2 mb-6 bg-[#f1f3fe]/60 p-1.5 rounded-2xl w-fit border border-[#c0c6d6]/20">
                {[
                    { id: 'ALL', label: 'Semua Target' },
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
                <div className="space-y-6">
                    {contexts.map(ctx => {
                        const ctxIkus = ikus.filter(i => {
                            if (i.id_konteks !== ctx.id) return false;
                            if (filterTab !== 'ALL' && (i.jenis_iku || 'WAJIB').toUpperCase() !== filterTab) return false;
                            return true;
                        });
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
                                                <th className="p-3 text-center w-32">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#c0c6d6]/10">
                                            {ctxIkus.length === 0 ? (
                                                <tr>
                                                    <td colSpan="13" className="p-3 text-center text-[#717785] italic">Belum ada data.</td>
                                                </tr>
                                            ) : (
                                                ctxIkus.map(iku => {
                                                    const isExpanded = expandedJustifIds.has(iku.id);
                                                    const hasJustif = !!(iku.catatan_justifikasi || iku.file_justifikasi);

                                                    return (
                                                        <React.Fragment key={iku.id}>
                                                            <tr className="hover:bg-[#f1f3fe]/20">
                                                                <td className="p-3">
                                                                    <div className="flex items-center">
                                                                        <span className="font-bold text-[#181c23]">{iku.full_kategori}</span>
                                                                        {renderJenisBadge(iku.jenis_iku)}
                                                                    </div>
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
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        {user.role === 'ADMIN' && (
                                                                            <>
                                                                                <button 
                                                                                    onClick={() => handleEditTargetClick(iku)}
                                                                                    className="text-xs font-bold text-[#005bb1] hover:underline"
                                                                                >
                                                                                    Edit
                                                                                </button>

                                                                                {/* Action Justifikasi (Gambar 2 & Gambar 3) */}
                                                                                <button 
                                                                                    onClick={() => handleOpenJustifikasiModal(iku)}
                                                                                    className="text-xs font-bold text-[#005bb1] bg-[#ebedf8] px-2.5 py-1 rounded-lg hover:bg-[#d6e3ff] transition-all flex items-center gap-1"
                                                                                    title="Kelola Justifikasi Target"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                                                                    Justifikasi
                                                                                </button>
                                                                            </>
                                                                        )}

                                                                        {hasJustif && (
                                                                            <button 
                                                                                onClick={() => toggleExpandJustification(iku.id)}
                                                                                className={`text-xs font-bold px-2 py-1 rounded-lg border transition-all flex items-center gap-0.5 ${
                                                                                    isExpanded
                                                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                                                        : 'bg-white text-[#005bb1] border-[#005bb1]/30 hover:bg-[#f1f3fe]'
                                                                                }`}
                                                                                title="Lihat Rincian Justifikasi"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                                                JUSTIF
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>

                                                            {/* Expanded Justifikasi View (Gambar 3) */}
                                                            {isExpanded && hasJustif && (
                                                                <tr className="bg-[#f9f9ff]">
                                                                    <td colSpan="13" className="p-4">
                                                                        <div className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm space-y-4">
                                                                            {/* Narasi Justifikasi */}
                                                                            <div className="flex items-start gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                                                                                    99
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <span className="text-[10px] font-extrabold text-[#717785] uppercase tracking-wider block">NARASI JUSTIFIKASI</span>
                                                                                    <p className="text-xs font-semibold text-[#181c23] italic leading-relaxed">
                                                                                        {iku.catatan_justifikasi || 'Tidak ada catatan justifikasi.'}
                                                                                    </p>
                                                                                </div>
                                                                            </div>

                                                                            {/* Lampiran Dokumen */}
                                                                            {iku.file_justifikasi && (
                                                                                <div className="pt-3 border-t border-[#c0c6d6]/20 space-y-2">
                                                                                    <span className="text-[10px] font-extrabold text-[#717785] uppercase tracking-wider block">LAMPIRAN DOKUMEN</span>
                                                                                    <div className="bg-[#f9f9ff] border border-[#c0c6d6]/30 rounded-2xl p-3 flex items-center gap-3 w-fit">
                                                                                        <span className="material-symbols-outlined text-amber-500 text-xl">description</span>
                                                                                        <a 
                                                                                            href={iku.file_justifikasi} 
                                                                                            target="_blank" 
                                                                                            rel="noreferrer"
                                                                                            className="text-xs font-bold text-[#181c23] hover:text-[#005bb1] truncate max-w-xs hover:underline"
                                                                                        >
                                                                                            {iku.file_justifikasi.split('/').pop()}
                                                                                        </a>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })
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

                        <form onSubmit={handleSaveTarget} className="space-y-4">
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

            {/* Modal Justifikasi Target (Gambar 2) */}
            {justifikasiModalIku && (
                <div className="fixed inset-0 bg-[#181c23]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] max-w-lg w-full p-8 shadow-2xl border border-[#c0c6d6]/20 relative">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl">edit_note</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#181c23]">JUSTIFIKASI TARGET</h3>
                                    <p className="text-xs text-[#717785] font-semibold">{justifikasiModalIku.full_kategori || justifikasiModalIku.iku}</p>
                                </div>
                            </div>
                            <button onClick={() => setJustifikasiModalIku(null)} className="text-[#717785] hover:text-[#181c23] bg-gray-100 p-1.5 rounded-full">
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        {/* Alert info banner (Gambar 2) */}
                        <div className="bg-[#f0f7ff] border border-[#005bb1]/20 rounded-2xl p-4 flex items-start gap-3 mb-6">
                            <span className="material-symbols-outlined text-[#005bb1] text-xl flex-shrink-0 mt-0.5">info</span>
                            <div className="text-xs text-[#005bb1] space-y-0.5">
                                <p className="font-bold">Silakan berikan alasan atau dasar penetapan target ini.</p>
                                <p className="text-[11px] text-[#535f71]">Format didukung: PDF, Excel, CSV, JPG, PNG, ZIP. Maksimal 20MB.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveJustifikasi} className="space-y-6">
                            {/* CATATAN JUSTIFIKASI */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">CATATAN JUSTIFIKASI</label>
                                <textarea 
                                    rows="4"
                                    value={catatanJustifikasi}
                                    onChange={(e) => setCatatanJustifikasi(e.target.value)}
                                    placeholder="Masukkan naskah atau catatan dasar penetapan target..."
                                    className="w-full bg-[#f9f9ff] border border-[#c0c6d6]/40 rounded-2xl p-4 text-xs font-medium text-[#181c23] outline-none focus:ring-2 focus:ring-[#005bb1] resize-none"
                                ></textarea>
                            </div>

                            {/* DOKUMEN PENDUKUNG */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">DOKUMEN PENDUKUNG</label>
                                
                                {justifikasiModalIku.file_justifikasi && !fileJustifikasi && (
                                    <div className="bg-[#f9f9ff] border border-[#c0c6d6]/40 rounded-2xl p-3.5 flex items-center justify-between">
                                        <div className="flex items-center gap-3 truncate">
                                            <span className="material-symbols-outlined text-amber-500 text-2xl">description</span>
                                            <span className="text-xs font-bold text-[#181c23] truncate">
                                                {justifikasiModalIku.file_justifikasi.split('/').pop()}
                                            </span>
                                        </div>
                                        <a 
                                            href={justifikasiModalIku.file_justifikasi} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs font-bold text-[#005bb1] hover:underline flex-shrink-0"
                                        >
                                            Lihat
                                        </a>
                                    </div>
                                )}

                                <input 
                                    type="file" 
                                    onChange={(e) => setFileJustifikasi(e.target.files[0])}
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.png,.jpg,.jpeg"
                                    className="w-full text-xs text-[#535f71] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#ebedf8] file:text-[#005bb1] hover:file:bg-[#d6e3ff] cursor-pointer"
                                />
                            </div>

                            {/* Submit button */}
                            <div className="pt-4 flex justify-end">
                                <button 
                                    type="submit"
                                    disabled={submittingJustif}
                                    className="px-8 py-3 rounded-2xl bg-[#005bb1] text-white font-extrabold text-xs hover:bg-[#0073dd] shadow-md uppercase tracking-wider disabled:opacity-50"
                                >
                                    {submittingJustif ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

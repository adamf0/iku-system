import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';

export default function ManagementUnit() {
    const user = usePage().props.auth.user;
    const [units, setUnits] = useState([]);
    const [options, setOptions] = useState({ fakultas: [], prodi: [] });
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Toast state
    const [toast, setToast] = useState(null);

    // Modal Create / Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState(null);
    const [formData, setFormData] = useState({
        type: 'unit', // fakultas, prodi, unit
        kode_fakultas: '',
        kode_prodi: '',
        nama: '',
        is_active: true,
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
        loadOptions();
    }, [typeFilter, statusFilter]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadData = () => {
        setLoading(true);
        axios.get('/api/unit-management', {
            params: {
                search: search || undefined,
                type: typeFilter,
                status: statusFilter,
            }
        })
        .then(res => {
            setUnits(res.data || []);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            showToast('Gagal memuat data unit.', 'error');
            setLoading(false);
        });
    };

    const loadOptions = () => {
        axios.get('/api/unit-management/options')
        .then(res => {
            setOptions(res.data || { fakultas: [], prodi: [] });
        })
        .catch(err => console.error(err));
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadData();
    };

    const handleOpenCreateModal = () => {
        setEditingUnitId(null);
        setFormData({
            type: 'unit',
            kode_fakultas: '',
            kode_prodi: '',
            nama: '',
            is_active: true,
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (unit) => {
        setEditingUnitId(unit.id);
        setFormData({
            type: unit.type || 'unit',
            kode_fakultas: unit.kode_fakultas || '',
            kode_prodi: unit.kode_prodi || '',
            nama: unit.nama_custom || (unit.type === 'unit' ? unit.nama_fak_prod_unit : ''),
            is_active: Boolean(unit.is_active),
        });
        setIsModalOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        setSubmitting(true);

        const url = editingUnitId 
            ? `/api/unit-management/${editingUnitId}` 
            : '/api/unit-management';

        axios.post(url, formData)
        .then(res => {
            showToast(res.data.message || 'Data unit berhasil disimpan.', 'success');
            setIsModalOpen(false);
            setSubmitting(false);
            loadData();
        })
        .catch(err => {
            setSubmitting(false);
            const errMsg = err.response?.data?.error || 'gagal simpan karena data tidak lengkap';
            showToast(errMsg, 'error');
        });
    };

    const handleToggleStatus = (unit) => {
        const actionText = unit.is_active ? 'menonaktifkan' : 'mengaktifkan';
        if (!confirm(`Apakah Anda yakin ingin ${actionText} unit "${unit.nama_fak_prod_unit}"?`)) return;

        axios.post(`/api/unit-management/${unit.id}/toggle-status`)
        .then(res => {
            showToast(res.data.message, 'success');
            loadData();
        })
        .catch(err => {
            const errMsg = err.response?.data?.error || 'Gagal mengubah status unit.';
            showToast(errMsg, 'error');
        });
    };

    const handleDelete = (unit) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus unit "${unit.nama_fak_prod_unit}"?`)) return;

        axios.delete(`/api/unit-management/${unit.id}`)
        .then(res => {
            showToast(res.data.message, 'success');
            loadData();
        })
        .catch(err => {
            const errMsg = err.response?.data?.error || 'Gagal menghapus unit.';
            showToast(errMsg, 'error');
        });
    };

    // Calculate Summary Stats
    const totalCount = units.length;
    const fakultasCount = units.filter(u => u.type === 'fakultas').length;
    const prodiCount = units.filter(u => u.type === 'prodi').length;
    const unitNonProdiCount = units.filter(u => u.type === 'unit').length;
    const activeCount = units.filter(u => u.is_active).length;
    const inactiveCount = units.filter(u => !u.is_active).length;

    // Filter prodi based on selected fakultas in modal form
    const filteredProdiOptions = formData.kode_fakultas 
        ? options.prodi.filter(p => p.kode_fak === formData.kode_fakultas)
        : options.prodi;

    return (
        <AuthenticatedLayout pageTitle="Manajemen Unit">
            <Head title="Manajemen Unit - IKU Portal" />

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl transition-all duration-300 animate-slide-in border text-xs font-semibold bg-white text-[#181c23]">
                    {toast.type === 'error' ? (
                        <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-lg">error</span>
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-lg">check_circle</span>
                        </div>
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Manajemen Fakultas & Unit Pelapor</h2>
                    <p className="text-sm text-[#535f71]">Kelola daftar fakultas, program studi, unit lembaga, dan status keaktifannya.</p>
                </div>
                {user.role === 'ADMIN' && (
                    <button 
                        onClick={handleOpenCreateModal}
                        className="bg-[#005bb1] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#0073dd] shadow-md transition-all flex items-center gap-2 uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Tambah Unit Baru
                    </button>
                )}
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">Total Unit</p>
                    <p className="text-xl font-extrabold text-[#181c23] mt-1">{totalCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-[#005bb1] uppercase tracking-wider">Fakultas</p>
                    <p className="text-xl font-extrabold text-[#005bb1] mt-1">{fakultasCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Prodi</p>
                    <p className="text-xl font-extrabold text-emerald-600 mt-1">{prodiCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Unit/Lembaga</p>
                    <p className="text-xl font-extrabold text-amber-600 mt-1">{unitNonProdiCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Aktif</p>
                    <p className="text-xl font-extrabold text-emerald-700 mt-1">{activeCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-xs">
                    <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Non-Aktif</p>
                    <p className="text-xl font-extrabold text-rose-700 mt-1">{inactiveCount}</p>
                </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
                    <div className="relative w-full">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-lg">search</span>
                        <input 
                            type="text" 
                            placeholder="Cari unit, prodi, fakultas..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[#f8fafc] border border-[#c0c6d6]/30 rounded-xl text-xs focus:ring-2 focus:ring-[#005bb1] focus:bg-white transition-all"
                        />
                    </div>
                    <button type="submit" className="bg-[#ebedf8] hover:bg-[#d7e3f9] text-[#005bb1] px-3.5 py-2 rounded-xl text-xs font-bold transition-all">
                        Cari
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Filter Type */}
                    <div className="flex items-center gap-1.5 bg-[#f1f3fe]/70 p-1 rounded-xl border border-[#c0c6d6]/20 text-xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Tipe:</span>
                        {[
                            { id: 'ALL', label: 'Semua' },
                            { id: 'fakultas', label: 'Fakultas' },
                            { id: 'prodi', label: 'Prodi' },
                            { id: 'unit', label: 'Unit' }
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setTypeFilter(t.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    typeFilter === t.id 
                                        ? 'bg-white text-[#005bb1] shadow-xs' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Filter Status */}
                    <div className="flex items-center gap-1.5 bg-[#f1f3fe]/70 p-1 rounded-xl border border-[#c0c6d6]/20 text-xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Status:</span>
                        {[
                            { id: 'ALL', label: 'Semua' },
                            { id: '1', label: 'Aktif' },
                            { id: '0', label: 'Non-Aktif' }
                        ].map(s => (
                            <button
                                key={s.id}
                                onClick={() => setStatusFilter(s.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    statusFilter === s.id 
                                        ? 'bg-white text-[#005bb1] shadow-xs' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 text-xs font-semibold flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-2xl text-[#005bb1]">progress_activity</span>
                        Memuat data unit...
                    </div>
                ) : units.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-xs font-semibold">
                        Tidak ada data unit yang ditemukan.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-[#c0c6d6]/20 text-[11px] font-bold text-[#535f71] uppercase tracking-wider">
                                    <th className="py-3.5 px-4 w-12 text-center">ID</th>
                                    <th className="py-3.5 px-4">Nama Unit / Prodi / Fakultas</th>
                                    <th className="py-3.5 px-4">Kategori / Tipe</th>
                                    <th className="py-3.5 px-4">Fakultas Induk</th>
                                    <th className="py-3.5 px-4">Jenjang</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#c0c6d6]/15 text-xs text-[#181c23]">
                                {units.map((unit, idx) => (
                                    <tr key={unit.id} className="hover:bg-[#f8fafc]/80 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-gray-400 text-[11px]">
                                            {unit.id}
                                        </td>
                                        <td className="py-3 px-4 font-bold text-[#181c23]">
                                            {unit.nama_fak_prod_unit}
                                            {unit.kode_prodi && (
                                                <span className="block text-[10px] font-normal text-gray-400">Kode Prodi: {unit.kode_prodi}</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            {unit.type === 'fakultas' && (
                                                <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                                    <span className="material-symbols-outlined text-[12px]">domain</span> Fakultas
                                                </span>
                                            )}
                                            {unit.type === 'prodi' && (
                                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                                    <span className="material-symbols-outlined text-[12px]">school</span> Prodi
                                                </span>
                                            )}
                                            {unit.type === 'unit' && (
                                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                                    <span className="material-symbols-outlined text-[12px]">corporate_fare</span> Unit / Lembaga
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 font-medium">
                                            {unit.fakultas || '-'}
                                        </td>
                                        <td className="py-3 px-4">
                                            {unit.jenjang ? (
                                                <span className="uppercase text-[10px] font-bold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                                    {unit.jenjang}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {unit.is_active ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Aktif
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2.5 py-0.5 rounded-full border border-rose-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Non-Aktif
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => handleToggleStatus(unit)}
                                                    title={unit.is_active ? "Non-aktifkan Unit" : "Aktifkan Unit"}
                                                    className={`p-1.5 rounded-lg transition-colors border ${
                                                        unit.is_active 
                                                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200' 
                                                            : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-base">
                                                        {unit.is_active ? 'toggle_on' : 'toggle_off'}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(unit)}
                                                    title="Edit Unit"
                                                    className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(unit)}
                                                    title="Hapus Unit"
                                                    className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Add / Edit Unit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-[#c0c6d6]/20 w-full max-w-lg overflow-visible animate-scale-up my-auto"
                        style={{ overflow: 'visible' }}
                    >
                        <div className="p-5 border-b border-[#c0c6d6]/20 flex justify-between items-center bg-[#f8fafc] rounded-t-2xl">
                            <h3 className="text-base font-bold text-[#181c23]">
                                {editingUnitId ? 'Edit Data Unit' : 'Tambah Unit Baru'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs" style={{ overflow: 'visible' }}>
                            {/* Selecting Unit Category */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1.5">Tipe / Kategori Unit</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'unit', label: 'Unit / Lembaga' },
                                        { id: 'prodi', label: 'Program Studi' },
                                        { id: 'fakultas', label: 'Fakultas Standalone' }
                                    ].map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, type: cat.id }))}
                                            className={`py-2 px-3 rounded-xl border font-bold text-center transition-all ${
                                                formData.type === cat.id 
                                                    ? 'bg-[#005bb1] text-white border-[#005bb1] shadow-xs' 
                                                     : 'bg-[#f8fafc] text-gray-600 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Option 1: Standalone Fakultas */}
                            {formData.type === 'fakultas' && (
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1">Pilih Fakultas Induk</label>
                                    <SearchableSelect
                                        options={options.fakultas.map(f => ({
                                            value: f.kode_fakultas,
                                            label: `${f.nama_fakultas} (Kode: ${f.kode_fakultas})`
                                        }))}
                                        value={formData.kode_fakultas}
                                        onChange={(val) => setFormData(prev => ({ ...prev, kode_fakultas: val }))}
                                        placeholder="-- Pilih Fakultas --"
                                        searchPlaceholder="Cari fakultas..."
                                    />
                                </div>
                            )}

                            {/* Option 2: Program Studi */}
                            {formData.type === 'prodi' && (
                                <>
                                    <div>
                                        <label className="block font-bold text-gray-700 mb-1">Fakultas (Filter)</label>
                                        <SearchableSelect
                                            options={options.fakultas.map(f => ({
                                                value: f.kode_fakultas,
                                                label: f.nama_fakultas
                                            }))}
                                            value={formData.kode_fakultas}
                                            onChange={(val) => setFormData(prev => ({ ...prev, kode_fakultas: val, kode_prodi: '' }))}
                                            placeholder="-- Semua Fakultas --"
                                            searchPlaceholder="Cari fakultas..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-gray-700 mb-1">Pilih Program Studi</label>
                                        <SearchableSelect
                                            options={filteredProdiOptions.map(p => ({
                                                value: p.kode_prodi,
                                                label: `${p.nama_prodi} (${p.kode_prodi})`
                                            }))}
                                            value={formData.kode_prodi}
                                            onChange={(val) => {
                                                const pObj = options.prodi.find(p => String(p.kode_prodi) === String(val));
                                                setFormData(prev => ({
                                                    ...prev,
                                                    kode_prodi: val,
                                                    kode_fakultas: pObj ? pObj.kode_fak : prev.kode_fakultas
                                                }));
                                            }}
                                            placeholder="-- Pilih Program Studi --"
                                            searchPlaceholder="Cari program studi..."
                                        />
                                    </div>
                                </>
                            )}

                            {/* Option 3: Custom Unit / Lembaga */}
                            {formData.type === 'unit' && (
                                <>
                                    <div>
                                        <label className="block font-bold text-gray-700 mb-1">Nama Unit / Lembaga</label>
                                        <input
                                            type="text"
                                            placeholder="Contoh: BPSI, LPPM, Perpustakaan, BPM"
                                            value={formData.nama}
                                            onChange={(e) => setFormData(prev => ({ ...prev, nama: e.target.value }))}
                                            className="w-full p-2.5 bg-[#f8fafc] border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#005bb1]"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block font-bold text-gray-700 mb-1">Fakultas Induk (Opsional)</label>
                                        <SearchableSelect
                                            options={options.fakultas.map(f => ({
                                                value: f.kode_fakultas,
                                                label: f.nama_fakultas
                                            }))}
                                            value={formData.kode_fakultas}
                                            onChange={(val) => setFormData(prev => ({ ...prev, kode_fakultas: val }))}
                                            placeholder="-- Tidak Ada / Unit Universitas --"
                                            searchPlaceholder="Cari fakultas..."
                                        />
                                    </div>
                                </>
                            )}

                            {/* Active Status Checkbox */}
                            <div className="pt-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                        className="w-4 h-4 text-[#005bb1] border-gray-300 rounded focus:ring-[#005bb1]"
                                    />
                                    <span className="font-bold text-gray-700">Status Aktif (Dapat Diberikan Penugasan Target IKU)</span>
                                </label>
                            </div>

                            {/* Buttons */}
                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-[#005bb1] text-white font-bold hover:bg-[#0073dd] transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Menyimpan...' : 'Simpan Data'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';
import { formatJenjang } from '@/Utils/unitHelper';

export default function ManagementAccount() {
    const user = usePage().props.auth.user;
    const [accounts, setAccounts] = useState([]);
    const [units, setUnits] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Toast state
    const [toast, setToast] = useState(null);

    // Modal Create / Edit State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUserId, setEditingUserId] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'PRODI',
        fakultas_unit: '',
        is_active: true,
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
        loadUnits();
    }, [roleFilter, statusFilter]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadData = () => {
        setLoading(true);
        axios.get('/api/account-management', {
            params: {
                search: search || undefined,
                role: roleFilter,
                status: statusFilter,
            }
        })
        .then(res => {
            setAccounts(res.data || []);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            showToast('Gagal memuat akun pengguna.', 'error');
            setLoading(false);
        });
    };

    const loadUnits = () => {
        axios.get('/api/master/units')
        .then(res => {
            setUnits(res.data || []);
        })
        .catch(err => console.error(err));
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadData();
    };

    const handleOpenCreateModal = () => {
        setEditingUserId(null);
        setFormData({
            name: '',
            username: '',
            email: '',
            password: '',
            role: 'PRODI',
            fakultas_unit: units[0]?.id || '',
            is_active: true,
        });
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (acc) => {
        setEditingUserId(acc.id);
        setFormData({
            name: acc.name || '',
            username: acc.username || '',
            email: acc.email || '',
            password: '', // blank by default on edit
            role: acc.role || 'PRODI',
            fakultas_unit: acc.fakultas_unit || '',
            is_active: Boolean(acc.is_active),
        });
        setIsModalOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        setSubmitting(true);

        const url = editingUserId 
            ? `/api/account-management/${editingUserId}` 
            : '/api/account-management';

        axios.post(url, formData)
        .then(res => {
            showToast(res.data.message || 'Data akun berhasil disimpan.', 'success');
            setIsModalOpen(false);
            setSubmitting(false);
            loadData();
        })
        .catch(err => {
            setSubmitting(false);
            const errMsg = err.response?.data?.error || err.response?.data?.message || 'gagal simpan karena data tidak lengkap';
            showToast(errMsg, 'error');
        });
    };

    const handleToggleStatus = (acc) => {
        if (acc.id === user.id) {
            showToast('Anda tidak dapat menonaktifkan akun Anda sendiri.', 'error');
            return;
        }

        const actionText = acc.is_active ? 'menonaktifkan' : 'mengaktifkan';
        if (!confirm(`Apakah Anda yakin ingin ${actionText} akun "${acc.username}"?`)) return;

        axios.post(`/api/account-management/${acc.id}/toggle-status`)
        .then(res => {
            showToast(res.data.message, 'success');
            loadData();
        })
        .catch(err => {
            const errMsg = err.response?.data?.error || 'Gagal mengubah status akun.';
            showToast(errMsg, 'error');
        });
    };

    const handleDelete = (acc) => {
        if (acc.id === user.id) {
            showToast('Anda tidak dapat menghapus akun Anda sendiri.', 'error');
            return;
        }

        if (!confirm(`Apakah Anda yakin ingin menghapus akun "${acc.name}" (${acc.username})?`)) return;

        axios.delete(`/api/account-management/${acc.id}`)
        .then(res => {
            showToast(res.data.message, 'success');
            loadData();
        })
        .catch(err => {
            const errMsg = err.response?.data?.error || 'Gagal menghapus akun.';
            showToast(errMsg, 'error');
        });
    };

    const renderRoleBadge = (role) => {
        switch (role) {
            case 'ADMIN':
                return <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">ADMIN</span>;
            case 'LPM':
                return <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">LPM</span>;
            case 'FAKULTAS':
                return <span className="bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">FAKULTAS</span>;
            case 'PRODI':
                return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">PRODI</span>;
            case 'UNIT':
                return <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">UNIT</span>;
            default:
                return <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">{role}</span>;
        }
    };

    // Calculate Summary Stats
    const totalCount = accounts.length;
    const adminCount = accounts.filter(a => a.role === 'ADMIN').length;
    const fakultasCount = accounts.filter(a => a.role === 'FAKULTAS').length;
    const prodiCount = accounts.filter(a => a.role === 'PRODI').length;
    const unitCount = accounts.filter(a => a.role === 'UNIT').length;
    const activeCount = accounts.filter(a => a.is_active).length;
    const inactiveCount = accounts.filter(a => !a.is_active).length;

    return (
        <AuthenticatedLayout pageTitle="Account Management">
            <Head title="Account Management - IKU Portal" />

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
                    <h2 className="text-xl font-bold text-[#181c23]">Management Account Pengguna</h2>
                    <p className="text-sm text-[#535f71]">Kelola akun pengguna, peran otorisasi, dan penautan unit pelaporan.</p>
                </div>
                {user.role === 'ADMIN' && (
                    <button 
                        onClick={handleOpenCreateModal}
                        className="bg-[#005bb1] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#0073dd] shadow-md transition-all flex items-center gap-2 uppercase tracking-wider"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Tambah Akun Baru
                    </button>
                )}
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-[#717785] uppercase tracking-wider">Total Akun</p>
                    <p className="text-xl font-extrabold text-[#181c23] mt-1">{totalCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Admin</p>
                    <p className="text-xl font-extrabold text-purple-700 mt-1">{adminCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">Fakultas</p>
                    <p className="text-xl font-extrabold text-sky-700 mt-1">{fakultasCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Prodi</p>
                    <p className="text-xl font-extrabold text-emerald-600 mt-1">{prodiCount}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-xs">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Unit</p>
                    <p className="text-xl font-extrabold text-amber-600 mt-1">{unitCount}</p>
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
                            placeholder="Cari nama, username, email, unit..."
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
                    {/* Filter Role */}
                    <div className="flex items-center gap-1.5 bg-[#f1f3fe]/70 p-1 rounded-xl border border-[#c0c6d6]/20 text-xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase px-2">Peran:</span>
                        {[
                            { id: 'ALL', label: 'Semua' },
                            { id: 'ADMIN', label: 'Admin' },
                            { id: 'FAKULTAS', label: 'Fakultas' },
                            { id: 'PRODI', label: 'Prodi' },
                            { id: 'UNIT', label: 'Unit' }
                        ].map(r => (
                            <button
                                key={r.id}
                                onClick={() => setRoleFilter(r.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    roleFilter === r.id 
                                        ? 'bg-white text-[#005bb1] shadow-xs' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                {r.label}
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
                        Memuat data akun...
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 text-xs font-semibold">
                        Tidak ada data akun yang ditemukan.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#f8fafc] border-b border-[#c0c6d6]/20 text-[11px] font-bold text-[#535f71] uppercase tracking-wider">
                                    <th className="py-3.5 px-4 w-12 text-center">ID</th>
                                    <th className="py-3.5 px-4">Nama Pengguna</th>
                                    <th className="py-3.5 px-4">Username & Email</th>
                                    <th className="py-3.5 px-4">Peran (Role)</th>
                                    <th className="py-3.5 px-4">Unit Pelapor Terkait</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#c0c6d6]/15 text-xs text-[#181c23]">
                                {accounts.map((acc) => (
                                    <tr key={acc.id} className="hover:bg-[#f8fafc]/80 transition-colors">
                                        <td className="py-3 px-4 text-center font-bold text-gray-400 text-[11px]">
                                            {acc.id}
                                        </td>
                                        <td className="py-3 px-4 font-bold text-[#181c23]">
                                            {acc.name}
                                            {acc.id === user.id && (
                                                <span className="ml-2 text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold uppercase">Saya</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="font-semibold font-mono text-gray-800">{acc.username}</span>
                                            <span className="block text-[10px] text-gray-400">{acc.email}</span>
                                        </td>
                                        <td className="py-3 px-4">
                                            {renderRoleBadge(acc.role)}
                                        </td>
                                        <td className="py-3 px-4 text-gray-600 font-medium">
                                            {acc.nama_unit || (acc.role === 'ADMIN' ? 'Seluruh PT / Global Admin' : '-')}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {acc.is_active ? (
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
                                                    onClick={() => handleToggleStatus(acc)}
                                                    disabled={acc.id === user.id}
                                                    title={acc.id === user.id ? "Tidak dapat menonaktifkan akun sendiri" : acc.is_active ? "Non-aktifkan Akun" : "Aktifkan Akun"}
                                                    className={`p-1.5 rounded-lg transition-colors border disabled:opacity-40 ${
                                                        acc.is_active 
                                                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-200' 
                                                            : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-base">
                                                        {acc.is_active ? 'toggle_on' : 'toggle_off'}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(acc)}
                                                    title="Edit Akun"
                                                    className="p-1.5 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-base">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(acc)}
                                                    disabled={acc.id === user.id}
                                                    title={acc.id === user.id ? "Tidak dapat menghapus akun sendiri" : "Hapus Akun"}
                                                    className="p-1.5 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-40"
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

            {/* Modal Add / Edit Account */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
                    <div 
                        className="bg-white rounded-2xl shadow-2xl border border-[#c0c6d6]/20 w-full max-w-lg overflow-visible animate-scale-up my-auto"
                        style={{ overflow: 'visible' }}
                    >
                        <div className="p-5 border-b border-[#c0c6d6]/20 flex justify-between items-center bg-[#f8fafc] rounded-t-2xl">
                            <h3 className="text-base font-bold text-[#181c23]">
                                {editingUserId ? 'Edit Akun Pengguna' : 'Tambah Akun Baru'}
                            </h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
                            >
                                <span className="material-symbols-outlined text-xl">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs" style={{ overflow: 'visible' }}>
                            {/* Full Name */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Dr. Ahmad Dahlan, M.T."
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-2.5 bg-[#f8fafc] border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#005bb1]"
                                    required
                                />
                            </div>

                            {/* Username & Email Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1">Username</label>
                                    <input
                                        type="text"
                                        placeholder="p_teknik_sipil_s1"
                                        value={formData.username}
                                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                                        className="w-full p-2.5 bg-[#f8fafc] border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#005bb1]"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        placeholder="sipil@unpak.ac.id"
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full p-2.5 bg-[#f8fafc] border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#005bb1]"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">
                                    Password {editingUserId && <span className="font-normal text-gray-400">(Kosongkan jika tidak ingin diubah)</span>}
                                </label>
                                <input
                                    type="password"
                                    placeholder={editingUserId ? "••••••••" : "Masukkan password baru"}
                                    value={formData.password}
                                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                    className="w-full p-2.5 bg-[#f8fafc] border border-gray-300 rounded-xl font-medium focus:ring-2 focus:ring-[#005bb1]"
                                    required={!editingUserId}
                                />
                            </div>

                            {/* Role Select */}
                            <div>
                                <label className="block font-bold text-gray-700 mb-1">Peran (Role) Otentikasi</label>
                                <SearchableSelect
                                    options={[
                                        { value: 'ADMIN', label: 'ADMIN - Administrator Sistem (Akses Global)' },
                                        { value: 'FAKULTAS', label: 'FAKULTAS - Pengelola Fakultas' },
                                        { value: 'PRODI', label: 'PRODI - Program Studi (Unit Pelapor)' },
                                        { value: 'UNIT', label: 'UNIT - Lembaga / Unit Kerja Non-Prodi' }
                                    ]}
                                    value={formData.role}
                                    onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                                    placeholder="-- Pilih Peran (Role) --"
                                    searchPlaceholder="Cari peran..."
                                />
                            </div>

                            {/* Unit Select (if not ADMIN) */}
                            {['FAKULTAS', 'PRODI', 'UNIT'].includes(formData.role) && (
                                <div>
                                    <label className="block font-bold text-gray-700 mb-1">Unit Pelapor Terkait</label>
                                    <SearchableSelect
                                        options={units.map(u => {
                                            const jStr = formatJenjang(u.jenjang || u.kode_jenjang);
                                            const jPart = jStr ? ` - ${jStr}` : '';
                                            const fakPart = u.fakultas ? ` (${u.fakultas})` : '';
                                            return {
                                                value: u.id,
                                                label: `${u.nama_fak_prod_unit}${jPart}${fakPart} [${u.type?.toUpperCase()}]`,
                                                badge: jStr ? `${u.type?.toUpperCase()} ${jStr}` : u.type?.toUpperCase()
                                            };
                                        })}
                                        value={formData.fakultas_unit}
                                        onChange={(val) => setFormData(prev => ({ ...prev, fakultas_unit: val }))}
                                        placeholder="-- Pilih Unit Pelapor --"
                                        searchPlaceholder="Cari unit pelapor..."
                                    />
                                </div>
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
                                    <span className="font-bold text-gray-700">Status Akun Aktif (Dapat Login ke Sistem)</span>
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

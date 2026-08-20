import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';
import { buildGroupedUnitOptions } from '@/Utils/unitHelper';

export default function PenugasanTarget() {
    const user = usePage().props.auth.user;
    
    if (user.role !== 'ADMIN') {
        return (
            <AuthenticatedLayout pageTitle="Akses Ditolak">
                <div className="p-8 text-center text-red-600 font-bold">
                    Hanya Admin yang dapat mengakses halaman ini.
                </div>
            </AuthenticatedLayout>
        );
    }

    const [units, setUnits] = useState([]);
    const [contexts, setContexts] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [streaming, setStreaming] = useState(false);

    // Form states
    const [selectedUnit, setSelectedUnit] = useState('');
    const [selectedYear, setSelectedYear] = useState('2026');
    const [checkedIndicators, setCheckedIndicators] = useState([]);

    // Table search & advanced filters
    const [filterUnit, setFilterUnit] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterIku, setFilterIku] = useState('');
    const [filterJenis, setFilterJenis] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);


    const [checklistTab, setChecklistTab] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterUnit, filterYear, filterIku, filterJenis, showDeleted, assignments.length]);

    const renderJenisBadge = (jenis) => {
        const val = (jenis || 'WAJIB').toUpperCase();
        if (val === 'PILIHAN') {
            return <span className="text-[9px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wider border border-purple-200 flex-shrink-0">Pilihan</span>;
        } else if (val === 'PARTISIPATIF') {
            return <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 flex-shrink-0">Partisipatif</span>;
        }
        return <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-200 flex-shrink-0">Wajib</span>;
    };

    useEffect(() => {
        // Load initial metadata
        Promise.all([
            fetch('/api/master/units').then(res => res.json()),
            fetch('/api/master/contexts').then(res => res.json()),
            fetch('/api/master/iku').then(res => res.json())
        ])
        .then(([unitsData, ctxData, ikuData]) => {
            setUnits(unitsData);
            setContexts(ctxData);
            setIndicators(ikuData);
            
            if (unitsData.length > 0) {
                setSelectedUnit(unitsData[0].id);
            }
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    // Listen to filter changes and showDeleted state to reload streamed table data
    useEffect(() => {
        loadStreamedAssignments();
    }, [filterUnit, filterYear, filterIku, filterJenis, showDeleted]);

    // Handle fetching assignments when unit/year changes on the form checkboxes
    useEffect(() => {
        if (selectedUnit && selectedYear) {
            fetchAssignmentsForCheckbox(selectedUnit, selectedYear);
        }
    }, [selectedUnit, selectedYear]);

    const fetchAssignmentsForCheckbox = (unitId, yearVal) => {
        fetch(`/api/master/iku/assigned?unit=${unitId}&tahun=${yearVal}`)
            .then(res => res.json())
            .then(data => {
                setCheckedIndicators(data.map(i => i.id));
            })
            .catch(err => console.error(err));
    };

    const loadStreamedAssignments = () => {
        setStreaming(true);
        setAssignments([]);

        const params = new URLSearchParams();
        params.append('show_deleted', showDeleted ? 'true' : 'false');
        if (filterUnit) params.append('unit', filterUnit);
        if (filterYear) params.append('tahun', filterYear);
        if (filterIku) params.append('iku', filterIku);
        if (filterJenis) params.append('jenis_iku', filterJenis);

        const source = new EventSource(`/api/penugasan/stream?${params.toString()}`);
        let tempRows = [];

        source.addEventListener('row', (event) => {
            const row = JSON.parse(event.data);
            tempRows.push(row);
            setAssignments([...tempRows]);
        });

        source.addEventListener('end', () => {
            source.close();
            setStreaming(false);
        });

        source.onerror = () => {
            source.close();
            setStreaming(false);
        };
    };

    const handleCheckboxChange = (id) => {
        if (checkedIndicators.includes(id)) {
            setCheckedIndicators(checkedIndicators.filter(i => i !== id));
        } else {
            setCheckedIndicators([...checkedIndicators, id]);
        }
    };

    const handleGroupToggle = (contextId) => {
        const contextIndicatorIds = indicators
            .filter(i => {
                if (i.id_konteks !== contextId) return false;
                if (checklistTab !== 'ALL' && (i.jenis_iku || 'WAJIB').toUpperCase() !== checklistTab) return false;
                return true;
            })
            .map(i => i.id);

        const allChecked = contextIndicatorIds.every(id => checkedIndicators.includes(id));

        if (allChecked) {
            setCheckedIndicators(checkedIndicators.filter(id => !contextIndicatorIds.includes(id)));
        } else {
            const newChecked = new Set([...checkedIndicators, ...contextIndicatorIds]);
            setCheckedIndicators(Array.from(newChecked));
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!selectedUnit || !selectedYear) {
            alert('Silakan pilih unit dan tahun penugasan.');
            return;
        }

        axios.post('/api/penugasan', {
            fakultas_unit: selectedUnit,
            tahun: selectedYear,
            id_indikator: checkedIndicators
        })
        .then(() => {
            alert('Penugasan target berhasil disimpan!');
            loadStreamedAssignments();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan penugasan.');
        });
    };

    // Load assignment for editing inside the checklist form
    const handleEditAssignment = (item) => {
        setSelectedUnit(item.fakultas_unit);
        setSelectedYear(item.tahun.toString());
        fetchAssignmentsForCheckbox(item.fakultas_unit, item.tahun);
        
        // Smooth scroll to top form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteAssignment = (id, mode) => {
        const confirmMsg = mode === 'hard' 
            ? 'Apakah Anda yakin ingin menghapus penugasan ini secara permanen? Tindakan ini tidak dapat dibatalkan.'
            : 'Apakah Anda yakin ingin menghapus sementara penugasan ini?';

        if (!confirm(confirmMsg)) return;

        axios.delete(`/api/penugasan/${id}?mode=${mode}`)
        .then(res => {
            alert(res.data.message || 'Penugasan berhasil dihapus.');
            loadStreamedAssignments();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menghapus penugasan.');
        });
    };

    // Restore soft-deleted assignment
    const handleRestoreAssignment = (id) => {
        if (!confirm('Apakah Anda yakin ingin memulihkan penugasan ini?')) {
            return;
        }

        axios.post(`/api/penugasan/${id}/restore`)
        .then(res => {
            alert(res.data.message || 'Penugasan berhasil dipulihkan.');
            loadStreamedAssignments();
        })
        .catch(err => console.error(err));
    };

    return (
        <AuthenticatedLayout pageTitle="Penugasan Capaian Target">
            <Head title="Penugasan Capaian Target - IKU Portal" />

            <div className="space-y-8">
                {/* Form Assignment Panel (Always Full Width at the top) */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8">
                    <h3 className="text-base font-extrabold text-[#005bb1] uppercase tracking-wider mb-6">Form Penugasan IKU ke Unit</h3>
                    
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Fakultas Unit */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Fakultas / Prodi / Unit Kerja</label>
                                <SearchableSelect 
                                    options={buildGroupedUnitOptions(units, '-- Pilih Fakultas / Prodi / Unit --')}
                                    value={selectedUnit}
                                    onChange={(val) => setSelectedUnit(val)}
                                    placeholder="-- Pilih Fakultas / Prodi / Unit --"
                                    searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                                />
                            </div>

                            {/* Tahun */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Tahun Penugasan</label>
                                <SearchableSelect 
                                    options={['2026', '2027', '2028', '2029', '2030'].map(y => ({ id: y, label: y }))}
                                    value={selectedYear}
                                    onChange={(val) => setSelectedYear(val)}
                                    placeholder="-- Pilih Tahun --"
                                    searchPlaceholder="Cari Tahun..."
                                />
                            </div>
                        </div>

                        {/* Indicators checklist grouped by Context */}
                        <div className="space-y-6 pt-4 border-t border-[#c0c6d6]/10">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider">Checklist Indikator Kinerja Utama (IKU)</label>
                                
                                <div className="flex items-center gap-1 bg-[#f1f3fe]/60 p-1 rounded-xl border border-[#c0c6d6]/20">
                                    {[
                                        { id: 'ALL', label: 'Semua' },
                                        { id: 'WAJIB', label: 'Wajib' },
                                        { id: 'PILIHAN', label: 'Pilihan' },
                                        { id: 'PARTISIPATIF', label: 'Partisipatif' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setChecklistTab(tab.id)}
                                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                                checklistTab === tab.id
                                                    ? 'bg-[#005bb1] text-white shadow-sm'
                                                    : 'text-[#535f71] hover:text-[#181c23] hover:bg-white/50'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 divide-y divide-[#c0c6d6]/10">
                                {contexts.map(ctx => {
                                    const ctxIkus = indicators.filter(i => {
                                        if (i.id_konteks !== ctx.id) return false;
                                        if (checklistTab !== 'ALL' && (i.jenis_iku || 'WAJIB').toUpperCase() !== checklistTab) return false;
                                        return true;
                                    });
                                    if (ctxIkus.length === 0) return null;

                                    const checkedInGroup = ctxIkus.filter(i => checkedIndicators.includes(i.id));
                                    const isAllChecked = checkedInGroup.length === ctxIkus.length && ctxIkus.length > 0;
                                    const isSomeChecked = checkedInGroup.length > 0 && checkedInGroup.length < ctxIkus.length;

                                    return (
                                        <div key={ctx.id} className="pt-4 first:pt-0 space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <input 
                                                    type="checkbox"
                                                    checked={isAllChecked}
                                                    ref={el => {
                                                        if (el) {
                                                            el.indeterminate = isSomeChecked;
                                                        }
                                                    }}
                                                    onChange={() => handleGroupToggle(ctx.id)}
                                                    className="rounded border-[#c0c6d6] text-[#005bb1] focus:ring-[#005bb1] cursor-pointer"
                                                />
                                                <h4 className="text-[11px] font-bold text-[#005bb1] uppercase tracking-wider cursor-pointer" onClick={() => handleGroupToggle(ctx.id)}>{ctx.nama}</h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {ctxIkus.map(iku => (
                                                    <label key={iku.id} className="flex items-start gap-3 bg-[#f9f9ff] p-3 rounded-lg border border-[#c0c6d6]/15 hover:border-[#005bb1]/30 transition-all cursor-pointer">
                                                        <input 
                                                            type="checkbox"
                                                            checked={checkedIndicators.includes(iku.id)}
                                                            onChange={() => handleCheckboxChange(iku.id)}
                                                            className="rounded border-[#c0c6d6] text-[#005bb1] focus:ring-[#005bb1] mt-0.5"
                                                        />
                                                        <div className="text-xs w-full">
                                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                                <span className="font-bold text-[#181c23]">{iku.iku}</span>
                                                                {renderJenisBadge(iku.jenis_iku)}
                                                            </div>
                                                            <span className="text-[#535f71] line-clamp-2">{iku.kategori}</span>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#c0c6d6]/10 flex justify-end">
                            <button 
                                type="submit"
                                className="bg-[#005bb1] text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] shadow-sm uppercase tracking-wider"
                            >
                                Simpan Penugasan
                            </button>
                        </div>
                    </form>
                </div>

                {/* Table Data Panel (Always Below Form, Full Width) */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-[#181c23]">
                                {showDeleted ? 'Data Table Sampah / Terhapus' : 'Data Table Penugasan'}
                            </h3>
                            <p className="text-[11px] text-[#717785] mt-0.5">Daftar penugasan IKU aktif saat ini.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Toggle Show Deleted Button */}
                            <button 
                                onClick={() => setShowDeleted(!showDeleted)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                                    showDeleted 
                                        ? 'bg-[#ba1a1a] text-white hover:bg-[#ffb4ab]' 
                                        : 'bg-[#ebedf8] text-[#535f71] hover:bg-[#c0c6d6]'
                                }`}
                            >
                                {showDeleted ? 'Tampilkan Aktif' : 'Show Deleted'}
                            </button>

                            {streaming && (
                                <span className="text-[10px] text-[#005bb1] bg-[#005bb1]/10 px-2 py-0.5 rounded animate-pulse font-bold">
                                    Streaming Data...
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-[#f9f9ff] p-4 rounded-xl border border-[#c0c6d6]/10">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Unit</label>
                            <SearchableSelect 
                                options={[{ id: '', label: 'Semua Unit' }, ...units.map(u => ({ id: u.id, label: u.nama_fak_prod_unit }))]}
                                value={filterUnit}
                                onChange={(val) => setFilterUnit(val)}
                                placeholder="Semua Unit"
                                searchPlaceholder="Cari Unit..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Tahun</label>
                            <SearchableSelect 
                                options={[{ id: '', label: 'Semua Tahun' }, ...['2026', '2027', '2028', '2029', '2030'].map(y => ({ id: y, label: y }))]}
                                value={filterYear}
                                onChange={(val) => setFilterYear(val)}
                                placeholder="Semua Tahun"
                                searchPlaceholder="Cari Tahun..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Kelompok IKU</label>
                            <SearchableSelect 
                                options={[
                                    { id: '', label: 'Semua Kelompok' },
                                    { id: 'WAJIB', label: 'Wajib' },
                                    { id: 'PILIHAN', label: 'Pilihan' },
                                    { id: 'PARTISIPATIF', label: 'Partisipatif' }
                                ]}
                                value={filterJenis}
                                onChange={(val) => setFilterJenis(val)}
                                placeholder="Semua Kelompok"
                                searchPlaceholder="Cari Kelompok..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Cari Indikator / Keyword</label>
                            <input 
                                type="text" 
                                value={filterIku} 
                                onChange={(e) => setFilterIku(e.target.value)}
                                placeholder="Cari IKU..." 
                                className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-3 py-1.5 text-xs outline-none"
                            />
                        </div>
                    </div>

                    {/* Data Table */}
                    {(() => {
                        const totalItems = assignments.length;
                        const totalPages = Math.ceil(totalItems / 10) || 1;
                        const safeCurrentPage = Math.min(currentPage, totalPages);
                        const startIndex = (safeCurrentPage - 1) * 10;
                        const endIndex = Math.min(startIndex + 10, totalItems);
                        const currentAssignments = assignments.slice(startIndex, endIndex);

                        return (
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-[#c0c6d6]/25 bg-[#f1f3fe]/40 text-[#717785] font-bold uppercase tracking-wider">
                                                <th className="p-3">Unit Pelapor</th>
                                                <th className="p-3 text-center w-24">Tahun</th>
                                                <th className="p-3">Indikator (IKU)</th>
                                                <th className="p-3 text-center w-36">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#c0c6d6]/10">
                                            {currentAssignments.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-4 text-center text-[#717785] italic">
                                                        {streaming ? 'Memuat data penugasan...' : 'Belum ada data penugasan yang sesuai filter.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentAssignments.map(a => (
                                                    <tr key={a.id} className="hover:bg-[#f9f9ff]">
                                                        <td className="p-3 font-semibold text-[#181c23]">{a.nama_unit}</td>
                                                        <td className="p-3 text-center font-bold text-[#535f71]">{a.tahun}</td>
                                                        <td className="p-3 text-[#535f71] font-semibold">
                                                            <div className="flex items-center gap-2">
                                                                <span>{a.full_kategori}</span>
                                                                {renderJenisBadge(a.jenis_iku)}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <div className="flex justify-center gap-2">
                                                                {!showDeleted ? (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleEditAssignment(a)}
                                                                            className="bg-[#ebedf8] text-[#005bb1] px-2.5 py-1 rounded text-[10px] font-bold hover:bg-[#d6e3ff] transition-all uppercase"
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDeleteAssignment(a.id, 'soft')}
                                                                            className="bg-[#fff0ee] text-[#ba1a1a] px-2.5 py-1 rounded text-[10px] font-bold hover:bg-[#ffdad6] transition-all uppercase"
                                                                        >
                                                                            Hapus
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button 
                                                                            onClick={() => handleRestoreAssignment(a.id)}
                                                                            className="bg-[#e8f5e9] text-green-700 px-2.5 py-1 rounded text-[10px] font-bold hover:bg-[#c8e6c9] transition-all uppercase"
                                                                        >
                                                                            Restore
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => handleDeleteAssignment(a.id, 'hard')}
                                                                            className="bg-[#fff0ee] text-[#ba1a1a] px-2.5 py-1 rounded text-[10px] font-bold hover:bg-[#ffdad6] transition-all uppercase"
                                                                        >
                                                                            Hard Delete
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls (Limit 10 per page) */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#c0c6d6]/20">
                                    <div className="text-[#535f71] text-xs font-semibold">
                                        Menampilkan <span className="font-bold text-[#181c23]">{totalItems > 0 ? startIndex + 1 : 0}</span> sampai <span className="font-bold text-[#181c23]">{endIndex}</span> dari <span className="font-bold text-[#181c23]">{totalItems}</span> data
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={safeCurrentPage <= 1}
                                            className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                                safeCurrentPage <= 1 
                                                    ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed' 
                                                    : 'border-[#c0c6d6] text-[#181c23] bg-white hover:bg-[#f1f3fe] hover:border-[#005bb1] cursor-pointer shadow-2xs'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                            Previous
                                        </button>

                                        <span className="text-xs font-extrabold text-[#005bb1] bg-[#ebedf8] px-3.5 py-1.5 rounded-xl">
                                            {safeCurrentPage} / {totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={safeCurrentPage >= totalPages}
                                            className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                                safeCurrentPage >= totalPages 
                                                    ? 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed' 
                                                    : 'border-[#c0c6d6] text-[#181c23] bg-white hover:bg-[#f1f3fe] hover:border-[#005bb1] cursor-pointer shadow-2xs'
                                            }`}
                                        >
                                            Next
                                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

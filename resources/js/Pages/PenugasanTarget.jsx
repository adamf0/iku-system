import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import axios from 'axios';

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
    const [showDeleted, setShowDeleted] = useState(false);


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
    }, [filterUnit, filterYear, filterIku, showDeleted]);

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
        setCheckedIndicators(prev => {
            if (prev.includes(id)) {
                return prev.filter(x => x !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const handleGroupToggle = (ctxId) => {
        const groupIkus = indicators.filter(i => i.id_konteks === ctxId);
        const groupIds = groupIkus.map(i => i.id);
        const alreadyChecked = groupIds.filter(id => checkedIndicators.includes(id));
        
        if (alreadyChecked.length === groupIds.length) {
            setCheckedIndicators(prev => prev.filter(id => !groupIds.includes(id)));
        } else {
            setCheckedIndicators(prev => {
                const base = prev.filter(id => !groupIds.includes(id));
                return [...base, ...groupIds];
            });
        }
    };

    const handleSave = (e) => {
        e.preventDefault();
        
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
                                <select 
                                    value={selectedUnit}
                                    onChange={(e) => setSelectedUnit(e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    required
                                >
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.nama_fak_prod_unit} ({u.type.toUpperCase()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Tahun */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Tahun Penugasan</label>
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                    required
                                >
                                    <option value="2026">2026</option>
                                    <option value="2027">2027</option>
                                    <option value="2028">2028</option>
                                    <option value="2029">2029</option>
                                    <option value="2030">2030</option>
                                </select>
                            </div>
                        </div>

                        {/* Indicators checklist grouped by Context */}
                        <div className="space-y-6 pt-4 border-t border-[#c0c6d6]/10">
                            <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Checklist Indikator Kinerja Utama (IKU)</label>
                            
                            <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2 divide-y divide-[#c0c6d6]/10">
                                {contexts.map(ctx => {
                                    const ctxIkus = indicators.filter(i => i.id_konteks === ctx.id);
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
                                                        <div className="text-xs">
                                                            <span className="font-bold text-[#181c23] block">{iku.iku}</span>
                                                            <span className="text-[#535f71] line-clamp-2 mt-0.5">{iku.kategori}</span>
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#f9f9ff] p-4 rounded-xl border border-[#c0c6d6]/10">
                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Unit</label>
                            <select 
                                value={filterUnit} 
                                onChange={(e) => setFilterUnit(e.target.value)}
                                className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-3 py-1.5 text-xs outline-none"
                            >
                                <option value="">Semua Unit</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.nama_fak_prod_unit}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Tahun</label>
                            <select 
                                value={filterYear} 
                                onChange={(e) => setFilterYear(e.target.value)}
                                className="w-full bg-white border border-[#c0c6d6]/30 rounded-lg px-3 py-1.5 text-xs outline-none"
                            >
                                <option value="">Semua Tahun</option>
                                <option value="2026">2026</option>
                                <option value="2027">2027</option>
                                <option value="2028">2028</option>
                                <option value="2029">2029</option>
                                <option value="2030">2030</option>
                            </select>
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
                                {assignments.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-4 text-center text-[#717785] italic">
                                            {streaming ? 'Memuat data penugasan...' : 'Belum ada data penugasan yang sesuai filter.'}
                                        </td>
                                    </tr>
                                ) : (
                                    assignments.map(a => (
                                        <tr key={a.id} className="hover:bg-[#f9f9ff]">
                                            <td className="p-3 font-semibold text-[#181c23]">{a.nama_unit}</td>
                                            <td className="p-3 text-center font-bold text-[#535f71]">{a.tahun}</td>
                                            <td className="p-3 text-[#535f71] font-semibold">
                                                {a.full_kategori}
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
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

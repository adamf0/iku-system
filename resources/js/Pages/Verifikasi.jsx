import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import SearchableSelect from '@/Components/SearchableSelect';
import { buildGroupedUnitOptions } from '@/Utils/unitHelper';

export default function Verifikasi() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [units, setUnits] = useState([]);
    const [indicators, setIndicators] = useState([]);

    // Filter states
    const [filterTriwulan, setFilterTriwulan] = useState('ALL');
    const [years, setYears] = useState([{ tahun: 2026 }, { tahun: 2025 }]);
    const [filterTahun, setFilterTahun] = useState('ALL');
    const [filterUnit, setFilterUnit] = useState('');
    const [filterIndikator, setFilterIndikator] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        // Load metadata
        Promise.all([
            fetch('/api/master/units').then(res => res.json()),
            fetch('/api/master/iku').then(res => res.json()),
            fetch('/api/master/tahun').then(res => res.json())
        ])
        .then(([unitsData, ikuData, yearsData]) => {
            setUnits(unitsData);
            setIndicators(ikuData);
            if (yearsData.length > 0) setYears(yearsData);
        })
        .catch(err => console.error(err));
    }, []);

    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        loadQueue();
        setCurrentPage(1);
    }, [filterTriwulan, filterTahun, filterUnit, filterIndikator, filterStatus]);

    const loadQueue = () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filterTriwulan !== 'ALL') params.append('triwulan', filterTriwulan);
        if (filterTahun !== 'ALL') params.append('tahun', filterTahun);
        if (filterUnit) params.append('unit', filterUnit);
        if (filterIndikator) params.append('indikator', filterIndikator);
        if (filterStatus !== 'ALL') params.append('status', filterStatus);

        fetch(`/api/dashboard/antrean-verifikasi?${params.toString()}`)
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
                'Content-Type': 'application/json'
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
        if (!confirm('Apakah Anda yakin ingin mengesahkan capaian ini?')) return;

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

    const computeProgress = (realisasi, target) => {
        const r = parseFloat(realisasi);
        const t = parseFloat(target);
        if (isNaN(r) || isNaN(t) || t === 0) return null;
        const pct = ((r / t) * 100).toFixed(1);
        return `${pct}% dari Target`;
    };

    const renderJenisBadge = (jenis) => {
        const val = (jenis || 'WAJIB').toUpperCase();
        if (val === 'PILIHAN') {
            return <span className="text-[9px] font-extrabold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1 border border-purple-200">PILIHAN</span>;
        } else if (val === 'PARTISIPATIF') {
            return <span className="text-[9px] font-extrabold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1 border border-amber-200">PARTISIPATIF</span>;
        }
        return <span className="text-[9px] font-extrabold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider ml-1 border border-blue-200">WAJIB</span>;
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'DISAHKAN':
                return <span className="text-[10px] font-extrabold bg-green-100 text-green-700 px-2.5 py-1 rounded-full uppercase tracking-wider border border-green-200">Disahkan</span>;
            case 'DIVERIFIKASI':
                return <span className="text-[10px] font-extrabold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-200">Diverifikasi</span>;
            case 'DIAJUKAN':
                return <span className="text-[10px] font-extrabold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-200">Diajukan</span>;
            case 'DITOLAK':
                return <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2.5 py-1 rounded-full uppercase tracking-wider border border-red-200">Ditolak</span>;
            default:
                return <span className="text-[10px] font-extrabold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full uppercase tracking-wider border border-gray-200">{status}</span>;
        }
    };

    const handleExportXlsx = () => {
        if (queue.length === 0) {
            alert('Tidak ada data verifikasi untuk diexport.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "Unit Pelapor;Kode IKU;Nama Indikator;Triwulan;Baseline;Target;Realisasi;Satuan;Status Validasi;Diinput Oleh\n";

        queue.forEach(item => {
            const unit = `"${(item.nama_unit || '').replace(/"/g, '""')}"`;
            const kode = `"${(item.kode_iku || '').replace(/"/g, '""')}"`;
            const nama = `"${(item.nama_iku || item.full_kategori || '').replace(/"/g, '""')}"`;
            const tw = `"${item.triwulan || ''}"`;
            const base = `"${item.base_line || '-'}"`;
            const target = `"${item.target || '-'}"`;
            const real = `"${item.nilai_capaian || 0}"`;
            const satuan = `"${(item.satuan || '%').replace(/"/g, '""')}"`;
            const status = `"${(item.status_validasi || '').replace(/"/g, '""')}"`;
            const inputter = `"${(item.diinput_oleh || '').replace(/"/g, '""')}"`;
            csvContent += `${unit};${kode};${nama};${tw};${base};${target};${real};${satuan};${status};${inputter}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Verifikasi_Capaian_${filterTriwulan}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Pagination calculations (Limit 10 per page)
    const totalItems = queue.length;
    const totalPages = Math.ceil(totalItems / 10) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * 10;
    const endIndex = Math.min(startIndex + 10, totalItems);
    const currentQueue = queue.slice(startIndex, endIndex);

    return (
        <AuthenticatedLayout header="Verifikasi & Pengesahan Capaian IKU">
            <Head title="Verifikasi Capaian - Performance Management" />

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[#181c23]">Antrean Verifikasi & Pengesahan LPM</h2>
                        <p className="text-sm text-[#535f71]">Tinjau dan sahkan capaian realisasi indikator kinerja unit secara triwulanan.</p>
                    </div>

                    <button 
                        onClick={handleExportXlsx}
                        className="flex items-center gap-2 bg-[#005bb1] text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-[#0073dd] transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">download</span>
                        Export XLSX
                    </button>
                </div>

                {/* Tab Triwulan Filters */}
                <div className="flex items-center gap-2 bg-[#f1f3fe]/60 p-1.5 rounded-2xl w-fit border border-[#c0c6d6]/20">
                    {[
                        { id: 'ALL', label: 'Semua Triwulan' },
                        { id: 'TW1', label: 'TW1' },
                        { id: 'TW2', label: 'TW2' },
                        { id: 'TW3', label: 'TW3' },
                        { id: 'TW4', label: 'TW4' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterTriwulan(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                filterTriwulan === tab.id
                                    ? 'bg-[#005bb1] text-white shadow-sm'
                                    : 'text-[#535f71] hover:text-[#181c23] hover:bg-white/50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-[#c0c6d6]/20 shadow-sm">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Tahun</label>
                        <SearchableSelect 
                            options={[{ id: 'ALL', label: 'Semua Tahun' }, ...years.map(y => ({ id: y.tahun, label: `Tahun ${y.tahun}` }))]}
                            value={filterTahun}
                            onChange={(val) => setFilterTahun(val)}
                            placeholder="Semua Tahun"
                            searchPlaceholder="Cari Tahun..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Unit</label>
                        <SearchableSelect 
                            options={buildGroupedUnitOptions(units, 'Semua Unit')}
                            value={filterUnit}
                            onChange={(val) => setFilterUnit(val)}
                            placeholder="Semua Unit"
                            searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Indikator</label>
                        <SearchableSelect 
                            options={[{ id: '', label: 'Semua Indikator' }, ...indicators.map(i => ({ id: i.id, label: `${i.iku} - ${i.kategori}` }))]}
                            value={filterIndikator}
                            onChange={(val) => setFilterIndikator(val)}
                            placeholder="Semua Indikator"
                            searchPlaceholder="Cari Indikator..."
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Status Validasi</label>
                        <SearchableSelect 
                            options={[
                                { id: 'ALL', label: 'Semua Status' },
                                { id: 'DIAJUKAN', label: 'Diajukan' },
                                { id: 'DIVERIFIKASI', label: 'Diverifikasi' },
                                { id: 'DISAHKAN', label: 'Disahkan' },
                                { id: 'DITOLAK', label: 'Ditolak' }
                            ]}
                            value={filterStatus}
                            onChange={(val) => setFilterStatus(val)}
                            placeholder="Semua Status"
                            searchPlaceholder="Cari Status..."
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center min-h-[300px]">
                        <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                    </div>
                ) : queue.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 border border-[#c0c6d6]/20 text-center text-[#717785] space-y-2">
                        <span className="material-symbols-outlined text-4xl text-[#c0c6d6]">inbox</span>
                        <p className="font-semibold text-xs">Belum ada data capaian yang sesuai dengan filter.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-[#c0c6d6]/20 p-6 space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#f1f3fe]/60 border-b border-[#c0c6d6]/20 text-[#535f71] font-bold uppercase tracking-wider">
                                        <th className="p-4 w-1/5">Unit Pelapor</th>
                                        <th className="p-4 w-1/4">Indikator</th>
                                        <th className="p-4 text-center w-16">TW</th>
                                        <th className="p-4 text-center w-24">Baseline</th>
                                        <th className="p-4 text-center w-24">Target</th>
                                        <th className="p-4 text-center w-48">Realisasi & Progress</th>
                                        <th className="p-4 text-center w-28">Status</th>
                                        <th className="p-4 text-center w-36">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#c0c6d6]/10">
                                    {currentQueue.map(item => {
                                        const progressPct = computeProgress(item.nilai_capaian, item.target);
                                        return (
                                            <tr key={item.id_capaian} className="hover:bg-[#f1f3fe]/20 transition-colors">
                                                <td className="p-4 font-bold text-[#181c23]">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {item.jenjang && (
                                                            <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                                                                {item.jenjang}
                                                            </span>
                                                        )}
                                                        <span>{item.nama_unit}</span>
                                                    </div>
                                                    {item.fakultas && (
                                                        <span className="text-[11px] font-medium text-[#535f71] block mt-0.5">
                                                            Fak. {item.fakultas}
                                                        </span>
                                                    )}
                                                    <span className="text-[9px] text-[#717785] block font-bold uppercase tracking-wider mt-0.5">
                                                        {item.type_unit === 'prodi' && item.jenjang ? `PRODI ${item.jenjang.toUpperCase()}` : (item.type_unit ? item.type_unit.toUpperCase() : 'UNIT')}
                                                    </span>
                                                </td>
                                                <td className="p-4 space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-[#005bb1]">{item.kode_iku}</span>
                                                        {renderJenisBadge(item.jenis_iku)}
                                                    </div>
                                                    <p className="text-[#535f71] line-clamp-2">{item.nama_iku || item.full_kategori}</p>
                                                    <p className="text-[10px] text-[#717785]">Diinput oleh: {item.diinput_oleh}</p>
                                                </td>
                                                <td className="p-4 text-center font-extrabold text-[#535f71] bg-[#f9f9ff]">
                                                    {item.triwulan}
                                                </td>
                                                
                                                {/* Baseline Card */}
                                                <td className="p-4 text-center">
                                                    <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#535f71] font-bold text-xs inline-block min-w-[70px]">
                                                        {item.base_line || '-'}
                                                    </div>
                                                </td>

                                                {/* Target Card */}
                                                <td className="p-4 text-center">
                                                    <div className="bg-[#f1f3fe]/40 border border-[#c0c6d6]/30 rounded-xl px-3 py-2 text-[#181c23] font-extrabold text-xs inline-block min-w-[70px]">
                                                        {item.target || '-'}
                                                    </div>
                                                </td>

                                                {/* Realisasi Card with % dari Target subtext */}
                                                <td className="p-4 text-center">
                                                    <div className="relative bg-[#ebedf8] border border-[#005bb1]/20 rounded-2xl px-4 py-2.5 text-center inline-block w-full max-w-[160px]">
                                                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-white px-2 py-0.5 rounded-full text-[9px] font-extrabold text-[#181c23] uppercase tracking-wider border border-[#c0c6d6]/30 shadow-2xs">
                                                            Realisasi
                                                        </span>
                                                        <div className="text-base font-extrabold text-[#005bb1] mt-0.5">
                                                            {item.nilai_capaian} <span className="text-xs font-normal text-[#535f71]">{item.satuan || '%'}</span>
                                                        </div>
                                                        {progressPct && (
                                                            <div className="text-[10px] font-bold text-[#535f71] mt-0.5">
                                                                {progressPct}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Status Badge */}
                                                <td className="p-4 text-center">
                                                    {renderStatusBadge(item.status_validasi)}
                                                    {item.alasan_penolakan && (
                                                        <span className="text-[10px] text-red-600 italic block mt-1 line-clamp-1" title={item.alasan_penolakan}>
                                                            Ket: {item.alasan_penolakan}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {item.status_validasi === 'DIAJUKAN' && (
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleVerify(item.id_capaian, 'APPROVE')}
                                                                    className="px-3 py-1.5 bg-[#005bb1] text-white rounded-lg font-bold hover:bg-[#0073dd] transition-all text-[11px]"
                                                                >
                                                                    Setujui
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleVerify(item.id_capaian, 'REJECT')}
                                                                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg font-bold hover:bg-red-200 transition-all text-[11px]"
                                                                >
                                                                    Tolak
                                                                </button>
                                                            </div>
                                                        )}

                                                        {item.status_validasi === 'DIVERIFIKASI' && (
                                                            <button 
                                                                onClick={() => handleSahkan(item.id_capaian)}
                                                                className="px-4 py-1.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all text-[11px] shadow-sm uppercase tracking-wider"
                                                            >
                                                                Sah kan
                                                            </button>
                                                        )}

                                                        {item.status_validasi === 'DISAHKAN' && (
                                                            <span className="text-[10px] font-bold text-green-700 inline-flex items-center gap-0.5">
                                                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                Telah Disahkan
                                                            </span>
                                                        )}

                                                        {item.file_url && (
                                                            <a 
                                                                href={item.file_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] text-[#005bb1] font-bold hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">link</span>
                                                                Bukti
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                )}
            </div>
        </AuthenticatedLayout>
    );
}

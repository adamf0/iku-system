import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';
import { buildGroupedUnitOptions } from '@/Utils/unitHelper';

export default function EditCapaian() {
    const user = usePage().props.auth.user;

    // List states
    const [units, setUnits] = useState([]);
    const [years, setYears] = useState([{ tahun: 2026 }]);
    const [indicators, setIndicators] = useState([]);
    const [capaianList, setCapaianList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [streaming, setStreaming] = useState(false);

    const getInitialTriwulan = () => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const tw = params.get('triwulan');
            if (tw && ['TW1', 'TW2', 'TW3', 'TW4'].includes(tw.toUpperCase())) {
                return tw.toUpperCase();
            }
        }
        return 'TW1';
    };

    // Form inputs
    const [selectedUnitId, setSelectedUnitId] = useState(user.fakultas_unit || '');
    const [selectedIkuId, setSelectedIkuId] = useState('');
    const [tahun, setTahun] = useState(2026);
    const [triwulan, setTriwulan] = useState(getInitialTriwulan);

    const getActiveTriwulan = () => {
        const month = new Date().getMonth() + 1;
        if (month >= 1 && month <= 3) return 'TW1';
        if (month >= 4 && month <= 6) return 'TW2';
        if (month >= 7 && month <= 9) return 'TW3';
        return 'TW4';
    };

    const activeTw = getActiveTriwulan();
    const isTriwulanActive = (triwulan === activeTw);

    const [nilaiCapaian, setNilaiCapaian] = useState('');
    const [targetCapaian, setTargetCapaian] = useState('');
    const [catatan, setCatatan] = useState('');
    const [fileUrl, setFileUrl] = useState('');

    // Table filters & pagination
    const [filterIku, setFilterIku] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        // Fetch metadata
        Promise.all([
            fetch('/api/master/units').then(res => res.json()),
            fetch('/api/master/tahun').then(res => res.json())
        ])
        .then(([unitsData, yearsData]) => {
            setUnits(unitsData);
            if (yearsData.length > 0) {
                setYears(yearsData);
                setTahun(yearsData[0].tahun);
            }
            if (!selectedUnitId && unitsData.length > 0) {
                setSelectedUnitId(unitsData[0].id);
            }
        })
        .catch(err => console.error(err));
    }, []);

    // Load indicators when unit or year changes on the form
    useEffect(() => {
        if (selectedUnitId && tahun) {
            fetchIndicators(selectedUnitId, tahun);
        }
    }, [selectedUnitId, tahun]);

    // Load streamed data table whenever unit, tahun, triwulan, or table filter changes
    useEffect(() => {
        if (selectedUnitId) {
            setCurrentPage(1);
            loadStreamedCapaian();
        }
    }, [selectedUnitId, tahun, triwulan, filterIku]);

    const fetchIndicators = (unitId, yearVal) => {
        setLoading(true);
        fetch(`/api/master/iku/assigned?unit=${unitId}&tahun=${yearVal}`)
            .then(res => res.json())
            .then(data => {
                const formatted = data.map(iku => ({
                    ...iku,
                    id: iku.id,
                    label: `${iku.iku} - ${iku.kategori || iku.full_kategori}`
                }));
                setIndicators(formatted);
                setSelectedIkuId('');
                resetFormFields();
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const loadStreamedCapaian = () => {
        setStreaming(true);
        setCapaianList([]);

        const params = new URLSearchParams();
        params.append('unit', selectedUnitId);
        params.append('tahun', tahun);
        params.append('triwulan', triwulan);
        if (filterIku) params.append('iku', filterIku);

        const source = new EventSource(`/api/capaian/stream?${params.toString()}`);
        let tempRows = [];

        source.addEventListener('row', (event) => {
            const row = JSON.parse(event.data);
            tempRows.push(row);
            setCapaianList([...tempRows]);
            
            // If the row matches the currently selected IKU, pre-load form inputs
            if (originalSelectedIkuIdRef.current && Number(row.id_indikator) === Number(originalSelectedIkuIdRef.current)) {
                setNilaiCapaian(row.nilai_capaian);
                setCatatan(row.catatan || '');
                setFileUrl(row.file_url || '');
            }
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

    // Ref container to access selected Iku in EventSource callback without stale closures
    const originalSelectedIkuIdRef = React.useRef(selectedIkuId);
    useEffect(() => {
        originalSelectedIkuIdRef.current = selectedIkuId;
    }, [selectedIkuId]);

    const loadExistingRecord = (ikuId, capList, ikuList) => {
        if (!ikuId) {
            resetFormFields();
            return;
        }
        const found = capList.find(c => Number(c.id_indikator) === Number(ikuId));
        const activeIku = ikuList.find(i => Number(i.id) === Number(ikuId));

        if (found) {
            setNilaiCapaian(found.nilai_capaian);
            setCatatan(found.catatan || '');
            setFileUrl(found.file_url || '');
            setTargetCapaian(activeIku ? activeIku.target : '');
        } else {
            setNilaiCapaian('');
            setCatatan('');
            setFileUrl('');
            setTargetCapaian(activeIku ? activeIku.target : '');
        }
    };

    const resetFormFields = () => {
        setNilaiCapaian('');
        setCatatan('');
        setFileUrl('');
        setTargetCapaian('');
    };

    const handleIkuSelect = (id) => {
        setSelectedIkuId(id);
        if (id) {
            loadExistingRecord(id, capaianList, indicators);
        } else {
            resetFormFields();
        }
    };

    const handleEditFromTable = (item) => {
        setSelectedIkuId(item.id_indikator);
        setNilaiCapaian(item.nilai_capaian);
        setCatatan(item.catatan || '');
        setFileUrl(item.file_url || '');
        
        const actIku = indicators.find(i => Number(i.id) === Number(item.id_indikator));
        setTargetCapaian(actIku ? actIku.target : '');
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (!selectedIkuId) {
            alert('Silakan pilih Indikator Kinerja Utama terlebih dahulu.');
            return;
        }

        const payload = {
            id_indikator: selectedIkuId,
            fakultas_unit: selectedUnitId,
            tahun: tahun,
            triwulan: triwulan,
            nilai_capaian: nilaiCapaian || '0',
            catatan: catatan,
            file_url: fileUrl
        };

        axios.post('/api/capaian', payload)
        .then(res => {
            if (res.data.error) {
                alert(res.data.error);
                return;
            }
            alert('Capaian berhasil disimpan sebagai Draft!');
            loadStreamedCapaian();
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan capaian.');
        });
    };

    const handleSubmitForVerification = (id) => {
        if (!confirm('Apakah Anda yakin ingin mengajukan capaian ini untuk verifikasi? Setelah diajukan data tidak dapat diedit.')) {
            return;
        }

        axios.post(`/api/capaian/${id}/submit`)
        .then(() => {
            alert('Capaian berhasil diajukan!');
            loadStreamedCapaian();
        })
        .catch(err => console.error(err));
    };

    const handleExportXlsx = () => {
        if (capaianList.length === 0) {
            alert('Tidak ada data capaian untuk diexport.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "Kode IKU;Nama Indikator;Tahun;Triwulan;Capaian;Satuan;Catatan;File Bukti;Status Validasi\n";

        capaianList.forEach(item => {
            const kode = `"${(item.iku || item.raw_kode || '').replace(/"/g, '""')}"`;
            const nama = `"${(item.kategori || item.full_kategori || '').replace(/"/g, '""')}"`;
            const yr = `"${item.tahun || tahun}"`;
            const tw = `"${item.triwulan || triwulan}"`;
            const cap = `"${item.nilai_capaian || 0}"`;
            const satuan = `"${(item.satuan || '%').replace(/"/g, '""')}"`;
            const note = `"${(item.catatan || '').replace(/"/g, '""')}"`;
            const file = `"${(item.file_url || '').replace(/"/g, '""')}"`;
            const status = `"${(item.status_validasi || 'DRAFT').replace(/"/g, '""')}"`;

            csvContent += `${kode};${nama};${yr};${tw};${cap};${satuan};${note};${file};${status}\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Capaian_IKU_${triwulan}_${tahun}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };



    const selectedIku = indicators.find(i => Number(i.id) === Number(selectedIkuId));

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'DISAHKAN': return 'bg-green-100 text-green-700';
            case 'DIVERIFIKASI': return 'bg-blue-100 text-blue-700';
            case 'DIAJUKAN': return 'bg-orange-100 text-orange-700';
            case 'DRAFT': return 'bg-[#d6e3ff] text-[#00468a]';
            case 'DITOLAK': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    const activeIndicator = indicators.find(i => Number(i.id) === Number(selectedIkuId));
    const activeSatuan = activeIndicator ? activeIndicator.satuan : '%';

    // Pagination calculations (Limit 10 per page)
    const totalItems = capaianList.length;
    const totalPages = Math.ceil(totalItems / 10) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * 10;
    const endIndex = Math.min(startIndex + 10, totalItems);
    const currentCapaianList = capaianList.slice(startIndex, endIndex);

    return (
        <AuthenticatedLayout pageTitle={`Isi Capaian Kinerja`}>
            <Head title={`Isi Capaian Kinerja - IKU Portal`} />

            <div className="absolute right-8 top-3 flex items-center gap-3 z-50">
                <Link href={route('reporting')} className="bg-[#005bb1] text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] transition-all uppercase tracking-wider">
                    Kembali Ke Siklus
                </Link>
            </div>

            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold text-[#181c23]">Input Capaian Kinerja Unit</h2>
                    <p className="text-sm text-[#535f71]">Masukkan realisasi nilai capaian per indikator untuk periode triwulan terpilih.</p>
                </div>

                {!isTriwulanActive && (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-bold shadow-sm">
                        <span className="material-symbols-outlined text-amber-600 text-xl flex-shrink-0">lock</span>
                        <span>Periode pengisian <span className="underline font-black">{triwulan}</span> telah ditutup. Pengisian dan pengajuan hanya dapat dilakukan pada periode aktif (<span className="font-extrabold text-[#005bb1]">{activeTw}</span>).</span>
                    </div>
                )}

                {/* Form Input Card */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm overflow-hidden">
                    <div className="px-8 py-5 bg-[#ebedf8]/40 border-b border-[#c0c6d6]/20">
                        <h2 className="text-sm font-extrabold text-[#005bb1] uppercase tracking-wider">Form Input Capaian IKU Triwulanan</h2>
                    </div>

                    <form onSubmit={handleSave} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Unit Pelapor */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Unit Pelapor</label>
                                <SearchableSelect 
                                    options={buildGroupedUnitOptions(units, '-- Pilih Unit Pelapor --')}
                                    value={selectedUnitId}
                                    onChange={(val) => setSelectedUnitId(val)}
                                    disabled={!['ADMIN', 'FAKULTAS', 'LPM'].includes(user.role)}
                                    placeholder="-- Pilih Unit Pelapor --"
                                    searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                                />
                            </div>

                            {/* IKU */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Indikator Kinerja Utama (IKU)</label>
                                <SearchableSelect 
                                    options={indicators}
                                    value={selectedIkuId}
                                    onChange={handleIkuSelect}
                                />
                            </div>

                            {/* Tahun */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Tahun</label>
                                <SearchableSelect 
                                    options={years.map(y => ({ id: y.tahun, label: String(y.tahun) }))}
                                    value={tahun}
                                    onChange={(val) => setTahun(Number(val))}
                                    placeholder="-- Pilih Tahun --"
                                    searchPlaceholder="Cari Tahun..."
                                />
                            </div>

                            {/* Triwulan */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Triwulan</label>
                                <SearchableSelect 
                                    options={['TW1', 'TW2', 'TW3', 'TW4'].map(t => ({ id: t, label: t }))}
                                    value={triwulan}
                                    onChange={(val) => setTriwulan(val)}
                                    placeholder="-- Pilih Triwulan --"
                                    searchPlaceholder="Cari Triwulan..."
                                />
                            </div>

                            {/* Realisasi Capaian */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Realisasi Capaian ({selectedIku?.satuan || '%'})</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    value={nilaiCapaian}
                                    disabled={!isTriwulanActive}
                                    onChange={(e) => setNilaiCapaian(e.target.value)}
                                    required
                                    className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1] disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                            </div>

                            {/* Target Capaian */}
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Target Capaian ({selectedIku?.satuan || '%'})</label>
                                <input 
                                    type="text" 
                                    value={targetCapaian}
                                    disabled
                                    className="w-full bg-[#f1f3fe] border border-[#c0c6d6]/60 rounded-xl px-4 py-2.5 text-xs font-bold text-[#005bb1] outline-none"
                                />
                            </div>
                        </div>

                        {/* Catatan */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Catatan / Penjelasan Data</label>
                            <textarea 
                                value={catatan}
                                onChange={(e) => setCatatan(e.target.value)}
                                disabled={!isTriwulanActive}
                                placeholder="Contoh: rincian sumber data, metode penghitungan, dsb."
                                className="w-full bg-white border border-[#c0c6d6] rounded-xl p-4 text-xs h-28 resize-none outline-none focus:ring-1 focus:ring-[#005bb1] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Link Bukti Dukung */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider block">Link Bukti Dukung (Google Drive, dll)</label>
                            <input 
                                type="text" 
                                value={fileUrl}
                                onChange={(e) => setFileUrl(e.target.value)}
                                disabled={!isTriwulanActive}
                                placeholder="https://drive.google.com/..."
                                className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                        </div>

                        {/* Bottom Metadata Summary Panel */}
                        {selectedIku && (
                            <div className="bg-[#f9f9ff] border border-[#c0c6d6]/20 rounded-xl p-4 text-[11px] text-[#535f71] space-y-1.5">
                                <div><strong className="text-[#181c23]">Formula:</strong> {selectedIku.formula_text || '-'}</div>
                                <div><strong className="text-[#181c23]">Satuan:</strong> {selectedIku.satuan}</div>
                                <div><strong className="text-[#181c23]">Sumber data:</strong> {selectedIku.sumber_data || '-'}</div>

                                {(selectedIku.file_justifikasi || selectedIku.catatan_justifikasi) && (
                                    <div className="pt-2 border-t border-[#c0c6d6]/20 mt-2 flex flex-col items-start gap-2.5">
                                        <strong className="text-[#005bb1] font-bold">Justifikasi Target:</strong>
                                        {selectedIku.catatan_justifikasi && (
                                            <span className="italic text-[#181c23]">"{selectedIku.catatan_justifikasi}"</span>
                                        )}
                                        {selectedIku.file_justifikasi && (
                                            <a 
                                                href={selectedIku.file_justifikasi} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[#005bb1] font-bold hover:underline bg-[#005bb1]/10 px-2.5 py-1 rounded-md text-[10px] transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">description</span>
                                                Unduh File Justifikasi Target
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-[#c0c6d6]/10">
                            <button 
                                type="submit"
                                disabled={!isTriwulanActive}
                                className="bg-[#005bb1] text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] shadow-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Simpan sebagai Draft
                            </button>
                        </div>
                    </form>
                </div>

                {/* Submissions List Card (Always Below Form, Full Width) */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm overflow-hidden p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-[#181c23]">Daftar Capaian yang Telah Diinput</h3>
                            <p className="text-[11px] text-[#717785] mt-0.5">Daftar entri laporan untuk Triwulan {triwulan} - {tahun}.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input 
                                type="text"
                                value={filterIku}
                                onChange={(e) => setFilterIku(e.target.value)}
                                placeholder="Cari IKU..."
                                className="bg-white border border-[#c0c6d6]/30 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#005bb1] w-48"
                            />

                            <button 
                                onClick={handleExportXlsx}
                                className="flex items-center gap-1.5 bg-[#005bb1] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold hover:bg-[#0073dd] transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[16px]">download</span>
                                Export XLSX
                            </button>

                            {streaming && (
                                <span className="text-[9px] text-[#005bb1] bg-[#005bb1]/10 px-2 py-0.5 rounded animate-pulse font-bold">
                                    Streaming...
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-[#c0c6d6]/25 bg-[#f1f3fe]/40 text-[#717785] font-bold uppercase tracking-wider">
                                    <th className="p-3">IKU</th>
                                    <th className="p-3">Indikator</th>
                                    <th className="p-3 text-center">Capaian</th>
                                    <th className="p-3 text-center">Bukti Dukung</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#c0c6d6]/10">
                                {totalItems === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-4 text-center text-[#717785] italic">
                                            {streaming ? 'Memuat data capaian...' : 'Belum ada laporan diinput pada triwulan ini.'}
                                        </td>
                                    </tr>
                                ) : (
                                    currentCapaianList.map(c => (
                                        <tr key={c.id} className="hover:bg-[#f9f9ff]">
                                            <td className="p-3 font-bold text-[#005bb1]">{c.iku || '-'}</td>
                                            <td className="p-3 font-semibold text-[#181c23]">{c.kategori || c.full_kategori || 'Indikator tidak diketahui'}</td>
                                            <td className="p-3 text-center font-bold text-[#181c23]">{c.nilai_capaian} {c.satuan || '%'}</td>
                                            <td className="p-3 text-center">
                                                {c.file_url ? (
                                                    <a 
                                                        href={c.file_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-[#005bb1] hover:text-[#0073dd] inline-flex items-center gap-1 font-bold underline transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">link</span>
                                                        Buka Bukti
                                                    </a>
                                                ) : (
                                                    <span className="text-[#717785] italic">Tidak ada</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusBadgeColor(c.status_validasi)}`}>
                                                    {c.status_validasi}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {isTriwulanActive ? (
                                                    <div className="flex justify-center gap-2">
                                                        <button 
                                                            onClick={() => handleEditFromTable(c)}
                                                            disabled={['DIAJUKAN', 'DIVERIFIKASI', 'DISAHKAN'].includes(c.status_validasi)}
                                                            className="bg-[#ebedf8] text-[#005bb1] px-3 py-1 rounded text-[10px] font-bold hover:bg-[#d6e3ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                                                        >
                                                            Edit
                                                        </button>
                                                        {c.status_validasi === 'DRAFT' && (
                                                            <button 
                                                                onClick={() => handleSubmitForVerification(c.id)}
                                                                className="bg-[#005bb1] text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-[#0073dd] transition-all uppercase"
                                                            >
                                                                Ajukan
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-[#717785] italic font-bold">Terkunci</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer Controls */}
                    {totalItems > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#c0c6d6]/20">
                            <div className="text-[#535f71] text-xs font-semibold">
                                Menampilkan <span className="font-bold text-[#181c23]">{startIndex + 1}</span> sampai <span className="font-bold text-[#181c23]">{endIndex}</span> dari <span className="font-bold text-[#181c23]">{totalItems}</span> data
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
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

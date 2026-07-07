import React, { useState, useEffect } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, usePage } from '@inertiajs/react';

export default function EditCapaian() {
    const user = usePage().props.auth.user;

    const [triwulan, setTriwulan] = useState('Q1');
    const [tahun, setTahun] = useState(2026);
    const [contexts, setContexts] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [capaianList, setCapaianList] = useState([]);
    const [expandedFamily, setExpandedFamily] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form inputs for current active parent indicator (being edited/saved)
    const [pembilang, setPembilang] = useState('');
    const [penyebut, setPenyebut] = useState('1');
    const [catatan, setCatatan] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [subValues, setSubValues] = useState({});

    // Active indicator being edited inside the expanded family
    const [activeEditId, setActiveEditId] = useState(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tw = urlParams.get('triwulan') || 'Q1';
        setTriwulan(tw);
    }, []);

    useEffect(() => {
        loadData();
    }, [triwulan, tahun]);

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/master/contexts').then(res => res.json()),
            fetch('/api/master/iku').then(res => res.json()),
            fetch(`/api/capaian?tahun=${tahun}&triwulan=${triwulan}`).then(res => res.json())
        ])
        .then(([ctxData, ikuData, capData]) => {
            setContexts(ctxData);
            setIndicators(ikuData);
            setCapaianList(capData);
            setLoading(false);
        })
        .catch(err => {
            console.error(err);
            setLoading(false);
        });
    };

    const getCapaian = (idIndikator) => {
        return capaianList.find(c => c.id_indikator === idIndikator);
    };

    // Helper: extract base family key (e.g. IKU 1, IKU 7, IKU 9)
    const getIkuFamily = (ikuObj) => {
        const text = ikuObj.iku || '';
        const match = text.match(/(IKU\s+\d+)/i);
        if (match) {
            return match[1].toUpperCase();
        }
        if (ikuObj.kategori && ikuObj.kategori.toLowerCase().includes('publikasi bereputasi')) {
            return 'IKU 6';
        }
        return 'IKU LAINNYA';
    };

    const getFamilyLabel = (family) => {
        const labels = {
            'IKU 1': 'Kualitas Lulusan (Talenta / AEE PT)',
            'IKU 2': 'Lulusan Berkegiatan di Luar Kampus',
            'IKU 3': 'Mahasiswa Berprestasi di Luar Kampus',
            'IKU 4': 'Kualitas Dosen (Rekognisi & S3)',
            'IKU 5': 'Penerapan Riset & Kerjasama Start-up',
            'IKU 6': 'Publikasi Reputasi Internasional',
            'IKU 7': 'Keterlibatan PT dalam SDGs & World Ranking',
            'IKU 8': 'SDM PT Terlibat dalam Kebijakan',
            'IKU 9': 'Tata Kelola Non-UKT & Alokasi Riset/Lab',
            'IKU 10': 'Zona Integritas (WBK/WBBM)',
            'IKU 11': 'Akuntabilitas & Anti Kekerasan/Korupsi',
            'IKU 12': 'Kesejahteraan Dosen'
        };
        return labels[family] || family;
    };

    const handleStartEdit = (iku) => {
        setActiveEditId(iku.id);
        const currentCap = getCapaian(iku.id);
        if (currentCap) {
            setPembilang(currentCap.pembilang || '0');
            setPenyebut(currentCap.penyebut || '1');
            setCatatan(currentCap.catatan || '');
            setFileUrl(currentCap.file_url || '');
        } else {
            setPembilang('');
            setPenyebut('1');
            setCatatan('');
            setFileUrl('');
        }

        // Initialize child values
        const initialSubs = {};
        const subInds = indicators.filter(i => i.id_sub === iku.id);
        subInds.forEach(sub => {
            const subCap = getCapaian(sub.id);
            initialSubs[sub.id] = {
                pembilang: subCap ? subCap.pembilang : '0',
                penyebut: subCap ? subCap.penyebut : '1',
                catatan: subCap ? subCap.catatan : '',
                file_url: subCap ? subCap.file_url : ''
            };
        });
        setSubValues(initialSubs);
    };

    const handleSubInputChange = (subId, field, value) => {
        setSubValues(prev => ({
            ...prev,
            [subId]: {
                ...prev[subId],
                [field]: value
            }
        }));
    };

    const handleSave = (idIndikator) => {
        const payload = {
            id_indikator: idIndikator,
            kode_unit: user.kode_unit,
            tahun: tahun,
            triwulan: triwulan,
            pembilang: pembilang || '0',
            penyebut: penyebut || '1',
            catatan: catatan,
            file_url: fileUrl
        };

        fetch('/api/capaian', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
                return;
            }

            const subInds = indicators.filter(i => i.id_sub === idIndikator);
            const subPromises = subInds.map(sub => {
                const vals = subValues[sub.id] || { pembilang: '0', penyebut: '1', catatan: '', file_url: '' };
                return fetch('/api/capaian', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
                    },
                    body: JSON.stringify({
                        id_indikator: sub.id,
                        kode_unit: user.kode_unit,
                        tahun: tahun,
                        triwulan: triwulan,
                        pembilang: vals.pembilang || '0',
                        penyebut: vals.penyebut || '1',
                        catatan: vals.catatan,
                        file_url: vals.file_url
                    })
                });
            });

            return Promise.all(subPromises);
        })
        .then(() => {
            alert('Capaian berhasil disimpan!');
            loadData();
            setActiveEditId(null);
        })
        .catch(err => {
            console.error(err);
            alert('Gagal menyimpan capaian.');
        });
    };

    // Grouping indicators by base family
    const familyGroups = {};
    const familyNames = [
        'IKU 1', 'IKU 2', 'IKU 3', 'IKU 4', 'IKU 5', 'IKU 6',
        'IKU 7', 'IKU 8', 'IKU 9', 'IKU 10', 'IKU 11', 'IKU 12'
    ];
    
    familyNames.forEach(name => {
        familyGroups[name] = [];
    });

    indicators.forEach(ind => {
        const family = getIkuFamily(ind);
        if (familyGroups[family]) {
            familyGroups[family].push(ind);
        } else {
            if (!familyGroups['IKU LAINNYA']) {
                familyGroups['IKU LAINNYA'] = [];
            }
            familyGroups['IKU LAINNYA'].push(ind);
        }
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'DISAHKAN': return 'bg-green-100 text-green-700';
            case 'DIVERIFIKASI': return 'bg-blue-100 text-blue-700';
            case 'DIAJUKAN': return 'bg-orange-100 text-orange-700';
            case 'DRAFT': return 'bg-[#d6e3ff] text-[#00468a]';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    return (
        <AuthenticatedLayout pageTitle={`Isi Capaian Kinerja - Triwulan ${triwulan}`}>
            <Head title={`Isi Capaian ${triwulan}`} />

            <div className="absolute right-8 top-3 flex items-center gap-3 z-50">
                <Link href={route('reporting')} className="bg-[#005bb1] text-white px-5 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] transition-all uppercase tracking-wider">
                    Kembali Ke Siklus
                </Link>
            </div>

            {/* Reporting Unit (Unit Pelaporan) automatically bound */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-[#c0c6d6]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block">UNIT PELAPORAN</span>
                    <span className="text-sm font-bold text-[#181c23]">{user.kode_unit} - {user.name}</span>
                </div>
                <div>
                    <span className="text-[10px] font-bold text-[#717785] uppercase tracking-wider block text-left sm:text-right">ROLE AKSES</span>
                    <span className="text-xs font-bold text-[#005bb1] bg-[#005bb1]/10 px-3 py-1 rounded-full block mt-1">{user.role}</span>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <span className="material-symbols-outlined animate-spin text-[#005bb1] text-3xl">progress_activity</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.keys(familyGroups).map(family => {
                        const familyIkus = familyGroups[family];
                        if (familyIkus.length === 0) return null;

                        // Only get top-level indicators for this family inside accordion header list
                        const topLevelFamilyIkus = familyIkus.filter(i => !i.id_sub);
                        const isExpanded = expandedFamily === family;

                        return (
                            <div key={family} className="bg-white rounded-xl shadow-sm border border-[#c0c6d6]/20 overflow-hidden hover:border-[#005bb1]/30 transition-all">
                                {/* Accordion Header (Domain IKU) */}
                                <div 
                                    onClick={() => setExpandedFamily(isExpanded ? null : family)}
                                    className="flex items-center justify-between p-6 cursor-pointer bg-[#f9f9ff]/70 border-b border-[#c0c6d6]/10"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-[#005bb1]/10 text-[#005bb1] flex items-center justify-center flex-shrink-0 font-bold text-sm">
                                            {family.replace('IKU ', '')}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-[#181c23]">{family}</h4>
                                            <p className="text-[11px] text-[#717785] font-semibold mt-0.5">{getFamilyLabel(family)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] bg-[#f1f3fe] text-[#535f71] font-bold px-3 py-1 rounded-full">
                                            {topLevelFamilyIkus.length} Indikator
                                        </span>
                                        <span className={`material-symbols-outlined text-[#717785] transition-transform ${isExpanded ? 'rotate-180 text-[#005bb1]' : ''}`}>
                                            expand_more
                                        </span>
                                    </div>
                                </div>

                                {/* Accordion Body */}
                                {isExpanded && (
                                    <div className="p-6 bg-white divide-y divide-[#c0c6d6]/10 space-y-6">
                                        {topLevelFamilyIkus.map(iku => {
                                            const subInds = familyIkus.filter(i => i.id_sub === iku.id);
                                            const currentCap = getCapaian(iku.id);
                                            const isEditing = activeEditId === iku.id;

                                            const realization = pembilang && penyebut && Number(penyebut) !== 0 
                                                ? ((Number(pembilang) / Number(penyebut)) * 100).toFixed(2)
                                                : '0.00';

                                            return (
                                                <div key={iku.id} className="pt-6 first:pt-0 space-y-4">
                                                    {/* Header Indikator */}
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold bg-[#f1f3fe] text-[#005bb1] px-2 py-0.5 rounded uppercase">
                                                                    {iku.iku}
                                                                </span>
                                                                {currentCap && (
                                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusColor(currentCap.status_validasi)}`}>
                                                                        {currentCap.status_validasi === 'DRAFT' ? 'IN PROGRESS' : currentCap.status_validasi}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h5 className="text-xs font-bold text-[#181c23]">{iku.full_kategori}</h5>
                                                            <p className="text-[10px] text-[#717785] font-semibold">
                                                                Satuan: {iku.satuan} • Target 2026: {iku.target || '-'}
                                                                {currentCap && ` • Capaian Saat Ini: ${currentCap.nilai_capaian}%`}
                                                            </p>
                                                        </div>

                                                        {!isEditing && (
                                                            <button 
                                                                onClick={() => handleStartEdit(iku)}
                                                                className="bg-[#005bb1] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#0073dd] shadow-sm uppercase tracking-wider"
                                                            >
                                                                Isi Capaian
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Edit Form Panel */}
                                                    {isEditing && (
                                                        <div className="bg-[#f9f9ff] border border-[#c0c6d6]/20 rounded-xl p-6 space-y-6">
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                                <div className="space-y-4">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Capaian Realisasi (Pembilang/Penyebut)</label>
                                                                        <div className="bg-white border border-[#c0c6d6]/20 rounded-xl p-4 flex items-center justify-between gap-4 relative">
                                                                            <div className="text-3xl font-extrabold text-[#005bb1] flex items-center">
                                                                                <span>{realization}</span>
                                                                                <span className="text-base text-[#717785] ml-1">%</span>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <input 
                                                                                    type="number"
                                                                                    value={pembilang}
                                                                                    onChange={(e) => setPembilang(e.target.value)}
                                                                                    placeholder="Pembilang"
                                                                                    className="w-20 text-center bg-white border border-[#c0c6d6]/30 rounded px-1.5 py-1 text-xs"
                                                                                />
                                                                                <input 
                                                                                    type="number"
                                                                                    value={penyebut}
                                                                                    onChange={(e) => setPenyebut(e.target.value)}
                                                                                    placeholder="Penyebut"
                                                                                    className="w-20 text-center bg-white border border-[#c0c6d6]/30 rounded px-1.5 py-1 text-xs"
                                                                                />
                                                                            </div>
                                                                            <span className="absolute bottom-1 left-4 text-[9px] text-[#717785] font-semibold">
                                                                                Target: {iku.target}%
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="space-y-1">
                                                                        <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Link Bukti Dukung (Google Drive, dll)</label>
                                                                        <input 
                                                                            type="text" 
                                                                            value={fileUrl}
                                                                            onChange={(e) => setFileUrl(e.target.value)}
                                                                            placeholder="https://drive.google.com/..."
                                                                            className="w-full bg-white border border-[#c0c6d6] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[#005bb1]"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Faktor Pendukung & Analisis Hambatan</label>
                                                                    <textarea 
                                                                        value={catatan}
                                                                        onChange={(e) => setCatatan(e.target.value)}
                                                                        placeholder="Masukkan analisis detail capaian..."
                                                                        className="w-full bg-white border border-[#c0c6d6] rounded-xl p-3 text-xs h-[140px] resize-none outline-none focus:ring-1 focus:ring-[#005bb1]"
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Nested Sub-Indicators inside edit box */}
                                                            {subInds.length > 0 && (
                                                                <div className="pt-4 border-t border-[#c0c6d6]/10 space-y-3">
                                                                    <h6 className="text-[10px] font-bold text-[#181c23] uppercase tracking-wider">Sub-Indikator Turunan</h6>
                                                                    <div className="overflow-hidden border border-[#c0c6d6]/10 rounded-xl bg-white">
                                                                        <table className="w-full text-left border-collapse text-xs">
                                                                            <thead>
                                                                                <tr className="bg-[#f1f3fe]/40 border-b border-[#c0c6d6]/20">
                                                                                    <th className="p-3 font-bold text-[#535f71]">Sub Indikator</th>
                                                                                    <th className="p-3 text-center w-20">Satuan</th>
                                                                                    <th className="p-3 text-center w-20">Baseline</th>
                                                                                    <th className="p-3 text-center w-20">Target</th>
                                                                                    <th className="p-3 text-center w-28">Pembilang</th>
                                                                                    <th className="p-3 text-center w-28">Penyebut</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-[#c0c6d6]/10">
                                                                                {subInds.map(sub => {
                                                                                    const vals = subValues[sub.id] || { pembilang: '0', penyebut: '1' };
                                                                                    return (
                                                                                        <tr key={sub.id} className="hover:bg-[#f9f9ff]">
                                                                                            <td className="p-3 font-semibold text-[#181c23]">{sub.kategori}</td>
                                                                                            <td className="p-3 text-center text-[#535f71]">{sub.satuan}</td>
                                                                                            <td className="p-3 text-center text-[#535f71]">{sub.base_line || '-'}</td>
                                                                                            <td className="p-3 text-center text-[#535f71]">{sub.target || '-'}</td>
                                                                                            <td className="p-3 text-center">
                                                                                                <input 
                                                                                                    type="number"
                                                                                                    value={vals.pembilang}
                                                                                                    onChange={(e) => handleSubInputChange(sub.id, 'pembilang', e.target.value)}
                                                                                                    className="w-16 text-center bg-white border border-[#c0c6d6]/30 rounded px-1 py-0.5 text-xs font-bold"
                                                                                                />
                                                                                            </td>
                                                                                            <td className="p-3 text-center">
                                                                                                <input 
                                                                                                    type="number"
                                                                                                    value={vals.penyebut}
                                                                                                    onChange={(e) => handleSubInputChange(sub.id, 'penyebut', e.target.value)}
                                                                                                    className="w-16 text-center bg-white border border-[#c0c6d6]/30 rounded px-1 py-0.5 text-xs font-bold"
                                                                                                />
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="pt-4 border-t border-[#c0c6d6]/10 flex justify-end gap-3">
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setActiveEditId(null)}
                                                                    className="px-5 py-2 text-xs font-bold border border-[#c0c6d6] text-[#535f71] rounded-lg hover:bg-[#f1f3fe]"
                                                                >
                                                                    Batal
                                                                </button>
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => handleSave(iku.id)}
                                                                    className="px-6 py-2 text-xs font-bold bg-[#005bb1] text-white rounded-lg hover:bg-[#0073dd] shadow-sm uppercase tracking-wider"
                                                                >
                                                                    Simpan Capaian
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </AuthenticatedLayout>
    );
}

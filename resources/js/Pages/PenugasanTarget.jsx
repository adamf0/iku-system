import React, { useState, useEffect, useMemo } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import axios from 'axios';
import SearchableSelect from '@/Components/SearchableSelect';
import Modal from '@/Components/Modal';
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
    const [years, setYears] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [streaming, setStreaming] = useState(false);

    // Form states
    const [selectedUnits, setSelectedUnits] = useState([]);
    const [selectedYear, setSelectedYear] = useState('2026');
    const [checkedIndicators, setCheckedIndicators] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(null);
    const [editingGroupInfo, setEditingGroupInfo] = useState(null);

    // Table search & advanced filters
    const [filterUnit, setFilterUnit] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const [filterIku, setFilterIku] = useState('');
    const [filterJenis, setFilterJenis] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);

    const [checklistTab, setChecklistTab] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Accordion expand states for grouped IKUs in table
    const [expandedGroupKeys, setExpandedGroupKeys] = useState({});

    // Custom Confirmation Modal state
    const [confirmModalState, setConfirmModalState] = useState({
        show: false,
        title: '',
        message: '',
        confirmText: 'Hapus',
        type: 'danger',
        onConfirm: null
    });

    // Google Drive History Modal state
    const [gdriveModalState, setGdriveModalState] = useState({
        show: false,
        item: null,
        group: null,
        isRetrying: false
    });

    const closeConfirmModal = () => {
        setConfirmModalState(prev => ({ ...prev, show: false }));
    };

    const handleOpenGdriveModal = (item, group) => {
        setGdriveModalState({
            show: true,
            item,
            group,
            isRetrying: false
        });
    };

    const handleCloseGdriveModal = () => {
        setGdriveModalState(prev => ({ ...prev, show: false }));
    };

    const handleRetryGdriveFolder = async () => {
        if (!gdriveModalState.item || !gdriveModalState.group) return;
        setGdriveModalState(prev => ({ ...prev, isRetrying: true }));

        try {
            await axios.post('/api/penugasan/retry-gdrive-folder', {
                fakultas_unit: gdriveModalState.item.fakultas_unit,
                tahun: gdriveModalState.item.tahun,
                id_indikator: gdriveModalState.item.id_indikator
            });
            
            loadStreamedAssignments();

            setGdriveModalState(prev => {
                if (!prev.item) return prev;
                let currentHistory = [];
                if (typeof prev.item.gdrive_history === 'string') {
                    try { currentHistory = JSON.parse(prev.item.gdrive_history); } catch(e){}
                } else if (Array.isArray(prev.item.gdrive_history)) {
                    currentHistory = prev.item.gdrive_history;
                }
                const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
                const updatedHistory = [
                    ...currentHistory,
                    {
                        status: 'WAITING',
                        timestamp: nowStr,
                        note: 'User meminta retry manual pembuatan folder Google Drive'
                    }
                ];

                return {
                    ...prev,
                    isRetrying: false,
                    item: {
                        ...prev.item,
                        gdrive_status: 'WAITING',
                        gdrive_history: JSON.stringify(updatedHistory)
                    }
                };
            });
        } catch (err) {
            console.error('Retry error:', err);
            alert('Gagal memproses ulang folder Google Drive.');
            setGdriveModalState(prev => ({ ...prev, isRetrying: false }));
        }
    };

    const renderFolderStatusBadge = (item, group) => {
        const status = (item.gdrive_status || 'WAITING').toUpperCase();

        if (status === 'CREATED') {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGdriveModal(item, group);
                    }}
                    className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider transition-all cursor-pointer flex-shrink-0"
                    title="Folder Google Drive Berhasil Dibuat. Klik untuk lihat riwayat / link"
                >
                    <span className="material-symbols-outlined text-[12px] text-emerald-600">folder</span>
                    <span>Created</span>
                </button>
            );
        } else if (status === 'FAILED') {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGdriveModal(item, group);
                    }}
                    className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider transition-all cursor-pointer flex-shrink-0"
                    title="Gagal Membuat Folder. Klik untuk detail & retry"
                >
                    <span className="material-symbols-outlined text-[12px] text-red-600">error</span>
                    <span>Failed</span>
                </button>
            );
        } else {
            return (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleOpenGdriveModal(item, group);
                    }}
                    className="inline-flex items-center gap-1 text-[9px] font-extrabold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider transition-all cursor-pointer flex-shrink-0 animate-pulse"
                    title="Folder Sedang Dalam Antrean/Proses. Klik untuk lihat riwayat"
                >
                    <span className="material-symbols-outlined text-[12px] text-amber-600 animate-spin">sync</span>
                    <span>Waiting</span>
                </button>
            );
        }
    };

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
            fetch('/api/master/iku').then(res => res.json()),
            fetch('/api/master/tahun').then(res => res.json())
        ])
        .then(([unitsData, ctxData, ikuData, yearsData]) => {
            setUnits(unitsData);
            setContexts(ctxData);
            setIndicators(ikuData);
            setYears(yearsData || []);
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

    // Real-time EventSource / WS stream for GDrive folder status badges
    useEffect(() => {
        const gdriveSource = new EventSource('/api/penugasan/gdrive-stream');

        gdriveSource.addEventListener('gdrive_status_update', (e) => {
            try {
                const logs = JSON.parse(e.data);
                if (!Array.isArray(logs) || logs.length === 0) return;

                const updateMap = new Map();
                logs.forEach(log => {
                    updateMap.set(`${log.fakultas_unit}_${log.tahun}_${log.id_indikator}`, log);
                });

                setAssignments(prevItems => {
                    let changed = false;
                    const newItems = prevItems.map(item => {
                        const key = `${item.fakultas_unit}_${item.tahun}_${item.id_indikator}`;
                        const log = updateMap.get(key);
                        if (log) {
                            if (
                                item.gdrive_status !== log.status ||
                                item.gdrive_url !== log.folder_url ||
                                item.gdrive_error !== log.error_message ||
                                JSON.stringify(item.gdrive_history) !== JSON.stringify(log.history)
                            ) {
                                changed = true;
                                return {
                                    ...item,
                                    gdrive_status: log.status,
                                    gdrive_url: log.folder_url,
                                    gdrive_error: log.error_message,
                                    gdrive_history: log.history
                                };
                            }
                        }
                        return item;
                    });
                    return changed ? newItems : prevItems;
                });

                setGdriveModalState(prevModal => {
                    if (!prevModal.show || !prevModal.item) return prevModal;
                    const openKey = `${prevModal.item.fakultas_unit}_${prevModal.item.tahun}_${prevModal.item.id_indikator}`;
                    const log = updateMap.get(openKey);
                    if (log && (prevModal.item.gdrive_status !== log.status || prevModal.item.gdrive_url !== log.folder_url || JSON.stringify(prevModal.item.gdrive_history) !== JSON.stringify(log.history))) {
                        return {
                            ...prevModal,
                            item: {
                                ...prevModal.item,
                                gdrive_status: log.status,
                                gdrive_url: log.folder_url,
                                gdrive_error: log.error_message,
                                gdrive_history: log.history
                            }
                        };
                    }
                    return prevModal;
                });
            } catch (err) {
                console.error("GDrive status stream parse error:", err);
            }
        });

        gdriveSource.onerror = () => {
            // EventSource auto-reconnects
        };

        const removeStartListener = router.on('start', () => {
            gdriveSource.close();
        });

        return () => {
            gdriveSource.close();
            if (typeof removeStartListener === 'function') {
                removeStartListener();
            }
        };
    }, []);



    const fetchAssignmentsForCheckbox = (unitId, yearVal) => {
        fetch(`/api/master/iku/assigned?unit=${unitId}&tahun=${yearVal}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setCheckedIndicators(data.map(i => Number(i.id)));
                }
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

        source.addEventListener('batch', (event) => {
            try {
                const rows = JSON.parse(event.data);
                if (Array.isArray(rows)) {
                    tempRows = tempRows.concat(rows);
                    setAssignments([...tempRows]);
                }
            } catch (err) {
                console.error("Parse batch error:", err);
            }
        });

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

    // Grouping assignments by (fakultas_unit + tahun)
    const groupedAssignments = useMemo(() => {
        const map = new Map();

        let filtered = assignments;
        if (filterIku && filterIku.trim() !== '') {
            const rawKw = filterIku.trim();
            const lastChar = rawKw.slice(-1);
            const isAlnum = /[a-zA-Z0-9]/.test(lastChar);
            const escaped = rawKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const patternStr = isAlnum ? `${escaped}([^a-zA-Z0-9]|$)` : `${escaped}($|[^a-zA-Z0-9])`;
            
            try {
                const regex = new RegExp(patternStr, 'i');
                filtered = assignments.filter(item => {
                    const ikuStr = item.iku || '';
                    const catStr = item.full_kategori || item.kategori || '';
                    const unitStr = item.nama_unit || '';
                    return regex.test(ikuStr) || regex.test(catStr) || unitStr.toLowerCase().includes(rawKw.toLowerCase());
                });
            } catch (e) {
                console.error("Regex filter error:", e);
            }
        }

        filtered.forEach(item => {
            const key = `${item.fakultas_unit}_${item.tahun}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    fakultas_unit: item.fakultas_unit,
                    nama_unit: item.nama_unit,
                    type_unit: item.type_unit,
                    jenjang: item.jenjang,
                    tahun: item.tahun,
                    items: []
                });
            }
            map.get(key).items.push(item);
        });
        return Array.from(map.values());
    }, [assignments, filterIku]);

    const handleCheckboxChange = (id) => {
        const numId = Number(id);
        if (checkedIndicators.includes(numId)) {
            setCheckedIndicators(checkedIndicators.filter(i => i !== numId));
        } else {
            setCheckedIndicators([...checkedIndicators, numId]);
        }
    };

    const handleGroupToggle = (contextId) => {
        const contextIndicatorIds = indicators
            .filter(i => {
                if (i.id_konteks !== contextId) return false;
                if (checklistTab !== 'ALL' && (i.jenis_iku || 'WAJIB').toUpperCase() !== checklistTab) return false;
                return true;
            })
            .map(i => Number(i.id));

        const allChecked = contextIndicatorIds.every(id => checkedIndicators.includes(id));

        if (allChecked) {
            setCheckedIndicators(checkedIndicators.filter(id => !contextIndicatorIds.includes(id)));
        } else {
            const newChecked = new Set([...checkedIndicators, ...contextIndicatorIds]);
            setCheckedIndicators(Array.from(newChecked));
        }
    };

    const handleResetForm = () => {
        setSelectedUnits([]);
        setCheckedIndicators([]);
        setEditingGroupInfo(null);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!selectedUnits || selectedUnits.length === 0 || !selectedYear) {
            alert('Silakan pilih minimal 1 Fakultas / Prodi / Unit Kerja dan tahun penugasan.');
            return;
        }

        setIsSaving(true);
        const total = selectedUnits.length;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < total; i++) {
            const unitId = selectedUnits[i];
            setSaveProgress({ current: i + 1, total });

            try {
                await axios.post('/api/penugasan', {
                    fakultas_unit: unitId,
                    tahun: selectedYear,
                    id_indikator: checkedIndicators
                });
                successCount++;
            } catch (err) {
                console.error(`Gagal menyimpan penugasan untuk unit ${unitId}:`, err);
                failCount++;
            }
        }

        setIsSaving(false);
        setSaveProgress(null);

        if (failCount === 0) {
            alert(`Penugasan target berhasil disimpan untuk ${successCount} unit!`);
            handleResetForm();
        } else {
            alert(`Proses simpan selesai. Berhasil: ${successCount} unit, Gagal: ${failCount} unit.`);
        }

        loadStreamedAssignments();
    };

    // Load group assignment for editing inside the checklist form
    const handleEditGroup = (group) => {
        setSelectedUnits([group.fakultas_unit]);
        setSelectedYear(group.tahun.toString());
        setEditingGroupInfo({
            unitId: group.fakultas_unit,
            unitName: group.nama_unit,
            tahun: group.tahun
        });

        // Immediately populate checked indicators from group items in memory
        if (group && group.items && group.items.length > 0) {
            const assignedIds = group.items.map(item => Number(item.id_indikator));
            setCheckedIndicators(assignedIds);
        }

        fetchAssignmentsForCheckbox(group.fakultas_unit, group.tahun);
        
        // Smooth scroll to top form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Delete a single specific assignment with Modal Confirmation
    const handleDeleteSingleAssignment = (item, group, mode) => {
        const isHard = mode === 'hard';
        const ikuName = item.full_kategori || item.iku;

        setConfirmModalState({
            show: true,
            title: isHard ? 'Hapus Permanen Penugasan' : 'Hapus Penugasan IKU',
            message: `Apakah Anda yakin ingin ${isHard ? 'menghapus secara PERMANEN' : 'menghapus sementara'} penugasan "${ikuName}" dari ${group.nama_unit} (${group.tahun})?`,
            confirmText: isHard ? 'Hapus Permanen' : 'Hapus Penugasan',
            type: 'danger',
            onConfirm: () => {
                axios.delete(`/api/penugasan/${item.id}?mode=${mode}`)
                .then(res => {
                    if (editingGroupInfo && editingGroupInfo.unitId === group.fakultas_unit && editingGroupInfo.tahun === group.tahun) {
                        setCheckedIndicators(prev => prev.filter(id => id !== item.id_indikator));
                    }
                    loadStreamedAssignments();
                    closeConfirmModal();
                })
                .catch(err => {
                    console.error(err);
                    alert('Gagal menghapus penugasan.');
                    closeConfirmModal();
                });
            }
        });
    };

    // Restore single assignment with Modal Confirmation
    const handleRestoreSingleAssignment = (item) => {
        const ikuName = item.full_kategori || item.iku;
        setConfirmModalState({
            show: true,
            title: 'Pulihkan Penugasan',
            message: `Apakah Anda yakin ingin memulihkan penugasan "${ikuName}"?`,
            confirmText: 'Pulihkan',
            type: 'success',
            onConfirm: () => {
                axios.post(`/api/penugasan/${item.id}/restore`)
                .then(res => {
                    loadStreamedAssignments();
                    closeConfirmModal();
                })
                .catch(err => {
                    console.error(err);
                    alert('Gagal memulihkan penugasan.');
                    closeConfirmModal();
                });
            }
        });
    };

    // Delete all assignments in a group with Modal Confirmation
    const handleDeleteGroup = (group, mode) => {
        const isHard = mode === 'hard';
        setConfirmModalState({
            show: true,
            title: isHard ? 'Hapus Permanen Seluruh Group' : 'Hapus Group Penugasan',
            message: `Apakah Anda yakin ingin ${isHard ? 'menghapus secara PERMANEN' : 'menghapus sementara'} SELURUH (${group.items.length}) penugasan IKU untuk "${group.nama_unit}" pada tahun ${group.tahun}?`,
            confirmText: isHard ? 'Hapus Permanen Group' : 'Hapus Seluruh Group',
            type: 'danger',
            onConfirm: () => {
                axios.post('/api/penugasan/delete-group', {
                    fakultas_unit: group.fakultas_unit,
                    tahun: group.tahun,
                    mode
                })
                .then(res => {
                    if (editingGroupInfo && editingGroupInfo.unitId === group.fakultas_unit && editingGroupInfo.tahun === group.tahun) {
                        handleResetForm();
                    }
                    loadStreamedAssignments();
                    closeConfirmModal();
                })
                .catch(err => {
                    console.error(err);
                    alert('Gagal menghapus penugasan kelompok.');
                    closeConfirmModal();
                });
            }
        });
    };

    // Restore soft-deleted group assignment with Modal Confirmation
    const handleRestoreGroup = (group) => {
        setConfirmModalState({
            show: true,
            title: 'Pulihkan Seluruh Group Penugasan',
            message: `Apakah Anda yakin ingin memulihkan SELURUH (${group.items.length}) penugasan IKU untuk "${group.nama_unit}" pada tahun ${group.tahun}?`,
            confirmText: 'Pulihkan Group',
            type: 'success',
            onConfirm: () => {
                axios.post('/api/penugasan/restore-group', {
                    fakultas_unit: group.fakultas_unit,
                    tahun: group.tahun
                })
                .then(res => {
                    loadStreamedAssignments();
                    closeConfirmModal();
                })
                .catch(err => {
                    console.error(err);
                    alert('Gagal memulihkan penugasan kelompok.');
                    closeConfirmModal();
                });
            }
        });
    };

    const toggleExpandGroup = (key) => {
        setExpandedGroupKeys(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    return (
        <AuthenticatedLayout pageTitle="Penugasan Capaian Target">
            <Head title="Penugasan Capaian Target - IKU Portal" />

            <div className="space-y-8">
                {/* Custom Confirmation Modal */}
                <Modal show={confirmModalState.show} onClose={closeConfirmModal} maxWidth="md">
                    <div className="p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                confirmModalState.type === 'danger' ? 'bg-[#fff0ee] text-[#ba1a1a]' : 'bg-[#e8f5e9] text-green-700'
                            }`}>
                                <span className="material-symbols-outlined text-[20px]">
                                    {confirmModalState.type === 'danger' ? 'warning' : 'restore_from_trash'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-[#181c23]">
                                    {confirmModalState.title}
                                </h3>
                                <p className="text-xs text-[#535f71] mt-0.5">
                                    Konfirmasi tindakan penugasan.
                                </p>
                            </div>
                        </div>

                        <div className="text-xs text-[#181c23] leading-relaxed bg-[#f9f9ff] p-3.5 rounded-xl border border-[#c0c6d6]/20">
                            {confirmModalState.message}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={closeConfirmModal}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-[#535f71] bg-[#ebedf8] hover:bg-[#c0c6d6] transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirmModalState.onConfirm) {
                                        confirmModalState.onConfirm();
                                    }
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all uppercase tracking-wider shadow-sm cursor-pointer ${
                                    confirmModalState.type === 'danger'
                                        ? 'bg-[#ba1a1a] hover:bg-[#a11414]'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {confirmModalState.confirmText}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* Modal History Google Drive */}
                <Modal show={gdriveModalState.show} onClose={handleCloseGdriveModal} maxWidth="lg">
                    {gdriveModalState.item && (
                        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-h-[85vh] overflow-y-auto">
                            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#c0c6d6]/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[#005bb1]/10 text-[#005bb1] flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-[24px]">folder_open</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-extrabold text-[#181c23]">
                                            Riwayat Folder Google Drive
                                        </h3>
                                        <p className="text-xs text-[#535f71]">
                                            {gdriveModalState.group?.nama_unit} &bull; Tahun {gdriveModalState.item.tahun}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseGdriveModal}
                                    className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-all cursor-pointer flex-shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>

                            {/* Detail Indikator & Path */}
                            <div className="bg-[#f9f9ff] p-3.5 sm:p-4 rounded-xl border border-[#c0c6d6]/20 space-y-3">
                                <div>
                                    <span className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Indikator (IKU)</span>
                                    <span className="text-xs font-bold text-[#181c23] block mt-0.5">
                                        {gdriveModalState.item.full_kategori || gdriveModalState.item.iku}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Struktur Path Google Drive</span>
                                    <code className="text-[11px] font-mono bg-white px-2.5 py-1.5 rounded border border-[#c0c6d6]/30 text-[#005bb1] block mt-1 break-all leading-relaxed whitespace-normal">
                                        /iku/{gdriveModalState.item.tahun}/[TW1-4]/{gdriveModalState.item.iku}/{gdriveModalState.group?.nama_unit}
                                    </code>
                                </div>
                            </div>

                            {/* Direct Drive URL Button if Created */}
                            {gdriveModalState.item.gdrive_url && (
                                <div className="bg-emerald-50 border border-emerald-200/80 p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-emerald-800 text-xs font-semibold">
                                        <span className="material-symbols-outlined text-[20px] text-emerald-600 flex-shrink-0">check_circle</span>
                                        <span>Folder Google Drive unit telah dibuat.</span>
                                    </div>
                                    <a
                                        href={gdriveModalState.item.gdrive_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer flex-shrink-0 w-full sm:w-auto"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                        <span>Buka Google Drive</span>
                                    </a>
                                </div>
                            )}

                            {/* Timeline History */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-[#181c23] uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-[#005bb1]">history</span>
                                    Timeline Status Pembuatan Folder
                                </h4>

                                {(() => {
                                    let historyList = [];
                                    const rawHistory = gdriveModalState.item.gdrive_history;
                                    if (typeof rawHistory === 'string') {
                                        try { historyList = JSON.parse(rawHistory); } catch(e){}
                                    } else if (Array.isArray(rawHistory)) {
                                        historyList = rawHistory;
                                    }

                                    if (!historyList || historyList.length === 0) {
                                        return (
                                            <div className="p-4 text-center text-xs text-gray-500 italic bg-[#f9f9ff] rounded-xl border border-dashed border-[#c0c6d6]/30">
                                                Belum ada log riwayat folder.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#c0c6d6]/30 max-h-[30vh] overflow-y-auto pr-1">
                                            {historyList.map((log, idx) => {
                                                const st = (log.status || '').toUpperCase();
                                                let badgeBg = 'bg-amber-100 text-amber-700';
                                                let dotBg = 'bg-amber-500';
                                                if (st === 'CREATED') {
                                                    badgeBg = 'bg-emerald-100 text-emerald-700';
                                                    dotBg = 'bg-emerald-500';
                                                } else if (st === 'FAILED') {
                                                    badgeBg = 'bg-red-100 text-red-700';
                                                    dotBg = 'bg-red-500';
                                                }

                                                return (
                                                    <div key={idx} className="relative flex items-start gap-3">
                                                        <div className={`absolute -left-[17px] top-1.5 w-2.5 h-2.5 rounded-full ${dotBg} ring-4 ring-white`} />
                                                        <div className="bg-[#f9f9ff] p-3 rounded-xl border border-[#c0c6d6]/20 flex-1 space-y-1 text-xs">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${badgeBg}`}>
                                                                    {log.status}
                                                                </span>
                                                                <span className="text-[10px] text-[#717785] font-mono">
                                                                    {log.timestamp}
                                                                </span>
                                                            </div>
                                                            <p className="text-[#181c23] font-medium leading-relaxed">
                                                                {log.note || log.message || '-'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Footer Action */}
                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#c0c6d6]/20">
                                <button
                                    type="button"
                                    onClick={handleCloseGdriveModal}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#535f71] bg-[#ebedf8] hover:bg-[#c0c6d6] transition-all uppercase tracking-wider cursor-pointer w-full sm:w-auto text-center"
                                >
                                    Tutup
                                </button>

                                <button
                                    type="button"
                                    onClick={handleRetryGdriveFolder}
                                    disabled={gdriveModalState.isRetrying}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#005bb1] hover:bg-[#0073dd] transition-all uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                                >
                                    {gdriveModalState.isRetrying ? (
                                        <>
                                            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                            <span>Memproses Retry...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                                            <span>Retry Buat Folder GDrive</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </Modal>

                {/* Form Assignment Panel (Always Full Width at the top) */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#c0c6d6]/15">
                        <div>
                            <h3 className="text-base font-extrabold text-[#005bb1] uppercase tracking-wider">
                                {editingGroupInfo ? `Edit Penugasan IKU: ${editingGroupInfo.unitName} (${editingGroupInfo.tahun})` : 'Form Penugasan IKU ke Unit'}
                            </h3>
                            <p className="text-xs text-[#535f71] mt-1">
                                {editingGroupInfo 
                                    ? 'Centang/hapus centang indikator IKU yang ditugaskan untuk unit ini lalu klik Simpan.' 
                                    : 'Pilih unit pelapor, tahun, dan checklist indikator yang ingin ditugaskan.'}
                            </p>
                        </div>
                        {editingGroupInfo && (
                            <button
                                type="button"
                                onClick={handleResetForm}
                                className="bg-[#ebedf8] text-[#535f71] hover:bg-[#c0c6d6] text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                                <span>Batal Edit</span>
                            </button>
                        )}
                    </div>
                    
                    <form onSubmit={handleSave} className="space-y-6">
                        {/* Indicators checklist grouped by Context */}
                        <div className="space-y-6">
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

                                    const checkedInGroup = ctxIkus.filter(i => checkedIndicators.includes(Number(i.id)));
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
                                                            checked={checkedIndicators.includes(Number(iku.id))}
                                                            onChange={() => handleCheckboxChange(Number(iku.id))}
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

                        <div className="border-t border-[#c0c6d6]/10 pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Fakultas Unit */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Fakultas / Prodi / Unit Kerja</label>
                                <SearchableSelect 
                                    options={buildGroupedUnitOptions(units, '-- Pilih Fakultas / Prodi / Unit --')}
                                    value={selectedUnits}
                                    onChange={(vals) => setSelectedUnits(vals)}
                                    isMulti={true}
                                    placeholder="-- Pilih Fakultas / Prodi / Unit --"
                                    searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                                />
                            </div>

                            {/* Tahun */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-[#535f71] uppercase tracking-wider block">Tahun Penugasan</label>
                                <SearchableSelect 
                                    options={years.map(y => ({ id: String(y.tahun), label: String(y.tahun) }))}
                                    value={selectedYear}
                                    onChange={(val) => setSelectedYear(val)}
                                    placeholder="-- Pilih Tahun --"
                                    searchPlaceholder="Cari Tahun..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#c0c6d6]/10 flex items-center justify-end gap-3">
                            {isSaving && saveProgress && (
                                <span className="text-xs font-bold text-[#005bb1] bg-[#005bb1]/10 px-3 py-1.5 rounded-lg animate-pulse">
                                    Menyimpan {saveProgress.current} dari {saveProgress.total} unit...
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleResetForm}
                                className="bg-[#ebedf8] text-[#535f71] hover:bg-[#c0c6d6] px-4 py-2.5 rounded-lg text-xs font-bold transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Reset
                            </button>
                            <button 
                                type="submit"
                                disabled={isSaving}
                                className="bg-[#005bb1] text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0073dd] shadow-sm uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                            >
                                {isSaving ? (
                                    <>
                                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    editingGroupInfo ? 'Update Penugasan Group' : 'Simpan Penugasan'
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Table Data Panel (Grouped per Unit & Tahun) */}
                <div className="bg-white rounded-2xl border border-[#c0c6d6]/20 shadow-sm p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="text-sm font-bold text-[#181c23]">
                                {showDeleted ? 'Data Penugasan Terhapus (Grouped)' : 'Daftar Penugasan IKU per Unit & Tahun'}
                            </h3>
                            <p className="text-[11px] text-[#717785] mt-0.5">Dikelompokkan berdasarkan Unit Pelapor dan Tahun Penugasan.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Toggle Show Deleted Button */}
                            <button 
                                onClick={() => setShowDeleted(!showDeleted)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider cursor-pointer ${
                                    showDeleted 
                                        ? 'bg-[#ba1a1a] text-white hover:bg-[#a11414]' 
                                        : 'bg-[#ebedf8] text-[#535f71] hover:bg-[#c0c6d6]'
                                }`}
                            >
                                {showDeleted ? 'Tampilkan Aktif' : 'Show Deleted'}
                            </button>

                            {streaming && (
                                <span className="text-[10px] text-[#005bb1] bg-[#005bb1]/10 px-2.5 py-1 rounded animate-pulse font-bold">
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
                                options={buildGroupedUnitOptions(units, 'Semua Unit')}
                                value={filterUnit}
                                onChange={(val) => setFilterUnit(val)}
                                placeholder="Semua Unit"
                                searchPlaceholder="Cari Unit (Fakultas, Prodi + Jenjang, Unit)..."
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[9px] font-bold text-[#535f71] uppercase tracking-wider block">Filter Tahun</label>
                            <SearchableSelect 
                                options={[{ id: '', label: 'Semua Tahun' }, ...years.map(y => ({ id: String(y.tahun), label: String(y.tahun) }))]}
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
                        const totalItems = groupedAssignments.length;
                        const totalPages = Math.ceil(totalItems / 10) || 1;
                        const safeCurrentPage = Math.min(currentPage, totalPages);
                        const startIndex = (safeCurrentPage - 1) * 10;
                        const endIndex = Math.min(startIndex + 10, totalItems);
                        const currentGroups = groupedAssignments.slice(startIndex, endIndex);

                        return (
                            <div className="space-y-4">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-[#c0c6d6]/25 bg-[#f1f3fe]/40 text-[#717785] font-bold uppercase tracking-wider">
                                                <th className="p-3.5 w-1/4">Unit Pelapor</th>
                                                <th className="p-3.5 text-center w-24">Tahun</th>
                                                <th className="p-3.5">Indikator (IKU) Ditugaskan</th>
                                                <th className="p-3.5 text-center w-36">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#c0c6d6]/10">
                                            {currentGroups.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="p-6 text-center text-[#717785] italic">
                                                        {streaming ? 'Memuat data penugasan...' : 'Belum ada data penugasan yang sesuai filter.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentGroups.map(group => {
                                                    const isExpanded = !!expandedGroupKeys[group.key];
                                                    const displayItems = isExpanded ? group.items : group.items.slice(0, 3);
                                                    const hiddenCount = group.items.length - 3;

                                                    return (
                                                        <tr key={group.key} className="hover:bg-[#f9f9ff] transition-all">
                                                            <td className="p-3.5 align-top">
                                                                <div className="font-extrabold text-[#181c23] text-xs">
                                                                    {group.nama_unit}
                                                                </div>
                                                                {group.jenjang && (
                                                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded mt-1 inline-block uppercase">
                                                                        {group.jenjang}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-3.5 text-center font-bold text-[#005bb1] text-xs align-top">
                                                                <span className="bg-[#005bb1]/10 px-2.5 py-1 rounded-full inline-block">
                                                                    {group.tahun}
                                                                </span>
                                                            </td>
                                                            <td className="p-3.5 align-top">
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[10px] font-extrabold bg-[#005bb1]/10 text-[#005bb1] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                            {group.items.length} Indikator Ditugaskan
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className="flex flex-col gap-1.5">
                                                                        {displayItems.map(item => (
                                                                            <div key={item.id} className="flex items-center gap-2 text-[#535f71] text-[11px] font-medium bg-[#f1f3fe]/40 p-1.5 rounded-md border border-[#c0c6d6]/10 hover:border-[#005bb1]/30 transition-all group/item">
                                                                                <span className="material-symbols-outlined text-[14px] text-[#005bb1]">check_circle</span>
                                                                                <span className="flex-1 font-semibold">{item.full_kategori || item.iku}</span>
                                                                                {renderJenisBadge(item.jenis_iku)}
                                                                                {renderFolderStatusBadge(item, group)}

                                                                                {!showDeleted ? (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleDeleteSingleAssignment(item, group, 'soft');
                                                                                        }}
                                                                                        className="text-gray-400 hover:text-[#ba1a1a] hover:bg-[#fff0ee] p-1 rounded transition-all cursor-pointer flex items-center justify-center"
                                                                                        title={`Hapus penugasan "${item.full_kategori || item.iku}"`}
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                                                                    </button>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleRestoreSingleAssignment(item);
                                                                                            }}
                                                                                            className="text-gray-400 hover:text-green-700 hover:bg-[#e8f5e9] p-1 rounded transition-all cursor-pointer flex items-center justify-center"
                                                                                            title={`Restore penugasan "${item.full_kategori || item.iku}"`}
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[14px]">restore</span>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleDeleteSingleAssignment(item, group, 'hard');
                                                                                            }}
                                                                                            className="text-gray-400 hover:text-[#ba1a1a] hover:bg-[#fff0ee] p-1 rounded transition-all cursor-pointer flex items-center justify-center"
                                                                                            title={`Hard Delete penugasan "${item.full_kategori || item.iku}"`}
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {hiddenCount > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleExpandGroup(group.key)}
                                                                            className="text-[10px] font-bold text-[#005bb1] hover:underline flex items-center gap-1 mt-1 cursor-pointer"
                                                                        >
                                                                            <span>{isExpanded ? 'Sembunyikan' : `+ ${hiddenCount} IKU Lainnya`}</span>
                                                                            <span className="material-symbols-outlined text-[14px]">
                                                                                {isExpanded ? 'expand_less' : 'expand_more'}
                                                                            </span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-3.5 text-center align-top">
                                                                <div className="flex justify-center items-center gap-2">
                                                                    {!showDeleted ? (
                                                                        <>
                                                                            <button 
                                                                                onClick={() => handleEditGroup(group)}
                                                                                className="bg-[#ebedf8] text-[#005bb1] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#d6e3ff] transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                                                                title="Edit Group Penugasan"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">edit</span>
                                                                                <span>Edit</span>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDeleteGroup(group, 'soft')}
                                                                                className="bg-[#fff0ee] text-[#ba1a1a] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#ffdad6] transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                                                                title="Hapus Seluruh Group Penugasan"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                                <span>Hapus</span>
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <button 
                                                                                onClick={() => handleRestoreGroup(group)}
                                                                                className="bg-[#e8f5e9] text-green-700 px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#c8e6c9] transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                                                                title="Restore Seluruh Group Penugasan"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">restore</span>
                                                                                <span>Restore</span>
                                                                            </button>
                                                                            <button 
                                                                                onClick={() => handleDeleteGroup(group, 'hard')}
                                                                                className="bg-[#fff0ee] text-[#ba1a1a] px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#ffdad6] transition-all uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                                                                                title="Hard Delete Seluruh Group Penugasan"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                                                                                <span>Hard Delete</span>
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination Controls */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#c0c6d6]/20">
                                    <div className="text-[#535f71] text-xs font-semibold">
                                        Menampilkan <span className="font-bold text-[#181c23]">{totalItems > 0 ? startIndex + 1 : 0}</span> sampai <span className="font-bold text-[#181c23]">{endIndex}</span> dari <span className="font-bold text-[#181c23]">{totalItems}</span> kelompok penugasan
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

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function SearchableSelect({ 
    options = [], 
    value, 
    onChange, 
    placeholder = '-- Pilih --',
    getLabel = (opt) => opt?.label || opt?.nama || opt?.name || opt?.full_kategori || opt?.iku || String(opt),
    getValue = (opt) => opt?.value !== undefined ? opt.value : (opt?.id !== undefined ? opt.id : opt),
    disabled = false,
    className = "",
    searchPlaceholder = "Cari...",
    isMulti = false,
    direction = "auto"
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Standardize options into array of objects { value, label, isGroupHeader, disabled, original }
    const rawNormalized = options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
            return {
                value: getValue(opt),
                label: getLabel(opt),
                isGroupHeader: opt.isGroupHeader || false,
                badge: opt.badge || null,
                disabled: opt.disabled || false,
                original: opt
            };
        }
        return {
            value: opt,
            label: String(opt),
            isGroupHeader: false,
            badge: null,
            disabled: false,
            original: opt
        };
    });

    let normalizedOptions = [...rawNormalized];
    if (!isMulti && placeholder && !rawNormalized.some(opt => !opt.isGroupHeader && String(opt.value) === '')) {
        normalizedOptions.unshift({
            value: '',
            label: placeholder,
            isGroupHeader: false,
            badge: null,
            disabled: false,
            original: null
        });
    }

    const selectedValues = isMulti 
        ? (Array.isArray(value) ? value.map(v => String(v)) : (value ? [String(value)] : []))
        : [];

    const selectedOption = !isMulti 
        ? normalizedOptions.find(opt => !opt.isGroupHeader && String(opt.value) === String(value))
        : null;

    const selectedOptionsMulti = isMulti
        ? normalizedOptions.filter(opt => !opt.isGroupHeader && selectedValues.includes(String(opt.value)))
        : [];

    const searchLower = searchTerm.toLowerCase();

    let filteredOptions = [];
    if (!searchTerm) {
        filteredOptions = normalizedOptions;
    } else {
        let currentHeader = null;
        normalizedOptions.forEach(opt => {
            if (opt.isGroupHeader) {
                currentHeader = opt;
            } else {
                const matches = String(opt.label).toLowerCase().includes(searchLower) ||
                                (opt.original?.searchStr && opt.original.searchStr.includes(searchLower)) ||
                                (opt.badge && opt.badge.toLowerCase().includes(searchLower)) ||
                                (opt.original?.group && opt.original.group.toLowerCase().includes(searchLower));

                if (matches) {
                    if (currentHeader && !filteredOptions.includes(currentHeader)) {
                        filteredOptions.push(currentHeader);
                    }
                    filteredOptions.push(opt);
                }
            }
        });
    }

    const selectableOptions = normalizedOptions.filter(opt => !opt.isGroupHeader && !opt.disabled && opt.value !== '');

    const handleSelectAll = () => {
        if (!isMulti) return;
        const allVals = selectableOptions.map(opt => opt.value);
        onChange(allVals);
    };

    const handleClearAll = () => {
        if (!isMulti) return;
        onChange([]);
    };

    const [coords, setCoords] = useState(null);
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    const updatePosition = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        let isUp = false;
        if (direction === 'up') {
            isUp = true;
        } else if (direction === 'down') {
            isUp = false;
        } else {
            // Open upwards if space below is less than 240px and space above is greater
            isUp = spaceBelow < 240 && spaceAbove > spaceBelow;
        }

        const availableHeight = isUp ? spaceAbove - 16 : spaceBelow - 16;
        const maxHeight = Math.min(360, Math.max(140, availableHeight));

        let left = rect.left;
        let width = rect.width;
        if (left + width > window.innerWidth - 12) {
            left = Math.max(12, window.innerWidth - width - 12);
        }
        if (left < 12) {
            left = 12;
            width = Math.min(width, window.innerWidth - 24);
        }

        setCoords({
            left: Math.round(left),
            width: Math.round(width),
            top: isUp ? null : Math.round(rect.bottom + 6),
            bottom: isUp ? Math.round(window.innerHeight - rect.top + 6) : null,
            maxHeight: Math.round(maxHeight),
            isUp
        });
    };

    const toggleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

    useIsomorphicLayoutEffect(() => {
        if (isOpen) {
            updatePosition();
        }
    }, [isOpen, direction]);

    useEffect(() => {
        if (!isOpen) return;

        const handleScroll = (e) => {
            if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
                return;
            }
            updatePosition();
        };

        const handleResize = () => {
            updatePosition();
        };

        const handleClickOutside = (e) => {
            if (
                containerRef.current && !containerRef.current.contains(e.target) &&
                dropdownRef.current && !dropdownRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 30);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const renderTriggerLabel = () => {
        if (isMulti) {
            if (selectedOptionsMulti.length === 0) {
                return <span className="text-[#717785] italic truncate">{placeholder}</span>;
            } else if (selectedOptionsMulti.length === 1) {
                return <span className="text-[#181c23] font-semibold truncate">{selectedOptionsMulti[0].label}</span>;
            } else {
                return (
                    <div className="flex items-center gap-2 truncate">
                        <span className="bg-[#005bb1] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0">
                            {selectedOptionsMulti.length} Dipilih
                        </span>
                        <span className="text-[#181c23] font-semibold truncate">
                            {selectedOptionsMulti.map(o => o.label).join(', ')}
                        </span>
                    </div>
                );
            }
        }

        const isValueEmpty = !selectedOption || String(selectedOption.value) === '';
        return (
            <span className={isValueEmpty ? 'text-[#717785] italic truncate' : 'text-[#181c23] font-semibold truncate'}>
                {selectedOption ? selectedOption.label : placeholder}
            </span>
        );
    };

    const hasValue = !isMulti && value !== '' && value !== null && value !== undefined && String(value) !== '';

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={toggleOpen}
                className={`w-full bg-white border ${
                    isOpen ? 'border-[#005bb1] ring-1 ring-[#005bb1]' : 'border-[#c0c6d6]'
                } rounded-xl px-4 py-2.5 text-xs text-left font-semibold text-[#181c23] flex items-center justify-between shadow-sm outline-none hover:border-[#005bb1] transition-all cursor-pointer ${
                    disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                }`}
            >
                {renderTriggerLabel()}
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {hasValue && !disabled && (
                        <span 
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            title="Batal Pilih (Unselect)"
                            className="material-symbols-outlined text-gray-400 hover:text-red-500 text-[18px] p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            close
                        </span>
                    )}
                    <span className={`material-symbols-outlined text-[#535f71] text-[20px] transition-transform duration-200 ${isOpen ? (coords?.isUp ? '-rotate-180 text-[#005bb1]' : 'rotate-180 text-[#005bb1]') : ''}`}>
                        expand_more
                    </span>
                </div>
            </button>

            {isOpen && coords && typeof document !== 'undefined' && createPortal(
                <div 
                    ref={dropdownRef}
                    style={{
                        position: 'fixed',
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                        top: coords.isUp ? 'auto' : `${coords.top}px`,
                        bottom: coords.isUp ? `${coords.bottom}px` : 'auto',
                        maxHeight: `${coords.maxHeight}px`,
                        zIndex: 99999
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="bg-white border border-[#c0c6d6]/80 rounded-xl shadow-2xl overflow-hidden py-2 flex flex-col"
                >
                    <div className="px-3 pb-2 border-b border-[#c0c6d6]/20 space-y-2">
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-2.5 text-[#717785] text-[16px]">search</span>
                            <input
                                ref={searchInputRef}
                                type="text"
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-8 pr-3 py-1.5 bg-[#f1f3fe]/60 border border-[#c0c6d6]/40 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#005bb1] text-[#181c23]"
                            />
                        </div>

                        {isMulti && (
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] font-bold text-[#535f71]">
                                    {selectedValues.length} / {selectableOptions.length} Dipilih
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectAll}
                                        className="text-[10px] font-extrabold text-[#005bb1] hover:underline"
                                    >
                                        Pilih Semua
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={handleClearAll}
                                        className="text-[10px] font-extrabold text-red-600 hover:underline"
                                    >
                                        Hapus Semua
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="overflow-y-auto flex-1 divide-y divide-[#c0c6d6]/10">
                        {filteredOptions.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-[#717785] italic text-center">
                                Tidak ada pilihan yang cocok
                            </div>
                        ) : (
                            filteredOptions.map((opt, idx) => {
                                if (opt.isGroupHeader) {
                                    return (
                                        <div 
                                            key={`hdr-${idx}`}
                                            className="px-3 py-1.5 bg-[#f8fafc] text-[10px] font-black text-[#475569] uppercase tracking-wider border-y border-[#e2e8f0] sticky top-0 z-10 flex justify-between items-center select-none"
                                        >
                                            <span>{opt.original?.groupTitle || opt.label}</span>
                                            {opt.original?.count && (
                                                <span className="text-[9px] font-bold text-gray-500 bg-white border border-gray-200 px-1.5 py-0.2 rounded-full">
                                                    {opt.original.count}
                                                </span>
                                            )}
                                        </div>
                                    );
                                }

                                const optValStr = String(opt.value);
                                const isSelected = isMulti 
                                    ? selectedValues.includes(optValStr)
                                    : optValStr === String(value);

                                const isDisabled = opt.disabled || opt.original?.disabled;

                                const handleItemClick = () => {
                                    if (isDisabled) return;

                                    if (isMulti) {
                                        if (opt.value === '') {
                                            // Selected empty default option ("-- Pilih --")
                                            onChange([]);
                                            return;
                                        }

                                        let updated;
                                        if (isSelected) {
                                            updated = selectedValues.filter(v => v !== optValStr);
                                        } else {
                                            updated = [...selectedValues, opt.value];
                                        }
                                        onChange(updated);
                                    } else {
                                        onChange(opt.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }
                                };

                                return (
                                    <div
                                        key={idx}
                                        onClick={handleItemClick}
                                        className={`px-4 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                                            isDisabled 
                                                ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 select-none' 
                                                : isSelected 
                                                    ? 'bg-[#ebedf8] text-[#005bb1] font-bold cursor-pointer hover:bg-[#f1f3fe]' 
                                                    : 'text-[#181c23] cursor-pointer hover:bg-[#f1f3fe]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {isMulti && opt.value !== '' && (
                                                <input 
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}} // Handled by parent div onClick
                                                    className="rounded border-gray-300 text-[#005bb1] focus:ring-[#005bb1] h-3.5 w-3.5 pointer-events-none"
                                                />
                                            )}
                                            <span className="truncate">{opt.label}</span>
                                        </div>

                                        {isDisabled ? (
                                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 border bg-amber-50 text-amber-700 border-amber-200">
                                                Otomatis SIMAK
                                            </span>
                                        ) : opt.original?.badge && (
                                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider flex-shrink-0 border ${opt.original.badgeColor || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                {opt.original.badge}
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}


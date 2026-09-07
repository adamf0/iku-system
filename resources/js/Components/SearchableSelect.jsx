import React, { useState, useEffect, useRef } from 'react';

export default function SearchableSelect({ 
    options = [], 
    value, 
    onChange, 
    placeholder = '-- Pilih --',
    getLabel = (opt) => opt?.label || opt?.nama || opt?.name || opt?.full_kategori || opt?.iku || String(opt),
    getValue = (opt) => opt?.value !== undefined ? opt.value : (opt?.id !== undefined ? opt.id : opt),
    disabled = false,
    className = "",
    searchPlaceholder = "Cari..."
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef(null);

    // Standardize options into array of objects { value, label, isGroupHeader, disabled, original }
    const normalizedOptions = options.map(opt => {
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

    const selectedOption = normalizedOptions.find(opt => !opt.isGroupHeader && String(opt.value) === String(value));

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

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-white border ${
                    isOpen ? 'border-[#005bb1] ring-1 ring-[#005bb1]' : 'border-[#c0c6d6]'
                } rounded-xl px-4 py-2.5 text-xs text-left font-semibold text-[#181c23] flex items-center justify-between shadow-sm outline-none hover:border-[#005bb1] transition-all cursor-pointer ${
                    disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                }`}
            >
                <span className={selectedOption ? 'text-[#181c23] font-semibold truncate' : 'text-[#717785] italic truncate'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className={`material-symbols-outlined text-[#535f71] text-[20px] ml-2 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#005bb1]' : ''}`}>
                    expand_more
                </span>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#c0c6d6]/60 rounded-xl shadow-xl z-50 overflow-hidden py-2 max-h-72 flex flex-col">
                    <div className="px-3 pb-2 border-b border-[#c0c6d6]/20">
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-2.5 text-[#717785] text-[16px]">search</span>
                            <input
                                type="text"
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="w-full pl-8 pr-3 py-1.5 bg-[#f1f3fe]/60 border border-[#c0c6d6]/40 rounded-lg text-xs outline-none focus:ring-1 focus:ring-[#005bb1] text-[#181c23]"
                            />
                        </div>
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

                                const isSelected = String(opt.value) === String(value);
                                const isDisabled = opt.disabled || opt.original?.disabled;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            if (isDisabled) return;
                                            onChange(opt.value);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`px-4 py-2 text-xs flex items-center justify-between gap-2 transition-colors ${
                                            isDisabled 
                                                ? 'opacity-50 cursor-not-allowed bg-gray-50 text-gray-400 select-none' 
                                                : isSelected 
                                                    ? 'bg-[#ebedf8] text-[#005bb1] font-bold cursor-pointer hover:bg-[#f1f3fe]' 
                                                    : 'text-[#181c23] cursor-pointer hover:bg-[#f1f3fe]'
                                        }`}
                                    >
                                        <span className="truncate">{opt.label}</span>
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
                </div>
            )}
        </div>
    );
}

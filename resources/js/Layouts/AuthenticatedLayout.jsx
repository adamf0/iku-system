import React from 'react';
import { Link, usePage } from '@inertiajs/react';

export default function AuthenticatedLayout({ pageTitle, children }) {
    const user = usePage().props.auth.user;
    
    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return parts[0].substring(0, 2).toUpperCase();
    };

    return (
        <div className="min-h-screen bg-[#f9f9ff] text-[#181c23] antialiased">
            {/* Sidebar Navigation */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-[#ebedf8] border-r border-[#c0c6d6]/30 hidden md:flex flex-col z-50">
                <div className="p-6 flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#005bb1] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                    <span className="text-xl text-[#005bb1] font-bold tracking-tight">IKU Portal</span>
                </div>
                
                <nav className="flex-1 px-4 mt-4 space-y-1.5 overflow-y-auto">
                    <Link 
                        href={route('dashboard')} 
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                            route().current('dashboard') 
                                ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                : 'text-[#535f71] hover:bg-[#e5e8f2]'
                        }`}
                    >
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: route().current('dashboard') ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
                        <span className="text-[13px]">Dashboard PT</span>
                    </Link>

                    {user.role === 'ADMIN' && (
                        <>
                            <div className="h-[1px] bg-[#c0c6d6]/30 my-2"></div>
                            <div className="px-4 py-1">
                                <span className="text-[9px] font-bold text-[#717785] opacity-75 uppercase tracking-widest">MASTER SETTINGS</span>
                            </div>

                            <Link 
                                href={route('master')} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    route().current('master') 
                                        ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                        : 'text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                                <span className="text-[13px]">Management Indikator</span>
                            </Link>

                            <Link 
                                href={route('management-target')} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    route().current('management-target') 
                                        ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                        : 'text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">track_changes</span>
                                <span className="text-[13px]">Management Target</span>
                            </Link>

                            <Link 
                                href={route('penugasan-target')} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    route().current('penugasan-target') 
                                        ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                        : 'text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">assignment_ind</span>
                                <span className="text-[13px]">Penugasan Target</span>
                            </Link>
                        </>
                    )}

                    {user.role !== 'ADMIN' && (
                        <>
                            <div className="h-[1px] bg-[#c0c6d6]/30 my-2"></div>
                            <div className="px-4 py-1">
                                <span className="text-[9px] font-bold text-[#717785] opacity-75 uppercase tracking-widest">REPORTING</span>
                            </div>

                            <Link 
                                href={route('reporting')} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    route().current('reporting') || route().current('capaian.edit')
                                        ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                        : 'text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">analytics</span>
                                <span className="text-[13px]">Capaian Kinerja</span>
                            </Link>
                        </>
                    )}

                    {user.role === 'ADMIN' && (
                        <>
                            <div className="h-[1px] bg-[#c0c6d6]/30 my-2"></div>
                            <div className="px-4 py-1">
                                <span className="text-[9px] font-bold text-[#717785] opacity-75 uppercase tracking-widest">PROFILE & ACCOUNTS</span>
                            </div>

                            <Link 
                                href={route('profile.edit')} 
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                                    route().current('profile.edit') 
                                        ? 'bg-[#d7e3f9] text-[#101c2c] font-semibold shadow-sm' 
                                        : 'text-[#535f71] hover:bg-[#e5e8f2]'
                                }`}
                            >
                                <span className="material-symbols-outlined text-lg">person</span>
                                <span className="text-[13px]">Profil Perguruan Tinggi</span>
                            </Link>
                        </>
                    )}

                    <div className="h-[1px] bg-[#c0c6d6]/30 my-2"></div>

                    <Link 
                        method="post" 
                        href={route('logout')} 
                        as="button" 
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 text-left font-medium"
                    >
                        <span className="material-symbols-outlined text-lg">logout</span>
                        <span className="text-[13px]">Logout</span>
                    </Link>
                </nav>

                {/* Bottom Institution Details */}
                <div className="p-4 border-t border-[#c0c6d6]/20 space-y-3">
                    <div className="bg-[#005bb1]/5 p-4 rounded-xl border border-[#005bb1]/10">
                        <p className="text-[10px] font-bold text-[#005bb1] uppercase tracking-wider font-upper">INSTITUTION</p>
                        <p className="text-xs font-bold text-[#181c23] mt-1">Universitas Pakuan</p>
                    </div>

                    <div className="bg-[#ebedf8] p-3 rounded-xl flex items-center gap-3 border border-[#c0c6d6]/20 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-[#d6e3ff] text-[#001b3d] flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {getInitials(user?.name)}
                        </div>
                        <div className="flex-grow min-w-0">
                            <p className="text-xs font-bold truncate text-[#181c23]">{user?.name}</p>
                            <p className="text-[9px] text-[#717785] uppercase font-bold tracking-widest truncate">{user?.role} - {user?.nama_unit || user?.fakultas_unit}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Top App Bar */}
            <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 z-40 shadow-sm border-b border-[#c0c6d6]/10">
                <h1 className="text-lg text-[#005bb1] font-bold">{pageTitle || 'IKU Performance Portal'}</h1>
                <div className="flex items-center gap-4">
                    <button className="p-2 rounded-full hover:bg-[#e5e8f2] transition-colors relative">
                        <span className="material-symbols-outlined text-[#535f71]">notifications</span>
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#ba1a1a] rounded-full"></span>
                    </button>
                    <div className="w-8 h-8 rounded-full bg-[#d6e3ff] text-[#001b3d] flex items-center justify-center font-bold text-sm">
                        {getInitials(user?.name)}
                    </div>
                </div>
            </header>

            {/* Main Content wrapper */}
            <main className="pt-24 pb-12 md:ml-64 px-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}

import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';

export default function Login() {
    const { data, setData, post, processing, errors, reset } = useForm({
        login: '',
        password: '',
        remember: false,
    });

    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        post(route('login'), {
            onFinish: () => reset('password'),
        });
    };

    return (
        <div className="min-h-screen flex flex-col selection:bg-primary-fixed selection:text-on-primary-fixed bg-[#f9f9ff]">
            <Head title="IKU Portal - Login" />
            
            <header className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-[#f9f9ff]/80 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#005bb1] text-2xl">school</span>
                    <span className="font-bold text-[#005bb1] text-lg">IKU Portal</span>
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center pt-16 pb-12 px-6 relative overflow-hidden">
                {/* Abstract Background Shapes */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#0073dd]/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#d7e3f9]/10 rounded-full blur-3xl"></div>
                
                {/* Login Card Container */}
                <div className="w-full max-w-5xl bg-white rounded-xl overflow-hidden flex flex-col md:flex-row shadow-xl relative z-10">
                    
                    {/* Left Side: Visual Illustration */}
                    <div className="hidden md:block md:w-1/2 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-[#005bb1]/10 z-10 group-hover:bg-transparent transition-colors duration-500"></div>
                        <div 
                            className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105" 
                            style={{ 
                                backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuB42DkGfZchTesoL0-RckVKn8KOEkVXhTBhpVtVQlaAsp7X15l8OL6W6NJcGTKFXSOsOpvSyqOp-DzGKRHfm3g0UG7mO6tbGSh0mK4fb3E3onwNIXiMD1hnkhAjzvaOapYELpQMoAycfzdvLoM0FCmO-oh2zYrL8RkNeWFMZ2cHzfaJRNZOGzGJNqyS0ab4H4ZkcOs-MXt0HUchzHdfpVIBQyg8ay7fO7TQukXaccmbOROhqUEBKTSlBlBa_DVBTZfjuqtC8Knd8Wc')`
                            }}
                        ></div>
                        <div className="absolute bottom-10 left-10 right-10 z-20 text-white">
                            <p className="font-bold text-2xl mb-2 drop-shadow-md">Indikator Kinerja Utama</p>
                            <p className="text-sm opacity-90 drop-shadow-md">Mengukur prestasi, mewujudkan visi pendidikan berkualitas tinggi.</p>
                        </div>
                    </div>

                    {/* Right Side: Login Form */}
                    <div className="w-full md:w-1/2 p-10 md:p-14 flex flex-col justify-center">
                        <div className="mb-10 text-center md:text-left">
                            <div className="inline-flex items-center justify-center w-14 h-14 bg-[#0073dd]/10 rounded-xl mb-6">
                                <span className="material-symbols-outlined text-[#005bb1] text-3xl">analytics</span>
                            </div>
                            <h1 className="text-2xl font-bold text-[#181c23] mb-2">Selamat Datang Kembali</h1>
                            <p className="text-sm text-[#404754]">Masuk ke Portal IKU untuk mengakses dashboard performa akademik Anda.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Username/Email Field */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold tracking-wider text-[#404754] uppercase block" htmlFor="login">
                                    Username atau Email
                                </label>
                                <div className="relative group rounded-lg overflow-hidden border border-[#c0c6d6] transition-all focus-within:ring-2 focus-within:ring-[#005bb1]/20 focus-within:border-[#005bb1]">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#717785] group-focus-within:text-[#005bb1]">person</span>
                                    <input 
                                        className="w-full pl-12 pr-4 py-3.5 bg-transparent border-none focus:ring-0 text-[#181c23] placeholder-[#717785]/50 text-sm outline-none" 
                                        id="login" 
                                        name="login" 
                                        value={data.login}
                                        onChange={(e) => setData('login', e.target.value)}
                                        placeholder="Masukkan username anda" 
                                        required 
                                        type="text"
                                    />
                                </div>
                                {errors.login && (
                                    <p className="text-xs text-red-600 mt-1 font-semibold">{errors.login}</p>
                                )}
                            </div>

                            {/* Password Field */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-semibold tracking-wider text-[#404754] uppercase block" htmlFor="password">
                                        Password
                                    </label>
                                    <a className="text-xs font-semibold text-[#005bb1] hover:underline transition-all" href="#">
                                        Lupa Password?
                                    </a>
                                </div>
                                <div className="relative group rounded-lg overflow-hidden border border-[#c0c6d6] transition-all focus-within:ring-2 focus-within:ring-[#005bb1]/20 focus-within:border-[#005bb1]">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#717785] group-focus-within:text-[#005bb1]">lock</span>
                                    <input 
                                        className="w-full pl-12 pr-12 py-3.5 bg-transparent border-none focus:ring-0 text-[#181c23] placeholder-[#717785]/50 text-sm outline-none" 
                                        id="password" 
                                        name="password" 
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        placeholder="••••••••" 
                                        required 
                                        type={showPassword ? 'text' : 'password'}
                                    />
                                    <button 
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#717785] hover:text-[#181c23] transition-colors" 
                                        onClick={() => setShowPassword(!showPassword)} 
                                        type="button"
                                    >
                                        <span className="material-symbols-outlined">
                                            {showPassword ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                </div>
                                {errors.password && (
                                    <p className="text-xs text-red-600 mt-1 font-semibold">{errors.password}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button 
                                className="w-full bg-[#005bb1] text-white py-4 rounded-lg font-bold text-base shadow-md hover:bg-[#0073dd] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 group" 
                                type="submit"
                                disabled={processing}
                            >
                                <span>{processing ? 'Memproses...' : 'Masuk'}</span>
                                <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">login</span>
                            </button>
                        </form>

                        {/* Security Assurance */}
                        <div className="mt-8 flex items-center justify-center gap-3 py-3 px-4 bg-[#f1f3fe] rounded-lg">
                            <span className="material-symbols-outlined text-[#535f71] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                            <p className="text-[11px] font-bold text-[#535f71] uppercase tracking-wider">Koneksi Aman Terenkripsi</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer: Institutional Branding */}
            <footer className="w-full py-8 px-6 border-t border-[#c0c6d6]/30 mt-auto">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col md:flex-row items-center gap-6 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-3xl text-[#005bb1]">school</span>
                            <div className="hidden md:block w-[1px] h-8 bg-[#c0c6d6]"></div>
                            <span className="font-bold text-sm tracking-widest text-[#535f71] uppercase">UNPAK</span>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-[10px] font-bold text-[#404754]">DIKEMBANGKAN OLEH</p>
                            <p className="text-sm text-[#181c23] font-semibold uppercase tracking-tight">Universitas Pakuan</p>
                        </div>
                    </div>
                    <div className="text-center md:text-right">
                        <p className="text-xs text-[#404754]">© 2026 IKU Portal — Universitas Pakuan</p>
                        <div className="flex justify-center md:justify-end gap-4 mt-2">
                            <a className="text-[11px] font-bold text-[#535f71] hover:text-[#005bb1] transition-colors" href="#">Syarat & Ketentuan</a>
                            <a className="text-[11px] font-bold text-[#535f71] hover:text-[#005bb1] transition-colors" href="#">Kebijakan Privasi</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import {
  Vote,
  ShieldCheck,
  Lock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Users,
  XCircle,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: any, type: 'member' | 'admin', token: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [availableData, setAvailableData] = useState<{
    admins: any[];
    sampleMembers: any[];
    totalMembers: number;
    isClean: boolean;
  }>({
    admins: [
      {
        nama: 'Andika Pratama',
        email: 'andikadix862@gmail.com',
        role: 'superadmin',
        bagian: 'Panitia Pemilihan'
      },
      {
        nama: 'Super Administrator',
        email: 'admin@kopsyah-ykk.id',
        role: 'superadmin',
        bagian: 'Panitia Pemilihan'
      }
    ],
    sampleMembers: [],
    totalMembers: 0,
    isClean: true
  });

  useEffect(() => {
    api.getAvailableUsers().then(res => {
      if (res.success) {
        setAvailableData({
          admins: res.admins || [],
          sampleMembers: res.sampleMembers || [],
          totalMembers: res.totalMembers || 0,
          isClean: res.isClean
        });
      }
    }).catch(err => {
      console.error('Failed to fetch available users:', err);
    });
  }, []);

  const handleLogin = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) {
      setErrorTitle('AKSES DITOLAK');
      setErrorMessage('Silakan masukkan alamat email yang terdaftar pada database koperasi.');
      return;
    }

    try {
      setLoading(true);
      setErrorTitle(null);
      setErrorMessage(null);

      const res = await api.login(cleanEmail);
      if (res.success) {
        onLoginSuccess(res.user, res.type, res.token);
      }
    } catch (err: any) {
      // Format error according to PRD & User requirements
      setErrorTitle(err.error_title || 'AKSES DITOLAK');
      setErrorMessage(
        err.message ||
          'Email yang Anda masukkan belum terdaftar sebagai anggota KOPSYAH YKK AP INDONESIA. Silakan gunakan email yang telah terdaftar atau hubungi administrator.'
      );
    } finally {
      setLoading(false);
    }
  };

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');

  // Check URL parameters, pathname, or hash for direct administrator portal access (e.g. /admin, #admin, ?admin=true)
  useEffect(() => {
    const checkDirectAdminAccess = () => {
      const path = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();

      if (
        path === '/admin' ||
        path.startsWith('/admin/') ||
        search.includes('admin') ||
        search.includes('portal=admin') ||
        hash === '#admin' ||
        hash.startsWith('#admin')
      ) {
        setShowAdminModal(true);
      }
    };

    checkDirectAdminAccess();
    window.addEventListener('popstate', checkDirectAdminAccess);
    window.addEventListener('hashchange', checkDirectAdminAccess);
    return () => {
      window.removeEventListener('popstate', checkDirectAdminAccess);
      window.removeEventListener('hashchange', checkDirectAdminAccess);
    };
  }, []);

  return (
    <div id="login-container" className="min-h-[calc(100vh-7rem)] bg-[#F3F4F6] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Main Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Form Column - Main Voter Portal Login */}
          <div className="p-6 sm:p-10 flex flex-col justify-between">
            <div>
              {/* Header Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 border border-blue-200 text-[#1E3A8A] text-xs font-bold uppercase tracking-wider mb-4">
                <Vote className="w-3.5 h-3.5 text-blue-600" />
                Pemilihan Anggota Perwakilan 2026
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                KOPSYAH YKK AP INDONESIA
              </h1>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Sistem Pemungutan Suara Elektronik Terverifikasi. Portal resmi pemilih khusus untuk Anggota KOPSYAH YKK AP Indonesia.
              </p>

              {/* Section Header: MASUK DENGAN EMAIL TERDAFTAR */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] mb-1">
                  MASUK DENGAN EMAIL TERDAFTAR
                </h2>
                <p className="text-xs text-gray-500 mb-5">
                  Masukkan alamat email Anda yang telah terdata dalam Master Data Anggota.
                </p>

                {/* Error Alert Box: AKSES DITOLAK */}
                {errorMessage && (
                  <div
                    id="alert-akses-ditolak"
                    className="mb-5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-2xs animate-in fade-in"
                  >
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-extrabold uppercase tracking-wider text-rose-800">
                        {errorTitle || 'AKSES DITOLAK'}
                      </div>
                      <p className="text-rose-700 leading-relaxed font-medium">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Single Form: MASUK DENGAN EMAIL TERDAFTAR */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleLogin(email);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="input-email-anggota"
                      className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-2"
                    >
                      Email Anggota
                    </label>
                    <input
                      id="input-email-anggota"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Masukkan Email Terdaftar"
                      required
                      className="w-full h-12 px-4 rounded-xl border border-gray-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 text-sm text-gray-900 placeholder:text-gray-400 outline-hidden transition-all font-mono font-medium"
                    />
                  </div>

                  <button
                    id="btn-masuk-ke-sistem"
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Memeriksa Master Data...
                      </span>
                    ) : (
                      <>
                        <span>MASUK KE SISTEM</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* Security Badge Info */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-700" />
                Verifikasi Master Data
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                1 Anggota 1 Suara
              </span>
            </div>
          </div>
        </div>

        {/* Clean Footer - Strictly voter focused */}
        <div className="text-center text-xs text-gray-500 px-2 pt-2">
          <p>© 2026 Panitia Pemilihan Anggota Perwakilan KOPSYAH YKK AP INDONESIA.</p>
        </div>
      </div>

      {/* Dedicated Admin Login Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1E3A8A] flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Portal Panitia & Administrator
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Khusus untuk Pengelola & Panitia Pemilihan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Pilih Akun Panitia / Super Admin:
                </label>
                <div className="space-y-2">
                  {availableData.admins.map((acc, idx) => (
                    <button
                      key={`modal-admin-${idx}`}
                      type="button"
                      onClick={() => {
                        setShowAdminModal(false);
                        setEmail(acc.email);
                        handleLogin(acc.email);
                      }}
                      className="w-full text-left p-3 rounded-xl bg-gray-50 hover:bg-blue-50/80 border border-gray-200 hover:border-[#1E3A8A] transition-all group flex items-center justify-between cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-gray-900 group-hover:text-blue-900 truncate flex items-center gap-1.5">
                          <span>{acc.nama}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                          {acc.email}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 uppercase tracking-wider shrink-0 font-mono">
                        {acc.role === 'superadmin' ? 'Super Admin' : 'Panitia'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider mb-1.5">
                  Atau Masukkan Email Administrator:
                </label>
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    if (adminEmailInput.trim()) {
                      setShowAdminModal(false);
                      handleLogin(adminEmailInput);
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="email"
                    value={adminEmailInput}
                    onChange={e => setAdminEmailInput(e.target.value)}
                    placeholder="email.admin@kopsyah-ykk.id"
                    className="flex-1 h-10 px-3 rounded-xl border border-gray-300 focus:border-[#1E3A8A] text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Masuk
                  </button>
                </form>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

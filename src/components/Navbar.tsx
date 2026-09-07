import React from 'react';
import { Vote, Shield, User, LogOut, CheckCircle2, AlertCircle } from 'lucide-react';
import { Member, AdminUser, VotingStatus } from '../types';

interface NavbarProps {
  currentUser: Member | AdminUser | null;
  userType: 'member' | 'admin' | null;
  votingStatus?: VotingStatus;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  currentView: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  userType,
  votingStatus = 'AKTIF',
  onLogout,
  onNavigate,
  currentView
}) => {
  const getStatusBadge = (status: VotingStatus | string) => {
    switch (status) {
      case 'AKTIF':
        return (
          <span id="badge-status-aktif" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Periode Aktif
          </span>
        );
      case 'DRAFT':
        return (
          <span id="badge-status-draft" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Status Draft
          </span>
        );
      case 'SELESAI':
        return (
          <span id="badge-status-selesai" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pemilihan Selesai
          </span>
        );
      case 'DITUTUP':
      default:
        return (
          <span id="badge-status-ditutup" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30">
            <LogOut className="w-3.5 h-3.5" />
            Pemilihan Ditutup
          </span>
        );
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="sticky top-0 z-40 flex flex-col flex-shrink-0">
      {/* Primary Header - Clean Deep Navy (#1E3A8A) */}
      <header id="main-header" className="bg-[#1E3A8A] text-white h-16 sm:h-18 px-4 sm:px-8 flex items-center justify-between shadow-md">
        {/* Brand Logo & Title */}
        <div
          id="brand-logo-button"
          onClick={() => onNavigate(userType === 'admin' ? 'admin-dashboard' : 'voter-dashboard')}
          className="flex items-center gap-3.5 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center font-black text-[#1E3A8A] text-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider leading-none text-white">
                KOPSYAH YKK AP INDONESIA
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-extrabold uppercase bg-white/15 text-white/90 rounded font-mono">
                2026
              </span>
            </div>
            <p className="text-[10px] text-blue-200 opacity-80 mt-0.5 font-medium">
              Sistem Pemilihan Anggota Perwakilan
            </p>
          </div>
        </div>

        {/* Center / Right Section */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden lg:block">
            {getStatusBadge(votingStatus)}
          </div>

          {currentUser && (
            <div className="flex items-center gap-3 sm:gap-4 pl-3 sm:pl-5 border-l border-white/20">
              {userType === 'admin' ? (
                <div className="text-right">
                  <p className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                    {(currentUser as AdminUser).nama}
                  </p>
                  <p className="text-[10px] text-blue-200 opacity-80 italic font-mono">
                    {(currentUser as AdminUser).role === 'SUPER_ADMIN' ? 'Super Administrator' : 'Admin Pemilihan'}
                  </p>
                </div>
              ) : (
                <div className="text-right flex flex-col items-end">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-white truncate max-w-[130px] sm:max-w-[180px]">
                      {(currentUser as Member).nama}
                    </p>
                    {(currentUser as Member).status_memilih === 'SUDAH_MEMILIH' ? (
                      <span id="navbar-status-voted" className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500 text-white shadow-xs flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>SUDAH MEMILIH</span>
                      </span>
                    ) : (currentUser as Member).hak_pilih ? (
                      <span id="navbar-status-not-voted" className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-400 text-slate-900 shadow-xs shrink-0">
                        BELUM MEMILIH
                      </span>
                    ) : (
                      <span id="navbar-status-no-right" className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500 text-white shadow-xs shrink-0">
                        HANYA PEMILIH
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-blue-200 opacity-80 italic font-mono mt-0.5">
                    {(currentUser as Member).nama_bagian} #{(currentUser as Member).nomor_anggota}
                  </p>
                </div>
              )}

              <div className="w-8 h-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center border-2 border-white/30 text-xs font-bold shrink-0 shadow-2xs">
                {getInitials(currentUser.nama)}
              </div>

              <button
                id="btn-logout"
                onClick={onLogout}
                title="Keluar Akun"
                className="px-2.5 py-1.5 text-xs font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-1.5 border border-white/15"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline uppercase text-[10px] tracking-wider">Keluar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Sub-Header Utility Status Bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[11px] font-medium text-gray-500 uppercase tracking-widest">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-gray-700 font-bold">Status: Periode Aktif</span>
          </div>
          <div className="hidden sm:block text-gray-300">•</div>
          <div className="text-gray-600">
            KOPSYAH YKK AP INDONESIA
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="text-blue-700 font-bold">1 Anggota 1 Suara</span>
        </div>
      </div>
    </div>
  );
};


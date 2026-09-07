import React, { useEffect, useState } from 'react';
import {
  Users,
  Vote,
  Award,
  CheckCircle2,
  Clock,
  Building2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  Activity,
  Settings,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { DashboardStats } from '../../types';

interface AdminDashboardProps {
  adminEmail?: string;
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminEmail, onNavigateTab }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [refreshNotification, setRefreshNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Clear dummy data state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isClearingDb, setIsClearingDb] = useState(false);
  const [clearSuccessMessage, setClearSuccessMessage] = useState<string | null>(null);

  const formatIndonesianNow = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} WIB`;
  };

  const handleExecuteClearDb = async () => {
    try {
      setIsClearingDb(true);
      const res = await api.clearDummyData(adminEmail);
      if (res.success) {
        setStats(res.stats);
        setClearSuccessMessage(res.message);
        setIsClearModalOpen(false);
        const nowStr = formatIndonesianNow();
        setLastRefreshed(nowStr);
        setTimeout(() => {
          setClearSuccessMessage(null);
        }, 10000);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengosongkan data database.');
    } finally {
      setIsClearingDb(false);
    }
  };

  const fetchStats = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const startTime = Date.now();
      const res = await api.getAdminStats(adminEmail);
      
      // Ensure smooth visual spin feedback of at least 400ms on manual click
      const elapsed = Date.now() - startTime;
      if (isManualRefresh && elapsed < 400) {
        await new Promise(resolve => setTimeout(resolve, 400 - elapsed));
      }

      setStats(res.stats);
      const nowStr = formatIndonesianNow();
      setLastRefreshed(nowStr);

      if (isManualRefresh) {
        setRefreshNotification(`Data statistik, grafik, dan tabel berhasil dimutakhirkan (${nowStr})`);
        setTimeout(() => {
          setRefreshNotification(null);
        }, 4000);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat statistik admin.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Fetch immediately on component mount
    fetchStats(false);

    // Set up real-time auto refresh every 5 seconds
    const interval = setInterval(() => {
      if (isMounted) {
        fetchStats(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [adminEmail]);

  if (loading && !stats) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Memuat statistik pemilihan real-time...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-rose-200 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-gray-900 uppercase">Gagal Memuat Statistik</h3>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-[#1E3A8A] text-white text-xs font-bold uppercase tracking-wider rounded-xl"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div id="admin-dashboard-view" className="space-y-6">
      {/* Header with Refresh button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Admin Overview
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Dasbor Utama Pemilihan 2026
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Monitoring partisipasi, alokasi kuota perwakilan, dan rekapitulasi suara KOPSYAH YKK AP.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {lastRefreshed && (
            <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5 bg-gray-100/80 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Terakhir Diperbarui: {lastRefreshed}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-open-clear-modal"
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              className="px-3 py-2 rounded-xl border border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
              title="Hapus data contoh (anggota, kandidat, suara, bagian) agar database kosong dan siap import data baru"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Kosongkan Data Dummy</span>
            </button>

            <button
              id="btn-refresh-stats"
              type="button"
              disabled={isRefreshing}
              onClick={() => fetchStats(true)}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60 active:scale-95 cursor-pointer"
              title="Klik untuk memuat ulang statistik, grafik, dan tabel"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1E3A8A]' : 'text-gray-600'}`} />
              <span>{isRefreshing ? 'Memuat Ulang...' : 'Segarkan Data'}</span>
            </button>

            <button
              id="btn-quick-results"
              onClick={() => onNavigateTab('results')}
              className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Lihat Hasil & Pemenang</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Refresh Success Notification */}
      {refreshNotification && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-900 font-medium animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{refreshNotification}</span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
            Data Sinkron
          </span>
        </div>
      )}

      {/* Confirmation Notification after Wiping Database */}
      {clearSuccessMessage && (
        <div className="p-4 sm:p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl flex items-start justify-between gap-3 text-xs text-emerald-950 font-medium animate-in fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-emerald-900 uppercase tracking-wider">
                Database Berhasil Dikosongkan
              </h4>
              <p className="text-emerald-800 mt-1 leading-relaxed">
                {clearSuccessMessage}
              </p>
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold border border-emerald-300">
                  Total Anggota: 0
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold border border-emerald-300">
                  Total Bagian: 0
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold border border-emerald-300">
                  Kuota Kursi: 0
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold border border-emerald-300">
                  Suara Masuk: 0
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setClearSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer"
            title="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Clean Database State Banner */}
      {stats.total_anggota === 0 && (
        <div id="banner-database-bersih" className="p-5 rounded-2xl bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/80 border-2 border-blue-300 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-extrabold text-gray-900 tracking-tight">
                    Status Database: Bersih & Siap Menerima Data Baru
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                    0 Data Dummy
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed max-w-2xl">
                  Seluruh data anggota, kandidat, suara voting, dan bagian contoh telah berhasil dikosongkan. Seluruh indikator statistik (Total Anggota, Total Bagian, Kuota Kursi, Total Suara Masuk) berada pada angka 0. Akun Super Admin panitia tetap dipertahankan. Sistem kini siap untuk penginputan / import master data anggota baru.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                id="btn-cta-import-anggota"
                onClick={() => onNavigateTab('import')}
                className="px-4 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Mulai Import Anggota (Menu 3)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main KPI Stats Cards (PRD Section 19) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Pemilih */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Hak Pilih Terdaftar
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-gray-900 font-mono">
              {stats.total_berhak_memilih}
            </span>
            <span className="text-xs text-gray-500 ml-1">/ {stats.total_anggota} Anggota</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Total anggota dengan hak suara aktif</p>
        </div>

        {/* Sudah Memilih */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Sudah Memilih
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
              {stats.sudah_memilih}
            </span>
            <span className="text-xs text-gray-500 ml-1">Suara</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            Partisipasi: {stats.partisipasi_persen}%
          </p>
        </div>

        {/* Belum Memilih */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Belum Memilih
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono">
              {stats.belum_memilih}
            </span>
            <span className="text-xs text-gray-500 ml-1">Anggota</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Menunggu pemungutan suara</p>
        </div>

        {/* Total Kursi & Kandidat */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Total Kursi & Bagian
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-950 font-mono">
              {stats.total_kursi}
            </span>
            <span className="text-xs text-gray-500 ml-1">Kursi ({stats.total_bagian} Bagian)</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-1">{stats.total_kandidat} Kandidat aktif terdaftar</p>
        </div>
      </div>

      {/* Participation Progress Bar */}
      <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-bold text-gray-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            Progres Partisipasi Pemilihan Keseluruhan
          </span>
          <span className="font-extrabold text-blue-900 font-mono text-sm">
            {stats.partisipasi_persen}% ({stats.sudah_memilih} / {stats.total_berhak_memilih})
          </span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1E3A8A] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(stats.partisipasi_persen, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* 10 Mandatory Admin Modules Quick Access Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Akses Cepat Modul Administrasi Pemilihan (10 Menu Wajib)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Pusat kendali master data, validasi import, rekapitulasi 10:1, dan pengawasan LUBER & JURDIL.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { id: 'members', label: '2. Data Anggota', icon: Users, desc: 'Kelola DPT & Hak Pilih' },
            { id: 'import', label: '3. Import Anggota', icon: FileSpreadsheet, desc: 'Upload XLSX / CSV (7 Tahap)' },
            { id: 'divisions', label: '4. Data Bagian', icon: Building2, desc: 'Kalkulasi Kuota Rasio 10:1' },
            { id: 'candidates', label: '5. Data Kandidat', icon: Vote, desc: 'Verifikasi Syarat Pensiun' },
            { id: 'config', label: '6. Pengaturan Pemilihan', icon: Settings, desc: 'Buka / Tutup Bilik Suara' },
            { id: 'monitoring', label: '7. Monitoring Pemilihan', icon: Activity, desc: 'Pantau Aliran Suara Live' },
            { id: 'results', label: '8. Hasil Pemilihan', icon: Award, desc: 'Rekapitulasi & Tie-Break' },
            { id: 'reports', label: '9. Laporan Pemilihan', icon: FileText, desc: 'Cetak Berita Acara Resmi' },
            { id: 'audit', label: '10. Audit Log', icon: ShieldCheck, desc: 'Jejak Forensik Aktivitas' },
            { id: 'tests', label: 'Uji Sistem Otomatis', icon: RefreshCw, desc: '14 Skenario Pengujian' }
          ].map(menu => {
            const Icon = menu.icon;
            return (
              <button
                key={menu.id}
                id={`btn-menu-${menu.id}`}
                onClick={() => onNavigateTab(menu.id)}
                className="p-3.5 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50/20 text-left transition-all group flex flex-col justify-between"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#1E3A8A] text-gray-700 group-hover:text-white flex items-center justify-center transition-colors mb-2">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 group-hover:text-blue-900 leading-tight">
                    {menu.label}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                    {menu.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Division Summary Table (PRD Section 20) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-5 sm:px-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Rekapitulasi Partisipasi & Alokasi Kuota per Bagian
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Rasio perwakilan 10:1 (0.1–0.5 pembulatan bawah, 0.6–0.9 pembulatan atas).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => fetchStats(true)}
              className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-[#1E3A8A] flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Segarkan data tabel"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#1E3A8A]' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              onClick={() => onNavigateTab('divisions')}
              className="text-xs font-bold uppercase tracking-wider text-blue-700 hover:text-blue-900 flex items-center gap-1"
            >
              <span>Kelola Bagian</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 sm:px-6">Bagian / Divisi</th>
                <th className="py-3 px-4 text-center">Total Anggota</th>
                <th className="py-3 px-4 text-center">Kuota Kursi</th>
                <th className="py-3 px-4 text-center">Sudah Memilih</th>
                <th className="py-3 px-4 text-center">Belum Memilih</th>
                <th className="py-3 px-4 sm:px-6 text-right">Partisipasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {stats.divisions_summary.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-2">
                        <Building2 className="w-5 h-5 text-[#1E3A8A]" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        Belum Ada Data Bagian & Kuota Perwakilan
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Database saat ini bersih (0 bagian terdaftar). Data bagian dan alokasi kuota perwakilan akan otomatis dibuat dan dikalkulasi kuotanya (rasio 10:1) saat Anda mengimpor Master Data Anggota.
                      </p>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => onNavigateTab('import')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] border border-blue-200 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Buka Modul 3. Import Anggota</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                stats.divisions_summary.map(div => (
                  <tr key={div.bagian_id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-bold text-gray-900">{div.nama_bagian}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{div.bagian_id}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold font-mono text-gray-900">
                      {div.total_anggota}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded font-bold font-mono text-xs ${
                        div.kuota_perwakilan > 0
                          ? 'bg-blue-50 text-blue-900 border border-blue-200'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {div.kuota_perwakilan} Kursi
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-700 font-mono">
                      {div.sudah_memilih}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-gray-500 font-mono">
                      {div.belum_memilih}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-blue-700 rounded-full"
                            style={{ width: `${Math.min(div.partisipasi_persen, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-extrabold text-gray-900 font-mono">
                          {div.partisipasi_persen}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal for Clearing Database */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                  Konfirmasi Pengosongan Seluruh Data Dummy
                </h3>
                <p className="text-xs text-gray-500">
                  Tindakan ini akan mengosongkan sistem agar database bersih dan siap untuk penginputan data baru.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
              <p className="font-bold text-rose-950 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                Data yang akan dihapus secara permanen:
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800 ml-1">
                <li>Seluruh Data Anggota contoh (DPT & Hak Pilih)</li>
                <li>Seluruh Data Kandidat contoh</li>
                <li>Seluruh Data Suara & Hasil Pemilihan (Voting)</li>
                <li>Data Bagian contoh (otomatis dibuat ulang saat import anggota)</li>
                <li>Reset Audit Log aktivitas data</li>
              </ul>
              <p className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200 mt-2">
                ✓ Akun Super Administrator & Panitia Pemilihan tetap dipertahankan untuk akses login.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                disabled={isClearingDb}
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                id="btn-confirm-execute-clear-db"
                type="button"
                disabled={isClearingDb}
                onClick={handleExecuteClearDb}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all disabled:opacity-60 active:scale-95 cursor-pointer"
              >
                {isClearingDb ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengosongkan Database...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Kosongkan Database Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

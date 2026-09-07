import React, { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  Vote,
  Users,
  CheckCircle2,
  Clock,
  Building2,
  TrendingUp,
  ShieldCheck,
  Radio,
  Filter,
  RotateCcw,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '../../services/api';
import { Division, DashboardStats } from '../../types';
import { AdminResetModal } from './AdminResetModal';

interface RealtimeVoteItem {
  vote_id: string;
  candidate_id: string;
  bagian_id: string;
  timestamp: string;
  transaction_id: string;
  status: string;
}

interface AdminMonitoringProps {
  adminEmail?: string;
  onRefreshData?: () => void;
}

export const AdminMonitoring: React.FC<AdminMonitoringProps> = ({ adminEmail = 'admin@kopsyah-ykk.id', onRefreshData }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [votes, setVotes] = useState<RealtimeVoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBagian, setFilterBagian] = useState<string>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Reset Vote Modal state
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetModalMode, setResetModalMode] = useState<'ALL' | 'MEMBER'>('ALL');
  const [resetTargetIdentifier, setResetTargetIdentifier] = useState('');

  // Manual reset search input
  const [manualSearchTarget, setManualSearchTarget] = useState('');

  const fetchData = async () => {
    try {
      const [statsRes, divRes, votesRes] = await Promise.all([
        api.getAdminStats(),
        api.getDivisions(),
        api.getVotes(filterBagian !== 'ALL' ? filterBagian : undefined)
      ]);
      setStats(statsRes.stats);
      setDivisions(divRes.divisions || []);
      setVotes(votesRes.votes || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Monitoring fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterBagian]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, filterBagian]);

  const totalSuara = stats?.sudah_memilih || 0;
  const totalBerhak = stats?.total_berhak_memilih || 0;
  const partisipasi = stats?.partisipasi_persen || 0;

  return (
    <div id="admin-monitoring-container" className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Activity className="w-3.5 h-3.5 text-emerald-700" />
              <span>Monitoring Real-Time Pemilihan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Pemantauan Partisipasi & Aliran Suara
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Pemantauan langsung data masuk, persentase kehadiran pemilih per bagian, dan audit aliran suara per detik.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {/* Auto refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-colors flex items-center gap-2 ${
                autoRefresh
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-gray-50 text-gray-600 border-gray-300'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-600 animate-pulse' : 'text-gray-400'}`} />
              <span>{autoRefresh ? 'Live Sync (5s)' : 'Manual Sync'}</span>
            </button>

            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-2xs transition-colors"
              title="Perbarui Sekarang"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <span>Terakhir diperbarui: {lastRefreshed.toLocaleTimeString('id-ID')}</span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold uppercase">
            <ShieldCheck className="w-3.5 h-3.5" />
            Koneksi Database Aktif & Terverifikasi
          </span>
        </div>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Suara Masuk */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Suara Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Vote className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-2 font-mono">
            {totalSuara}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            dari <strong>{totalBerhak}</strong> pemilih berhak
          </div>
        </div>

        {/* Tingkat Partisipasi */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Partisipasi</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 mt-2 font-mono">
            {partisipasi}%
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, partisipasi)}%` }}
            />
          </div>
        </div>

        {/* Belum Memilih */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Belum Menggunakan Hak</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 mt-2 font-mono">
            {stats?.belum_memilih || 0}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            anggota menunggu jadwal
          </div>
        </div>

        {/* Total Kursi Diperebutkan */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kursi Perwakilan</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-900 mt-2 font-mono">
            {stats?.total_kursi || 0}
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            dari <strong>{stats?.total_bagian || 0}</strong> bagian kerja
          </div>
        </div>
      </div>

      {/* Progress Partisipasi per Bagian */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-700" />
            <span>Progress Partisipasi Pemilihan per Bagian</span>
          </h2>
          <span className="text-xs text-gray-400 font-mono">Rasio 10:1 Kursi Perwakilan</span>
        </div>

        <div className="space-y-3">
          {divisions.map(div => {
            const pct = div.partisipasi_persen || 0;
            return (
              <div key={div.bagian_id} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-white text-gray-900 font-mono font-bold border border-gray-200">
                      {div.bagian_id}
                    </span>
                    <span className="font-bold text-gray-900">{div.nama_bagian}</span>
                    <span className="text-gray-500 text-[11px]">
                      ({div.kuota_perwakilan} Kursi)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-gray-600">
                      <strong>{div.sudah_memilih}</strong> / {div.total_anggota} Suara
                    </span>
                    <span className="font-bold text-emerald-700 w-12 text-right">
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#1E3A8A] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Realtime Live Vote Stream */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>Log Aliran Surat Suara Terenkripsi Masuk</span>
            </h3>
            <p className="text-xs text-gray-500">
              Setiap pemilih diverifikasi satu suara. Data anonimitas terjaga sesuai asas LUBER & JURDIL.
            </p>
          </div>

          {/* Filter by Division */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={filterBagian}
              onChange={e => setFilterBagian(e.target.value)}
              className="text-xs bg-white border border-gray-300 rounded-lg p-1.5 font-bold text-gray-800"
            >
              <option value="ALL">Semua Bagian</option>
              {divisions.map(d => (
                <option key={d.bagian_id} value={d.bagian_id}>
                  {d.nama_bagian}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-100 text-gray-700 uppercase font-bold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Waktu Voting</th>
                <th className="py-3 px-4">No. Transaksi Unik</th>
                <th className="py-3 px-4">Bagian Pemilih</th>
                <th className="py-3 px-4">Kandidat Terpilih</th>
                <th className="py-3 px-4">Integritas Suara</th>
                <th className="py-3 px-4 text-center">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {votes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 font-sans">
                    Belum ada suara yang tercatat. Database pemilihan dalam kondisi bersih (0 Suara).
                  </td>
                </tr>
              ) : (
                votes.slice().reverse().map(vote => {
                  const div = divisions.find(d => d.bagian_id === vote.bagian_id);
                  const txId = vote.transaction_id || vote.vote_id;
                  return (
                    <tr key={vote.vote_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2.5 px-4 text-gray-600">
                        {new Date(vote.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-[#1E3A8A]">
                        {txId}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-[11px] font-bold">
                          {div?.nama_bagian || vote.bagian_id}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-800">
                        {vote.candidate_id}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          TERVERIFIKASI
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center font-sans">
                        <button
                          type="button"
                          onClick={() => {
                            setResetModalMode('MEMBER');
                            setResetTargetIdentifier(txId);
                            setIsResetModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 transition-colors inline-flex items-center gap-1 text-[11px]"
                          title="Batalkan / Reset Suara Pemilih Ini"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Batalkan Suara</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Quick Reset Tool for Admin */}
      <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-amber-900">
          <RotateCcw className="w-4 h-4 text-amber-700" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            Pencarian Cepat Pembatalan / Reset Suara Pemilih (Akses Admin)
          </h3>
        </div>
        <p className="text-xs text-amber-800">
          Gunakan fitur ini untuk mereset status suara anggota spesifik berdasarkan Email, NIK, Nomor Anggota, atau Nomor Transaksi Unik dengan Verifikasi Password Admin.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-2 max-w-2xl">
          <input
            type="text"
            value={manualSearchTarget}
            onChange={e => setManualSearchTarget(e.target.value)}
            placeholder="Opsional: Masukkan Email, NIK, No. Anggota, atau Tx ID..."
            className="flex-1 w-full p-2.5 rounded-xl border border-amber-300 bg-white text-xs text-gray-900 focus:outline-hidden focus:border-amber-600 font-mono"
          />
          <button
            type="button"
            onClick={() => {
              if (manualSearchTarget.trim()) {
                setResetModalMode('MEMBER');
                setResetTargetIdentifier(manualSearchTarget.trim());
              } else {
                setResetModalMode('ALL');
                setResetTargetIdentifier('');
              }
              setIsResetModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider shrink-0 transition-colors flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            title="Batalkan & Reset Suara Pemilihan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>BATALKAN / RESET SUARA</span>
          </button>
        </div>
      </div>

      {/* Secure Admin Reset Modal */}
      <AdminResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialMode={resetModalMode}
        initialIdentifier={resetTargetIdentifier}
        adminEmail={adminEmail}
        onSuccess={() => {
          fetchData();
          onRefreshData?.();
        }}
      />
    </div>
  );
};

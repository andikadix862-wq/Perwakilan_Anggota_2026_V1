import React, { useEffect, useState } from 'react';
import {
  User,
  Building2,
  Award,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  HelpCircle,
  LogOut,
  Sparkles,
  Printer,
  Download
} from 'lucide-react';
import { api, VoterDashboardResponse } from '../services/api';
import { Member, VotingReceiptData } from '../types';
import { PrintReceiptModal } from './PrintReceiptModal';
import { printReceiptDirectly, downloadReceiptHtml } from '../utils/printReceipt';

interface VoterDashboardProps {
  memberEmail: string;
  onStartVoting: () => void;
  onViewReceipt: (txId?: string) => void;
  onLogout: () => void;
}

export const VoterDashboard: React.FC<VoterDashboardProps> = ({
  memberEmail,
  onStartVoting,
  onViewReceipt,
  onLogout
}) => {
  const [data, setData] = useState<VoterDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getVoterDashboard(memberEmail);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data anggota.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [memberEmail]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-600">Memuat profil dan informasi pemilihan...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 bg-white rounded-2xl border border-rose-200 shadow-sm text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-900">Gagal Memuat Data Pemilih</h2>
        <p className="text-sm text-slate-600 mt-1">{error || 'Data tidak tersedia.'}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl"
          >
            Coba Lagi
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  const { member, division_info, config } = data;
  const isSudahMemilih = member.status_memilih === 'SUDAH_MEMILIH';
  const isElectionActive = config.voting_status === 'AKTIF';
  const hasQuota = division_info.kuota_kursi > 0;
  const canVote = !isSudahMemilih && member.hak_pilih && isElectionActive && hasQuota;

  return (
    <div id="voter-dashboard-container" className="max-w-5xl mx-auto py-6 sm:py-10 px-4 sm:px-6 space-y-6">
      {/* Top Banner Status */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
                Portal Pemilih Online
              </span>
              <span className="text-xs text-gray-400 font-mono">Periode {config.periode_pemilihan}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Selamat Datang, {member.nama}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {config.organisasi} — Suara Anda Menentukan Perwakilan Koperasi
            </p>
          </div>

          <div className="shrink-0">
            {isSudahMemilih ? (
              <div id="status-sudah-memilih-banner" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>SUDAH MEMILIH</span>
              </div>
            ) : member.hak_pilih ? (
              <div id="status-belum-memilih-banner" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>BELUM MEMILIH</span>
              </div>
            ) : (
              <div id="status-tanpa-hak-pilih-banner" className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>TIDAK BERHAK MEMILIH</span>
              </div>
            )}
          </div>
        </div>

        {/* Voter Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
              Nomor Anggota
            </span>
            <span className="text-sm font-bold text-gray-900 font-mono">{member.nomor_anggota}</span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
              NIK Karyawan
            </span>
            <span className="text-sm font-bold text-gray-900 font-mono">{member.nik}</span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
              Bagian / Divisi
            </span>
            <span className="text-sm font-bold text-gray-900 truncate block">{member.nama_bagian}</span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block mb-1">
              Hak Suara
            </span>
            <span className={`text-sm font-bold ${member.hak_pilih ? 'text-emerald-700' : 'text-rose-600'}`}>
              {member.hak_pilih ? 'Aktif (1 Suara)' : 'Non-Aktif'}
            </span>
          </div>
        </div>

        {/* Division Quota Notification Box (PRD Section 12) */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950">
                Alokasi Kuota: Bagian {division_info.nama_bagian} memiliki{' '}
                <span className="text-blue-700 font-black">{division_info.kuota_kursi} Kursi Perwakilan</span>
              </h3>
              <p className="text-xs text-blue-800 mt-0.5">
                Dihitung otomatis berdasarkan rasio 10:1 dari {division_info.total_anggota_bagian} total anggota bagian. Setiap anggota berhak memberikan <strong>1 suara untuk 1 kandidat</strong>.
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span className="inline-block px-3 py-1 bg-white rounded-lg text-xs font-bold text-blue-900 border border-blue-200 shadow-2xs font-mono">
              {division_info.total_kandidat_aktif} Kandidat Terdaftar
            </span>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-gray-500 flex items-center gap-2 font-medium">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>Pilihan suara Anda dienkripsi dan tidak dapat diubah setelah konfirmasi.</span>
          </div>

          <div>
            {canVote ? (
              <button
                id="btn-mulai-pemilihan"
                onClick={onStartVoting}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2.5"
              >
                <span>MULAI PEMILIHAN</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : isSudahMemilih ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>✅ Anda Sudah Memilih</span>
                </span>

                <button
                  id="btn-lihat-bukti-suara"
                  type="button"
                  onClick={() => onViewReceipt(member.transaction_id || undefined)}
                  className="px-5 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <FileText className="w-4 h-4 text-white" />
                  <span>Lihat Bukti Suara & Klasemen</span>
                </button>

                <button
                  id="btn-cetak-bukti-dasbor"
                  type="button"
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="px-4 py-3 rounded-xl bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold text-xs uppercase tracking-wider shadow-2xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-gray-500" />
                  <span>Cetak Bukti</span>
                </button>
              </div>
            ) : !isElectionActive ? (
              <div className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider">
                Periode Pemilihan Sedang {config.voting_status}
              </div>
            ) : !hasQuota ? (
              <div className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider">
                Bagian ini Tidak Memiliki Alokasi Kursi (Kuota 0)
              </div>
            ) : (
              <div className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-wider">
                Anda Tidak Memiliki Hak Pilih
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rules & Guidelines */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-4">
          <HelpCircle className="w-4 h-4 text-gray-500" />
          Tata Cara & Ketentuan Pemilihan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="font-bold text-gray-900 block mb-1 uppercase text-[11px] tracking-wide">1. Kandidat Bagian Sendiri</span>
            Setiap anggota hanya memilih calon perwakilan dari divisinya sendiri. Kandidat bagian lain tidak akan ditampilkan.
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="font-bold text-gray-900 block mb-1 uppercase text-[11px] tracking-wide">2. Satu Anggota Satu Suara</span>
            Setiap anggota memilih tepat 1 kandidat perwakilan. Kandidat peraih suara terbanyak akan menduduki {division_info.kuota_kursi} kursi perwakilan bagian.
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <span className="font-bold text-gray-900 block mb-1 uppercase text-[11px] tracking-wide">3. Satu Kali Voting</span>
            Setelah mengirim suara, sistem akan mencatat status "SUDAH MEMILIH" dan menghasilkan nomor bukti transaksi unik.
          </div>
        </div>
      </div>

      {/* Print Receipt Modal */}
      {isSudahMemilih && (
        <PrintReceiptModal
          receipt={{
            transaction_id: member.transaction_id || `TX-YKK-${Date.now()}`,
            voted_at: member.voted_at || new Date().toISOString(),
            nama: member.nama,
            nomor_anggota: member.nomor_anggota,
            nik: member.nik,
            bagian_id: member.bagian_id,
            nama_bagian: member.nama_bagian,
            status_memilih: member.status_memilih,
            organisasi: config.organisasi || 'KOPSYAH YKK AP INDONESIA',
            periode_pemilihan: config.periode_pemilihan || '2026',
            nama_sistem: config.nama_sistem || 'Sistem Pemilihan Anggota Perwakilan Online',
            jabatan: member.jabatan
          }}
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
        />
      )}
    </div>
  );
};

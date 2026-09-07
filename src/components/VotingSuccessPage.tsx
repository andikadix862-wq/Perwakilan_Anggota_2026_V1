import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileCheck,
  Printer,
  ArrowRight,
  ShieldCheck,
  Lock,
  Vote,
  Calendar,
  Building2,
  UserCheck,
  Download,
  ExternalLink,
  Trophy,
  Award,
  Users,
  BarChart3,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api, SubmitVoteResponse, VoterDashboardResponse } from '../services/api';
import { Candidate, Member, VotingReceiptData } from '../types';
import { PrintReceiptModal } from './PrintReceiptModal';
import {
  downloadReceiptHtml,
  openReceiptInNewTab,
  printReceiptDirectly
} from '../utils/printReceipt';

interface VotingSuccessPageProps {
  member: Member;
  voteResult: SubmitVoteResponse | null;
  onBackToDashboard: () => void;
}

export const VotingSuccessPage: React.FC<VotingSuccessPageProps> = ({
  member,
  voteResult,
  onBackToDashboard
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  // Standings / Leaderboard State
  const [divisionCandidates, setDivisionCandidates] = useState<Candidate[]>([]);
  const [dashboardData, setDashboardData] = useState<VoterDashboardResponse | null>(null);
  const [loadingStandings, setLoadingStandings] = useState<boolean>(true);

  const fetchDivisionStandings = async () => {
    try {
      setLoadingStandings(true);
      const [candRes, dashRes] = await Promise.all([
        api.getVoterCandidates(member.email),
        api.getVoterDashboard(member.email)
      ]);
      const validCands = (candRes.candidates || []).filter(c => c.bagian_id === member.bagian_id);
      setDivisionCandidates(validCands);
      setDashboardData(dashRes);
    } catch (err) {
      console.warn('Gagal memuat klasemen bagian:', err);
    } finally {
      setLoadingStandings(false);
    }
  };

  useEffect(() => {
    fetchDivisionStandings();
  }, [member.email, member.bagian_id]);

  const kuotaKursi = dashboardData?.division_info.kuota_kursi || 1;
  const totalAnggotaBagian = dashboardData?.division_info.total_anggota_bagian || divisionCandidates.length || 0;
  const totalSuaraDivisi = divisionCandidates.reduce((sum, c) => sum + (c.total_suara || 0), 0);
  const maxVotesInDiv = divisionCandidates.length > 0 ? Math.max(...divisionCandidates.map(c => c.total_suara || 0), 0) : 0;

  // Sorted candidates descending by total_suara
  const sortedCandidates = [...divisionCandidates].sort((a, b) => {
    const diff = (b.total_suara || 0) - (a.total_suara || 0);
    if (diff !== 0) return diff;
    return a.nomor_urut - b.nomor_urut;
  });

  const txId = voteResult?.transaction_id || member.transaction_id || `TX-YKK-${Date.now()}`;
  const timestamp = voteResult?.timestamp || member.voted_at || new Date().toISOString();
  const namaBagian = voteResult?.nama_bagian || member.nama_bagian;

  const receiptData: VotingReceiptData = {
    transaction_id: txId,
    voted_at: timestamp,
    nama: member.nama,
    nomor_anggota: member.nomor_anggota,
    nik: member.nik,
    bagian_id: member.bagian_id,
    nama_bagian: namaBagian,
    status_memilih: 'SUDAH_MEMILIH',
    organisasi: 'KOPSYAH YKK AP INDONESIA',
    periode_pemilihan: '2026',
    nama_sistem: 'Sistem Pemilihan Anggota Perwakilan Online',
    jabatan: member.jabatan
  };

  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }
  }, []);

  const handlePrint = () => {
    setPrintFeedback('Membuka dialog pencetakan...');
    try {
      const res = printReceiptDirectly(receiptData);
      if (res.methodUsed === 'new_tab') {
        setPrintFeedback('Dokumen bukti dibuka di tab baru untuk dicetak.');
      } else if (res.methodUsed === 'download') {
        setPrintFeedback('File bukti berhasil diunduh.');
      } else {
        setPrintFeedback('Dialog cetak aktif.');
      }
    } catch {
      // Open interactive modal preview if any block occurs
      setIsModalOpen(true);
    }

    setTimeout(() => {
      setPrintFeedback(null);
    }, 4000);
  };

  const handleDownload = () => {
    downloadReceiptHtml(receiptData);
    setPrintFeedback('File bukti pemilihan resmi berhasil diunduh ke perangkat Anda.');
    setTimeout(() => setPrintFeedback(null), 3500);
  };

  const formattedDate = new Date(timestamp).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });

  return (
    <div id="voting-success-container" className="max-w-2xl mx-auto py-8 sm:py-12 px-4 sm:px-6 space-y-6">
      {printFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {printFeedback}
          </span>
          <button
            onClick={() => setPrintFeedback(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 underline font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Printable Receipt Card (PRD Section 29) */}
      <div id="print-area" className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm text-center relative overflow-hidden">
        {/* Background Watermark */}
        <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
          <Vote className="w-64 h-64 text-blue-900" />
        </div>

        {/* Top Success Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-2xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider mb-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Suara Terverifikasi & Disimpan
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          VOTING BERHASIL
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-md mx-auto leading-relaxed">
          Terima kasih. Suara Anda telah berhasil dicatat pada sistem pemilihan resmi KOPSYAH YKK AP Indonesia.
        </p>

        {/* Digital Proof Certificate Box */}
        <div className="mt-8 p-5 rounded-xl bg-gray-50 border border-gray-200 text-left space-y-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                ORGANISASI
              </span>
              <span className="text-xs font-bold text-gray-900">
                KOPSYAH YKK AP INDONESIA
              </span>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-mono text-[10px] font-bold uppercase tracking-wider">
              PERIODE 2026
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <span className="text-gray-500 font-medium block">Nama Pemilih:</span>
              <span className="font-bold text-gray-900">{member.nama}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Nomor Anggota:</span>
              <span className="font-bold text-gray-900 font-mono">{member.nomor_anggota}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Bagian / Divisi:</span>
              <span className="font-bold text-gray-900">{namaBagian}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium block">Status Pemilihan:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                SUDAH MEMILIH
              </span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
              ID TRANSAKSI ELEKTRONIK (BUKTI DIGITAL)
            </span>
            <div className="mt-1 p-2.5 rounded-lg bg-white border border-gray-200 font-mono text-xs font-bold text-blue-950 tracking-wider break-all flex items-center justify-between">
              <span>{txId}</span>
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span className="flex items-center gap-1 font-mono">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {formattedDate}
            </span>
            <span className="font-bold text-blue-700 uppercase tracking-wider text-[10px]">Digital Seal Verified</span>
          </div>
        </div>

        {/* PRD Section 17 & 29 Privacy Note */}
        <div className="mt-5 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-left text-xs text-blue-900 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed text-[11px]">
            <strong>Prinsip Kerahasiaan Suara:</strong> Demi menjaga kerahasiaan pilihan anggota, lembar bukti ini tidak memuat kandidat yang Anda pilih. Pilihan suara telah dienkripsi secara independen di dalam server.
          </p>
        </div>

        {/* Actions Bar (Enhanced with Print, Preview Modal, Download, and New Tab) */}
        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-center gap-3">
          <button
            id="btn-cetak-bukti-voting"
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Bukti Pemilihan</span>
          </button>

          <button
            id="btn-lihat-pratinjau-bukti"
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-blue-700" />
            <span>Pratinjau Bukti</span>
          </button>

          <button
            id="btn-unduh-bukti-voting"
            type="button"
            onClick={handleDownload}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Unduh Berkas</span>
          </button>

          <button
            id="btn-tab-baru-bukti"
            type="button"
            onClick={() => openReceiptInNewTab(receiptData)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title="Buka di Tab Baru untuk Mencetak Bebas Iframe"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            <span>Buka di Tab Baru</span>
          </button>

          <button
            id="btn-kembali-dasbor-sukses"
            type="button"
            onClick={onBackToDashboard}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Kembali ke Dasbor</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel Pemimpin Suara Bagian [Nama Bagian] & Klasemen Real-Time */}
      <div id="panel-pemimpin-suara-bagian" className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                  Pemimpin Suara Bagian {namaBagian}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 uppercase font-mono">
                  Real-Time
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Klasemen Perolehan Suara Kandidat & Progres Keterisian Kursi Perwakilan
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchDivisionStandings}
            disabled={loadingStandings}
            className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loadingStandings ? 'animate-spin' : ''}`} />
            <span>Perbarui Klasemen</span>
          </button>
        </div>

        {/* Quota Seat Progress Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900 to-[#1E3A8A] text-white shadow-2xs space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <span className="flex items-center gap-2 text-blue-100">
              <Building2 className="w-4 h-4 text-amber-300" />
              Progres Keterisian Kuota Kursi Bagian {namaBagian}
            </span>
            <span className="bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded font-black text-[11px] uppercase tracking-wider">
              {totalSuaraDivisi > 0 ? `1 dari ${kuotaKursi} Kursi Terisi Suara Sah` : `0 dari ${kuotaKursi} Kursi Terisi`}
            </span>
          </div>

          <div className="w-full bg-blue-950/60 rounded-full h-2.5 overflow-hidden border border-blue-400/20">
            <div
              className="bg-amber-400 h-2.5 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  totalAnggotaBagian > 0
                    ? Math.round((totalSuaraDivisi / totalAnggotaBagian) * 100)
                    : 0
                )}%`
              }}
            ></div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-blue-200">
            <span>Total Suara Masuk Bagian: <strong>{totalSuaraDivisi} Suara</strong></span>
            <span>Total Anggota Bagian: <strong>{totalAnggotaBagian} Orang</strong></span>
          </div>
        </div>

        {/* Candidates Leaderboard List */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-blue-800" />
            <span>Daftar Perolehan Suara Kandidat Bagian {namaBagian}</span>
          </h3>

          {loadingStandings ? (
            <div className="py-8 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-800" />
              <span>Memuat klasemen suara...</span>
            </div>
          ) : sortedCandidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
              Belum ada kandidat terdaftar untuk Bagian {namaBagian}.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedCandidates.map((cand, idx) => {
                const rank = idx + 1;
                const votes = cand.total_suara || 0;
                const pct = cand.persentase_suara !== undefined
                  ? cand.persentase_suara
                  : (totalSuaraDivisi > 0 ? Math.round((votes / totalSuaraDivisi) * 100) : 0);
                const isLeading = maxVotesInDiv > 0 && votes === maxVotesInDiv;
                const isPotentiallyElected = rank <= kuotaKursi && votes > 0;

                return (
                  <div
                    key={cand.kandidat_id}
                    className={`p-4 rounded-xl border transition-all flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 ${
                      isLeading
                        ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                        : isPotentiallyElected
                        ? 'bg-blue-50/40 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Rank badge */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                        rank === 1 && votes > 0
                          ? 'bg-amber-400 text-slate-900 shadow-2xs'
                          : rank <= kuotaKursi
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        #{rank}
                      </div>

                      {/* Photo / Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center text-gray-600 font-bold text-xs">
                        {cand.foto_url ? (
                          <img
                            src={cand.foto_url}
                            alt={cand.nama}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span>{cand.nama.charAt(0)}</span>
                        )}
                      </div>

                      {/* Candidate Name & Info */}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-xs text-gray-900 truncate">
                            {cand.nama}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 font-mono text-[10px] font-bold">
                            No. Urut {cand.nomor_urut < 10 ? `0${cand.nomor_urut}` : cand.nomor_urut}
                          </span>
                          {isLeading && (
                            <span id="badge-suara-terbanyak" className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                              <Trophy className="w-3 h-3 text-slate-950" />
                              <span>🏆 Suara Terbanyak Saat Ini</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {cand.jabatan || 'Anggota'} • NIK: {cand.nik || '-'}
                        </p>
                      </div>
                    </div>

                    {/* Vote Count & Percent */}
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <div className="text-sm font-black text-gray-900 font-mono">
                          {votes} <span className="text-xs font-semibold text-gray-500">Suara</span>
                        </div>
                        <div className="text-[11px] font-bold text-blue-700 font-mono">
                          {pct}%
                        </div>
                      </div>

                      {isPotentiallyElected && (
                        <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Potensi Terpilih
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Modal Preview & Print Dialog */}
      <PrintReceiptModal
        receipt={receiptData}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};

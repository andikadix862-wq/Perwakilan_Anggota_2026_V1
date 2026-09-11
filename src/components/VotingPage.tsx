import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Vote,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Users,
  Award,
  Lock,
  Building2,
  HelpCircle,
  FileCheck,
  Search,
  X,
  UserCheck,
  UserX,
  Trophy,
  Flame,
  ArrowUpDown,
  Filter,
  BarChart3,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { api, VoterDashboardResponse, SubmitVoteResponse } from '../services/api';
import { Candidate, Member } from '../types';
import { ConfirmationModal } from './ConfirmationModal';

interface VotingPageProps {
  member: Member;
  token: string | null;
  onBack: () => void;
  onVoteSuccess: (result: SubmitVoteResponse) => void;
}

export const VotingPage: React.FC<VotingPageProps> = ({
  member,
  onBack,
  onVoteSuccess
}) => {
  const [dashboardData, setDashboardData] = useState<VoterDashboardResponse | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Sorting: 'suara_terbanyak' | 'nomor_urut' | 'nama'
  const [sortOption, setSortOption] = useState<'suara_terbanyak' | 'nomor_urut' | 'nama'>('nama');
  // Filter tab: 'all' | 'ada_suara' | 'eligible' | 'ineligible'
  const [filterTab, setFilterTab] = useState<'all' | 'ada_suara' | 'eligible' | 'ineligible'>('all');
  const [divisionTotalVotes, setDivisionTotalVotes] = useState<number>(0);

  // Single selection: 1 Anggota = 1 Suara = 1 Kandidat
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [dashRes, candRes] = await Promise.all([
          api.getVoterDashboard(member.email),
          api.getVoterCandidates(member.email)
        ]);
        setDashboardData(dashRes);

        // STRICT DIVISION FILTERING:
        // Ensure ALL candidates/members from the voter's division are retained
        const validCandidates = (candRes.candidates || []).filter(
          (c: Candidate) => c.bagian_id === member.bagian_id
        );
        setCandidates(validCandidates);
        const sumVotes = candRes.total_suara_divisi !== undefined
          ? candRes.total_suara_divisi
          : validCandidates.reduce((acc, c) => acc + (c.total_suara || 0), 0);
        setDivisionTotalVotes(sumVotes);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat surat suara.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [member.email, member.bagian_id]);

  const kuotaKursi = dashboardData?.division_info.kuota_kursi || 1;
  const totalAnggotaBagian = dashboardData?.division_info.total_anggota_bagian || candidates.length || 0;

  // Helper to determine candidate retirement & eligibility status
  const isCandidateEligibleToVote = (cand: Candidate): boolean => {
    if (cand.memenuhi_syarat === false) return false;
    if (cand.hak_dipilih === false) return false;
    if (cand.is_pensiun_warning === true) return false;
    if (cand.sisa_pensiun_tahun !== null && cand.sisa_pensiun_tahun !== undefined && cand.sisa_pensiun_tahun < 4) {
      return false;
    }
    return true;
  };

  // Check if voter has already cast their vote
  const isAlreadyVoted =
    member.status_memilih === 'SUDAH_MEMILIH' ||
    dashboardData?.member.status_memilih === 'SUDAH_MEMILIH';

  // Single Selection Handler: selecting an eligible candidate replaces previous selection
  const handleSelectCandidate = (candidate: Candidate) => {
    if (!isCandidateEligibleToVote(candidate)) {
      return;
    }
    setSelectedCandidateId(candidate.kandidat_id);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedCandidateId) {
      alert('Silakan pilih 1 kandidat perwakilan terlebih dahulu.');
      return;
    }
    if (!token) {
      alert('Sesi tidak valid. Silakan login kembali.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.submitVote(selectedCandidateId, token);
      if (res.success) {
        setIsModalOpen(false);
        // Lock page and navigate to thank-you/receipt page
        onVoteSuccess(res);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mengirim suara. Silakan coba kembali.');
      setIsModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCandidate = candidates.find(c => c.kandidat_id === selectedCandidateId);

  // Helper calculations for real-time division vote stats
  const totalSuaraDivisi = divisionTotalVotes > 0
    ? divisionTotalVotes
    : candidates.reduce((sum, c) => sum + (c.total_suara || 0), 0);
  const maxVotesInDiv = candidates.length > 0 ? Math.max(...candidates.map(c => c.total_suara || 0), 0) : 0;
  const candidatesWithVotes = candidates.filter(c => (c.total_suara || 0) > 0);
  const leadingCandidates = candidates.filter(c => maxVotesInDiv > 0 && (c.total_suara || 0) === maxVotesInDiv);
  const topCandidate = leadingCandidates[0] || null;
  const partisipasiPersen = candidates.length > 0
    ? Math.min(100, Math.round((totalSuaraDivisi / candidates.length) * 100))
    : 0;

  // Filter & Sort candidates
  const processedCandidates = candidates
    .filter(cand => {
      // 1. Text Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          cand.nama.toLowerCase().includes(q) ||
          (cand.nik && cand.nik.toLowerCase().includes(q)) ||
          (cand.nomor_anggota && cand.nomor_anggota.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // 2. Filter Tab
      if (filterTab === 'ada_suara') {
        return (cand.total_suara || 0) > 0;
      }
      if (filterTab === 'eligible') {
        return isCandidateEligibleToVote(cand);
      }
      if (filterTab === 'ineligible') {
        return !isCandidateEligibleToVote(cand);
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOption === 'suara_terbanyak') {
        const diff = (b.total_suara || 0) - (a.total_suara || 0);
        if (diff !== 0) return diff;
        return a.nomor_urut - b.nomor_urut;
      }
      if (sortOption === 'nama') {
        return a.nama.localeCompare(b.nama);
      }
      return a.nomor_urut - b.nomor_urut;
    });

  const totalEligibleCandidates = candidates.filter(isCandidateEligibleToVote).length;
  const totalIneligibleCandidates = candidates.length - totalEligibleCandidates;

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-[#1E3A8A] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-600">Menyiapkan surat suara elektronik...</p>
      </div>
    );
  }

  // 2. Already Voted / Locked Page State (Post-Vote Security)
  if (isAlreadyVoted) {
    const txId = member.transaction_id || dashboardData?.member.transaction_id || `TX-YKK-${Date.now()}`;
    const votedDate = member.voted_at || dashboardData?.member.voted_at;

    return (
      <div id="voting-locked-screen" className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
          <Lock className="w-3.5 h-3.5" />
          <span>Hak Suara Telah Digunakan (Terkunci)</span>
        </div>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
          Halaman Pemilihan Dikunci
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">
          Status Anda telah tercatat sebagai <strong>SUDAH MEMILIH</strong> untuk <strong>Bagian {member.nama_bagian}</strong>.
          Sesuai ketentuan anggaran dasar dan prinsip <strong>Satu Anggota Satu Suara</strong>, setiap pemilih hanya berhak memberikan suara 1 kali dan tidak dapat memilih ulang.
        </p>

        {votedDate && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 font-mono">
            Waktu Pemilihan: {new Date(votedDate).toLocaleString('id-ID')}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
          >
            Kembali ke Dasbor
          </button>
          <button
            type="button"
            onClick={() =>
              onVoteSuccess({
                success: true,
                message: 'Suara telah tercatat sebelumnya.',
                transaction_id: txId,
                timestamp: votedDate || new Date().toISOString(),
                nama_bagian: member.nama_bagian,
                kuota_kursi: kuotaKursi
              })
            }
            className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <FileCheck className="w-4 h-4" />
            <span>Lihat Bukti Pemilihan</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Candidates not available for voter's division
  if (error || candidates.length === 0) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-6 sm:p-8 bg-white rounded-2xl border border-gray-200 shadow-sm text-center">
        <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">
          <span>Kandidat Belum Tersedia</span>
        </div>
        <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">
          Belum Ada Anggota Terdaftar di Bagian Ini
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-2 max-w-md mx-auto leading-relaxed">
          {error || `Saat ini belum ada data anggota yang terdaftar untuk Bagian ${member.nama_bagian}. Silakan hubungi Panitia Pemilihan untuk informasi lebih lanjut.`}
        </p>
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Kembali ke Dasbor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="voting-page-container" className="max-w-5xl mx-auto py-6 sm:py-10 px-4 sm:px-6 pb-32 space-y-6">
      {/* Navigation & Header */}
      <div className="flex items-center justify-between">
        <button
          id="btn-kembali-ke-dasbor"
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-700 shadow-2xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dasbor</span>
        </button>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-bold block">
            Surat Suara Digital
          </span>
          <span className="text-xs font-black text-gray-900 font-mono">
            #{member.nomor_anggota}
          </span>
        </div>
      </div>

      {/* Header Info Card: Strict Division Filtering & Rules */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200 text-xs font-bold uppercase tracking-wider mb-2">
              <Vote className="w-3.5 h-3.5 text-blue-700" />
              <span>Surat Suara Resmi Perwakilan</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight uppercase">
              Bagian {member.nama_bagian}
            </h1>

            {/* Division metadata pills */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 font-mono">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                {candidates.length} Total Anggota
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900 font-mono">
                <Award className="w-3.5 h-3.5 text-blue-700" />
                {kuotaKursi} Kursi Perwakilan
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 font-mono">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                {totalEligibleCandidates} Berhak Dipilih
              </span>
              {totalIneligibleCandidates > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 font-mono">
                  <UserX className="w-3.5 h-3.5 text-amber-600" />
                  {totalIneligibleCandidates} Hanya Pemilih
                </span>
              )}
            </div>

            {/* Rule explanation notice */}
            <div className="mt-4 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 leading-relaxed space-y-1">
              <p className="font-bold text-blue-900">
                Ketentuan Surat Suara Bagian {member.nama_bagian}:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-900/90 pl-1 text-[11px] sm:text-xs">
                <li>
                  Surat suara menampilkan <strong>seluruh anggota</strong> yang terdaftar di Bagian {member.nama_bagian}.
                </li>
                <li>
                  Anggota dengan sisa masa pensiun <strong>kurang dari 4 tahun</strong> (usia 51+ tahun) berstatus <strong>Hanya Pemilih</strong> dan tombol pemilihannya dinonaktifkan.
                </li>
                <li>
                  Setiap pemilih berhak memilih <strong>tepat 1 (satu) calon perwakilan</strong> yang memenuhi syarat.
                </li>
              </ul>
            </div>
          </div>

          {/* Current Selection Status Badge */}
          <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
            <div className={`px-4 py-3 rounded-xl border text-right transition-colors ${
              selectedCandidateId
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-2xs'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}>
              <span className="text-[10px] uppercase tracking-wider font-bold block text-gray-500">
                Status Pilihan
              </span>
              <span className="text-sm sm:text-base font-black font-mono flex items-center gap-1.5 justify-end mt-0.5">
                {selectedCandidateId ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    <span className="text-emerald-800">1 Kandidat Dipilih</span>
                  </>
                ) : (
                  <span className="text-amber-700 font-bold text-xs">Belum Memilih (0/1)</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Division Vote Statistics Summary Panel (Statistik Ringkas Perolehan Suara Bagian) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1E3A8A]">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-tight">
                Statistik Sementara Perolehan Suara Bagian {member.nama_bagian}
              </h2>
              <p className="text-[11px] text-gray-500">
                Data akumulasi suara masuk diupdate secara langsung dan real-time
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Pemilihan Sedang Berlangsung</span>
          </div>
        </div>

        {/* 4 Summary KPI Widgets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* KPI 1: Total Suara Masuk */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-gray-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Total Suara Masuk</span>
              <Vote className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-gray-900 font-mono">
              {totalSuaraDivisi} <span className="text-xs font-semibold text-gray-500 font-sans">Suara</span>
            </div>
            <div className="mt-1 text-[11px] text-gray-600 font-medium flex items-center gap-1">
              <span className="font-bold text-blue-900">{partisipasiPersen}% Partisipasi</span>
              <span>({totalSuaraDivisi}/{candidates.length} pemilih)</span>
            </div>
          </div>

          {/* KPI 2: Kandidat Unggulan Sementara */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
            <div className="flex items-center justify-between text-amber-900 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Unggulan Sementara</span>
              <Trophy className="w-3.5 h-3.5 text-amber-600" />
            </div>
            {topCandidate && maxVotesInDiv > 0 ? (
              <div>
                <div className="text-sm font-extrabold text-gray-900 truncate" title={topCandidate.nama}>
                  {topCandidate.nama}
                </div>
                <div className="mt-0.5 text-xs font-bold text-amber-900 font-mono flex items-center gap-1.5">
                  <span className="bg-amber-200/80 px-1.5 py-0.2 rounded">{maxVotesInDiv} Suara</span>
                  <span className="text-[11px] text-gray-600 font-sans">
                    ({totalSuaraDivisi > 0 ? Math.round((maxVotesInDiv / totalSuaraDivisi) * 100) : 0}%)
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-bold text-gray-600">Belum Ada Suara</div>
                <div className="mt-0.5 text-[11px] text-gray-500">Menunggu suara pertama</div>
              </div>
            )}
          </div>

          {/* KPI 3: Kuota Kursi */}
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="flex items-center justify-between text-blue-900 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Kursi Perwakilan</span>
              <Award className="w-3.5 h-3.5 text-blue-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-950 font-mono">
              {kuotaKursi} <span className="text-xs font-semibold text-blue-800 font-sans">Kursi</span>
            </div>
            <div className="mt-1 text-[11px] text-blue-800 font-medium">
              Rasio keterwakilan 10:1 Bagian
            </div>
          </div>

          {/* KPI 4: Kandidat Berperolehan Suara */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <div className="flex items-center justify-between text-emerald-900 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>Calon Terpilih Sementara</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
              {candidatesWithVotes.length} <span className="text-xs font-semibold text-emerald-800 font-sans">Kandidat</span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-800 font-medium">
              Telah memperoleh suara sah
            </div>
          </div>
        </div>

        {/* LUBER Secret Ballot Assurance Box (Prinsip Kerahasiaan Suara) */}
        <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex items-start gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-emerald-900 flex items-center gap-2">
              Jaminan Kerahasiaan Suara (Prinsip LUBER)
              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-bold">100% Anonim</span>
            </span>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Sistem hanya menampilkan akumulasi total suara per kandidat. Identitas dan nama pemilih yang telah memberikan suara <strong>dijamin sepenuhnya rahasia</strong> dan tidak dicatat atau ditampilkan kepada siapapun.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Sorting Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-[#1E3A8A] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semua ({candidates.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ada_suara')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                filterTab === 'ada_suara'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Trophy className="w-3 h-3" />
              <span>Ada Suara ({candidatesWithVotes.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('eligible')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                filterTab === 'eligible'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Berhak Dipilih ({totalEligibleCandidates})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ineligible')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                filterTab === 'ineligible'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
              }`}
            >
              <UserX className="w-3 h-3" />
              <span>Hanya Pemilih ({totalIneligibleCandidates})</span>
            </button>
          </div>

          {/* Search Box & Sort Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            {/* Real-time Search Box */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-search-kandidat"
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari nama, NIK, atau no. anggota..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-300 focus:border-[#1E3A8A] focus:ring-2 focus:ring-blue-100 outline-hidden bg-white shadow-2xs font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-wider hidden sm:inline flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Urutkan:
              </span>
              <div className="inline-flex rounded-xl bg-gray-100 p-0.5 border border-gray-200">
                <button
                  type="button"
                  id="btn-sort-suara"
                  onClick={() => setSortOption('suara_terbanyak')}
                  title="Urutkan berdasarkan Suara Terbanyak"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    sortOption === 'suara_terbanyak'
                      ? 'bg-white text-blue-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Trophy className="w-3 h-3 text-amber-500" />
                  <span>Suara Terbanyak</span>
                </button>
                <button
                  type="button"
                  id="btn-sort-nomor"
                  onClick={() => setSortOption('nomor_urut')}
                  title="Urutkan berdasarkan Nomor Urut"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sortOption === 'nomor_urut'
                      ? 'bg-white text-blue-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  No. Urut
                </button>
                <button
                  type="button"
                  id="btn-sort-nama"
                  onClick={() => setSortOption('nama')}
                  title="Urutkan berdasarkan Nama"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sortOption === 'nama'
                      ? 'bg-white text-blue-900 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Nama
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Menampilkan <strong>{processedCandidates.length}</strong> dari <strong>{candidates.length}</strong> anggota Bagian {member.nama_bagian}
          </span>
          {sortOption === 'suara_terbanyak' && (
            <span className="text-blue-800 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Diurutkan: Kandidat Terpopuler / Perolehan Suara Terbanyak
            </span>
          )}
        </div>
      </div>

      {/* Candidates List Grid: Selectable Card & Radio Button */}
      {processedCandidates.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-2xl border border-gray-200 shadow-2xs">
          <div className="max-w-md mx-auto space-y-2">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <Search className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-gray-800">
              Anggota Tidak Ditemukan
            </p>
            <p className="text-xs text-gray-500">
              Tidak ada anggota di Bagian {member.nama_bagian} yang sesuai dengan filter atau kata kunci "{searchQuery}".
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterTab('all');
              }}
              className="mt-2 text-xs text-[#1E3A8A] font-bold underline cursor-pointer"
            >
              Reset Filter & Pencarian
            </button>
          </div>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-label={`Daftar calon perwakilan Bagian ${member.nama_bagian}`}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5"
        >
          {processedCandidates.map(cand => {
            const isEligible = isCandidateEligibleToVote(cand);
            const isSelected = selectedCandidateId === cand.kandidat_id;
            const candVotes = cand.total_suara || 0;
            const isTopCandidate = maxVotesInDiv > 0 && candVotes === maxVotesInDiv;
            const votePercent = totalSuaraDivisi > 0
              ? Math.round((candVotes / totalSuaraDivisi) * 1000) / 10
              : 0;

            return (
              <div
                key={cand.kandidat_id}
                id={`card-kandidat-${cand.nomor_urut}`}
                role={isEligible ? 'radio' : 'article'}
                aria-checked={isEligible ? isSelected : undefined}
                aria-disabled={!isEligible}
                tabIndex={isEligible ? 0 : -1}
                onClick={() => {
                  if (isEligible) {
                    handleSelectCandidate(cand);
                  }
                }}
                onKeyDown={e => {
                  if (isEligible && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    handleSelectCandidate(cand);
                  }
                }}
                className={`relative rounded-2xl border transition-all select-none overflow-hidden flex flex-col justify-between p-5 sm:p-6 ${
                  !isEligible
                    ? 'bg-slate-50/70 border-slate-200 shadow-2xs opacity-90 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-50/50 border-[#1E3A8A] ring-2 ring-[#1E3A8A]/40 shadow-md cursor-pointer'
                    : isTopCandidate
                    ? 'bg-white hover:bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/60 shadow-xs cursor-pointer'
                    : 'bg-white hover:bg-gray-50/80 border-gray-200 shadow-2xs hover:border-blue-300 cursor-pointer'
                }`}
              >
                <div>
                  {/* Top Bar: Ballot Number & Status / Radio */}
                  <div className="flex items-start justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center shadow-2xs ${
                          isEligible ? 'bg-[#1E3A8A] text-white' : 'bg-slate-400 text-white'
                        }`}
                      >
                        {cand.nomor_urut}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 font-mono">
                        No. Urut {cand.nomor_urut}
                      </span>

                      {/* Badge for Candidate with Highest Votes in the Division */}
                      {isTopCandidate && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-[10px] font-extrabold shadow-2xs animate-in fade-in duration-200">
                          <Trophy className="w-3 h-3 text-amber-600" />
                          <span>Unggulan Sementara ({candVotes} Suara)</span>
                        </span>
                      )}
                    </div>

                    {/* Right Header Status: Radio for Eligible vs Badge for Ineligible */}
                    <div className="shrink-0 pt-0.5 flex items-center gap-1.5">
                      {isEligible ? (
                        <>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-wider mr-1 hidden sm:inline">
                              Dipilih
                            </span>
                          )}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'border-[#1E3A8A] bg-white'
                                : 'border-gray-300 bg-white hover:border-gray-400'
                            }`}
                          >
                            {isSelected && (
                              <div className="w-3 h-3 rounded-full bg-[#1E3A8A] animate-in zoom-in-75 duration-100" />
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100/90 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase tracking-wider shadow-2xs">
                          <Lock className="w-3 h-3 text-amber-700" />
                          <span>Hanya Pemilih</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Candidate Details */}
                  <div className="flex items-start gap-4">
                    <img
                      src={
                        cand.foto ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.nama)}&background=1E3A8A&color=fff&size=128&bold=true`
                      }
                      alt={cand.nama}
                      className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover border shrink-0 shadow-2xs ${
                        isEligible ? 'border-gray-200' : 'border-slate-200 grayscale-30'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-base font-extrabold leading-tight ${isEligible ? 'text-gray-900' : 'text-slate-800'}`}>
                        {cand.nama}
                      </h3>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        No. Anggota: <span className="font-bold text-gray-700">{cand.nomor_anggota}</span>
                        {cand.nik && <span className="ml-2 text-gray-400">| NIK: {cand.nik}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-bold uppercase tracking-wider">
                          Bagian {cand.nama_bagian}
                        </span>
                        {cand.jabatan && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                            {cand.jabatan}
                          </span>
                        )}
                        {cand.is_pengurus_bpk && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">
                            {cand.tipe_pengurus_bpk || 'Pengurus / BPK'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vote Accumulation Indicator (Indikator Akumulasi Perolehan Suara) */}
                  <div className="mt-3.5 p-3 rounded-xl bg-slate-50/90 border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        <span>Perolehan Suara Sementara:</span>
                      </span>
                      <span className={`font-extrabold font-mono text-xs px-2.5 py-0.5 rounded border ${
                        candVotes > 0
                          ? 'bg-blue-100 text-blue-950 border-blue-300'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {candVotes} Suara ({votePercent}%)
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isTopCandidate
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                            : 'bg-[#1E3A8A]'
                        }`}
                        style={{
                          width: `${
                            totalSuaraDivisi > 0
                              ? Math.min(100, Math.max(candVotes > 0 ? 5 : 0, ((candVotes / totalSuaraDivisi) * 100)))
                              : 0
                          }%`
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="font-medium">
                        {candVotes > 0
                          ? `Dipilih oleh ${candVotes} anggota`
                          : 'Belum ada anggota yang memilih'}
                      </span>
                      {isTopCandidate ? (
                        <span className="text-amber-800 font-extrabold flex items-center gap-1">
                          <Flame className="w-3 h-3 text-amber-600" />
                          Suara Terbanyak di Bagian Ini
                        </span>
                      ) : (
                        <span>Total masuk: {totalSuaraDivisi} suara</span>
                      )}
                    </div>
                  </div>

                  {/* Warning Badge for Ineligible (Pengurus/BPK or < 4 Years Pension) */}
                  {!isEligible && (
                    <div className="mt-3.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-bold text-amber-900">
                          {cand.is_pengurus_bpk
                            ? `Tidak dapat dipilih (${cand.tipe_pengurus_bpk || 'Pengurus/BPK'} - Hanya Pemilih)`
                            : 'Tidak dapat dipilih (Sisa Masa Pensiun < 4 tahun)'}
                        </p>
                        <p className="text-[11px] text-amber-800/95 leading-relaxed">
                          {cand.is_pengurus_bpk
                            ? 'Menjabat sebagai Pengurus atau BPK koperasi, sesuai AD/ART hanya memiliki Hak Memilih dan tidak dapat dicalonkan sebagai perwakilan.'
                            : 'Anggota hanya status Pemilih, sesuai dengan ketentuan AD/ART sisa masa dinas minimal 4 tahun.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Visi & Misi for Eligible Candidates */}
                  {isEligible && cand.visi_misi && (
                    <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl">
                      <span className="font-bold text-gray-900 block mb-0.5 uppercase text-[10px] tracking-wider">
                        Visi & Program Kerja:
                      </span>
                      {cand.visi_misi}
                    </div>
                  )}
                </div>

                {/* Bottom Selection / Disabled Action Button */}
                <div className="mt-5 pt-3 border-t border-gray-100">
                  {isEligible ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        handleSelectCandidate(cand);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-[#1E3A8A] text-white shadow-xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-white' : 'border-gray-400'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span>{isSelected ? 'KANDIDAT PILIHAN ANDA' : 'PILIH KANDIDAT INI'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2 select-none shadow-none"
                    >
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {cand.is_pengurus_bpk
                          ? 'TIDAK DAPAT DIPILIH (PENGURUS / BPK)'
                          : 'TIDAK DAPAT DIPILIH (PENSIUN < 4 THN)'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Bar for [Kirim Suara] Action */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200 py-3.5 px-4 sm:px-6 z-30 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            {selectedCandidate ? (
              <span>
                Pilihan Anda: <strong>{selectedCandidate.nama}</strong> (Nomor Urut {selectedCandidate.nomor_urut}) — Bagian {member.nama_bagian}
              </span>
            ) : (
              <span className="text-amber-700 font-semibold">
                Silakan pilih 1 kandidat perwakilan di atas untuk mengaktifkan tombol Kirim Suara.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {selectedCandidateId && (
              <button
                id="btn-batal-pilihan"
                type="button"
                onClick={() => setSelectedCandidateId(null)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                Batal Pilih
              </button>
            )}

            {/* Mandated Button: [Kirim Suara] */}
            <button
              id="btn-kirim-suara"
              type="button"
              disabled={!selectedCandidateId || submitting}
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-none px-7 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Vote className="w-4 h-4" />
              <span>KIRIM SUARA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isModalOpen}
        selectedCandidate={selectedCandidate}
        namaBagian={member.nama_bagian}
        isSubmitting={submitting}
        onClose={() => setIsModalOpen(false)}
        onConfirmSubmit={handleConfirmSubmit}
      />
    </div>
  );
};

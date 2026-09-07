import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Edit2,
  Trash2,
  RotateCcw,
  Check,
  X,
  FileSpreadsheet,
  HelpCircle,
  Printer,
  Sparkles,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  Award
} from 'lucide-react';
import { api } from '../../services/api';
import { Member, Division } from '../../types';
import { PrintReceiptModal } from '../PrintReceiptModal';
import {
  calculateMemberPension,
  checkPengurusOrBPK,
  checkPegawai,
  formatIndonesianDate,
  parseIndonesianDate,
  RETIREMENT_AGE,
  WARNING_PENSION_THRESHOLD_YEARS
} from '../../utils/pension';
import { exportToExcel } from '../../utils/exportUtils';

interface AdminMembersProps {
  adminEmail: string;
  onNavigateToImport?: () => void;
  onRefreshData?: () => void;
}

export const AdminMembers: React.FC<AdminMembersProps> = ({ adminEmail, onNavigateToImport, onRefreshData }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBagian, setFilterBagian] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterHakPilih, setFilterHakPilih] = useState('ALL');
  const [filterPensiun, setFilterPensiun] = useState<'ALL' | 'WARNING' | 'PENGURUS_BPK' | 'PEGAWAI' | 'SAFE'>('ALL');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [targetResetMember, setTargetResetMember] = useState<Member | null>(null);
  const [resetReason, setResetReason] = useState('Pengujian ulang sistem');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptMember, setSelectedReceiptMember] = useState<Member | null>(null);

  // Form State for Add/Edit
  const [formMember, setFormMember] = useState<Partial<Member>>({
    email: '',
    nomor_anggota: '',
    nik: '',
    nama: '',
    bagian_id: 'BAG-01',
    hak_pilih: true,
    status: 'AKTIF',
    tanggal_lahir: '',
    tanggal_pensiun: '2036-01-01',
    jabatan: 'Staf'
  });

  // Import State
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<Partial<Member>[]>([]);
  const [importResult, setImportResult] = useState<{ added: number; updated: number; errors: string[] } | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const [mRes, dRes] = await Promise.all([
        api.getMembers(
          {
            search: search || undefined,
            bagian_id: filterBagian !== 'ALL' ? filterBagian : undefined,
            status_memilih: filterStatus !== 'ALL' ? filterStatus : undefined,
            hak_pilih: filterHakPilih !== 'ALL' ? filterHakPilih : undefined
          },
          adminEmail
        ),
        api.getDivisions(adminEmail)
      ]);
      setMembers(mRes.members || []);
      setDivisions(dRes.divisions || []);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat data anggota.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [filterBagian, filterStatus, filterHakPilih]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers();
  };

  const handleToggleHakPilih = async (email: string, current: boolean) => {
    try {
      await api.toggleHakPilih(email, !current, adminEmail);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status hak pilih.');
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMember.email || !formMember.nomor_anggota || !formMember.nama || !formMember.bagian_id) {
      alert('Kolom wajib (Nomor Anggota, Nama Lengkap, Email, Bagian) harus diisi!');
      return;
    }

    try {
      await api.upsertMembers([formMember], adminEmail);
      setIsAddModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data anggota.');
    }
  };

  const handleConfirmReset = async () => {
    if (!targetResetMember) return;
    try {
      await api.resetMemberStatus(targetResetMember.email, resetReason, adminEmail);
      setIsResetModalOpen(false);
      setTargetResetMember(null);
      await fetchMembers();
      onRefreshData?.();
      alert(`Status voting anggota ${targetResetMember.nama} berhasil direset.`);
    } catch (err: any) {
      alert(err.message || 'Gagal mereset status memilih.');
    }
  };

  const handleParseCsv = (text: string) => {
    setCsvText(text);
    setImportResult(null);
    if (!text.trim()) {
      setImportPreview([]);
      return;
    }

    const lines = text.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/["']/g, ''));
    const parsed: Partial<Member>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/["']/g, ''));
      if (cols.length >= 3) {
        const item: Record<string, any> = {};
        headers.forEach((h, idx) => {
          if (cols[idx] !== undefined) {
            item[h] = cols[idx];
          }
        });

        const rawDob = item.tanggal_lahir || item.tgl_lahir || item['tanggal lahir'] || item['tgl lahir'] || item.dob || '';
        const rawPensiun = item.tanggal_pensiun || item.tgl_pensiun || item['tanggal pensiun'] || '';

        parsed.push({
          email: item.email || item['e-mail'] || item['alamat email'],
          nik: item.nik || item['no_nik'] || item['id karyawan'],
          nama: item.nama || item['nama lengkap'] || item['nama anggota'],
          nomor_anggota: item.nomor_anggota || item['no anggota'] || item['no_agt'],
          bagian_id: item.bagian_id || item['id bagian'] || 'BAG-01',
          nama_bagian: item.nama_bagian || item['nama bagian'] || 'Produksi',
          tanggal_lahir: rawDob ? rawDob.trim() : null,
          tanggal_pensiun: rawPensiun ? rawPensiun.trim() : (rawDob ? undefined : '2036-01-01'),
          hak_pilih: item.hak_pilih === 'false' || item.hak_pilih === '0' ? false : true,
          status: 'AKTIF'
        });
      }
    }
    setImportPreview(parsed);
  };

  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    try {
      const res = await api.upsertMembers(importPreview, adminEmail);
      setImportResult(res.result);
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan import data.');
    }
  };

  const [reEvaluating, setReEvaluating] = useState(false);

  const handleReEvaluatePension = async () => {
    setReEvaluating(true);
    try {
      const res = await api.reEvaluateMembersPension(adminEmail);
      if (res.success) {
        await fetchMembers();
        alert(res.message || 'Kalkulasi ulang sisa masa pensiun presisi berhasil dijalankan untuk seluruh anggota.');
      } else {
        alert(res.message || 'Gagal menjalankan kalkulasi ulang.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghubungi server untuk kalkulasi ulang.');
    } finally {
      setReEvaluating(false);
    }
  };

  const handleExportExcel = () => {
    if (members.length === 0) return;
    const exportData = members.map(m => {
      const p = calculateMemberPension(m.tanggal_lahir, m.tanggal_pensiun, undefined, m.jabatan);
      const isPengurusOrBpk = checkPengurusOrBPK(m.jabatan);
      const isPegawaiUser = checkPegawai(m.jabatan);
      const isWarn = p.is_warning || m.is_pensiun_warning || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun < 4);
      const sisaTxt = p.sisa_pensiun_text || m.sisa_pensiun_text || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null ? `${m.sisa_pensiun_tahun} thn lagi` : '');

      let statusHakDipilih = 'HAK DIPILIH: YA (Layak Dicalonkan)';
      if (isPegawaiUser) {
        statusHakDipilih = 'HAK DIPILIH: NONAKTIF (Pegawai/Karyawan)';
      } else if (isPengurusOrBpk.isPengurusBPK) {
        statusHakDipilih = 'HAK DIPILIH: NONAKTIF (Pengurus/BPK - Hanya Pemilih)';
      } else if (isWarn) {
        statusHakDipilih = 'HAK DIPILIH: NONAKTIF (Sisa Pensiun < 4 Thn - Hanya Pemilih)';
      }

      return {
        'NIK': m.nik || '',
        'Nama Lengkap': m.nama,
        'Nomor Anggota': m.nomor_anggota,
        'Email': m.email,
        'Bagian ID': m.bagian_id,
        'Nama Bagian': m.nama_bagian,
        'Jabatan / Posisi': m.jabatan || 'Anggota',
        'Tanggal Lahir': m.tanggal_lahir ? formatIndonesianDate(m.tanggal_lahir) : '',
        'Tanggal Pensiun': m.tanggal_pensiun ? formatIndonesianDate(m.tanggal_pensiun) : '',
        'Usia': p.usia ?? m.usia ?? '',
        'Sisa Masa Pensiun (Tahun)': p.sisa_pensiun_tahun ?? m.sisa_pensiun_tahun ?? '',
        'Sisa Masa Pensiun (Detail)': sisaTxt,
        'Kelayakan Hak Dipilih': statusHakDipilih,
        'Alasan Kualifikasi': p.alasan_hak_dipilih || m.alasan_hak_dipilih || '',
        'Hak Memilih': isPegawaiUser ? 'TIDAK (PEGAWAI)' : (m.hak_pilih ? 'Ya' : 'Tidak'),
        'Status Memilih': m.status_memilih,
        'Tanggal Voting': m.voted_at || '',
        'ID Transaksi': m.transaction_id || ''
      };
    });

    exportToExcel({
      filename: `Data_Anggota_Kopsyah_${new Date().getFullYear()}.xlsx`,
      sheetName: 'Data Anggota Pemilih',
      data: exportData
    });
  };

  // Counts for qualifications
  const totalPengurusBPK = members.filter(m => checkPengurusOrBPK(m.jabatan).isPengurusBPK).length;
  const totalPegawai = members.filter(m => checkPegawai(m.jabatan)).length;
  const totalWarningPensiun = members.filter(m => {
    const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
    const isPeg = checkPegawai(m.jabatan);
    if (isP || isPeg) return false;
    const p = calculateMemberPension(m.tanggal_lahir, m.tanggal_pensiun, undefined, m.jabatan);
    return p.is_warning || m.is_pensiun_warning || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun < 4);
  }).length;
  const totalLayakDicalonkan = members.filter(m => {
    const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
    const isPeg = checkPegawai(m.jabatan);
    if (isP || isPeg) return false;
    const p = calculateMemberPension(m.tanggal_lahir, m.tanggal_pensiun, undefined, m.jabatan);
    const isWarn = p.is_warning || m.is_pensiun_warning || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun < 4);
    return !isWarn && m.status === 'AKTIF';
  }).length;

  // Filter members based on filterPensiun using real-time qualification calculation
  const filteredMembers = members.filter(m => {
    const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
    const isPeg = checkPegawai(m.jabatan);
    const p = calculateMemberPension(m.tanggal_lahir, m.tanggal_pensiun, undefined, m.jabatan);
    const isWarn = p.is_warning || m.is_pensiun_warning || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun < 4);

    if (filterPensiun === 'PENGURUS_BPK') {
      return isP;
    }
    if (filterPensiun === 'PEGAWAI') {
      return isPeg;
    }
    if (filterPensiun === 'WARNING') {
      return isWarn && !isP && !isPeg;
    }
    if (filterPensiun === 'SAFE') {
      return !isWarn && !isP && !isPeg && m.status === 'AKTIF';
    }
    return true;
  });

  return (
    <div id="admin-members-view" className="space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Data Master
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Master Data Anggota Pemilih
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Total {members.length} anggota terdaftar. Kelola hak suara dan sinkronisasi data master.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-reevaluate-pension"
            onClick={handleReEvaluatePension}
            disabled={reEvaluating}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-bold uppercase tracking-wider text-amber-900 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Kalkulasi ulang status sisa masa pensiun presisi dan hak dipilih untuk seluruh data master anggota"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${reEvaluating ? 'animate-spin' : ''}`} />
            <span>{reEvaluating ? 'Mengkalkulasi...' : 'Kalkulasi Ulang Pensiun'}</span>
          </button>

          <button
            id="btn-export-members-excel"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold uppercase tracking-wider text-emerald-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          <button
            id="btn-import-members-wizard"
            onClick={() => {
              if (onNavigateToImport) {
                onNavigateToImport();
              } else {
                setIsImportModalOpen(true);
                setImportResult(null);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-xs font-bold uppercase tracking-wider text-[#1E3A8A] transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
            <span>Wizard Import Excel (7-Tahap)</span>
          </button>

          <button
            id="btn-tambah-anggota-modal"
            onClick={() => {
              setFormMember({
                email: '',
                nik: '',
                nama: '',
                bagian_id: divisions[0]?.bagian_id || 'BAG-01',
                hak_pilih: true,
                status: 'AKTIF',
                tanggal_pensiun: '2036-01-01',
                jabatan: 'Staf'
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Tambah Anggota</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              id="search-input-members"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari Nama, NIK, No. Anggota, Email..."
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-hidden"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              id="filter-bagian"
              value={filterBagian}
              onChange={e => setFilterBagian(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden bg-white"
            >
              <option value="ALL">Semua Bagian / Divisi</option>
              {divisions.map(d => (
                <option key={d.bagian_id} value={d.bagian_id}>
                  {d.nama_bagian} ({d.total_anggota} orang)
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              id="filter-status-memilih"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full h-10 px-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden bg-white"
            >
              <option value="ALL">Semua Status Voting</option>
              <option value="BELUM_MEMILIH">Belum Memilih</option>
              <option value="SUDAH_MEMILIH">Sudah Memilih</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 h-10 px-3 bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterBagian('ALL');
                setFilterStatus('ALL');
                setFilterHakPilih('ALL');
                setFilterPensiun('ALL');
                fetchMembers();
              }}
              className="h-10 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              title="Reset Filter"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Quick Filter Bar for Pension Warning & Categories */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-gray-400" />
              Kualifikasi Hak Dipilih:
            </span>
            <button
              type="button"
              onClick={() => setFilterPensiun('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterPensiun === 'ALL'
                  ? 'bg-blue-900 text-white font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Semua ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPensiun('PENGURUS_BPK')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filterPensiun === 'PENGURUS_BPK'
                  ? 'bg-purple-800 text-white font-bold'
                  : totalPengurusBPK > 0
                  ? 'bg-purple-50 text-purple-900 border border-purple-300 hover:bg-purple-100 font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
              <span>Pengurus / BPK - Hanya Pemilih ({totalPengurusBPK})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterPensiun('PEGAWAI')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filterPensiun === 'PEGAWAI'
                  ? 'bg-rose-800 text-white font-bold'
                  : totalPegawai > 0
                  ? 'bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100 font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>Pegawai - Tidak Punya Hak Memilih ({totalPegawai})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterPensiun('WARNING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filterPensiun === 'WARNING'
                  ? 'bg-amber-600 text-white font-bold'
                  : totalWarningPensiun > 0
                  ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span>Sisa Pensiun &lt; 4 Thn ({totalWarningPensiun})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterPensiun('SAFE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                filterPensiun === 'SAFE'
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Layak Dicalonkan (≥ 4 Thn) ({totalLayakDicalonkan})</span>
            </button>
          </div>

          <div className="text-[11px] text-gray-500 font-medium">
            Usia Pensiun: <span className="font-bold text-gray-700">55 Thn</span> • Batas Hak Dipilih: <span className="font-bold text-amber-700">&ge; 4 Thn</span> • Pengurus &amp; BPK: <span className="font-bold text-purple-700">Hanya Pemilih</span>
          </div>
        </div>
      </div>

      {/* Members Table (PRD Section 6) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3 px-4 sm:px-6">Anggota & Jabatan</th>
                <th className="py-3 px-4">No. Anggota & NIK</th>
                <th className="py-3 px-4">Bagian</th>
                <th className="py-3 px-4">Status & Masa Pensiun</th>
                <th className="py-3 px-4 text-center">Hak Memilih & Hak Dipilih</th>
                <th className="py-3 px-4 text-center">Status Pemilihan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memuat data anggota...
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 px-4 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-2">
                        <Users className="w-5 h-5 text-[#1E3A8A]" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        {search || filterBagian !== 'ALL' || filterStatus !== 'ALL' || filterHakPilih !== 'ALL' || filterPensiun !== 'ALL'
                          ? 'Tidak ada data anggota yang cocok dengan filter'
                          : 'Database Bersih — Belum Ada Data Anggota'}
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {search || filterBagian !== 'ALL' || filterStatus !== 'ALL' || filterHakPilih !== 'ALL' || filterPensiun !== 'ALL'
                          ? 'Coba sesuaikan kata kunci pencarian atau reset filter di atas.'
                          : 'Seluruh data master anggota kosong. Silakan gunakan menu Wizard Import Excel untuk memuat DPT.'}
                      </p>
                      {(!search && filterBagian === 'ALL' && filterStatus === 'ALL' && filterHakPilih === 'ALL' && filterPensiun === 'ALL') && (
                        <div className="pt-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateToImport) {
                                onNavigateToImport();
                              } else {
                                setIsImportModalOpen(true);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                          >
                            <Upload className="w-4 h-4" />
                            <span>Mulai Import Data Anggota</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m, i) => {
                  const isPengurusOrBpk = checkPengurusOrBPK(m.jabatan);
                  const isPegawaiUser = checkPegawai(m.jabatan);
                  const pension = calculateMemberPension(m.tanggal_lahir, m.tanggal_pensiun, undefined, m.jabatan);
                  const isWarning = pension.is_warning || m.is_pensiun_warning || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun < 4);
                  const sisaText = pension.sisa_pensiun_text || m.sisa_pensiun_text || (m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun !== null ? `${m.sisa_pensiun_tahun} thn lagi` : null);
                  const usiaDisplay = pension.usia ?? m.usia;
                  const tglPensiunDisplay = pension.tanggal_pensiun || m.tanggal_pensiun;

                  return (
                    <tr key={m.email} className={`hover:bg-gray-50/80 transition-colors ${
                      isPegawaiUser
                        ? 'bg-rose-50/20'
                        : isPengurusOrBpk.isPengurusBPK
                        ? 'bg-purple-50/20'
                        : isWarning
                        ? 'bg-amber-50/30'
                        : ''
                    }`}>
                      <td className="py-3 px-4 sm:px-6">
                        <div className="font-bold text-gray-900">{m.nama}</div>
                        <div className="text-[11px] text-gray-500 font-mono">{m.email}</div>
                        {isPegawaiUser ? (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                              <ShieldCheck className="w-3 h-3 text-blue-700 shrink-0" />
                              <span>Pegawai / Karyawan (Hanya Pemilih)</span>
                            </span>
                          </div>
                        ) : isPengurusOrBpk.isPengurusBPK ? (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                              <ShieldCheck className="w-3 h-3 text-purple-700 shrink-0" />
                              <span>{isPengurusOrBpk.label}</span>
                            </span>
                          </div>
                        ) : m.jabatan ? (
                          <div className="text-[10px] text-gray-400 mt-0.5">{m.jabatan}</div>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-gray-900">{m.nomor_anggota}</div>
                        <div className="text-[11px] text-gray-500">
                          {m.nik ? `NIK: ${m.nik}` : <span className="italic text-gray-400 font-sans">NIK: (Kosong)</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold text-[11px]">
                          {m.nama_bagian}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          {m.tanggal_lahir ? (
                            <div className="text-[11px] text-gray-700 flex items-center gap-1.5 flex-wrap">
                              <span className="text-gray-400 text-[10px]">Lahir:</span>
                              <span className="font-semibold font-mono text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {formatIndonesianDate(m.tanggal_lahir)}
                              </span>
                              {usiaDisplay !== undefined && usiaDisplay !== null && (
                                <span className="text-gray-500 font-bold text-[10px]">({usiaDisplay} thn)</span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-400 italic">
                              Tgl Lahir: -
                            </div>
                          )}

                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            <span>Pensiun:</span>
                            <span className="font-mono font-medium text-gray-700">
                              {formatIndonesianDate(tglPensiunDisplay)}
                            </span>
                            {sisaText && (
                              <span className="text-gray-600 font-semibold">({sisaText})</span>
                            )}
                          </div>

                          {isPengurusOrBpk.isPengurusBPK ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300"
                                title={`Aturan AD/ART: Jabatan ${isPengurusOrBpk.label} otomatis hanya memiliki Hak Memilih.`}
                              >
                                <ShieldAlert className="w-3 h-3 text-purple-700 shrink-0" />
                                <span>Jabatan: {isPengurusOrBpk.label}</span>
                              </span>
                            </div>
                          ) : isWarning ? (
                            <div>
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                                title={pension.warning_message || `Usia ${usiaDisplay || '51+'} tahun, sisa masa pensiun ${sisaText || '< 4 tahun'} menuju batas pensiun 55 tahun.`}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Sisa Pensiun &lt; 4 Tahun ({sisaText})</span>
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-center gap-1 min-w-[150px]">
                          {/* Hak Memilih Badge */}
                          <button
                            onClick={() => handleToggleHakPilih(m.email, m.hak_pilih)}
                            title="Klik untuk mengubah status Hak Memilih"
                            className={`inline-flex items-center justify-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer w-full ${
                              m.hak_pilih
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-700 border border-rose-300 hover:bg-rose-100'
                            }`}
                          >
                            {m.hak_pilih ? <Check className="w-3 h-3 text-emerald-600" /> : <X className="w-3 h-3 text-rose-600" />}
                            <span>Hak Memilih: {m.hak_pilih ? 'AKTIF' : 'NONAKTIF'}</span>
                          </button>

                          {/* Hak Dipilih Badge */}
                          {isPegawaiUser ? (
                            <span
                              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[9.5px] font-bold uppercase tracking-wider bg-blue-100 text-blue-950 border border-blue-300 w-full shadow-2xs"
                              title={m.alasan_hak_dipilih || "Terdaftar sebagai Pegawai/Karyawan. Sesuai ketentuan AD/ART, Pegawai/Karyawan HANYA memiliki Hak Memilih dan tidak memiliki Hak Dipilih (Hanya Pemilih)."}
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              <span>Pegawai - Hanya Pemilih</span>
                            </span>
                          ) : m.hak_pilih ? (
                            isPengurusOrBpk.isPengurusBPK ? (
                              <span
                                className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[9.5px] font-bold uppercase tracking-wider bg-purple-100 text-purple-950 border border-purple-300 w-full shadow-2xs"
                                title={m.alasan_hak_dipilih || `Menjabat sebagai ${isPengurusOrBpk.label}. Sesuai ketentuan AD/ART, Pengurus dan BPK HANYA memiliki Hak Memilih dan tidak memiliki Hak Dipilih (Hanya Pemilih).`}
                              >
                                <ShieldAlert className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                                <span>Pengurus / BPK - Hanya Pemilih</span>
                              </span>
                            ) : isWarning ? (
                              <span
                                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 w-full"
                                title={m.alasan_hak_dipilih || pension.alasan_hak_dipilih || "Tidak berhak dicalonkan karena sisa masa pensiun < 4 tahun (usia 51+ thn). Berstatus Hanya Pemilih."}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                <span>Sisa Pensiun &lt; 4 Thn (Hanya Pemilih)</span>
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200 w-full"
                                title="Memenuhi syarat dicalonkan sebagai calon perwakilan (sisa masa pensiun ≥ 4 tahun)."
                              >
                                <CheckCircle2 className="w-3 h-3 text-blue-700 shrink-0" />
                                <span>HAK DIPILIH: YA (Layak Dicalonkan)</span>
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[9.5px] font-medium uppercase tracking-wider bg-gray-100 text-gray-500 border border-gray-200 w-full">
                              <span>Hak Dipilih: NONAKTIF</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.status_memilih === 'SUDAH_MEMILIH' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sudah Memilih
                            </span>
                            {m.transaction_id && (
                              <div className="text-[9px] font-mono text-gray-400 mt-0.5 truncate max-w-[120px] mx-auto">
                                {m.transaction_id}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-medium uppercase tracking-wider">
                            Belum Memilih
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {m.status_memilih === 'SUDAH_MEMILIH' && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedReceiptMember(m);
                                  setIsReceiptModalOpen(true);
                                }}
                                title="Cetak / Pratinjau Bukti Pemilihan"
                                className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setTargetResetMember(m);
                                  setIsResetModalOpen(true);
                                }}
                                title="Reset status memilih (Testing/Darurat)"
                                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setFormMember({
                                ...m,
                                tanggal_lahir: m.tanggal_lahir || '',
                                tanggal_pensiun: m.tanggal_pensiun || '2036-01-01'
                              });
                              setIsAddModalOpen(true);
                            }}
                            title="Edit Anggota"
                            className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`Yakin hapus anggota ${m.nama} (${m.email})?\n\nTindakan ini akan menghapus data anggota, kandidat, dan suara terkait secara permanen.`)) return;
                              try {
                                await api.deleteMember(m.email, adminEmail);
                                fetchMembers();
                                alert(`Anggota ${m.nama} berhasil dihapus.`);
                              } catch (err: any) {
                                alert(err.message || 'Gagal menghapus anggota.');
                              }
                            }}
                            title="Hapus Anggota"
                            className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CETAK BUKTI PEMILIHAN */}
      {selectedReceiptMember && (
        <PrintReceiptModal
          receipt={{
            transaction_id: selectedReceiptMember.transaction_id || `TX-YKK-${Date.now()}`,
            voted_at: selectedReceiptMember.voted_at || new Date().toISOString(),
            nama: selectedReceiptMember.nama,
            nomor_anggota: selectedReceiptMember.nomor_anggota,
            nik: selectedReceiptMember.nik,
            bagian_id: selectedReceiptMember.bagian_id,
            nama_bagian: selectedReceiptMember.nama_bagian,
            status_memilih: selectedReceiptMember.status_memilih,
            organisasi: 'KOPSYAH YKK AP INDONESIA',
            periode_pemilihan: '2026',
            nama_sistem: 'Sistem Pemilihan Anggota Perwakilan Online',
            jabatan: selectedReceiptMember.jabatan
          }}
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setSelectedReceiptMember(null);
          }}
        />
      )}

      {/* MODAL TAMBAH / EDIT ANGGOTA */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-gray-900 mb-4">
              {formMember.email && members.some(m => m.email === formMember.email)
                ? 'Edit Data Anggota'
                : 'Tambah Anggota Baru'}
            </h3>

            <form onSubmit={handleSaveMember} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={formMember.nama || ''}
                  onChange={e => setFormMember({ ...formMember, nama: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-medium"
                  placeholder="Contoh: Budi Santoso"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Nomor Anggota <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formMember.nomor_anggota || ''}
                    onChange={e => setFormMember({ ...formMember, nomor_anggota: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono font-bold"
                    placeholder="Contoh: AGT-0101"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    NIK Karyawan <span className="text-gray-400 font-normal normal-case">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formMember.nik || ''}
                    onChange={e => setFormMember({ ...formMember, nik: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono"
                    placeholder="Boleh kosong / 3201..."
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Alamat Email (Login) *</label>
                <input
                  type="email"
                  required
                  value={formMember.email || ''}
                  onChange={e => setFormMember({ ...formMember, email: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono"
                  placeholder="email@kopsyah-ykk.id"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Bagian / Divisi *</label>
                <select
                  value={formMember.bagian_id || 'BAG-01'}
                  onChange={e => {
                    const div = divisions.find(d => d.bagian_id === e.target.value);
                    setFormMember({
                      ...formMember,
                      bagian_id: e.target.value,
                      nama_bagian: div?.nama_bagian
                    });
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white font-medium"
                >
                  {divisions.map(d => (
                    <option key={d.bagian_id} value={d.bagian_id}>
                      {d.nama_bagian}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tanggal Lahir (Opsional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-gray-700 uppercase tracking-wider block">
                    Tanggal Lahir <span className="text-gray-400 font-normal">(DD-MM-YYYY)</span>
                  </label>
                  {formMember.tanggal_lahir && (
                    <span className="text-[10px] text-blue-900 bg-blue-100/70 border border-blue-200 px-1.5 py-0.5 rounded font-mono font-bold">
                      {formatIndonesianDate(formMember.tanggal_lahir)}
                    </span>
                  )}
                </div>
                <input
                  type="date"
                  value={formMember.tanggal_lahir || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (val) {
                      const calc = calculateMemberPension(val);
                      setFormMember({
                        ...formMember,
                        tanggal_lahir: val,
                        tanggal_pensiun: calc.tanggal_pensiun || formMember.tanggal_pensiun
                      });
                    } else {
                      setFormMember({
                        ...formMember,
                        tanggal_lahir: '',
                        tanggal_pensiun: formMember.tanggal_pensiun || '2036-01-01'
                      });
                    }
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  Opsional. Format: Tanggal-Bulan-Tahun (DD-MM-YYYY). Sistem menghitung otomatis usia pensiun (55 tahun) dan mendeteksi kualifikasi hak dicalonkan (sisa pensiun &lt; 4 tahun).
                </p>
              </div>

              {/* Real-time Pension & Role Live Preview */}
              {(() => {
                const isPegawaiUser = checkPegawai(formMember.jabatan);
                const isPengurusOrBpk = checkPengurusOrBPK(formMember.jabatan);
                const calc = calculateMemberPension(formMember.tanggal_lahir, formMember.tanggal_pensiun, undefined, formMember.jabatan);
                
                if (isPegawaiUser) {
                  return (
                    <div className="p-3 rounded-xl border bg-blue-50 border-blue-300 text-blue-900 text-[11px] space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-blue-950">
                        <ShieldAlert className="w-4 h-4 text-blue-700 shrink-0" />
                        <span>Kualifikasi Khusus: Pegawai / Karyawan (Hanya Pemilih)</span>
                      </div>
                      <p className="text-[10px] text-blue-900/90 leading-relaxed">
                        Sesuai ketentuan AD/ART Koperasi KOPSYAH YKK AP Indonesia, anggota yang terdaftar sebagai <strong>Pegawai / Karyawan</strong> HANYA memiliki <strong>Hak Memilih</strong>. Anggota <strong>TIDAK MEMILIKI Hak Dipilih</strong> sebagai Calon Perwakilan Anggota (Otomatis Dikunci: Hanya Pemilih).
                      </p>
                      <div className="pt-1.5 border-t border-blue-200 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-emerald-800">✅ Hak Memilih: AKTIF (Berhak Suara)</span>
                        <span className="text-blue-900 bg-blue-200/80 px-2 py-0.5 rounded border border-blue-300">⛔ Hak Dipilih: NONAKTIF (Hanya Pemilih)</span>
                      </div>
                    </div>
                  );
                }

                if (isPengurusOrBpk.isPengurusBPK) {
                  return (
                    <div className="p-3 rounded-xl border bg-purple-50 border-purple-300 text-purple-900 text-[11px] space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-purple-950">
                        <ShieldAlert className="w-4 h-4 text-purple-700 shrink-0" />
                        <span>Kualifikasi Khusus: {isPengurusOrBpk.label} (Hanya Pemilih)</span>
                      </div>
                      <p className="text-[10px] text-purple-900/90 leading-relaxed">
                        Sesuai ketentuan AD/ART Koperasi KOPSYAH YKK AP Indonesia, seluruh anggota yang menjabat sebagai <strong>Pengurus maupun BPK (Badan Pengawas Koperasi)</strong> HANYA memiliki <strong>Hak Memilih</strong>. Anggota <strong>TIDAK MEMILIKI Hak Dipilih</strong> sebagai Calon Perwakilan Anggota (Otomatis Dikunci: Hanya Pemilih), tanpa memandang sisa masa pensiunnya.
                      </p>
                      <div className="pt-1.5 border-t border-purple-200 flex items-center justify-between text-[10px] font-bold">
                        <span className="text-emerald-800">✅ Hak Memilih: AKTIF (Berhak Suara)</span>
                        <span className="text-purple-900 bg-purple-200/80 px-2 py-0.5 rounded border border-purple-300">⛔ Hak Dipilih: NONAKTIF (Hanya Pemilih)</span>
                      </div>
                    </div>
                  );
                }

                if (formMember.tanggal_lahir || formMember.tanggal_pensiun) {
                  return (
                    <div className={`p-2.5 rounded-xl border text-[11px] ${
                      calc.is_warning
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        {calc.is_warning ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        )}
                        <span>Kalkulasi Otomatis Masa Pensiun (55 Thn):</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          Usia Anggota: <span className="font-bold">{calc.usia !== null ? `${calc.usia} Tahun` : '-'}</span>
                        </div>
                        <div>
                          Sisa Masa Pensiun: <span className="font-bold">{calc.sisa_pensiun_text || (calc.sisa_pensiun_tahun !== null ? `${calc.sisa_pensiun_tahun} Tahun` : '-')}</span>
                        </div>
                        {calc.tanggal_lahir && (
                          <div className="text-gray-600">
                            Tanggal Lahir: <span className="font-mono font-bold text-gray-900">{formatIndonesianDate(calc.tanggal_lahir)}</span>
                          </div>
                        )}
                        <div className="text-gray-600">
                          Tanggal Pensiun: <span className="font-mono font-bold text-gray-900">{formatIndonesianDate(calc.tanggal_pensiun)}</span>
                        </div>
                      </div>
                      {calc.is_warning ? (
                        <div className="mt-2 pt-2 border-t border-amber-300 space-y-1 text-[10px]">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-emerald-800">✅ Hak Memilih:</span>
                            <span className="text-emerald-800">AKTIF (Berhak memberikan suara)</span>
                          </div>
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-rose-800">⛔ Hak Dipilih:</span>
                            <span className="text-rose-800">NONAKTIF (Tidak memenuhi syarat dicalonkan)</span>
                          </div>
                          <p className="text-[9.5px] text-amber-900 mt-0.5 leading-tight">
                            * Sisa masa pensiun &lt; 4 tahun (usia saat ini 51+ thn). Anggota berstatus <strong>Hanya Pemilih</strong>.
                          </p>
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-blue-200 flex items-center justify-between text-[10px] font-bold text-emerald-800">
                          <span>✅ Hak Memilih: AKTIF</span>
                          <span>✅ Hak Dipilih: AKTIF (Layak Dicalonkan)</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Tanggal Pensiun</label>
                  <input
                    type="date"
                    value={formMember.tanggal_pensiun || '2036-01-01'}
                    onChange={e => setFormMember({ ...formMember, tanggal_pensiun: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Hak Suara</label>
                  <select
                    value={formMember.hak_pilih ? 'true' : 'false'}
                    onChange={e => setFormMember({ ...formMember, hak_pilih: e.target.value === 'true' })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white"
                  >
                    <option value="true">Berhak Memilih</option>
                    <option value="false">Tidak Berhak</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Jabatan / Posisi</label>
                <input
                  type="text"
                  value={formMember.jabatan || ''}
                  onChange={e => setFormMember({ ...formMember, jabatan: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
                  placeholder="Contoh: Operator Senior, Pengurus Koperasi, BPK"
                />
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-medium">Pilihan Cepat:</span>
                  <button
                    type="button"
                    onClick={() => setFormMember({ ...formMember, jabatan: 'Anggota' })}
                    className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-medium cursor-pointer transition-colors"
                  >
                    Anggota Biasa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMember({ ...formMember, jabatan: 'Pengurus Koperasi' })}
                    className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-bold border border-purple-300 cursor-pointer transition-colors"
                  >
                    Pengurus Koperasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMember({ ...formMember, jabatan: 'BPK (Badan Pengawas Koperasi)' })}
                    className="px-2 py-0.5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 text-[10px] font-bold border border-purple-300 cursor-pointer transition-colors"
                  >
                    BPK (Badan Pengawas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormMember({ ...formMember, jabatan: 'Pegawai' })}
                    className="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-bold border border-blue-300 cursor-pointer transition-colors"
                  >
                    Pegawai
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold uppercase tracking-wider hover:bg-gray-50 text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold uppercase tracking-wider text-xs shadow-sm cursor-pointer"
                >
                  Simpan Anggota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BULK IMPORT (PRD Section 24) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#1E3A8A]" />
                Import & Sinkronisasi Data Anggota (UPSERT)
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Mendukung format CSV / spreadsheet dengan mekanisme <strong>UPSERT</strong> (memperbarui data lama jika email/NIK cocok tanpa menduplikasi).
            </p>

            {/* CSV Template Example */}
            <div className="mt-3 p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] font-mono text-gray-700">
              <div className="font-bold text-gray-900 mb-1">Format Header Kolom:</div>
              email,nik,nama,nomor_anggota,bagian_id,nama_bagian,tanggal_pensiun,hak_pilih
              <div className="text-gray-400 mt-1">Contoh:</div>
              andi@kopsyah-ykk.id,NIK-1099,Andi Wijaya,AGT-0120,BAG-01,Produksi,2037-05-10,true
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Tempel Isi CSV atau Tulis Data:
              </label>
              <textarea
                rows={5}
                value={csvText}
                onChange={e => handleParseCsv(e.target.value)}
                placeholder="email,nik,nama,nomor_anggota,bagian_id,nama_bagian..."
                className="w-full p-3 rounded-xl border border-gray-300 text-xs font-mono outline-hidden focus:border-blue-700"
              ></textarea>
            </div>

            {importPreview.length > 0 && (
              <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-xs font-bold text-emerald-900">
                  Pratinjau Data Valid ({importPreview.length} Baris Siap Di-Import)
                </div>
                <div className="mt-2 max-h-32 overflow-y-auto text-[11px] divide-y divide-emerald-100">
                  {importPreview.slice(0, 5).map((p, idx) => (
                    <div key={idx} className="py-1 flex justify-between">
                      <span className="font-semibold text-gray-800">{p.nama} ({p.nik})</span>
                      <span className="font-mono text-gray-600">{p.email} • {p.nama_bagian}</span>
                    </div>
                  ))}
                  {importPreview.length > 5 && (
                    <div className="pt-1 text-gray-500 italic">...dan {importPreview.length - 5} anggota lainnya.</div>
                  )}
                </div>
              </div>
            )}

            {importResult && (
              <div className="mt-4 p-3.5 rounded-xl bg-[#1E3A8A] text-white text-xs space-y-1">
                <div className="font-bold text-emerald-300">Hasil Eksekusi Import:</div>
                <div>Ditambahkan: {importResult.added} data baru</div>
                <div>Diperbarui: {importResult.updated} data</div>
                {importResult.errors.length > 0 && (
                  <div className="text-rose-300 mt-1">Errors: {importResult.errors.join(', ')}</div>
                )}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-50"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={importPreview.length === 0}
                onClick={handleExecuteImport}
                className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 shadow-sm"
              >
                Konfirmasi & Simpan ({importPreview.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET STATUS (Testing/Emergency) */}
      {isResetModalOpen && targetResetMember && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-extrabold text-gray-900 mb-2">
              Reset Status Memilih Anggota
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-4">
              Tindakan ini akan mengembalikan status anggota <strong>{targetResetMember.nama}</strong> ({targetResetMember.email}) menjadi <strong>BELUM MEMILIH</strong> dan menghapus suara terkait untuk keperluan pengujian atau pemulihan darurat.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Alasan Reset (Akan dicatat di Audit Log):
                </label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-amber-600"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold uppercase tracking-wider hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                Ya, Reset Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit2,
  Calendar,
  UserCheck,
  ShieldCheck,
  X,
  Info,
  Users,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../services/api';
import { Candidate, Division, Member } from '../../types';
import { checkPengurusOrBPK } from '../../utils/pension';

interface AdminCandidatesProps {
  adminEmail: string;
}

export const AdminCandidates: React.FC<AdminCandidatesProps> = ({ adminEmail }) => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBagian, setFilterBagian] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formCandidate, setFormCandidate] = useState<Partial<Candidate>>({
    kandidat_id: '',
    member_id: '',
    nomor_urut: 1,
    nama: '',
    nomor_anggota: '',
    bagian_id: 'BAG-01',
    nama_bagian: 'Produksi',
    foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    visi_misi: '',
    status_aktif: true,
    tanggal_pensiun: '2036-05-10'
  });

  const [pensionValidation, setPensionValidation] = useState<{
    eligible: boolean;
    years_remaining: number;
    batas_tahun: number;
    message: string;
  } | null>(null);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const [cRes, dRes, mRes] = await Promise.all([
        api.getCandidates(filterBagian !== 'ALL' ? filterBagian : undefined, adminEmail),
        api.getDivisions(adminEmail),
        api.getMembers(undefined, adminEmail)
      ]);
      setCandidates(cRes.candidates || []);
      setDivisions(dRes.divisions || []);
      setMembers(mRes.members || []);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat kandidat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, [filterBagian]);

  const handleValidatePension = async (tanggal: string) => {
    if (!tanggal) return;
    try {
      const res = await api.validatePension(tanggal, 4);
      setPensionValidation(res);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSelectMemberForCandidate = (memberId: string) => {
    const selected = members.find(
      m => m.nomor_anggota === memberId || m.email === memberId || (m as any).id === memberId
    );
    if (selected) {
      const pengurusCheck = checkPengurusOrBPK(selected.jabatan);
      const isPensionWarning = selected.is_pensiun_warning || (selected.sisa_pensiun_tahun !== undefined && selected.sisa_pensiun_tahun !== null && selected.sisa_pensiun_tahun < 4);
      setFormCandidate(prev => ({
        ...prev,
        member_id: selected.nomor_anggota || selected.email,
        nama: selected.nama,
        nomor_anggota: selected.nomor_anggota,
        bagian_id: selected.bagian_id,
        nama_bagian: selected.nama_bagian,
        tanggal_pensiun: selected.tanggal_pensiun || '2036-01-01',
        jabatan: selected.jabatan || 'Anggota',
        is_pengurus_bpk: pengurusCheck.isPengurusBPK,
        tipe_pengurus_bpk: pengurusCheck.roleType
      }));

      if (pengurusCheck.isPengurusBPK) {
        setPensionValidation({
          eligible: false,
          years_remaining: selected.sisa_pensiun_tahun || 0,
          batas_tahun: 4,
          message: `Anggota tidak dapat dicalonkan karena menjabat sebagai ${pengurusCheck.label}. Sesuai ketentuan AD/ART Koperasi KOPSYAH YKK AP Indonesia, Pengurus dan BPK HANYA memiliki Hak Memilih dan tidak memiliki Hak Dipilih (Hanya Pemilih).`
        });
      } else if (isPensionWarning) {
        setPensionValidation({
          eligible: false,
          years_remaining: selected.sisa_pensiun_tahun || 0,
          batas_tahun: 4,
          message: `Anggota tidak dapat dicalonkan karena sisa masa pensiun kurang dari 4 tahun (${selected.sisa_pensiun_tahun !== null && selected.sisa_pensiun_tahun !== undefined ? selected.sisa_pensiun_tahun : '< 4'} tahun menuju usia pensiun 55). Anggota hanya memiliki Hak Memilih, bukan Hak Dipilih.`
        });
      } else if (selected.tanggal_pensiun) {
        handleValidatePension(selected.tanggal_pensiun);
      } else {
        setPensionValidation({
          eligible: true,
          years_remaining: 10,
          batas_tahun: 4,
          message: 'Memenuhi syarat pencalonan (sisa masa pensiun ≥ 4 tahun).'
        });
      }
    }
  };

  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCandidate.nama || !formCandidate.bagian_id || !formCandidate.nomor_urut) {
      alert('Nama, Bagian, dan Nomor Urut wajib diisi.');
      return;
    }

    if (pensionValidation && !pensionValidation.eligible) {
      alert(pensionValidation.message || 'Anggota tidak memenuhi syarat untuk dicalonkan sebagai calon perwakilan (Hanya Pemilih).');
      return;
    }

    try {
      await api.saveCandidate(formCandidate, adminEmail);
      setIsModalOpen(false);
      fetchCandidates();
      alert('Data kandidat berhasil disimpan.');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data calon.');
    }
  };

  const handleDeleteCandidate = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus calon perwakilan: ${nama}?`)) {
      return;
    }
    try {
      await api.deleteCandidate(id, adminEmail);
      fetchCandidates();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kandidat.');
    }
  };

  const handleOpenAddModal = () => {
    setFormCandidate({
      kandidat_id: '',
      member_id: '',
      nomor_urut: (candidates.length % 10) + 1,
      nama: '',
      nomor_anggota: '',
      bagian_id: divisions[0]?.bagian_id || 'BAG-01',
      nama_bagian: divisions[0]?.nama_bagian || 'Produksi',
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      visi_misi: '',
      status_aktif: true,
      tanggal_pensiun: '2036-05-10'
    });
    setPensionValidation(null);
    setIsModalOpen(true);
  };

  return (
    <div id="admin-candidates-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Kandidat & Calon
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Manajemen Calon Anggota Perwakilan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Kelola daftar kandidat setiap bagian, validasi masa pensiun 4 tahun, dan nomor urut.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterBagian}
            onChange={e => setFilterBagian(e.target.value)}
            className="h-10 px-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden bg-white shadow-2xs font-medium"
          >
            <option value="ALL">Semua Bagian ({candidates.length} Calon)</option>
            {divisions.map(d => (
              <option key={d.bagian_id} value={d.bagian_id}>
                {d.nama_bagian}
              </option>
            ))}
          </select>

          <button
            id="btn-tambah-kandidat"
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Calon</span>
          </button>
        </div>
      </div>

      {/* Information Banner on Pension Eligibility */}
      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-3.5 text-xs text-blue-950 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-[#1E3A8A] text-white flex items-center justify-center shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="font-extrabold text-[#1E3A8A] text-sm flex items-center gap-2">
            <span>Aturan Hak Memilih vs Hak Dipilih Berdasarkan Sisa Masa Pensiun</span>
            <span className="px-2 py-0.5 rounded bg-blue-200/70 text-blue-900 text-[10px] font-bold">Pasal 8 PRD KOPSYAH</span>
          </div>
          <p className="text-xs text-blue-900/90 leading-relaxed">
            • <strong>Sisa Pensiun &lt; 4 Tahun (Usia 51+ thn):</strong> Hak Memilih tetap <strong>AKTIF</strong> (anggota berhak memberikan suara), namun Hak Dipilih <strong>NONAKTIF</strong> (tidak memenuhi syarat dicalonkan sebagai calon perwakilan).
            <br />
            • <strong>Sisa Pensiun &ge; 4 Tahun (Usia &lt; 51 thn):</strong> Memenuhi syarat penuh untuk <strong>Hak Memilih</strong> dan <strong>Hak Dipilih</strong>.
          </p>
        </div>
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-gray-200">
            <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Memuat daftar kandidat...
          </div>
        ) : candidates.length === 0 ? (
          <div className="col-span-full py-12 px-4 text-center bg-white rounded-2xl border border-gray-200 shadow-2xs">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <p className="text-sm font-bold text-gray-800">
                Database Bersih — Belum Ada Kandidat Terdaftar
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Seluruh data kandidat contoh telah dikosongkan. Anda dapat mendaftarkan calon perwakilan baru per bagian menggunakan tombol "+ Tambah Calon Perwakilan" di atas.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Calon Perwakilan Pertama</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          candidates.map(cand => (
            <div
              key={cand.kandidat_id}
              className="p-5 rounded-2xl bg-white border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white font-black text-xs flex items-center justify-center">
                      {cand.nomor_urut}
                    </span>
                    <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">Nomor Urut {cand.nomor_urut}</span>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      cand.status_aktif
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {cand.status_aktif ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={cand.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                    alt={cand.nama}
                    className="w-14 h-14 rounded-xl object-cover border border-gray-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-extrabold text-gray-900 truncate">{cand.nama}</h4>
                    <p className="text-[11px] text-gray-500 font-mono">No: {cand.nomor_anggota}</p>
                    <p className="text-[11px] text-[#1E3A8A] font-bold mt-0.5">
                      Bagian {cand.nama_bagian}
                    </p>
                  </div>
                </div>

                {/* Qualification Badges */}
                {(() => {
                  const pengurusCheck = checkPengurusOrBPK(cand.jabatan);
                  if (cand.is_pengurus_bpk || pengurusCheck.isPengurusBPK) {
                    return (
                      <div className="mt-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-950 border border-purple-300 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-purple-700 shrink-0" />
                          <span>{pengurusCheck.label || 'Pengurus / BPK'} (Hanya Pemilih)</span>
                        </span>
                      </div>
                    );
                  }
                  if (cand.memenuhi_syarat === false || cand.is_pensiun_warning) {
                    return (
                      <div className="mt-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Sisa Pensiun &lt; 4 Thn ({cand.sisa_pensiun_text || `${cand.sisa_pensiun_tahun} thn`})</span>
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="mt-2.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-blue-700 shrink-0" />
                        <span>Layak Dicalonkan (≥ 4 Thn)</span>
                      </span>
                    </div>
                  );
                })()}

                {cand.visi_misi && (
                  <div className="mt-3.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] text-gray-600 line-clamp-3">
                    {cand.visi_misi}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 font-mono">{cand.kandidat_id}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setFormCandidate(cand);
                      if (cand.tanggal_pensiun) handleValidatePension(cand.tanggal_pensiun);
                      setIsModalOpen(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Calon"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteCandidate(cand.kandidat_id, cand.nama)}
                    className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Hapus Calon"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL TAMBAH / EDIT KANDIDAT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-extrabold text-gray-900">
                {formCandidate.kandidat_id ? 'Edit Calon Perwakilan' : 'Tambah Calon Perwakilan Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCandidate} className="mt-4 space-y-3.5 text-xs">
              {/* Quick lookup from existing members */}
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Pilih dari Master Anggota:
                </label>
                <select
                  onChange={e => handleSelectMemberForCandidate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white font-medium"
                >
                  <option value="">-- Pilih Anggota Terdaftar --</option>
                  <optgroup label="✅ Memenuhi Syarat Hak Dipilih (Sisa Pensiun ≥ 4 Thn)">
                    {members
                      .filter(m => {
                        const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
                        const isW = m.is_pensiun_warning || (m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun < 4);
                        return !isP && !isW && m.status === 'AKTIF';
                      })
                      .map(m => (
                        <option key={m.nomor_anggota || m.email} value={m.nomor_anggota || m.email}>
                          {m.nama} ({m.nomor_anggota} - {m.nama_bagian})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🛡️ Pengurus & BPK Koperasi (Hanya Pemilih - AD/ART)">
                    {members
                      .filter(m => checkPengurusOrBPK(m.jabatan).isPengurusBPK)
                      .map(m => (
                        <option key={m.nomor_anggota || m.email} value={m.nomor_anggota || m.email}>
                          [PENGURUS/BPK] {m.nama} ({m.nomor_anggota} - {m.jabatan || 'Pengurus'})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="⛔ Tidak Memenuhi Syarat (Hanya Pemilih - Sisa Pensiun < 4 Thn)">
                    {members
                      .filter(m => {
                        const isP = checkPengurusOrBPK(m.jabatan).isPengurusBPK;
                        const isW = m.is_pensiun_warning || (m.sisa_pensiun_tahun !== null && m.sisa_pensiun_tahun !== undefined && m.sisa_pensiun_tahun < 4);
                        return !isP && isW;
                      })
                      .map(m => (
                        <option key={m.nomor_anggota || m.email} value={m.nomor_anggota || m.email}>
                          [SISA PENSIUN &lt; 4 THN] {m.nama} ({m.nomor_anggota} - Sisa {m.sisa_pensiun_text || `${m.sisa_pensiun_tahun} thn`})
                        </option>
                      ))}
                  </optgroup>
                </select>
              </div>

              {pensionValidation && !pensionValidation.eligible && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-extrabold text-rose-900">Hak Dipilih NONAKTIF (Tidak Memenuhi Syarat)</div>
                    <p className="text-[11px] text-rose-800 leading-relaxed">
                      {pensionValidation.message || 'Anggota ini berstatus Hanya Pemilih dan tidak dapat dicalonkan sebagai Perwakilan Anggota.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2">
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Nama Lengkap Calon *</label>
                  <input
                    type="text"
                    required
                    value={formCandidate.nama || ''}
                    onChange={e => setFormCandidate({ ...formCandidate, nama: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-medium"
                    placeholder="Contoh: Andika Pratama"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Nomor Urut *</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={formCandidate.nomor_urut || 1}
                    onChange={e => setFormCandidate({ ...formCandidate, nomor_urut: Number(e.target.value) })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Nomor Anggota</label>
                  <input
                    type="text"
                    value={formCandidate.nomor_anggota || ''}
                    onChange={e => setFormCandidate({ ...formCandidate, nomor_anggota: e.target.value })}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono"
                    placeholder="AGT-XXXX"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Bagian / Divisi *</label>
                  <select
                    value={formCandidate.bagian_id || 'BAG-01'}
                    onChange={e => {
                      const div = divisions.find(d => d.bagian_id === e.target.value);
                      setFormCandidate({
                        ...formCandidate,
                        bagian_id: e.target.value,
                        nama_bagian: div?.nama_bagian
                      });
                    }}
                    className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white"
                  >
                    {divisions.map(d => (
                      <option key={d.bagian_id} value={d.bagian_id}>
                        {d.nama_bagian}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pension rule validator (PRD Section 8) */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    Tanggal Pensiun (Syarat Batas 4 Tahun)
                  </label>
                  <span className="text-[10px] text-gray-500 font-mono">PRD Pasal 8</span>
                </div>

                <input
                  type="date"
                  value={formCandidate.tanggal_pensiun || '2036-01-01'}
                  onChange={e => {
                    setFormCandidate({ ...formCandidate, tanggal_pensiun: e.target.value });
                    handleValidatePension(e.target.value);
                  }}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white"
                />

                {pensionValidation && (
                  <div
                    className={`mt-2 p-2 rounded-lg text-[11px] font-semibold flex items-center gap-2 ${
                      pensionValidation.eligible
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border border-rose-200'
                    }`}
                  >
                    {pensionValidation.eligible ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{pensionValidation.message}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">URL Foto Profil</label>
                <input
                  type="url"
                  value={formCandidate.foto || ''}
                  onChange={e => setFormCandidate({ ...formCandidate, foto: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Visi & Program Kerja Singkat</label>
                <textarea
                  rows={3}
                  value={formCandidate.visi_misi || ''}
                  onChange={e => setFormCandidate({ ...formCandidate, visi_misi: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
                  placeholder="Menyuarakan aspirasi anggota..."
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="checkbox-calon-aktif"
                  checked={formCandidate.status_aktif}
                  onChange={e => setFormCandidate({ ...formCandidate, status_aktif: e.target.checked })}
                  className="rounded text-blue-700 focus:ring-blue-700 h-4 w-4"
                />
                <label htmlFor="checkbox-calon-aktif" className="font-bold text-gray-800 text-xs">
                  Calon ini Aktif dan Ditampilkan di Surat Suara
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold uppercase tracking-wider text-xs hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pensionValidation?.eligible === false}
                  className={`px-5 py-2 rounded-xl text-white font-bold uppercase tracking-wider text-xs shadow-sm transition-all ${
                    pensionValidation?.eligible === false
                      ? 'bg-gray-400 cursor-not-allowed opacity-60'
                      : 'bg-[#1E3A8A] hover:bg-blue-900 cursor-pointer'
                  }`}
                >
                  {pensionValidation?.eligible === false ? 'Tidak Memenuhi Syarat' : 'Simpan Calon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Award,
  Calculator,
  Info,
  Users,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  Sparkles,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  FileCheck,
  Check
} from 'lucide-react';
import { api } from '../../services/api';
import { Division } from '../../types';

interface AdminDivisionsProps {
  adminEmail?: string;
}

interface DivisionFormData {
  bagian_id: string;
  nama_bagian: string;
  deskripsi: string;
  is_manual_quota: boolean;
  manual_kuota: number;
  alasan_manual_kuota: string;
}

export const AdminDivisions: React.FC<AdminDivisionsProps> = ({ adminEmail = 'admin@kopsyah-ykk.id' }) => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [formData, setFormData] = useState<DivisionFormData>({
    bagian_id: '',
    nama_bagian: '',
    deskripsi: '',
    is_manual_quota: false,
    manual_kuota: 1,
    alasan_manual_kuota: ''
  });
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Interactive Quota Simulator State
  const [simCount, setSimCount] = useState<number>(46);

  const fetchDivisions = async (isManual = false) => {
    try {
      if (isManual) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      const res = await api.getDivisions(adminEmail);
      setDivisions(res.divisions || []);

      if (isManual) {
        showToast('Data bagian dan alokasi kuota berhasil diperbarui.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memuat data bagian.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDivisions();
  }, [adminEmail]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Open modal to create new division
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingDivision(null);
    // Auto suggest next code
    const nextNum = divisions.length + 1;
    const suggestedId = `BAG-${String(nextNum).padStart(2, '0')}`;
    setFormData({
      bagian_id: suggestedId,
      nama_bagian: '',
      deskripsi: '',
      is_manual_quota: false,
      manual_kuota: 1,
      alasan_manual_kuota: ''
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open modal to edit existing division
  const handleOpenEditModal = (div: Division) => {
    setModalMode('edit');
    setEditingDivision(div);
    const hasManual = div.manual_kuota !== undefined && div.manual_kuota !== null;
    setFormData({
      bagian_id: div.bagian_id,
      nama_bagian: div.nama_bagian,
      deskripsi: div.deskripsi || '',
      is_manual_quota: hasManual,
      manual_kuota: hasManual ? Number(div.manual_kuota) : div.kuota_perwakilan,
      alasan_manual_kuota: div.alasan_manual_kuota || ''
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDivision(null);
    setModalError(null);
  };

  // Submit Modal Form (Create or Edit)
  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bagian_id.trim() || !formData.nama_bagian.trim()) {
      setModalError('Kode bagian dan Nama bagian wajib diisi.');
      return;
    }

    if (formData.is_manual_quota && (formData.manual_kuota < 0 || isNaN(formData.manual_kuota))) {
      setModalError('Alokasi kuota manual harus berupa angka positif (≥ 0).');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);

      const payload = {
        bagian_id: formData.bagian_id.trim().toUpperCase(),
        nama_bagian: formData.nama_bagian.trim(),
        deskripsi: formData.deskripsi.trim(),
        manual_kuota: formData.is_manual_quota ? Number(formData.manual_kuota) : null,
        alasan_manual_kuota: formData.is_manual_quota ? formData.alasan_manual_kuota.trim() : '',
        old_bagian_id: modalMode === 'edit' && editingDivision ? editingDivision.bagian_id : undefined
      };

      const res = await api.saveDivision(payload, adminEmail);
      if (res.success) {
        showToast(res.message || 'Data bagian berhasil disimpan.');
        setIsModalOpen(false);
        await fetchDivisions();
      } else {
        setModalError(res.message || 'Gagal menyimpan data bagian.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Terjadi kesalahan saat menyimpan data bagian.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Delete Division (safeguarded)
  const handleDeleteDivision = async (div: Division) => {
    if (div.total_anggota > 0) {
      alert(
        `Bagian "${div.nama_bagian}" (${div.bagian_id}) tidak dapat dihapus karena masih memiliki ${div.total_anggota} anggota terdaftar. Pindahkan anggota terlebih dahulu.`
      );
      return;
    }

    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus bagian "${div.nama_bagian}" (${div.bagian_id})? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.deleteDivision(div.bagian_id, adminEmail);
      if (res.success) {
        showToast(res.message || 'Bagian berhasil dihapus.');
        await fetchDivisions();
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus bagian.');
    } finally {
      setLoading(false);
    }
  };

  // Simulator formula
  const calculateSimulatedQuota = (count: number) => {
    if (count <= 0) return { raw: 0, integerPart: 0, decimalPart: 0, quota: 0, rule: '0 anggota = 0 kursi' };
    const raw = count / 10;
    const integerPart = Math.floor(raw);
    const decimalPart = Math.round((raw - integerPart) * 10) / 10;
    let quota = integerPart;
    let rule = '';
    if (decimalPart >= 0.6) {
      quota = integerPart + 1;
      rule = `Sisa desimal 0.${Math.round(decimalPart * 10)} ≥ 0.6 dibulatkan ke atas (+1 kursi)`;
    } else {
      rule = `Sisa desimal 0.${Math.round(decimalPart * 10)} ≤ 0.5 dibulatkan ke bawah (+0 kursi)`;
    }
    return { raw, integerPart, decimalPart, quota, rule };
  };

  const simResult = calculateSimulatedQuota(simCount);

  // Auto quota calculation for current form
  const currentMemberCount = editingDivision ? editingDivision.total_anggota : 0;
  const currentAutoQuota = calculateSimulatedQuota(currentMemberCount).quota;

  return (
    <div id="admin-divisions-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Master Bagian & Formula Kuota
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Alokasi Kuota Kursi Perwakilan per Bagian
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pengelolaan divisi kerja, perhitungan kuota rasio 10:1, dan penyesuaian diskresi kuota manual.
          </p>
        </div>

        {/* Action Buttons Header */}
        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-divisions"
            type="button"
            disabled={isRefreshing || loading}
            onClick={() => fetchDivisions(true)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer active:scale-95"
            title="Segarkan data bagian"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1E3A8A]' : 'text-gray-500'}`} />
            <span>{isRefreshing ? 'Menyegarkan...' : 'Segarkan'}</span>
          </button>

          <button
            id="btn-tambah-bagian-baru"
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Bagian Baru</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-medium animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Math Rule Explainer Card (PRD Section 5) */}
      <div className="p-6 rounded-2xl bg-[#1E3A8A] text-white shadow-sm border border-blue-900">
        <div className="flex items-center justify-between gap-2 text-blue-200 text-xs font-bold uppercase tracking-wider mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-300" />
            <span>Formula & Aturan Pembulatan (PRD Bagian 5)</span>
          </div>
          <span className="text-[11px] font-mono bg-blue-950/60 px-2.5 py-0.5 rounded border border-blue-800 text-blue-200">
            Rasio 10:1
          </span>
        </div>

        <h3 className="text-lg font-black tracking-tight">
          Rasio Penentuan Kursi: 10 Anggota = 1 Kursi Perwakilan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
          <div className="p-4 rounded-xl bg-blue-900/50 border border-blue-800 space-y-1.5">
            <span className="font-extrabold text-blue-200 block text-sm">
              1. Desimal 0.1 s/d 0.5 (Pembulatan ke Bawah)
            </span>
            <p className="text-blue-100 leading-relaxed">
              Jika sisa bagi desimal antara 0.1 hingga 0.5, kuota kursi <strong>tidak bertambah</strong> (dibulatkan ke bawah).
            </p>
            <div className="font-mono text-emerald-300 text-[11px] pt-1">
              Contoh: 5 org = 0.5 → 0 kursi | 15 org = 1.5 → 1 kursi | 45 org = 4.5 → 4 kursi
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-900/50 border border-blue-800 space-y-1.5">
            <span className="font-extrabold text-blue-200 block text-sm">
              2. Desimal 0.6 s/d 0.9 (Pembulatan ke Atas)
            </span>
            <p className="text-blue-100 leading-relaxed">
              Jika sisa bagi desimal antara 0.6 hingga 0.9, kuota kursi <strong>bertambah +1 kursi</strong> (dibulatkan ke atas).
            </p>
            <div className="font-mono text-emerald-300 text-[11px] pt-1">
              Contoh: 6 org = 0.6 → 1 kursi | 16 org = 1.6 → 2 kursi | 46 org = 4.6 → 5 kursi
            </div>
          </div>
        </div>
      </div>

      {/* Divisions Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider">
              Daftar Alokasi Kuota Aktif
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Gunakan tombol <strong>[Edit / Ubah]</strong> pada kolom aksi untuk mengubah nama, kode, atau diskresi kuota manual.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 font-mono bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
              Total {divisions.reduce((sum, d) => sum + d.kuota_perwakilan, 0)} Kursi di {divisions.length} Bagian
            </span>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] hover:text-blue-900 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baru</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Bagian / Divisi</th>
                <th className="py-3.5 px-4 text-center">Jumlah Anggota</th>
                <th className="py-3.5 px-4 text-center">Rasio Mentah (/10)</th>
                <th className="py-3.5 px-4 text-center">Aturan & Status Kuota</th>
                <th className="py-3.5 px-4 text-center">Kuota Perwakilan</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Memuat data kuota bagian...
                  </td>
                </tr>
              ) : divisions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-2">
                        <Building2 className="w-5 h-5 text-[#1E3A8A]" />
                      </div>
                      <p className="text-sm font-bold text-gray-800">
                        Database Bersih — Belum Ada Data Bagian
                      </p>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Data bagian contoh telah dikosongkan. Data bagian dan alokasi kuota perwakilan akan dibuat secara otomatis saat Anda mengimpor Master Data Anggota, atau Anda dapat menambahkannya secara manual.
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleOpenCreateModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tambah Bagian Manual</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                divisions.map(div => {
                  const raw = (div.total_anggota / 10).toFixed(1);
                  const dec = (div.total_anggota % 10) / 10;
                  const isRoundUp = dec >= 0.6;
                  const isManual = div.manual_kuota !== undefined && div.manual_kuota !== null;

                  return (
                    <tr key={div.bagian_id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Bagian / Divisi */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="font-bold text-gray-900 text-sm">{div.nama_bagian}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-500 font-mono font-bold bg-gray-100 px-1.5 py-0.5 rounded">
                            {div.bagian_id}
                          </span>
                          {div.deskripsi && (
                            <span className="text-[11px] text-gray-400 truncate max-w-xs">
                              • {div.deskripsi}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Jumlah Anggota */}
                      <td className="py-3.5 px-4 text-center font-bold text-gray-900 font-mono">
                        <span className="px-2.5 py-1 bg-gray-100 rounded-md">
                          {div.total_anggota} Orang
                        </span>
                      </td>

                      {/* Rasio Mentah */}
                      <td className="py-3.5 px-4 text-center font-mono text-gray-600">
                        {div.total_anggota} / 10 = <strong>{raw}</strong>
                      </td>

                      {/* Aturan & Status Kuota */}
                      <td className="py-3.5 px-4 text-center">
                        {isManual ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px] uppercase tracking-wider">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              Pengecualian Aturan (Manual)
                            </span>
                            {div.alasan_manual_kuota && (
                              <span className="text-[10px] text-gray-400 italic mt-0.5 max-w-[200px] truncate" title={div.alasan_manual_kuota}>
                                "{div.alasan_manual_kuota}"
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-600 font-medium">
                            {dec === 0
                              ? 'Pas kelipatan 10'
                              : isRoundUp
                              ? `Sisa 0.${Math.round(dec * 10)} (≥ 0.6 Pembulatan Atas)`
                              : `Sisa 0.${Math.round(dec * 10)} (≤ 0.5 Pembulatan Bawah)`}
                          </span>
                        )}
                      </td>

                      {/* Kuota Perwakilan */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-black text-xs font-mono uppercase ${
                          isManual
                            ? 'bg-amber-50 text-amber-900 border border-amber-300'
                            : 'bg-blue-50 text-[#1E3A8A] border border-blue-200'
                        }`}>
                          <Award className="w-3.5 h-3.5" />
                          {div.kuota_perwakilan} Kursi
                        </span>
                      </td>

                      {/* Kolom Aksi */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`btn-edit-${div.bagian_id.toLowerCase()}`}
                            type="button"
                            onClick={() => handleOpenEditModal(div)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1E3A8A] font-bold text-xs border border-blue-200 transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title={`Edit nama, kode, atau kuota ${div.nama_bagian}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit / Ubah</span>
                          </button>

                          {div.total_anggota === 0 && (
                            <button
                              id={`btn-hapus-${div.bagian_id.toLowerCase()}`}
                              type="button"
                              onClick={() => handleDeleteDivision(div)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                              title="Hapus bagian (0 anggota)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Interactive Simulator Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs">
        <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-[#1E3A8A]" />
          Simulator Uji Hitung Kuota Interaktif
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Ketikkan sembarang jumlah anggota untuk melihat bagaimana formula rasio 10:1 bekerja:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          <div className="sm:col-span-5">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
              Masukkan Jumlah Anggota Bagian:
            </label>
            <input
              id="input-simulasi-anggota"
              type="number"
              min={0}
              max={1000}
              value={simCount}
              onChange={e => setSimCount(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full h-11 px-4 text-base font-bold font-mono rounded-xl border border-gray-300 focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-hidden"
            />
          </div>

          <div className="sm:col-span-7 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-600 uppercase tracking-wider">Hasil Kuota:</span>
              <span className="text-lg font-black text-[#1E3A8A] font-mono">
                {simResult.quota} Kursi Perwakilan
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 text-gray-600 flex justify-between font-mono text-[11px]">
              <span>Perhitungan: {simCount} / 10 = {simResult.raw.toFixed(1)}</span>
              <span>{simResult.rule}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL DIALOG: EDIT / TAMBAH BAGIAN (POP-UP) */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div
          id="modal-division-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div
            id="modal-division-dialog"
            className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#1E3A8A] flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                    {modalMode === 'edit' ? 'Edit / Ubah Data Bagian' : 'Tambah Bagian Baru'}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {modalMode === 'edit'
                      ? `Menyesuaikan identitas dan alokasi kuota "${editingDivision?.nama_bagian}"`
                      : 'Mendaftarkan divisi baru sebelum data anggota di-import'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Kode Bagian */}
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Kode Bagian (ID) *
                </label>
                <input
                  id="input-kode-bagian"
                  type="text"
                  required
                  value={formData.bagian_id}
                  onChange={e => setFormData({ ...formData, bagian_id: e.target.value.toUpperCase() })}
                  placeholder="Misal: BAG-03"
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-mono font-bold uppercase focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-hidden bg-white text-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Contoh: BAG-03, BAG-07, FIN-01. Kode ini dipakai sebagai referensi pada master data anggota.
                </p>
              </div>

              {/* Nama Bagian */}
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Nama Bagian / Divisi *
                </label>
                <input
                  id="input-nama-bagian"
                  type="text"
                  required
                  value={formData.nama_bagian}
                  onChange={e => setFormData({ ...formData, nama_bagian: e.target.value })}
                  placeholder="Misal: Human Capital (sebelumnya HR & GA)"
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-bold focus:border-blue-700 focus:ring-2 focus:ring-blue-700/20 outline-hidden bg-white text-gray-900"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Contoh: Ubah "HR & GA" menjadi "Human Capital". Nama ini akan muncul di surat suara dan laporan hasil.
                </p>
              </div>

              {/* Deskripsi (Opsional) */}
              <div>
                <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Deskripsi / Keterangan (Opsional)
                </label>
                <input
                  id="input-deskripsi-bagian"
                  type="text"
                  value={formData.deskripsi}
                  onChange={e => setFormData({ ...formData, deskripsi: e.target.value })}
                  placeholder="Misal: Meliputi Divisi Personalia & General Affairs"
                  className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs focus:border-blue-700 outline-hidden bg-white text-gray-900"
                />
              </div>

              {/* Penyesuaian Alokasi Kuota Kursi */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <label className="font-bold text-gray-800 uppercase tracking-wider block text-[11px] border-b border-gray-200 pb-1.5">
                  Metode Alokasi Kuota Kursi Perwakilan
                </label>

                {/* Option 1: Otomatis Rasio 10:1 */}
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-blue-300 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="quotaMode"
                    checked={!formData.is_manual_quota}
                    onChange={() => setFormData({ ...formData, is_manual_quota: false })}
                    className="mt-0.5 text-[#1E3A8A] focus:ring-blue-700"
                  />
                  <div>
                    <span className="font-bold text-gray-900 block">
                      Hitung Otomatis Rasio 10:1 (Standar PRD)
                    </span>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      Kuota dihitung otomatis dari jumlah anggota ({currentMemberCount} anggota terdaftar saat ini = {currentAutoQuota} kursi).
                      Sisa desimal ≥ 0.6 dibulatkan ke atas (+1 kursi), ≤ 0.5 dibulatkan ke bawah.
                    </p>
                  </div>
                </label>

                {/* Option 2: Pengecualian Aturan (Manual Override) */}
                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white hover:border-amber-400 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="quotaMode"
                    checked={formData.is_manual_quota}
                    onChange={() => setFormData({ ...formData, is_manual_quota: true })}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="font-bold text-gray-900 block flex items-center gap-1.5">
                      <span>Penyesuaian Manual (Pengecualian Aturan)</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-mono">
                        Diskresi Khusus
                      </span>
                    </span>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      Pilih opsi ini jika terdapat pengecualian aturan atau kesepakatan pengurus koperasi untuk menetapkan jumlah kursi tertentu.
                    </p>
                  </div>
                </label>

                {/* Manual Input Fields (shown when manual selected) */}
                {formData.is_manual_quota && (
                  <div className="pt-2 pl-6 space-y-3 border-l-2 border-amber-400 ml-3">
                    <div>
                      <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                        Jumlah Kuota Kursi Manual *
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id="input-manual-kuota"
                          type="number"
                          min={0}
                          max={50}
                          value={formData.manual_kuota}
                          onChange={e => setFormData({ ...formData, manual_kuota: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-24 h-10 px-3 rounded-xl border border-amber-300 font-bold font-mono text-sm text-gray-900 bg-white focus:border-amber-500 outline-hidden"
                        />
                        <span className="font-bold text-gray-600 text-xs">Kursi Perwakilan</span>
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                        Alasan Pengecualian Aturan (Catatan Audit) *
                      </label>
                      <input
                        id="input-alasan-kuota"
                        type="text"
                        value={formData.alasan_manual_kuota}
                        onChange={e => setFormData({ ...formData, alasan_manual_kuota: e.target.value })}
                        placeholder="Misal: Kesepakatan Rapat Pengurus Koperasi per 25 Agustus 2026"
                        className="w-full h-10 px-3 rounded-xl border border-amber-300 text-xs focus:border-amber-500 outline-hidden bg-white text-gray-900"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Catatan ini akan tercatat dalam Audit Log pemilihan sebagai bentuk pertanggungjawaban.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Notice for cascade update */}
              {modalMode === 'edit' && editingDivision && editingDivision.total_anggota > 0 && (
                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 flex items-start gap-2 text-[11px]">
                  <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Pembaruan Otomatis Terhubung:</strong> Mengubah nama atau kode bagian ini akan otomatis memperbarui {editingDivision.total_anggota} anggota dan semua kandidat terdaftar di bagian ini.
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Batal
                </button>

                <button
                  id="btn-simpan-bagian"
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {modalSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{modalMode === 'edit' ? 'Simpan Perubahan' : 'Daftarkan Bagian'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

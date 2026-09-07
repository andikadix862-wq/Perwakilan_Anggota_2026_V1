import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Calendar,
  Lock,
  Building2,
  FileCheck,
  Trash2
} from 'lucide-react';
import { api } from '../../services/api';
import { ElectionConfig, VotingStatus } from '../../types';
import { IndonesianDateTimePicker } from './IndonesianDateTimePicker';

interface AdminElectionConfigProps {
  adminEmail: string;
  onConfigUpdated?: (config: ElectionConfig) => void;
}

export const AdminElectionConfig: React.FC<AdminElectionConfigProps> = ({
  adminEmail,
  onConfigUpdated
}) => {
  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.getConfig();
      setConfig(res.config);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat konfigurasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    try {
      setSaving(true);
      setSaveSuccess(false);
      const res = await api.updateConfig(config, adminEmail);
      if (res.success) {
        setSaveSuccess(true);
        if (onConfigUpdated) onConfigUpdated(res.config);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan konfigurasi.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDb = async () => {
    if (!window.confirm('PERINGATAN: Apakah Anda yakin ingin mereset seluruh database ke data awal (seed)? Semua suara yang masuk akan dihapus dan direset.')) {
      return;
    }
    try {
      await api.resetDatabase(adminEmail);
      alert('Database berhasil direset ke kondisi awal.');
      fetchConfig();
    } catch (err: any) {
      alert(err.message || 'Gagal mereset database.');
    }
  };

  const handleClearDummyData = async () => {
    if (!window.confirm('PERINGATAN PEMBERSIHAN DATABASE:\n\nApakah Anda yakin ingin MENGHAPUS SELURUH DATA CONTOH (dummy data)?\n\n• Seluruh Data Anggota contoh akan dihapus.\n• Seluruh Data Kandidat contoh akan dihapus.\n• Seluruh Data Suara pemilih akan dihapus & statistik kembali ke 0.\n• Data Bagian akan dikosongkan (otomatis dibuat saat import anggota baru).\n• Reset Audit Log aktivitas data.\n\n✓ Akun Super Administrator panitia tetap dipertahankan.\n\nLanjutkan pengosongan database?')) {
      return;
    }
    try {
      setSaving(true);
      const res = await api.clearDummyData(adminEmail);
      alert(res.message || 'Database berhasil dikosongkan dan siap menerima import data baru.');
      fetchConfig();
    } catch (err: any) {
      alert(err.message || 'Gagal mengosongkan data dummy.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="py-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-gray-200">
        <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        Memuat konfigurasi sistem...
      </div>
    );
  }

  return (
    <div id="admin-config-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Konfigurasi Sistem
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Konfigurasi Parameter Pemilihan
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Pengaturan periode, status aktifasi pemilihan, batasan pensiun, dan aturan suara.
          </p>
        </div>

        {saveSuccess && (
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold uppercase tracking-wider animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Konfigurasi Berhasil Disimpan</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Main Parameters Card */}
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-gray-100">
            <Building2 className="w-4 h-4 text-[#1E3A8A]" />
            Informasi Pokok & Identitas Pemilihan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Nama Sistem</label>
              <input
                type="text"
                value={config.nama_sistem}
                onChange={e => setConfig({ ...config, nama_sistem: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Organisasi Penyelenggara</label>
              <input
                type="text"
                value={config.organisasi}
                onChange={e => setConfig({ ...config, organisasi: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-medium"
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">Periode Pemilihan</label>
              <input
                type="text"
                value={config.periode_pemilihan}
                onChange={e => setConfig({ ...config, periode_pemilihan: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Status Pemilihan (Voting Status) *
              </label>
              <select
                id="select-voting-status"
                value={config.voting_status}
                onChange={e => setConfig({ ...config, voting_status: e.target.value as VotingStatus })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white font-bold text-gray-900"
              >
                <option value="DRAFT">DRAFT (Persiapan Data & Verifikasi)</option>
                <option value="AKTIF">AKTIF (Pemungutan Suara Sedang Berjalan)</option>
                <option value="SELESAI">SELESAI (Pemilihan Berakhir, Rekapitulasi)</option>
                <option value="DITUTUP">DITUTUP (Terkunci Sepenuhnya)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Business Rules Card (PRD Section 8, 14) */}
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider flex items-center gap-2 pb-3 border-b border-gray-100">
            <Lock className="w-4 h-4 text-[#1E3A8A]" />
            Parameter Aturan Bisnis & Batasan Syarat
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Batas Tahun Sebelum Pensiun (Tahun) *
              </label>
              <input
                type="number"
                min={1}
                max={15}
                value={config.batas_tahun_sebelum_pensiun}
                onChange={e => setConfig({ ...config, batas_tahun_sebelum_pensiun: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Calon perwakilan tidak boleh pensiun dalam waktu &lt; nilai ini (default: 4 tahun).
              </p>
            </div>

            <div>
              <label className="font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Aturan Maksimal Pilihan Suara
              </label>
              <select
                value={config.aturan_maksimal_pilihan}
                onChange={e => setConfig({ ...config, aturan_maksimal_pilihan: e.target.value as any })}
                className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700 bg-white font-medium"
              >
                <option value="SESUAI_KUOTA_BAGIAN">Sesuai Kuota Kursi Bagian (Misal: 5 kursi = max 5 pilihan)</option>
                <option value="SATU_PILIHAN">Tepat 1 Pilihan untuk Semua Bagian</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                PRD menetapkan pemilih dapat memilih maksimal sejumlah kuota kursi bagian.
              </p>
            </div>

            <div className="sm:col-span-2">
              <IndonesianDateTimePicker
                id="input-waktu-mulai"
                label="Waktu Mulai Pemilihan (WIB)"
                value={config.voting_start || ''}
                onChange={iso => setConfig({ ...config, voting_start: iso })}
                helperText="Format resmi: DD/MM/YYYY HH:mm (Format jam 24 jam: 00:00 s.d. 23:59 WIB, tanpa AM/PM)"
              />
            </div>

            <div className="sm:col-span-2">
              <IndonesianDateTimePicker
                id="input-waktu-penutupan"
                label="Waktu Penutupan Pemilihan (WIB)"
                value={config.voting_end || ''}
                onChange={iso => setConfig({ ...config, voting_end: iso })}
                helperText="Format resmi: DD/MM/YYYY HH:mm (Format jam 24 jam: 00:00 s.d. 23:59 WIB, tanpa AM/PM)"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 flex-wrap">
          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            <button
              id="btn-clear-dummy-data"
              type="button"
              onClick={handleClearDummyData}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              title="Hapus seluruh data dummy: anggota, kandidat, suara, bagian. Akun super admin tetap aktif."
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Kosongkan Seluruh Data Dummy</span>
            </button>

            <button
              type="button"
              onClick={handleResetDb}
              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
              title="Reset kembali ke data contoh awal pengujian"
            >
              <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
              <span>Reset ke Seed Contoh</span>
            </button>
          </div>

          <button
            id="btn-simpan-konfigurasi"
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Semua Konfigurasi'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

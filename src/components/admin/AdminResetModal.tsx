import React, { useState, useEffect } from 'react';
import { RotateCcw, AlertTriangle, ShieldCheck, X, RefreshCw, KeyRound, UserX, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

interface AdminResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'ALL' | 'MEMBER';
  initialIdentifier?: string;
  adminEmail: string;
  onSuccess: () => void;
}

export const AdminResetModal: React.FC<AdminResetModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'ALL',
  initialIdentifier = '',
  adminEmail,
  onSuccess
}) => {
  const [mode, setMode] = useState<'ALL' | 'MEMBER'>(initialMode);
  const [resetIdentifier, setResetIdentifier] = useState(initialIdentifier);
  const [resetReason, setResetReason] = useState('Reset manual oleh Admin via Verifikasi Keamanan');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setResetIdentifier(initialIdentifier || '');
      setResetReason('Reset manual oleh Admin via Verifikasi Keamanan');
      setAdminPassword('');
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode, initialIdentifier]);

  if (!isOpen) return null;

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setErrorMsg('Password Admin wajib diisi sebagai verifikasi keamanan.');
      return;
    }

    if (mode === 'MEMBER' && !resetIdentifier.trim()) {
      setErrorMsg('Silakan masukkan Email, NIK, No. Anggota, atau ID Transaksi anggota.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'ALL') {
        const res = await api.resetAllVotes(adminPassword.trim(), adminEmail);
        if (res.success) {
          setSuccessMsg(res.message || 'Seluruh data suara dan hasil pemilihan berhasil di-reset.');
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setErrorMsg(res.message || 'Gagal mereset data suara.');
        }
      } else {
        const res = await api.resetMemberStatus(
          resetIdentifier.trim(),
          resetReason.trim(),
          adminEmail,
          adminPassword.trim()
        );
        if (res.success) {
          setSuccessMsg(res.message || `Status suara anggota ${res.memberName || ''} berhasil di-reset.`);
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setErrorMsg(res.message || 'Gagal mereset status suara anggota.');
        }
      }
    } catch (err: any) {
      console.error('Reset error:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses reset suara.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              mode === 'ALL'
                ? 'bg-rose-100 border border-rose-200 text-rose-700'
                : 'bg-amber-100 border border-amber-200 text-amber-700'
            }`}>
              {mode === 'ALL' ? <Trash2 className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
                {mode === 'ALL' ? 'Konfirmasi Reset SELURUH Suara' : 'Konfirmasi Reset Suara Anggota'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Verifikasi Keamanan Akses Administrator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl text-xs font-bold text-gray-600">
          <button
            type="button"
            onClick={() => {
              setMode('ALL');
              setErrorMsg(null);
            }}
            className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'ALL'
                ? 'bg-rose-600 text-white shadow-xs font-black'
                : 'hover:text-gray-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Keseluruhan (0)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('MEMBER');
              setErrorMsg(null);
            }}
            className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'MEMBER'
                ? 'bg-amber-600 text-white shadow-xs font-black'
                : 'hover:text-gray-900'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>Reset Per Anggota</span>
          </button>
        </div>

        {/* Warning Information Banner */}
        {mode === 'ALL' ? (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
            <div className="flex items-center gap-2 font-extrabold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>PERINGATAN PEMBATALAN KESELURUHAN DATA SUARA:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800 leading-relaxed font-medium">
              <li>Seluruh transaksi pencoblosan di tabel suara akan <strong>dihapus permanen</strong>.</li>
              <li>Status seluruh anggota dikembalikan menjadi <strong>BELUM_MEMILIH</strong>.</li>
              <li>Perolehan suara dan persentase seluruh kandidat kembali ke angka <strong>0</strong>.</li>
              <li>Rekapitulasi partisipasi & status kursi per bagian kembali ke kondisi awal <strong>(0 terisi)</strong>.</li>
            </ul>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-extrabold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>KETENTUAN PEMBATALAN SUARA PER ANGGOTA:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 leading-relaxed font-medium">
              <li>Transaksi suara anggota tersebut akan dihapus/dianulir dari sistem.</li>
              <li>Akumulasi perolehan suara kandidat pilihan anggota tersebut otomatis dikurangi/dihitung ulang.</li>
              <li>Status hak suara anggota tersebut kembali menjadi <strong>BELUM_MEMILIH</strong>.</li>
            </ul>
          </div>
        )}

        {/* Error / Success Feedback Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-100 border border-red-300 text-red-900 text-xs font-bold flex items-center gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Reset Form */}
        <form onSubmit={handleExecuteReset} className="space-y-4">
          {mode === 'MEMBER' && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Email / NIK / No. Anggota / ID Transaksi Anggota:
                </label>
                <input
                  type="text"
                  required
                  value={resetIdentifier}
                  onChange={e => setResetIdentifier(e.target.value)}
                  placeholder="Contoh: akuputerisolo@gmail.com atau NIK-1001"
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:border-amber-600 text-gray-900 font-mono bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Alasan Pembatalan / Reset:
                </label>
                <input
                  type="text"
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  placeholder="Contoh: Koreksi data kesalahan pencoblosan..."
                  className="w-full p-2.5 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:border-amber-600 text-gray-900 bg-white"
                />
              </div>
            </>
          )}

          {/* Admin Password Input */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-1.5">
            <label className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Verifikasi Password Admin <span className="text-rose-600">*</span></span>
            </label>
            <p className="text-[11px] text-gray-500">
              Masukkan password admin Anda untuk mengonfirmasi tindakan ini.
            </p>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={adminPassword}
                onChange={e => {
                  setAdminPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Masukkan Password Admin (contoh: admin2026)"
                className="w-full p-2.5 pr-12 rounded-xl border border-gray-300 text-xs focus:outline-hidden focus:border-amber-600 font-mono text-gray-900 bg-white shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-gray-500 hover:text-gray-800 px-2 py-1 rounded cursor-pointer"
              >
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={loading || !adminPassword.trim() || (mode === 'MEMBER' && !resetIdentifier.trim())}
              className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'ALL'
                  ? 'bg-rose-600 hover:bg-rose-700 active:scale-98'
                  : 'bg-amber-600 hover:bg-amber-700 active:scale-98'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Reset...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Konfirmasi Reset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

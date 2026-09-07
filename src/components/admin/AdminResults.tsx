import React, { useState, useEffect } from 'react';
import {
  Award,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  FileSpreadsheet,
  Building2,
  Vote,
  Sparkles,
  HelpCircle,
  Check,
  X,
  RotateCcw,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../services/api';
import { DivisionResult, ElectionConfig, CandidateResult } from '../../types';
import { AdminResetModal } from './AdminResetModal';

interface AdminResultsProps {
  adminEmail: string;
  onRefreshData?: () => void;
}

export const AdminResults: React.FC<AdminResultsProps> = ({ adminEmail, onRefreshData }) => {
  const [results, setResults] = useState<DivisionResult[]>([]);
  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBagian, setSelectedBagian] = useState('ALL');

  // Tie-Break Modal State
  const [isTieModalOpen, setIsTieModalOpen] = useState(false);
  const [activeTieBagian, setActiveTieBagian] = useState<DivisionResult | null>(null);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<string[]>([]);
  const [tieNotes, setTieNotes] = useState('Berdasarkan musyawarah mufakat panitia & lama keanggotaan');

  // Reset Vote Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetModalMode, setResetModalMode] = useState<'ALL' | 'MEMBER'>('ALL');
  const [resetTargetIdentifier, setResetTargetIdentifier] = useState('');

  const fetchResults = async () => {
    try {
      setLoading(true);
      const res = await api.getResults(adminEmail);
      setResults(res.results || []);
      setConfig(res.config);
    } catch (err: any) {
      alert(err.message || 'Gagal memuat hasil pemilihan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const filteredResults = selectedBagian === 'ALL'
    ? results
    : results.filter(r => r.bagian_id === selectedBagian);

  const totalVotesAcrossAll = results.reduce((sum, r) => sum + r.total_suara_masuk, 0);

  const handleOpenTieModal = (divisionResult: DivisionResult) => {
    setActiveTieBagian(divisionResult);
    // Find tied candidates
    const tied = divisionResult.candidates.filter(c => c.status_kursi === 'TIE');
    setSelectedWinnerIds(tied.slice(0, 1).map(c => c.kandidat_id));
    setIsTieModalOpen(true);
  };

  const handleSaveTieBreak = async () => {
    if (!activeTieBagian) return;

    try {
      const tiedCandidates = activeTieBagian.candidates.filter(c => c.status_kursi === 'TIE');
      await api.resolveTieBreak({
        bagian_id: activeTieBagian.bagian_id,
        candidate_ids: tiedCandidates.map(c => c.kandidat_id),
        winner_ids: selectedWinnerIds,
        catatan_keputusan: tieNotes,
        resolved_by: adminEmail
      });
      setIsTieModalOpen(false);
      fetchResults();
      alert('Keputusan tie-break panitia berhasil diterapkan.');
    } catch (err: any) {
      alert(err.message || 'Gagal menyelesaikan tie-break.');
    }
  };

  return (
    <div id="admin-results-view" className="space-y-6">

      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Hasil Rekapitulasi
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Rekapitulasi Hasil & Penetapan Pemenang
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Perolehan suara terverifikasi, ranking perwakilan terpilih, dan penanganan suara berimbang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedBagian}
            onChange={e => setSelectedBagian(e.target.value)}
            className="h-10 px-3 text-xs rounded-xl border border-gray-300 focus:border-blue-700 outline-hidden bg-white shadow-2xs font-medium"
          >
            <option value="ALL">Semua Bagian ({results.length} Bagian)</option>
            {results.map(r => (
              <option key={r.bagian_id} value={r.bagian_id}>
                {r.nama_bagian} ({r.kuota_kursi} Kursi)
              </option>
            ))}
          </select>

          <button
            id="btn-reset-all-votes"
            onClick={() => {
              setResetModalMode('ALL');
              setResetTargetIdentifier('');
              setIsResetModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-xs font-bold uppercase tracking-wider text-rose-900 transition-colors flex items-center gap-1.5 shadow-2xs active:scale-95 cursor-pointer"
            title="Batalkan & Reset Seluruh Data Suara Pemilihan (Kembali ke 0)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-700" />
            <span>BATALKAN / RESET SUARA</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-gray-600" />
            <span>Cetak Berita Acara</span>
          </button>
        </div>
      </div>

      {/* Results by Division Cards */}
      <div className="space-y-6">
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-xs bg-white rounded-2xl border border-gray-200">
            <div className="w-6 h-6 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Menghitung perolehan suara...
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="py-16 px-4 text-center bg-white rounded-2xl border border-gray-200 shadow-2xs">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-2">
                <Award className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <p className="text-sm font-bold text-gray-800">
                Database Bersih — Belum Ada Hasil Pemilihan
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Seluruh data suara dan hasil pemilihan telah direset (Total Suara Masuk: 0). Hasil pemilihan dan penentuan pemenang perwakilan per bagian akan muncul secara otomatis setelah pemungutan suara berlangsung.
              </p>
            </div>
          </div>
        ) : (
          filteredResults.map(divRes => {
            const hasTie = divRes.has_tie_break;

            return (
              <div
                key={divRes.bagian_id}
                className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden"
              >
                {/* Division Header */}
                <div className="p-5 sm:px-6 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-gray-900">
                        Bagian {divRes.nama_bagian}
                      </h3>
                      {(() => {
                        const electedCount = divRes.candidates.filter(c => c.status_kursi === 'TERPILIH' && (c.total_suara || 0) > 0).length;
                        return (
                          <span className="px-2.5 py-0.5 rounded text-xs font-black bg-blue-50 text-blue-900 border border-blue-200 font-mono">
                            Kuota: {divRes.kuota_kursi} Kursi ({electedCount} Terisi)
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Total {divRes.total_anggota} anggota • {divRes.total_suara_masuk} pemilih telah memberikan suara ({divRes.partisipasi_persen}% Partisipasi)
                    </p>
                  </div>

                  {hasTie && (
                    <button
                      onClick={() => handleOpenTieModal(divRes)}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider shadow-2xs transition-all flex items-center gap-1.5 animate-pulse"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>Selesaikan Suara Seimbang (Tie)</span>
                    </button>
                  )}
                </div>

                {/* Candidate Results Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                      <tr>
                        <th className="py-3 px-4 sm:px-6 w-16 text-center">Rank</th>
                        <th className="py-3 px-4">Calon Perwakilan</th>
                        <th className="py-3 px-4 text-center">Perolehan Suara</th>
                        <th className="py-3 px-4 w-48">Persentase</th>
                        <th className="py-3 px-4 sm:px-6 text-right">Status Kursi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {divRes.candidates.map((cand, idx) => {
                        const percent = divRes.total_suara_masuk > 0
                          ? Math.round((cand.total_suara / divRes.total_suara_masuk) * 100)
                          : 0;
                        const isElected = cand.status_kursi === 'TERPILIH' && cand.total_suara > 0;
                        const isTie = cand.status_kursi === 'TIE' && cand.total_suara > 0;

                        return (
                          <tr
                            key={cand.kandidat_id}
                            className={`hover:bg-gray-50/80 transition-colors ${
                              isElected
                                ? 'bg-emerald-50/40 font-medium'
                                : isTie
                                ? 'bg-amber-50/40 font-medium'
                                : ''
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`w-6 h-6 rounded-md inline-flex items-center justify-center font-black text-xs font-mono ${
                                  isElected
                                    ? 'bg-emerald-700 text-white'
                                    : isTie
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                }`}
                              >
                                {cand.rank}
                              </span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={cand.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
                                  alt={cand.nama}
                                  className="w-9 h-9 rounded-xl object-cover border border-gray-200 shrink-0"
                                />
                                <div>
                                  <div className="font-extrabold text-gray-900 flex items-center gap-1.5">
                                    <span>{cand.nama}</span>
                                    <span className="text-[10px] text-gray-400 font-normal">
                                      (No. Urut {cand.nomor_urut})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-gray-500 font-mono">
                                    No. Anggota: {cand.nomor_anggota}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-center font-black font-mono text-sm">
                              <span className={cand.total_suara > 0 ? 'text-emerald-700' : 'text-gray-400'}>
                                {cand.total_suara}
                              </span>
                              <span className="text-[10px] font-normal text-gray-400 block">suara</span>
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-[11px] font-mono">
                                  <span className="font-bold text-gray-700">{percent}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      isElected
                                        ? 'bg-emerald-600'
                                        : isTie
                                        ? 'bg-amber-500'
                                        : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 sm:px-6 text-right">
                              {isElected ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold text-xs uppercase tracking-wider">
                                  <Award className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>TERPILIH</span>
                                </span>
                              ) : isTie ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-300 font-bold text-xs uppercase tracking-wider">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                                  <span>SUARA SEIMBANG (TIE)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-gray-400 uppercase">
                                  {cand.total_suara === 0 ? '0 Suara (Belum Terpilih)' : 'Tidak Terpilih'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL TIE-BREAK (PRD Section 22) */}
      {isTieModalOpen && activeTieBagian && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200">
            <div className="flex items-center gap-2 text-amber-900 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold uppercase tracking-wider w-fit mb-3">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Penyelesaian Suara Berimbang (Tie-Break)</span>
            </div>

            <h3 className="text-base font-extrabold text-gray-900">
              Penetapan Kursi Bagian {activeTieBagian.nama_bagian}
            </h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Terdapat calon dengan perolehan suara yang sama persis di batas kuota kursi. Pilih calon yang diputuskan memperoleh kursi perwakilan sesuai Berita Acara Musyawarah Panitia:
            </p>

            <div className="mt-4 space-y-2.5 max-h-56 overflow-y-auto">
              {activeTieBagian.candidates
                .filter(c => c.status_kursi === 'TIE')
                .map(cand => {
                  const isChecked = selectedWinnerIds.includes(cand.kandidat_id);

                  return (
                    <div
                      key={cand.kandidat_id}
                      onClick={() => {
                        if (isChecked) {
                          setSelectedWinnerIds(prev => prev.filter(id => id !== cand.kandidat_id));
                        } else {
                          setSelectedWinnerIds(prev => [...prev, cand.kandidat_id]);
                        }
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-blue-50 border-blue-600'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] text-white text-xs font-black flex items-center justify-center">
                          {cand.nomor_urut}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900">{cand.nama}</div>
                          <div className="text-[11px] text-gray-500 font-mono">Perolehan: {cand.total_suara} suara</div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isChecked ? (
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-gray-300"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="mt-4">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Catatan Dasar Keputusan Panitia:
              </label>
              <textarea
                rows={2}
                value={tieNotes}
                onChange={e => setTieNotes(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-gray-300 text-xs outline-hidden focus:border-blue-700"
              ></textarea>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsTieModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold uppercase tracking-wider"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveTieBreak}
                className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm"
              >
                Simpan & Tetapkan Pemenang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secure Admin Reset Modal */}
      <AdminResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        initialMode={resetModalMode}
        initialIdentifier={resetTargetIdentifier}
        adminEmail={adminEmail}
        onSuccess={() => {
          fetchResults();
          onRefreshData?.();
        }}
      />
    </div>
  );
};

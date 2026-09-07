import React from 'react';
import { ShieldCheck, AlertTriangle, X, Lock, CheckCircle2 } from 'lucide-react';
import { Candidate } from '../types';

interface ConfirmationModalProps {
  isOpen: boolean;
  selectedCandidate?: Candidate | null;
  selectedCandidates?: Candidate[];
  maxVotes?: number;
  namaBagian: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  selectedCandidate,
  selectedCandidates,
  namaBagian,
  isSubmitting,
  onClose,
  onConfirmSubmit
}) => {
  if (!isOpen) return null;

  // Resolve target candidate
  const candidate = selectedCandidate || (selectedCandidates && selectedCandidates[0]) || null;
  const candidateName = candidate?.nama || 'Kandidat Pilihan';
  const candidateNomorUrut = candidate?.nomor_urut || 1;
  const candidateNomorAnggota = candidate?.nomor_anggota || '-';
  const candidateFoto = candidate?.foto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

  return (
    <div
      id="dialog-konfirmasi-suara"
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Konfirmasi Pilihan Suara</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg disabled:opacity-50"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Exact Prompt Mandated Question */}
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 tracking-tight leading-snug">
              Apakah Anda yakin memilih <span className="text-[#1E3A8A] underline decoration-blue-300">{candidateName}</span> sebagai perwakilan dari Bagian <span className="text-gray-900">{namaBagian}</span>?
            </h2>
            <p className="text-xs text-gray-500 mt-1.5">
              Mohon pastikan calon perwakilan yang Anda pilih telah sesuai sebelum mengirim suara resmi.
            </p>
          </div>

          {/* Selected Candidate Preview Card */}
          {candidate && (
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200 space-y-3">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <img
                    src={candidateFoto}
                    alt={candidateName}
                    className="w-16 h-16 rounded-xl object-cover border border-blue-200 shadow-2xs"
                  />
                  <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#1E3A8A] text-white font-black text-xs flex items-center justify-center shadow-xs">
                    {candidateNomorUrut}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-0.5">
                    Calon Perwakilan Terpilih • Nomor Urut {candidateNomorUrut}
                  </div>
                  <h3 className="text-base font-extrabold text-gray-900 truncate">
                    {candidateName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-1">
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px]">
                      No. Anggota: {candidateNomorAnggota}
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-[11px] font-medium">
                      Bagian {namaBagian}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 hidden sm:block">
                  <CheckCircle2 className="w-6 h-6 text-[#1E3A8A]" />
                </div>
              </div>

              {/* Real-time Vote Count Status & Secret Ballot Notice */}
              <div className="pt-2.5 border-t border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-medium">Perolehan Suara Sementara:</span>
                  <span className="font-extrabold text-blue-900 font-mono bg-blue-100/80 px-2 py-0.5 rounded border border-blue-200">
                    {candidate.total_suara || 0} Suara diperoleh
                  </span>
                </div>
                <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1 self-start sm:self-auto">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Prinsip LUBER: Rahasia & Anonim
                </span>
              </div>
            </div>
          )}

          {/* Irreversible Lock Warning */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              <strong>Pemberitahuan Penting:</strong> Setelah suara dikirim, pilihan <strong>tidak dapat diubah</strong> kembali. Sistem akan mengunci hak suara Anda secara permanen sesuai prinsip <strong>Satu Anggota Satu Suara</strong>.
            </p>
          </div>
        </div>

        {/* Footer Actions: [Batal] & [Ya, Kirim Suara] */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            id="btn-modal-batal"
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-white text-gray-700 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>

          <button
            id="btn-modal-ya-kirim-suara"
            type="button"
            disabled={isSubmitting}
            onClick={onConfirmSubmit}
            className="px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>Mengirim Suara...</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Ya, Kirim Suara</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import {
  Printer,
  Download,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  X,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
  FileCheck
} from 'lucide-react';
import { VotingReceiptData } from '../types';
import {
  formatIndonesianDate,
  downloadReceiptHtml,
  openReceiptInNewTab,
  printReceiptDirectly
} from '../utils/printReceipt';

interface PrintReceiptModalProps {
  receipt: VotingReceiptData;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  receipt,
  isOpen,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedDate = formatIndonesianDate(receipt.voted_at || new Date().toISOString());
  const txId = receipt.transaction_id || `TX-YKK-${Date.now()}`;

  const handleCopyTx = () => {
    try {
      navigator.clipboard.writeText(txId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handlePrint = () => {
    setStatusMessage('Mempersiapkan dokumen cetak...');
    const res = printReceiptDirectly(receipt);
    setTimeout(() => {
      if (res.methodUsed === 'new_tab') {
        setStatusMessage('Dokumen dibuka di tab baru untuk pencetakan langsung.');
      } else if (res.methodUsed === 'download') {
        setStatusMessage('File bukti pemilihan berhasil diunduh ke perangkat Anda.');
      } else {
        setStatusMessage('Dialog pencetakan dipicu.');
      }
    }, 500);

    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  };

  const handleDownload = () => {
    downloadReceiptHtml(receipt);
    setStatusMessage('Dokumen HTML resmi berhasil diunduh. Siap dibuka & dicetak kapan saja.');
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleOpenNewTab = () => {
    openReceiptInNewTab(receipt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full my-auto shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#1E3A8A] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-800 flex items-center justify-center">
              <Printer className="w-4 h-4 text-blue-200" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide">
                Bukti Pemilihan Anggota Perwakilan
              </h3>
              <p className="text-[11px] text-blue-200">
                KOPSYAH YKK AP INDONESIA — Periode {receipt.periode_pemilihan || '2026'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-blue-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notification if any */}
        {statusMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Certificate Card Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div
            id="printable-receipt-card"
            className="p-5 rounded-xl border-2 border-blue-900/20 bg-gray-50/70 relative overflow-hidden"
          >
            {/* Watermark */}
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 text-gray-200 font-black text-7xl select-none pointer-events-none opacity-40">
              KOPSYAH
            </div>

            {/* Top Seal Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-gray-200">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 block">
                  Koperasi Karyawan Syariah
                </span>
                <span className="text-xs font-black text-gray-900">
                  KOPSYAH YKK AP INDONESIA
                </span>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider w-fit">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                SUARA SAH TERVERIFIKASI
              </span>
            </div>

            {/* Member Details */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Nama Pemilih
                </span>
                <span className="font-bold text-gray-900 text-sm">{receipt.nama}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Nomor Anggota
                </span>
                <span className="font-bold text-gray-900 font-mono text-sm">
                  {receipt.nomor_anggota}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Nomor Induk Karyawan (NIK)
                </span>
                <span className="font-bold text-gray-900 font-mono">{receipt.nik}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider block">
                  Bagian / Divisi
                </span>
                <span className="font-bold text-gray-900">
                  {receipt.nama_bagian} ({receipt.bagian_id})
                </span>
              </div>
            </div>

            {/* Transaction Hash Box */}
            <div className="mt-4 p-3 rounded-lg bg-white border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">
                  ID Transaksi Elektronik Resmi
                </span>
                <button
                  type="button"
                  onClick={handleCopyTx}
                  className="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Salin ID</span>
                    </>
                  )}
                </button>
              </div>
              <div className="font-mono text-xs font-extrabold text-blue-950 break-all select-all">
                {txId}
              </div>
            </div>

            {/* Date & Privacy */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-gray-500">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formattedDate}
              </span>
              <span className="font-bold text-emerald-700 text-[10px] uppercase">
                Digital Seal OK
              </span>
            </div>

            <div className="mt-3.5 p-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[10px] text-blue-900 flex items-start gap-2 leading-relaxed">
              <Lock className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Prinsip Kerahasiaan:</strong> Lembar bukti sah ini tidak memuat pilihan calon anggota demi menjaga asas LUBER dan JURDIL.
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>Unduh Berkas</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNewTab}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-100 text-blue-800 border border-blue-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-700" />
            <span>Buka di Tab Baru</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Dokumen</span>
          </button>
        </div>
      </div>
    </div>
  );
};

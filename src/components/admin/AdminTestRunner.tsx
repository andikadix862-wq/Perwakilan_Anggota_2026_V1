import React, { useState } from 'react';
import {
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileCheck
} from 'lucide-react';
import { api } from '../../services/api';
import { TestResultItem } from '../../types';

export const AdminTestRunner: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{
    passed_count: number;
    total_count: number;
    all_passed: boolean;
    results: TestResultItem[];
  } | null>(null);

  const handleExecuteTests = async () => {
    try {
      setRunning(true);
      const res = await api.runTests();
      if (res.success) {
        setReport(res.testReport);
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan rangkaian pengujian.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div id="admin-test-runner-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Pengujian Otomatis
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Rangkaian Pengujian Otomatis (PRD Pasal 39)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Verifikasi kepatuhan aturan bisnis: 1 Anggota 1 Suara, Anti-Double Vote, Kuota 10:1, Batas Pensiun 4 Tahun, dan Hak Pilih.
          </p>
        </div>

        <button
          id="btn-jalankan-test-suite"
          onClick={handleExecuteTests}
          disabled={running}
          className="px-5 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60"
        >
          {running ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Menjalankan Test Suite...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Jalankan Semua Skenario Uji</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Banner if Report Available */}
      {report && (
        <div
          className={`p-5 rounded-2xl border ${
            report.all_passed
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {report.all_passed ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-base font-extrabold">
                  {report.all_passed
                    ? 'Semua Pengujian Berhasil Lolos (100% Passed)'
                    : 'Terdapat Skenario Uji Yang Gagal'}
                </h3>
                <p className="text-xs opacity-80 mt-0.5">
                  Hasil: {report.passed_count} dari {report.total_count} skenario uji valid sesuai ketentuan PRD KOPSYAH YKK AP.
                </p>
              </div>
            </div>

            <div className="text-right font-mono font-black text-xl">
              {report.passed_count}/{report.total_count}
            </div>
          </div>
        </div>
      )}

      {/* Test Scenarios List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-gray-100 font-bold text-xs uppercase tracking-wider text-gray-800">
          Daftar Skenario Uji Penerimaan Sistem (Acceptance Tests)
        </div>

        <div className="divide-y divide-gray-100">
          {!report ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              <Sparkles className="w-8 h-8 text-[#1E3A8A] mx-auto mb-2 opacity-60" />
              Klik tombol <strong>"Jalankan Semua Skenario Uji"</strong> di atas untuk memvalidasi seluruh fungsi backend secara otomatis.
            </div>
          ) : (
            report.results.map((item, idx) => (
              <div
                key={idx}
                className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {item.status === 'PASSED' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-gray-900">{item.name}</h4>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{item.details}</p>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <span
                    className={`inline-block px-2.5 py-1 rounded text-[10px] font-black font-mono uppercase tracking-wider ${
                      item.status === 'PASSED'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-50 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

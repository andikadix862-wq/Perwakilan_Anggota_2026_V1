import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  Award,
  Building2,
  Calendar,
  Users,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';
import { DivisionResult, ElectionConfig, Member, Candidate } from '../../types';
import { exportToExcel } from '../../utils/exportUtils';

export const AdminReportsExport: React.FC = () => {
  const [results, setResults] = useState<DivisionResult[]>([]);
  const [config, setConfig] = useState<ElectionConfig | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const [resRes, memRes, candRes] = await Promise.all([
          api.getResults(),
          api.getMembers(),
          api.getCandidates()
        ]);
        setResults(resRes.results || []);
        setConfig(resRes.config);
        setMembers(memRes.members || []);
        setCandidates(candRes.candidates || []);
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const totalMembers = members.length;
  const totalVotesCast = members.filter(m => m.status_memilih === 'SUDAH_MEMILIH').length;
  const participationRate = totalMembers > 0 ? Math.round((totalVotesCast / totalMembers) * 100) : 0;

  const handlePrintBeritaAcara = () => {
    try {
      const card = document.getElementById('official-berita-acara-card');
      if (card) {
        const printContent = card.outerHTML;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
              <meta charset="UTF-8">
              <title>Berita Acara Hasil Pemilihan - KOPSYAH YKK AP</title>
              <style>
                @page { size: A4; margin: 15mm 15mm; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  padding: 24px;
                  color: #111827;
                  background: #fff;
                  line-height: 1.5;
                }
                table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 8px; }
                th, td { border: 1px solid #9ca3af; padding: 7px 10px; font-size: 11px; vertical-align: top; }
                th { background: #f3f4f6; color: #1f2937; text-align: left; font-weight: 700; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-justify { text-align: justify; }
                .italic { font-style: italic; }
                .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
                .font-bold { font-weight: 700; }
                .font-extrabold { font-weight: 800; }
                .font-black { font-weight: 900; }
                .uppercase { text-transform: uppercase; }
                .underline { text-decoration: underline; }
                .text-gray-400 { color: #9ca3af; }
                .text-gray-500 { color: #6b7280; }
                .text-gray-600 { color: #4b5563; }
                .text-gray-700 { color: #374151; }
                .text-gray-900 { color: #111827; }
                .border-b-2 { border-bottom: 2px solid #111827; }
                .border-t { border-top: 1px solid #d1d5db; }
                .grid-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
                .grid-cols-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
                .space-y-1 > * + * { margin-top: 4px; }
                .space-y-2 > * + * { margin-top: 8px; }
                .space-y-4 > * + * { margin-top: 16px; }
                .space-y-16 > * + * { margin-top: 60px; }
                .action-bar { display: flex; justify-content: flex-end; margin-bottom: 16px; gap: 8px; }
                .btn { padding: 8px 16px; font-weight: bold; font-size: 12px; border-radius: 6px; cursor: pointer; border: 1px solid #ccc; background: #fff; }
                .btn-primary { background: #1e3a8a; color: white; border: none; }
                @media print {
                  .action-bar { display: none !important; }
                  body { padding: 0 !important; }
                }
              </style>
            </head>
            <body>
              <div class="action-bar">
                <button class="btn" onclick="window.close()">Tutup</button>
                <button class="btn btn-primary" onclick="window.print()">&#128438; Cetak Dokumen / Simpan PDF</button>
              </div>
              ${printContent}
              <script>
                window.addEventListener('DOMContentLoaded', function() {
                  setTimeout(function() { window.print(); }, 400);
                });
              </script>
            </body>
            </html>
          `);
          printWindow.document.close();
          return;
        }
      }
    } catch {
      // fallback to standard print
    }
    window.print();
  };

  const handleExportFullResultsExcel = () => {
    const exportData: any[] = [];

    results.forEach(d => {
      d.candidates.forEach(c => {
        const isActuallyElected = (c.status_kursi === 'TERPILIH' || c.status_terpilih === 'TERPILIH') && (c.total_suara || 0) > 0;
        const statusKursi = isActuallyElected ? 'TERPILIH' : 'TIDAK_TERPILIH';

        exportData.push({
          'Bagian ID': d.bagian_id,
          'Nama Bagian / Divisi': d.nama_bagian,
          'Kuota Kursi': d.kuota_kursi,
          'Total Anggota': d.total_anggota,
          'Partisipasi Pemilih (%)': `${d.partisipasi_persen}%`,
          'No. Urut': c.nomor_urut,
          'Nama Kandidat': c.nama,
          'No. Anggota': c.nomor_anggota,
          'Perolehan Suara Sah': c.total_suara || 0,
          'Status Kursi': statusKursi
        });
      });
    });

    exportToExcel({
      filename: `Laporan_Hasil_Lengkap_Pemilihan_${new Date().getFullYear()}.xlsx`,
      sheetName: 'Hasil Lengkap Pemilihan',
      data: exportData
    });
  };

  const handleExportElectedOnlyExcel = () => {
    const exportData: any[] = [];
    let rowNum = 1;

    results.forEach(d => {
      const elected = d.candidates.filter(
        c => (c.status_kursi === 'TERPILIH' || c.status_terpilih === 'TERPILIH') && (c.total_suara || 0) > 0
      );

      if (elected.length === 0) {
        exportData.push({
          'No': rowNum++,
          'Bagian / Divisi': d.nama_bagian,
          'Kuota Kursi': d.kuota_kursi,
          'Status Kelulusan Bagian': 'Belum Ada Calon Terpilih',
          'No. Urut': '-',
          'Nama Perwakilan Terpilih': 'Belum ada calon terpilih (Syarat minimal 1 suara sah)',
          'No. Anggota': '-',
          'Perolehan Suara Sah': 0,
          'Status Penetapan': 'BELUM TERISI'
        });
      } else {
        elected.forEach(c => {
          exportData.push({
            'No': rowNum++,
            'Bagian / Divisi': d.nama_bagian,
            'Kuota Kursi': d.kuota_kursi,
            'Status Kelulusan Bagian': `${elected.length}/${d.kuota_kursi} Kursi Terisi`,
            'No. Urut': c.nomor_urut,
            'Nama Perwakilan Terpilih': c.nama,
            'No. Anggota': c.nomor_anggota,
            'Perolehan Suara Sah': c.total_suara || 0,
            'Status Penetapan': 'PERWAKILAN TERPILIH (SAH)'
          });
        });
      }
    });

    exportToExcel({
      filename: `Laporan_Perwakilan_Terpilih_${new Date().getFullYear()}.xlsx`,
      sheetName: 'Daftar Perwakilan Terpilih',
      data: exportData
    });
  };

  return (
    <div id="admin-reports-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#1E3A8A] border border-blue-200">
              Laporan & Berita Acara
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
            Pusat Laporan & Berita Acara Resmi
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unduh rekapitulasi data dan cetak Berita Acara Penetapan Anggota Perwakilan Terpilih.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportElectedOnlyExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-xs font-bold uppercase tracking-wider text-emerald-800 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Perwakilan Terpilih (Excel)</span>
          </button>

          <button
            onClick={handleExportFullResultsExcel}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-300 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Hasil Lengkap (Excel)</span>
          </button>

          <button
            onClick={handlePrintBeritaAcara}
            className="px-4 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen / Simpan PDF</span>
          </button>
        </div>
      </div>

      {/* Official Berita Acara Printable Template (PRD Section 30) */}
      <div id="official-berita-acara-card" className="p-8 sm:p-12 bg-white rounded-2xl border border-gray-300 shadow-sm text-gray-900 space-y-6">
        {/* Kop Surat Organisasi */}
        <div className="text-center pb-6 border-b-2 border-gray-800 space-y-1">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide">
            KOPERASI KARYAWAN SYARIAH (KOPSYAH)
          </h1>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#1E3A8A]">
            KOPSYAH YKK AP INDONESIA
          </h2>
          <p className="text-xs text-gray-600">
            Panitia Pemilihan Anggota Perwakilan Online — Periode {config?.periode_pemilihan || '2026'}
          </p>
        </div>

        {/* Judul Berita Acara */}
        <div className="text-center py-2">
          <h3 className="text-base sm:text-lg font-black uppercase underline tracking-wider">
            BERITA ACARA HASIL PEMILIHAN ANGGOTA PERWAKILAN
          </h3>
          <p className="text-xs font-mono text-gray-500 mt-1">
            NOMOR: BA.001/PAN-PEMP/KOPSYAH-YKK/2026
          </p>
        </div>

        {/* Narasi Pembuka */}
        <div className="text-xs text-gray-700 leading-relaxed text-justify space-y-2">
          <p>
            Pada hari ini, dengan menggunakan <strong>{config?.nama_sistem || 'Sistem Pemilihan Anggota Perwakilan Online'}</strong>, telah dilaksanakan pemungutan dan penghitungan suara pemilihan anggota perwakilan <strong>{config?.organisasi || 'KOPSYAH YKK AP Indonesia'}</strong> Periode 2026.
          </p>
          <p>
            Berdasarkan ketentuan Anggaran Dasar/Anggaran Rumah Tangga dan rasio keterwakilan 10:1 dengan formula pembulatan resmi, diperoleh rekapitulasi sebagai berikut:
          </p>
        </div>

        {/* Summary Numbers Box */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-center font-mono">
          <div>
            <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">Total Anggota</span>
            <span className="font-extrabold text-gray-900 text-sm">{totalMembers} Orang</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">Suara Masuk</span>
            <span className="font-extrabold text-emerald-700 text-sm">{totalVotesCast} Suara</span>
          </div>
          <div>
            <span className="text-gray-500 block text-[10px] uppercase tracking-wider font-bold">Tingkat Partisipasi</span>
            <span className="font-extrabold text-[#1E3A8A] text-sm">{participationRate}%</span>
          </div>
        </div>

        {/* Tabel Hasil Terpilih per Bagian */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
              Daftar Anggota Perwakilan Terpilih per Bagian:
            </h4>
            <span className="text-[11px] text-gray-500 italic">
              *Hanya kandidat dengan perolehan minimal 1 suara sah yang dapat ditetapkan terpilih
            </span>
          </div>

          <div className="border border-gray-300 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 font-bold text-gray-700 uppercase tracking-wider border-b border-gray-300">
                <tr>
                  <th className="py-2.5 px-3 border-r border-gray-300 w-12 text-center">No</th>
                  <th className="py-2.5 px-3 border-r border-gray-300">Bagian / Divisi</th>
                  <th className="py-2.5 px-3 border-r border-gray-300 text-center w-28">Kuota Kursi</th>
                  <th className="py-2.5 px-3">Nama Perwakilan Terpilih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {results.map((divRes, idx) => {
                  // Strictly filter: candidate MUST have at least 1 vote (> 0) and status_kursi === 'TERPILIH'
                  const elected = divRes.candidates.filter(
                    c => (c.status_kursi === 'TERPILIH' || c.status_terpilih === 'TERPILIH') && (c.total_suara || 0) > 0
                  );

                  return (
                    <tr key={divRes.bagian_id}>
                      <td className="py-2.5 px-3 text-center font-mono border-r border-gray-200">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-bold border-r border-gray-200">
                        {divRes.nama_bagian}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono border-r border-gray-200">
                        <div className="font-bold">{divRes.kuota_kursi} Kursi</div>
                        <div className="text-[10px] text-gray-500 font-sans">
                          {elected.length > 0 ? `(${elected.length} terisi)` : '(0 terisi)'}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {elected.length === 0 ? (
                          <span className="text-gray-400 italic">Belum ada calon terpilih</span>
                        ) : (
                          <div className="space-y-1">
                            {elected.map((c, cIdx) => (
                              <div key={c.kandidat_id} className="flex items-center gap-2">
                                <span className="font-extrabold text-gray-900">
                                  {cIdx + 1}. {c.nama}
                                </span>
                                <span className="text-gray-500 font-mono text-[10px]">
                                  (No. Anggota: {c.nomor_anggota} • {c.total_suara} Suara Sah)
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tanda Tangan Panitia (PRD Section 30) */}
        <div className="pt-8 border-t border-gray-200 grid grid-cols-2 gap-8 text-center text-xs">
          <div className="space-y-16">
            <div>
              <p className="text-gray-500">Sekretaris Panitia,</p>
              <p className="font-bold text-gray-900 mt-1 uppercase tracking-wider">KOPSYAH YKK AP INDONESIA</p>
            </div>
            <div>
              <p className="font-bold underline text-gray-900">( ........................................ )</p>
              <p className="text-[10px] text-gray-400 font-mono">NIK: .........................</p>
            </div>
          </div>

          <div className="space-y-16">
            <div>
              <p className="text-gray-500">Ketua Panitia Pemilihan,</p>
              <p className="font-bold text-gray-900 mt-1 uppercase tracking-wider">KOPSYAH YKK AP INDONESIA</p>
            </div>
            <div>
              <p className="font-bold underline text-gray-900">( ........................................ )</p>
              <p className="text-[10px] text-gray-400 font-mono">NIK: .........................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

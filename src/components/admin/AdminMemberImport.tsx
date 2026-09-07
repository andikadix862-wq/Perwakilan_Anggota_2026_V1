import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Download,
  RotateCcw,
  Database,
  RefreshCw,
  Eye,
  Check,
  Building2,
  Mail,
  User,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Calendar
} from 'lucide-react';
import { api } from '../../services/api';
import { Division, Member } from '../../types';
import {
  parseIndonesianDate,
  formatIndonesianDate,
  calculateMemberPension
} from '../../utils/pension';

interface AdminMemberImportProps {
  adminEmail: string;
  onNavigateToMembers?: () => void;
}

interface ColumnMapping {
  nomor_anggota: string;
  nama: string;
  email: string;
  bagian: string;
  nik?: string;
  hak_pilih?: string;
  jabatan?: string;
  tanggal_lahir?: string;
}

interface ValidatedRow {
  rowNumber: number;
  raw: any;
  nomor_anggota: string;
  nama: string;
  nik: string;
  email: string;
  bagian: string;
  resolvedBagianId: string;
  resolvedBagianNama: string;
  isNewDivision?: boolean;
  hak_pilih: boolean;
  tanggal_lahir?: string; // Standard ISO YYYY-MM-DD
  tanggal_lahir_formatted?: string; // Indonesian DD-MM-YYYY
  tanggal_pensiun?: string;
  tanggal_pensiun_formatted?: string;
  usia?: number | null;
  sisa_pensiun_tahun?: number | null;
  is_pensiun_warning?: boolean;
  action: 'INSERT' | 'UPDATE' | 'INVALID';
  errors: string[];
  warnings: string[];
}

export const AdminMemberImport: React.FC<AdminMemberImportProps> = ({
  adminEmail,
  onNavigateToMembers
}) => {
  // Wizard steps: 1 = Upload, 2 = Mapping, 3 = Preview & Validate, 4 = Confirm & Save, 5 = Done
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Raw file & parsed data
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);

  // Divisions & existing members from backend
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [existingMembers, setExistingMembers] = useState<Member[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Column Mapping
  const [mapping, setMapping] = useState<ColumnMapping>({
    nomor_anggota: '',
    nama: '',
    email: '',
    bagian: '',
    nik: '',
    hak_pilih: '',
    jabatan: '',
    tanggal_lahir: ''
  });

  // Validation results
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [filterValidation, setFilterValidation] = useState<'ALL' | 'INSERT' | 'UPDATE' | 'INVALID'>('ALL');

  // Confirmation & Save state
  const [confirmedByUser, setConfirmedByUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    added: number;
    updated: number;
    errors: string[];
    newDivisionsCreated?: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial master divisions and members for cross-validation
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setLoadingInitial(true);
        const [divRes, memRes] = await Promise.all([
          api.getDivisions(adminEmail),
          api.getMembers(undefined, adminEmail)
        ]);
        setDivisions(divRes.divisions || []);
        setExistingMembers(memRes.members || []);
      } catch (err: any) {
        console.error('Master data load failed:', err);
      } finally {
        setLoadingInitial(false);
      }
    };
    fetchMasterData();
  }, [adminEmail]);

  // Step 1: File Parser (XLSX, XLS, CSV)
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with headers
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        if (jsonData.length === 0) {
          alert('File tidak memuat baris data atau kosong.');
          return;
        }

        // Get headers from first row
        const detectedHeaders = Object.keys(jsonData[0]);
        setHeaders(detectedHeaders);
        setRawRows(jsonData);

        // Auto-detect mappings based on header keywords
        const autoMap: ColumnMapping = {
          nomor_anggota: '',
          nama: '',
          email: '',
          bagian: '',
          nik: '',
          hak_pilih: '',
          jabatan: '',
          tanggal_lahir: ''
        };

        detectedHeaders.forEach(h => {
          const clean = h.trim().toLowerCase();
          if (!autoMap.nomor_anggota && (clean.includes('nomor') || clean.includes('no_anggota') || clean.includes('no anggota') || clean.includes('no_agt') || clean.includes('id_anggota') || clean.includes('id anggota') || clean.includes('member_id') || clean.includes('no member') || clean.includes('nomor anggota') || clean.includes('no. anggota'))) {
            autoMap.nomor_anggota = h;
          }
          if (!autoMap.nama && (clean.includes('nama') || clean === 'name' || clean === 'nama_lengkap')) {
            autoMap.nama = h;
          }
          if (!autoMap.nik && (clean.includes('nik') || clean.includes('ktp') || clean.includes('id karyawan') || clean.includes('nik karyawan') || clean.includes('no induk'))) {
            autoMap.nik = h;
          }
          if (!autoMap.email && (clean.includes('email') || clean.includes('surel') || clean.includes('mail'))) {
            autoMap.email = h;
          }
          if (!autoMap.bagian && (clean.includes('bagian') || clean.includes('divisi') || clean.includes('division') || clean.includes('departemen'))) {
            autoMap.bagian = h;
          }
          if (!autoMap.hak_pilih && (clean.includes('hak') || clean.includes('pilih') || clean.includes('eligible') || clean.includes('status_hak'))) {
            autoMap.hak_pilih = h;
          }
          if (!autoMap.jabatan && (clean.includes('jabatan') || clean.includes('posisi') || clean.includes('role'))) {
            autoMap.jabatan = h;
          }
          if (!autoMap.tanggal_lahir && (clean.includes('lahir') || clean.includes('birth') || clean.includes('dob') || clean.includes('tgl_lahir'))) {
            autoMap.tanggal_lahir = h;
          }
        });

        setMapping(autoMap);
        setCurrentStep(2);
      } catch (err: any) {
        alert('Gagal membaca file spreadsheet: ' + (err.message || 'Format tidak didukung'));
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Download Sample Template
  const handleDownloadTemplate = (type: 'csv' | 'xlsx') => {
    const templateData = [
      {
        'Nomor Anggota': 'AGT-0101',
        'Nama Lengkap': 'Budi Santoso, S.T.',
        'NIK': '3201019001010001',
        'Email': 'budi.santoso@kopsyah-ykk.id',
        'Bagian': 'Produksi',
        'Tanggal Lahir': '20-08-1973',
        'Status Hak Pilih': 'YA',
        'Jabatan': 'Koordinator Mesin'
      },
      {
        'Nomor Anggota': 'AGT-0102',
        'Nama Lengkap': 'Siti Rahmawati',
        'NIK': '', // NIK Opsional (boleh dikosongkan)
        'Email': 'siti.rahmawati@kopsyah-ykk.id',
        'Bagian': 'Keuangan',
        'Tanggal Lahir': '01-12-1988',
        'Status Hak Pilih': 'YA',
        'Jabatan': 'Analis Kas'
      },
      {
        'Nomor Anggota': 'AGT-0103',
        'Nama Lengkap': 'Dedi Saputra',
        'NIK': '3201018805040003',
        'Email': 'dedi.saputra@kopsyah-ykk.id',
        'Bagian': 'Operasional',
        'Tanggal Lahir': '',
        'Status Hak Pilih': 'TIDAK',
        'Jabatan': 'Staf Gudang'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master_Anggota');

    if (type === 'csv') {
      XLSX.writeFile(workbook, 'Template_Master_Anggota_Kopsyah.csv', { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, 'Template_Master_Anggota_Kopsyah.xlsx', { bookType: 'xlsx' });
    }
  };

  // Step 2 -> Step 3: Run Validation
  const handleRunValidation = () => {
    if (!mapping.nomor_anggota || !mapping.nama || !mapping.email || !mapping.bagian) {
      alert('Kolom Wajib (Nomor Anggota, Nama Lengkap, Email, Bagian) harus dipetakan.');
      return;
    }

    const seenEmailsInBatch = new Set<string>();
    const seenNomorAnggotaInBatch = new Set<string>();
    const seenNiksInBatch = new Set<string>();

    // Map to track newly encountered divisions in this batch for auto-creation
    const autoCreatedDivisionsMap = new Map<string, { bagian_id: string; nama_bagian: string }>();

    // Determine highest existing BAG-XX index to assign sequential IDs
    let maxBagianNum = 0;
    divisions.forEach(d => {
      const match = d.bagian_id.match(/^BAG-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxBagianNum) maxBagianNum = n;
      }
    });
    if (maxBagianNum === 0) {
      maxBagianNum = divisions.length;
    }

    const results: ValidatedRow[] = rawRows.map((row, idx) => {
      const rowNumber = idx + 2; // spreadsheet row 1 is header
      const errors: string[] = [];
      const warnings: string[] = [];

      const rawNomorAnggota = String(row[mapping.nomor_anggota] || '').trim();
      const rawNama = String(row[mapping.nama] || '').trim();
      const rawNik = mapping.nik ? String(row[mapping.nik] || '').trim() : '';
      const rawEmail = String(row[mapping.email] || '').trim().toLowerCase();
      const rawBagian = String(row[mapping.bagian] || '').trim();
      const rawHakPilih = mapping.hak_pilih ? String(row[mapping.hak_pilih] || '').trim().toUpperCase() : 'YA';
      const rawDobInput = mapping.tanggal_lahir ? row[mapping.tanggal_lahir] : '';

      // Indonesian Date Parsing & Pension calculation (55 years rule)
      const parsedDob = parseIndonesianDate(rawDobInput);
      const pensionInfo = calculateMemberPension(parsedDob);

      if (rawDobInput && !parsedDob) {
        warnings.push(`Format tanggal lahir "${rawDobInput}" tidak dikenali. Disarankan format Tanggal-Bulan-Tahun (DD-MM-YYYY / DD/MM/YYYY).`);
      }

      if (pensionInfo.is_warning) {
        warnings.push(`⚠️ Sisa masa pensiun < 4 tahun (${pensionInfo.sisa_pensiun_text || `${pensionInfo.sisa_pensiun_tahun} thn`} menuju usia 55). Kualifikasi: Hak Memilih AKTIF, Hak Dipilih NONAKTIF (Hanya Pemilih).`);
      }

      // 1. Check Missing Required Fields
      if (!rawNomorAnggota) errors.push('Nomor Anggota kosong');
      if (!rawNama) errors.push('Nama kosong');
      if (!rawEmail) errors.push('Email kosong');
      if (!rawBagian) errors.push('Bagian kosong');

      // 2. Email format validation
      if (rawEmail && !rawEmail.includes('@')) {
        errors.push('Format email tidak valid');
      }

      // 3. Batch Duplicates Check
      if (rawNomorAnggota) {
        const cleanNo = rawNomorAnggota.toUpperCase();
        if (seenNomorAnggotaInBatch.has(cleanNo)) {
          errors.push(`Nomor Anggota ganda di dalam file: ${rawNomorAnggota}`);
        } else {
          seenNomorAnggotaInBatch.add(cleanNo);
        }
      }

      if (rawEmail) {
        if (seenEmailsInBatch.has(rawEmail)) {
          errors.push(`Email ganda di dalam file: ${rawEmail}`);
        } else {
          seenEmailsInBatch.add(rawEmail);
        }
      }

      if (rawNik) {
        if (seenNiksInBatch.has(rawNik)) {
          errors.push(`NIK ganda di dalam file: ${rawNik}`);
        } else {
          seenNiksInBatch.add(rawNik);
        }
      }

      // 4. Resolve Division (Auto-create if unregistered - never reject or LEWATI)
      let resolvedBagianId = rawBagian;
      let resolvedBagianNama = rawBagian;
      let isNewDivision = false;

      if (rawBagian) {
        const resolvedDiv = divisions.find(
          d =>
            d.bagian_id.toLowerCase() === rawBagian.toLowerCase() ||
            d.nama_bagian.toLowerCase() === rawBagian.toLowerCase() ||
            `bagian ${d.nama_bagian.toLowerCase()}` === rawBagian.toLowerCase()
        );

        if (resolvedDiv) {
          resolvedBagianId = resolvedDiv.bagian_id;
          resolvedBagianNama = resolvedDiv.nama_bagian;
          isNewDivision = false;
        } else {
          // Division not yet registered in master: auto-register!
          const normalizedKey = rawBagian.toLowerCase();
          if (autoCreatedDivisionsMap.has(normalizedKey)) {
            const existingAuto = autoCreatedDivisionsMap.get(normalizedKey)!;
            resolvedBagianId = existingAuto.bagian_id;
            resolvedBagianNama = existingAuto.nama_bagian;
          } else {
            const isBagFormat = /^BAG-\d+$/i.test(rawBagian);
            const bagAlreadyTaken = divisions.some(d => d.bagian_id.toUpperCase() === rawBagian.toUpperCase());
            let assignedId = '';
            if (isBagFormat && !bagAlreadyTaken) {
              assignedId = rawBagian.toUpperCase();
            } else {
              maxBagianNum++;
              assignedId = `BAG-${String(maxBagianNum).padStart(2, '0')}`;
            }

            autoCreatedDivisionsMap.set(normalizedKey, {
              bagian_id: assignedId,
              nama_bagian: rawBagian
            });
            resolvedBagianId = assignedId;
            resolvedBagianNama = rawBagian;
          }

          isNewDivision = true;
          warnings.push(`Bagian baru "${rawBagian}" (${resolvedBagianId}) akan didaftarkan otomatis ke master Data Bagian.`);
        }
      }

      // 5. Hak Pilih Parsing
      const hakPilihBool = rawHakPilih === 'YA' || rawHakPilih === 'TRUE' || rawHakPilih === '1' || rawHakPilih === 'AKTIF';

      // 6. Action Detection: INSERT vs UPDATE vs INVALID
      let action: 'INSERT' | 'UPDATE' | 'INVALID' = 'INSERT';

      if (errors.length > 0) {
        action = 'INVALID';
      } else {
        const matchExisting = existingMembers.find(
          m =>
            (m.nomor_anggota && m.nomor_anggota.toUpperCase() === rawNomorAnggota.toUpperCase()) ||
            m.email.toLowerCase() === rawEmail ||
            (rawNik && m.nik && m.nik.toUpperCase() === rawNik.toUpperCase())
        );
        if (matchExisting) {
          action = 'UPDATE';
          warnings.push(`Data sudah ada di database (#${matchExisting.nomor_anggota}). Akan diperbarui.`);
        } else {
          action = 'INSERT';
        }
      }

      return {
        rowNumber,
        raw: row,
        nomor_anggota: rawNomorAnggota,
        nama: rawNama,
        nik: rawNik,
        email: rawEmail,
        bagian: rawBagian,
        resolvedBagianId,
        resolvedBagianNama,
        isNewDivision,
        hak_pilih: hakPilihBool,
        tanggal_lahir: parsedDob || undefined,
        tanggal_lahir_formatted: parsedDob ? formatIndonesianDate(parsedDob) : (rawDobInput ? String(rawDobInput) : '-'),
        tanggal_pensiun: pensionInfo.tanggal_pensiun || undefined,
        tanggal_pensiun_formatted: pensionInfo.tanggal_pensiun ? formatIndonesianDate(pensionInfo.tanggal_pensiun) : '-',
        usia: pensionInfo.usia,
        sisa_pensiun_tahun: pensionInfo.sisa_pensiun_tahun,
        sisa_pensiun_text: pensionInfo.sisa_pensiun_text,
        is_pensiun_warning: pensionInfo.is_warning,
        action,
        errors,
        warnings
      };
    });

    setValidatedRows(results);
    setCurrentStep(3);
  };

  // Step 4: Submit Valid Rows to Database
  const handleExecuteSave = async () => {
    const validRows = validatedRows.filter(r => r.action === 'INSERT' || r.action === 'UPDATE');
    if (validRows.length === 0) {
      alert('Tidak ada data valid yang dapat disimpan ke database.');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<Member>[] = validRows.map(r => ({
        nomor_anggota: r.nomor_anggota,
        nama: r.nama,
        nik: r.nik || '',
        email: r.email,
        bagian_id: r.resolvedBagianId,
        nama_bagian: r.resolvedBagianNama,
        hak_pilih: r.hak_pilih,
        jabatan: mapping.jabatan ? String(r.raw[mapping.jabatan] || '').trim() : 'Anggota',
        tanggal_lahir: r.tanggal_lahir || undefined,
        tanggal_pensiun: r.tanggal_pensiun || undefined,
        status: 'AKTIF'
      }));

      const res = await api.upsertMembers(payload, adminEmail);
      if (res.success && res.result) {
        setSaveResult(res.result);
        setCurrentStep(5);
        // Refresh master cache
        const [mRes, dRes] = await Promise.all([
          api.getMembers(undefined, adminEmail),
          api.getDivisions(adminEmail)
        ]);
        setExistingMembers(mRes.members || []);
        setDivisions(dRes.divisions || []);
      } else {
        alert(res.message || 'Terjadi kesalahan saat menyimpan ke database.');
      }
    } catch (err: any) {
      alert('Gagal menyimpan anggota: ' + (err.message || 'Koneksi backend gagal'));
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const countInsert = validatedRows.filter(r => r.action === 'INSERT').length;
  const countUpdate = validatedRows.filter(r => r.action === 'UPDATE').length;
  const countInvalid = validatedRows.filter(r => r.action === 'INVALID').length;
  const countTotal = validatedRows.length;

  const newDivisionsDetected = Array.from(
    new Set(
      validatedRows
        .filter(r => r.isNewDivision)
        .map(r => `${r.resolvedBagianNama} (${r.resolvedBagianId})`)
    )
  );

  const filteredValidatedRows = validatedRows.filter(r => {
    if (filterValidation === 'ALL') return true;
    return r.action === filterValidation;
  });

  return (
    <div id="admin-member-import-container" className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-[#1E3A8A] border border-blue-200 text-xs font-bold uppercase tracking-wider mb-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-700" />
              <span>Modul Import Data Master Anggota</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Import & Sinkronisasi Master Anggota
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Alur 7 tahap import: Upload file (XLSX/CSV) → Pemetaan Kolom → Preview & Validasi NIK/Email/Bagian → Konfirmasi → Simpan.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Template Excel (.xlsx)</span>
            </button>
            <button
              onClick={() => handleDownloadTemplate('csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4 text-gray-600" />
              <span>Template CSV</span>
            </button>
          </div>
        </div>

        {/* 7-Stage Flow Visualizer */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
            {[
              { num: 1, title: '1. Upload File', desc: 'XLSX / CSV' },
              { num: 2, title: '2. Read Header', desc: 'Auto Deteksi' },
              { num: 3, title: '3. Mapping Kolom', desc: 'Skema Wajib' },
              { num: 4, title: '4. Preview Data', desc: 'Cek Sampel' },
              { num: 5, title: '5. Validasi', desc: 'Email / NIK / Bagian' },
              { num: 6, title: '6. Konfirmasi', desc: 'Review Ringkasan' },
              { num: 7, title: '7. Simpan DB', desc: 'Update / Insert' }
            ].map((stepItem) => {
              const isPassed = currentStep > (stepItem.num <= 3 ? 1 : stepItem.num <= 5 ? 3 : 4);
              const isCurrent =
                (stepItem.num === 1 && currentStep === 1) ||
                (stepItem.num === 2 && currentStep === 1 && fileName !== '') ||
                (stepItem.num === 3 && currentStep === 2) ||
                (stepItem.num === 4 && currentStep === 3) ||
                (stepItem.num === 5 && currentStep === 3) ||
                (stepItem.num === 6 && currentStep === 4) ||
                (stepItem.num === 7 && currentStep === 5);

              return (
                <div
                  key={stepItem.num}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-blue-50 border-[#1E3A8A] ring-1 ring-[#1E3A8A] text-[#1E3A8A] font-bold shadow-xs'
                      : isPassed
                      ? 'bg-gray-50 border-gray-200 text-gray-700'
                      : 'bg-white border-gray-100 text-gray-400 opacity-60'
                  }`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-wider">{stepItem.title}</div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{stepItem.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= STEP 1: UPLOAD FILE ================= */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-2xs text-center space-y-6">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/20 rounded-2xl p-10 transition-colors cursor-pointer max-w-2xl mx-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-4 border border-blue-200">
              <Upload className="w-8 h-8 text-blue-700" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900">
              Pilih atau Tarik File Spreadsheet ke Sini
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Mendukung format Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong>
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold uppercase tracking-wider shadow-2xs hover:bg-blue-900 transition-colors">
              Pilih Dokumen dari Komputer
            </div>
          </div>

          <div className="max-w-xl mx-auto p-4 rounded-xl bg-gray-50 border border-gray-200 text-left text-xs text-gray-600 space-y-1.5">
            <span className="font-bold text-gray-900 uppercase text-[11px] block tracking-wide">
              Ketentuan Struktur Kolom Spreadsheet:
            </span>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Baris pertama harus berupa <strong>Header Nama Kolom</strong>.</li>
              <li>Kolom wajib diisi: <strong>Nomor Anggota</strong>, <strong>Nama Lengkap</strong>, <strong>Email</strong>, dan <strong>Bagian</strong>.</li>
              <li><strong>NIK Karyawan</strong> bersifat opsional (boleh dikosongkan jika belum ada/tidak tersedia).</li>
              <li><strong>Tanggal Lahir</strong> (opsional, format <strong>Tanggal-Bulan-Tahun</strong> seperti <code>DD-MM-YYYY</code> atau <code>DD/MM/YYYY</code>, contoh: <code>20-08-1973</code> atau <code>01/12/1988</code>. Digunakan untuk kalkulasi otomatis usia pensiun 55 tahun dan batas sisa pensiun &lt; 4 tahun). Import tetap sukses jika kolom ini kosong.</li>
              <li>Status Hak Pilih (opsional, jika kosong default: <code>YA</code>).</li>
              <li>Kolom bagian dapat berupa ID (contoh: <code>BAG-01</code>) atau nama (contoh: <code>Produksi</code>).</li>
            </ul>
          </div>
        </div>
      )}

      {/* ================= STEP 2: MAPPING KOLOM ================= */}
      {currentStep === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                Tahap 2 & 3: Header & Pemetaan Kolom
              </span>
              <h2 className="text-lg font-extrabold text-gray-900">
                File: {fileName} ({rawRows.length} baris data ditemukan)
              </h2>
            </div>
            <button
              onClick={() => {
                setFileName('');
                setRawRows([]);
                setHeaders([]);
                setCurrentStep(1);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-600"
            >
              Ganti File
            </button>
          </div>

          <p className="text-xs sm:text-sm text-gray-600">
            Sistem secara otomatis mendeteksi header kolom dari file Anda. Pastikan setiap kolom target dipetakan ke kolom file yang sesuai:
          </p>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nomor Anggota */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Nomor Anggota Koperasi <span className="text-rose-600">*</span></span>
                <span className="text-[10px] text-blue-700 font-mono">Wajib / Unik</span>
              </label>
              <select
                value={mapping.nomor_anggota}
                onChange={e => setMapping({ ...mapping, nomor_anggota: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Pilih Kolom Header --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Nama */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Nama Lengkap Anggota <span className="text-rose-600">*</span></span>
                <span className="text-[10px] text-gray-400 font-mono">Wajib</span>
              </label>
              <select
                value={mapping.nama}
                onChange={e => setMapping({ ...mapping, nama: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Pilih Kolom Header --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Email */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Alamat Email <span className="text-rose-600">*</span></span>
                <span className="text-[10px] text-gray-400 font-mono">Wajib / Login</span>
              </label>
              <select
                value={mapping.email}
                onChange={e => setMapping({ ...mapping, email: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Pilih Kolom Header --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Bagian */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Bagian / Divisi Anggota <span className="text-rose-600">*</span></span>
                <span className="text-[10px] text-gray-400 font-mono">Wajib / Kuota</span>
              </label>
              <select
                value={mapping.bagian}
                onChange={e => setMapping({ ...mapping, bagian: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Pilih Kolom Header --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* NIK Karyawan (Opsional) */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>NIK Karyawan</span>
                <span className="text-[10px] text-gray-500 font-mono">Opsional</span>
              </label>
              <select
                value={mapping.nik || ''}
                onChange={e => setMapping({ ...mapping, nik: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Tidak Ada / Kosong --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Tanggal Lahir (Opsional) */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Tanggal Lahir (DD-MM-YYYY)</span>
                <span className="text-[10px] text-blue-700 font-mono">Opsional (Pensiun 55 Thn)</span>
              </label>
              <select
                value={mapping.tanggal_lahir || ''}
                onChange={e => setMapping({ ...mapping, tanggal_lahir: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Tidak Ada / Kosong --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                Format Tanggal-Bulan-Tahun (misal: <code>20-08-1973</code> atau <code>01/12/1988</code>). Sistem otomatis menghitung batas pensiun 55 tahun.
              </p>
            </div>

            {/* Status Hak Pilih */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Status Hak Pilih</span>
                <span className="text-[10px] text-gray-500 font-mono">Opsional (Default: YA)</span>
              </label>
              <select
                value={mapping.hak_pilih}
                onChange={e => setMapping({ ...mapping, hak_pilih: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Tidak Ada / Default Aktif --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            {/* Jabatan */}
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-800 mb-1 flex items-center justify-between">
                <span>Jabatan / Posisi</span>
                <span className="text-[10px] text-gray-500 font-mono">Opsional (Default: Anggota)</span>
              </label>
              <select
                value={mapping.jabatan || ''}
                onChange={e => setMapping({ ...mapping, jabatan: e.target.value })}
                className="w-full text-xs font-medium bg-white border border-gray-300 rounded-lg p-2.5 text-gray-900 focus:ring-1 focus:ring-blue-600"
              >
                <option value="">-- Tidak Ada / Default Anggota --</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <button
              onClick={handleRunValidation}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-2xs transition-colors"
            >
              <span>Lanjut ke Preview & Validasi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: PREVIEW & VALIDATION ================= */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Validation Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => setFilterValidation('ALL')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filterValidation === 'ALL'
                  ? 'bg-blue-50/50 border-[#1E3A8A] ring-1 ring-[#1E3A8A]'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Total Diproses</span>
              <span className="text-xl font-extrabold text-gray-900 font-mono">{countTotal}</span>
            </button>

            <button
              onClick={() => setFilterValidation('INSERT')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filterValidation === 'INSERT'
                  ? 'bg-emerald-50/50 border-emerald-600 ring-1 ring-emerald-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Data Baru (Insert)</span>
              <span className="text-xl font-extrabold text-emerald-700 font-mono">+{countInsert}</span>
            </button>

            <button
              onClick={() => setFilterValidation('UPDATE')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filterValidation === 'UPDATE'
                  ? 'bg-amber-50/50 border-amber-600 ring-1 ring-amber-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">Perbarui Data (Update)</span>
              <span className="text-xl font-extrabold text-amber-700 font-mono">↻ {countUpdate}</span>
            </button>

            <button
              onClick={() => setFilterValidation('INVALID')}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filterValidation === 'INVALID'
                  ? 'bg-rose-50/50 border-rose-600 ring-1 ring-rose-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 block">Tidak Valid / Ditolak</span>
              <span className="text-xl font-extrabold text-rose-700 font-mono">✕ {countInvalid}</span>
            </button>
          </div>

          {/* Auto-Create Division Notification Banner */}
          {newDivisionsDetected.length > 0 && (
            <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200 text-purple-950 flex items-start gap-3 shadow-2xs">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <span>Pendaftaran Bagian Otomatis ({newDivisionsDetected.length} Bagian Baru Terdeteksi)</span>
                </h4>
                <p className="text-xs text-purple-800 leading-relaxed">
                  Sistem mendeteksi nama bagian baru yang belum ada di master Data Bagian: <strong>{newDivisionsDetected.join(', ')}</strong>.
                  Sesuai kebijakan sistem, baris data anggota ini <strong>TIDAK DITOLAK / TIDAK DILEWATI</strong> dan otomatis berstatus <strong>Tambah Baru (Insert)</strong> atau <strong>Update</strong>.
                  Data Bagian baru akan otomatis didaftarkan dan kuota perwakilannya dihitung ke dalam sistem saat disimpan.
                </p>
              </div>
            </div>
          )}

          {/* Validation Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Preview Hasil Validasi ({filteredValidatedRows.length} baris ditampilkan)
                </h3>
                <p className="text-xs text-gray-500">
                  Validasi mencakup: pemeriksaan nomor anggota unik/wajib, email ganda, NIK ganda, kalkulasi usia pensiun 55 tahun, dan registrasi bagian otomatis.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Filter Tampilan:</span>
                <select
                  value={filterValidation}
                  onChange={e => setFilterValidation(e.target.value as any)}
                  className="text-xs bg-white border border-gray-300 rounded-lg p-1.5 font-bold"
                >
                  <option value="ALL">Semua Baris ({countTotal})</option>
                  <option value="INSERT">Hanya Data Baru ({countInsert})</option>
                  <option value="UPDATE">Hanya Perbarui ({countUpdate})</option>
                  <option value="INVALID">Hanya Bermasalah ({countInvalid})</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 uppercase font-bold sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-4">Baris</th>
                    <th className="py-3 px-4">Status Aksi</th>
                    <th className="py-3 px-4">No. Anggota</th>
                    <th className="py-3 px-4">Nama Lengkap</th>
                    <th className="py-3 px-4">NIK</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Bagian Terpetakan</th>
                    <th className="py-3 px-4">Tgl Lahir / Pensiun</th>
                    <th className="py-3 px-4">Hak Pilih</th>
                    <th className="py-3 px-4">Catatan Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredValidatedRows.map(row => {
                    return (
                      <tr
                        key={row.rowNumber}
                        className={`hover:bg-gray-50/80 transition-colors ${
                          row.action === 'INVALID'
                            ? 'bg-rose-50/30'
                            : row.action === 'UPDATE'
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono text-gray-500">#{row.rowNumber}</td>
                        <td className="py-2.5 px-4">
                          {row.action === 'INSERT' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase">
                              <Check className="w-3 h-3" /> Tambah Baru
                            </span>
                          )}
                          {row.action === 'UPDATE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                              <RotateCcw className="w-3 h-3" /> Update
                            </span>
                          )}
                          {row.action === 'INVALID' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase">
                              <XCircle className="w-3 h-3" /> Lewati
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-gray-900">{row.nomor_anggota || '-'}</td>
                        <td className="py-2.5 px-4 font-bold text-gray-900">{row.nama || '-'}</td>
                        <td className="py-2.5 px-4 font-mono text-gray-700">{row.nik || <span className="italic text-gray-400 font-sans">-</span>}</td>
                        <td className="py-2.5 px-4 font-mono text-gray-600">{row.email || '-'}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                row.isNewDivision
                                  ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                  : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}>
                                {row.resolvedBagianNama || row.bagian || '-'}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500 font-semibold">
                                {row.resolvedBagianId}
                              </span>
                            </div>
                            {row.isNewDivision && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-purple-100 text-purple-700 font-mono">
                                <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                                Bagian Baru (Auto-Create)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="space-y-1">
                            {row.tanggal_lahir ? (
                              <div className="text-[11px] text-gray-800 flex items-center gap-1.5 flex-wrap">
                                <span className="text-gray-400 text-[10px]">Lahir:</span>
                                <span className="font-mono font-bold text-blue-950 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                  {row.tanggal_lahir_formatted || formatIndonesianDate(row.tanggal_lahir)}
                                </span>
                                {row.usia !== null && row.usia !== undefined && (
                                  <span className="text-gray-500 font-sans text-[10px] font-semibold">({row.usia} thn)</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-gray-400 italic">Tgl Lahir: -</div>
                            )}

                            {row.tanggal_pensiun && (
                              <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                <span>Pensiun:</span>
                                <span className="font-mono font-medium text-gray-700">
                                  {row.tanggal_pensiun_formatted || formatIndonesianDate(row.tanggal_pensiun)}
                                </span>
                                {row.sisa_pensiun_text ? (
                                  <span className="text-gray-500 font-semibold">({row.sisa_pensiun_text})</span>
                                ) : row.sisa_pensiun_tahun !== undefined && row.sisa_pensiun_tahun !== null ? (
                                  <span className="text-gray-400">({row.sisa_pensiun_tahun} thn)</span>
                                ) : null}
                              </div>
                            )}

                            {row.is_pensiun_warning && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                HAK DIPILIH: NONAKTIF (Hanya Pemilih)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 font-mono">
                          {row.hak_pilih ? (
                            <span className="text-emerald-700 font-bold">AKTIF</span>
                          ) : (
                            <span className="text-rose-700 font-bold">TIDAK</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          {row.errors.length > 0 && (
                            <div className="text-rose-600 font-medium space-y-0.5">
                              {row.errors.map((e, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <XCircle className="w-3 h-3 shrink-0" />
                                  <span>{e}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.warnings.length > 0 && row.errors.length === 0 && (
                            <div className="space-y-0.5">
                              {row.warnings.map((w, idx) => (
                                <div
                                  key={idx}
                                  className={`flex items-center gap-1 text-[11px] ${
                                    w.includes('didaftarkan otomatis') || w.includes('Bagian baru')
                                      ? 'text-purple-700 font-medium'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {w.includes('didaftarkan otomatis') || w.includes('Bagian baru') ? (
                                    <Sparkles className="w-3 h-3 shrink-0 text-purple-600" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                  )}
                                  <span>{w}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Siap disimpan
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

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ubah Pemetaan Kolom</span>
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              disabled={countInsert + countUpdate === 0}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Lanjut ke Konfirmasi ({countInsert + countUpdate} Data Siap)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: KONFIRMASI ================= */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-2xs space-y-6 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center mx-auto mb-3 border border-blue-200">
              <ShieldCheck className="w-6 h-6 text-blue-700" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-900">
              Konfirmasi Sinkronisasi Master Anggota
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Periksa ringkasan perubahan data sebelum commit ke database sistem pemilihan.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
              <span className="text-gray-600">Total Baris File:</span>
              <span className="font-bold text-gray-900 font-mono">{countTotal} baris</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
              <span className="text-emerald-700 font-medium">Anggota Baru Ditambahkan:</span>
              <span className="font-bold text-emerald-800 font-mono">+{countInsert} anggota</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-gray-200">
              <span className="text-amber-700 font-medium">Anggota Diperbarui (Update):</span>
              <span className="font-bold text-amber-800 font-mono">↻ {countUpdate} anggota</span>
            </div>
            <div className="flex items-center justify-between text-xs py-1">
              <span className="text-rose-700 font-medium">Baris Dilewati (Error/Invalid):</span>
              <span className="font-bold text-rose-800 font-mono">✕ {countInvalid} baris</span>
            </div>
          </div>

          {newDivisionsDetected.length > 0 && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Pendaftaran Bagian Baru Otomatis ({newDivisionsDetected.length}):</strong>
                <p className="mt-0.5 text-purple-800 leading-relaxed">
                  Sebanyak <strong>{newDivisionsDetected.length} Bagian Baru</strong> ({newDivisionsDetected.join(', ')}) akan otomatis didaftarkan ke master Data Bagian dan kuota perwakilannya dihitung berdasarkan data anggota saat proses simpan.
                </p>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Catatan Keamanan & Integritas:</strong>
            <p className="mt-1">
              Data yang memiliki NIK atau Email yang sudah terdaftar akan diperbarui informasi bagian dan hak pilihnya.
              Status anggota yang sudah melakukan pemilihan (suara sah) tidak akan dihapus atau direset oleh proses import ini.
            </p>
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmedByUser}
              onChange={e => setConfirmedByUser(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700 leading-tight">
              Saya telah memeriksa preview validasi dan menyetujui penyimpanan <strong>{countInsert + countUpdate} data anggota</strong> ke database.
            </span>
          </label>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>

            <button
              onClick={handleExecuteSave}
              disabled={!confirmedByUser || saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Simpan ke Database Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 5: SELESAI ================= */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-2xs text-center space-y-6 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-gray-900">
              Import & Sinkronisasi Berhasil!
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Data master anggota berhasil diperbarui ke database utama dan dicatat dalam Jejak Audit.
            </p>
          </div>

          {saveResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200 text-left text-xs font-mono">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Ditambahkan:</span>
                  <span className="text-lg font-bold text-emerald-700">+{saveResult.added} Anggota</span>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Diperbarui:</span>
                  <span className="text-lg font-bold text-amber-700">↻ {saveResult.updated} Anggota</span>
                </div>
              </div>

              {saveResult.newDivisionsCreated && saveResult.newDivisionsCreated.length > 0 && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-left text-xs text-purple-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Bagian Baru Didaftarkan Otomatis ({saveResult.newDivisionsCreated.length}):</span>
                  </div>
                  <p className="text-purple-800 font-mono text-[11px] leading-relaxed">
                    {saveResult.newDivisionsCreated.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setFileName('');
                setRawRows([]);
                setValidatedRows([]);
                setConfirmedByUser(false);
                setSaveResult(null);
                setCurrentStep(1);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-300 hover:bg-gray-50 text-xs font-bold uppercase tracking-wider text-gray-700"
            >
              Import File Lainnya
            </button>

            {onNavigateToMembers && (
              <button
                onClick={onNavigateToMembers}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold uppercase tracking-wider shadow-2xs"
              >
                Lihat Master Data Anggota
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

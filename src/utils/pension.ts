// Utility for calculating retirement (pensiun) based on Tanggal Lahir (55 years retirement age)

export interface PengurusBPKCheckResult {
  isPengurusBPK: boolean;
  roleType: 'PENGURUS' | 'BPK' | null;
  label: string;
}

export function checkPegawai(jabatan?: string | null): boolean {
  if (!jabatan) return false;
  const upper = String(jabatan).trim().toUpperCase();
  return (
    upper === 'PEGAWAI' ||
    upper === 'KARYAWAN' ||
    upper.includes('PEGAWAI') ||
    upper.includes('KARYAWAN') ||
    upper.includes('STAF') ||
    upper.includes('STAFF')
  );
}

/**
 * Validasi Kualifikasi Aturan AD/ART KOPSYAH YKK AP Indonesia:
 * - Seluruh anggota yang menjabat sebagai Pengurus, BPK (Badan Pengawas Koperasi), maupun Pegawai/Karyawan
 *   HANYA memiliki Hak Memilih (Hak Pilih).
 * - Pengurus, BPK, dan Pegawai/Karyawan TIDAK MEMILIKI Hak Dipilih / Hak Perwakilan (Otomatis Tidak Layak Dicalonkan).
 */
export function checkPengurusOrBPK(jabatan?: string | null): PengurusBPKCheckResult {
  if (!jabatan) return { isPengurusBPK: false, roleType: null, label: '' };
  const upper = String(jabatan).trim().toUpperCase();

  // BPK: Badan Pengawas Koperasi / Pengawas / BPK
  if (
    upper === 'BPK' ||
    upper.includes('BPK') ||
    upper.includes('PENGAWAS') ||
    upper.includes('BADAN PENGAWAS')
  ) {
    return {
      isPengurusBPK: true,
      roleType: 'BPK',
      label: 'BPK (Badan Pengawas Koperasi)'
    };
  }

  // Pengurus Koperasi
  if (
    upper === 'PENGURUS' ||
    upper.includes('PENGURUS')
  ) {
    return {
      isPengurusBPK: true,
      roleType: 'PENGURUS',
      label: 'Pengurus Koperasi'
    };
  }

  return { isPengurusBPK: false, roleType: null, label: '' };
}

export interface PensionCalculationResult {
  tanggal_lahir?: string | null;
  tanggal_pensiun?: string | null;
  tanggal_lahir_formatted?: string;
  tanggal_pensiun_formatted?: string;
  usia?: number | null;
  sisa_pensiun_tahun: number | null;
  sisa_pensiun_text?: string;
  is_warning: boolean; // true if sisa_pensiun < 4 tahun
  warning_message?: string;
  status_label: string;
  // Aturan Jabatan Pengurus, BPK & Pegawai
  is_pengurus_bpk: boolean;
  is_pegawai?: boolean;
  role_type?: 'PENGURUS' | 'BPK' | null;
  jabatan_label?: string;
  // Hak Memilih & Hak Dipilih rules
  hak_memilih_tetap_aktif: boolean; // false jika Pegawai/Karyawan
  hak_dipilih_layak: boolean; // false jika sisa masa pensiun < 4 tahun (usia 51+), menjabat Pengurus/BPK, atau Pegawai
  alasan_hak_dipilih: string;
}

export const RETIREMENT_AGE = 55;
export const WARNING_PENSION_THRESHOLD_YEARS = 4;

/**
 * Calculates exact remaining time to pension date (55 years old) from refDate.
 */
export function getExactPensionDiff(refDate: Date, pensionDate: Date) {
  if (pensionDate.getTime() <= refDate.getTime()) {
    return {
      years: 0,
      months: 0,
      days: 0,
      isLessThan4Years: true,
      text: 'Pensiun',
      numericYears: 0
    };
  }

  // Y, M, D difference calculation
  let y = pensionDate.getFullYear() - refDate.getFullYear();
  let m = pensionDate.getMonth() - refDate.getMonth();
  let d = pensionDate.getDate() - refDate.getDate();

  if (d < 0) {
    m -= 1;
    const prevMonthLastDay = new Date(pensionDate.getFullYear(), pensionDate.getMonth(), 0).getDate();
    d += prevMonthLastDay;
  }

  if (m < 0) {
    y -= 1;
    m += 12;
  }

  // Strictly check 4 full years (>= 48 months) from reference date
  const fourYearsRef = new Date(refDate);
  fourYearsRef.setFullYear(fourYearsRef.getFullYear() + WARNING_PENSION_THRESHOLD_YEARS);
  const totalMonths = y * 12 + m;
  const isLessThan4Years = pensionDate.getTime() < fourYearsRef.getTime() || totalMonths < (WARNING_PENSION_THRESHOLD_YEARS * 12);

  const diffMs = pensionDate.getTime() - refDate.getTime();
  const rawDiffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

  let numericYears = Math.floor(rawDiffYears * 10) / 10;
  if (isLessThan4Years && numericYears >= 4.0) {
    numericYears = 3.9; // Prevent rounding up to 4.0 when time is strictly < 4 full years
  }

  let text = '';
  if (y === 0 && m === 0) {
    text = '< 1 bln lagi';
  } else if (y === 0) {
    text = `${m} bln lagi`;
  } else if (m === 0) {
    text = `${y} thn lagi`;
  } else {
    text = `${y} thn ${m} bln lagi`;
  }

  return {
    years: y,
    months: m,
    days: d,
    isLessThan4Years,
    text,
    numericYears
  };
}

/**
 * Parses various date formats into standardized ISO "YYYY-MM-DD" string.
 * Prioritizes Indonesian date formats:
 * - DD-MM-YYYY (e.g. 20-08-1973)
 * - DD/MM/YYYY (e.g. 01/12/1988)
 * - DD.MM.YYYY (e.g. 20.08.1973)
 * - D-M-YYYY or D/M/YYYY
 * - Excel date serial numbers (e.g. 26896 for 20-08-1973)
 * - Standard JavaScript Date objects
 * - Standard ISO YYYY-MM-DD / YYYY/MM/DD
 */
export function parseIndonesianDate(input: any): string | null {
  if (input === null || input === undefined) return null;

  // If input is a Date object
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const d = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // If input is an Excel serial number (e.g. 26896 for 1973-08-20, or numbers >= 1)
  if (typeof input === 'number' && !isNaN(input)) {
    if (input > 0 && input < 100000) {
      // Excel epoch starts at Dec 30, 1899 due to 1900 leap year bug
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + input * 86400000);
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }
  }

  const str = String(input).trim();
  if (!str) return null;

  // 1. Check Indonesian DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  // E.g. "20-08-1973", "01/12/1988", "5-8-1980", "20.08.1973"
  const dmyMatch = str.match(/^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      return `${year}-${formattedMonth}-${formattedDay}`;
    }
  }

  // 2. Check ISO YYYY-MM-DD or YYYY/MM/DD
  // E.g. "1973-08-20", "1988/12/01"
  const ymdMatch = str.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);

    if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      return `${year}-${formattedMonth}-${formattedDay}`;
    }
  }

  // 3. Fallback: standard Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Formats an ISO string (YYYY-MM-DD), Date object, or Indonesian date string into display DD-MM-YYYY.
 * E.g. "1973-08-20" -> "20-08-1973"
 */
export function formatIndonesianDate(input?: any, fallback = '-'): string {
  if (!input) return fallback;
  const iso = parseIndonesianDate(input);
  if (!iso) return String(input) || fallback;
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return iso;
}

/**
 * Calculates member pension details & qualification status.
 * - Usia pensiun: 55 tahun
 * - Peringatan khusus pensiun: Sisa masa pensiun < 4 tahun (usia 51 tahun ke atas)
 * - Aturan Pengurus & BPK: Seluruh anggota yang menjabat sebagai Pengurus maupun BPK
 *   HANYA memiliki Hak Memilih (Hak Pilih). Pengurus dan BPK TIDAK MEMILIKI Hak Dipilih (Hanya Pemilih),
 *   tanpa memandang sisa masa pensiunnya.
 * - Hak Memilih: Tetap ADA / AKTIF untuk seluruh anggota aktif (termasuk Pengurus & BPK)
 * - Hak Dipilih: TIDAK ADA / NONAKTIF jika sisa masa pensiun < 4 tahun ATAU menjabat Pengurus / BPK
 * - Reference date: tanggal periode pemilihan saat ini (atau hari ini)
 */
export function calculateMemberPension(
  tanggal_lahir?: string | Date | null,
  manual_tanggal_pensiun?: string | Date | null,
  referenceDateInput?: string | Date,
  jabatan?: string | null
): PensionCalculationResult {
  const refDate = referenceDateInput ? new Date(referenceDateInput) : new Date();
  const validRefDate = isNaN(refDate.getTime()) ? new Date() : refDate;
  const pengurusBPK = checkPengurusOrBPK(jabatan);
  const isPegawai = checkPegawai(jabatan);
  const isSpecialRole = pengurusBPK.isPengurusBPK || isPegawai;

  // 1. Tanggal Lahir is provided
  const parsedDob = parseIndonesianDate(tanggal_lahir);
  if (parsedDob) {
    const dob = new Date(`${parsedDob}T00:00:00`);
    if (!isNaN(dob.getTime())) {
      // Pension Date = Born Date + 55 years
      const pYear = dob.getFullYear() + RETIREMENT_AGE;
      const pMonth = String(dob.getMonth() + 1).padStart(2, '0');
      const pDay = String(dob.getDate()).padStart(2, '0');
      const computedTanggalPensiun = `${pYear}-${pMonth}-${pDay}`;

      const pensionDate = new Date(`${computedTanggalPensiun}T00:00:00`);
      const diff = getExactPensionDiff(validRefDate, pensionDate);

      // Age calculation
      let age = validRefDate.getFullYear() - dob.getFullYear();
      const monthDiff = validRefDate.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && validRefDate.getDate() < dob.getDate())) {
        age--;
      }

      const isWarning = diff.isLessThan4Years;
      let status_label = 'Aman (≥ 4 Tahun)';
      if (isPegawai) {
        status_label = 'Pegawai / Karyawan (Hanya Pemilih)';
      } else if (pengurusBPK.isPengurusBPK) {
        status_label = `${pengurusBPK.label} (Hanya Pemilih)`;
      } else if (diff.numericYears <= 0) {
        status_label = 'Telah Memasuki Usia Pensiun';
      } else if (isWarning) {
        status_label = `Sisa Pensiun < 4 Tahun (${diff.text})`;
      }

      // Hak Dipilih: NONAKTIF jika Pengurus/BPK/Pegawai ATAU sisa pensiun < 4 tahun
      const hakDipilih = !isSpecialRole && !isWarning && diff.numericYears > 0;
      let alasanHakDipilih = '';
      if (isPegawai) {
        alasanHakDipilih = 'Terdaftar sebagai Pegawai/Karyawan KOPSYAH YKK. Berdasarkan aturan kualifikasi AD/ART, Pegawai/Karyawan hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).';
      } else if (pengurusBPK.isPengurusBPK) {
        alasanHakDipilih = `Menjabat sebagai ${pengurusBPK.label}. Berdasarkan aturan kualifikasi AD/ART, Pengurus dan BPK hanya memiliki Hak Memilih (Hak Pilih) dan tidak berhak dicalonkan sebagai Perwakilan Anggota (Hanya Pemilih).`;
      } else if (!hakDipilih) {
        alasanHakDipilih = `Tidak memenuhi syarat dicalonkan karena sisa masa pensiun ${diff.text} (< 4 tahun menuju pensiun usia 55). Anggota berstatus Hanya Pemilih.`;
      } else {
        alasanHakDipilih = 'Memenuhi syarat dicalonkan sebagai calon perwakilan (sisa masa pensiun ≥ 4 tahun).';
      }

      let warningMessage = undefined;
      if (isPegawai) {
        warningMessage = 'Terdaftar sebagai Pegawai/Karyawan. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).';
      } else if (pengurusBPK.isPengurusBPK) {
        warningMessage = `Menjabat sebagai ${pengurusBPK.label}. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).`;
      } else if (isWarning) {
        warningMessage = `Sisa masa pensiun ${diff.text} (kurang dari 4 tahun menuju pensiun usia 55). Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).`;
      }

      return {
        tanggal_lahir: parsedDob,
        tanggal_pensiun: computedTanggalPensiun,
        tanggal_lahir_formatted: formatIndonesianDate(parsedDob),
        tanggal_pensiun_formatted: formatIndonesianDate(computedTanggalPensiun),
        usia: age >= 0 ? age : null,
        sisa_pensiun_tahun: diff.numericYears,
        sisa_pensiun_text: diff.text,
        is_warning: isWarning,
        status_label,
        warning_message: warningMessage,
        is_pengurus_bpk: pengurusBPK.isPengurusBPK,
        is_pegawai: isPegawai,
        role_type: pengurusBPK.roleType,
        jabatan_label: isPegawai ? 'Pegawai / Karyawan' : (pengurusBPK.label || undefined),
        hak_memilih_tetap_aktif: true, // Hak Memilih tetap AKTIF
        hak_dipilih_layak: hakDipilih, // Hak Dipilih NONAKTIF jika Pengurus/BPK/Pegawai
        alasan_hak_dipilih: alasanHakDipilih
      };
    }
  }

  // 2. Tanggal Lahir not provided, fallback to manual tanggal_pensiun
  const parsedPension = parseIndonesianDate(manual_tanggal_pensiun);
  if (parsedPension) {
    const pensionDate = new Date(`${parsedPension}T00:00:00`);
    if (!isNaN(pensionDate.getTime())) {
      const diff = getExactPensionDiff(validRefDate, pensionDate);
      const isWarning = diff.isLessThan4Years;

      let status_label = 'Aman (≥ 4 Tahun)';
      if (isPegawai) {
        status_label = 'Pegawai / Karyawan (Hanya Pemilih)';
      } else if (pengurusBPK.isPengurusBPK) {
        status_label = `${pengurusBPK.label} (Hanya Pemilih)`;
      } else if (diff.numericYears <= 0) {
        status_label = 'Telah Memasuki Usia Pensiun';
      } else if (isWarning) {
        status_label = `Sisa Pensiun < 4 Tahun (${diff.text})`;
      }

      const hakDipilih = !isSpecialRole && !isWarning && diff.numericYears > 0;
      let alasanHakDipilih = '';
      if (isPegawai) {
        alasanHakDipilih = 'Terdaftar sebagai Pegawai/Karyawan KOPSYAH YKK. Berdasarkan aturan kualifikasi AD/ART, Pegawai/Karyawan hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).';
      } else if (pengurusBPK.isPengurusBPK) {
        alasanHakDipilih = `Menjabat sebagai ${pengurusBPK.label}. Berdasarkan aturan kualifikasi AD/ART, Pengurus dan BPK hanya memiliki Hak Memilih (Hak Pilih) dan tidak berhak dicalonkan sebagai Perwakilan Anggota (Hanya Pemilih).`;
      } else if (!hakDipilih) {
        alasanHakDipilih = `Tidak memenuhi syarat dicalonkan karena sisa masa pensiun ${diff.text} (< 4 tahun). Anggota berstatus Hanya Pemilih.`;
      } else {
        alasanHakDipilih = 'Memenuhi syarat dicalonkan sebagai calon perwakilan (sisa masa pensiun ≥ 4 tahun).';
      }

      let warningMessage = undefined;
      if (isPegawai) {
        warningMessage = 'Terdaftar sebagai Pegawai/Karyawan. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).';
      } else if (pengurusBPK.isPengurusBPK) {
        warningMessage = `Menjabat sebagai ${pengurusBPK.label}. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).`;
      } else if (isWarning) {
        warningMessage = `Sisa masa pensiun ${diff.text} (kurang dari batas 4 tahun). Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).`;
      }

      return {
        tanggal_lahir: null,
        tanggal_pensiun: parsedPension,
        tanggal_lahir_formatted: '-',
        tanggal_pensiun_formatted: formatIndonesianDate(parsedPension),
        usia: null,
        sisa_pensiun_tahun: diff.numericYears,
        sisa_pensiun_text: diff.text,
        is_warning: isWarning,
        status_label,
        warning_message: warningMessage,
        is_pengurus_bpk: pengurusBPK.isPengurusBPK,
        is_pegawai: isPegawai,
        role_type: pengurusBPK.roleType,
        jabatan_label: isPegawai ? 'Pegawai / Karyawan' : (pengurusBPK.label || undefined),
        hak_memilih_tetap_aktif: true,
        hak_dipilih_layak: hakDipilih,
        alasan_hak_dipilih: alasanHakDipilih
      };
    }
  }

  // 3. Neither provided
  const hakDipilih = !isSpecialRole;
  let alasanHakDipilih = 'Tanggal lahir belum ditentukan (default memenuhi syarat dicalonkan).';
  let warningMessage = undefined;
  let status_label = 'Tidak Ditentukan';

  if (isPegawai) {
    status_label = 'Pegawai / Karyawan (Hanya Pemilih)';
    alasanHakDipilih = 'Terdaftar sebagai Pegawai/Karyawan KOPSYAH YKK. Berdasarkan aturan kualifikasi AD/ART, Pegawai/Karyawan hanya memiliki Hak Memilih (Hak Pilih) dan tidak memiliki Hak Dipilih sebagai Perwakilan Anggota (Hanya Pemilih).';
    warningMessage = 'Terdaftar sebagai Pegawai/Karyawan. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).';
  } else if (pengurusBPK.isPengurusBPK) {
    status_label = `${pengurusBPK.label} (Hanya Pemilih)`;
    alasanHakDipilih = `Menjabat sebagai ${pengurusBPK.label}. Berdasarkan aturan kualifikasi AD/ART, Pengurus dan BPK hanya memiliki Hak Memilih (Hak Pilih) dan tidak berhak dicalonkan sebagai Perwakilan Anggota (Hanya Pemilih).`;
    warningMessage = `Menjabat sebagai ${pengurusBPK.label}. Hak Memilih: AKTIF, Hak Dipilih: NONAKTIF (Hanya Pemilih).`;
  }

  return {
    tanggal_lahir: null,
    tanggal_pensiun: null,
    tanggal_lahir_formatted: '-',
    tanggal_pensiun_formatted: '-',
    usia: null,
    sisa_pensiun_tahun: null,
    sisa_pensiun_text: '-',
    is_warning: false,
    status_label,
    warning_message: warningMessage,
    is_pengurus_bpk: pengurusBPK.isPengurusBPK,
    is_pegawai: isPegawai,
    role_type: pengurusBPK.roleType,
    jabatan_label: isPegawai ? 'Pegawai / Karyawan' : (pengurusBPK.label || undefined),
    hak_memilih_tetap_aktif: true,
    hak_dipilih_layak: hakDipilih,
    alasan_hak_dipilih: alasanHakDipilih
  };
}

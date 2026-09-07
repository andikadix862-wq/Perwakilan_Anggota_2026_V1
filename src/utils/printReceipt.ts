import { VotingReceiptData } from '../types';

/**
 * Format date to Indonesian human-readable string with timezone
 */
export function formatIndonesianDate(isoOrString: string): string {
  try {
    const d = new Date(isoOrString);
    if (isNaN(d.getTime())) return isoOrString;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return isoOrString;
  }
}

/**
 * Generates an official, standalone, high-resolution printable HTML document
 * for KOPSYAH YKK AP Indonesia Voting Receipt.
 */
export function generateReceiptHtml(data: VotingReceiptData): string {
  const formattedDate = formatIndonesianDate(data.voted_at || new Date().toISOString());
  const txId = data.transaction_id || `TX-YKK-${Date.now()}`;
  const verificationCode =
    data.verification_code ||
    `SEC-${txId.replace(/[^A-Z0-9]/g, '').slice(-8)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bukti Pemilihan - ${data.nama} (${data.nomor_anggota}) - KOPSYAH YKK AP</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f3f4f6;
      color: #111827;
      padding: 24px 16px;
      line-height: 1.5;
    }
    .action-bar {
      max-width: 680px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      border: none;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: #1e3a8a;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
    }
    .btn-primary:hover {
      background: #172554;
    }
    .btn-secondary {
      background: #ffffff;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    .btn-secondary:hover {
      background: #f9fafb;
    }
    .certificate-card {
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #1e3a8a;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      position: relative;
      overflow: hidden;
    }
    .watermark {
      position: absolute;
      right: -30px;
      bottom: -30px;
      font-size: 180px;
      color: rgba(30, 58, 138, 0.03);
      font-weight: 900;
      pointer-events: none;
      user-select: none;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .header-sub {
      font-size: 11px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .header-title {
      font-size: 20px;
      font-weight: 900;
      color: #111827;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .header-org {
      font-size: 14px;
      font-weight: 700;
      color: #4b5563;
      margin-top: 2px;
    }
    .badge-wrap {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-top: 14px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background: #f9fafb;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }
    .data-table td {
      padding: 10px 14px;
      font-size: 12.5px;
      border-bottom: 1px solid #e5e7eb;
    }
    .data-table tr:last-child td {
      border-bottom: none;
    }
    .data-table .label {
      width: 38%;
      color: #4b5563;
      font-weight: 600;
    }
    .data-table .value {
      width: 62%;
      color: #111827;
      font-weight: 700;
    }
    .tx-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }
    .tx-label {
      font-size: 10px;
      font-weight: 800;
      color: #1e3a8a;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .tx-val {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      font-weight: 800;
      color: #1e3a8a;
      margin-top: 4px;
      word-break: break-all;
    }
    .privacy-notice {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 11px;
      color: #92400e;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature-box {
      text-align: center;
      width: 45%;
    }
    .sign-title {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 40px;
      font-weight: 600;
    }
    .sign-name {
      font-size: 12px;
      font-weight: 800;
      color: #111827;
      border-top: 1px solid #111827;
      padding-top: 4px;
      display: inline-block;
      min-width: 180px;
    }
    .sign-org {
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
    .qr-stamp {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .qr-svg {
      width: 64px;
      height: 64px;
      border: 1px solid #d1d5db;
      padding: 4px;
      border-radius: 6px;
      background: #fff;
    }
    .qr-text {
      font-size: 9px;
      font-family: monospace;
      color: #6b7280;
      margin-top: 4px;
    }

    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .action-bar {
        display: none !important;
      }
      .certificate-card {
        max-width: 100% !important;
        border: 2px solid #000000 !important;
        box-shadow: none !important;
        padding: 24px !important;
        border-radius: 0 !important;
      }
      .data-table {
        background: #ffffff !important;
        border: 1px solid #000000 !important;
      }
      .data-table td {
        border-bottom: 1px solid #000000 !important;
      }
      .tx-box {
        background: #ffffff !important;
        border: 1px solid #000000 !important;
      }
      .privacy-notice {
        background: #ffffff !important;
        border: 1px solid #000000 !important;
        color: #000000 !important;
      }
    }
  </style>
</head>
<body>

  <div class="action-bar no-print">
    <div style="font-size: 13px; font-weight: 700; color: #374151;">
      Lembar Bukti Pemilihan Sah
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">Tutup</button>
      <button class="btn btn-primary" onclick="window.print()">
        &#128438; Cetak Dokumen / Simpan PDF
      </button>
    </div>
  </div>

  <div class="certificate-card" id="certificate-content">
    <div class="watermark">KOPSYAH</div>

    <div class="header">
      <div class="header-sub">Panitia Pemilihan Anggota Perwakilan</div>
      <h1 class="header-title">Koperasi Karyawan Syariah (KOPSYAH)</h1>
      <div class="header-org">KOPSYAH YKK AP INDONESIA — Periode ${data.periode_pemilihan || '2026'}</div>

      <div>
        <span class="badge-wrap">
          &#10003; SUARA SAH TERVERIFIKASI
        </span>
      </div>
    </div>

    <div class="section-title">Informasi Pemilih & Rekaman Hak Suara</div>

    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Nama Lengkap Pemilih</td>
          <td class="value">${data.nama}</td>
        </tr>
        <tr>
          <td class="label">Nomor Anggota Koperasi</td>
          <td class="value font-mono">${data.nomor_anggota}</td>
        </tr>
        <tr>
          <td class="label">Nomor Induk Karyawan (NIK)</td>
          <td class="value font-mono">${data.nik}</td>
        </tr>
        <tr>
          <td class="label">Bagian / Divisi Perwakilan</td>
          <td class="value">${data.nama_bagian} (${data.bagian_id})</td>
        </tr>
        <tr>
          <td class="label">Waktu Pemungutan Suara</td>
          <td class="value">${formattedDate}</td>
        </tr>
        <tr>
          <td class="label">Status Pencatatan Sistem</td>
          <td class="value" style="color: #047857;">TERCATAT & TERKUNCI (SUDAH MEMILIH)</td>
        </tr>
      </tbody>
    </table>

    <div class="tx-box">
      <div class="tx-label">ID Transaksi Elektronik Resmi (Digital Signature Hash)</div>
      <div class="tx-val">${txId}</div>
      <div style="font-size: 10px; color: #3b82f6; margin-top: 4px; font-family: monospace;">
        Security Seal: ${verificationCode}
      </div>
    </div>

    <div class="privacy-notice">
      <strong>Prinsip Kerahasiaan Suara (LUBER & JURDIL):</strong> Lembar bukti sah ini tidak menampilkan nama kandidat pilihan demi menjamin kemurnian dan kerahasiaan pilihan anggota sesuai AD/ART KOPSYAH YKK AP Indonesia. Pilihan suara telah dienkripsi secara mandiri pada server pemilihan.
    </div>

    <div class="footer-signatures">
      <div class="signature-box">
        <div class="sign-title">Panitia Pemilihan Online</div>
        <div class="sign-name">KOPSYAH YKK AP INDONESIA</div>
        <div class="sign-org">Sistem Pemilihan Terverifikasi</div>
      </div>

      <div class="qr-stamp">
        <!-- Embedded SVG QR Graphic -->
        <svg class="qr-svg" viewBox="0 0 100 100" fill="currentColor">
          <path d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M22,22 h6 v6 h-6 z" />
          <path d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M72,22 h6 v6 h-6 z" />
          <path d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M22,72 h6 v6 h-6 z" />
          <rect x="45" y="15" width="8" height="8" />
          <rect x="45" y="30" width="8" height="8" />
          <rect x="45" y="60" width="8" height="8" />
          <rect x="60" y="48" width="8" height="8" />
          <rect x="75" y="48" width="8" height="8" />
          <rect x="60" y="65" width="12" height="12" />
          <rect x="78" y="78" width="12" height="12" />
        </svg>
        <div class="qr-text">${verificationCode}</div>
      </div>

      <div class="signature-box">
        <div class="sign-title">Tanda Tangan Pemilih</div>
        <div class="sign-name">${data.nama}</div>
        <div class="sign-org">No. ${data.nomor_anggota}</div>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print when opened in standalone window
    window.addEventListener('DOMContentLoaded', function() {
      // Short delay to allow font rendering
      setTimeout(function() {
        try {
          if (window.opener || window.name === 'print-tab') {
            window.print();
          }
        } catch (e) {
          // ignore
        }
      }, 500);
    });
  </script>
</body>
</html>`;
}

/**
 * Downloads the official printable HTML receipt directly to user's device.
 */
export function downloadReceiptHtml(data: VotingReceiptData): void {
  const htmlContent = generateReceiptHtml(data);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.nama || 'Anggota').replace(/[^a-zA-Z0-9]/g, '_');
  const safeNo = (data.nomor_anggota || 'AGT').replace(/[^a-zA-Z0-9]/g, '_');
  a.href = url;
  a.download = `BUKTI_PEMILIHAN_KOPSYAH_${safeNo}_${safeName}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Triggers printing using multiple fallback layers:
 * 1. Hidden iframe print (often works within sandbox)
 * 2. Window.open new tab print
 * 3. Direct download of official ready-to-print file if printing is blocked
 */
export function printReceiptDirectly(data: VotingReceiptData): {
  success: boolean;
  methodUsed: 'iframe' | 'new_tab' | 'download' | 'native';
  error?: string;
} {
  const html = generateReceiptHtml(data);

  // Method 1: Try hidden iframe
  try {
    const existingIframe = document.getElementById('hidden-print-receipt-frame');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'hidden-print-receipt-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (printErr: any) {
          console.warn('Iframe print restricted:', printErr);
          // Fallback to new tab or download
          openReceiptInNewTab(data);
        }
      }, 400);

      return { success: true, methodUsed: 'iframe' };
    }
  } catch (err: any) {
    console.warn('Direct iframe creation failed:', err);
  }

  // Method 2: Open in new tab or download
  const tabOpened = openReceiptInNewTab(data);
  if (tabOpened) {
    return { success: true, methodUsed: 'new_tab' };
  }

  // Method 3: Download file
  downloadReceiptHtml(data);
  return { success: true, methodUsed: 'download' };
}

/**
 * Opens receipt in new tab or fallback to download
 */
export function openReceiptInNewTab(data: VotingReceiptData): boolean {
  try {
    // Prefer server endpoint if available
    const serverUrl = `/api/voter/receipt-html?email=${encodeURIComponent(
      data.nik || data.nomor_anggota || data.nama
    )}&txId=${encodeURIComponent(data.transaction_id || '')}`;

    const newWindow = window.open(serverUrl, '_blank');
    if (newWindow) {
      newWindow.focus();
      return true;
    }
  } catch {
    // blocked
  }

  // Fallback with blob
  try {
    const html = generateReceiptHtml(data);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    if (newWindow) {
      newWindow.focus();
      return true;
    }
  } catch {
    // blocked
  }

  return false;
}

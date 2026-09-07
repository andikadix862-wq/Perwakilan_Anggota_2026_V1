// Script to generate the complete, standalone presentation.html
const fs = require('fs');
const path = require('path');

const cssStyles = `
  :root {
    --primary: #1E3A8A;
    --primary-dark: #0F172A;
    --primary-light: #3B82F6;
    --accent: #0284C7;
    --success: #059669;
    --warning: #D97706;
    --danger: #DC2626;
    --bg-dark: #0B1329;
    --bg-card: #152243;
    --border-color: #233566;
    --text-main: #F8FAFC;
    --text-muted: #94A3B8;
    --slide-ratio: 16 / 9;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--bg-dark);
    color: var(--text-main);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    user-select: none;
  }

  /* Presentation Top Bar */
  .pres-header {
    height: 48px;
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 50;
    backdrop-filter: blur(8px);
  }

  .pres-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .pres-badge {
    background: #1E3A8A;
    color: #93C5FD;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 6px;
    letter-spacing: 1px;
    border: 1px solid rgba(147, 197, 253, 0.3);
  }

  .pres-title-header {
    font-size: 13px;
    font-weight: 700;
    color: #E2E8F0;
    letter-spacing: 0.5px;
  }

  .pres-controls-quick {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-quick {
    background: rgba(30, 58, 138, 0.4);
    border: 1px solid var(--border-color);
    color: #CBD5E1;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .btn-quick:hover {
    background: #1E3A8A;
    color: #FFF;
    border-color: #3B82F6;
  }

  /* Progress Bar */
  .progress-container {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.08);
    position: relative;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #3B82F6, #10B981);
    width: 5%;
    transition: width 0.3s ease;
  }

  /* Main Slide Stage */
  .stage-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 24px;
    position: relative;
    overflow: hidden;
  }

  .slide-viewport {
    width: 100%;
    max-width: 1280px;
    height: 100%;
    max-height: 720px;
    aspect-ratio: var(--slide-ratio);
    position: relative;
    perspective: 1000px;
  }

  .slide {
    position: absolute;
    inset: 0;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 36px 44px;
    display: none;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
    opacity: 0;
    transform: scale(0.98) translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    overflow-y: auto;
  }

  .slide.active {
    display: flex;
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  /* Slide Typography & Layout */
  .slide-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: #60A5FA;
    margin-bottom: 8px;
  }

  .slide-title {
    font-size: 28px;
    font-weight: 900;
    color: #FFFFFF;
    letter-spacing: -0.5px;
    line-height: 1.25;
    margin-bottom: 8px;
  }

  .slide-subtitle {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 24px;
    max-width: 900px;
    line-height: 1.5;
  }

  .slide-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Navigation Footer */
  .pres-footer {
    height: 54px;
    background: rgba(15, 23, 42, 0.95);
    border-top: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 50;
  }

  .footer-meta {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .footer-counter {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 700;
    font-size: 13px;
    color: #60A5FA;
    background: rgba(30, 58, 138, 0.3);
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .footer-nav {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-nav {
    background: #1E3A8A;
    color: #FFF;
    border: 1px solid #3B82F6;
    padding: 7px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .btn-nav:hover:not(:disabled) {
    background: #2563EB;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
  }

  .btn-nav:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    border-color: #334155;
    background: #1E293B;
  }

  /* Components & Cards */
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 14px;
  }

  .card-box {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: 12px;
    padding: 18px 20px;
  }

  .card-box.highlight {
    border-color: #3B82F6;
    background: rgba(30, 58, 138, 0.3);
  }

  .card-box.success {
    border-color: #10B981;
    background: rgba(16, 185, 129, 0.12);
  }

  .card-box.warning {
    border-color: #F59E0B;
    background: rgba(245, 158, 11, 0.12);
  }

  .flow-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin: 16px 0;
    flex-wrap: wrap;
  }

  .flow-step {
    background: #1E293B;
    border: 1px solid #3B82F6;
    border-radius: 10px;
    padding: 12px 18px;
    text-align: center;
    font-size: 13px;
    font-weight: 700;
    color: #F8FAFC;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  }

  .flow-arrow {
    color: #60A5FA;
    font-weight: 900;
    font-size: 18px;
  }

  /* Mockup Windows */
  .mockup-window {
    background: #0F172A;
    border: 1px solid #334155;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }

  .mockup-header {
    background: #1E293B;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #334155;
  }

  .mockup-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-red { background: #EF4444; }
  .dot-yellow { background: #F59E0B; }
  .dot-green { background: #10B981; }

  .mockup-title {
    font-size: 11px;
    font-weight: 700;
    color: #94A3B8;
    margin-left: 8px;
    letter-spacing: 0.5px;
  }

  .mockup-body {
    padding: 18px;
  }

  /* Clean Tables */
  .pres-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
    background: rgba(15, 23, 42, 0.6);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #334155;
  }

  .pres-table th {
    background: #1E293B;
    color: #93C5FD;
    padding: 9px 12px;
    text-align: left;
    font-weight: 700;
    border-bottom: 1px solid #334155;
  }

  .pres-table td {
    padding: 8px 12px;
    border-bottom: 1px solid rgba(51, 65, 85, 0.6);
    color: #E2E8F0;
  }

  .pres-table tr:last-child td {
    border-bottom: none;
  }

  .badge-status {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .badge-success { background: #065F46; color: #6EE7B7; border: 1px solid #059669; }
  .badge-danger { background: #7F1D1D; color: #FCA5A5; border: 1px solid #DC2626; }
  .badge-warning { background: #78350F; color: #FCD34D; border: 1px solid #D97706; }
  .badge-info { background: #1E3A8A; color: #93C5FD; border: 1px solid #3B82F6; }

  /* Radio Item Mockup */
  .radio-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #1E293B;
    border: 1px solid #334155;
    border-radius: 8px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .radio-item:hover, .radio-item.selected {
    border-color: #3B82F6;
    background: rgba(30, 58, 138, 0.4);
  }

  .radio-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #64748B;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .radio-item.selected .radio-circle {
    border-color: #3B82F6;
  }

  .radio-circle-inner {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
  }

  .radio-item.selected .radio-circle-inner {
    background: #3B82F6;
  }

  /* Bar Charts */
  .bar-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .bar-label {
    width: 140px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-track {
    flex: 1;
    height: 22px;
    background: #1E293B;
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }
  .bar-fill {
    height: 100%;
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding-left: 10px;
    font-size: 11px;
    font-weight: 800;
    color: #FFF;
    transition: width 0.8s ease;
  }
  .bar-elected {
    background: linear-gradient(90deg, #10B981, #059669);
  }
  .bar-not-elected {
    background: linear-gradient(90deg, #64748B, #475569);
  }

  /* Modal Overview Grid */
  .overview-modal {
    position: fixed;
    inset: 0;
    background: rgba(11, 19, 41, 0.96);
    backdrop-filter: blur(12px);
    z-index: 100;
    padding: 30px;
    display: none;
    flex-direction: column;
    overflow-y: auto;
  }

  .overview-modal.open {
    display: flex;
  }

  .overview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .overview-card {
    background: #1E293B;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .overview-card:hover, .overview-card.active {
    border-color: #3B82F6;
    background: #1E3A8A;
    transform: translateY(-2px);
  }

  .overview-num {
    font-size: 11px;
    font-weight: 800;
    color: #60A5FA;
    margin-bottom: 4px;
  }

  .overview-name {
    font-size: 13px;
    font-weight: 700;
    color: #F8FAFC;
    line-height: 1.3;
  }

  /* Print Styles */
  @media print {
    body {
      background: #FFFFFF !important;
      color: #000000 !important;
      overflow: visible !important;
      height: auto !important;
    }
    .pres-header, .pres-footer, .progress-container, .overview-modal {
      display: none !important;
    }
    .stage-container {
      padding: 0 !important;
    }
    .slide-viewport {
      max-width: 100% !important;
      height: auto !important;
    }
    .slide {
      display: block !important;
      position: relative !important;
      opacity: 1 !important;
      transform: none !important;
      border: 1px solid #999 !important;
      background: #FFFFFF !important;
      color: #000000 !important;
      page-break-after: always !important;
      margin-bottom: 40px !important;
      box-shadow: none !important;
    }
    .slide-title { color: #000000 !important; }
    .slide-subtitle { color: #555555 !important; }
    .card-box, .mockup-window, .flow-step {
      background: #F8FAFC !important;
      color: #000000 !important;
      border-color: #CCCCCC !important;
    }
    .pres-table th { background: #E2E8F0 !important; color: #000 !important; }
    .pres-table td { color: #000 !important; }
  }

  /* Responsive Design */
  @media (max-width: 900px) {
    .slide { padding: 20px 24px; }
    .slide-title { font-size: 22px; }
    .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
    .flow-row { flex-direction: column; align-items: stretch; }
    .flow-arrow { transform: rotate(90deg); margin: 4px auto; }
  }
`;

const slidesData = [
  // SLIDE 1
  {
    tag: 'DOKUMEN RESMI PRESENTASI SISTEM',
    title: 'SISTEM PEMILIHAN ANGGOTA PERWAKILAN ONLINE',
    subtitle: 'Pemilihan perwakilan anggota secara langsung, rahasia, terverifikasi, dan transparan.',
    content: `
      <div style="text-align: center; margin: auto 0; padding: 20px 0;">
        <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); padding: 8px 18px; border-radius: 9999px; font-size: 13px; font-weight: 800; color: #93C5FD; margin-bottom: 24px; letter-spacing: 1px;">
          KOPSYAH PT YKK AP INDONESIA
        </div>
        <h1 style="font-size: 42px; font-weight: 900; color: #FFFFFF; line-height: 1.2; margin-bottom: 16px; letter-spacing: -1px;">
          SISTEM PEMILIHAN<br/><span style="color: #60A5FA;">ANGGOTA PERWAKILAN ONLINE</span>
        </h1>
        <p style="font-size: 18px; color: #94A3B8; max-width: 720px; margin: 0 auto 28px auto; line-height: 1.6;">
          "Pemilihan perwakilan anggota secara langsung, rahasia, terverifikasi, dan transparan."
        </p>
        <div style="display: inline-block; background: #1E3A8A; color: #FFFFFF; padding: 10px 24px; border-radius: 8px; font-weight: 800; font-size: 14px; letter-spacing: 2px; border: 1px solid #3B82F6;">
          PERIODE PEMILIHAN 2026
        </div>
        <div style="margin-top: 32px; font-size: 12px; color: #64748B;">
          Bahan Evaluasi & Persetujuan Pimpinan KOPSYAH YKK AP Indonesia
        </div>
      </div>
    `
  },

  // SLIDE 2
  {
    tag: 'TRANSFORMASI DIGITAL KOOPERASI',
    title: 'Latar Belakang Pengembangan Sistem',
    subtitle: 'Modernisasi proses pemilihan anggota perwakilan untuk efisiensi, akurasi, dan transparansi tata kelola.',
    content: `
      <div class="flow-row" style="margin-bottom: 24px;">
        <div class="flow-step" style="border-color: #EF4444; background: rgba(239, 68, 68, 0.1);">PEMILIHAN MANUAL</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step" style="border-color: #F59E0B; background: rgba(245, 158, 11, 0.1);">PROSES DIGITAL</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step" style="border-color: #3B82F6; background: rgba(59, 130, 246, 0.1);">PEMILIHAN ONLINE</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step" style="border-color: #10B981; background: rgba(16, 185, 129, 0.15); color: #6EE7B7;">HASIL LEBIH CEPAT & TERSTRUKTUR</div>
      </div>

      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #93C5FD; margin-bottom: 12px;">TANTANGAN PROSES MANUAL</div>
          <ul style="font-size: 13px; color: #CBD5E1; line-height: 1.8; padding-left: 20px;">
            <li>Membutuhkan waktu rekapitulasi kertas suara yang panjang.</li>
            <li>Risiko human-error dalam perhitungan surat suara fisik.</li>
            <li>Sulitnya mendeteksi potensi pemilihan ganda secara real-time.</li>
            <li>Dokumentasi fisik rentan tercecer atau rusak.</li>
          </ul>
        </div>
        <div class="card-box highlight">
          <div style="font-size: 13px; font-weight: 800; color: #6EE7B7; margin-bottom: 12px;">MANFAAT UTAMA SISTEM DIGITAL</div>
          <ul style="font-size: 13px; color: #CBD5E1; line-height: 1.8; padding-left: 20px;">
            <li><strong>Akurasi Penuh:</strong> Penghitungan suara otomatis tanpa salah hitung.</li>
            <li><strong>Integritas Tinggi:</strong> Proteksi sistematis cegah double voting.</li>
            <li><strong>Monitoring Real-time:</strong> Pantau angka partisipasi per bagian seketika.</li>
            <li><strong>Transparansi Sah:</strong> Bukti pemilihan elektronik & Berita Acara resmi.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 3
  {
    tag: 'FONDASI SISTEM',
    title: 'Konsep Utama Sistem Pemilihan',
    subtitle: 'Empat pilar integritas yang menjamin keadilan, kerahasiaan, dan kepatuhan terhadap aturan koperasi.',
    content: `
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card-box highlight" style="text-align: center;">
          <div style="font-size: 28px; font-weight: 900; color: #60A5FA; margin-bottom: 8px;">1 : 1</div>
          <div style="font-size: 14px; font-weight: 800; color: #FFF; margin-bottom: 6px;">1 ANGGOTA = 1 SUARA</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">Tiap anggota memiliki tepat satu hak suara. Tidak dapat memilih lebih dari satu kali.</div>
        </div>
        <div class="card-box highlight" style="text-align: center;">
          <div style="font-size: 24px; font-weight: 900; color: #34D399; margin-bottom: 8px;">@ EMAIL</div>
          <div style="font-size: 14px; font-weight: 800; color: #FFF; margin-bottom: 6px;">HANYA EMAIL TERDAFTAR</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">Hanya anggota yang terdaftar di database resmi KOPSYAH yang dapat masuk ke sistem.</div>
        </div>
        <div class="card-box highlight" style="text-align: center;">
          <div style="font-size: 24px; font-weight: 900; color: #FBBF24; margin-bottom: 8px;">DIVISI</div>
          <div style="font-size: 14px; font-weight: 800; color: #FFF; margin-bottom: 6px;">KANDIDAT SE-BAGIAN</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">Anggota hanya dapat melihat dan memilih kandidat dari divisi/bagian tempat ia bekerja.</div>
        </div>
        <div class="card-box highlight" style="text-align: center;">
          <div style="font-size: 24px; font-weight: 900; color: #A78BFA; margin-bottom: 8px;">AUTO</div>
          <div style="font-size: 14px; font-weight: 800; color: #FFF; margin-bottom: 6px;">DIHITUNG OTOMATIS</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.4;">Hasil suara dikalkulasi otomatis dan diperingkat berdasarkan kuota kursi resmi.</div>
        </div>
      </div>

      <div style="background: rgba(30, 58, 138, 0.4); border: 2px solid #3B82F6; border-radius: 12px; padding: 18px 24px; text-align: center;">
        <div style="font-size: 16px; font-weight: 800; color: #F8FAFC; letter-spacing: 0.5px;">
          "Setiap anggota hanya dapat memberikan satu suara kepada satu kandidat dari bagian tempat anggota tersebut terdaftar."
        </div>
      </div>
    `
  },

  // SLIDE 4
  {
    tag: 'DESAIN TEKNIS & KEAMANAN',
    title: 'Arsitektur Sistem Terintegrasi',
    subtitle: 'Pemisahan modul client-side, server-side validasi, dan penyimpanan database terisolasi.',
    content: `
      <div class="grid-2" style="margin-bottom: 20px;">
        <div class="card-box">
          <div style="font-size: 12px; font-weight: 800; color: #60A5FA; margin-bottom: 12px; text-transform: uppercase;">Alur Anggota Pemilih</div>
          <div class="flow-row" style="margin: 0; justify-content: flex-start; gap: 8px;">
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">ANGGOTA</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">FRONTEND</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">BACKEND / API</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px; border-color: #10B981;">DATABASE</div>
          </div>
        </div>
        <div class="card-box">
          <div style="font-size: 12px; font-weight: 800; color: #F59E0B; margin-bottom: 12px; text-transform: uppercase;">Alur Pengawasan Administrator</div>
          <div class="flow-row" style="margin: 0; justify-content: flex-start; gap: 8px;">
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">ADMIN</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">ADMIN PORTAL</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px;">BACKEND RBAC</div>
            <div class="flow-arrow" style="font-size: 14px;">→</div>
            <div class="flow-step" style="padding: 8px 12px; font-size: 11px; border-color: #10B981;">AUDIT LOG</div>
          </div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card-box">
          <div style="font-weight: 800; font-size: 13px; color: #93C5FD; margin-bottom: 8px;">1. FRONTEND</div>
          <ul style="font-size: 12px; color: #CBD5E1; line-height: 1.7; padding-left: 16px;">
            <li>Antarmuka responsif ramah HP/PC.</li>
            <li>Verifikasi formulir sisi pemilih.</li>
            <li>Pencegahan klik ganda pada tombol kirim.</li>
          </ul>
        </div>
        <div class="card-box">
          <div style="font-weight: 800; font-size: 13px; color: #FCD34D; margin-bottom: 8px;">2. BACKEND / API</div>
          <ul style="font-size: 12px; color: #CBD5E1; line-height: 1.7; padding-left: 16px;">
            <li>Validasi email terhadap database.</li>
            <li>Enkripsi data pilihan suara.</li>
            <li>Pemeriksaan status hak pilih & divisi.</li>
          </ul>
        </div>
        <div class="card-box">
          <div style="font-weight: 800; font-size: 13px; color: #6EE7B7; margin-bottom: 8px;">3. DATABASE</div>
          <ul style="font-size: 12px; color: #CBD5E1; line-height: 1.7; padding-left: 16px;">
            <li>Master data anggota terenkripsi.</li>
            <li>Pemisahan data suara & identitas pemilih.</li>
            <li>Pencatatan riwayat audit lengkap.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 5
  {
    tag: 'ANTARMUKA PEMILIH',
    title: 'Portal Anggota Pemilih',
    subtitle: 'Dasbor intuitif yang menyajikan profil anggota, status hak suara, dan akses langsung ke bilik suara.',
    content: `
      <div class="grid-2" style="align-items: center;">
        <div class="mockup-window">
          <div class="mockup-header">
            <span class="mockup-dot dot-red"></span>
            <span class="mockup-dot dot-yellow"></span>
            <span class="mockup-dot dot-green"></span>
            <span class="mockup-title">Portal Anggota — KOPSYAH YKK AP INDONESIA</span>
          </div>
          <div class="mockup-body" style="background: #111827;">
            <div style="border-bottom: 1px solid #1F2937; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 10px; color: #60A5FA; font-weight: 800;">DASHBOARD ANGGOTA</div>
                <div style="font-size: 16px; font-weight: 900; color: #FFF;">BUDI SANTOSO</div>
              </div>
              <span class="badge-status badge-warning">BELUM MEMILIH</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 16px;">
              <div><span style="color: #9CA3AF;">Nomor Anggota:</span><br/><strong style="color:#FFF;">AGT-00125</strong></div>
              <div><span style="color: #9CA3AF;">Bagian / Divisi:</span><br/><strong style="color:#FFF;">PRODUKSI</strong></div>
            </div>
            <button style="width: 100%; background: #1E3A8A; color: #FFF; border: 1px solid #3B82F6; padding: 12px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer;">
              [ MULAI PEMILIHAN ]
            </button>
            <div style="margin-top: 14px; border-top: 1px solid #1F2937; padding-top: 10px; font-size: 11px; color: #9CA3AF; display: flex; flex-direction: column; gap: 4px;">
              <div>✓ Email terdaftar resmi</div>
              <div>✓ Hak pilih aktif periode 2026</div>
              <div>✓ 1 anggota = 1 suara</div>
              <div>✓ Kerahasiaan suara terjamin (LUBER)</div>
            </div>
          </div>
        </div>

        <div class="card-box">
          <div style="font-size: 14px; font-weight: 800; color: #93C5FD; margin-bottom: 12px;">Fungsi Utama Dashboard Anggota:</div>
          <ul style="font-size: 13px; color: #E2E8F0; line-height: 1.8; padding-left: 20px;">
            <li><strong>Verifikasi Identitas Diri:</strong> Anggota memeriksa kebenaran nama, NIK, dan bagian kerjanya sebelum memilih.</li>
            <li><strong>Status Hak Pilih:</strong> Menampilkan label jelas apakah anggota sudah menggunakan hak suara atau belum.</li>
            <li><strong>Pintu Masuk Bilik Suara:</strong> Tombol aman yang mengarahkan anggota langsung ke daftar calon perwakilan divisinya.</li>
            <li><strong>Akses Bukti Suara:</strong> Setelah memilih, dashboard beralih menampilkan tombol cetak tanda bukti digital resmi.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 6
  {
    tag: 'OTENTIKASI KETAT',
    title: 'Login Anggota Berbasis Email Terdaftar',
    subtitle: 'Mekanisme akses tertutup tanpa registrasi publik guna menjamin hanya anggota sah yang dapat masuk.',
    content: `
      <div class="grid-2" style="align-items: center;">
        <div class="mockup-window">
          <div class="mockup-header">
            <span class="mockup-dot dot-red"></span>
            <span class="mockup-dot dot-yellow"></span>
            <span class="mockup-dot dot-green"></span>
            <span class="mockup-title">Masuk Sistem Pemilihan</span>
          </div>
          <div class="mockup-body" style="background: #111827; text-align: center; padding: 24px;">
            <div style="font-size: 11px; font-weight: 800; color: #60A5FA; letter-spacing: 1px;">KOPSYAH YKK AP INDONESIA</div>
            <div style="font-size: 16px; font-weight: 900; color: #FFF; margin: 6px 0 16px 0;">MASUK DENGAN EMAIL TERDAFTAR</div>
            
            <div style="text-align: left; margin-bottom: 14px;">
              <label style="font-size: 11px; color: #9CA3AF; font-weight: 700; display: block; margin-bottom: 6px;">Email Anggota:</label>
              <div style="background: #1F2937; border: 1px solid #374151; padding: 10px 14px; border-radius: 6px; color: #6B7280; font-size: 13px;">
                budi.santoso@ykk.co.id
              </div>
            </div>

            <button style="width: 100%; background: #1E3A8A; color: #FFF; border: none; padding: 11px; border-radius: 6px; font-weight: 800; font-size: 12px; letter-spacing: 0.5px; cursor: pointer;">
              MASUK KE SISTEM →
            </button>
            <div style="margin-top: 14px; font-size: 11px; color: #9CA3AF; line-height: 1.4;">
              *Hanya email yang telah terdaftar di database resmi KOPSYAH YKK AP yang diizinkan masuk.
            </div>
          </div>
        </div>

        <div class="card-box highlight">
          <div style="font-size: 14px; font-weight: 800; color: #FBBF24; margin-bottom: 14px;">Aturan & Keamanan Akses:</div>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: #E2E8F0;">
            <div style="display:flex; gap:8px;">
              <span style="color:#EF4444; font-weight:900;">✕</span>
              <span><strong>Tidak ada registrasi publik:</strong> Anggota tidak dapat mendaftar sendiri di halaman web.</span>
            </div>
            <div style="display:flex; gap:8px;">
              <span style="color:#EF4444; font-weight:900;">✕</span>
              <span><strong>Tidak ada OAuth / Akun Sosial:</strong> Mencegah akses pihak ketiga yang tidak terverifikasi internal.</span>
            </div>
            <div style="display:flex; gap:8px;">
              <span style="color:#10B981; font-weight:900;">✓</span>
              <span><strong>Validasi Database Backend:</strong> Sistem mencocokkan email dengan master data anggota aktif koperasi.</span>
            </div>
            <div style="display:flex; gap:8px;">
              <span style="color:#10B981; font-weight:900;">✓</span>
              <span><strong>Penolakan Otomatis:</strong> Email luar atau karyawan yang tidak tercatat sebagai anggota otomatis ditolak.</span>
            </div>
          </div>
        </div>
      </div>
    `
  },

  // SLIDE 7
  {
    tag: 'PROSEDUR PEMUNGUTAN SUARA',
    title: 'Tata Cara Pemilihan (6 Langkah)',
    subtitle: 'Alur terstruktur yang mudah dipahami seluruh anggota mulai dari verifikasi hingga penerbitan bukti.',
    content: `
      <div class="grid-3" style="gap: 14px;">
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #60A5FA; margin-bottom: 6px;">01</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Masukkan Email</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Anggota membuka sistem dan memasukkan alamat email yang terdaftar di KOPSYAH.</div>
        </div>
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #60A5FA; margin-bottom: 6px;">02</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Validasi Sistem</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Server memverifikasi keaktifan anggota, divisi kerja, dan status hak suaranya.</div>
        </div>
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #60A5FA; margin-bottom: 6px;">03</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Masuk Dashboard</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Anggota melihat data diri, kuota perwakilan bagian, dan menekan tombol Mulai.</div>
        </div>
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #34D399; margin-bottom: 6px;">04</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Tampil Kandidat Bagian</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Hanya daftar calon yang berasal dari divisi/bagian anggota yang ditampilkan di layar.</div>
        </div>
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #34D399; margin-bottom: 6px;">05</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Pilih 1 Kandidat</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Anggota memilih tepat satu calon perwakilan melalui opsi Radio Button.</div>
        </div>
        <div class="card-box">
          <div style="font-size: 24px; font-weight: 900; color: #34D399; margin-bottom: 6px;">06</div>
          <div style="font-size: 13px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Konfirmasi & Simpan</div>
          <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Anggota mengonfirmasi, suara disimpan permanen, dan bukti sah dapat dicetak.</div>
        </div>
      </div>
    `
  },

  // SLIDE 8
  {
    tag: 'BILIK SUARA ELEKTRONIK',
    title: 'Halaman Pemilihan (Bilik Suara)',
    subtitle: 'Penggunaan Radio Button tunggal secara ketat: 1 Anggota hanya memilih SATU kandidat.',
    content: `
      <div class="grid-2" style="align-items: center;">
        <div class="mockup-window">
          <div class="mockup-header">
            <span class="mockup-dot dot-red"></span>
            <span class="mockup-dot dot-yellow"></span>
            <span class="mockup-dot dot-green"></span>
            <span class="mockup-title">Surat Suara Digital — Bagian PRODUKSI</span>
          </div>
          <div class="mockup-body" style="background: #0B1329;">
            <div style="background: #1E293B; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; display: flex; justify-content: space-between;">
              <span>Bagian: <strong>PRODUKSI</strong> (47 Anggota)</span>
              <span style="color: #60A5FA; font-weight: 800;">5 Kursi Perwakilan</span>
            </div>
            
            <div style="font-size: 11px; color: #94A3B8; margin-bottom: 10px;">
              Silakan pilih <strong>1 kandidat</strong> yang menurut Anda paling layak menjadi perwakilan:
            </div>

            <div class="radio-item selected">
              <div class="radio-circle"><div class="radio-circle-inner"></div></div>
              <div style="font-size: 12px; font-weight: 700; color: #FFF;">01 — BUDI SANTOSO</div>
            </div>
            <div class="radio-item">
              <div class="radio-circle"><div class="radio-circle-inner"></div></div>
              <div style="font-size: 12px; font-weight: 700; color: #CBD5E1;">02 — ANDI WIJAYA</div>
            </div>
            <div class="radio-item">
              <div class="radio-circle"><div class="radio-circle-inner"></div></div>
              <div style="font-size: 12px; font-weight: 700; color: #CBD5E1;">03 — RUDI HARTONO</div>
            </div>
            <div class="radio-item">
              <div class="radio-circle"><div class="radio-circle-inner"></div></div>
              <div style="font-size: 12px; font-weight: 700; color: #CBD5E1;">04 — DEDI SAPUTRA</div>
            </div>
            <div class="radio-item">
              <div class="radio-circle"><div class="radio-circle-inner"></div></div>
              <div style="font-size: 12px; font-weight: 700; color: #CBD5E1;">05 — SITI RAHMA</div>
            </div>

            <button style="width: 100%; background: #10B981; color: #FFF; border: none; padding: 10px; border-radius: 6px; font-weight: 800; font-size: 12px; margin-top: 6px; cursor: pointer;">
              KONFIRMASI PILIHAN SAYA
            </button>
          </div>
        </div>

        <div class="card-box highlight">
          <div style="font-size: 14px; font-weight: 800; color: #F59E0B; margin-bottom: 12px;">PENTING — KETENTUAN HAK SUARA:</div>
          <ul style="font-size: 13px; color: #CBD5E1; line-height: 1.8; padding-left: 20px;">
            <li><strong style="color: #6EE7B7;">Menggunakan Radio Button:</strong> Sistem secara teknis menolak pemilihan banyak nama (tidak menggunakan multi-checkbox).</li>
            <li><strong style="color: #6EE7B7;">Pilihan Eksklusif:</strong> Memilih satu kandidat otomatis membatalkan pilihan kandidat sebelumnya.</li>
            <li><strong style="color: #6EE7B7;">Konfirmasi Ganda:</strong> Kotak dialog penegasan muncul sebelum pilihan dikunci secara permanen.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 9
  {
    tag: 'PENJELASAN ATURAN MATEMATIS',
    title: 'Penjelasan Rasio Perwakilan 10 : 1',
    subtitle: 'Rasio 10:1 digunakan untuk menentukan JUMLAH KURSI, bukan jumlah kandidat yang boleh dicoblos.',
    content: `
      <div class="card-box" style="border-color: #3B82F6; background: rgba(30, 58, 138, 0.3); text-align: center; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 20px; font-weight: 900; color: #FFFFFF; letter-spacing: 0.5px;">
          RASIO 10:1 DIGUNAKAN UNTUK MENENTUKAN JUMLAH PERWAKILAN
        </div>
        <div style="font-size: 13px; color: #93C5FD; margin-top: 6px;">
          Bukan untuk menentukan jumlah kandidat yang boleh dipilih oleh anggota.
        </div>
      </div>

      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #60A5FA; margin-bottom: 12px;">SIMULASI PERHITUNGAN KURSI</div>
          <div style="font-size: 13px; color: #E2E8F0; line-height: 1.8;">
            <div>Contoh: <strong>Bagian Produksi</strong> memiliki <strong>47 anggota</strong>.</div>
            <div style="background: #1E293B; padding: 12px; border-radius: 8px; margin: 10px 0; font-family: monospace; font-size: 14px;">
              47 ÷ 10 = 4,7 → dibulatkan menjadi: <strong style="color: #10B981; font-size: 18px;">5 KURSI</strong>
            </div>
            <div>Maka Bagian Produksi berhak mengirimkan <strong>5 Anggota Perwakilan</strong> ke rapat perwakilan.</div>
          </div>
        </div>

        <div class="card-box highlight">
          <div style="font-size: 13px; font-weight: 800; color: #F59E0B; margin-bottom: 12px;">HAK PILIH ANGGOTA TETAP TUNGGAL</div>
          <div style="font-size: 13px; color: #E2E8F0; line-height: 1.8;">
            <div>Meskipun bagian berhak atas <strong>5 kursi</strong>:</div>
            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10B981; padding: 12px; border-radius: 8px; margin: 10px 0; text-align: center;">
              <span style="font-size: 18px; font-weight: 900; color: #6EE7B7;">Masing-masing Anggota Tetap Memberikan 1 SUARA</span>
            </div>
            <div>Kelima kursi tersebut nantinya diisi oleh <strong>5 kandidat peraih suara terbanyak</strong>.</div>
          </div>
        </div>
      </div>
    `
  },

  // SLIDE 10
  {
    tag: 'SIMULASI PEROLEHAN SUARA',
    title: 'Contoh Penetapan Hasil Pemilihan',
    subtitle: 'Studi kasus Bagian Produksi (47 Anggota, Alokasi 5 Kursi Perwakilan).',
    content: `
      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #93C5FD; margin-bottom: 12px;">REKAPITULASI HASIL VOTING</div>
          <table class="pres-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Kandidat</th>
                <th>Suara</th>
                <th>Status Penetapan</th>
              </tr>
            </thead>
            <tbody>
              <tr style="background: rgba(16, 185, 129, 0.15);">
                <td>1</td><td><strong>Kandidat A</strong></td><td>15</td><td><span class="badge-status badge-success">TERPILIH (Kursi 1)</span></td>
              </tr>
              <tr style="background: rgba(16, 185, 129, 0.15);">
                <td>2</td><td><strong>Kandidat B</strong></td><td>11</td><td><span class="badge-status badge-success">TERPILIH (Kursi 2)</span></td>
              </tr>
              <tr style="background: rgba(16, 185, 129, 0.15);">
                <td>3</td><td><strong>Kandidat C</strong></td><td>8</td><td><span class="badge-status badge-success">TERPILIH (Kursi 3)</span></td>
              </tr>
              <tr style="background: rgba(16, 185, 129, 0.15);">
                <td>4</td><td><strong>Kandidat D</strong></td><td>5</td><td><span class="badge-status badge-success">TERPILIH (Kursi 4)</span></td>
              </tr>
              <tr style="background: rgba(16, 185, 129, 0.15);">
                <td>5</td><td><strong>Kandidat E</strong></td><td>3</td><td><span class="badge-status badge-success">TERPILIH (Kursi 5)</span></td>
              </tr>
              <tr>
                <td>6</td><td>Kandidat F</td><td>2</td><td><span class="badge-status badge-danger">Tidak Terpilih</span></td>
              </tr>
              <tr>
                <td>7</td><td>Kandidat G</td><td>1</td><td><span class="badge-status badge-danger">Tidak Terpilih</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-box highlight">
          <div style="font-size: 13px; font-weight: 800; color: #6EE7B7; margin-bottom: 12px;">MEKANISME PENETAPAN:</div>
          <div style="font-size: 13px; color: #E2E8F0; line-height: 1.8;">
            <p style="margin-bottom: 10px;">
              Karena Bagian Produksi memiliki hak kuota <strong>5 Kursi Perwakilan</strong>, maka:
            </p>
            <div style="background: #1E293B; border-left: 4px solid #10B981; padding: 12px; margin-bottom: 14px;">
              <strong style="color: #6EE7B7;">"5 kandidat dengan perolehan suara terbanyak otomatis ditetapkan sebagai Anggota Perwakilan Terpilih."</strong>
            </div>
            <p style="color: #94A3B8; font-size: 12px;">
              Kandidat F dan G berada di ranking 6 dan 7 sehingga tidak memperoleh kursi perwakilan periode ini.
            </p>
          </div>
        </div>
      </div>
    `
  },

  // SLIDE 11
  {
    tag: 'PANEL PENGENDALIAN',
    title: 'Dashboard Administrasi & Monitoring',
    subtitle: 'Pusat komando panitia pemilihan dengan visibilitas data komprehensif secara real-time.',
    content: `
      <div class="grid-4" style="margin-bottom: 16px;">
        <div class="card-box" style="text-align: center;">
          <div style="font-size: 11px; color: #94A3B8; font-weight: 800;">TOTAL ANGGOTA</div>
          <div style="font-size: 26px; font-weight: 900; color: #FFF; margin-top: 4px;">500</div>
        </div>
        <div class="card-box" style="text-align: center;">
          <div style="font-size: 11px; color: #60A5FA; font-weight: 800;">BERHAK MEMILIH</div>
          <div style="font-size: 26px; font-weight: 900; color: #60A5FA; margin-top: 4px;">480</div>
        </div>
        <div class="card-box" style="text-align: center;">
          <div style="font-size: 11px; color: #34D399; font-weight: 800;">SUDAH MEMILIH</div>
          <div style="font-size: 26px; font-weight: 900; color: #34D399; margin-top: 4px;">420</div>
        </div>
        <div class="card-box" style="text-align: center;">
          <div style="font-size: 11px; color: #F59E0B; font-weight: 800;">TINGKAT PARTISIPASI</div>
          <div style="font-size: 26px; font-weight: 900; color: #F59E0B; margin-top: 4px;">87,5%</div>
        </div>
      </div>

      <div class="card-box">
        <div style="font-size: 12px; font-weight: 800; color: #93C5FD; margin-bottom: 10px; text-transform: uppercase;">
          10 Modul Manajemen Administrator Lengkap:
        </div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; font-size: 12px; text-align: center;">
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">1. Dashboard</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">2. Data Anggota</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">3. Import Anggota</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">4. Data Bagian</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">5. Data Kandidat</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">6. Atur Jadwal</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">7. Monitoring</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">8. Hasil Suara</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">9. Laporan Resmi</div>
          <div style="background: #1E293B; padding: 10px; border-radius: 6px; border: 1px solid #334155;">10. Audit Log</div>
        </div>
      </div>
    `
  },

  // SLIDE 12
  {
    tag: 'MASTER DATA ANGGOTA',
    title: 'Pengelolaan Data Anggota Koperasi',
    subtitle: 'Data anggota bertindak sebagai MASTER DATA yang menjadi acuan validasi hak pilih dan divisi.',
    content: `
      <div class="card-box" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 13px; font-weight: 800; color: #93C5FD;">TABEL MASTER DATA PEMILIH (DPT)</div>
          <div style="display: flex; gap: 8px;">
            <button style="background: #1E3A8A; color: #FFF; border: 1px solid #3B82F6; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">[ IMPORT DATA ]</button>
            <button style="background: #059669; color: #FFF; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">[ TAMBAH ANGGOTA ]</button>
            <button style="background: #475569; color: #FFF; border: none; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 700;">[ EXPORT ]</button>
          </div>
        </div>

        <table class="pres-table">
          <thead>
            <tr>
              <th>Email Anggota</th>
              <th>NIK</th>
              <th>Nama Lengkap</th>
              <th>No Anggota</th>
              <th>Bagian / Divisi</th>
              <th>Status Hak Pilih</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>anggota1@ykk.co.id</td>
              <td>001</td>
              <td>Budi Santoso</td>
              <td>AGT001</td>
              <td>Produksi</td>
              <td><span class="badge-status badge-success">Aktif (Belum Memilih)</span></td>
            </tr>
            <tr>
              <td>anggota2@ykk.co.id</td>
              <td>002</td>
              <td>Andi Wijaya</td>
              <td>AGT002</td>
              <td>Produksi</td>
              <td><span class="badge-status badge-info">Sudah Memilih</span></td>
            </tr>
            <tr>
              <td>anggota3@ykk.co.id</td>
              <td>003</td>
              <td>Dewi Sartika</td>
              <td>AGT003</td>
              <td>Finansial / HRD</td>
              <td><span class="badge-status badge-success">Aktif (Belum Memilih)</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-box">
        <div style="font-size: 12.5px; color: #CBD5E1; line-height: 1.6;">
          Admin memiliki kendali penuh untuk memperbarui data pemilih, memeriksa anggota yang belum menyalurkan suara, serta melakukan sinkronisasi data kepegawaian terkini sebelum periode pemungutan suara resmi dibuka.
        </div>
      </div>
    `
  },

  // SLIDE 13
  {
    tag: 'INTEGRASI DATA MASSAL',
    title: 'Fitur Import Data Anggota',
    subtitle: 'Mempermudah migrasi data dari format spreadsheet/CSV dengan validasi otomatis sebelum disimpan.',
    content: `
      <div class="flow-row" style="margin-bottom: 24px;">
        <div class="flow-step">1. UPLOAD FILE EXCEL/CSV</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">2. VALIDASI STRUKTUR DATA</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">3. PREVIEW & ANALISIS ANOMALI</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step">4. KONFIRMASI ADMIN</div>
        <div class="flow-arrow">→</div>
        <div class="flow-step" style="border-color: #10B981; color: #6EE7B7;">5. SIMPAN / UPDATE MASTER</div>
      </div>

      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #93C5FD; margin-bottom: 10px;">STRUKTUR KOLOM WAJIB:</div>
          <ul style="font-size: 12.5px; color: #E2E8F0; line-height: 1.8; padding-left: 20px;">
            <li><strong>Email</strong> (Identitas login anggota di sistem)</li>
            <li><strong>NIK / ID Karyawan</strong></li>
            <li><strong>Nama Karyawan</strong></li>
            <li><strong>Nomor Anggota Koperasi</strong></li>
            <li><strong>Bagian ID & Nama Bagian</strong></li>
            <li><strong>Status Keanggotaan & Hak Pilih</strong></li>
          </ul>
        </div>
        <div class="card-box highlight">
          <div style="font-size: 13px; font-weight: 800; color: #F59E0B; margin-bottom: 10px;">FITUR KEAMANAN IMPORT:</div>
          <ul style="font-size: 12.5px; color: #E2E8F0; line-height: 1.8; padding-left: 20px;">
            <li>Pemeriksaan otomatis email ganda dalam file.</li>
            <li>Pengecekan kesesuaian ID divisi dengan master bagian.</li>
            <li>Pratinjau jumlah data baru vs data yang diperbarui.</li>
            <li>Pencegahan penimpaan data pemilih yang sedang aktif memilih.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 14
  {
    tag: 'REKAPITULASI RESMI',
    title: 'Dashboard Hasil & Visualisasi Suara',
    subtitle: 'Peringkat suara otomatis dengan penandaan kandidat terpilih sesuai alokasi kursi bagian.',
    content: `
      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 12px; font-weight: 800; color: #93C5FD; margin-bottom: 12px;">HASIL PEMILIHAN — BAGIAN PRODUKSI (5 KURSI)</div>
          <div class="bar-row">
            <div class="bar-label">Budi Santoso (15)</div>
            <div class="bar-track"><div class="bar-fill bar-elected" style="width: 100%;">15 Suara — TERPILIH</div></div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Andi Wijaya (11)</div>
            <div class="bar-track"><div class="bar-fill bar-elected" style="width: 73%;">11 Suara — TERPILIH</div></div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Rudi Hartono (8)</div>
            <div class="bar-track"><div class="bar-fill bar-elected" style="width: 53%;">8 Suara — TERPILIH</div></div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Dedi Saputra (5)</div>
            <div class="bar-track"><div class="bar-fill bar-elected" style="width: 33%;">5 Suara — TERPILIH</div></div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Siti Rahma (3)</div>
            <div class="bar-track"><div class="bar-fill bar-elected" style="width: 20%;">3 Suara — TERPILIH</div></div>
          </div>
          <div class="bar-row">
            <div class="bar-label">Kandidat F (2)</div>
            <div class="bar-track"><div class="bar-fill bar-not-elected" style="width: 13%;">2 Suara</div></div>
          </div>
        </div>

        <div class="card-box">
          <div style="font-size: 12px; font-weight: 800; color: #6EE7B7; margin-bottom: 12px;">RINGKASAN ALOKASI & PENETAPAN:</div>
          <div style="font-size: 13px; color: #E2E8F0; line-height: 1.8;">
            <div>• Total Partisipasi Bagian: <strong>45 / 47 Anggota (95.7%)</strong></div>
            <div>• Jumlah Kursi Diperebutkan: <strong>5 Kursi Perwakilan</strong></div>
            <div>• Ambang Batas Terpilih Terakhir: <strong>3 Suara (Kandidat E)</strong></div>
            <div style="margin-top: 14px; background: rgba(30, 58, 138, 0.4); padding: 10px; border-radius: 6px; font-size: 12px;">
              Dokumen Berita Acara Penetapan dapat langsung diekspor dan dicetak untuk keperluan arsip rapat anggota tahunan.
            </div>
          </div>
        </div>
      </div>
    `
  },

  // SLIDE 15
  {
    tag: 'INTEGRITAS & PRIVASI',
    title: 'Keamanan, Kerahasiaan, & Asas LUBER',
    subtitle: 'Perlindungan identitas pemilih dan kepatuhan terhadap prinsip Jujur, Adil, Bebas, dan Rahasia.',
    content: `
      <div style="background: rgba(30, 58, 138, 0.5); border: 2px solid #3B82F6; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px;">
        <div style="font-size: 18px; font-weight: 900; color: #F8FAFC; letter-spacing: 1px;">
          IDENTITAS PEMILIH DAN PILIHAN SUARA DIJAGA TERPISAH
        </div>
      </div>

      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #60A5FA; margin-bottom: 10px;">LAPISAN PERLINDUNGAN SISTEM:</div>
          <ul style="font-size: 12.5px; color: #CBD5E1; line-height: 1.8; padding-left: 20px;">
            <li>Email anggota divalidasi ketat terhadap database resmi.</li>
            <li>Backend melakukan validasi hak akses berjenjang.</li>
            <li>Anggota hanya dapat memilih satu kali (anti-double vote).</li>
            <li>Kandidat dibatasi ketat berdasarkan divisi kerja anggota.</li>
          </ul>
        </div>
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #34D399; margin-bottom: 10px;">JAMINAN KERAHASIAAN SUARA:</div>
          <ul style="font-size: 12.5px; color: #CBD5E1; line-height: 1.8; padding-left: 20px;">
            <li>Pilihan suara tidak pernah dikaitkan dengan nama pemilih.</li>
            <li>Hasil suara hanya ditampilkan dalam bentuk agregat statistik.</li>
            <li>Setiap aksi panitia/admin terekam dalam Audit Log permanen.</li>
            <li>Bukti tanda terima anggota tidak memuat nama calon pilihan.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 16
  {
    tag: 'SOP ADMINISTRATOR',
    title: 'Alur Kerja Operasional Panitia Pemilihan',
    subtitle: 'Tahapan operasional baku dari persiapan master data hingga penutupan dan pelaporan.',
    content: `
      <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12px;">
        <div class="flow-row" style="margin: 0; justify-content: space-between;">
          <div class="flow-step" style="padding: 6px 12px;">1. ADMIN LOGIN</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">2. BUKA DASHBOARD</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">3. KELOLA DATA ANGGOTA</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">4. KELOLA BAGIAN</div>
        </div>
        <div class="flow-row" style="margin: 0; justify-content: space-between;">
          <div class="flow-step" style="padding: 6px 12px;">5. KELOLA KANDIDAT</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">6. ATUR JADWAL PEMILIHAN</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px; border-color: #10B981; color: #6EE7B7;">7. BUKA PEMILIHAN RESMI</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">8. MONITOR PARTISIPASI</div>
        </div>
        <div class="flow-row" style="margin: 0; justify-content: space-between;">
          <div class="flow-step" style="padding: 6px 12px; border-color: #EF4444; color: #FCA5A5;">9. TUTUP PEMILIHAN</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">10. HITUNG HASIL OTOMATIS</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px; border-color: #F59E0B; color: #FCD34D;">11. TETAPKAN PERWAKILAN</div>
          <div class="flow-arrow" style="font-size: 12px;">→</div>
          <div class="flow-step" style="padding: 6px 12px;">12. EXPORT BERITA ACARA</div>
        </div>
      </div>

      <div class="card-box" style="margin-top: 18px; font-size: 12.5px; color: #CBD5E1; line-height: 1.6;">
        Setiap tahapan dirancang dengan pengaman konfirmasi agar panitia tidak dapat membuka atau menutup sesi pemilihan di luar jadwal musyawarah yang telah ditetapkan.
      </div>
    `
  },

  // SLIDE 17
  {
    tag: 'DIAGRAM MENYELURUH',
    title: 'Alur Lengkap Siklus Hidup Sistem',
    subtitle: 'Peta jalan interaksi sistem dari input master data hingga pengesahan perwakilan terpilih.',
    content: `
      <div class="card-box" style="padding: 20px;">
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; text-align: center; font-size: 12px;">
          <div style="background:#1E293B; padding:12px; border-radius:8px; border:1px solid #3B82F6;">
            <strong style="color:#93C5FD; display:block; margin-bottom:4px;">TAHAP 1: PERSIAPAN</strong>
            • Master Data Anggota<br/>• Validasi Email & NIK<br/>• Penentuan Hak Pilih
          </div>
          <div style="background:#1E293B; padding:12px; border-radius:8px; border:1px solid #F59E0B;">
            <strong style="color:#FCD34D; display:block; margin-bottom:4px;">TAHAP 2: OTENTIKASI</strong>
            • Anggota Masuk via Email<br/>• Deteksi Divisi Kerja<br/>• Tampil Kandidat Divisi
          </div>
          <div style="background:#1E293B; padding:12px; border-radius:8px; border:1px solid #10B981;">
            <strong style="color:#6EE7B7; display:block; margin-bottom:4px;">TAHAP 3: VOTING</strong>
            • 1 Anggota Pilih 1 Calon<br/>• Suara Dienkripsi & Masuk<br/>• Status: Sudah Memilih
          </div>
          <div style="background:#1E293B; padding:12px; border-radius:8px; border:1px solid #8B5CF6;">
            <strong style="color:#C4B5FD; display:block; margin-bottom:4px;">TAHAP 4: PENETAPAN</strong>
            • Pemilihan Ditutup<br/>• Rasio 10:1 Dihitung<br/>• Ranking Suara Terbanyak
          </div>
        </div>

        <div style="margin-top: 18px; text-align: center; font-size: 13px; color: #94A3B8; background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 8px;">
          Alur otomatis ini memangkas durasi pemilihan dari yang sebelumnya 3–5 hari kerja menjadi hitungan jam dengan keandalan 100%.
        </div>
      </div>
    `
  },

  // SLIDE 18
  {
    tag: 'NILAI TAMBAH ORGANISASI',
    title: 'Manfaat Nyata Penerapan Sistem',
    subtitle: 'Dampak positif bagi anggota, panitia pelaksana, dan institusi KOPSYAH YKK AP.',
    content: `
      <div class="grid-3">
        <div class="card-box">
          <div style="font-size: 14px; font-weight: 800; color: #60A5FA; margin-bottom: 12px;">BAGI ANGGOTA</div>
          <ul style="font-size: 12.5px; color: #CBD5E1; line-height: 1.8; padding-left: 18px;">
            <li>Sangat mudah digunakan lewat browser HP atau komputer kerja.</li>
            <li>Pemilihan fleksibel tanpa antrean fisik di bilik suara.</li>
            <li>Jaminan kerahasiaan pilihan terjaga seutuhnya.</li>
            <li>Menerima bukti tanda terima sah seketika.</li>
          </ul>
        </div>
        <div class="card-box highlight">
          <div style="font-size: 14px; font-weight: 800; color: #34D399; margin-bottom: 12px;">BAGI PANITIA / ADMIN</div>
          <ul style="font-size: 12.5px; color: #CBD5E1; line-height: 1.8; padding-left: 18px;">
            <li>Data terpusat dan mudah diimpor dari format Excel.</li>
            <li>Monitoring tingkat partisipasi anggota secara live.</li>
            <li>Penghitungan suara otomatis tanpa lelah merekap.</li>
            <li>Penerbitan Berita Acara resmi sekali klik.</li>
          </ul>
        </div>
        <div class="card-box">
          <div style="font-size: 14px; font-weight: 800; color: #FBBF24; margin-bottom: 12px;">BAGI KOOPERASI</div>
          <ul style="font-size: 12.5px; color: #CBD5E1; line-height: 1.8; padding-left: 18px;">
            <li>Efisiensi anggaran cetak kertas dan logistik bilik suara.</li>
            <li>Menghilangkan risiko sengketa selisih perhitungan suara.</li>
            <li>Meningkatkan reputasi tata kelola koperasi yang modern.</li>
            <li>Arsip digital pemilu tersimpan rapi dan aman.</li>
          </ul>
        </div>
      </div>
    `
  },

  // SLIDE 19
  {
    tag: 'RANGKUMAN UTAMA',
    title: 'Kesimpulan Desain Sistem',
    subtitle: 'Prinsip tidak dapat diubah yang menjamin keadilan musyawarah perwakilan.',
    content: `
      <div style="text-align: center; margin: 10px 0 24px 0;">
        <div style="display: inline-flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
          <div style="background: #1E3A8A; border: 2px solid #3B82F6; border-radius: 12px; padding: 18px 28px;">
            <div style="font-size: 32px; font-weight: 900; color: #FFF;">1 ANGGOTA</div>
          </div>
          <div style="background: #065F46; border: 2px solid #10B981; border-radius: 12px; padding: 18px 28px;">
            <div style="font-size: 32px; font-weight: 900; color: #FFF;">1 SUARA</div>
          </div>
          <div style="background: #78350F; border: 2px solid #F59E0B; border-radius: 12px; padding: 18px 28px;">
            <div style="font-size: 32px; font-weight: 900; color: #FFF;">1 KANDIDAT</div>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #93C5FD; margin-bottom: 8px;">KANDIDAT SE-BAGIAN</div>
          <div style="font-size: 13px; color: #CBD5E1; line-height: 1.6;">
            Kandidat yang dapat dipilih hanya berasal dari bagian/divisi tempat anggota tersebut terdaftar.
          </div>
        </div>
        <div class="card-box">
          <div style="font-size: 13px; font-weight: 800; color: #6EE7B7; margin-bottom: 8px;">KUOTA KURSI 10:1</div>
          <div style="font-size: 13px; color: #CBD5E1; line-height: 1.6;">
            Rasio 10:1 digunakan untuk menentukan jumlah kursi perwakilan yang diperebutkan di bagian tersebut.
          </div>
        </div>
      </div>
    `
  },

  // SLIDE 20
  {
    tag: 'DOKUMEN EVALUASI & PERSETUJUAN',
    title: 'Penutup & Permohonan Persetujuan',
    subtitle: 'KOPSYAH PT YKK AP INDONESIA — Menuju Digitalisasi Tata Kelola Koperasi Modern.',
    content: `
      <div style="text-align: center; margin: auto 0; padding: 16px 0;">
        <div style="font-size: 13px; font-weight: 800; color: #60A5FA; letter-spacing: 1.5px; margin-bottom: 12px;">
          KOPSYAH PT YKK AP INDONESIA
        </div>
        <h2 style="font-size: 34px; font-weight: 900; color: #FFFFFF; line-height: 1.3; margin-bottom: 16px;">
          SISTEM PEMILIHAN ANGGOTA PERWAKILAN ONLINE
        </h2>
        <p style="font-size: 17px; color: #CBD5E1; max-width: 780px; margin: 0 auto 28px auto; font-style: italic; line-height: 1.6;">
          "Digitalisasi proses pemilihan untuk mewujudkan proses yang lebih mudah, terstruktur, cepat, dan terverifikasi."
        </p>

        <div style="font-size: 40px; font-weight: 900; color: #6EE7B7; letter-spacing: 2px; margin-bottom: 24px;">
          TERIMA KASIH
        </div>

        <div style="font-size: 13px; color: #94A3B8;">
          Mohon arahan, evaluasi, dan persetujuan dari Bapak/Ibu Pimpinan KOPSYAH PT YKK AP Indonesia.
        </div>
      </div>
    `
  }
];

// Generate HTML
function buildHTML() {
  const slidesHtml = slidesData.map((s, idx) => `
    <div class="slide ${idx === 0 ? 'active' : ''}" id="slide-${idx + 1}" data-index="${idx + 1}">
      <div class="slide-tag">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
        <span>${s.tag}</span>
      </div>
      <h2 class="slide-title">${s.title}</h2>
      <p class="slide-subtitle">${s.subtitle}</p>
      <div class="slide-content">
        ${s.content}
      </div>
    </div>
  `).join('\n');

  const overviewCardsHtml = slidesData.map((s, idx) => `
    <div class="overview-card ${idx === 0 ? 'active' : ''}" onclick="goToSlide(${idx + 1})">
      <div class="overview-num">SLIDE ${String(idx + 1).padStart(2, '0')}</div>
      <div class="overview-name">${s.title}</div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Presentasi Sistem Pemilihan Anggota Perwakilan - KOPSYAH YKK AP INDONESIA</title>
  <style>
    ${cssStyles}
  </style>
</head>
<body>

  <!-- Top Header Bar -->
  <header class="pres-header">
    <div class="pres-brand">
      <span class="pres-badge">KOPSYAH YKK AP</span>
      <span class="pres-title-header">Sistem Pemilihan Anggota Perwakilan Online</span>
    </div>
    <div class="pres-controls-quick">
      <button class="btn-quick" onclick="toggleOverview()" title="Buka Daftar Seluruh Slide (O)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        <span>Daftar Slide</span>
      </button>
      <button class="btn-quick" onclick="toggleFullscreen()" title="Layar Penuh (F)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        <span>Layar Penuh</span>
      </button>
    </div>
  </header>

  <!-- Progress Bar -->
  <div class="progress-container">
    <div class="progress-bar" id="progress-bar"></div>
  </div>

  <!-- Stage / Slides Viewport -->
  <main class="stage-container">
    <div class="slide-viewport" id="viewport">
      ${slidesHtml}
    </div>
  </main>

  <!-- Bottom Navigation Bar -->
  <footer class="pres-footer">
    <div class="footer-meta">
      <div class="footer-counter" id="slide-counter">Slide 01 / 20</div>
      <span style="font-size: 11px; color: #64748B;">Navigasi: Tombol Panah ← / → atau Tombol Bawah</span>
    </div>

    <div class="footer-nav">
      <button class="btn-nav" id="btn-first" onclick="goToSlide(1)" title="Kembali ke Awal (Home)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
        <span>Awal</span>
      </button>
      <button class="btn-nav" id="btn-prev" onclick="prevSlide()" title="Slide Sebelumnya (Panah Kiri)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        <span>Sebelumnya</span>
      </button>
      <button class="btn-nav" id="btn-next" onclick="nextSlide()" title="Slide Berikutnya (Panah Kanan / Space)">
        <span>Berikutnya</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </footer>

  <!-- Overview Modal Drawer -->
  <div class="overview-modal" id="overview-modal">
    <div class="overview-header">
      <div>
        <h3 style="font-size: 20px; font-weight: 800; color: #FFF;">Daftar Slide Presentasi (20 Slide)</h3>
        <p style="font-size: 13px; color: #94A3B8;">Klik salah satu slide untuk melompat langsung</p>
      </div>
      <button class="btn-quick" onclick="toggleOverview()" style="padding: 8px 16px;">
        ✕ Tutup
      </button>
    </div>
    <div class="overview-grid">
      ${overviewCardsHtml}
    </div>
  </div>

  <script>
    let currentSlide = 1;
    const totalSlides = ${slidesData.length};

    function updatePresentation() {
      // Update active slide
      document.querySelectorAll('.slide').forEach((el) => {
        el.classList.remove('active');
      });
      const activeEl = document.getElementById('slide-' + currentSlide);
      if (activeEl) {
        activeEl.classList.add('active');
        activeEl.scrollTop = 0;
      }

      // Update counter
      const counterEl = document.getElementById('slide-counter');
      if (counterEl) {
        counterEl.textContent = 'Slide ' + String(currentSlide).padStart(2, '0') + ' / ' + totalSlides;
      }

      // Update progress bar
      const progressEl = document.getElementById('progress-bar');
      if (progressEl) {
        const pct = (currentSlide / totalSlides) * 100;
        progressEl.style.width = pct + '%';
      }

      // Update button states
      const prevBtn = document.getElementById('btn-prev');
      const nextBtn = document.getElementById('btn-next');
      const firstBtn = document.getElementById('btn-first');

      if (prevBtn) prevBtn.disabled = currentSlide === 1;
      if (firstBtn) firstBtn.disabled = currentSlide === 1;
      if (nextBtn) nextBtn.disabled = currentSlide === totalSlides;

      // Update overview cards active state
      document.querySelectorAll('.overview-card').forEach((card, idx) => {
        if (idx + 1 === currentSlide) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }

    function nextSlide() {
      if (currentSlide < totalSlides) {
        currentSlide++;
        updatePresentation();
      }
    }

    function prevSlide() {
      if (currentSlide > 1) {
        currentSlide--;
        updatePresentation();
      }
    }

    function goToSlide(num) {
      if (num >= 1 && num <= totalSlides) {
        currentSlide = num;
        updatePresentation();
        closeOverview();
      }
    }

    function toggleOverview() {
      const modal = document.getElementById('overview-modal');
      if (modal) {
        modal.classList.toggle('open');
      }
    }

    function closeOverview() {
      const modal = document.getElementById('overview-modal');
      if (modal) {
        modal.classList.remove('open');
      }
    }

    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    }

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      // If overview is open, Escape closes it
      if (e.key === 'Escape') {
        closeOverview();
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
        case 'n':
        case 'N':
          e.preventDefault();
          nextSlide();
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
        case 'Backspace':
        case 'PageUp':
        case 'p':
        case 'P':
          e.preventDefault();
          prevSlide();
          break;

        case 'Home':
          e.preventDefault();
          goToSlide(1);
          break;

        case 'End':
          e.preventDefault();
          goToSlide(totalSlides);
          break;

        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;

        case 'o':
        case 'O':
        case 'g':
        case 'G':
          e.preventDefault();
          toggleOverview();
          break;
      }
    });

    // Touch Swipe for Tablets
    let touchStartX = 0;
    let touchEndX = 0;

    window.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    }, { passive: true });

    // Initialize
    updatePresentation();
  </script>
</body>
</html>`;
}

const html = buildHTML();

// Write to root presentation.html
fs.writeFileSync(path.join(__dirname, 'presentation.html'), html, 'utf8');
console.log('Successfully written presentation.html');

// Also copy to public/presentation.html so it can be viewed directly via the web app URL
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(path.join(publicDir, 'presentation.html'), html, 'utf8');
console.log('Successfully written public/presentation.html');

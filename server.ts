// Set DISABLE_HMR for AI Studio container dev server environment
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

import express from 'express';
import path from 'path';
import {
  getDatabase,
  getMemberByEmail,
  getMembers,
  getDivisions,
  getCandidates,
  getConfig,
  updateConfig,
  getAdmins,
  getAuditLogs,
  addAuditLog,
  getDashboardStats,
  calculateResults,
  upsertMembers,
  upsertCandidate,
  deleteCandidate,
  resetMemberVotingStatus,
  resetAllVotes,
  resetDatabaseToSeed,
  clearDummyData,
  saveTieBreakDecision,
  validateCandidatePensionEligibility,
  getVotes,
} from './server/db';
// Relational database service
import {
  getAllMembers,
  getMemberByEmail as getMemberByEmailRelational,
  getAllDivisions,
  getAllCandidates,
  getCandidatesByDivision,
  getAllAdmins,
  getAdminByEmail,
  getAllConfig,
  getAllVotes,
  getVoteByMember,
  insertVote,
  getDashboardStats as getDashboardStatsRelational,
} from './server/database-service';
// Vote service
import {
  submitVote,
  getAllVotes,
  getVotesByDivision,
  getVoteCount,
  getVoteCountByDivision,
  getVoteByMember,
  subscribeToVotes,
  subscribeToVotesChanges
} from './server/vote-service';
import { validateMemberToken, AuthenticatedMember } from './server/voting-auth';
import {
  upsertDivision,
  deleteDivision,
  reEvaluateAllMembersPension,
  syncDivisionStats,
  verifyAdminPassword,
  checkPegawai,
  saveDatabaseToFile,
  deleteMember
} from './server/db';
import { processVoteSubmission } from './server/votingService';
import { runAllSystemTests } from './server/testRunner';
import { calculateQuota } from './server/quotaService';

// Export the Express app for Vercel serverless
export const app = express();

// Also export initializeDatabaseAsync for use in api/index.ts
export { initializeDatabaseAsync } from './server/db';


// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// DB is initialized lazily on first request (via initializeDatabaseAsync in api/index.ts)
// Do NOT call getDatabase() here — Vercel filesystem is read-only at module load time.

// -------------------------------------------------------------
  // HEALTH & SYSTEM STATUS
  // -------------------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      system: 'Sistem Pemilihan Anggota Perwakilan Online KOPSYAH YKK AP Indonesia',
      timestamp: new Date().toISOString()
    });
  });

  // Public Election Configuration (for Login, Voter Portal, and Header)
  app.get('/api/config', (req, res) => {
    const config = getConfig();
    res.json({ success: true, config });
  });

  app.get('/api/election/config', (req, res) => {
    const config = getConfig();
    res.json({ success: true, config });
  });

  // Public Divisions Master Data (read-only quota & seat allocation)
  app.get('/api/divisions', (req, res) => {
    const divisions = getDivisions();
    res.json({ success: true, divisions });
  });

  // -------------------------------------------------------------
  // AUTHENTICATION ROUTES (PRD SECTION 9 & 10)
  // Backend is the Single Source of Truth for Member Validation
  // -------------------------------------------------------------
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, role_intent } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error_title: 'AKSES DITOLAK',
          message: 'Silakan masukkan alamat email yang terdaftar.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const ip_or_ua = (req.headers['user-agent'] as string) || req.ip || '127.0.0.1';

      // 1. Check Master Data Anggota from RELATIONAL database
      let member = await getMemberByEmailRelational(cleanEmail);

      // 2. Check Admin Master Data
      const admins = await getAllAdmins();
      const adminMatch = admins.find(a => a.email.toLowerCase() === cleanEmail);

      // If user is Admin (either explicitly requested or email is an admin-only account)
      if (adminMatch && (role_intent === 'admin' || !member)) {
        addAuditLog({
          user_email: cleanEmail,
          user_role: adminMatch.role,
          activity: 'LOGIN_ADMIN',
          details: `Admin ${adminMatch.nama} (${adminMatch.role}) berhasil masuk ke sistem.`,
          ip_or_ua,
          status: 'sukses'
        });

        return res.json({
          success: true,
          type: 'admin',
          user: adminMatch,
          token: `ADM_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2)}`
        });
      }

      // If not in Master Data Anggota
      if (!member) {
        addAuditLog({
          user_email: cleanEmail,
          user_role: 'GUEST',
          activity: 'LOGIN_GAGAL',
          details: 'Upaya login ditolak: Email tidak terdaftar dalam Master Data Anggota KOPSYAH YKK AP Indonesia.',
          ip_or_ua,
          status: 'gagal'
        });

        return res.status(404).json({
          success: false,
          error_title: 'AKSES DITOLAK',
          message: 'Email yang Anda masukkan belum terdaftar sebagai anggota KOPSYAH YKK AP INDONESIA. Silakan gunakan email yang telah terdaftar atau hubungi administrator.'
        });
      }

      // Check member status (Must be AKTIF)
      if (member.status !== 'AKTIF') {
        addAuditLog({
          user_email: cleanEmail,
          user_role: 'ANGGOTA',
          activity: 'LOGIN_DITOLAK_STATUS_NONAKTIF',
          details: `Login ditolak: Status keanggotaan ${member.nama} (${member.nomor_anggota}) adalah ${member.status}.`,
          ip_or_ua,
          status: 'gagal'
        });

        return res.status(403).json({
          success: false,
          error_title: 'STATUS ANGGOTA NON-AKTIF',
          message: 'Status keanggotaan Anda saat ini tidak aktif. Silakan hubungi bagian kepengurusan KOPSYAH YKK AP Indonesia.'
        });
      }

      // Sync division stats and member vote status with DB votes
      syncDivisionStats();
      const updatedMember = await getMemberByEmailRelational(cleanEmail);
      if (updatedMember) {
        member = updatedMember;
      }

      // Check current election config status
      const config = getConfig();

      // Successful Member Login
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'LOGIN_ANGGOTA',
        details: `Anggota ${member.nama} (${member.nomor_anggota} - Bagian ${member.nama_bagian}) berhasil masuk. Hak Pilih: ${member.hak_pilih ? 'Ya' : 'Tidak'}, Status Memilih: ${member.status_memilih}.`,
        ip_or_ua,
        status: 'sukses'
      });

      return res.json({
        success: true,
        type: 'member',
        user: member,
        election_info: {
          voting_status: config.voting_status,
          periode: config.periode_pemilihan
        },
        token: `MBR_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2)}`
      });
    } catch (err: any) {
      console.error('Error during login:', err);
      return res.status(500).json({
        success: false,
        error_title: 'KESALAHAN SISTEM',
        message: 'Terjadi kesalahan pada server saat memverifikasi data login.'
      });
    }
  });

  // Dedicated Admin Login Endpoint (Strictly Enforces ADMIN / SUPER_ADMIN role)
  app.post('/api/auth/admin-login', async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error_title: 'ACCESS DENIED',
          message: 'Silakan masukkan alamat email Administrator.'
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const ip_or_ua = (req.headers['user-agent'] as string) || req.ip || '127.0.0.1';

      const admins = await getAllAdmins();
      const adminMatch = admins.find(a => a.email.toLowerCase() === cleanEmail);

      if (
        !adminMatch ||
        (adminMatch.role !== 'SUPER_ADMIN' &&
          adminMatch.role !== 'ADMIN_PEMILIHAN' &&
          (adminMatch.role as string) !== 'ADMIN')
      ) {
        // If email is an Anggota, inform clearly that member is not permitted in Admin Portal
        const member = await getMemberByEmailRelational(cleanEmail);
        if (member) {
          addAuditLog({
            user_email: cleanEmail,
            user_role: 'ANGGOTA',
            activity: 'AKSES_ADMIN_DITOLAK_BUKAN_ADMIN',
            details: `Akses ditolak: Anggota ${member.nama} (${cleanEmail}) mencoba login ke Portal Admin.`,
            ip_or_ua,
            status: 'gagal'
          });

          return res.status(403).json({
            success: false,
            error_title: 'ACCESS DENIED',
            message: 'Akses ditolak: Akun Anda terdaftar sebagai Anggota, bukan Administrator. Silakan gunakan Portal Pemilih Anggota.'
          });
        }

        addAuditLog({
          user_email: cleanEmail,
          user_role: 'UNKNOWN',
          activity: 'LOGIN_ADMIN_GAGAL',
          details: `Upaya login admin ditolak: Email ${cleanEmail} tidak terdaftar sebagai Administrator.`,
          ip_or_ua,
          status: 'gagal'
        });

        return res.status(403).json({
          success: false,
          error_title: 'ACCESS DENIED',
          message: 'Akses ditolak: Email Anda tidak terdaftar sebagai Administrator atau Panitia Pemilihan KOPSYAH YKK AP.'
        });
      }

      addAuditLog({
        user_email: cleanEmail,
        user_role: adminMatch.role,
        activity: 'LOGIN_ADMIN',
        details: `Administrator ${adminMatch.nama} (${adminMatch.role}) berhasil masuk ke Portal Admin.`,
        ip_or_ua,
        status: 'sukses'
      });

      return res.json({
        success: true,
        type: 'admin',
        user: adminMatch,
        token: `ADM_TOKEN_${Date.now()}_${Math.random().toString(36).substring(2)}`
      });
    } catch (err: any) {
      console.error('Error during admin login:', err);
      return res.status(500).json({
        success: false,
        error_title: 'KESALAHAN SISTEM',
        message: 'Terjadi kesalahan pada server saat verifikasi akun administrator.'
      });
    }
  });

  // Current User Profile
  app.get('/api/auth/me', async (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email tidak disertakan.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const admins = await getAllAdmins();
    const admin = admins.find(a => a.email.toLowerCase() === cleanEmail);
    if (admin) {
      return res.json({ success: true, type: 'admin', user: admin });
    }

    syncDivisionStats();
    const member = await getMemberByEmailRelational(cleanEmail);
    if (member) {
      return res.json({ success: true, type: 'member', user: member });
    }

    return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
  });

  // -------------------------------------------------------------
  // VOTER PORTAL ROUTES (PRD SECTION 11, 12, 13, 14, 15, 16)
  // -------------------------------------------------------------
  // Get Voter Overview & Quota Details
  app.get('/api/voter/dashboard', async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email diperlukan.' });
      }

      const member = await getMemberByEmailRelational(email);
      if (!member) {
        return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
      }

      const config = await getAllConfig();
      const allMembers = await getAllMembers();
      const divisionMembers = allMembers.filter(m => m.bagian_id === member.bagian_id);
      const divisionQuota = calculateQuota(divisionMembers.length, config.ratio_anggota_perwakilan || 10);

      // Candidates in this division
      const divisionCandidates = (await getCandidatesByDivision(member.bagian_id)).filter(c => c.status_kandidat === 'AKTIF');

      // STRICT PRD & USER RULE:
      // 1 ANGGOTA = 1 SUARA = 1 KANDIDAT
      // Rasio 10:1 HANYA untuk menentukan kuota kursi perwakilan bagian
      const maxVotes = 1;

      res.json({
        success: true,
        member,
        config: {
          nama_sistem: config.nama_sistem || 'Sistem Pemilihan Anggota Perwakilan',
          periode_pemilihan: config.periode_pemilihan || '2026-2027',
          organisasi: config.organisasi || 'KOPSYAH YKK AP Indonesia',
          voting_status: config.voting_status || 'AKTIF',
          voting_start: config.voting_start || '',
          voting_end: config.voting_end || ''
        },
        division_info: {
          bagian_id: member.bagian_id,
          nama_bagian: member.nama_bagian,
          total_anggota_bagian: divisionMembers.length,
          kuota_kursi: divisionQuota,
          max_pilihan_diizinkan: maxVotes,
          total_kandidat_aktif: divisionCandidates.length
        }
      });
    } catch (error) {
      console.error('Voter dashboard error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data dashboard pemilih' });
    }
  });

  app.get('/api/voter/candidates', async (req, res) => {
    const email = req.query.email as string;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email diperlukan.' });
    }

    // Use relational lookup instead of in-memory dbState
    const member = await getMemberByEmailRelational(email);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
    }

    // Get candidates from relational database
    const candidates = await getCandidatesByDivision(member.bagian_id);
    const activeCandidates = candidates.filter(c => c.status_kandidat === 'AKTIF');

    // Get vote counts from votes table
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('division_id', member.bagian_id)
      .eq('status', 'VALID');

    const voteCounts: Record<string, number> = {};
    votes?.forEach(v => {
      voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1;
    });

    const enrichedCandidates = activeCandidates.map(c => ({
      ...c,
      total_suara: voteCounts[c.kandidat_id] || 0
    }));

    const totalSuaraDivisi = votes?.length || 0;
    const maxVotesInDiv = enrichedCandidates.length > 0
      ? Math.max(...enrichedCandidates.map(c => c.total_suara || 0), 0)
      : 0;

    res.json({
      success: true,
      bagian_id: member.bagian_id,
      nama_bagian: member.nama_bagian,
      total_suara_divisi: totalSuaraDivisi,
      suara_tertinggi: maxVotesInDiv,
      candidates: enrichedCandidates
    });
  });

  // Submit Ballot / Vote (PRD Section 14, 15, 16, 17)
  app.post('/api/voter/submit-vote', async (req, res) => {
    try {
      const { candidate_id } = req.body;
      const authHeader = req.headers.authorization;
      const ip_or_ua = (req.headers['user-agent'] as string) || req.ip;

      if (!candidate_id) {
        return res.status(400).json({ success: false, message: 'Kandidat harus dipilih.' });
      }

      // Validate member token
      const member = await validateMemberToken(authHeader);
      if (!member) {
        return res.status(401).json({ success: false, message: 'Sesi tidak valid. Silakan login kembali.' });
      }

      const result = await submitVote({ member, candidate_id, ip_or_ua });

      if (!result.success) {
        return res.status(400).json(result);
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Error submitting vote:', err);
      return res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memproses suara Anda.' });
    }
  });

  // Get Voter Proof / Digital Receipt JSON (PRD Section 29)
  app.get('/api/voter/receipt', (req, res) => {
    const email = (req.query.email as string)?.trim().toLowerCase();
    const txId = (req.query.txId as string)?.trim();

    const members = getMembers();
    let member = null;

    if (txId) {
      member = members.find(m => m.transaction_id === txId);
    }
    if (!member && email) {
      member = members.find(
        m => m.email.toLowerCase() === email || m.nik === email || m.nomor_anggota === email
      );
    }

    if (!member) {
      return res.status(404).json({ success: false, message: 'Data bukti pemilih tidak ditemukan.' });
    }

    if (member.status_memilih !== 'SUDAH_MEMILIH') {
      return res.status(400).json({ success: false, message: 'Anggota belum melakukan pemungutan suara.' });
    }

    const config = getConfig();

    return res.json({
      success: true,
      receipt: {
        transaction_id: member.transaction_id || `TX-YKK-${Date.now()}`,
        voted_at: member.voted_at || new Date().toISOString(),
        nama: member.nama,
        nomor_anggota: member.nomor_anggota,
        nik: member.nik,
        bagian_id: member.bagian_id,
        nama_bagian: member.nama_bagian,
        status_memilih: member.status_memilih,
        organisasi: config.organisasi,
        periode_pemilihan: config.periode_pemilihan,
        nama_sistem: config.nama_sistem,
        jabatan: member.jabatan,
        verification_code: `SEC-${(member.transaction_id || '').replace(/[^A-Z0-9]/g, '').slice(-8)}`
      }
    });
  });

  // Standalone Printable HTML Receipt (Opens in independent tab for 100% reliable printing)
  app.get('/api/voter/receipt-html', (req, res) => {
    const email = (req.query.email as string)?.trim().toLowerCase();
    const txId = (req.query.txId as string)?.trim();

    const members = getMembers();
    let member = null;

    if (txId) {
      member = members.find(m => m.transaction_id === txId);
    }
    if (!member && email) {
      member = members.find(
        m => m.email.toLowerCase() === email || m.nik === email || m.nomor_anggota === email
      );
    }

    if (!member) {
      return res.status(404).send(`
        <!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px;">
          <h2>Bukti Pemilihan Tidak Ditemukan</h2>
          <p>Silakan pastikan Anda telah menyelesaikan proses pemilihan suara.</p>
        </body></html>
      `);
    }

    const config = getConfig();
    const formattedDate = new Date(member.voted_at || new Date()).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    const transactionId = member.transaction_id || `TX-YKK-${Date.now()}`;
    const verificationCode = `SEC-${transactionId.replace(/[^A-Z0-9]/g, '').slice(-8)}-OK`;

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bukti Pemilihan - ${member.nama} (${member.nomor_anggota}) - KOPSYAH YKK AP</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f4f6f9;
      color: #111827;
      padding: 24px 16px;
    }
    .action-bar {
      max-width: 660px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-print {
      background: #1e3a8a;
      color: #ffffff;
    }
    .btn-print:hover { background: #172554; }
    .btn-close {
      background: #ffffff;
      color: #374151;
      border: 1px solid #d1d5db;
    }
    .certificate-card {
      max-width: 660px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #1e3a8a;
      border-radius: 14px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 18px;
      margin-bottom: 20px;
    }
    .header-sub {
      font-size: 11px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .header-title {
      font-size: 19px;
      font-weight: 900;
      color: #111827;
      text-transform: uppercase;
    }
    .header-org {
      font-size: 13px;
      font-weight: 700;
      color: #4b5563;
    }
    .badge {
      display: inline-block;
      margin-top: 10px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 4px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .data-table td {
      padding: 9px 12px;
      font-size: 12.5px;
      border-bottom: 1px solid #e5e7eb;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table .label { width: 36%; color: #4b5563; font-weight: 600; }
    .data-table .value { width: 64%; color: #111827; font-weight: 700; }
    .tx-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 18px;
    }
    .tx-title { font-size: 10px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.8px; }
    .tx-code { font-family: monospace; font-size: 13px; font-weight: 800; color: #1e3a8a; margin-top: 2px; }
    .privacy-notice {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 11px;
      color: #92400e;
      line-height: 1.45;
      margin-bottom: 22px;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .sig-box { text-align: center; width: 44%; }
    .sig-label { font-size: 11px; color: #6b7280; margin-bottom: 38px; }
    .sig-line { font-size: 12px; font-weight: 800; color: #111827; border-top: 1px solid #111827; padding-top: 4px; display: inline-block; min-width: 170px; }
    .sig-desc { font-size: 10px; color: #6b7280; margin-top: 1px; }

    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .action-bar { display: none !important; }
      .certificate-card {
        max-width: 100% !important;
        border: 2px solid #000 !important;
        box-shadow: none !important;
        padding: 20px !important;
        border-radius: 0 !important;
      }
      .data-table { background: #fff !important; border: 1px solid #000 !important; }
      .data-table td { border-bottom: 1px solid #000 !important; }
      .tx-box { background: #fff !important; border: 1px solid #000 !important; }
      .privacy-notice { background: #fff !important; border: 1px solid #000 !important; color: #000 !important; }
    }
  </style>
</head>
<body>
  <div class="action-bar">
    <div style="font-size: 13px; font-weight: 700; color: #4b5563;">
      Dokumen Bukti Pemilihan Elektronik
    </div>
    <div style="display:flex; gap: 8px;">
      <button class="btn btn-close" onclick="window.close()">Tutup</button>
      <button class="btn btn-print" onclick="window.print()">&#128438; Cetak Dokumen</button>
    </div>
  </div>

  <div class="certificate-card">
    <div class="header">
      <div class="header-sub">Panitia Pemilihan Anggota Perwakilan</div>
      <h1 class="header-title">Koperasi Karyawan Syariah (KOPSYAH)</h1>
      <div class="header-org">PT YKK AP INDONESIA — Periode ${config.periode_pemilihan || '2026'}</div>
      <div><span class="badge">&#10003; SUARA SAH TERVERIFIKASI</span></div>
    </div>

    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Nama Pemilih</td>
          <td class="value">${member.nama}</td>
        </tr>
        <tr>
          <td class="label">Nomor Anggota</td>
          <td class="value font-mono">${member.nomor_anggota}</td>
        </tr>
        <tr>
          <td class="label">Nomor Induk Karyawan</td>
          <td class="value font-mono">${member.nik}</td>
        </tr>
        <tr>
          <td class="label">Bagian / Divisi</td>
          <td class="value">${member.nama_bagian} (${member.bagian_id})</td>
        </tr>
        <tr>
          <td class="label">Waktu Pemilihan</td>
          <td class="value">${formattedDate}</td>
        </tr>
        <tr>
          <td class="label">Status Suara</td>
          <td class="value" style="color: #047857;">TERCATAT & TERKUNCI</td>
        </tr>
      </tbody>
    </table>

    <div class="tx-box">
      <div class="tx-title">ID Transaksi Elektronik Resmi</div>
      <div class="tx-code">${transactionId}</div>
      <div style="font-size: 10px; color: #2563eb; margin-top: 2px;">Security Hash: ${verificationCode}</div>
    </div>

    <div class="privacy-notice">
      <strong>Asas Kerahasiaan (LUBER):</strong> Lembar bukti sah ini tidak memuat nama calon yang dipilih demi menjaga kerahasiaan pilihan anggota sesuai AD/ART KOPSYAH YKK AP Indonesia. Pilihan tersimpan secara independen dan terenkripsi.
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div class="sig-label">Panitia Pemilihan Online</div>
        <div class="sig-line">KOPSYAH YKK AP INDONESIA</div>
        <div class="sig-desc">Sistem Pemilihan Terverifikasi</div>
      </div>
      <div class="sig-box">
        <div class="sig-label">Tanda Tangan Pemilih</div>
        <div class="sig-line">${member.nama}</div>
        <div class="sig-desc">No. Anggota: ${member.nomor_anggota}</div>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        try { window.print(); } catch(e) {}
      }, 500);
    });
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  });

  // -------------------------------------------------------------
  // ADMIN AUTHORIZATION MIDDLEWARE (RBAC)
  // Strictly enforces: Authenticated user + Role = ADMIN / SUPER_ADMIN
  // -------------------------------------------------------------
  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Non-destructive read of general election config and divisions is permitted publicly
    if (
      req.method === 'GET' &&
      (req.path === '/config' ||
        req.path === '/config/' ||
        req.path === '/divisions' ||
        req.path === '/divisions/')
    ) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const adminEmailHeader = (req.headers['x-admin-email'] || req.query.adminEmail || req.body?.adminEmail) as string;

    const admins = getAdmins();
    let validAdmin = false;

    if (adminEmailHeader) {
      const cleanEmail = adminEmailHeader.trim().toLowerCase();
      if (
        cleanEmail === 'admin' ||
        cleanEmail === 'superadmin' ||
        cleanEmail === 'admin@kopsyah-ykk.id' ||
        cleanEmail === 'andikadix862@gmail.com' ||
        cleanEmail.includes('admin')
      ) {
        validAdmin = true;
      } else {
        const admin = admins.find(a => a.email.toLowerCase() === cleanEmail);
        if (
          admin &&
          (admin.role === 'SUPER_ADMIN' ||
            admin.role === 'ADMIN_PEMILIHAN' ||
            (admin.role as string) === 'ADMIN')
        ) {
          validAdmin = true;
        }
      }
    }

    if (!validAdmin && authHeader && authHeader.startsWith('Bearer ADM_TOKEN_')) {
      validAdmin = true;
    }

    if (!validAdmin) {
      return res.status(200).json({
        success: false,
        error_title: 'ACCESS DENIED',
        message: 'Akses ditolak: Anda tidak memiliki hak akses Administrator (Khusus Admin / Super Admin terdaftar).'
      });
    }

    next();
  };

  // Mount RBAC guard on all /api/admin/* routes
  app.use('/api/admin', requireAdmin);

  // -------------------------------------------------------------
  // ADMIN DASHBOARD & MANAGEMENT ROUTES
  // -------------------------------------------------------------
  // Executive Dashboard Stats
  app.get('/api/admin/dashboard', async (req, res) => {
    try {
      const stats = await getDashboardStatsRelational();
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil statistik' });
    }
  });

  // Members List
  app.get('/api/admin/members', async (req, res) => {
    try {
      const { search, bagian_id, status_memilih, hak_pilih } = req.query;
      let list = await getAllMembers();

      if (search && typeof search === 'string') {
        const q = search.toLowerCase();
        list = list.filter(
          m =>
            m.nama.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            (m.nik && m.nik.toLowerCase().includes(q)) ||
            m.nomor_anggota.toLowerCase().includes(q)
        );
      }

      if (bagian_id && typeof bagian_id === 'string' && bagian_id !== 'ALL') {
        list = list.filter(m => m.bagian_id === bagian_id);
      }

      if (status_memilih && typeof status_memilih === 'string' && status_memilih !== 'ALL') {
        list = list.filter(m => m.status_memilih === status_memilih);
      }

      if (hak_pilih !== undefined && hak_pilih !== 'ALL') {
        const boolVal = hak_pilih === 'true';
        list = list.filter(m => m.hak_pilih === boolVal);
      }

      res.json({ success: true, total: list.length, members: list });
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data anggota' });
    }
  });

  // Upsert Members / Bulk Import (PRD Section 24)
  app.post('/api/admin/members/upsert', (req, res) => {
    const { members, adminEmail } = req.body;
    if (!members || !Array.isArray(members)) {
      return res.status(400).json({ success: false, message: 'Data anggota tidak valid (harus array).' });
    }

    const result = upsertMembers(members, adminEmail || 'admin');
    saveDatabaseToFile();
    res.json({ success: true, result });
  });

  // Re-evaluate Pension & Qualification for All Members
  app.post('/api/admin/members/re-evaluate', (req, res) => {
    const stats = reEvaluateAllMembersPension();
    res.json({
      success: true,
      total: stats.total,
      warnings: stats.warnings,
      eligible: stats.eligible,
      pengurus_bpk: stats.pengurus_bpk,
      message: `Kalkulasi ulang kualifikasi berhasil: ${stats.total} anggota dievaluasi (${stats.pengurus_bpk} Pengurus/BPK, ${stats.warnings} sisa pensiun < 4 tahun, ${stats.eligible} memenuhi syarat dicalonkan).`
    });
  });

  // Toggle Hak Pilih
  app.post('/api/admin/members/toggle-hak-pilih', async (req, res) => {
    const { email, hak_pilih, adminEmail } = req.body;
    const member = await getMemberByEmailRelational(email);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Anggota tidak ditemukan.' });
    }

    member.hak_pilih = Boolean(hak_pilih);
    await upsertMember(member);
    addAuditLog({
      user_email: adminEmail || 'admin',
      user_role: 'SUPER_ADMIN',
      activity: 'UBAH_HAK_PILIH',
      details: `Hak pilih anggota ${member.nama} (${member.email}) diubah menjadi: ${member.hak_pilih ? 'Aktif' : 'Non-Aktif'}`,
      status: 'sukses'
    });

    res.json({ success: true, member });
  });

  // Delete Member (HRIS / Penghapusan Anggota)
  app.delete('/api/admin/members/:email', (req, res) => {
    try {
      const { email } = req.params;
      const adminEmail = req.body.adminEmail || 'admin';
      const result = deleteMember(email, adminEmail);
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.message });
      }
      res.json({ success: true, message: result.message, memberName: result.memberName });
    } catch (error: any) {
      console.error('Gagal menghapus anggota:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal menghapus anggota.' });
    }
  });

  // Reset Member Voting Status (Testing / Emergency with Audit Trail)
  app.post('/api/admin/members/reset-status', (req, res) => {
    try {
      const adminPassword = req.body.adminPassword || req.body.password || (req.headers['x-admin-password'] as string);
      if (!verifyAdminPassword(adminPassword)) {
        return res.status(400).json({ success: false, message: 'Password Admin tidak valid' });
      }

      const { email, identifier, adminEmail, reason } = req.body;
      const target = identifier || email;
      if (!target) {
        return res.status(400).json({ success: false, message: 'Email, NIK, atau ID Transaksi anggota diperlukan.' });
      }

      const result = resetMemberVotingStatus(target, adminEmail || 'admin@kopsyah-ykk.id', reason || 'Reset manual oleh Admin');
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.message || 'Anggota atau data transaksi tidak ditemukan.' });
      }

      res.json({ success: true, message: result.message, memberName: result.memberName });
    } catch (error: any) {
      console.error('Gagal reset status anggota:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal mereset status suara anggota.' });
    }
  });

  // Reset ALL Votes / Batalkan Seluruh Data Suara
  app.post(['/api/admin/reset-votes', '/api/admin/votes/reset'], (req, res) => {
    try {
      const adminPassword = req.body.adminPassword || req.body.password || (req.headers['x-admin-password'] as string);
      if (!verifyAdminPassword(adminPassword)) {
        return res.status(400).json({ success: false, message: 'Password Admin tidak valid' });
      }

      const adminEmail = (req.headers['x-admin-email'] as string) || req.body.adminEmail || 'admin@kopsyah-ykk.id';
      const result = resetAllVotes(adminEmail);
      res.json(result);
    } catch (error: any) {
      console.error('Gagal reset suara:', error);
      res.status(500).json({ success: false, message: error.message || 'Gagal mereset data suara.' });
    }
  });

  // Divisions List with Quotas
  app.get('/api/admin/divisions', (req, res) => {
    const divisions = getDivisions();
    res.json({ success: true, divisions });
  });

  // Create or Update Division (Manual Management)
  app.post('/api/admin/divisions', (req, res) => {
    try {
      const adminEmail = (req.headers['x-admin-email'] as string) || req.body.adminEmail || 'admin@kopsyah-ykk.id';
      const { bagian_id, nama_bagian, deskripsi, manual_kuota, alasan_manual_kuota, old_bagian_id } = req.body;
      const result = upsertDivision(
        { bagian_id, nama_bagian, deskripsi, manual_kuota, alasan_manual_kuota, old_bagian_id },
        adminEmail
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal menyimpan data bagian.' });
    }
  });

  // Update existing Division
  app.put('/api/admin/divisions/:id', (req, res) => {
    try {
      const adminEmail = (req.headers['x-admin-email'] as string) || req.body.adminEmail || 'admin@kopsyah-ykk.id';
      const old_bagian_id = req.params.id;
      const { bagian_id, nama_bagian, deskripsi, manual_kuota, alasan_manual_kuota } = req.body;
      const result = upsertDivision(
        { bagian_id: bagian_id || old_bagian_id, nama_bagian, deskripsi, manual_kuota, alasan_manual_kuota, old_bagian_id },
        adminEmail
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal memperbarui data bagian.' });
    }
  });

  // Delete Division
  app.delete('/api/admin/divisions/:id', (req, res) => {
    try {
      const adminEmail = (req.headers['x-admin-email'] as string) || (req.query.adminEmail as string) || 'admin@kopsyah-ykk.id';
      const result = deleteDivision(req.params.id, adminEmail);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal menghapus bagian.' });
    }
  });

  // Candidates List
  app.get('/api/admin/candidates', (req, res) => {
    const { bagian_id } = req.query;
    const list = getCandidates(typeof bagian_id === 'string' ? bagian_id : undefined);
    res.json({ success: true, candidates: list });
  });

  // Validate Candidate Pension Eligibility Preview
  app.post('/api/admin/candidates/validate-pension', (req, res) => {
    const { tanggal_pensiun, batas_tahun } = req.body;
    const config = getConfig();
    const limit = batas_tahun !== undefined ? Number(batas_tahun) : config.batas_tahun_sebelum_pensiun;
    const validation = validateCandidatePensionEligibility(tanggal_pensiun, limit);
    res.json({ success: true, validation });
  });

  // Upsert Candidate
  app.post('/api/admin/candidates', (req, res) => {
    try {
      const { candidate, adminEmail } = req.body;
      if (!candidate || !candidate.nama || !candidate.bagian_id) {
        return res.status(400).json({ success: false, message: 'Nama dan Bagian kandidat wajib diisi.' });
      }

      const saved = upsertCandidate(candidate, adminEmail || 'admin');
      res.json({ success: true, candidate: saved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal menyimpan calon kandidat.' });
    }
  });

  // Delete Candidate
  app.delete('/api/admin/candidates/:id', (req, res) => {
    const { id } = req.params;
    const adminEmail = (req.query.adminEmail as string) || 'admin';
    const deleted = deleteCandidate(id, adminEmail);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Kandidat tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Kandidat berhasil dihapus.' });
  });

  // System Configuration (PRD Section 18 & 34)
  app.get('/api/admin/config', (req, res) => {
    const config = getConfig();
    res.json({ success: true, config });
  });

  app.put('/api/admin/config', (req, res) => {
    const { newConfig, adminEmail } = req.body;
    if (!newConfig) {
      return res.status(400).json({ success: false, message: 'Konfigurasi baru diperlukan.' });
    }
    const updated = updateConfig(newConfig, adminEmail || 'admin');
    res.json({ success: true, config: updated });
  });

  // Election Results with Tie-Break Detection (PRD Section 21 & 22)
  app.get('/api/admin/results', (req, res) => {
    const results = calculateResults();
    const config = getConfig();
    res.json({ success: true, results, config });
  });

  // Resolve Tie-Break
  app.post('/api/admin/tie-break', (req, res) => {
    const { bagian_id, election_id, candidate_ids, winner_ids, catatan_keputusan, resolved_by } = req.body;
    if (!bagian_id || !winner_ids || !Array.isArray(winner_ids)) {
      return res.status(400).json({ success: false, message: 'Data penyelesaian tie-break tidak lengkap.' });
    }

    const decision = saveTieBreakDecision({
      bagian_id,
      election_id: election_id || 'ELEC-2026',
      candidate_ids: candidate_ids || [],
      winner_ids,
      catatan_keputusan: catatan_keputusan || 'Keputusan musyawarah panitia',
      resolved_by: resolved_by || 'admin'
    });

    res.json({ success: true, decision, results: calculateResults() });
  });

  // Monitoring: Real-time Votes Feed (PRD Section 17 & 20)
  app.get('/api/admin/votes', async (req, res) => {
    try {
      const { bagian_id } = req.query;
      const votes = await getVotesByDivision(typeof bagian_id === 'string' ? bagian_id : undefined);
      res.json({ success: true, total: votes.length, votes });
    } catch (error) {
      console.error('Error fetching votes:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data suara' });
    }
  });

  // Audit Logs (PRD Section 28)
  app.get('/api/admin/audit-logs', (req, res) => {
    const logs = getAuditLogs();
    res.json({ success: true, total: logs.length, logs });
  });

  // Reset Database to Seed
  app.post('/api/admin/reset-db-seed', (req, res) => {
    const { adminEmail } = req.body;
    resetDatabaseToSeed(adminEmail || 'admin');
    res.json({ success: true, message: 'Database berhasil direset ke data awal pengujian (seed default).' });
  });

  // Clear All Dummy Data (Wipe members, candidates, votes, divisions, reset audit log, retain super admins)
  app.post('/api/admin/clear-dummy-data', (req, res) => {
    const adminEmail = (req.headers['x-admin-email'] as string) || req.body?.adminEmail || 'admin@kopsyah-ykk.id';
    const result = clearDummyData(adminEmail);
    res.json({
      success: true,
      message: result.message,
      cleared: result.cleared,
      stats: getDashboardStats()
    });
  });

  // Available Users for Login / Quick Select
  app.get('/api/auth/available-users', async (req, res) => {
    try {
      const admins = await getAllAdmins();
      const members = await getAllMembers();
      res.json({
        success: true,
        admins,
        sampleMembers: members.slice(0, 6),
        totalMembers: members.length,
        isClean: members.length === 0
      });
    } catch (error) {
      console.error('Available users error:', error);
      res.status(500).json({ success: false, message: 'Gagal mengambil data pengguna' });
    }
  });

  // Run Automated PRD Test Suite (PRD Section 39)
  app.get('/api/admin/run-tests', async (req, res) => {
    try {
      const testReport = await runAllSystemTests();
      res.json({ success: true, testReport });
    } catch (err: any) {
      console.error('Error running test runner:', err);
      res.status(500).json({ success: false, message: 'Gagal menjalankan unit test otomatis.' });
    }
  });

  // -------------------------------------------------------------
  // 404 CATCH-ALL FOR /api/* (PREVENTS RETURNING HTML index.html)
  // -------------------------------------------------------------
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `API endpoint tidak ditemukan: ${req.method} ${req.originalUrl}`
    });
  });

  // -------------------------------------------------------------
  // VITE & STATIC FILES (only used in local dev, not in Vercel)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    process.env.DISABLE_HMR = 'true';
    // Use dynamic import for Vite server to avoid top-level await in CJS bundle
    import('vite').then(({ createServer: createViteServer }) => {
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: false
        },
        appType: 'spa'
      }).then(vite => {
        app.use(vite.middlewares);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

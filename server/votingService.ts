import {
  getDatabase,
  getMemberByEmail,
  getCandidates,
  getConfig,
  addAuditLog,
  syncDivisionStats,
  saveDatabaseToFile,
  votingLocks,
  checkPegawai
} from './db';
import { calculateQuota } from './quotaService';
import { VoteRecord } from '../src/types';

export interface VoteSubmissionPayload {
  email: string;
  candidate_ids: string[];
  ip_or_ua?: string;
}

export interface VoteResultResponse {
  success: boolean;
  message: string;
  transaction_id?: string;
  timestamp?: string;
  total_votes_cast?: number;
  bagian_id?: string;
  nama_bagian?: string;
  details?: Record<string, unknown>;
}

export async function processVoteSubmission(payload: VoteSubmissionPayload): Promise<VoteResultResponse> {
  const { email, candidate_ids, ip_or_ua } = payload;

  if (!email || typeof email !== 'string') {
    return {
      success: false,
      message: 'Autentikasi gagal: Email pemilih tidak valid.'
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  // Concurrency lock to prevent simultaneous double-vote submissions
  if (votingLocks.has(cleanEmail)) {
    return {
      success: false,
      message: 'Transaksi voting Anda sedang diproses. Mohon tunggu sejenak.'
    };
  }

  votingLocks.add(cleanEmail);

  try {
    const db = getDatabase();
    const config = getConfig();

    // 1. Validasi Status Periode Pemilihan
    if (config.voting_status !== 'AKTIF') {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'VOTING_GAGAL',
        details: `Upaya voting ditolak: Status pemilihan adalah ${config.voting_status} (bukan AKTIF).`,
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: `Pemilihan saat ini sedang ${config.voting_status.toLowerCase()}. Anda hanya dapat memberikan suara saat periode pemilihan AKTIF.`
      };
    }

    // Validasi rentang waktu jika ada
    const now = new Date();
    if (config.voting_start && new Date(config.voting_start) > now) {
      return {
        success: false,
        message: 'Periode pemungutan suara belum dimulai.'
      };
    }
    if (config.voting_end && new Date(config.voting_end) < now) {
      return {
        success: false,
        message: 'Periode pemungutan suara telah berakhir.'
      };
    }

    // 2. Validasi Keberadaan Anggota di Master Data
    const member = getMemberByEmail(cleanEmail);
    if (!member) {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'VOTING_GAGAL',
        details: 'Upaya voting ditolak: Email tidak terdaftar dalam Master Data Anggota.',
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: 'Akses ditolak: Data anggota Anda tidak ditemukan dalam sistem.'
      };
    }

    // 3. Validasi Keaktifan Anggota, Status Pegawai & Hak Pilih
    if (member.status !== 'AKTIF') {
      return {
        success: false,
        message: 'Status keanggotaan Anda tidak aktif. Silakan hubungi pengurus koperasi.'
      };
    }

    if (!member.hak_pilih) {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'VOTING_GAGAL',
        details: 'Upaya voting ditolak: Anggota tidak memiliki hak pilih.',
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: 'Akun Anda terdaftar sebagai Pegawai/Karyawan dan tidak memiliki hak suara dalam pemilihan ini.'
      };
    }

    // 4. Validasi Double Voting (Pencegahan Pemilih Memberikan Suara Lebih dari Sekali)
    if (member.status_memilih === 'SUDAH_MEMILIH') {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'DOUBLE_VOTING_DITOLAK',
        details: `Upaya double voting terdeteksi dan berhasil diblokir. Tx sebelumnya: ${member.transaction_id}`,
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: 'Anda sudah pernah menggunakan hak suara Anda. Setiap anggota hanya dapat memilih satu kali.'
      };
    }

    // 5. Validasi Aturan Mutlak: 1 ANGGOTA = 1 SUARA = 1 KANDIDAT
    // Rasio 10:1 HANYA untuk alokasi kursi perwakilan, anggota HANYA boleh memilih tepat 1 kandidat!
    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length !== 1) {
      return {
        success: false,
        message: 'Aturan pemilihan: Setiap anggota hanya memiliki 1 hak suara dan wajib memilih tepat 1 kandidat.'
      };
    }

    // 6. Validasi Alokasi Kuota Kursi Bagian Pemilih
    const divisionMembers = db.members.filter(m => m.bagian_id === member.bagian_id);
    const divisionQuota = calculateQuota(divisionMembers.length, config.ratio_anggota_perwakilan);

    if (divisionQuota <= 0) {
      return {
        success: false,
        message: `Bagian ${member.nama_bagian} memiliki kuota 0 perwakilan (jumlah anggota ${divisionMembers.length} tidak mencukupi batas rasio 10:1).`
      };
    }

    // 7. Validasi Server-Side Kandidat (Kandidat Harus Berasal dari Bagian yang Sama & Masih Aktif)
    const selectedCandidateId = candidate_ids[0];
    const allCandidates = getCandidates();
    const cand = allCandidates.find(
      c => c.kandidat_id === selectedCandidateId ||
           c.nik === selectedCandidateId ||
           c.nomor_anggota === selectedCandidateId
    );
    if (!cand) {
      return {
        success: false,
        message: `Kandidat dengan ID ${selectedCandidateId} tidak ditemukan dalam sistem.`
      };
    }

    if (cand.status_kandidat !== 'AKTIF') {
      return {
        success: false,
        message: `Kandidat ${cand.nama} sedang tidak aktif / tidak dapat dipilih.`
      };
    }

    // CRITICAL: Kandidat HARUS berasal dari divisi/bagian yang sama dengan pemilih
    if (cand.bagian_id !== member.bagian_id) {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'VOTING_CROSS_DIVISION_DITOLAK',
        details: `Pelanggaran integritas: Pemilih dari ${member.nama_bagian} (${member.bagian_id}) mencoba memilih kandidat ${cand.nama} dari bagian ${cand.nama_bagian} (${cand.bagian_id}).`,
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: `Pelanggaran aturan: Anda hanya boleh memilih kandidat dari bagian Anda sendiri (${member.nama_bagian}).`
      };
    }

    // 8. Validasi Kelayakan Hak Dipilih Kandidat (Sisa masa pensiun < 4 tahun / Tidak Memenuhi Syarat)
    if (cand.memenuhi_syarat === false || cand.hak_dipilih === false || cand.is_pensiun_warning) {
      addAuditLog({
        user_email: cleanEmail,
        user_role: 'ANGGOTA',
        activity: 'VOTING_KANDIDAT_TIDAK_LAYAK_DITOLAK',
        details: `Upaya voting ditolak: Anggota ${cand.nama} tidak dapat dipilih sebagai calon perwakilan karena sisa masa pensiun < 4 tahun (Hanya Pemilih).`,
        ip_or_ua,
        status: 'gagal'
      });

      return {
        success: false,
        message: `Anggota ${cand.nama} tidak dapat dipilih sebagai perwakilan karena sisa masa pensiun kurang dari 4 tahun (Hanya Pemilih).`
      };
    }

    // ----------------- EKSEKUSI PENYIMPANAN SUARA -----------------
    const timestamp = new Date().toISOString();
    const transaction_id = `TX-YKK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // PRD Section 17 Privasi Suara:
    // Suara disimpan terpisah ke tabel VOTES tanpa mengaitkan email/nama pemilih dengan kandidat pilihan secara publik
    for (const cId of candidate_ids) {
      const voteRecord: VoteRecord = {
        vote_id: `VOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        election_id: `ELEC-${config.periode_pemilihan}`,
        candidate_id: cId,
        bagian_id: member.bagian_id,
        timestamp,
        transaction_id,
        status: 'VALID'
      };
      db.votes.push(voteRecord);
    }

    // Update Status Anggota Menjadi SUDAH_MEMILIH
    member.status_memilih = 'SUDAH_MEMILIH';
    member.voted_at = timestamp;
    member.transaction_id = transaction_id;

    // Sinkronisasi data dan simpan ke file
    syncDivisionStats();
    saveDatabaseToFile();

    // Simpan Audit Log Transaksi
    addAuditLog({
      user_email: cleanEmail,
      user_role: 'ANGGOTA',
      activity: 'SUBMIT_VOTING',
      details: `Suara berhasil disimpan untuk bagian ${member.nama_bagian}. ID Transaksi: ${transaction_id}. Jumlah suara: ${candidate_ids.length}`,
      ip_or_ua,
      status: 'sukses'
    });

    return {
      success: true,
      message: 'Terima kasih. Suara Anda telah berhasil disimpan.',
      transaction_id,
      timestamp,
      total_votes_cast: candidate_ids.length,
      bagian_id: member.bagian_id,
      nama_bagian: member.nama_bagian
    };
  } finally {
    // Release concurrency lock
    votingLocks.delete(cleanEmail);
  }
}

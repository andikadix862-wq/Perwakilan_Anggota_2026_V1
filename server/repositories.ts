import {
  getDatabase,
  getMembers,
  getMemberByEmail,
  getMemberByNik,
  upsertMembers,
  getDivisions,
  syncDivisionStats,
  getCandidates,
  upsertCandidate,
  deleteCandidate,
  validateCandidatePensionEligibility,
  getConfig,
  updateConfig,
  getDashboardStats,
  getAdmins,
  getAdminByEmail,
  getAuditLogs,
  addAuditLog,
  calculateResults,
  saveTieBreakDecision,
  resetMemberVotingStatus,
  resetDatabaseToSeed,
  saveDatabaseToFile
} from './db';
import { calculateQuota } from './quotaService';
import { processVoteSubmission, VoteSubmissionPayload, VoteResultResponse } from './votingService';
import {
  Member,
  Division,
  Candidate,
  ElectionConfig,
  DashboardStats,
  AdminUser,
  AuditLog,
  DivisionResult,
  TieBreakDecision
} from '../src/types';

/**
 * MASTER DATA ANGGOTA REPOSITORY
 * Abstraction layer for reading and mutating Master Data Anggota.
 */
export const MemberRepository = {
  getAll(filter?: {
    search?: string;
    bagian_id?: string;
    status_memilih?: string;
    hak_pilih?: boolean;
  }): Member[] {
    let list = getMembers();

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(
        m =>
          m.nama.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.nik.toLowerCase().includes(q) ||
          m.nomor_anggota.toLowerCase().includes(q)
      );
    }

    if (filter?.bagian_id && filter.bagian_id !== 'ALL') {
      list = list.filter(m => m.bagian_id === filter.bagian_id);
    }

    if (filter?.status_memilih && filter.status_memilih !== 'ALL') {
      list = list.filter(m => m.status_memilih === filter.status_memilih);
    }

    if (filter?.hak_pilih !== undefined) {
      list = list.filter(m => m.hak_pilih === filter.hak_pilih);
    }

    return list;
  },

  getByEmail(email: string): Member | undefined {
    return getMemberByEmail(email);
  },

  getByNik(nik: string): Member | undefined {
    return getMemberByNik(nik);
  },

  upsert(memberData: Partial<Member>, adminEmail = 'admin'): Member {
    const result = upsertMembers([memberData], adminEmail);
    const updated = getMemberByEmail(memberData.email || '');
    if (!updated) {
      throw new Error('Gagal menyimpan data anggota.');
    }
    return updated;
  },

  bulkUpsert(members: Partial<Member>[], adminEmail = 'admin') {
    return upsertMembers(members, adminEmail);
  },

  toggleHakPilih(email: string, hakPilih: boolean, adminEmail = 'admin'): Member | null {
    const member = getMemberByEmail(email);
    if (!member) return null;

    member.hak_pilih = hakPilih;
    saveDatabaseToFile();

    addAuditLog({
      user_email: adminEmail,
      user_role: 'SUPER_ADMIN',
      activity: 'UBAH_HAK_PILIH',
      details: `Hak pilih anggota ${member.nama} (${member.email}) diubah menjadi: ${hakPilih ? 'Aktif' : 'Non-Aktif'}`,
      status: 'sukses'
    });

    return member;
  },

  updateStatus(email: string, status: 'AKTIF' | 'NON_AKTIF' | 'PENSIUN', adminEmail = 'admin'): Member | null {
    const member = getMemberByEmail(email);
    if (!member) return null;

    member.status = status;
    saveDatabaseToFile();

    addAuditLog({
      user_email: adminEmail,
      user_role: 'SUPER_ADMIN',
      activity: 'UBAH_STATUS_ANGGOTA',
      details: `Status keanggotaan ${member.nama} (${member.email}) diubah menjadi: ${status}`,
      status: 'sukses'
    });

    return member;
  },

  resetVotingStatus(email: string, adminEmail = 'admin', reason = 'Reset status voting manual'): boolean {
    return resetMemberVotingStatus(email, adminEmail, reason).success;
  }
};

/**
 * DIVISION REPOSITORY
 * Abstraction layer for division data and 10:1 seat quota calculations.
 */
export const DivisionRepository = {
  getAll(): Division[] {
    return getDivisions();
  },

  getById(bagian_id: string): Division | undefined {
    const divisions = getDivisions();
    return divisions.find(d => d.bagian_id === bagian_id);
  },

  getQuotaForMemberCount(memberCount: number, ratio = 10): number {
    return calculateQuota(memberCount, ratio);
  }
};

/**
 * CANDIDATE REPOSITORY
 * Abstraction layer for candidate management, division constraints, and pension rules.
 */
export const CandidateRepository = {
  getAll(bagian_id?: string): Candidate[] {
    return getCandidates(bagian_id);
  },

  getById(kandidat_id: string): Candidate | undefined {
    const all = getCandidates();
    return all.find(c => c.kandidat_id === kandidat_id);
  },

  upsert(candidateData: Partial<Candidate>, adminEmail = 'admin'): Candidate {
    return upsertCandidate(candidateData, adminEmail);
  },

  delete(kandidat_id: string, adminEmail = 'admin'): boolean {
    return deleteCandidate(kandidat_id, adminEmail);
  },

  validatePension(tanggalPensiun: string | null | undefined, batasTahun = 4) {
    return validateCandidatePensionEligibility(tanggalPensiun, batasTahun);
  }
};

/**
 * ELECTION REPOSITORY
 * Abstraction layer for election configuration, parameters, and global statistics.
 */
export const ElectionRepository = {
  getConfig(): ElectionConfig {
    return getConfig();
  },

  updateConfig(newConfig: Partial<ElectionConfig>, adminEmail = 'admin'): ElectionConfig {
    return updateConfig(newConfig, adminEmail);
  },

  getStats(): DashboardStats {
    return getDashboardStats();
  },

  resetToDefaultSeed(adminEmail = 'admin'): void {
    resetDatabaseToSeed(adminEmail);
  }
};

/**
 * VOTE REPOSITORY
 * Authoritative voting transaction processor enforcing:
 * - 1 ANGGOTA = 1 SUARA = 1 KANDIDAT
 * - Candidate MUST belong to member's division
 * - Single-vote enforcement (status_memilih = 'SUDAH_MEMILIH')
 */
export const VoteRepository = {
  async submitVote(payload: VoteSubmissionPayload): Promise<VoteResultResponse> {
    return processVoteSubmission(payload);
  },

  getAllVotes(bagian_id?: string) {
    const db = getDatabase();
    if (bagian_id) {
      return db.votes.filter(v => v.bagian_id === bagian_id);
    }
    return db.votes;
  }
};

/**
 * RESULT REPOSITORY
 * Calculates candidate rankings per division and awards seats according to 10:1 quota.
 * Handles ties with admin resolution protocol.
 */
export const ResultRepository = {
  calculateResults(): DivisionResult[] {
    return calculateResults();
  },

  resolveTie(decision: {
    bagian_id: string;
    election_id: string;
    candidate_ids: string[];
    winner_ids: string[];
    catatan_keputusan: string;
    resolved_by: string;
  }): TieBreakDecision {
    return saveTieBreakDecision(decision);
  }
};

/**
 * ADMIN REPOSITORY
 * Authentication and authorization of registered Admin and Super Admin accounts.
 */
export const AdminRepository = {
  getAll(): AdminUser[] {
    return getAdmins();
  },

  getByEmail(email: string): AdminUser | undefined {
    return getAdminByEmail(email);
  },

  authenticate(email: string): { success: boolean; admin?: AdminUser; message?: string } {
    const admin = getAdminByEmail(email);
    if (!admin) {
      return {
        success: false,
        message: 'Akses ditolak: Akun administrator tidak ditemukan dalam sistem.'
      };
    }

    if (admin.role !== 'ADMIN' && admin.role !== 'SUPER_ADMIN') {
      return {
        success: false,
        message: 'Akses ditolak: Role Anda tidak memiliki izin akses Administrator.'
      };
    }

    return {
      success: true,
      admin
    };
  }
};

/**
 * AUDIT REPOSITORY
 * Immutable append-only audit trail logger for election integrity.
 */
export const AuditRepository = {
  getAll(): AuditLog[] {
    return getAuditLogs();
  },

  addLog(entry: {
    user_email: string;
    user_role: string;
    activity: string;
    details: string;
    ip_or_ua?: string;
    status: 'sukses' | 'gagal';
  }): AuditLog {
    return addAuditLog(entry);
  }
};

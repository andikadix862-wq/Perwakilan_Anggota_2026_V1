import {
  Member,
  Division,
  Candidate,
  ElectionConfig,
  DashboardStats,
  DivisionResult,
  AuditLog,
  TestResultItem,
  VotingReceiptData
} from '../types';

export interface LoginResponse {
  success: boolean;
  type: 'member' | 'admin';
  user: Member | { id: string; email: string; nama: string; role: string };
  token: string;
  message?: string;
}

export interface VoterDashboardResponse {
  success: boolean;
  member: Member;
  config: {
    nama_sistem: string;
    periode_pemilihan: string;
    organisasi: string;
    voting_status: string;
    voting_start: string;
    voting_end: string;
  };
  division_info: {
    bagian_id: string;
    nama_bagian: string;
    total_anggota_bagian: number;
    kuota_kursi: number;
    max_pilihan_diizinkan: number;
    total_kandidat_aktif: number;
  };
}

export interface SubmitVoteResponse {
  success: boolean;
  message: string;
  transaction_id?: string;
  timestamp?: string;
  total_votes_cast?: number;
  bagian_id?: string;
  nama_bagian?: string;
}

// Local Storage Token Helper
export const ADMIN_AUTH_STORAGE_KEY = 'kopsyah_admin_auth';

export interface AdminAuthState {
  email: string;
  token: string;
  nama: string;
  role: string;
}

export async function handleJsonResponse<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (res.status === 403 || text.includes('403 Forbidden')) {
      const err: any = new Error(
        'Sesi autentikasi administrator diperlukan atau telah berakhir. Silakan login kembali dengan akun Admin/Super Admin.'
      );
      err.error_title = 'AKSES ADMINISTRATOR DIBUTUHKAN';
      throw err;
    }
    throw new Error(
      `Respon server bukan format JSON (${res.status} ${res.statusText}): ${text.slice(0, 100)}`
    );
  }
  const data = await res.json();
  if (!res.ok || data.success === false) {
    const err: any = new Error(data.message || `Permintaan gagal dengan status ${res.status}`);
    err.error_title = data.error_title;
    throw err;
  }
  return data;
}

export function getStoredAdminAuth(): AdminAuthState | null {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email) return parsed;
    }
  } catch {
    // ignore
  }

  // Also read from kopsyah_user, kopsyah_token, kopsyah_type in current session
  try {
    const userRaw = localStorage.getItem('kopsyah_user');
    const token = localStorage.getItem('kopsyah_token');
    const type = localStorage.getItem('kopsyah_type');
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (
        type === 'admin' ||
        u.role === 'SUPER_ADMIN' ||
        u.role === 'ADMIN_PEMILIHAN' ||
        u.role === 'ADMIN' ||
        u.email === 'andikadix862@gmail.com' ||
        u.email?.includes('admin')
      ) {
        return {
          email: u.email || 'admin@kopsyah-ykk.id',
          token: token || 'ADM_TOKEN_AUTH_SESSION',
          nama: u.nama || 'Administrator',
          role: u.role || 'SUPER_ADMIN'
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function setStoredAdminAuth(auth: AdminAuthState | null): void {
  if (!auth) {
    localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
    localStorage.removeItem('kopsyah_user');
    localStorage.removeItem('kopsyah_token');
    localStorage.removeItem('kopsyah_type');
    return;
  }
  localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(auth));
  localStorage.setItem('kopsyah_user', JSON.stringify({ email: auth.email, nama: auth.nama, role: auth.role }));
  localStorage.setItem('kopsyah_token', auth.token);
  localStorage.setItem('kopsyah_type', auth.role === 'SUPER_ADMIN' ? 'admin' : 'admin');
}

function getAdminRequestHeaders(adminEmail?: string): Record<string, string> {
  const auth = getStoredAdminAuth();
  const email = adminEmail || auth?.email || 'admin@kopsyah-ykk.id';
  return {
    'Content-Type': 'application/json',
    'X-Admin-Email': email,
    'X-Admin-Token': auth?.token || ''
  };
}

export const api = {
  // ---------------------------------------------------------------
  // MEMBER AUTHENTICATION & LOGIN FLOW
  // ---------------------------------------------------------------

  async login(email: string): Promise<LoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleJsonResponse<LoginResponse>(res);
  },

  async loginAdmin(email: string): Promise<LoginResponse> {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleJsonResponse<LoginResponse>(res);
  },

  // ---------------------------------------------------------------
  // VOTER DASHBOARD & VOTING
  // ---------------------------------------------------------------

  async getVoterDashboard(email: string): Promise<VoterDashboardResponse> {
    const res = await fetch(`/api/voter/dashboard?email=${encodeURIComponent(email)}`);
    return handleJsonResponse<VoterDashboardResponse>(res);
  },

  async submitVote(email: string, candidate_ids: string[]): Promise<SubmitVoteResponse> {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, candidate_ids })
    });
    return handleJsonResponse<SubmitVoteResponse>(res);
  },

  async verifyTransaction(transactionId: string): Promise<{ success: boolean; transaction_id: string; member_name: string; bagian: string; timestamp: string }> {
    const res = await fetch(`/api/verify?transaction_id=${encodeURIComponent(transactionId)}`);
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Members (CRUD + Bulk Import)
  // ---------------------------------------------------------------

  async getMembers(
    filter?: {
      search?: string;
      bagian_id?: string;
      status_memilih?: string;
      hak_pilih?: boolean;
    },
    adminEmail?: string
  ): Promise<{ success: boolean; members: Member[]; total: number }> {
    const params = new URLSearchParams();
    if (filter?.search) params.set('search', filter.search);
    if (filter?.bagian_id && filter.bagian_id !== 'ALL') params.set('bagian_id', filter.bagian_id);
    if (filter?.status_memilih && filter.status_memilih !== 'ALL') params.set('status_memilih', filter.status_memilih);
    if (filter?.hak_pilih !== undefined && filter.hak_pilih !== null) params.set('hak_pilih', String(filter.hak_pilih));
    const res = await fetch(`/api/admin/members?${params}`, {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async getMemberByEmail(email: string, adminEmail?: string): Promise<Member | null> {
    const res = await fetch(`/api/admin/members/${encodeURIComponent(email)}`, {
      headers: getAdminRequestHeaders(adminEmail)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.member || null;
  },

  async upsertMembers(members: Partial<Member>[], adminEmail?: string) {
    const res = await fetch('/api/admin/members/upsert', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ members, adminEmail })
    });
    return handleJsonResponse(res);
  },

  async toggleHakPilih(email: string, hak_pilih: boolean, adminEmail?: string) {
    const res = await fetch('/api/admin/members/toggle-hak-pilih', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ email, hak_pilih, adminEmail })
    });
    return handleJsonResponse(res);
  },

  async deleteMember(email: string, adminEmail?: string): Promise<{ success: boolean; message: string; memberName?: string }> {
    const res = await fetch(`/api/admin/members/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ adminEmail })
    });
    return handleJsonResponse(res);
  },

  async reEvaluateMembersPension(adminEmail?: string) {
    const res = await fetch('/api/admin/members/re-evaluate', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse<{ success: boolean; total: number; warnings: number; eligible: number; message: string }>(res);
  },

  async resetMemberStatus(identifierOrEmail: string, reason?: string, adminEmail?: string, adminPassword?: string) {
    const res = await fetch('/api/admin/members/reset-status', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ email: identifierOrEmail, identifier: identifierOrEmail, reason, adminEmail, adminPassword })
    });
    return handleJsonResponse<{ success: boolean; message: string; memberName?: string }>(res);
  },

  async resetAllVotes(adminPassword?: string, adminEmail?: string): Promise<{ success: boolean; message: string; totalVotesReset?: number; totalMembersReset?: number }> {
    const res = await fetch('/api/admin/reset-votes', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ adminPassword, adminEmail })
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Divisions
  // ---------------------------------------------------------------

  async getDivisions(adminEmail?: string): Promise<{ success: boolean; divisions: Division[] }> {
    const res = await fetch('/api/admin/divisions', {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async upsertDivision(division: Partial<Division>, adminEmail?: string) {
    const res = await fetch('/api/admin/divisions', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify(division)
    });
    return handleJsonResponse(res);
  },

  async deleteDivision(bagian_id: string, adminEmail?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/divisions/${encodeURIComponent(bagian_id)}`, {
      method: 'DELETE',
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Candidates
  // ---------------------------------------------------------------

  async getCandidates(bagian_id?: string, adminEmail?: string): Promise<{ success: boolean; candidates: Candidate[] }> {
    const url = bagian_id ? `/api/admin/candidates?bagian_id=${encodeURIComponent(bagian_id)}` : '/api/admin/candidates';
    const res = await fetch(url, {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async saveCandidate(candidate: Partial<Candidate>, adminEmail?: string) {
    const res = await fetch('/api/admin/candidates', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify(candidate)
    });
    return handleJsonResponse(res);
  },

  async deleteCandidate(id: string, adminEmail?: string) {
    const res = await fetch(`/api/admin/candidates/${id}?adminEmail=${encodeURIComponent(adminEmail || 'admin@kopsyah-ykk.id')}`, {
      method: 'DELETE',
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Election Config
  // ---------------------------------------------------------------

  async getConfig(adminEmail?: string): Promise<{ success: boolean; config: ElectionConfig }> {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        return await handleJsonResponse<{ success: boolean; config: ElectionConfig }>(res);
      }
    } catch {
      // fallback to /api/admin/config
    }
    const res = await fetch('/api/admin/config', {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async updateConfig(newConfig: Partial<ElectionConfig>, adminEmail?: string): Promise<ElectionConfig> {
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify(newConfig)
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Dashboard & Results
  // ---------------------------------------------------------------

  async getDashboard(adminEmail?: string): Promise<{ success: boolean; stats: DashboardStats }> {
    const res = await fetch('/api/admin/dashboard', {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async getResults(adminEmail?: string): Promise<{ success: boolean; results: DivisionResult[] }> {
    const res = await fetch('/api/admin/results', {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async resolveTieBreak(
    tieBreakId: string,
    winner_ids: string[],
    adminEmail: string,
    reason: string
  ): Promise<{ success: boolean; tieBreakId: string }> {
    const res = await fetch('/api/admin/tie-break', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail),
      body: JSON.stringify({ tieBreakId, winner_ids, adminEmail, reason })
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: Votes & Audit Logs
  // ---------------------------------------------------------------

  async getVotes(bagian_id?: string, adminEmail?: string): Promise<{ success: boolean; votes: any[] }> {
    const url = bagian_id ? `/api/admin/votes?bagian_id=${encodeURIComponent(bagian_id)}` : '/api/admin/votes';
    const res = await fetch(url, {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async getAuditLogs(params?: { limit?: number; offset?: number; activity?: string }, adminEmail?: string): Promise<{ success: boolean; logs: AuditLog[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.activity) q.set('activity', params.activity);
    const res = await fetch(`/api/admin/audit-logs?${q}`, {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // ADMIN: System Utilities
  // ---------------------------------------------------------------

  async resetToSeed(adminEmail?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/reset-db-seed', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async clearDummyData(adminEmail?: string): Promise<{ success: boolean; message: string; details: any }> {
    const res = await fetch('/api/admin/clear-dummy-data', {
      method: 'POST',
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  async runTests(adminEmail?: string): Promise<{ success: boolean; testReport: TestResultItem[] }> {
    const res = await fetch('/api/admin/run-tests', {
      headers: getAdminRequestHeaders(adminEmail)
    });
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // PUBLIC: Health & Config
  // ---------------------------------------------------------------

  async getHealth(): Promise<{ success: boolean; status: string; system: string }> {
    const res = await fetch('/api/health');
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // PRINT / RECEIPT
  // ---------------------------------------------------------------

  async getVotingReceipt(transactionId: string): Promise<{ success: boolean; receipt: VotingReceiptData }> {
    const res = await fetch(`/api/receipt?transaction_id=${encodeURIComponent(transactionId)}`);
    return handleJsonResponse(res);
  },

  // ---------------------------------------------------------------
  // VALIDATE CANDIDATE PENSION ELIGIBILITY
  // ---------------------------------------------------------------

  async validateCandidatePension(candidate: Partial<Candidate>): Promise<{ success: boolean; eligible: boolean; reason: string }> {
    const res = await fetch('/api/admin/candidates/validate-pension', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate)
    });
    return handleJsonResponse(res);
  }
};

// Local Backup Helpers for Import Wizard
export function getLocalBackupMembers(): Partial<Member>[] {
  try {
    const raw = localStorage.getItem('import_members_backup');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveLocalBackupMembers(members: Partial<Member>[]) {
  try {
    localStorage.setItem('import_members_backup', JSON.stringify(members));
  } catch {}
}

export function clearLocalBackupMembers() {
  try { localStorage.removeItem('import_members_backup'); } catch {}
}

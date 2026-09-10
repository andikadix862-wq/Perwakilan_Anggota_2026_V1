/**
 * Database Service — Relational Tables (Primary)
 * Reads directly from Supabase PostgreSQL tables
 */

import { createClient } from '@supabase/supabase-js';
import type { Member, Division, Candidate, ElectionConfig, VoteRecord, AdminUser, DashboardStats } from '../src/types';

// Use server-side environment variables (no VITE_ prefix for service role key)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY || '';

// Diagnostic
if (!SUPABASE_URL) {
  console.error('[DatabaseService] ERROR: SUPABASE_URL is not configured');
}
if (!SUPABASE_KEY) {
  console.error('[DatabaseService] ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured');
  console.error('[DatabaseService]   Checked: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY');
} else {
  console.log('[DatabaseService] SERVICE_ROLE_KEY length:', SUPABASE_KEY.length, '(should be ~200)');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ===================== MEMBERS =====================

export async function getAllMembers(): Promise<Member[]> {
  const { data, error } = await supabase.from('members').select('*');
  if (error) throw error;
  return (data || []) as Member[];
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  const { data, error } = await supabase.from('members').select('*').eq('email', email.toLowerCase()).single();
  if (error) return null;
  return data as Member;
}

export async function upsertMember(member: Member): Promise<void> {
  const { error } = await supabase.from('members').upsert(member, { onConflict: 'email' });
  if (error) throw error;
}

export async function deleteMember(email: string): Promise<{ success: boolean; message?: string; memberName?: string }> {
  const memberEmail = email.toLowerCase();

  // Step 1: Get member data first (for audit log)
  const { data: member, error: memberError } = await supabase
    .from('members')
    .select('email, nama, nomor_anggota')
    .eq('email', memberEmail)
    .single();

  if (!member) {
    return { success: false, message: 'Anggota tidak ditemukan.' };
  }

  // Step 2: Delete votes first (FK constraint)
  const { error: voteError } = await supabase
    .from('votes')
    .delete()
    .eq('member_email', memberEmail);
  if (voteError) {
    console.error('Error deleting votes:', voteError);
  }

  // Step 3: Delete candidates (by nomor_anggota)
  const { error: candidateError } = await supabase
    .from('candidates')
    .delete()
    .eq('nomor_anggota', member.nomor_anggota);
  if (candidateError) {
    console.error('Error deleting candidates:', candidateError);
  }

  // Step 4: Delete member
  const { error: deleteError } = await supabase
    .from('members')
    .delete()
    .eq('email', memberEmail);

  if (deleteError) {
    throw new Error(`Gagal menghapus anggota: ${deleteError.message}`);
  }

  return { success: true, message: `Anggota ${member.nama} berhasil dihapus.` };
}

// ===================== CANDIDATES =====================

export async function getAllCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabase.from('candidates').select('*');
  if (error) throw error;
  return (data || []) as Candidate[];
}

export async function getCandidatesByDivision(bagian_id?: string): Promise<Candidate[]> {
  // Import db.ts to get fresh candidates from members
  const { getDatabase, syncCandidatesWithMembers } = await import('./db');
  const db = getDatabase();
  syncCandidatesWithMembers();
  
  // Filter by division and eligible status from fresh data
  let candidates = db.candidates || [];
  if (bagian_id) {
    candidates = candidates.filter(c => c.bagian_id === bagian_id);
  }
  // FILTER: Only eligible candidates (memenuhi_syarat = true)
  candidates = candidates.filter(c => c.memenuhi_syarat === true);
  
  return candidates as Candidate[];
}

// Sync candidates from dbState to Supabase (after re-evaluate)
export async function syncCandidatesToSupabase(candidates: Candidate[]): Promise<void> {
  console.log(`[syncCandidates] Syncing ${candidates.length} candidates to Supabase`);
  for (const c of candidates) {
    const { error } = await supabase.from('candidates').upsert(c, { onConflict: 'kandidat_id' });
    if (error) {
      console.error(`[syncCandidates] Error for ${c.kandidat_id}:`, error.message);
      throw error;
    }
  }
  console.log('[syncCandidates] Sync completed successfully');
}

// ===================== DIVISIONS =====================

export async function getAllDivisions(): Promise<Division[]> {
  const { data, error } = await supabase.from('divisions').select('*');
  if (error) throw error;
  return (data || []) as Division[];
}

// ===================== ADMINS =====================

export async function getAllAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabase.from('admins').select('*');
  if (error) throw error;
  return (data || []) as AdminUser[];
}

export async function getAdminByEmail(email: string): Promise<AdminUser | null> {
  const { data, error } = await supabase.from('admins').select('*').eq('email', email.toLowerCase()).single();
  if (error) return null;
  return data as AdminUser;
}

// ===================== CONFIG =====================

export async function getAllConfig(): Promise<ElectionConfig> {
  const { data, error } = await supabase.from('config').select('*');
  if (error) throw error;
  
  const config: Record<string, any> = {};
  (data || []).forEach((c: any) => { config[c.key] = c.value; });
  
  return config as ElectionConfig;
}

// ===================== VOTES =====================

export async function getAllVotes(): Promise<VoteRecord[]> {
  const { data, error } = await supabase.from('votes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as VoteRecord[];
}

export async function getVotesByDivision(bagian_id?: string): Promise<VoteRecord[]> {
  let query = supabase.from('votes').select('*').order('created_at', { ascending: false });
  if (bagian_id) {
    query = query.eq('division_id', bagian_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as VoteRecord[];
}

export async function getVoteByMember(member_email: string): Promise<VoteRecord | null> {
  const { data, error } = await supabase.from('votes').select('*').eq('member_email', member_email.toLowerCase()).single();
  if (error) return null;
  return data as VoteRecord;
}

export async function insertVote(vote: VoteRecord): Promise<void> {
  const { error } = await supabase.from('votes').insert(vote);
  if (error) throw error;
}

// ===================== STATS =====================

export async function getDashboardStats(): Promise<DashboardStats> {
  // Get counts from database
  const { count: totalMembers } = await supabase.from('members').select('*', { count: 'exact', head: true });
  const { count: votedMembers } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('status_memilih', 'SUDAH_MEMILIH');
  const { count: totalCandidates } = await supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('memenuhi_syarat', true);
  const { count: totalDivisions } = await supabase.from('divisions').select('*', { count: 'exact', head: true });
  const { count: totalVotes } = await supabase.from('votes').select('*', { count: 'exact', head: true });
  
  const total = totalMembers || 0;
  const voted = votedMembers || 0;
  const participationPercent = total > 0 ? Math.round((voted / total) * 100) : 0;
  
  // Get divisions with stats
  const divisions = await getAllDivisions();
  const divisionsSummary = await Promise.all(divisions.map(async (d) => {
    const { count: votedInDiv } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('division_id', d.bagian_id);
    const { count: membersInDiv } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('bagian_id', d.bagian_id);
    
    return {
      ...d,
      sudah_memilih: votedInDiv || 0,
      belum_memilih: (membersInDiv || 0) - (votedInDiv || 0),
      partisipasi_persen: membersInDiv > 0 ? Math.round(((votedInDiv || 0) / membersInDiv) * 100) : 0
    };
  }));
  
  // Get config
  const config = await getAllConfig();
  
  return {
    total_anggota: total,
    total_berhak_memilih: total, // Assuming all members can vote
    sudah_memilih: voted,
    belum_memilih: total - voted,
    partisipasi_persen: participationPercent,
    total_kandidat: totalCandidates || 0,
    total_bagian: totalDivisions || 0,
    total_kursi: divisions.reduce((sum, d) => sum + (d.kuota_perwakilan || 0), 0),
    voting_status: (config.voting_status || 'AKTIF') as any,
    divisions_summary: divisionsSummary
  };
}

// ===================== HELPERS =====================

export function isDatabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

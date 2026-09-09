/**
 * Database Service — Relational Tables (Primary)
 * Reads directly from Supabase PostgreSQL tables
 */

import { createClient } from '@supabase/supabase-js';
import type { Member, Division, Candidate, ElectionConfig, VoteRecord, AdminUser, DashboardStats } from '../src/types';

// Use SERVICE_ROLE_KEY to bypass RLS on all tables
const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY || '';

console.log('[DatabaseService] Initializing with SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('[DatabaseService] Initializing with SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'SET' : 'NOT SET');

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

export async function deleteMember(email: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('email', email.toLowerCase());
  if (error) throw error;
}

// ===================== CANDIDATES =====================

export async function getAllCandidates(): Promise<Candidate[]> {
  const { data, error } = await supabase.from('candidates').select('*');
  if (error) throw error;
  return (data || []) as Candidate[];
}

export async function getCandidatesByDivision(bagian_id?: string): Promise<Candidate[]> {
  const { data, error } = await supabase.from('candidates').select('*');
  if (error) throw error;
  if (!bagian_id) return data as Candidate[];
  return (data || []).filter((c: Candidate) => c.bagian_id === bagian_id) as Candidate[];
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

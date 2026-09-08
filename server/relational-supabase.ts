/**
 * Relational Supabase Adapter — Direct table access
 * Replaces system_state JSON blob with relational tables
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('[RelationalSupabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
  return _client;
}

// Members
export async function getAllMembers(): Promise<any[]> {
  const client = getClient();
  const { data, error } = await client.from('members').select('*');
  if (error) throw error;
  return data || [];
}

export async function getMemberByEmail(email: string): Promise<any | null> {
  const client = getClient();
  const { data, error } = await client.from('members').select('*').eq('email', email.toLowerCase()).single();
  if (error) return null;
  return data;
}

export async function upsertMember(member: any): Promise<void> {
  const client = getClient();
  const { error } = await client.from('members').upsert(member, { onConflict: 'email' });
  if (error) throw error;
}

export async function deleteMember(email: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('members').delete().eq('email', email.toLowerCase());
  if (error) throw error;
}

// Candidates
export async function getAllCandidates(): Promise<any[]> {
  const client = getClient();
  const { data, error } = await client.from('candidates').select('*');
  if (error) throw error;
  return data || [];
}

export async function getCandidatesByDivision(bagian_id?: string): Promise<any[]> {
  const client = getClient();
  let query = client.from('candidates').select('*');
  if (bagian_id) {
    query = query.eq('bagian_id', bagian_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Divisions
export async function getAllDivisions(): Promise<any[]> {
  const client = getClient();
  const { data, error } = await client.from('divisions').select('*');
  if (error) throw error;
  return data || [];
}

export async function upsertDivision(division: any): Promise<void> {
  const client = getClient();
  const { error } = await client.from('divisions').upsert(division, { onConflict: 'bagian_id' });
  if (error) throw error;
}

export async function deleteDivision(bagian_id: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('divisions').delete().eq('bagian_id', bagian_id);
  if (error) throw error;
}

// Admins
export async function getAllAdmins(): Promise<any[]> {
  const client = getClient();
  const { data, error } = await client.from('admins').select('*');
  if (error) throw error;
  return data || [];
}

export async function getAdminByEmail(email: string): Promise<any | null> {
  const client = getClient();
  const { data, error } = await client.from('admins').select('*').eq('email', email.toLowerCase()).single();
  if (error) return null;
  return data;
}

export async function upsertAdmin(admin: any): Promise<void> {
  const client = getClient();
  const { error } = await client.from('admins').upsert(admin, { onConflict: 'email' });
  if (error) throw error;
}

// Config
export async function getConfig(key: string): Promise<string | null> {
  const client = getClient();
  const { data, error } = await client.from('config').select('value').eq('key', key).single();
  if (error) return null;
  return data?.value || null;
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const client = getClient();
  const { data, error } = await client.from('config').select('*');
  if (error) throw error;
  const config: Record<string, string> = {};
  (data || []).forEach((c: any) => { config[c.key] = c.value; });
  return config;
}

export async function upsertConfig(key: string, value: string): Promise<void> {
  const client = getClient();
  const { error } = await client.from('config').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}

// Votes
export async function getAllVotes(): Promise<any[]> {
  const client = getClient();
  const { data, error } = await client.from('votes').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVotesByDivision(bagian_id?: string): Promise<any[]> {
  const client = getClient();
  let query = client.from('votes').select('*');
  if (bagian_id) {
    query = query.eq('division_id', bagian_id);
  }
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVoteByMember(member_email: string): Promise<any | null> {
  const client = getClient();
  const { data, error } = await client.from('votes').select('*').eq('member_email', member_email.toLowerCase()).single();
  if (error) return null;
  return data;
}

export async function insertVote(vote: any): Promise<void> {
  const client = getClient();
  const { error } = await client.from('votes').insert(vote);
  if (error) throw error;
}

export async function countVotes(): Promise<number> {
  const client = getClient();
  const { count, error } = await client.from('votes').select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

export async function countVotesByDivision(bagian_id: string): Promise<number> {
  const client = getClient();
  const { count, error } = await client.from('votes').select('*', { count: 'exact', head: true }).eq('division_id', bagian_id);
  if (error) return 0;
  return count || 0;
}

// Stats
export async function getMemberCount(): Promise<number> {
  const client = getClient();
  const { count, error } = await client.from('members').select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

export async function getVotedMemberCount(): Promise<number> {
  const client = getClient();
  const { count, error } = await client.from('members').select('*', { count: 'exact', head: true }).eq('status_memilih', 'SUDAH_MEMILIH');
  if (error) return 0;
  return count || 0;
}

export async function getEligibleCandidateCount(): Promise<number> {
  const client = getClient();
  const { count, error } = await client.from('candidates').select('*', { count: 'exact', head: true }).eq('memenuhi_syarat', true);
  if (error) return 0;
  return count || 0;
}

export function isRelationalSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

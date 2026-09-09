/**
 * Database Relational Init — Loads from Supabase relational tables
 * This is the PRIMARY initialization for production voting
 */

import { createClient } from '@supabase/supabase-js';
import type { DatabaseState, Member, Candidate, Division, AdminUser, ElectionConfig } from '../src/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

/**
 * Initialize database state from relational tables
 * This replaces the old system_state loading for production
 */
export async function initializeDatabaseFromRelational(): Promise<DatabaseState> {
  console.log('[RelationalInit] Loading from Supabase relational tables...');
  
  // Load all tables in parallel
  const [membersRes, candidatesRes, divisionsRes, adminsRes, configRes] = await Promise.all([
    supabase.from('members').select('*'),
    supabase.from('candidates').select('*'),
    supabase.from('divisions').select('*'),
    supabase.from('admins').select('*'),
    supabase.from('config').select('*')
  ]);
  
  if (membersRes.error) {
    throw new Error(`Failed to load members: ${membersRes.error.message}`);
  }
  if (candidatesRes.error) {
    throw new Error(`Failed to load candidates: ${candidatesRes.error.message}`);
  }
  if (divisionsRes.error) {
    throw new Error(`Failed to load divisions: ${divisionsRes.error.message}`);
  }
  if (adminsRes.error) {
    throw new Error(`Failed to load admins: ${adminsRes.error.message}`);
  }
  if (configRes.error) {
    throw new Error(`Failed to load config: ${configRes.error.message}`);
  }
  
  const members = membersRes.data as Member[] || [];
  const candidates = candidatesRes.data as Candidate[] || [];
  const divisions = divisionsRes.data as Division[] || [];
  const admins = adminsRes.data as AdminUser[] || [];
  
  // Convert config rows to key-value map
  const configMap: Record<string, any> = {};
  configRes.data?.forEach(row => {
    configMap[row.key] = row.value;
  });
  
  const config = {
    nama_sistem: configMap.nama_sistem || 'Sistem Pemilihan Anggota Perwakilan',
    periode_pemilihan: configMap.periode_pemilihan || '2026-2027',
    organisasi: configMap.organisasi || 'KOPSYAH YKK AP Indonesia',
    voting_status: configMap.voting_status || 'AKTIF',
    voting_start: configMap.voting_start || '',
    voting_end: configMap.voting_end || '',
    ratio_anggota_perwakilan: configMap.ratio_anggota_perwakilan || 10,
    election_type: configMap.election_type || 'PEMILIHAN_PERWAKILAN'
  } as ElectionConfig;
  
  console.log(`[RelationalInit] Loaded: ${members.length} members, ${candidates.length} candidates, ${divisions.length} divisions, ${admins.length} admins`);
  
  return {
    members,
    candidates,
    divisions,
    admins,
    config,
    votes: [], // Votes loaded separately via database-service
    auditLogs: [],
    tieBreaks: []
  };
}

/**
 * Check if relational tables are properly initialized
 */
export async function isRelationalDatabaseReady(): Promise<boolean> {
  try {
    const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
    return (memberCount || 0) > 0;
  } catch {
    return false;
  }
}
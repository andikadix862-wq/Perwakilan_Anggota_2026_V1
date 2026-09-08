/**
 * Database Adapter — Hybrid approach
 * Primary: system_state JSON blob (proven working)
 * Secondary: Relational tables (for future migration)
 * 
 * Architecture:
 * - All writes go to system_state
 * - Periodic sync to relational tables
 * - Fallback to relational tables if system_state unavailable
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadDbFromSupabase, saveDbToSupabase } from './supabase-adapter';
import { Member, Division, Candidate, ElectionConfig, VoteRecord, AdminUser, AuditLog, TieBreakDecision } from '../src/types';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

// ===================== SYSTEM_STATE (PRIMARY) =====================

export async function getDatabaseState(): Promise<any | null> {
  return await loadDbFromSupabase();
}

export async function saveDatabaseState(state: any): Promise<void> {
  await saveDbToSupabase(state);
}

// ===================== RELATIONAL TABLES (SECONDARY) =====================

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('[DBAdapter] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
  return _client;
}

// Members
export async function syncMembersToTable(members: Member[]): Promise<void> {
  try {
    const client = getClient();
    for (const m of members) {
      await client.from('members').upsert(m, { onConflict: 'email' });
    }
  } catch (err) {
    console.error('[DBAdapter] syncMembersToTable error:', err);
  }
}

export async function getMembersFromTable(): Promise<Member[]> {
  try {
    const client = getClient();
    const { data, error } = await client.from('members').select('*');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[DBAdapter] getMembersFromTable error:', err);
    return [];
  }
}

// Candidates
export async function syncCandidatesToTable(candidates: Candidate[]): Promise<void> {
  try {
    const client = getClient();
    for (const c of candidates) {
      await client.from('candidates').upsert(c, { onConflict: 'kandidat_id' });
    }
  } catch (err) {
    console.error('[DBAdapter] syncCandidatesToTable error:', err);
  }
}

// Divisions
export async function syncDivisionsToTable(divisions: Division[]): Promise<void> {
  try {
    const client = getClient();
    for (const d of divisions) {
      await client.from('divisions').upsert(d, { onConflict: 'bagian_id' });
    }
  } catch (err) {
    console.error('[DBAdapter] syncDivisionsToTable error:', err);
  }
}

// Admins
export async function syncAdminsToTable(admins: AdminUser[]): Promise<void> {
  try {
    const client = getClient();
    for (const a of admins) {
      await client.from('admins').upsert(a, { onConflict: 'email' });
    }
  } catch (err) {
    console.error('[DBAdapter] syncAdminsToTable error:', err);
  }
}

// Votes
export async function syncVotesToTable(votes: VoteRecord[]): Promise<void> {
  try {
    const client = getClient();
    for (const v of votes) {
      await client.from('votes').upsert(v, { onConflict: 'member_email' });
    }
  } catch (err) {
    console.error('[DBAdapter] syncVotesToTable error:', err);
  }
}

// Config
export async function syncConfigToTable(config: ElectionConfig): Promise<void> {
  try {
    const client = getClient();
    // Save config as key-value pairs
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        await client.from('config').upsert({ key, value: String(value) }, { onConflict: 'key' });
      }
    }
  } catch (err) {
    console.error('[DBAdapter] syncConfigToTable error:', err);
  }
}

// Full sync
export async function syncAllToTables(dbState: any): Promise<void> {
  try {
    await syncMembersToTable(dbState.members || []);
    await syncCandidatesToTable(dbState.candidates || []);
    await syncDivisionsToTable(dbState.divisions || []);
    await syncAdminsToTable(dbState.admins || []);
    await syncVotesToTable(dbState.votes || []);
    await syncConfigToTable(dbState.config || {});
    console.log('[DBAdapter] Full sync completed');
  } catch (err) {
    console.error('[DBAdapter] Full sync error:', err);
  }
}

// ===================== FALLBACK LOADER =====================

/**
 * Load database with fallback chain:
 * 1. Try system_state (primary)
 * 2. Try relational tables (secondary)
 * 3. Return seed data (fallback)
 */
export async function getDatabaseWithFallback(): Promise<any> {
  // Try system_state first
  const state = await getDatabaseState();
  if (state && state.members?.length > 0) {
    console.log('[DBAdapter] Loaded from system_state');
    return state;
  }
  
  // Fallback to relational tables
  console.log('[DBAdapter] system_state empty, trying relational tables...');
  try {
    const members = await getMembersFromTable();
    if (members.length > 0) {
      console.log('[DBAdapter] Loaded from relational tables');
      // Reconstruct DatabaseState from tables
      const client = getClient();
      
      const { data: candidates } = await client.from('candidates').select('*');
      const { data: divisions } = await client.from('divisions').select('*');
      const { data: admins } = await client.from('admins').select('*');
      const { data: votes } = await client.from('votes').select('*');
      const { data: configRows } = await client.from('config').select('*');
      
      const config: any = {};
      (configRows || []).forEach((c: any) => { config[c.key] = c.value; });
      
      return {
        config,
        divisions: divisions || [],
        members,
        candidates: candidates || [],
        votes: votes || [],
        admins: admins || [],
        auditLogs: [],
        tieBreaks: []
      };
    }
  } catch (err) {
    console.error('[DBAdapter] Relational table load error:', err);
  }
  
  // Last resort: return null (will use seed data)
  console.log('[DBAdapter] No data found, will use seed data');
  return null;
}

// ===================== HEALTH CHECK =====================

export async function checkDatabaseHealth(): Promise<{
  systemState: boolean;
  membersTable: boolean;
  candidatesTable: boolean;
  divisionsTable: boolean;
  adminsTable: boolean;
  votesTable: boolean;
}> {
  const client = getClient();
  
  try {
    const { data: ss } = await client.from('system_state').select('id').limit(1);
    const systemState = ss?.length > 0;
    
    const { count: mCount } = await client.from('members').select('*', { count: 'exact', head: true });
    const membersTable = mCount > 0;
    
    const { count: cCount } = await client.from('candidates').select('*', { count: 'exact', head: true });
    const candidatesTable = cCount > 0;
    
    const { count: dCount } = await client.from('divisions').select('*', { count: 'exact', head: true });
    const divisionsTable = dCount > 0;
    
    const { count: aCount } = await client.from('admins').select('*', { count: 'exact', head: true });
    const adminsTable = aCount > 0;
    
    const { count: vCount } = await client.from('votes').select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }));
    const votesTable = vCount > 0;
    
    return { systemState, membersTable, candidatesTable, divisionsTable, adminsTable, votesTable };
  } catch (err) {
    console.error('[DBAdapter] Health check error:', err);
    return { systemState: false, membersTable: false, candidatesTable: false, divisionsTable: false, adminsTable: false, votesTable: false };
  }
}

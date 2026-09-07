/**
 * Supabase Adapter — replaces filesystem JSON persistence.
 * Stores the entire election DB state as a single JSON blob row.
 * Table: system_state (id TEXT PK, json_blob TEXT, updated_at TIMESTAMPTZ)
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

const ROW_ID = 'election_db_v1';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('[SupabaseAdapter] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars.');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
  return _client;
}

export async function loadDbFromSupabase(): Promise<any | null> {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('system_state')
      .select('json_blob')
      .eq('id', ROW_ID)
      .single();
    if (error || !data) return null;
    return JSON.parse(data.json_blob as string);
  } catch (err) {
    console.error('[SupabaseAdapter] load error:', err);
    return null;
  }
}

export async function saveDbToSupabase(state: any): Promise<void> {
  try {
    const client = getClient();
    const json_blob = JSON.stringify(state);
    const { error } = await client
      .from('system_state')
      .upsert({ id: ROW_ID, json_blob, updated_at: new Date().toISOString() });
    if (error) console.error('[SupabaseAdapter] save error:', error);
  } catch (err) {
    console.error('[SupabaseAdapter] save exception:', err);
  }
}

export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

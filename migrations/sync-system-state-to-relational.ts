/**
 * Database Migration Script
 * Syncs data from system_state to relational tables
 * Run this ONCE to migrate all existing data
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function syncMembersFromSystemState() {
  // Get system_state
  const { data: ssData, error: ssError } = await supabase
    .from('system_state')
    .select('json_blob')
    .single();

  if (ssError || !ssData) {
    console.error('Failed to load system_state:', ssError?.message);
    return;
  }

  const state = JSON.parse(ssData.json_blob);
  const members = state.members || [];

  console.log(`[Migration] Found ${members.length} members in system_state`);

  // Upsert each member
  for (const member of members) {
    const { error } = await supabase
      .from('members')
      .upsert(member, { onConflict: 'email' });

    if (error) {
      console.error(`Failed to upsert member ${member.email}:`, error.message);
    }
  }

  console.log('[Migration] Members synced from system_state to relational table');
}

async function main() {
  console.log('[Migration] Starting database sync...');
  
  // Check current counts
  const { count: currentMembers } = await supabase.from('members').select('*', { count: 'exact', head: true });
  console.log(`[Migration] Current members in DB: ${currentMembers}`);

  await syncMembersFromSystemState();

  // Verify
  const { count: finalMembers } = await supabase.from('members').select('*', { count: 'exact', head: true });
  console.log(`[Migration] Final members in DB: ${finalMembers}`);
}

main().catch(console.error);
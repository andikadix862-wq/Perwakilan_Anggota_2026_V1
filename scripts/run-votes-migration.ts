/**
 * Run Votes Table Migration
 * This script executes the migration SQL against Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.vercel.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  console.log('=== VOTES TABLE MIGRATION ===\n');

  // Read migration SQL
  const sql = readFileSync('migrations/004_final_votes_table.sql', 'utf8');

  // Check if table already exists
  const { data: existingTable } = await sb.from('pg_tables').select('tablename').eq('tablename', 'votes').single();

  if (existingTable) {
    console.log('✓ Votes table already exists');
    console.log('  Skipping migration (idempotent)\n');
  } else {
    console.log('→ Creating votes table...');

    // Execute migration via rpc (Supabase doesn't allow direct SQL execution via REST)
    // We'll need to use the Supabase CLI or manual SQL Editor
    console.log('⚠ Direct SQL execution not available via REST API');
    console.log('  Please run the migration manually in Supabase SQL Editor:\n');
    console.log('  URL: https://ieypvsokwksprwvckaqw.supabase.co/sql/new');
    console.log('  File: migrations/004_final_votes_table.sql\n');
  }
}

runMigration().catch(console.error);
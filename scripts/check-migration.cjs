/**
 * Execute Votes Table Migration via Supabase API
 */

require('dotenv').config({ path: '.env.vercel.local' });

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function checkVotesTable() {
  // Try to query votes table to see if it exists
  const { data, error } = await supabase.from('votes').select('*').limit(1);
  
  if (error) {
    if (error.code === 'PGRST301' || error.message?.includes('does not exist')) {
      console.log('⚠ Votes table does NOT exist yet');
      return false;
    }
    console.error('Error checking table:', error.message);
    return false;
  }
  
  console.log('✓ Votes table exists');
  console.log('  Row count:', data?.length || 0);
  return true;
}

async function runMigration() {
  console.log('=== VOTES TABLE MIGRATION SCRIPT ===\n');
  
  // Check if table already exists
  const exists = await checkVotesTable();
  
  if (exists) {
    console.log('\nMigration already completed. Skipping.');
    return;
  }
  
  console.log('\n⚠ Cannot execute DDL via REST API');
  console.log('\nPlease run this SQL manually in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/ieypvsokwksprwvckaqw/sql/new\n');
  
  // Read and display the migration SQL
  const sql = fs.readFileSync('migrations/004_final_votes_table.sql', 'utf8');
  console.log('=== MIGRATION SQL ===\n');
  console.log(sql);
  console.log('\n=== END MIGRATION SQL ===');
}

runMigration().catch(console.error);
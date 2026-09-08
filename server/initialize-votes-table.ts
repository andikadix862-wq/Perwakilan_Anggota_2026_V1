/**
 * Initialize Votes Table - Creates votes table if it doesn't exist
 * Run this once on startup
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY || '';

export async function initializeVotesTable(): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[initializeVotesTable] Supabase credentials missing');
    return false;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });

    console.log('[initializeVotesTable] Checking votes table...');
    
    // Check if votes table exists
    const { error: checkError } = await supabase.from('votes').select('*').limit(1);
    
    if (checkError) {
      console.log('[initializeVotesTable] Votes table does not exist');
      console.log('[initializeVotesTable] You need to create votes table manually in Supabase SQL Editor:');
      console.log(`
        CREATE TABLE IF NOT EXISTS votes (
          vote_id TEXT UNIQUE NOT NULL,
          member_email TEXT NOT NULL,
          candidate_ids TEXT[] NOT NULL,
          division_id TEXT NOT NULL,
          user_agent TEXT,
          status TEXT DEFAULT 'VALID',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(member_email)
        );
      `);
      return false;
    }
    
    console.log('[initializeVotesTable] Votes table exists');
    return true;
  } catch (error) {
    console.error('[initializeVotesTable] Error:', error);
    return false;
  }
}

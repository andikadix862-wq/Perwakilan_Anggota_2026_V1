/**
 * Vote Service FIXED — 1 Member = 1 Candidate
 * Strictly follows business rules with database constraints
 */

import { createClient } from '@supabase/supabase-js';
import type { VoteRecord, Member, Candidate } from '../src/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ===================== VOTES TABLE MANAGEMENT =====================

export async function createCorrectVotesTable(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS votes (
          vote_id TEXT PRIMARY KEY,
          member_email TEXT NOT NULL,
          candidate_id TEXT NOT NULL,
          division_id TEXT NOT NULL,
          user_agent TEXT,
          status TEXT DEFAULT 'VALID',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(member_email)
        );
      `
    }).catch(() => ({ error: new Error('RPC not available') }));
    
    if (error) {
      console.log('[VoteService] Votes table check:', error.message);
      const { error: checkError } = await supabase.from('votes').select('*').limit(1);
      if (checkError) return false;
    }
    
    return true;
  } catch (err) {
    console.error('[VoteService] Error:', err);
    return false;
  }
}

// ===================== VOTE SUBMISSION (CORRECT) =====================

export interface VoteSubmissionParams {
  email: string;
  candidate_id: string;  // SINGLE candidate, not array
  ip_or_ua: string;
}

export interface VoteResult {
  success: boolean;
  message: string;
  vote_id?: string;
}

export async function processCorrectVoteSubmission(params: VoteSubmissionParams): Promise<VoteResult> {
  try {
    const { email, candidate_id, ip_or_ua } = params;
    
    // 1. Validate member exists
    const member = await getMemberByEmail(email);
    if (!member) {
      return {
        success: false,
        message: 'Anggota tidak ditemukan atau tidak terdaftar.'
      };
    }
    
    // 2. Validate member division exists
    if (!member.bagian_id) {
      return {
        success: false,
        message: 'Anggota tidak terdaftar di divisi manapun.'
      };
    }
    
    // 3. Check if member has already voted
    const existingVote = await getVoteByMember(email);
    if (existingVote) {
      return {
        success: false,
        message: 'Anda sudah memberikan suara sebelumnya.'
      };
    }
    
    // 4. Validate candidate exists
    const candidate = await getCandidateById(candidate_id);
    if (!candidate) {
      return {
        success: false,
        message: 'Kandidat tidak ditemukan.'
      };
    }
    
    // 5. CRITICAL: Validate candidate belongs to member's division
    if (candidate.bagian_id !== member.bagian_id) {
      return {
        success: false,
        message: 'Kandidat tidak berasal dari divisi Anda.'
      };
    }
    
    // 6. Create vote record with SINGLE candidate
    const vote_id = `VOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const voteData = {
      vote_id,
      member_email: email.toLowerCase(),
      candidate_id,  // SINGLE candidate_id, not array
      division_id: member.bagian_id,
      user_agent: ip_or_ua,
      status: 'VALID',
      created_at: new Date().toISOString()
    };
    
    // 7. Insert vote with database UNIQUE(member_email) as final protection
    const { error } = await supabase.from('votes').insert(voteData);
    if (error) {
      if (error.code === '23505') { // Unique violation
        return {
          success: false,
          message: 'Anda sudah memberikan suara sebelumnya (database constraint).'
        };
      }
      throw error;
    }
    
    // 8. Update member voting status
    const { error: updateError } = await supabase.from('members')
      .update({ status_memilih: 'SUDAH_MEMILIH' })
      .eq('email', email.toLowerCase());
    
    if (updateError) {
      console.error('[VoteService] Failed to update member voting status:', updateError);
    }
    
    return {
      success: true,
      message: 'Suara Anda telah berhasil direkam.',
      vote_id
    };
  } catch (err: any) {
    console.error('[VoteService] Vote submission error:', err);
    return {
      success: false,
      message: 'Terjadi kesalahan saat memproses suara Anda. Silakan coba lagi.'
    };
  }
}

// ===================== HELPER FUNCTIONS =====================

export async function getVoteByMember(email: string): Promise<VoteRecord | null> {
  try {
    const { data, error } = await supabase.from('votes')
      .select('*')
      .eq('member_email', email.toLowerCase())
      .single();
    
    if (error) return null;
    return data as VoteRecord;
  } catch (err) {
    console.error('[VoteService] Error getting vote by member:', err);
    return null;
  }
}

async function getMemberByEmail(email: string): Promise<Member | null> {
  try {
    const { data, error } = await supabase.from('members')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error) return null;
    return data as Member;
  } catch (err) {
    console.error('[VoteService] Error getting member by email:', err);
    return null;
  }
}

async function getCandidateById(candidate_id: string): Promise<Candidate | null> {
  try {
    const { data, error } = await supabase.from('candidates')
      .select('*')
      .eq('kandidat_id', candidate_id)
      .single();
    
    if (error) return null;
    return data as Candidate;
  } catch (err) {
    console.error('[VoteService] Error getting candidate by id:', err);
    return null;
  }
}

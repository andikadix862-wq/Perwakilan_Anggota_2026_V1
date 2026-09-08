/**
 * Vote Service — Relational Table Voting
 * Handles voting with database constraints and realtime events
 */

import { createClient } from '@supabase/supabase-js';
import type { VoteRecord, Member, Candidate } from '../src/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ===================== VOTES TABLE MANAGEMENT =====================

export async function createVotesTable(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS votes (
          id SERIAL PRIMARY KEY,
          vote_id TEXT UNIQUE NOT NULL,
          member_email TEXT NOT NULL,
          candidate_ids TEXT[] NOT NULL,
          division_id TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          status TEXT DEFAULT 'VALID',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(member_email)
        );
      `
    }).catch(() => ({ error: new Error('RPC not available') }));
    
    if (error) {
      console.log('Votes table exists or cannot be created via RPC:', error.message);
      // Check if table exists
      const { error: checkError } = await supabase.from('votes').select('*').limit(1);
      if (checkError) {
        console.log('Votes table does not exist');
        return false;
      }
    }
    
    // Try to enable realtime
    try {
      await supabase.rpc('exec_sql', {
        query: 'ALTER PUBLICATION supabase_realtime ADD TABLE votes;'
      });
    } catch (e) {
      console.log('Cannot enable realtime via RPC');
    }
    
    return true;
  } catch (err) {
    console.error('Error creating votes table:', err);
    return false;
  }
}

// ===================== VOTE SUBMISSION =====================

export interface VoteSubmissionParams {
  email: string;
  candidate_ids: string[];
  ip_or_ua: string;
}

export interface VoteResult {
  success: boolean;
  message: string;
  vote_id?: string;
  transaction_id?: string;
}

export async function processVoteSubmission(params: VoteSubmissionParams): Promise<VoteResult> {
  try {
    const { email, candidate_ids, ip_or_ua } = params;
    
    // Validate email exists in members table
    const member = await getMemberByEmail(email);
    if (!member) {
      return {
        success: false,
        message: 'Anggota tidak ditemukan atau tidak terdaftar.'
      };
    }
    
    // Check if member has already voted
    const existingVote = await getVoteByMember(email);
    if (existingVote) {
      return {
        success: false,
        message: 'Anda sudah memberikan suara sebelumnya.'
      };
    }
    
    // Validate candidate_ids (must be at least 1)
    if (!candidate_ids || candidate_ids.length === 0) {
      return {
        success: false,
        message: 'Pilih minimal satu kandidat.'
      };
    }
    
    // Validate candidates exist
    const candidates = await getCandidatesByDivision(member.bagian_id);
    const candidateIdsSet = new Set(candidates.map(c => c.kandidat_id));
    const invalidCandidates = candidate_ids.filter(id => !candidateIdsSet.has(id));
    if (invalidCandidates.length > 0) {
      return {
        success: false,
        message: `Kandidat tidak valid: ${invalidCandidates.join(', ')}`
      };
    }
    
    // Create vote record
    const vote_id = `VOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const voteData = {
      vote_id,
      member_email: email.toLowerCase(),
      candidate_ids,
      division_id: member.bagian_id,
      user_agent: ip_or_ua,
      status: 'VALID',
      created_at: new Date().toISOString()
    };
    
    // Insert vote with transaction/atomic operation
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
    
    // Update member voting status
    const { error: updateError } = await supabase.from('members')
      .update({ status_memilih: 'SUDAH_MEMILIH' })
      .eq('email', email.toLowerCase());
    
    if (updateError) {
      console.error('Failed to update member voting status:', updateError);
    }
    
    // Trigger realtime event (if enabled)
    try {
      await supabase.channel('votes').send({
        type: 'broadcast',
        event: 'vote_submitted',
        payload: {
          vote_id,
          member_email: email,
          division_id: member.bagian_id,
          timestamp: new Date().toISOString()
        }
      });
    } catch (realtimeErr) {
      console.log('Realtime event not sent (channel may not be available)');
    }
    
    return {
      success: true,
      message: 'Suara Anda telah berhasil direkam.',
      vote_id,
      transaction_id: vote_id
    };
  } catch (err: any) {
    console.error('Vote submission error:', err);
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
    console.error('Error getting vote by member:', err);
    return null;
  }
}

export async function getAllVotesByDivision(division_id?: string): Promise<VoteRecord[]> {
  try {
    let query = supabase.from('votes').select('*');
    if (division_id) {
      query = query.eq('division_id', division_id);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return [];
    return (data || []) as VoteRecord[];
  } catch (err) {
    console.error('Error getting votes by division:', err);
    return [];
  }
}

export async function getVoteCount(): Promise<number> {
  try {
    const { count, error } = await supabase.from('votes').select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count || 0;
  } catch (err) {
    console.error('Error getting vote count:', err);
    return 0;
  }
}

export async function getVoteCountByDivision(division_id: string): Promise<number> {
  try {
    const { count, error } = await supabase.from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('division_id', division_id);
    if (error) return 0;
    return count || 0;
  } catch (err) {
    console.error('Error getting vote count by division:', err);
    return 0;
  }
}

// ===================== DATABASE HELPERS =====================

async function getMemberByEmail(email: string): Promise<Member | null> {
  try {
    const { data, error } = await supabase.from('members')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error) return null;
    return data as Member;
  } catch (err) {
    console.error('Error getting member by email:', err);
    return null;
  }
}

async function getCandidatesByDivision(division_id: string): Promise<Candidate[]> {
  try {
    const { data, error } = await supabase.from('candidates')
      .select('*')
      .eq('bagian_id', division_id);
    
    if (error) return [];
    return (data || []) as Candidate[];
  } catch (err) {
    console.error('Error getting candidates by division:', err);
    return [];
  }
}

// ===================== REALTIME SUBSCRIPTION =====================

export function subscribeToVotes(callback: (vote: any) => void): () => void {
  try {
    const channel = supabase.channel('votes');
    
    channel
      .on('broadcast', { event: 'vote_submitted' }, (payload) => {
        callback(payload.payload);
      })
      .subscribe();
    
    return () => {
      channel.unsubscribe();
    };
  } catch (err) {
    console.error('Error subscribing to votes:', err);
    return () => {};
  }
}

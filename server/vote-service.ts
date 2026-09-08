/**
 * Vote Service — Final Production Implementation
 * Business Rules:
 * - 1 Member = 1 Vote = 1 Candidate
 * - Candidate must be from member's division
 * - Division determined by backend (not frontend)
 * - Race condition protected by database UNIQUE constraint
 * - No system_state dependency
 */

import { createClient } from '@supabase/supabase-js';
import type { VoteRecord, Member, Candidate } from '../src/types';

const SUPABASE_URL = process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SUPABASE_SECRET_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

// ===================== VOTE SUBMISSION =====================

export interface VoteSubmissionParams {
  email: string;        // From authenticated session
  candidate_id: string; // Single candidate ID from frontend
  ip_or_ua: string;     // IP/User-Agent for audit
}

export interface VoteResult {
  success: boolean;
  message: string;
  vote_id?: string;
}

/**
 * Submit vote with full validation
 * Flow:
 * 1. Get member from email (authenticated user)
 * 2. Get member's division from members table
 * 3. Get candidate details including division
 * 4. Verify candidate belongs to member's division
 * 5. Check if member already voted (fast path)
 * 6. Insert vote with database UNIQUE constraint as final protection
 * 7. Update member status_memilih
 */
export async function submitVote(params: VoteSubmissionParams): Promise<VoteResult> {
  try {
    const { email, candidate_id, ip_or_ua } = params;
    const cleanEmail = email.trim().toLowerCase();

    // 1. GET MEMBER (backend lookup, not frontend trust)
    const member = await getMemberByEmail(cleanEmail);
    if (!member) {
      return { success: false, message: 'Anggota tidak ditemukan atau tidak terdaftar.' };
    }

    // 2. VALIDATE MEMBER HAS DIVISION
    if (!member.bagian_id) {
      return { success: false, message: 'Anggota tidak terdaftar di divisi manapun.' };
    }

    // 3. GET CANDIDATE DETAILS
    const candidate = await getCandidateById(candidate_id);
    if (!candidate) {
      return { success: false, message: 'Kandidat tidak ditemukan.' };
    }

    // 4. CRITICAL: DIVISION VALIDATION (backend enforced)
    if (candidate.bagian_id !== member.bagian_id) {
      return {
        success: false,
        message: `Kandidat tidak berasal dari divisi Anda (${member.nama_bagian}).`
      };
    }

    // 5. FAST PATH: Check if already voted (avoids race condition in most cases)
    const existingVote = await getVoteByMember(cleanEmail);
    if (existingVote) {
      return { success: false, message: 'Anda sudah melakukan voting sebelumnya.' };
    }

    // 6. CREATE VOTE RECORD (backend determines division)
    const vote_id = `VOTE-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const voteData = {
      vote_id,
      member_email: cleanEmail,
      candidate_id,              // SINGLE candidate_id
      division_id: member.bagian_id, // BACKEND DETERMINES DIVISION
      user_agent: ip_or_ua,
      status: 'VALID',
      created_at: new Date().toISOString()
    };

    // 7. INSERT WITH DATABASE UNIQUE CONSTRAINT (final race condition protection)
    const { error } = await supabase.from('votes').insert(voteData);
    if (error) {
      if (error.code === '23505') { // Unique violation on member_email
        return { success: false, message: 'Anda sudah melakukan voting sebelumnya.' };
      }
      if (error.code === '23503') { // Foreign key violation
        console.error('[VoteService] FK violation:', error.message);
        return { success: false, message: 'Data referensi tidak valid.' };
      }
      throw error;
    }

    // 8. UPDATE MEMBER STATUS (async, non-blocking)
    supabase.from('members')
      .update({ status_memilih: 'SUDAH_MEMILIH' })
      .eq('email', cleanEmail)
      .then(({ error: updateError }) => {
        if (updateError) console.error('[VoteService] Status update failed:', updateError);
      });

    // 9. EMIT REALTIME EVENT (fire-and-forget)
    try {
      const channel = supabase.channel('votes');
      channel.send({
        type: 'broadcast',
        event: 'vote_submitted',
        payload: { vote_id, member_email: cleanEmail, division_id: member.bagian_id }
      });
      channel.unsubscribe();
    } catch (realtimeErr) {
      console.log('[VoteService] Realtime event not sent:', realtimeErr.message);
    }

    return { success: true, message: 'Suara Anda telah berhasil direkam.', vote_id };

  } catch (err: any) {
    console.error('[VoteService] Vote submission error:', err);
    return { success: false, message: 'Terjadi kesalahan sistem. Silakan coba lagi.' };
  }
}

// ===================== HELPER FUNCTIONS =====================

async function getMemberByEmail(email: string): Promise<Member | null> {
  try {
    const { data, error } = await supabase.from('members')
      .select('email, nomor_anggota, nama, bagian_id, nama_bagian, status_memilih')
      .eq('email', email.toLowerCase())
      .single();
    if (error) return null;
    return data as Member;
  } catch { return null; }
}

async function getCandidateById(candidate_id: string): Promise<Candidate | null> {
  try {
    const { data, error } = await supabase.from('candidates')
      .select('kandidat_id, nama, bagian_id, status_kandidat')
      .eq('kandidat_id', candidate_id)
      .single();
    if (error) return null;
    return data as Candidate;
  } catch { return null; }
}

export async function getVoteByMember(email: string): Promise<VoteRecord | null> {
  try {
    const { data, error } = await supabase.from('votes')
      .select('*')
      .eq('member_email', email.toLowerCase())
      .single();
    if (error) return null;
    return data as VoteRecord;
  } catch { return null; }
}

// ===================== ADMIN QUERIES =====================

export async function getAllVotes(): Promise<VoteRecord[]> {
  const { data, error } = await supabase.from('votes')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as VoteRecord[];
}

export async function getVotesByDivision(division_id: string): Promise<VoteRecord[]> {
  const { data, error } = await supabase.from('votes')
    .select('*')
    .eq('division_id', division_id)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []) as VoteRecord[];
}

export async function getVoteCount(): Promise<number> {
  const { count, error } = await supabase.from('votes').select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count || 0;
}

export async function getVoteCountByDivision(division_id: string): Promise<number> {
  const { count, error } = await supabase.from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', division_id);
  if (error) return 0;
  return count || 0;
}

// ===================== REALTIME SUBSCRIPTION =====================

export function subscribeToVotes(onVote: (vote: VoteRecord) => void): () => void {
  const channel = supabase.channel('votes');
  
  channel
    .on('broadcast', { event: 'vote_submitted' }, (payload) => {
      // Payload contains: vote_id, member_email, division_id
      // For full vote details, refetch from database
      onVote(payload.payload as VoteRecord);
    })
    .subscribe();
  
  return () => channel.unsubscribe();
}

// For database changes (INSERT on votes table)
export function subscribeToVotesChanges(onVote: (vote: VoteRecord) => void): () => void {
  const channel = supabase.channel('votes_changes');
  
  channel
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'votes' },
      (payload) => onVote(payload.new as VoteRecord)
    )
    .subscribe();
  
  return () => channel.unsubscribe();
}
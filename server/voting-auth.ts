/**
 * Voting Authentication Middleware
 * Validates session tokens from Authorization header
 */

import { createClient } from '@supabase/supabase-js';
import { validateSessionToken, AuthenticatedMember } from './session-manager';

// Use service role key for server-side validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY || '';

console.log('[VotingAuth] Initializing with SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('[VotingAuth] Initializing with SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'SET (' + SUPABASE_KEY.length + ' chars)' : 'NOT SET');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export interface SessionValidationResult {
  success: boolean;
  member?: AuthenticatedMember;
  error?: string;
}

/**
 * Validate session token from Authorization header
 * Token format: Bearer <cryptographically_secure_token>
 */
export async function validateSession(authHeader: string | undefined): Promise<SessionValidationResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Invalid or missing authorization header' };
  }

  const token = authHeader.substring(7).trim();
  
  // Validate token and get email
  const { email, valid } = validateSessionToken(token);
  if (!valid || !email) {
    return { success: false, error: 'Invalid or expired session token' };
  }

  // Look up member details from database
  try {
    const { data: member, error } = await supabase.from('members')
      .select('email, nomor_anggota, nama, bagian_id, nama_bagian, status_memilih')
      .eq('email', email)
      .single();
    
    if (error || !member) {
      return { success: false, error: 'Member not found' };
    }
    
    return { success: true, member: member as AuthenticatedMember };
  } catch (err) {
    console.error('[Auth] Session validation error:', err);
    return { success: false, error: 'Session validation failed' };
  }
}

/**
 * Get member by email (for backward compatibility)
 */
export async function getMemberByEmail(email: string): Promise<AuthenticatedMember | null> {
  try {
    const { data: member, error } = await supabase.from('members')
      .select('email, nomor_anggota, nama, bagian_id, nama_bagian, status_memilih')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error || !member) {
      return null;
    }
    
    return member as AuthenticatedMember;
  } catch (err) {
    return null;
  }
}
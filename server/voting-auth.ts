/**
 * Voting Authentication Middleware
 * Validates member token from Authorization header
 */

import { createClient } from '@supabase/supabase-js';

// Use service role key for server-side validation
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY || '';

console.log('[VotingAuth] Initializing with SUPABASE_URL:', SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('[VotingAuth] Initializing with SERVICE_ROLE_KEY:', SUPABASE_KEY ? 'SET (' + SUPABASE_KEY.length + ' chars)' : 'NOT SET');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export interface AuthenticatedMember {
  email: string;
  nomor_anggota: string;
  nama: string;
  bagian_id: string;
  nama_bagian: string;
  status_memilih: string;
}

/**
 * Validate member token from Authorization header
 * Token format: Bearer <member_email> (for now, using email as token)
 * In production, this should be a JWT or secure session token
 */
export async function validateMemberToken(authHeader: string | undefined): Promise<AuthenticatedMember | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim(); // Remove "Bearer "
  
  // For now, token IS the email (after login validation)
  // In production, decode JWT or lookup session
  const email = token.toLowerCase();
  
  try {
    const { data: member, error } = await supabase.from('members')
      .select('email, nomor_anggota, nama, bagian_id, nama_bagian, status_memilih')
      .eq('email', email)
      .single();
    
    if (error || !member) {
      return null;
    }
    
    return member as AuthenticatedMember;
  } catch (err) {
    console.error('[Auth] Token validation error:', err);
    return null;
  }
}

/**
 * Alternative: Validate using email + token from login
 * If login returns a token, use that for validation
 */
export async function validateLoginToken(token: string): Promise<AuthenticatedMember | null> {
  if (!token) return null;
  
  // Token format: member_email (from login response)
  // In production: decode JWT or validate session
  return validateMemberToken(`Bearer ${token}`);
}

/**
 * Get member by email (for backward compatibility during transition)
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
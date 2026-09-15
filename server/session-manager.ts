/**
 * Session Token Management
 * Generates and validates cryptographically secure JWT tokens (stateless for serverless)
 */

import crypto from 'crypto';

// Secret key for signing tokens (should be in env var in production)
const JWT_SECRET = process.env.SESSION_SECRET || 'kopsyah-ykk-session-secret-2026-change-in-production';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface TokenPayload {
  email: string;
  iat: number;
  exp: number;
}

/**
 * Generate a cryptographically secure JWT token
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf-8');
}

function sign(payload: TokenPayload): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${data}.${signature}`;
}

function verify(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;
    
    // Check expiry
    if (Date.now() > payload.exp) return null;
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a session token for a member
 */
export function createSessionToken(email: string): string {
  const now = Date.now();
  const payload: TokenPayload = {
    email: email.toLowerCase(),
    iat: now,
    exp: now + TOKEN_EXPIRY_MS
  };
  return sign(payload);
}

/**
 * Validate a session token and return member email
 */
export function validateSessionToken(token: string): { email: string; valid: boolean } {
  if (!token) {
    return { email: '', valid: false };
  }
  
  const payload = verify(token);
  if (!payload) {
    return { email: '', valid: false };
  }
  
  return { email: payload.email, valid: true };
}

/**
 * Invalidate a session token (logout) - stateless, just returns true
 * In practice, you'd maintain a blocklist in Redis/database for true invalidation
 */
export function invalidateSessionToken(token: string): void {
  // Stateless - token will expire naturally
  // For production, add to blocklist in Redis/DB
}

/**
 * Get token store size (for diagnostics)
 */
export function getTokenStoreSize(): number {
  return tokenStore.size;
}

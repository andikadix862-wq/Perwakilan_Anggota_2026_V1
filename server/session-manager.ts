/**
 * Session Token Management
 * Generates and validates cryptographically secure session tokens
 */

import crypto from 'crypto';

// In-memory token store (for single-instance deployment)
// In production with multiple instances, use Redis or database
const tokenStore = new Map<string, { email: string; createdAt: number; expiresAt: number }>();

// Token expiration: 24 hours
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/**
 * Create a session token for a member
 */
export function createSessionToken(email: string): string {
  const token = generateToken();
  const now = Date.now();
  
  tokenStore.set(token, {
    email: email.toLowerCase(),
    createdAt: now,
    expiresAt: now + TOKEN_EXPIRY_MS
  });
  
  // Clean up expired tokens periodically
  cleanupExpiredTokens();
  
  return token;
}

/**
 * Validate a session token and return member email
 */
export function validateSessionToken(token: string): { email: string; valid: boolean } {
  if (!token) {
    return { email: '', valid: false };
  }
  
  const session = tokenStore.get(token);
  if (!session) {
    return { email: '', valid: false };
  }
  
  // Check if token is expired
  if (Date.now() > session.expiresAt) {
    tokenStore.delete(token);
    return { email: '', valid: false };
  }
  
  return { email: session.email, valid: true };
}

/**
 * Invalidate a session token (logout)
 */
export function invalidateSessionToken(token: string): void {
  tokenStore.delete(token);
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, session] of tokenStore.entries()) {
    if (now > session.expiresAt) {
      tokenStore.delete(token);
    }
  }
}

/**
 * Get token store size (for diagnostics)
 */
export function getTokenStoreSize(): number {
  return tokenStore.size;
}

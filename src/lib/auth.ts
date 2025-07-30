/**
 * Authentication Utilities for RobPass
 * 
 * This module provides server-side authentication utilities including
 * session token validation, user authentication middleware, and
 * secure session management.
 */

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { getDatabase, users } from './db';
import { eq } from 'drizzle-orm';

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export interface SessionPayload {
  userId: number;
  username: string;
  iat: number;
  exp: number;
  type: string;
}

export interface AuthenticatedUser {
  id: number;
  username: string;
}

/**
 * Verify and decode a JWT session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    
    // Verify token type
    if (decoded.type !== 'session') {
      return null;
    }
    
    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Extract session token from request headers
 */
export function extractSessionToken(request: NextRequest): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check custom header
  const tokenHeader = request.headers.get('x-session-token');
  if (tokenHeader) {
    return tokenHeader;
  }
  
  return null;
}

/**
 * Authenticate user from request
 */
export async function authenticateUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Extract token from request
    const token = extractSessionToken(request);
    if (!token) {
      return null;
    }
    
    // Verify token
    const payload = verifySessionToken(token);
    if (!payload) {
      return null;
    }
    
    // Verify user still exists in database
    const db = getDatabase();
    const user = await db
      .select({
        id: users.id,
        username: users.username
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    
    if (user.length === 0) {
      return null;
    }
    
    // Verify username matches (additional security check)
    if (user[0].username !== payload.username) {
      return null;
    }
    
    return {
      id: user[0].id,
      username: user[0].username
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

/**
 * Create authentication middleware response
 */
export function createAuthErrorResponse(message: string = 'Authentication required', status: number = 401) {
  return new Response(
    JSON.stringify({
      success: false,
      error: message
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

/**
 * Validate session token format
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  
  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  // Each part should be base64url encoded
  try {
    for (const part of parts) {
      if (!part || part.length === 0) {
        return false;
      }
      // Basic check for base64url characters
      if (!/^[A-Za-z0-9_-]+$/.test(part)) {
        return false;
      }
    }
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get session expiration time from token
 */
export function getSessionExpiration(token: string): Date | null {
  try {
    const payload = verifySessionToken(token);
    if (!payload || !payload.exp) {
      return null;
    }
    
    return new Date(payload.exp * 1000);
  } catch (error) {
    return null;
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(token: string): boolean {
  const expiration = getSessionExpiration(token);
  if (!expiration) {
    return true;
  }
  
  return Date.now() >= expiration.getTime();
}

/**
 * Generate a new session token
 */
export function generateSessionToken(userId: number, username: string, expiresIn: string = '24h'): string {
  const payload = {
    userId,
    username,
    iat: Math.floor(Date.now() / 1000),
    type: 'session'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Refresh session token (extend expiration)
 */
export function refreshSessionToken(token: string, expiresIn: string = '24h'): string | null {
  try {
    const payload = verifySessionToken(token);
    if (!payload) {
      return null;
    }
    
    // Generate new token with same user data but new expiration
    return generateSessionToken(payload.userId, payload.username, expiresIn);
  } catch (error) {
    return null;
  }
}

/**
 * Blacklist token (in production, use Redis or database)
 */
const blacklistedTokens = new Set<string>();

export function blacklistToken(token: string): void {
  blacklistedTokens.add(token);
  
  // Clean up expired tokens periodically
  setTimeout(() => {
    if (isSessionExpired(token)) {
      blacklistedTokens.delete(token);
    }
  }, 24 * 60 * 60 * 1000); // Clean up after 24 hours
}

export function isTokenBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token);
}

/**
 * Logout user by blacklisting their token
 */
export function logoutUser(token: string): void {
  blacklistToken(token);
}

/**
 * Validate authentication for API routes
 */
export async function requireAuth(request: NextRequest): Promise<{ user: AuthenticatedUser } | Response> {
  const user = await authenticateUser(request);
  
  if (!user) {
    return createAuthErrorResponse();
  }
  
  // Check if token is blacklisted
  const token = extractSessionToken(request);
  if (token && isTokenBlacklisted(token)) {
    return createAuthErrorResponse('Session has been terminated');
  }
  
  return { user };
}

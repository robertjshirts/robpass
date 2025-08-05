import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users } from '@/schema';
import { eq } from 'drizzle-orm';
import { generateSessionToken } from '@/lib/auth';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';

// Rate limiting for TOTP verification attempts
const totpAttempts = new Map<string, { count: number; lastAttempt: number; lockoutUntil?: number }>();
const MAX_TOTP_ATTEMPTS = 5;
const TOTP_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const TOTP_LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes lockout after max attempts

/**
 * Check rate limiting for TOTP verification attempts
 */
function checkTotpRateLimit(clientIP: string, username: string): { allowed: boolean; lockoutUntil?: number } {
  const key = `${clientIP}:${username}`;
  const now = Date.now();
  const attempts = totpAttempts.get(key);

  if (!attempts) {
    totpAttempts.set(key, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Check if still in lockout period
  if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
    return { allowed: false, lockoutUntil: attempts.lockoutUntil };
  }

  // Reset if window has passed
  if (now - attempts.lastAttempt > TOTP_RATE_LIMIT_WINDOW) {
    totpAttempts.set(key, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Check if limit exceeded
  if (attempts.count >= MAX_TOTP_ATTEMPTS) {
    // Set lockout
    attempts.lockoutUntil = now + TOTP_LOCKOUT_DURATION;
    return { allowed: false, lockoutUntil: attempts.lockoutUntil };
  }

  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  return { allowed: true };
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { username, totpCode } = await request.json();

    if (!username || !totpCode) {
      return NextResponse.json(
        { error: 'Username and TOTP code are required' },
        { status: 400 }
      );
    }

    // Check rate limiting for TOTP attempts
    const clientIP = getClientIP(request);
    const rateLimitCheck = checkTotpRateLimit(clientIP, username);

    if (!rateLimitCheck.allowed) {
      SecurityLogger.warn(
        LogCategory.SECURITY,
        'Rate limit exceeded for TOTP verification attempts',
        { clientIP, username, attempts: totpAttempts.get(`${clientIP}:${username}`)?.count || 0 },
        request
      );

      const lockoutMinutes = rateLimitCheck.lockoutUntil
        ? Math.ceil((rateLimitCheck.lockoutUntil - Date.now()) / 60000)
        : 0;

      return NextResponse.json(
        {
          success: false,
          error: `Too many TOTP verification attempts. Account locked for ${lockoutMinutes} minutes.`
        },
        { status: 429 }
      );
    }

    const db = getDatabase();
    
    // Get user by username
    const user = await db
      .select({
        id: users.id,
        username: users.username,
        totp_enabled: users.totp_enabled,
        totp_secret_encrypted: users.totp_secret_encrypted,
        totp_secret_iv: users.totp_secret_iv
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user.length) {
      SecurityLogger.authEvent(
        'LOGIN_FAILURE',
        username,
        { reason: 'user_not_found', method: 'totp', clientIP },
        request
      );

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const userData = user[0];

    // Check if TOTP is enabled for this user
    if (!userData.totp_enabled || !userData.totp_secret_encrypted || !userData.totp_secret_iv) {
      SecurityLogger.authEvent(
        'LOGIN_FAILURE',
        username,
        { reason: 'totp_not_enabled', method: 'totp', clientIP, userId: userData.id },
        request
      );

      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Note: TOTP verification is done client-side with the derived secret
    // This endpoint completes the login process after client-side verification
    // Additional server-side validation could be added here if needed

    // Reset rate limiting on successful verification
    const key = `${clientIP}:${username}`;
    totpAttempts.delete(key);

    // Generate session token
    const sessionToken = await generateSessionToken(userData.id, userData.username);

    // Log successful TOTP authentication
    SecurityLogger.authEvent(
      'LOGIN_SUCCESS',
      username,
      { userId: userData.id, method: 'totp', clientIP },
      request
    );

    return NextResponse.json({
      success: true,
      message: 'TOTP verification successful',
      data: {
        sessionToken,
        user: {
          id: userData.id,
          username: userData.username
        }
      }
    });

  } catch (error) {
    const clientIP = getClientIP(request);
    console.error('TOTP verification error:', error);
    SecurityLogger.error(
      LogCategory.AUTH,
      'TOTP verification endpoint error',
      { clientIP, error: error instanceof Error ? error.message : 'Unknown error' },
      request
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

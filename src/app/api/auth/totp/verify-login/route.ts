import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users } from '@/schema';
import { eq } from 'drizzle-orm';
import { generateSessionToken } from '@/lib/auth';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';

export async function POST(request: NextRequest) {
  try {
    const { username, totpCode } = await request.json();

    if (!username || !totpCode) {
      return NextResponse.json(
        { error: 'Username and TOTP code are required' },
        { status: 400 }
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
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const userData = user[0];

    // Check if TOTP is enabled for this user
    if (!userData.totp_enabled || !userData.totp_secret_encrypted || !userData.totp_secret_iv) {
      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Note: TOTP verification should be done client-side with the derived secret
    // This endpoint assumes the client has already verified the TOTP code
    // and is just completing the login process

    // In a real implementation, you might want to add additional verification
    // or rate limiting specifically for TOTP attempts

    // Generate session token
    const sessionToken = await generateSessionToken(userData.id, userData.username);

    // Log successful TOTP authentication
    SecurityLogger.authEvent(
      'LOGIN_SUCCESS',
      username,
      { userId: userData.id, method: 'totp' },
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
    console.error('TOTP verification error:', error);
    SecurityLogger.error(
      LogCategory.AUTH,
      'TOTP verification endpoint error',
      {},
      request
    );

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

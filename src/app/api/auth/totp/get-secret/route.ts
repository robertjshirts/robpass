import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users } from '@/schema';
import { eq } from 'drizzle-orm';

/**
 * Get encrypted TOTP secret for client-side verification
 * This endpoint provides the encrypted TOTP secret so the client can decrypt it
 * with the master key and perform client-side TOTP verification
 */
export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
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
        { error: 'User not found' },
        { status: 404 }
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

    // Return encrypted TOTP secret for client-side decryption and verification
    return NextResponse.json({
      success: true,
      data: {
        encryptedSecret: userData.totp_secret_encrypted,
        secretIv: userData.totp_secret_iv,
        userId: userData.id
      }
    });

  } catch (error) {
    console.error('Get TOTP secret error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users, backup_codes } from '@/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json(
        { error: 'No authorization token provided' },
        { status: 401 }
      );
    }

    const payload = await verifySessionToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = payload.userId as number;
    const db = getDatabase();
    
    // Get user to check if TOTP is enabled
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user[0].totp_enabled) {
      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Start transaction to disable TOTP and remove backup codes
    await db.transaction(async (tx: any) => {
      // Update user to disable TOTP
      await tx.update(users)
        .set({
          totp_enabled: false,
          totp_secret_encrypted: null,
          totp_secret_iv: null,
          updated_at: new Date()
        })
        .where(eq(users.id, userId));

      // Delete all backup codes for this user
      await tx.delete(backup_codes).where(eq(backup_codes.user_id, userId));
    });

    return NextResponse.json({
      success: true,
      message: 'TOTP disabled successfully'
    });

  } catch (error) {
    console.error('TOTP disable error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

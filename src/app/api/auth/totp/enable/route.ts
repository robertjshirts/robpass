import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users, backup_codes } from '@/schema';
import { eq } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';
import { hashBackupCode } from '@/lib/totp';

export async function POST(request: NextRequest) {
  try {
    const { encryptedSecret, secretIv, totpCode, backupCodes } = await request.json();

    if (!encryptedSecret || !secretIv || !totpCode || !backupCodes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

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
    
    // Get user to check if TOTP is already enabled
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user[0].totp_enabled) {
      return NextResponse.json(
        { error: 'TOTP is already enabled for this user' },
        { status: 400 }
      );
    }

    // Note: TOTP code verification should be done client-side
    // This endpoint just stores the encrypted secret and backup codes

    // Hash backup codes before storing
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (code: string) => ({
        user_id: userId,
        code_hash: await hashBackupCode(code),
        used: false
      }))
    );

    // Start transaction
    await db.transaction(async (tx: any) => {
      // Update user with TOTP information
      await tx.update(users)
        .set({
          totp_enabled: true,
          totp_secret_encrypted: encryptedSecret,
          totp_secret_iv: secretIv,
          updated_at: new Date()
        })
        .where(eq(users.id, userId));

      // Insert backup codes
      await tx.insert(backup_codes).values(hashedBackupCodes);
    });

    return NextResponse.json({
      success: true,
      message: 'TOTP enabled successfully'
    });

  } catch (error) {
    console.error('TOTP enable error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

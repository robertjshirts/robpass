import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users, backup_codes } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { verifyBackupCode } from '@/lib/totp';
import { generateSessionToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, backupCode } = await request.json();

    if (!username || !backupCode) {
      return NextResponse.json(
        { error: 'Username and backup code are required' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // Get user by username
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user.length) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const userData = user[0];

    // Check if TOTP is enabled for this user
    if (!userData.totp_enabled) {
      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Get all unused backup codes for this user
    const userBackupCodes = await db
      .select()
      .from(backup_codes)
      .where(
        and(
          eq(backup_codes.user_id, userData.id),
          eq(backup_codes.used, false)
        )
      );

    if (!userBackupCodes.length) {
      return NextResponse.json(
        { error: 'No valid backup codes available' },
        { status: 401 }
      );
    }

    // Verify the backup code against stored hashes
    let validCodeId: number | null = null;
    for (const storedCode of userBackupCodes) {
      if (verifyBackupCode(backupCode, storedCode.code_hash)) {
        validCodeId = storedCode.id;
        break;
      }
    }

    if (!validCodeId) {
      return NextResponse.json(
        { error: 'Invalid backup code' },
        { status: 401 }
      );
    }

    // Mark the backup code as used
    await db
      .update(backup_codes)
      .set({ used: true })
      .where(eq(backup_codes.id, validCodeId));

    // Generate session token
    const sessionToken = await generateSessionToken(userData.id, userData.username);

    return NextResponse.json({
      success: true,
      message: 'Login successful using backup code',
      data: {
        sessionToken,
        user: {
          id: userData.id,
          username: userData.username
        }
      }
    });

  } catch (error) {
    console.error('Backup code recovery error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

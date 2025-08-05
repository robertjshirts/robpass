import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db';
import { users, backup_codes } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { verifySessionToken } from '@/lib/auth';
import { generateBackupCodes, hashBackupCode } from '@/lib/totp';

/**
 * GET - Get backup code status (count of unused codes)
 */
export async function GET(request: NextRequest) {
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
    
    // Check if user has TOTP enabled
    const user = await db
      .select({ totp_enabled: users.totp_enabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].totp_enabled) {
      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Get backup code statistics
    const backupCodeStats = await db
      .select({
        total: backup_codes.id,
        used: backup_codes.used
      })
      .from(backup_codes)
      .where(eq(backup_codes.user_id, userId));

    const totalCodes = backupCodeStats.length;
    const usedCodes = backupCodeStats.filter(code => code.used).length;
    const remainingCodes = totalCodes - usedCodes;

    return NextResponse.json({
      success: true,
      data: {
        total: totalCodes,
        used: usedCodes,
        remaining: remainingCodes
      }
    });

  } catch (error) {
    console.error('Backup codes status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Regenerate backup codes
 */
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
    
    // Check if user has TOTP enabled
    const user = await db
      .select({ totp_enabled: users.totp_enabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user.length || !user[0].totp_enabled) {
      return NextResponse.json(
        { error: 'TOTP is not enabled for this user' },
        { status: 400 }
      );
    }

    // Generate new backup codes
    const newBackupCodes = generateBackupCodes();
    
    // Hash the new backup codes
    const hashedBackupCodes = await Promise.all(
      newBackupCodes.map(async (code: string) => ({
        user_id: userId,
        code_hash: await hashBackupCode(code),
        used: false
      }))
    );

    // Replace all existing backup codes with new ones
    await db.transaction(async (tx: any) => {
      // Delete all existing backup codes for this user
      await tx.delete(backup_codes).where(eq(backup_codes.user_id, userId));
      
      // Insert new backup codes
      await tx.insert(backup_codes).values(hashedBackupCodes);
    });

    return NextResponse.json({
      success: true,
      message: 'Backup codes regenerated successfully',
      data: {
        backupCodes: newBackupCodes
      }
    });

  } catch (error) {
    console.error('Backup codes regeneration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

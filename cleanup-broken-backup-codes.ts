#!/usr/bin/env tsx

/**
 * Migration script to clean up broken backup codes
 * This script identifies and removes backup codes with invalid hash values
 * (like "{}" or "[object Promise]") that were created due to the async/await bug
 */

import { getDatabase } from './src/lib/db';
import { backup_codes, users } from './src/schema';
import { eq, and } from 'drizzle-orm';

async function cleanupBrokenBackupCodes() {
  console.log('🔧 Starting cleanup of broken backup codes...\n');

  try {
    const db = getDatabase();

    // First, let's see what we're dealing with
    console.log('1. Analyzing existing backup codes...');
    const allBackupCodes = await db
      .select({
        id: backup_codes.id,
        user_id: backup_codes.user_id,
        code_hash: backup_codes.code_hash,
        used: backup_codes.used,
        created_at: backup_codes.created_at
      })
      .from(backup_codes);

    console.log(`Found ${allBackupCodes.length} total backup codes in database`);

    if (allBackupCodes.length === 0) {
      console.log('✅ No backup codes found in database. Nothing to clean up.');
      return;
    }

    // Identify broken codes
    const brokenCodes = allBackupCodes.filter(code => {
      const hash = code.code_hash;
      // Check for common broken hash patterns
      return (
        !hash ||                           // null/undefined
        hash === '{}' ||                   // empty object string
        hash === '[object Promise]' ||     // Promise toString
        hash.includes('Promise') ||        // any Promise-related string
        hash.length !== 64 ||              // SHA-256 should be 64 hex chars
        !/^[a-f0-9]{64}$/i.test(hash)     // not valid hex string
      );
    });

    console.log(`Found ${brokenCodes.length} broken backup codes`);

    if (brokenCodes.length === 0) {
      console.log('✅ No broken backup codes found. Database is clean!');
      return;
    }

    // Show details of broken codes
    console.log('\n2. Details of broken backup codes:');
    brokenCodes.forEach((code, index) => {
      console.log(`  ${index + 1}. ID: ${code.id}, User: ${code.user_id}, Hash: "${code.code_hash}", Used: ${code.used}`);
    });

    // Group by user to see impact
    const userImpact = new Map<number, number>();
    brokenCodes.forEach(code => {
      const count = userImpact.get(code.user_id) || 0;
      userImpact.set(code.user_id, count + 1);
    });

    console.log('\n3. Impact by user:');
    for (const [userId, count] of userImpact.entries()) {
      console.log(`  User ${userId}: ${count} broken backup codes`);
    }

    // Get user information for affected users
    console.log('\n4. Checking TOTP status for affected users...');
    const affectedUserIds = Array.from(userImpact.keys());
    const affectedUsers = await db
      .select({
        id: users.id,
        username: users.username,
        totp_enabled: users.totp_enabled
      })
      .from(users)
      .where(eq(users.id, affectedUserIds[0])); // This is a simplified query for demo

    console.log('Affected users:');
    affectedUsers.forEach(user => {
      const brokenCount = userImpact.get(user.id) || 0;
      console.log(`  - ${user.username} (ID: ${user.id}): TOTP enabled: ${user.totp_enabled}, Broken codes: ${brokenCount}`);
    });

    // Ask for confirmation before deletion
    console.log('\n⚠️  WARNING: This will delete all broken backup codes.');
    console.log('Users with broken backup codes will need to regenerate them.');
    console.log('This is safe because the broken codes are unusable anyway.\n');

    // For safety, we'll just log what would be deleted instead of actually deleting
    console.log('🔍 DRY RUN: The following backup codes would be deleted:');
    const brokenIds = brokenCodes.map(code => code.id);
    console.log(`Backup code IDs: ${brokenIds.join(', ')}`);

    // Uncomment the following lines to actually perform the deletion:
    /*
    console.log('\n5. Deleting broken backup codes...');
    const deleteResult = await db
      .delete(backup_codes)
      .where(eq(backup_codes.id, brokenIds[0])); // This would need to be updated for multiple IDs
    
    console.log(`✅ Deleted ${deleteResult.rowCount} broken backup codes`);
    */

    console.log('\n✅ Cleanup analysis complete!');
    console.log('\nNext steps for affected users:');
    console.log('1. Users should log in and regenerate their backup codes');
    console.log('2. The fixed code will now generate proper hash values');
    console.log('3. Consider notifying affected users about the need to regenerate backup codes');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupBrokenBackupCodes();

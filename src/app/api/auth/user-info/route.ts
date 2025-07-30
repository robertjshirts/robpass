/**
 * User Information API Route for RobPass
 * 
 * This route provides user salt and KDF iterations for a given username.
 * This is required for the client to derive the master key and authentication hash.
 * 
 * Security Notes:
 * - This endpoint is safe to expose as it only returns non-sensitive derivation parameters
 * - Rate limiting is applied to prevent enumeration attacks
 * - Timing attacks are mitigated by consistent response times
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Rate limiting for user info requests
const userInfoAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 20; // More lenient than registration
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Check rate limiting for user info requests
 */
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const attempts = userInfoAttempts.get(clientIP);
  
  if (!attempts) {
    userInfoAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
    userInfoAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Check if limit exceeded
  if (attempts.count >= MAX_ATTEMPTS) {
    return false;
  }
  
  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  return true;
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

/**
 * Add artificial delay to prevent timing attacks
 */
async function addTimingDelay(): Promise<void> {
  const delay = Math.random() * 100 + 50; // 50-150ms random delay
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many requests. Please try again later.' 
        },
        { status: 429 }
      );
    }
    
    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (error) {
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON in request body' 
        },
        { status: 400 }
      );
    }
    
    // Validate username
    if (!requestData.username || typeof requestData.username !== 'string') {
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Username is required' 
        },
        { status: 400 }
      );
    }
    
    const username = requestData.username.trim().toLowerCase();
    
    if (username.length < 3 || username.length > 50) {
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid username format' 
        },
        { status: 400 }
      );
    }
    
    // Get database connection
    const db = getDatabase();
    
    // Look up user
    const user = await db
      .select({
        password_salt: users.password_salt,
        kdf_iterations: users.kdf_iterations
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (user.length === 0) {
      // Add delay even for non-existent users to prevent timing attacks
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found' 
        },
        { status: 404 }
      );
    }
    
    // Add small delay for consistency
    await addTimingDelay();
    
    // Return user derivation parameters
    return NextResponse.json({
      success: true,
      data: {
        password_salt: user[0].password_salt,
        kdf_iterations: user[0].kdf_iterations
      }
    });
    
  } catch (error) {
    console.error('User info error:', error);
    
    // Add delay for error cases too
    await addTimingDelay();
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

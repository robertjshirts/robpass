/**
 * User Logout API Route for RobPass
 * 
 * This route handles user logout by blacklisting the session token
 * and ensuring proper cleanup of server-side session state.
 * 
 * Security Requirements:
 * - Blacklist the session token to prevent reuse
 * - Clear any server-side session data
 * - Return success even for invalid tokens (prevent information leakage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractSessionToken, logoutUser, isValidTokenFormat } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Extract session token from request
    const token = extractSessionToken(request);
    
    if (token && isValidTokenFormat(token)) {
      // Blacklist the token to prevent further use
      logoutUser(token);
    }
    
    // Always return success to prevent information leakage
    // (don't reveal whether the token was valid or not)
    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    });
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still return success to prevent information leakage
    return NextResponse.json({
      success: true,
      message: 'Logout successful'
    });
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

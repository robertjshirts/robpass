/**
 * Session Validation API Route for RobPass
 * 
 * This route validates session tokens and returns user information
 * if the session is valid. Used for maintaining authentication state
 * across page refreshes and application restarts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await requireAuth(request);
    
    // If authentication failed, return the error response
    if (authResult instanceof Response) {
      return authResult;
    }
    
    const { user } = authResult;
    
    // Return user information for valid session
    return NextResponse.json({
      success: true,
      message: 'Session is valid',
      data: {
        user: {
          id: user.id,
          username: user.username
        }
      }
    });
    
  } catch (error) {
    console.error('Session validation error:', error);
    
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

/**
 * User Login API Route for RobPass
 * 
 * This route handles user authentication with zero-knowledge architecture.
 * It verifies the client-derived authentication hash against the stored hash
 * and issues secure session tokens on successful authentication.
 * 
 * Security Requirements:
 * - Rate limiting to prevent brute force attacks
 * - Timing attack prevention
 * - Secure session token generation
 * - No logging of sensitive data
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Rate limiting for login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockoutUntil?: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes lockout after max attempts

// JWT secret (in production, use a secure environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = '24h'; // Session token expires in 24 hours

interface LoginRequest {
  username: string;
  authentication_hash: string;
}

/**
 * Check rate limiting and lockout for login attempts
 */
function checkRateLimit(clientIP: string): { allowed: boolean; lockoutUntil?: number } {
  const now = Date.now();
  const attempts = loginAttempts.get(clientIP);
  
  if (!attempts) {
    loginAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Check if still in lockout period
  if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
    return { allowed: false, lockoutUntil: attempts.lockoutUntil };
  }
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  
  // Check if limit exceeded
  if (attempts.count >= MAX_ATTEMPTS) {
    // Set lockout
    attempts.lockoutUntil = now + LOCKOUT_DURATION;
    return { allowed: false, lockoutUntil: attempts.lockoutUntil };
  }
  
  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  return { allowed: true };
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
  const delay = Math.random() * 200 + 100; // 100-300ms random delay
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Generate secure session token
 */
function generateSessionToken(userId: number, username: string): string {
  const payload = {
    userId,
    username,
    iat: Math.floor(Date.now() / 1000),
    type: 'session'
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Validate login request data
 */
function validateLoginData(data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: LoginRequest;
} {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.username || typeof data.username !== 'string') {
    errors.push('Username is required and must be a string');
  }
  
  if (!data.authentication_hash || typeof data.authentication_hash !== 'string') {
    errors.push('Authentication hash is required and must be a string');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Validate username format
  const username = data.username.trim().toLowerCase();
  if (username.length < 3 || username.length > 50) {
    errors.push('Invalid username format');
  }
  
  // Validate authentication hash format (should be base64)
  try {
    const hashBuffer = Buffer.from(data.authentication_hash, 'base64');
    if (hashBuffer.length < 32) {
      errors.push('Invalid authentication hash format');
    }
  } catch (error) {
    errors.push('Invalid authentication hash format');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  return {
    isValid: true,
    errors: [],
    sanitizedData: {
      username,
      authentication_hash: data.authentication_hash
    }
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const clientIP = getClientIP(request);
    const rateLimitCheck = checkRateLimit(clientIP);
    
    if (!rateLimitCheck.allowed) {
      await addTimingDelay();
      const lockoutMinutes = rateLimitCheck.lockoutUntil 
        ? Math.ceil((rateLimitCheck.lockoutUntil - Date.now()) / 60000)
        : 0;
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Too many login attempts. Account locked for ${lockoutMinutes} minutes.` 
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
    
    // Validate request data
    const validation = validateLoginData(requestData);
    if (!validation.isValid) {
      await addTimingDelay();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid login data',
          details: validation.errors 
        },
        { status: 400 }
      );
    }
    
    const { username, authentication_hash } = validation.sanitizedData!;
    
    // Get database connection
    const db = getDatabase();
    
    // Look up user
    const user = await db
      .select({
        id: users.id,
        username: users.username,
        authentication_hash: users.authentication_hash
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    // Always add timing delay to prevent timing attacks
    await addTimingDelay();
    
    if (user.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid credentials' 
        },
        { status: 401 }
      );
    }
    
    // Verify authentication hash using bcrypt
    const isValidHash = await bcrypt.compare(authentication_hash, user[0].authentication_hash);
    
    if (!isValidHash) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid credentials' 
        },
        { status: 401 }
      );
    }
    
    // Reset rate limiting on successful login
    loginAttempts.delete(clientIP);
    
    // Generate session token
    const sessionToken = generateSessionToken(user[0].id, user[0].username);
    
    // Return success response with session token
    return NextResponse.json({
      success: true,
      message: 'Login successful',
      data: {
        sessionToken,
        user: {
          id: user[0].id,
          username: user[0].username
        }
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    
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

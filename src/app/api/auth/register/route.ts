/**
 * User Registration API Route for RobPass
 * 
 * This route handles user registration with zero-knowledge architecture.
 * It accepts client-derived authentication hash and stores it securely.
 * 
 * Security Requirements:
 * - Never store or log plaintext passwords or master keys
 * - Server-side hash the client-derived authentication hash
 * - Validate all inputs thoroughly
 * - Prevent timing attacks
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';

// Rate limiting (simple in-memory store - in production use Redis)
const registrationAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

interface RegistrationRequest {
  username: string;
  password_salt: string;
  authentication_hash: string;
  kdf_iterations: number;
}

/**
 * Validate registration request data
 */
function validateRegistrationData(data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: RegistrationRequest;
} {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.username || typeof data.username !== 'string') {
    errors.push('Username is required and must be a string');
  }
  
  if (!data.password_salt || typeof data.password_salt !== 'string') {
    errors.push('Password salt is required and must be a string');
  }
  
  if (!data.authentication_hash || typeof data.authentication_hash !== 'string') {
    errors.push('Authentication hash is required and must be a string');
  }
  
  if (!data.kdf_iterations || typeof data.kdf_iterations !== 'number') {
    errors.push('KDF iterations is required and must be a number');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Validate username format
  const username = data.username.trim().toLowerCase();
  if (username.length < 3 || username.length > 50) {
    errors.push('Username must be between 3 and 50 characters');
  }
  
  if (!/^[a-zA-Z0-9._@-]+$/.test(username)) {
    errors.push('Username contains invalid characters');
  }
  
  // Validate KDF iterations
  if (data.kdf_iterations < 100000) {
    errors.push('KDF iterations must be at least 100,000');
  }
  
  if (data.kdf_iterations > 1000000) {
    errors.push('KDF iterations cannot exceed 1,000,000');
  }
  
  // Validate salt format (should be base64)
  try {
    const saltBuffer = Buffer.from(data.password_salt, 'base64');
    if (saltBuffer.length < 32) {
      errors.push('Password salt must be at least 32 bytes');
    }
  } catch (error) {
    errors.push('Password salt must be valid base64');
  }
  
  // Validate authentication hash format (should be base64)
  try {
    const hashBuffer = Buffer.from(data.authentication_hash, 'base64');
    if (hashBuffer.length < 32) {
      errors.push('Authentication hash must be at least 32 bytes');
    }
  } catch (error) {
    errors.push('Authentication hash must be valid base64');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  return {
    isValid: true,
    errors: [],
    sanitizedData: {
      username,
      password_salt: data.password_salt,
      authentication_hash: data.authentication_hash,
      kdf_iterations: data.kdf_iterations
    }
  };
}

/**
 * Check rate limiting for registration attempts
 */
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const attempts = registrationAttempts.get(clientIP);
  
  if (!attempts) {
    registrationAttempts.set(clientIP, { count: 1, lastAttempt: now });
    return true;
  }
  
  // Reset if window has passed
  if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
    registrationAttempts.set(clientIP, { count: 1, lastAttempt: now });
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

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Too many registration attempts. Please try again later.' 
        },
        { status: 429 }
      );
    }
    
    // Parse request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid JSON in request body' 
        },
        { status: 400 }
      );
    }
    
    // Validate request data
    const validation = validateRegistrationData(requestData);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: validation.errors 
        },
        { status: 400 }
      );
    }
    
    const { username, password_salt, authentication_hash, kdf_iterations } = validation.sanitizedData!;
    
    // Get database connection
    const db = getDatabase();
    
    // Check if username already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (existingUser.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Username already exists' 
        },
        { status: 409 }
      );
    }
    
    // Hash the authentication hash server-side using bcrypt
    const saltRounds = 12; // Strong bcrypt salt rounds
    const hashedAuthHash = await bcrypt.hash(authentication_hash, saltRounds);
    
    // Insert new user into database
    const result = await db
      .insert(users)
      .values({
        username,
        password_salt,
        authentication_hash: hashedAuthHash,
        kdf_iterations
      })
      .returning({ id: users.id, username: users.username });

    // Log successful registration
    SecurityLogger.authEvent(
      'REGISTRATION',
      username,
      { userId: result[0].id },
      request
    );

    // Return success response (no sensitive data)
    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: result[0].id,
        username: result[0].username
      }
    });
    
  } catch (error) {
    SecurityLogger.error(
      LogCategory.AUTH,
      'Registration endpoint error',
      {},
      request
    );

    // Return generic error to prevent information leakage
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

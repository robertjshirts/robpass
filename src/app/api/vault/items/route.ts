/**
 * Vault Items API Routes for RobPass
 * 
 * This module handles CRUD operations for vault items (encrypted passwords).
 * All data is encrypted client-side before being sent to the server.
 * 
 * Security Requirements:
 * - Require valid authentication for all operations
 * - Only allow users to access their own vault items
 * - Validate all inputs thoroughly
 * - Never log or expose encrypted data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, vault_items } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';

interface CreateVaultItemRequest {
  name: string;
  encrypted_data: string;
  iv: string;
}

interface VaultItemResponse {
  id: number;
  name: string;
  encrypted_data: string;
  iv: string;
  created_at: string;
  updated_at: string;
}

/**
 * Validate vault item request data
 */
function validateVaultItemData(data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: CreateVaultItemRequest;
} {
  const errors: string[] = [];
  
  // Check required fields
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Name is required and must be a string');
  }
  
  if (!data.encrypted_data || typeof data.encrypted_data !== 'string') {
    errors.push('Encrypted data is required and must be a string');
  }
  
  if (!data.iv || typeof data.iv !== 'string') {
    errors.push('IV is required and must be a string');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  // Validate name
  const name = data.name.trim();
  if (name.length === 0) {
    errors.push('Name cannot be empty');
  }
  
  if (name.length > 255) {
    errors.push('Name cannot exceed 255 characters');
  }
  
  // Validate encrypted data format (should be base64)
  try {
    const dataBuffer = Buffer.from(data.encrypted_data, 'base64');
    if (dataBuffer.length === 0) {
      errors.push('Encrypted data cannot be empty');
    }
  } catch (error) {
    errors.push('Encrypted data must be valid base64');
  }
  
  // Validate IV format (should be base64)
  try {
    const ivBuffer = Buffer.from(data.iv, 'base64');
    if (ivBuffer.length !== 12) { // AES-GCM IV should be 12 bytes
      errors.push('IV must be 12 bytes (16 characters in base64)');
    }
  } catch (error) {
    errors.push('IV must be valid base64');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  
  return {
    isValid: true,
    errors: [],
    sanitizedData: {
      name,
      encrypted_data: data.encrypted_data,
      iv: data.iv
    }
  };
}

/**
 * GET /api/vault/items - Get all vault items for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    
    const { user } = authResult;
    
    // Get database connection
    const db = getDatabase();
    
    // Fetch user's vault items
    const items = await db
      .select({
        id: vault_items.id,
        name: vault_items.name,
        encrypted_data: vault_items.encrypted_data,
        iv: vault_items.iv,
        created_at: vault_items.created_at,
        updated_at: vault_items.updated_at
      })
      .from(vault_items)
      .where(eq(vault_items.user_id, user.id))
      .orderBy(vault_items.created_at);

    SecurityLogger.info(
      LogCategory.VAULT,
      'Vault items retrieved',
      { userId: user.id, itemCount: items.length },
      request
    );

    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      encrypted_data: item.encrypted_data,
      iv: item.iv,
      created_at: item.created_at?.toISOString() || '',
      updated_at: item.updated_at?.toISOString() || ''
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems as VaultItemResponse[]
      }
    });
    
  } catch (error) {
    console.error('Get vault items error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/items - Create a new vault item
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }
    
    const { user } = authResult;
    
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
    const validation = validateVaultItemData(requestData);
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
    
    const { name, encrypted_data, iv } = validation.sanitizedData!;
    
    // Get database connection
    const db = getDatabase();
    
    // Insert new vault item
    const result = await db
      .insert(vault_items)
      .values({
        user_id: user.id,
        name,
        encrypted_data,
        iv
      })
      .returning({
        id: vault_items.id,
        name: vault_items.name,
        encrypted_data: vault_items.encrypted_data,
        iv: vault_items.iv,
        created_at: vault_items.created_at,
        updated_at: vault_items.updated_at
      });
    
    SecurityLogger.info(
      LogCategory.VAULT,
      'Vault item created',
      { userId: user.id, itemId: result[0].id, itemName: requestData.name },
      request
    );

    const createdItem = result[0];
    return NextResponse.json({
      success: true,
      message: 'Vault item created successfully',
      data: {
        item: {
          id: createdItem.id,
          name: createdItem.name,
          encrypted_data: createdItem.encrypted_data,
          iv: createdItem.iv,
          created_at: createdItem.created_at?.toISOString() || '',
          updated_at: createdItem.updated_at?.toISOString() || ''
        } as VaultItemResponse
      }
    });

  } catch (error) {
    SecurityLogger.error(
      LogCategory.VAULT,
      'Create vault item error',
      {},
      request
    );

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// Only allow GET and POST requests
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

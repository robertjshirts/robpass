/**
 * Individual Vault Item API Routes for RobPass
 * 
 * This module handles operations on individual vault items by ID.
 * Includes GET, PUT (update), and DELETE operations.
 * 
 * Security Requirements:
 * - Require valid authentication for all operations
 * - Only allow users to access their own vault items
 * - Validate item ownership before any operation
 * - Validate all inputs thoroughly
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, vault_items } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

interface UpdateVaultItemRequest {
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
 * Validate vault item update data
 */
function validateUpdateData(data: any): {
  isValid: boolean;
  errors: string[];
  sanitizedData?: UpdateVaultItemRequest;
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
 * Validate and parse item ID from URL
 */
function validateItemId(id: string): number | null {
  const parsedId = parseInt(id, 10);
  if (isNaN(parsedId) || parsedId <= 0) {
    return null;
  }
  return parsedId;
}

/**
 * GET /api/vault/items/[id] - Get a specific vault item
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Await params and validate item ID
    const params = await context.params;
    const itemId = validateItemId(params.id);
    if (itemId === null) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid item ID' 
        },
        { status: 400 }
      );
    }
    
    // Get database connection
    const db = getDatabase();
    
    // Fetch the specific vault item (with ownership check)
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
      .where(and(
        eq(vault_items.id, itemId),
        eq(vault_items.user_id, user.id)
      ))
      .limit(1);
    
    if (items.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vault item not found' 
        },
        { status: 404 }
      );
    }
    
    const item = items[0];
    return NextResponse.json({
      success: true,
      data: {
        item: {
          id: item.id,
          name: item.name,
          encrypted_data: item.encrypted_data,
          iv: item.iv,
          created_at: item.created_at?.toISOString() || '',
          updated_at: item.updated_at?.toISOString() || ''
        } as VaultItemResponse
      }
    });
    
  } catch (error) {
    console.error('Get vault item error:', error);
    
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
 * PUT /api/vault/items/[id] - Update a specific vault item
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Await params and validate item ID
    const params = await context.params;
    const itemId = validateItemId(params.id);
    if (itemId === null) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid item ID' 
        },
        { status: 400 }
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
    const validation = validateUpdateData(requestData);
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
    
    // Update the vault item (with ownership check)
    const result = await db
      .update(vault_items)
      .set({
        name,
        encrypted_data,
        iv,
        updated_at: new Date()
      })
      .where(and(
        eq(vault_items.id, itemId),
        eq(vault_items.user_id, user.id)
      ))
      .returning({
        id: vault_items.id,
        name: vault_items.name,
        encrypted_data: vault_items.encrypted_data,
        iv: vault_items.iv,
        created_at: vault_items.created_at,
        updated_at: vault_items.updated_at
      });
    
    if (result.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vault item not found' 
        },
        { status: 404 }
      );
    }
    
    const updatedItem = result[0];
    return NextResponse.json({
      success: true,
      message: 'Vault item updated successfully',
      data: {
        item: {
          id: updatedItem.id,
          name: updatedItem.name,
          encrypted_data: updatedItem.encrypted_data,
          iv: updatedItem.iv,
          created_at: updatedItem.created_at?.toISOString() || '',
          updated_at: updatedItem.updated_at?.toISOString() || ''
        } as VaultItemResponse
      }
    });
    
  } catch (error) {
    console.error('Update vault item error:', error);
    
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
 * DELETE /api/vault/items/[id] - Delete a specific vault item
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user } = authResult;

    // Await params and validate item ID
    const params = await context.params;
    const itemId = validateItemId(params.id);
    if (itemId === null) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid item ID' 
        },
        { status: 400 }
      );
    }
    
    // Get database connection
    const db = getDatabase();
    
    // Delete the vault item (with ownership check)
    const result = await db
      .delete(vault_items)
      .where(and(
        eq(vault_items.id, itemId),
        eq(vault_items.user_id, user.id)
      ))
      .returning({
        id: vault_items.id
      });
    
    if (result.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vault item not found' 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Vault item deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete vault item error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

// Only allow GET, PUT, and DELETE requests
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

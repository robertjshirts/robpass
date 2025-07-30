/**
 * Client-Side Cryptography Library for RobPass
 * 
 * This module provides all cryptographic operations required for the zero-knowledge
 * password manager. All operations are performed client-side using the Web Crypto API.
 * 
 * Security Requirements:
 * - PBKDF2 with minimum 100,000 iterations
 * - AES-256-GCM encryption with unique IVs
 * - Base64 encoding for storage/transmission
 * - No plaintext data sent to server
 */

// Type definitions for better type safety
export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; // Base64 encoded
}

export interface UserCredentials {
  username: string;
  password: string;
  uri?: string;
}

export interface DerivedKeys {
  masterKey: CryptoKey;
  authenticationHash: string;
}

// Constants for cryptographic operations
export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 100000, // Minimum required iterations
  AES_KEY_LENGTH: 256, // AES-256
  IV_LENGTH: 12, // 96 bits for GCM
  SALT_LENGTH: 32, // 256 bits
} as const;

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): string {
  const salt = new Uint8Array(CRYPTO_CONFIG.SALT_LENGTH);
  crypto.getRandomValues(salt);
  return arrayBufferToBase64(salt);
}

/**
 * Generate a cryptographically secure random IV
 */
export function generateIV(): Uint8Array {
  const iv = new Uint8Array(CRYPTO_CONFIG.IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Convert ArrayBuffer to Base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}



export async function deriveKeys(
  password: string,
  salt: string,
  iterations: number = CRYPTO_CONFIG.PBKDF2_ITERATIONS
): Promise<DerivedKeys> {
  try {
    // Import password as key material
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey', 'deriveBits']
    );

    // Derive the master key for encryption/decryption
    const masterKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: base64ToArrayBuffer(salt),
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      {
        name: 'AES-GCM',
        length: CRYPTO_CONFIG.AES_KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );

    // Derive authentication hash using a different salt (append 'auth' bytes to original salt)
    const originalSalt = base64ToArrayBuffer(salt);
    const authSuffix = new TextEncoder().encode('auth');
    const authSalt = new Uint8Array(originalSalt.byteLength + authSuffix.byteLength);
    authSalt.set(new Uint8Array(originalSalt), 0);
    authSalt.set(authSuffix, originalSalt.byteLength);

    const authHashBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: authSalt,
        iterations,
        hash: 'SHA-256'
      },
      passwordKey,
      256 // 32 bytes
    );

    const authenticationHash = arrayBufferToBase64(authHashBits);

    return {
      masterKey,
      authenticationHash
    };
  } catch (error) {
    throw new Error(`Failed to derive keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(
  data: string,
  masterKey: CryptoKey
): Promise<EncryptedData> {
  try {
    const iv = generateIV();
    const encodedData = new TextEncoder().encode(data);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      masterKey,
      encodedData
    );

    return {
      ciphertext: arrayBufferToBase64(ciphertext),
      iv: arrayBufferToBase64(iv)
    };
  } catch (error) {
    throw new Error(`Failed to encrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(
  encryptedData: EncryptedData,
  masterKey: CryptoKey
): Promise<string> {
  try {
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext);
    const iv = base64ToArrayBuffer(encryptedData.iv);

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      masterKey,
      ciphertext
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Encrypt user credentials (username, password, URI) for vault storage
 */
export async function encryptCredentials(
  credentials: UserCredentials,
  masterKey: CryptoKey
): Promise<EncryptedData> {
  try {
    const jsonData = JSON.stringify(credentials);
    return await encryptData(jsonData, masterKey);
  } catch (error) {
    throw new Error(`Failed to encrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt user credentials from vault storage
 */
export async function decryptCredentials(
  encryptedData: EncryptedData,
  masterKey: CryptoKey
): Promise<UserCredentials> {
  try {
    const jsonData = await decryptData(encryptedData, masterKey);
    return JSON.parse(jsonData) as UserCredentials;
  } catch (error) {
    throw new Error(`Failed to decrypt credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Securely clear sensitive data from memory (best effort)
 * Note: JavaScript doesn't provide guaranteed memory clearing, but this helps
 */
export function clearSensitiveData(data: string | ArrayBuffer | Uint8Array): void {
  if (typeof data === 'string') {
    // Can't actually clear string memory in JS, but we can try to overwrite references
    data = '';
  } else if (data instanceof ArrayBuffer) {
    const view = new Uint8Array(data);
    view.fill(0);
  } else if (data instanceof Uint8Array) {
    data.fill(0);
  }
}

/**
 * Validate cryptographic parameters
 */
export function validateCryptoParams(iterations: number, saltBase64: string): void {
  if (iterations < CRYPTO_CONFIG.PBKDF2_ITERATIONS) {
    throw new Error(`Insufficient PBKDF2 iterations. Minimum required: ${CRYPTO_CONFIG.PBKDF2_ITERATIONS}`);
  }

  try {
    const salt = base64ToArrayBuffer(saltBase64);
    if (salt.byteLength < CRYPTO_CONFIG.SALT_LENGTH) {
      throw new Error(`Insufficient salt length. Minimum required: ${CRYPTO_CONFIG.SALT_LENGTH} bytes`);
    }
  } catch (error) {
    throw new Error('Invalid salt format');
  }
}

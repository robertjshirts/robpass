import QRCode from 'qrcode';

/**
 * TOTP implementation following RFC 6238
 * All operations are designed to work client-side for zero-knowledge architecture
 * Uses Web Crypto API for browser compatibility
 */

const TOTP_WINDOW = 30; // 30 second time window
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA-1';

/**
 * Browser-compatible HMAC function using Web Crypto API
 */
async function hmac(algorithm: string, key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

/**
 * Browser-compatible hash function using Web Crypto API
 */
async function hash(algorithm: string, data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  return new Uint8Array(hashBuffer);
}

/**
 * Browser-compatible random bytes generation
 */
function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Derives a TOTP secret from the master key using HKDF
 * This ensures the TOTP secret is deterministic but unique per user
 */
export async function deriveTotpSecret(masterKey: ArrayBuffer, username: string): Promise<string> {
  // Use HKDF-like derivation with the master key and username as salt
  const salt = new TextEncoder().encode(`totp:${username}`);
  const info = new TextEncoder().encode('RobPass-TOTP-Secret');

  // Simple HKDF implementation using HMAC-SHA256
  const prk = await hmac('SHA-256', new Uint8Array(salt), new Uint8Array(masterKey));

  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1; // Counter for HKDF

  const okm = await hmac('SHA-256', prk, infoWithCounter);

  // Take first 20 bytes (160 bits) for the secret
  const secret = okm.subarray(0, 20);

  // Convert to base32 for compatibility with authenticator apps
  return base32Encode(secret);
}

/**
 * Generates a TOTP code for the current time
 */
export async function generateTotpCode(secret: string, timeStep?: number): Promise<string> {
  const time = timeStep || Math.floor(Date.now() / 1000 / TOTP_WINDOW);
  return await generateHotpCode(secret, time);
}

/**
 * Verifies a TOTP code with time window tolerance
 */
export async function verifyTotpCode(secret: string, code: string, windowSize: number = 1): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000 / TOTP_WINDOW);

  // Check current time and adjacent windows for clock skew tolerance
  for (let i = -windowSize; i <= windowSize; i++) {
    const timeStep = currentTime + i;
    const expectedCode = await generateHotpCode(secret, timeStep);

    if (constantTimeCompare(code, expectedCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Generates HOTP code (used internally by TOTP)
 */
async function generateHotpCode(secret: string, counter: number): Promise<string> {
  const secretBytes = base32Decode(secret);

  // Create 8-byte counter buffer (big-endian)
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setUint32(4, counter, false); // Big endian, lower 32 bits

  const hashBytes = await hmac(TOTP_ALGORITHM, secretBytes, new Uint8Array(counterBuffer));

  // Dynamic truncation
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const code = (
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_DIGITS);

  return code.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Generates QR code data URL for TOTP setup
 * Optimized for authenticator app scanning including 1Password
 */
export async function generateQRCodeDataURL(secret: string, username: string): Promise<string> {
  // Validate inputs
  if (!secret || !username) {
    throw new Error('Secret and username are required');
  }

  if (!validateTotpSecret(secret)) {
    throw new Error('Invalid TOTP secret format');
  }

  const issuer = 'RobPass';

  // Critical fix: Use proper label format for 1Password compatibility
  // 1Password expects the label to be just the account identifier, not issuer:account
  const label = encodeURIComponent(username);

  // Build otpauth URL with explicit parameter ordering for maximum compatibility
  const otpAuthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_WINDOW}`;

  // Validate the generated URL
  const validation = validateOtpAuthUrl(otpAuthUrl);
  if (!validation.valid) {
    throw new Error(`Invalid otpauth URL: ${validation.error}`);
  }

  try {
    const dataUrl = await QRCode.toDataURL(otpAuthUrl, {
      errorCorrectionLevel: 'M', // Medium error correction - better compatibility than H
      margin: 4, // Adequate margin for scanning
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300, // Slightly larger for better scanning
      scale: 4 // Ensure crisp rendering
    });

    return dataUrl;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Gets the TOTP auth URL for manual entry
 */
export function getTotpAuthUrl(secret: string, username: string): string {
  const issuer = 'RobPass';
  const label = encodeURIComponent(username);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_WINDOW}`;
}

/**
 * Validates the TOTP secret format
 */
export function validateTotpSecret(secret: string): boolean {
  // Base32 alphabet: A-Z, 2-7, with optional padding
  const base32Regex = /^[A-Z2-7]+=*$/;
  return base32Regex.test(secret) && secret.length >= 16;
}

/**
 * Validates the otpauth URL format
 */
export function validateOtpAuthUrl(url: string): { valid: boolean; error?: string } {
  try {
    const urlObj = new URL(url);

    if (urlObj.protocol !== 'otpauth:') {
      return { valid: false, error: 'Invalid protocol, must be otpauth:' };
    }

    if (urlObj.hostname !== 'totp') {
      return { valid: false, error: 'Invalid type, must be totp' };
    }

    const params = urlObj.searchParams;
    const secret = params.get('secret');
    const issuer = params.get('issuer');
    const algorithm = params.get('algorithm');

    if (!secret) {
      return { valid: false, error: 'Missing secret parameter' };
    }

    if (!issuer) {
      return { valid: false, error: 'Missing issuer parameter' };
    }

    if (!validateTotpSecret(secret)) {
      return { valid: false, error: 'Invalid secret format' };
    }

    // Validate algorithm format (accept both SHA1 and SHA-1)
    if (algorithm && !['SHA1', 'SHA-1'].includes(algorithm.toUpperCase())) {
      return { valid: false, error: 'Invalid algorithm, must be SHA1 or SHA-1' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Generates cryptographically secure backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 16 character alphanumeric code
    const bytes = randomBytes(10);
    let code = '';
    
    for (let j = 0; j < bytes.length; j++) {
      // Use alphanumeric characters (0-9, A-Z) excluding confusing ones
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      code += chars[bytes[j] % chars.length];
    }
    
    // Format as XXXX-XXXX-XX
    const formatted = code.match(/.{1,4}/g)?.join('-') || code;
    codes.push(formatted);
  }
  
  return codes;
}

/**
 * Hashes a backup code for storage
 */
export async function hashBackupCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await hash('SHA-256', data);
  return Array.from(hashBuffer).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a backup code against its hash
 */
export async function verifyBackupCode(code: string, hash: string): Promise<boolean> {
  const codeHash = await hashBackupCode(code);
  return constantTimeCompare(codeHash, hash);
}

/**
 * Constant time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Base32 encoding for TOTP secrets
 */
function base32Encode(buffer: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

/**
 * Base32 decoding for TOTP secrets
 */
function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');

  let bits = 0;
  let value = 0;
  const result: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const index = alphabet.indexOf(cleanInput[i]);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(result);
}

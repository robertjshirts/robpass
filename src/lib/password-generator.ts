/**
 * Secure Password Generator for RobPass
 * 
 * Generates cryptographically secure passwords using crypto.getRandomValues()
 * Provides customizable options for different password policies
 */

export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean; // Exclude similar looking characters (0, O, l, 1, etc.)
  excludeAmbiguous: boolean; // Exclude ambiguous characters ({, }, [, ], etc.)
}

// Character sets for password generation
const CHARACTER_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  similar: '0O1lI|',
  ambiguous: '{}[]()/\\\'"`~,;.<>'
} as const;

// Default password options
export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilar: false,
  excludeAmbiguous: false
};

/**
 * Generate a cryptographically secure password
 */
export function generatePassword(options: Partial<PasswordOptions> = {}): string {
  const opts = { ...DEFAULT_PASSWORD_OPTIONS, ...options };
  
  // Validate options
  if (opts.length < 4) {
    throw new Error('Password length must be at least 4 characters');
  }
  
  if (opts.length > 128) {
    throw new Error('Password length cannot exceed 128 characters');
  }
  
  if (!opts.includeUppercase && !opts.includeLowercase && !opts.includeNumbers && !opts.includeSymbols) {
    throw new Error('At least one character type must be included');
  }
  
  // Build character set
  let charset = '';
  const requiredChars: string[] = [];
  
  if (opts.includeUppercase) {
    let chars: string = CHARACTER_SETS.uppercase;
    if (opts.excludeSimilar) {
      chars = chars.replace(/[O]/g, '');
    }
    charset += chars;
    requiredChars.push(getRandomChar(chars));
  }
  
  if (opts.includeLowercase) {
    let chars: string = CHARACTER_SETS.lowercase;
    if (opts.excludeSimilar) {
      chars = chars.replace(/[l]/g, '');
    }
    charset += chars;
    requiredChars.push(getRandomChar(chars));
  }
  
  if (opts.includeNumbers) {
    let chars: string = CHARACTER_SETS.numbers;
    if (opts.excludeSimilar) {
      chars = chars.replace(/[01]/g, '');
    }
    charset += chars;
    requiredChars.push(getRandomChar(chars));
  }

  if (opts.includeSymbols) {
    let chars: string = CHARACTER_SETS.symbols;
    if (opts.excludeAmbiguous) {
      for (const char of CHARACTER_SETS.ambiguous) {
        chars = chars.replace(new RegExp(`\\${char}`, 'g'), '');
      }
    }
    if (opts.excludeSimilar) {
      chars = chars.replace(/[|]/g, '');
    }
    charset += chars;
    requiredChars.push(getRandomChar(chars));
  }
  
  if (charset.length === 0) {
    throw new Error('No valid characters available for password generation');
  }
  
  // Generate password ensuring at least one character from each required type
  const password: string[] = [];
  
  // Add required characters first
  for (const char of requiredChars) {
    password.push(char);
  }
  
  // Fill remaining length with random characters
  for (let i = requiredChars.length; i < opts.length; i++) {
    password.push(getRandomChar(charset));
  }
  
  // Shuffle the password array to avoid predictable patterns
  return shuffleArray(password).join('');
}

/**
 * Get a cryptographically secure random character from a charset
 */
function getRandomChar(charset: string): string {
  if (charset.length === 0) {
    throw new Error('Charset cannot be empty');
  }
  
  const randomValues = new Uint32Array(1);
  crypto.getRandomValues(randomValues);
  
  // Use rejection sampling to avoid modulo bias
  const max = Math.floor(0xFFFFFFFF / charset.length) * charset.length;
  let randomValue = randomValues[0];
  
  while (randomValue >= max) {
    crypto.getRandomValues(randomValues);
    randomValue = randomValues[0];
  }
  
  return charset[randomValue % charset.length];
}

/**
 * Cryptographically secure array shuffle using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    
    // Use rejection sampling for uniform distribution
    const max = Math.floor(0xFFFFFFFF / (i + 1)) * (i + 1);
    let randomValue = randomValues[0];
    
    while (randomValue >= max) {
      crypto.getRandomValues(randomValues);
      randomValue = randomValues[0];
    }
    
    const j = randomValue % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

/**
 * Estimate password strength (entropy in bits)
 */
export function calculatePasswordEntropy(password: string): number {
  const charsetSize = estimateCharsetSize(password);
  return Math.log2(Math.pow(charsetSize, password.length));
}

/**
 * Estimate the charset size based on password content
 */
function estimateCharsetSize(password: string): number {
  let charsetSize = 0;
  
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32; // Approximate symbol count
  
  return charsetSize;
}

/**
 * Get password strength description
 */
export function getPasswordStrength(password: string): {
  entropy: number;
  strength: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Very Strong';
  description: string;
} {
  const entropy = calculatePasswordEntropy(password);
  
  let strength: 'Very Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong' | 'Very Strong';
  let description: string;
  
  if (entropy < 30) {
    strength = 'Very Weak';
    description = 'This password is very weak and can be cracked quickly.';
  } else if (entropy < 40) {
    strength = 'Weak';
    description = 'This password is weak and vulnerable to attacks.';
  } else if (entropy < 50) {
    strength = 'Fair';
    description = 'This password is fair but could be stronger.';
  } else if (entropy < 60) {
    strength = 'Good';
    description = 'This password is good and reasonably secure.';
  } else if (entropy < 80) {
    strength = 'Strong';
    description = 'This password is strong and very secure.';
  } else {
    strength = 'Very Strong';
    description = 'This password is very strong and extremely secure.';
  }
  
  return { entropy, strength, description };
}

/**
 * Generate multiple password options for user selection
 */
export function generatePasswordOptions(
  count: number = 5,
  options: Partial<PasswordOptions> = {}
): string[] {
  const passwords: string[] = [];
  
  for (let i = 0; i < count; i++) {
    passwords.push(generatePassword(options));
  }
  
  return passwords;
}

/**
 * Validate password against common requirements
 */
export function validatePassword(password: string, minLength: number = 8): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

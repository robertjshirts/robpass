/**
 * Security-Focused Logging System for RobPass
 * 
 * This module provides secure logging utilities that ensure no sensitive data
 * (passwords, keys, plaintext) is ever logged or exposed in error messages.
 * It includes audit logging for authentication events and security incidents.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export enum LogCategory {
  AUTH = 'AUTH',
  CRYPTO = 'CRYPTO',
  VAULT = 'VAULT',
  SESSION = 'SESSION',
  SECURITY = 'SECURITY',
  API = 'API',
  UI = 'UI'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  clientIP?: string;
  userAgent?: string;
}

export interface SecurityEvent {
  type: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'REGISTRATION' | 
        'VAULT_ACCESS' | 'VAULT_CREATE' | 'VAULT_UPDATE' | 'VAULT_DELETE' |
        'SESSION_EXPIRED' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_TOKEN' |
        'CRYPTO_ERROR' | 'UNAUTHORIZED_ACCESS';
  userId?: string;
  username?: string;
  details?: Record<string, any>;
}

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  /password/i,
  /masterkey/i,
  /master_key/i,
  /authenticationhash/i,
  /authentication_hash/i,
  /sessiontoken/i,
  /session_token/i,
  /salt/i,
  /iv/i,
  /encrypted_data/i,
  /ciphertext/i,
  /plaintext/i,
  /privatekey/i,
  /private_key/i,
  /secret/i,
  /token/i
];

/**
 * Sanitize data to remove sensitive information
 */
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    // Check if the string itself might be sensitive
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(data)) {
        return '[REDACTED]';
      }
    }
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item));
    }
    
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      // Check if key name suggests sensitive data
      const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
      
      if (isSensitiveKey) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Format error message without exposing sensitive data
 */
function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  let message = error instanceof Error ? error.message : String(error);
  
  // Remove potential sensitive data from error messages
  for (const pattern of SENSITIVE_PATTERNS) {
    message = message.replace(pattern, '[REDACTED]');
  }
  
  // Remove stack traces in production
  if (process.env.NODE_ENV === 'production') {
    message = message.split('\n')[0]; // Only keep the first line
  }
  
  return message;
}

/**
 * Get client information safely
 */
function getClientInfo(request?: Request): { ip?: string; userAgent?: string } {
  if (!request) return {};
  
  try {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    return { ip, userAgent };
  } catch {
    return {};
  }
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  metadata?: Record<string, any>,
  request?: Request
): void {
  // Skip debug logs in production
  if (process.env.NODE_ENV === 'production' && level === LogLevel.DEBUG) {
    return;
  }
  
  const clientInfo = getClientInfo(request);
  
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message: sanitizeErrorMessage(message),
    metadata: metadata ? sanitizeData(metadata) : undefined,
    clientIP: clientInfo.ip,
    userAgent: clientInfo.userAgent
  };
  
  // In development, log to console with colors
  if (process.env.NODE_ENV === 'development') {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.CRITICAL]: '\x1b[35m' // Magenta
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    console.log(
      `${color}[${LogLevel[level]}]${reset} ${category}: ${logEntry.message}`,
      logEntry.metadata ? logEntry.metadata : ''
    );
  }
  
  // In production, you would send logs to a secure logging service
  // For now, we'll use structured console logging
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Public logging interface
 */
export const SecurityLogger = {
  debug: (category: LogCategory, message: string, metadata?: Record<string, any>, request?: Request) => 
    log(LogLevel.DEBUG, category, message, metadata, request),
    
  info: (category: LogCategory, message: string, metadata?: Record<string, any>, request?: Request) => 
    log(LogLevel.INFO, category, message, metadata, request),
    
  warn: (category: LogCategory, message: string, metadata?: Record<string, any>, request?: Request) => 
    log(LogLevel.WARN, category, message, metadata, request),
    
  error: (category: LogCategory, message: string, metadata?: Record<string, any>, request?: Request) => 
    log(LogLevel.ERROR, category, message, metadata, request),
    
  critical: (category: LogCategory, message: string, metadata?: Record<string, any>, request?: Request) => 
    log(LogLevel.CRITICAL, category, message, metadata, request),
    
  /**
   * Log security events with structured data
   */
  securityEvent: (event: SecurityEvent, request?: Request) => {
    const sanitizedEvent = sanitizeData(event);
    log(
      LogLevel.INFO,
      LogCategory.SECURITY,
      `Security event: ${event.type}`,
      sanitizedEvent,
      request
    );
  },
  
  /**
   * Log authentication events
   */
  authEvent: (
    type: 'LOGIN_ATTEMPT' | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'REGISTRATION',
    username?: string,
    details?: Record<string, any>,
    request?: Request
  ) => {
    log(
      type.includes('FAILURE') ? LogLevel.WARN : LogLevel.INFO,
      LogCategory.AUTH,
      `Auth event: ${type}`,
      {
        username: username || 'unknown',
        ...sanitizeData(details || {})
      },
      request
    );
  }
};

/**
 * Create user-friendly error messages
 */
export function createUserFriendlyError(error: any, fallbackMessage: string = 'An error occurred'): string {
  if (!error) return fallbackMessage;
  
  // Map common error patterns to user-friendly messages
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }
  
  if (errorMessage.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return 'Authentication failed. Please log in again.';
  }
  
  if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
    return 'Invalid input. Please check your data and try again.';
  }
  
  if (errorMessage.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  // Return sanitized fallback message
  return fallbackMessage;
}

/**
 * Error boundary helper for React components
 */
export function logComponentError(
  error: Error,
  errorInfo: { componentStack: string },
  componentName: string
): void {
  SecurityLogger.error(
    LogCategory.UI,
    `Component error in ${componentName}`,
    {
      error: sanitizeErrorMessage(error),
      componentStack: errorInfo.componentStack.split('\n').slice(0, 5).join('\n') // Limit stack trace
    }
  );
}

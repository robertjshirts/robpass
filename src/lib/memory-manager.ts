/**
 * Memory Management for Sensitive Data in RobPass
 * 
 * This module provides utilities for managing sensitive data in volatile memory,
 * ensuring proper cleanup and preventing accidental exposure of master keys
 * and other cryptographic material.
 */

export interface SecureSession {
  masterKey: CryptoKey | null;
  username: string | null;
  sessionToken: string | null;
  isActive: boolean;
  lastActivity: number;
}

// Global session state - stored in volatile memory
let currentSession: SecureSession = {
  masterKey: null,
  username: null,
  sessionToken: null,
  isActive: false,
  lastActivity: 0
};

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

/**
 * Initialize a new secure session with master key
 */
export function initializeSession(
  masterKey: CryptoKey,
  username: string,
  sessionToken: string
): void {
  currentSession = {
    masterKey,
    username,
    sessionToken,
    isActive: true,
    lastActivity: Date.now()
  };
  
  // Store session token in sessionStorage as specified in requirements
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem('robpass_session_token', sessionToken);
    window.sessionStorage.setItem('robpass_username', username);
  }
  
  // Set up automatic session cleanup
  setupSessionTimeout();
}

/**
 * Get the current master key if session is active
 */
export function getMasterKey(): CryptoKey | null {
  if (!isSessionActive()) {
    return null;
  }
  
  updateLastActivity();
  return currentSession.masterKey;
}

/**
 * Get the current username if session is active
 */
export function getCurrentUsername(): string | null {
  if (!isSessionActive()) {
    return null;
  }
  
  updateLastActivity();
  return currentSession.username;
}

/**
 * Get the current session token if session is active
 */
export function getSessionToken(): string | null {
  if (!isSessionActive()) {
    return null;
  }
  
  updateLastActivity();
  return currentSession.sessionToken;
}

/**
 * Check if the current session is active and not expired
 */
export function isSessionActive(): boolean {
  if (!currentSession.isActive) {
    return false;
  }
  
  const now = Date.now();
  const timeSinceLastActivity = now - currentSession.lastActivity;
  
  if (timeSinceLastActivity > SESSION_TIMEOUT) {
    clearSession();
    return false;
  }
  
  return true;
}

/**
 * Update the last activity timestamp
 */
export function updateLastActivity(): void {
  if (currentSession.isActive) {
    currentSession.lastActivity = Date.now();
  }
}

/**
 * Clear the current session and all sensitive data from memory
 */
export function clearSession(): void {
  // Clear the master key reference
  currentSession.masterKey = null;
  
  // Clear other sensitive data
  currentSession.username = null;
  currentSession.sessionToken = null;
  currentSession.isActive = false;
  currentSession.lastActivity = 0;
  
  // Clear sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem('robpass_session_token');
    window.sessionStorage.removeItem('robpass_username');
  }
  
  // Force garbage collection if available (not guaranteed)
  if (typeof window !== 'undefined' && window.gc) {
    window.gc();
  }
}

/**
 * Set up automatic session timeout
 */
function setupSessionTimeout(): void {
  // Clear any existing timeout
  if (typeof window !== 'undefined') {
    // Set up a periodic check for session expiration
    const checkInterval = setInterval(() => {
      if (!isSessionActive()) {
        clearInterval(checkInterval);
      }
    }, 60000); // Check every minute
  }
}

/**
 * Restore session from sessionStorage on page refresh
 */
export function restoreSessionFromStorage(): {
  sessionToken: string | null;
  username: string | null;
} {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { sessionToken: null, username: null };
  }
  
  const sessionToken = window.sessionStorage.getItem('robpass_session_token');
  const username = window.sessionStorage.getItem('robpass_username');
  
  return { sessionToken, username };
}

/**
 * Extend the current session (reset timeout)
 */
export function extendSession(): boolean {
  if (!currentSession.isActive) {
    return false;
  }
  
  updateLastActivity();
  return true;
}

/**
 * Get session information (without sensitive data)
 */
export function getSessionInfo(): {
  isActive: boolean;
  username: string | null;
  lastActivity: number;
  timeUntilExpiry: number;
} {
  const now = Date.now();
  const timeUntilExpiry = currentSession.isActive 
    ? Math.max(0, SESSION_TIMEOUT - (now - currentSession.lastActivity))
    : 0;
  
  return {
    isActive: currentSession.isActive,
    username: currentSession.username,
    lastActivity: currentSession.lastActivity,
    timeUntilExpiry
  };
}

/**
 * Set up event listeners for automatic session management
 */
export function setupSessionEventListeners(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  // Clear session on page unload
  window.addEventListener('beforeunload', () => {
    clearSession();
  });
  
  // Update activity on user interaction
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  activityEvents.forEach(event => {
    window.addEventListener(event, () => {
      if (currentSession.isActive) {
        updateLastActivity();
      }
    }, { passive: true });
  });
  
  // Handle visibility change (tab switching)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentSession.isActive) {
      updateLastActivity();
    }
  });
}

/**
 * Secure memory cleanup utility
 * Attempts to overwrite sensitive data in memory (best effort in JavaScript)
 */
export function secureMemoryCleanup(): void {
  // Clear any remaining references
  currentSession = {
    masterKey: null,
    username: null,
    sessionToken: null,
    isActive: false,
    lastActivity: 0
  };
  
  // Clear sessionStorage
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear();
  }
  
  // Attempt to trigger garbage collection
  if (typeof window !== 'undefined' && window.gc) {
    window.gc();
  }
}

/**
 * Check if we're in a secure context (HTTPS)
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') {
    return true; // Assume secure in server context
  }
  
  return window.isSecureContext || window.location.protocol === 'https:';
}

/**
 * Validate session security requirements
 */
export function validateSessionSecurity(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!isSecureContext()) {
    errors.push('Application must be served over HTTPS');
  }
  
  if (typeof window !== 'undefined' && !window.crypto) {
    errors.push('Web Crypto API is not available');
  }
  
  if (typeof window !== 'undefined' && !window.sessionStorage) {
    errors.push('SessionStorage is not available');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

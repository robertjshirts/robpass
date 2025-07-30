/**
 * Authentication Guards for RobPass
 * 
 * This module provides client-side authentication guards and utilities
 * for protecting components and handling authentication state.
 * 
 * Security Requirements:
 * - Verify session validity before rendering protected content
 * - Handle automatic logout on session expiration
 * - Provide loading states during authentication checks
 * - Clear sensitive data from memory on logout
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  isSessionActive,
  getCurrentUsername,
  clearSession,
  getSessionToken,
  restoreSessionFromStorage,
  handleBrowserRefresh,
  validateSessionIntegrity
} from './memory-manager';

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: number; username: string } | null;
  error: string | null;
}

/**
 * Custom hook for authentication state management
 */
export function useAuth(): AuthState & {
  login: (user: { id: number; username: string }) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
} {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    error: null
  });
  
  const router = useRouter();

  /**
   * Check authentication status
   */
  const checkAuth = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      // First check if we have an active session in memory with integrity validation
      if (isSessionActive()) {
        const sessionIntegrity = await validateSessionIntegrity();
        if (sessionIntegrity.isValid) {
          const username = getCurrentUsername();
          if (username) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user: { id: 0, username }, // ID will be updated from server validation
              error: null
            });
            return;
          }
        } else {
          // Session integrity failed, clear it
          console.warn('Session integrity check failed:', sessionIntegrity.errors);
          clearSession();
        }
      }

      // Handle browser refresh scenario
      const refreshStatus = handleBrowserRefresh();

      if (!refreshStatus.sessionToken || !refreshStatus.username) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
        return;
      }

      // If we detected a browser refresh, the user needs to re-authenticate
      if (refreshStatus.needsReauth) {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: 'Session expired. Please log in again to access your vault.'
        });
        return;
      }

      // Validate session with server
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: result.data.user,
          error: null
        });
      } else {
        // Session is invalid, clear it
        clearSession();
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null,
          error: null
        });
      }

    } catch (error) {
      console.error('Auth check failed:', error);
      clearSession();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: 'Authentication check failed'
      });
    }
  };

  /**
   * Handle successful login
   */
  const login = (user: { id: number; username: string }) => {
    setAuthState({
      isAuthenticated: true,
      isLoading: false,
      user,
      error: null
    });
  };

  /**
   * Handle logout
   */
  const logout = async () => {
    try {
      // Call logout API to blacklist token
      const sessionToken = getSessionToken();
      if (sessionToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
          }
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear session from memory regardless of API call result
      clearSession();
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null
      });
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  return {
    ...authState,
    login,
    logout,
    checkAuth
  };
}

/**
 * Higher-order component for protecting routes
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options: {
    redirectTo?: string;
    loadingComponent?: React.ComponentType;
    unauthorizedComponent?: React.ComponentType;
  } = {}
) {
  const {
    redirectTo = '/',
    loadingComponent: LoadingComponent,
    unauthorizedComponent: UnauthorizedComponent
  } = options;

  return function AuthGuardedComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectTo);
      }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
      if (LoadingComponent) {
        return <LoadingComponent />;
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Checking authentication...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (UnauthorizedComponent) {
        return <UnauthorizedComponent />;
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You need to be logged in to access this page.
            </p>
            <button
              onClick={() => router.push(redirectTo)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    return <WrappedComponent {...props} />;
  };
}

/**
 * Hook for requiring authentication in components
 */
export function useRequireAuth(redirectTo: string = '/') {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading, user };
}

/**
 * Component for protecting child components
 */
export function AuthGuard({ 
  children, 
  fallback,
  redirectTo = '/'
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  if (isLoading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  return <>{children}</>;
}

/**
 * Utility to check if current session is valid
 */
export async function validateCurrentSession(): Promise<boolean> {
  try {
    const sessionToken = getSessionToken();
    
    if (!sessionToken) {
      return false;
    }

    const response = await fetch('/api/auth/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      }
    });

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Utility for automatic session cleanup on expiration
 */
export function setupSessionCleanup() {
  // Check session validity every 5 minutes
  const interval = setInterval(async () => {
    if (isSessionActive()) {
      const isValid = await validateCurrentSession();
      if (!isValid) {
        clearSession();
        // Optionally redirect to login or show notification
        window.location.href = '/';
      }
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Cleanup on page unload
  const cleanup = () => {
    clearInterval(interval);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', cleanup);
    };
  }

  return cleanup;
}

'use client';

import { useState, useEffect } from 'react';
import RegistrationForm from '@/components/RegistrationForm';
import LoginForm from '@/components/LoginForm';
import VaultDashboard from '@/components/VaultDashboard';
import { ErrorBoundary, useErrorHandler } from '@/components/ErrorBoundary';
import { isSessionActive, getCurrentUsername, clearSession, setupSessionEventListeners } from '@/lib/memory-manager';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';

type AuthMode = 'login' | 'register';

interface User {
  id: number;
  username: string;
}

function HomeContent() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const handleError = useErrorHandler();

  // Check for existing session on component mount
  useEffect(() => {
    const checkSession = () => {
      if (isSessionActive()) {
        const username = getCurrentUsername();
        if (username) {
          setUser({ id: 0, username }); // ID will be updated from server validation
        }
      }
      setIsLoading(false);
    };

    // Handle session expiration events
    const handleSessionExpired = () => {
      setUser(null);
      // Optionally show a notification to the user
      console.log('Session expired. Please log in again.');
    };

    checkSession();
    setupSessionEventListeners();

    // Listen for session expiration events
    if (typeof window !== 'undefined') {
      window.addEventListener('robpass:session-expired', handleSessionExpired);
    }

    // Cleanup event listener on unmount
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('robpass:session-expired', handleSessionExpired);
      }
    };
  }, []);

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
  };

  const handleAuthError = (error: string) => {
    console.error('Authentication error:', error);
  };

  const handleLogout = async () => {
    try {
      // Call logout API to blacklist token
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('robpass_session_token')}`
        }
      });
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear session from memory regardless of API call result
      clearSession();
      setUser(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  🔐 RobPass
                </h1>
                <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                  Welcome back, {user.username}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <VaultDashboard user={user} />

        {/* Footer */}
        <div className="mt-8 py-6 border-t border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>Built with Next.js, Drizzle ORM, and Web Crypto API</p>
            <p className="mt-1">🔒 Your data is encrypted client-side</p>
            <p className="mt-2">
              <a
                href="https://github.com/robertjshirts/robpass"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                View on GitHub
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-md mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🔐 RobPass
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Secure Password Manager with Zero-Knowledge Architecture
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 mb-6">
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              authMode === 'login'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setAuthMode('register')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              authMode === 'register'
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Auth Forms */}
        {authMode === 'login' ? (
          <LoginForm onSuccess={handleAuthSuccess} onError={handleAuthError} />
        ) : (
          <RegistrationForm onSuccess={handleAuthSuccess} onError={handleAuthError} />
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Next.js, Drizzle ORM, and Web Crypto API</p>
          <p className="mt-1">🔒 Your data is encrypted client-side</p>
          <p className="mt-2">
            <a
              href="https://github.com/robertjshirts/robpass"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View on GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        SecurityLogger.error(
          LogCategory.UI,
          'Application error boundary triggered',
          {
            error: error.message,
            componentStack: errorInfo.componentStack?.split('\n').slice(0, 3).join('\n') || 'No stack trace'
          }
        );
      }}
    >
      <HomeContent />
    </ErrorBoundary>
  );
}

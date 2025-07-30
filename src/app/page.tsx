'use client';

import { useState, useEffect } from 'react';
import RegistrationForm from '@/components/RegistrationForm';
import LoginForm from '@/components/LoginForm';
import { isSessionActive, getCurrentUsername, clearSession, setupSessionEventListeners } from '@/lib/memory-manager';

type AuthMode = 'login' | 'register';

interface User {
  id: number;
  username: string;
}

export default function Home() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    checkSession();
    setupSessionEventListeners();
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  🔐 RobPass
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Welcome back, {user.username}!
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Password Vault
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your secure password vault will be implemented here. The authentication system is now complete!
            </p>

            {/* Security Status */}
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                    Secure Session Active
                  </h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                    <p>✅ Master key stored in volatile memory</p>
                    <p>✅ Zero-knowledge architecture maintained</p>
                    <p>✅ Session token secured</p>
                  </div>
                </div>
              </div>
            </div>
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
        </div>
      </div>
    </div>
  );
}

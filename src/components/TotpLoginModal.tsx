'use client';

import { useState } from 'react';
import { deriveTotpSecret, verifyTotpCode } from '@/lib/totp';

interface TotpLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  onUseBackupCode: () => void;
  username: string;
  masterKey: CryptoKey;
}

export default function TotpLoginModal({
  isOpen,
  onClose,
  onSuccess,
  onUseBackupCode,
  username,
  masterKey
}: TotpLoginModalProps) {
  const [totpCode, setTotpCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleVerifyCode = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Step 1: Derive TOTP secret from master key (client-side)
      const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);
      const totpSecret = await deriveTotpSecret(masterKeyRaw, username);

      // Step 2: Verify TOTP code client-side
      const isValid = await verifyTotpCode(totpSecret, totpCode);
      if (!isValid) {
        setError('Invalid TOTP code. Please try again.');
        return;
      }

      // Step 3: Call server to complete login (server trusts client-side verification)
      const response = await fetch('/api/auth/totp/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          totpCode // Server can optionally validate this for additional security
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete login');
      }

      onSuccess(data.data.sessionToken, data.data.user);
      handleClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify TOTP code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTotpCode('');
    setError('');
    onClose();
  };

  const handleBackupCodeClick = () => {
    // Clear local state but don't call onClose() to preserve authentication state
    setTotpCode('');
    setError('');
    onUseBackupCode();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-blue-100 hover:text-white transition-colors p-1 rounded-full hover:bg-white hover:bg-opacity-20"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start space-x-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium">Authentication Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Enter the 6-digit code from your authenticator app to complete your login.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Authentication Code
              </label>
              <input
                id="totp-code"
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-2xl font-mono tracking-widest bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                maxLength={6}
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={isLoading || totpCode.length !== 6}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Verify Code</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                onClick={handleBackupCodeClick}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Use backup code instead</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

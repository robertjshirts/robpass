'use client';

import { useState } from 'react';

interface BackupCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  onBackToTotp: () => void;
  username: string;
}

export default function BackupCodeModal({
  isOpen,
  onClose,
  onSuccess,
  onBackToTotp,
  username
}: BackupCodeModalProps) {
  const [backupCode, setBackupCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleVerifyCode = async () => {
    if (!backupCode || backupCode.length < 8) {
      setError('Please enter a valid backup code');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch('/api/auth/totp/recover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          backupCode: backupCode.replace(/\s+/g, '').toUpperCase()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify backup code');
      }

      onSuccess(data.data.sessionToken, data.data.user);
      handleClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify backup code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setBackupCode('');
    setError('');
    onClose();
  };

  const handleBackToTotpClick = () => {
    // Clear local state but don't call onClose() to preserve authentication state
    setBackupCode('');
    setError('');
    onBackToTotp();
  };

  const formatBackupCode = (value: string) => {
    // Remove all non-alphanumeric characters and convert to uppercase
    const cleaned = value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    // Add dashes every 4 characters
    return cleaned.replace(/(.{4})/g, '$1-').replace(/-$/, '');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <h2 className="text-xl font-semibold">Backup Code Recovery</h2>
            </div>
            <button
              onClick={handleClose}
              className="text-amber-100 hover:text-white transition-colors p-1 rounded-full hover:bg-white hover:bg-opacity-20"
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
                <p className="font-medium">Recovery Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
              Enter one of your backup codes. Each code can only be used once.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="backup-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Backup Recovery Code
              </label>
              <input
                id="backup-code"
                type="text"
                value={backupCode}
                onChange={(e) => setBackupCode(formatBackupCode(e.target.value))}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg text-center text-xl font-mono tracking-wider bg-gray-50 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={isLoading || backupCode.length < 8}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 px-4 rounded-lg hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center justify-center space-x-2"
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
                  <span>Verify Backup Code</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                onClick={handleBackToTotpClick}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium transition-colors duration-200 flex items-center justify-center space-x-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                <span>Back to authenticator code</span>
              </button>
            </div>

            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900 dark:bg-opacity-20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Important Security Note</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    After using a backup code, consider generating new backup codes from your account settings to maintain security.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

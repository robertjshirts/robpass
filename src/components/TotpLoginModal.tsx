'use client';

import { useState } from 'react';

interface TotpLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
  onBackupCode: () => void;
  username: string;
}

export default function TotpLoginModal({
  isOpen,
  onClose,
  onSuccess,
  onBackupCode,
  username
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

      const response = await fetch('/api/auth/totp/verify-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          totpCode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify TOTP code');
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
    handleClose();
    onBackupCode();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div>
          <p className="text-gray-600 mb-4">
            Enter the 6-digit code from your authenticator app:
          </p>
          
          <input
            type="text"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="w-full p-3 border border-gray-300 rounded mb-4 text-center text-lg font-mono"
            maxLength={6}
            autoFocus
          />

          <button
            onClick={handleVerifyCode}
            disabled={isLoading || totpCode.length !== 6}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
          >
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>

          <div className="text-center">
            <button
              onClick={handleBackupCodeClick}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Use backup code instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

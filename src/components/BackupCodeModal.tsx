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
    handleClose();
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Backup Code Recovery</h2>
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
            Enter one of your backup codes. Each code can only be used once.
          </p>
          
          <input
            type="text"
            value={backupCode}
            onChange={(e) => setBackupCode(formatBackupCode(e.target.value))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="w-full p-3 border border-gray-300 rounded mb-4 text-center text-lg font-mono"
            autoFocus
          />

          <button
            onClick={handleVerifyCode}
            disabled={isLoading || backupCode.length < 8}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
          >
            {isLoading ? 'Verifying...' : 'Verify Backup Code'}
          </button>

          <div className="text-center">
            <button
              onClick={handleBackToTotpClick}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Back to authenticator code
            </button>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> After using a backup code, consider generating new backup codes 
              from your account settings to maintain security.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

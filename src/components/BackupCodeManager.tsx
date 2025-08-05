'use client';

import { useState, useEffect } from 'react';
import { getSessionToken } from '@/lib/memory-manager';

interface BackupCodeManagerProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

interface BackupCodeStatus {
  total: number;
  used: number;
  remaining: number;
}

export default function BackupCodeManager({ isOpen, onClose, username }: BackupCodeManagerProps) {
  const [status, setStatus] = useState<BackupCodeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [showNewCodes, setShowNewCodes] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Load backup code status when component opens
  useEffect(() => {
    if (isOpen) {
      loadBackupCodeStatus();
    }
  }, [isOpen]);

  const loadBackupCodeStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/auth/totp/backup-codes', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load backup code status');
      }

      setStatus(result.data);

    } catch (error) {
      console.error('Error loading backup code status:', error);
      setError(error instanceof Error ? error.message : 'Failed to load backup code status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateConfirm = () => {
    setShowRegenerateConfirm(true);
  };

  const handleRegenerateCancel = () => {
    setShowRegenerateConfirm(false);
  };

  const handleRegenerateBackupCodes = async () => {
    try {
      setIsRegenerating(true);
      setError(null);
      
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/auth/totp/backup-codes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to regenerate backup codes');
      }

      setNewCodes(result.data.backupCodes);
      setShowNewCodes(true);
      setShowRegenerateConfirm(false);
      
      // Refresh status
      await loadBackupCodeStatus();

    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      setError(error instanceof Error ? error.message : 'Failed to regenerate backup codes');
    } finally {
      setIsRegenerating(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `RobPass Backup Codes\n\nUsername: ${username}\nGenerated: ${new Date().toISOString()}\n\n${newCodes.join('\n')}\n\nKeep these codes safe! Each code can only be used once.\nStore them in a secure location separate from your device.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robpass-backup-codes-${username}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setShowNewCodes(false);
    setNewCodes([]);
    setShowRegenerateConfirm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Backup Codes</h2>
            <button
              onClick={handleClose}
              className="text-green-100 hover:text-white transition-colors"
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
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading backup code status...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
              <button
                onClick={loadBackupCodeStatus}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : showNewCodes ? (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
                  New Backup Codes Generated
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                  Save these codes in a secure location. Each code can only be used once.
                </p>
                
                <div className="bg-white dark:bg-gray-700 border rounded p-3 mb-4">
                  <div className="grid grid-cols-1 gap-1 font-mono text-sm">
                    {newCodes.map((code, index) => (
                      <div key={index} className="text-center py-1 px-2 bg-gray-50 dark:bg-gray-600 rounded">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={downloadBackupCodes}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Download Codes
                  </button>
                  <button
                    onClick={() => setShowNewCodes(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          ) : showRegenerateConfirm ? (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Regenerate Backup Codes?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    This will invalidate all existing backup codes and generate new ones. Make sure to save the new codes securely.
                  </p>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Warning:</strong> Any unused backup codes will no longer work after regeneration.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleRegenerateCancel}
                  disabled={isRegenerating}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerateBackupCodes}
                  disabled={isRegenerating}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isRegenerating ? 'Regenerating...' : 'Yes, Regenerate'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Display */}
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {status?.remaining || 0}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  backup codes remaining
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {status?.used || 0} of {status?.total || 0} codes used
                </p>
              </div>

              {/* Description */}
              <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                <p>
                  Backup codes allow you to access your account if you lose your authenticator device. 
                  Each code can only be used once.
                </p>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleRegenerateConfirm}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Regenerate Backup Codes
                </button>
                
                {(status?.remaining || 0) <= 2 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Low backup codes:</strong> Consider regenerating your backup codes soon.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

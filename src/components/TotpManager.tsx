'use client';

import { useState, useEffect } from 'react';
import TotpSetupModal from './TotpSetupModal';
import BackupCodeManager from './BackupCodeManager';
import { getMasterKey, getSessionToken, getCurrentUsername } from '@/lib/memory-manager';

interface TotpManagerProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: number;
    username: string;
  };
}

interface TotpStatus {
  enabled: boolean;
  loading: boolean;
  error: string | null;
}

export default function TotpManager({ isOpen, onClose, user }: TotpManagerProps) {
  const [totpStatus, setTotpStatus] = useState<TotpStatus>({
    enabled: false,
    loading: true,
    error: null
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [showBackupCodeManager, setShowBackupCodeManager] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  // Check TOTP status when component opens
  useEffect(() => {
    if (isOpen) {
      checkTotpStatus();
    }
  }, [isOpen]);

  const checkTotpStatus = async () => {
    try {
      setTotpStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/auth/totp/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to check TOTP status');
      }

      setTotpStatus({
        enabled: result.data.totp_enabled,
        loading: false,
        error: null
      });

    } catch (error) {
      console.error('Error checking TOTP status:', error);
      setTotpStatus({
        enabled: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check TOTP status'
      });
    }
  };

  const handleEnableTotp = () => {
    setShowSetupModal(true);
  };

  const handleDisableTotp = () => {
    setShowDisableConfirm(true);
  };

  const handleConfirmDisable = async () => {

    try {
      setIsDisabling(true);
      
      const sessionToken = getSessionToken();
      if (!sessionToken) {
        throw new Error('No session token available');
      }

      const response = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to disable TOTP');
      }

      // Refresh status
      await checkTotpStatus();
      setShowDisableConfirm(false);

    } catch (error) {
      console.error('Error disabling TOTP:', error);
      setTotpStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to disable TOTP'
      }));
    } finally {
      setIsDisabling(false);
    }
  };

  const handleCancelDisable = () => {
    setShowDisableConfirm(false);
  };

  const handleManageBackupCodes = () => {
    setShowBackupCodeManager(true);
  };

  const handleCloseBackupCodeManager = () => {
    setShowBackupCodeManager(false);
  };



  const handleSetupSuccess = () => {
    setShowSetupModal(false);
    checkTotpStatus(); // Refresh status
  };

  const handleSetupClose = () => {
    setShowSetupModal(false);
  };

  if (!isOpen) return null;

  const masterKey = getMasterKey();
  const sessionToken = getSessionToken();
  const username = getCurrentUsername();

  return (
    <>
      {/* TOTP Manager Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Two-Factor Authentication</h2>
              <button
                onClick={onClose}
                className="text-blue-100 hover:text-white transition-colors"
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
            {totpStatus.loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Checking TOTP status...</p>
              </div>
            ) : totpStatus.error ? (
              <div className="text-center py-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {totpStatus.error}
                </div>
                <button
                  onClick={checkTotpStatus}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Display */}
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${totpStatus.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Two-Factor Authentication is {totpStatus.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>

                {/* Description */}
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {totpStatus.enabled ? (
                    <p>Your account is protected with Two-Factor Authentication. You'll need to enter a code from your authenticator app when signing in.</p>
                  ) : (
                    <p>Add an extra layer of security to your account by enabling Two-Factor Authentication. You'll need an authenticator app like Google Authenticator or Authy.</p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <div className="flex space-x-3">
                    {totpStatus.enabled ? (
                      <button
                        onClick={handleDisableTotp}
                        disabled={isDisabling || showDisableConfirm}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isDisabling ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                    ) : (
                      <button
                        onClick={handleEnableTotp}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        Enable 2FA
                      </button>
                    )}
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                    >
                      Close
                    </button>
                  </div>

                  {/* Backup Code Management */}
                  {totpStatus.enabled && (
                    <button
                      onClick={handleManageBackupCodes}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Manage Backup Codes</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TOTP Setup Modal */}
      {showSetupModal && masterKey && sessionToken && username && (
        <TotpSetupModal
          isOpen={showSetupModal}
          onClose={handleSetupClose}
          onSuccess={handleSetupSuccess}
          masterKey={masterKey}
          username={username}
          sessionToken={sessionToken}
        />
      )}

      {/* Disable Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-t-lg">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h2 className="text-xl font-semibold">Disable Two-Factor Authentication</h2>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Are you sure you want to disable 2FA?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Disabling Two-Factor Authentication will make your account less secure. You will no longer need to enter a code from your authenticator app when signing in.
                    </p>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
                      <p className="text-sm text-red-800 dark:text-red-200">
                        <strong>Warning:</strong> This action will remove all backup codes and disable TOTP authentication for your account.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleCancelDisable}
                    disabled={isDisabling}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDisable}
                    disabled={isDisabling}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDisabling ? 'Disabling...' : 'Yes, Disable 2FA'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Code Manager */}
      {showBackupCodeManager && username && (
        <BackupCodeManager
          isOpen={showBackupCodeManager}
          onClose={handleCloseBackupCodeManager}
          username={username}
        />
      )}
    </>
  );
}

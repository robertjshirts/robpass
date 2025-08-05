'use client';

/**
 * TOTP Management Component for RobPass
 * 
 * This component handles all TOTP-related functionality including status checking,
 * real-time updates, and user interactions for Two-Factor Authentication.
 */

import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { getSessionToken } from '@/lib/memory-manager';

interface TOTPManagementProps {
  onTotpSettings?: () => void;
  onTotpStatusChange?: (enabled: boolean | null) => void;
}

export interface TOTPManagementRef {
  refreshStatus: () => void;
}

interface TOTPStatus {
  enabled: boolean | null;
  loading: boolean;
}

const TOTPManagement = forwardRef<TOTPManagementRef, TOTPManagementProps>(
  ({ onTotpSettings, onTotpStatusChange }, ref) => {
  const [totpStatus, setTotpStatus] = useState<TOTPStatus>({
    enabled: null,
    loading: true
  });

  /**
   * Check TOTP status from API
   */
  const checkTotpStatus = async () => {
    try {
      setTotpStatus(prev => ({ ...prev, loading: true }));

      const sessionToken = getSessionToken();
      if (!sessionToken) {
        const newStatus = { enabled: null, loading: false };
        setTotpStatus(newStatus);
        onTotpStatusChange?.(null);
        return;
      }

      const response = await fetch('/api/auth/totp/status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const enabled = result.data.totp_enabled || false;
        const newStatus = { enabled, loading: false };
        setTotpStatus(newStatus);
        onTotpStatusChange?.(enabled);
      } else {
        const newStatus = { enabled: null, loading: false };
        setTotpStatus(newStatus);
        onTotpStatusChange?.(null);
      }

    } catch (error) {
      console.error('Error checking TOTP status:', error);
      const newStatus = { enabled: null, loading: false };
      setTotpStatus(newStatus);
      onTotpStatusChange?.(null);
    }
  };

  /**
   * Refresh TOTP status - exposed method for parent components
   */
  const refreshStatus = () => {
    checkTotpStatus();
  };

  // Expose refresh method to parent via ref
  useImperativeHandle(ref, () => ({
    refreshStatus
  }), []);

  // Load TOTP status on component mount
  useEffect(() => {
    checkTotpStatus();
  }, []);

  // Set up periodic refresh to catch external changes
  useEffect(() => {
    const interval = setInterval(() => {
      checkTotpStatus();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for custom events that indicate TOTP status might have changed
  useEffect(() => {
    const handleTotpStatusChange = () => {
      // Small delay to ensure server state is updated
      setTimeout(() => {
        checkTotpStatus();
      }, 1000);
    };

    // Listen for custom events
    window.addEventListener('totp-status-changed', handleTotpStatusChange);

    return () => {
      window.removeEventListener('totp-status-changed', handleTotpStatusChange);
    };
  }, []);

  const handleTotpSettingsClick = () => {
    if (onTotpSettings) {
      onTotpSettings();
    } else {
      alert('To manage Two-Factor Authentication, click on your username in the top right and select "Two-Factor Authentication".');
    }
  };

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Two-Factor Authentication</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {/* TOTP Status Indicator */}
          <div className="flex items-center space-x-2">
            {totpStatus.loading ? (
              <div className="w-3 h-3 bg-blue-300 rounded-full animate-pulse"></div>
            ) : (
              <div className={`w-3 h-3 rounded-full ${
                totpStatus.enabled === true ? 'bg-green-500' :
                totpStatus.enabled === false ? 'bg-yellow-500' : 'bg-gray-400'
              }`}></div>
            )}
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {totpStatus.loading ? 'Checking...' :
               totpStatus.enabled === true ? 'Enabled' :
               totpStatus.enabled === false ? 'Disabled' : 'Unknown'}
            </span>
          </div>
          {/* Action Button */}
          <button
            onClick={handleTotpSettingsClick}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            {totpStatus.enabled === true ? 'Manage 2FA' : 'Enable 2FA'}
          </button>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {totpStatus.enabled === true
            ? 'Your account is protected with Two-Factor Authentication. Great job keeping your passwords secure!'
            : totpStatus.enabled === false
            ? 'Add an extra layer of security to your account by enabling Two-Factor Authentication.'
            : 'Unable to determine 2FA status. Please check your connection and try again.'
          }
        </p>
      </div>
    </div>
  );
});

TOTPManagement.displayName = 'TOTPManagement';

export default TOTPManagement;

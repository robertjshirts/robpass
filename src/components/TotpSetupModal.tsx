'use client';

import { useState, useEffect, useCallback } from 'react';
import { deriveTotpSecret, generateQRCodeDataURL, generateBackupCodes, verifyTotpCode } from '@/lib/totp';
import { encryptData } from '@/lib/crypto';

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  masterKey: CryptoKey;
  username: string;
  sessionToken: string;
}

type SetupStep = 'qr-scan' | 'verification' | 'backup-codes';

export default function TotpSetupModal({
  isOpen,
  onClose,
  onSuccess,
  masterKey,
  username,
  sessionToken
}: TotpSetupModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>('qr-scan');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Timer for TOTP code expiration
  useEffect(() => {
    if (currentStep === 'verification') {
      const interval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = 30 - (now % 30);
        setTimeRemaining(remaining);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [currentStep]);

  useEffect(() => {
    if (isOpen && currentStep === 'qr-scan') {
      initializeTotpSetup();
    }
  }, [isOpen, currentStep, masterKey, username]);

  const initializeTotpSetup = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Export master key to raw format for TOTP derivation
      const masterKeyRaw = await crypto.subtle.exportKey('raw', masterKey);

      // Derive TOTP secret from master key
      const secret = await deriveTotpSecret(masterKeyRaw, username);
      setTotpSecret(secret);

      // Generate QR code
      const qrUrl = await generateQRCodeDataURL(secret, username);
      setQrCodeUrl(qrUrl);

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);

    } catch (err) {
      setError('Failed to initialize TOTP setup');
      console.error('TOTP setup initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToStep = useCallback(async (step: SetupStep) => {
    setIsTransitioning(true);
    setError('');

    // Small delay for smooth transition
    await new Promise(resolve => setTimeout(resolve, 150));

    setCurrentStep(step);
    setIsTransitioning(false);
  }, []);

  const formatVerificationCode = (value: string) => {
    // Only allow digits and limit to 6 characters
    const digits = value.replace(/\D/g, '').slice(0, 6);
    return digits;
  };

  const copyAllBackupCodes = async () => {
    try {
      const codesText = backupCodes.join('\n');
      await navigator.clipboard.writeText(codesText);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy backup codes:', err);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      // Verify TOTP code client-side
      const isValid = await verifyTotpCode(totpSecret, verificationCode);
      if (!isValid) {
        setError('Invalid TOTP code. Please try again.');
        return;
      }

      // Encrypt the TOTP secret with the master key
      const { ciphertext, iv } = await encryptData(totpSecret, masterKey);

      // Send encrypted secret and backup codes to server
      const response = await fetch('/api/auth/totp/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          encryptedSecret: ciphertext,
          secretIv: iv,
          totpCode: verificationCode,
          backupCodes: backupCodes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable TOTP');
      }

      await navigateToStep('backup-codes');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify TOTP code');
      console.error('TOTP verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
    onClose();
    // Reset state
    setCurrentStep('qr-scan');
    setQrCodeUrl('');
    setTotpSecret('');
    setBackupCodes([]);
    setVerificationCode('');
    setError('');
  };

  const downloadBackupCodes = () => {
    const content = `RobPass Backup Codes\n\nUsername: ${username}\nGenerated: ${new Date().toISOString()}\n\n${backupCodes.join('\n')}\n\nKeep these codes safe! Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `robpass-backup-codes-${username}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    onClose();
    // Reset state when closing
    setCurrentStep('qr-scan');
    setQrCodeUrl('');
    setTotpSecret('');
    setBackupCodes([]);
    setVerificationCode('');
    setError('');
  };

  const getStepNumber = (step: SetupStep): number => {
    switch (step) {
      case 'qr-scan': return 1;
      case 'verification': return 2;
      case 'backup-codes': return 3;
      default: return 1;
    }
  };

  const getStepTitle = (step: SetupStep): string => {
    switch (step) {
      case 'qr-scan': return 'Scan QR Code';
      case 'verification': return 'Verify Setup';
      case 'backup-codes': return 'Save Backup Codes';
      default: return 'Setup Two-Factor Authentication';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[95vh] flex flex-col min-h-0">
        {/* Header - Fixed */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex-shrink-0">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Enable Two-Factor Authentication</h2>
            <button
              onClick={handleClose}
              className="text-blue-100 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                    getStepNumber(currentStep) >= stepNum
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-500 text-blue-100'
                  }`}>
                    {getStepNumber(currentStep) > stepNum ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  {stepNum < 3 && (
                    <div className={`w-12 h-0.5 transition-all duration-300 ${
                      getStepNumber(currentStep) > stepNum ? 'bg-white' : 'bg-blue-500'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <div className="text-blue-100 text-sm">
              Step {getStepNumber(currentStep)} of 3
            </div>
          </div>

          <div className="mt-2">
            <h3 className="text-lg font-medium">{getStepTitle(currentStep)}</h3>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="p-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mb-6 flex items-start">
              <svg className="w-5 h-5 text-red-400 dark:text-red-500 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className={`transition-all duration-300 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
            {currentStep === 'qr-scan' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mb-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m6-4h.01M12 8h.01M12 8h4.01M12 8H7.99M12 8V4m0 0H7.99M12 4h4.01" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Scan QR Code</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Use your authenticator app to scan this QR code
                    </p>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
                    </div>
                  ) : qrCodeUrl ? (
                    <div className="space-y-4">
                      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 inline-block">
                        <img
                          src={qrCodeUrl}
                          alt="TOTP QR Code for Authenticator Apps"
                          className="w-64 h-64 mx-auto block"
                          style={{ imageRendering: 'crisp-edges' }}
                        />
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2 font-medium">
                          Can't scan the QR code? Enter this key manually:
                        </p>
                        <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                          <code className="text-xs font-mono text-gray-800 dark:text-gray-200 break-all select-all">
                            {totpSecret}
                          </code>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Click the code above to select all
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => navigateToStep('verification')}
                    disabled={isLoading || !qrCodeUrl}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    Next: Verify Setup
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'verification' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Verify Your Setup</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Verification Code
                    </label>
                    <input
                      id="verification-code"
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(formatVerificationCode(e.target.value))}
                      placeholder="000000"
                      className="w-full p-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-center text-2xl font-mono tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      maxLength={6}
                      autoFocus
                      autoComplete="off"
                    />
                  </div>

                  {/* Timer Display */}
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Code expires in {timeRemaining} seconds</span>
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                      <div
                        className="bg-blue-600 dark:bg-blue-500 h-1 rounded-full transition-all duration-1000"
                        style={{ width: `${(timeRemaining / 30) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Tip:</strong> If the code doesn't work, wait for a new code to generate in your app and try again.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigateToStep('qr-scan')}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={isLoading || verificationCode.length !== 6}
                    className="flex-2 px-6 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      'Verify & Continue'
                    )}
                  </button>
                </div>
              </div>
            )}

            {currentStep === 'backup-codes' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-3">
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Save Your Backup Codes</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Store these codes safely - they're your only way to recover access if you lose your authenticator
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex items-start">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h5 className="text-sm font-medium text-amber-800 dark:text-amber-300">Important Security Notice</h5>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                        Each backup code can only be used once. Store them in a secure location separate from your authenticator app.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code, index) => (
                      <div
                        key={index}
                        className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 font-mono text-xs text-center text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors select-all cursor-pointer"
                        title="Click to select"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={copyAllBackupCodes}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy All
                  </button>

                  <button
                    onClick={downloadBackupCodes}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Storage Recommendations:</h5>
                  <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• Print and store in a secure physical location</li>
                    <li>• Save in a password manager (different from this one)</li>
                    <li>• Store in a secure cloud storage service</li>
                    <li>• Never store them in plain text on your device</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigateToStep('verification')}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleComplete}
                    className="flex-2 px-6 py-2 bg-green-600 dark:bg-green-600 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-700 transition-colors font-medium flex items-center justify-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Complete Setup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

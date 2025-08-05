'use client';

import { useState, useEffect } from 'react';
import { deriveTotpSecret, generateQRCodeDataURL, generateBackupCodes, generateTotpCode, verifyTotpCode } from '@/lib/totp';
import { encryptData } from '@/lib/crypto';

interface TotpSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  masterKey: CryptoKey;
  username: string;
  sessionToken: string;
}

export default function TotpSetupModal({
  isOpen,
  onClose,
  onSuccess,
  masterKey,
  username,
  sessionToken
}: TotpSetupModalProps) {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && step === 'setup') {
      initializeTotpSetup();
    }
  }, [isOpen, step, masterKey, username]);

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

      setStep('backup');

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
    setStep('setup');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Enable Two-Factor Authentication</h2>
          <button
            onClick={onClose}
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

        {step === 'setup' && (
          <div>
            <p className="text-gray-600 mb-4">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : qrCodeUrl ? (
              <div className="text-center mb-4">
                <img src={qrCodeUrl} alt="TOTP QR Code" className="mx-auto mb-4" />
                <p className="text-sm text-gray-500 mb-2">
                  Can't scan? Enter this code manually:
                </p>
                <code className="bg-gray-100 px-2 py-1 rounded text-sm break-all">
                  {totpSecret}
                </code>
              </div>
            ) : null}

            <button
              onClick={() => setStep('verify')}
              disabled={isLoading || !qrCodeUrl}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Continue to Verification
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div>
            <p className="text-gray-600 mb-4">
              Enter the 6-digit code from your authenticator app to verify the setup:
            </p>
            
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full p-3 border border-gray-300 rounded mb-4 text-center text-lg font-mono"
              maxLength={6}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setStep('setup')}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
              >
                Back
              </button>
              <button
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div>
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <strong>Important:</strong> Save these backup codes in a safe place. Each code can only be used once.
            </div>

            <div className="bg-gray-50 p-4 rounded mb-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, index) => (
                  <div key={index} className="bg-white p-2 rounded border">
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={downloadBackupCodes}
                className="flex-1 bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700"
              >
                Download Codes
              </button>
              <button
                onClick={handleComplete}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700"
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

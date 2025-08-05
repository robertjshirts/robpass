'use client';

import { useState } from 'react';
import TotpSetupModal from './TotpSetupModal';

/**
 * Demo component showing how to use the enhanced TotpSetupModal
 * This is for demonstration purposes only - remove in production
 */
export default function TotpSetupModalDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Mock data for demo purposes
  const mockMasterKey = {} as CryptoKey; // In real usage, this would be the actual master key
  const mockUsername = 'demo@example.com';
  const mockSessionToken = 'mock-session-token';

  const handleSuccess = () => {
    console.log('TOTP setup completed successfully!');
    alert('TOTP setup completed successfully!');
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">TOTP Setup Modal Demo</h1>
        <p className="text-gray-600 mb-6">
          Click the button below to see the enhanced TOTP setup modal with multi-step carousel interface.
        </p>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Open TOTP Setup Modal
        </button>

        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Features Demonstrated:</h2>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Multi-step carousel interface (3 steps)</li>
            <li>• Progress indicator with visual feedback</li>
            <li>• QR code generation and display</li>
            <li>• Manual key entry option</li>
            <li>• Real-time TOTP code validation</li>
            <li>• Countdown timer for code expiration</li>
            <li>• Backup codes display and management</li>
            <li>• Copy and download functionality</li>
            <li>• Smooth transitions and loading states</li>
            <li>• Responsive design and accessibility</li>
          </ul>
        </div>
      </div>

      <TotpSetupModal
        isOpen={isModalOpen}
        onClose={handleClose}
        onSuccess={handleSuccess}
        masterKey={mockMasterKey}
        username={mockUsername}
        sessionToken={mockSessionToken}
      />
    </div>
  );
}

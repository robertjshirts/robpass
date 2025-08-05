/**
 * Test file for TOTPManagement component
 * This test verifies that the component renders correctly and handles TOTP status updates
 */

import { render, screen, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import TOTPManagement from '../TOTPManagement';

// Mock the memory manager
jest.mock('@/lib/memory-manager', () => ({
  getSessionToken: jest.fn(() => 'mock-session-token')
}));

// Mock fetch
global.fetch = jest.fn();

describe('TOTPManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders TOTP management section', async () => {
    // Mock successful TOTP status response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { totp_enabled: false }
      })
    });

    render(<TOTPManagement />);

    // Check if the component renders
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    
    // Wait for status to load
    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  it('shows enabled status when TOTP is enabled', async () => {
    // Mock successful TOTP status response with enabled status
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { totp_enabled: true }
      })
    });

    render(<TOTPManagement />);

    // Wait for status to load
    await waitFor(() => {
      expect(screen.getByText('Enabled')).toBeInTheDocument();
      expect(screen.getByText('Manage 2FA')).toBeInTheDocument();
    });
  });

  it('calls onTotpStatusChange callback when status changes', async () => {
    const mockCallback = jest.fn();
    
    // Mock successful TOTP status response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { totp_enabled: true }
      })
    });

    render(<TOTPManagement onTotpStatusChange={mockCallback} />);

    // Wait for status to load and callback to be called
    await waitFor(() => {
      expect(mockCallback).toHaveBeenCalledWith(true);
    });
  });

  it('handles API errors gracefully', async () => {
    // Mock failed TOTP status response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'API Error'
      })
    });

    render(<TOTPManagement />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });
});

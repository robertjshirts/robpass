'use client';

/**
 * Vault Dashboard Component for RobPass
 * 
 * This component manages the main vault interface, displaying all vault items
 * and providing functionality to add, edit, and delete items.
 */

import { useState, useEffect } from 'react';
import VaultItem, { VaultItemData } from './VaultItem';
import AddVaultItem from './AddVaultItem';
import { ErrorDisplay, useErrorHandler } from './ErrorBoundary';
import { SecurityLogger, LogCategory } from '@/lib/security-logger';
import { getSessionToken } from '@/lib/memory-manager';

interface VaultDashboardProps {
  user: {
    id: number;
    username: string;
  };
}

export default function VaultDashboard({ user }: VaultDashboardProps) {
  const [vaultItems, setVaultItems] = useState<VaultItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const handleError = useErrorHandler();

  /**
   * Load vault items from API
   */
  const loadVaultItems = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const sessionToken = sessionStorage.getItem('robpass_session_token');
      const response = await fetch('/api/vault/items', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load vault items');
      }

      setVaultItems(result.data.items);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load vault items';
      handleError(error instanceof Error ? error : new Error(errorMessage), 'VaultDashboard.loadVaultItems');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  /**
   * Handle adding a new vault item
   */
  const handleAddItem = (newItem: VaultItemData) => {
    setVaultItems(prev => [newItem, ...prev]);
    setShowAddForm(false);
  };

  /**
   * Handle updating a vault item
   */
  const handleUpdateItem = (id: number, updatedItem: VaultItemData) => {
    setVaultItems(prev => 
      prev.map(item => item.id === id ? updatedItem : item)
    );
  };

  /**
   * Handle deleting a vault item
   */
  const handleDeleteItem = (id: number) => {
    setVaultItems(prev => prev.filter(item => item.id !== id));
  };

  /**
   * Filter items based on search query
   */
  const filteredItems = vaultItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load vault items on component mount
  useEffect(() => {
    loadVaultItems();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Password Vault
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {vaultItems.length} {vaultItems.length === 1 ? 'password' : 'passwords'} stored securely
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Password
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search passwords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error Display */}
      <ErrorDisplay
        error={error}
        onRetry={loadVaultItems}
        onDismiss={() => setError(null)}
        className="mb-6"
      />

      {/* Add Item Form */}
      {showAddForm && (
        <div className="mb-6">
          <AddVaultItem
            onAdd={handleAddItem}
            onCancel={() => setShowAddForm(false)}
          />
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your passwords...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && vaultItems.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No passwords yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by adding your first password to the vault.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add Your First Password
          </button>
        </div>
      )}

      {/* No Search Results */}
      {!isLoading && !error && vaultItems.length > 0 && filteredItems.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No results found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No passwords match your search for "{searchQuery}".
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Vault Items List */}
      {!isLoading && !error && filteredItems.length > 0 && (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <VaultItem
              key={item.id}
              item={item}
              onUpdate={handleUpdateItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {/* Security Notice */}
      {!isLoading && !error && vaultItems.length > 0 && (
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Security Information
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <ul className="list-disc list-inside space-y-1">
                  <li>All passwords are encrypted with AES-256-GCM before storage</li>
                  <li>Your master key never leaves your device</li>
                  <li>Zero-knowledge architecture ensures maximum security</li>
                  <li>Session automatically expires after 30 minutes of inactivity</li>

                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Vault Item Component for RobPass
 * 
 * This component displays and manages individual vault items (encrypted passwords).
 * It handles decryption for display and provides edit/delete functionality.
 */

import { useState } from 'react';
import { decryptCredentials, encryptCredentials, EncryptedData } from '@/lib/crypto';
import { getMasterKey } from '@/lib/memory-manager';

export interface VaultItemData {
  id: number;
  name: string;
  encrypted_data: string;
  iv: string;
  created_at: string;
  updated_at: string;
}

export interface DecryptedCredentials {
  username: string;
  password: string;
  uri?: string;
}

interface VaultItemProps {
  item: VaultItemData;
  onUpdate: (id: number, updatedItem: VaultItemData) => void;
  onDelete: (id: number) => void;
}

export default function VaultItem({ item, onUpdate, onDelete }: VaultItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [decryptedData, setDecryptedData] = useState<DecryptedCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: item.name,
    username: '',
    password: '',
    uri: ''
  });

  /**
   * Decrypt and display vault item data
   */
  const handleDecrypt = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const masterKey = getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.');
      }

      const encryptedData: EncryptedData = {
        ciphertext: item.encrypted_data,
        iv: item.iv
      };

      const credentials = await decryptCredentials(encryptedData, masterKey);
      setDecryptedData(credentials);
      setIsExpanded(true);

      // Populate edit form
      setEditForm({
        name: item.name,
        username: credentials.username,
        password: credentials.password,
        uri: credentials.uri || ''
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to decrypt data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle edit form submission
   */
  const handleSaveEdit = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const masterKey = getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.');
      }

      // Encrypt the updated credentials
      const credentials: DecryptedCredentials = {
        username: editForm.username,
        password: editForm.password,
        uri: editForm.uri || undefined
      };

      const encryptedData = await encryptCredentials(credentials, masterKey);

      // Prepare update data
      const updateData = {
        name: editForm.name.trim(),
        encrypted_data: encryptedData.ciphertext,
        iv: encryptedData.iv
      };

      // Call API to update item
      const sessionToken = sessionStorage.getItem('robpass_session_token');
      const response = await fetch(`/api/vault/items/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update item');
      }

      // Update local state
      setDecryptedData(credentials);
      onUpdate(item.id, result.data.item);
      setIsEditing(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle delete confirmation
   */
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sessionToken = sessionStorage.getItem('robpass_session_token');
      const response = await fetch(`/api/vault/items/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete item');
      }

      onDelete(item.id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete item';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Copy text to clipboard
   */
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(`${label} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <span className="text-blue-600 dark:text-blue-400 font-semibold">
                {item.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {item.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Updated {new Date(item.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isExpanded && (
              <button
                onClick={handleDecrypt}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
              >
                {isLoading ? 'Decrypting...' : 'View'}
              </button>
            )}
            
            {isExpanded && (
              <>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md disabled:opacity-50"
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="px-3 py-1 text-sm bg-gray-400 hover:bg-gray-500 text-white rounded-md"
                >
                  Hide
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && decryptedData && (
        <div className="p-4">
          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Website URL (optional)
                </label>
                <input
                  type="url"
                  value={editForm.uri}
                  onChange={(e) => setEditForm(prev => ({ ...prev, uri: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="https://example.com"
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Display Mode */
            <div className="space-y-3">
              {/* Username */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Username:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-900 dark:text-white font-mono">
                    {decryptedData.username}
                  </span>
                  <button
                    onClick={() => copyToClipboard(decryptedData.username, 'Username')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Copy username"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-900 dark:text-white font-mono">
                    {showPassword ? decryptedData.password : '••••••••'}
                  </span>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(decryptedData.password, 'Password')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Copy password"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Website URL */}
              {decryptedData.uri && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Website:</span>
                  <div className="flex items-center space-x-2">
                    <a
                      href={decryptedData.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-mono"
                    >
                      {decryptedData.uri}
                    </a>
                    <button
                      onClick={() => copyToClipboard(decryptedData.uri!, 'URL')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="Copy URL"
                    >
                      📋
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

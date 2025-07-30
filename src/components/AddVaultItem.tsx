'use client';

/**
 * Add Vault Item Component for RobPass
 * 
 * This component provides a form for adding new vault items (encrypted passwords).
 * It handles client-side encryption before sending data to the server.
 */

import { useState } from 'react';
import { encryptCredentials } from '@/lib/crypto';
import { getMasterKey } from '@/lib/memory-manager';
import { generatePassword, generatePasswordOptions, getPasswordStrength } from '@/lib/password-generator';
import { VaultItemData, DecryptedCredentials } from './VaultItem';

interface AddVaultItemProps {
  onAdd: (newItem: VaultItemData) => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  username: string;
  password: string;
  uri: string;
}

interface FormErrors {
  name?: string;
  username?: string;
  password?: string;
  uri?: string;
  general?: string;
}

export default function AddVaultItem({ onAdd, onCancel }: AddVaultItemProps) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    username: '',
    password: '',
    uri: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordGenerator, setShowPasswordGenerator] = useState(false);
  const [generatedPasswords, setGeneratedPasswords] = useState<string[]>([]);

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length > 255) {
      newErrors.name = 'Name must be less than 255 characters';
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    // URI validation (optional but must be valid if provided)
    if (formData.uri.trim()) {
      try {
        new URL(formData.uri.trim());
      } catch {
        newErrors.uri = 'Please enter a valid URL';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const masterKey = getMasterKey();
      if (!masterKey) {
        throw new Error('Master key not available. Please log in again.');
      }

      // Prepare credentials for encryption
      const credentials: DecryptedCredentials = {
        username: formData.username.trim(),
        password: formData.password,
        uri: formData.uri.trim() || undefined
      };

      // Encrypt the credentials
      const encryptedData = await encryptCredentials(credentials, masterKey);

      // Prepare API request data
      const requestData = {
        name: formData.name.trim(),
        encrypted_data: encryptedData.ciphertext,
        iv: encryptedData.iv
      };

      // Submit to API
      const sessionToken = sessionStorage.getItem('robpass_session_token');
      const response = await fetch('/api/vault/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create vault item');
      }

      // Clear form and notify parent
      setFormData({
        name: '',
        username: '',
        password: '',
        uri: ''
      });

      onAdd(result.data.item);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create vault item';
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle input changes
   */
  const handleInputChange = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  /**
   * Generate password options
   */
  const handleGeneratePasswords = () => {
    const passwords = generatePasswordOptions(5, {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true
    });
    setGeneratedPasswords(passwords);
    setShowPasswordGenerator(true);
  };

  /**
   * Select a generated password
   */
  const selectGeneratedPassword = (password: string) => {
    setFormData(prev => ({ ...prev, password }));
    setShowPasswordGenerator(false);
    setGeneratedPasswords([]);
    
    // Clear password error if it exists
    if (errors.password) {
      setErrors(prev => ({ ...prev, password: undefined }));
    }
  };

  // Calculate password strength
  const passwordStrength = formData.password ? getPasswordStrength(formData.password) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Add New Password
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name Field */}
        <div>
          <label 
            htmlFor="name" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={handleInputChange('name')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.name 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="e.g., Gmail, Facebook, Work Email"
            disabled={isLoading}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
          )}
        </div>

        {/* Username Field */}
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Username/Email *
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={handleInputChange('username')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.username 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="your.email@example.com"
            disabled={isLoading}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password *
            </label>
            <button
              type="button"
              onClick={handleGeneratePasswords}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              disabled={isLoading}
            >
              Generate Password
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={formData.password}
              onChange={handleInputChange('password')}
              className={`w-full px-3 py-2 pr-10 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
                errors.password 
                  ? 'border-red-500 focus:border-red-500' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter a strong password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              disabled={isLoading}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.password}</p>
          )}
          
          {/* Password Strength Indicator */}
          {passwordStrength && (
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 dark:text-gray-400">Strength:</span>
                <span className={`text-xs font-medium ${
                  passwordStrength.strength === 'Very Strong' ? 'text-green-600' :
                  passwordStrength.strength === 'Strong' ? 'text-green-500' :
                  passwordStrength.strength === 'Good' ? 'text-yellow-500' :
                  passwordStrength.strength === 'Fair' ? 'text-orange-500' :
                  'text-red-500'
                }`}>
                  {passwordStrength.strength}
                </span>
                <span className="text-xs text-gray-500">({Math.round(passwordStrength.entropy)} bits)</span>
              </div>
            </div>
          )}
        </div>

        {/* Password Generator */}
        {showPasswordGenerator && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generated Passwords (click to select):
            </h4>
            <div className="space-y-1">
              {generatedPasswords.map((password, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectGeneratedPassword(password)}
                  className="w-full text-left px-2 py-1 text-sm font-mono bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded border text-gray-900 dark:text-white"
                >
                  {password}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowPasswordGenerator(false)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Close
            </button>
          </div>
        )}

        {/* Website URL Field */}
        <div>
          <label 
            htmlFor="uri" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Website URL (optional)
          </label>
          <input
            type="url"
            id="uri"
            value={formData.uri}
            onChange={handleInputChange('uri')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.uri 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="https://example.com"
            disabled={isLoading}
          />
          {errors.uri && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.uri}</p>
          )}
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isLoading ? 'Adding...' : 'Add Password'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2 px-4 rounded-md font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

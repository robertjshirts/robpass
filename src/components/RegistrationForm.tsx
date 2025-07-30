'use client';

/**
 * User Registration Form Component for RobPass
 * 
 * This component handles user registration with client-side cryptography.
 * It generates salt, derives keys, and submits only the authentication hash
 * to the server, maintaining zero-knowledge architecture.
 */

import { useState } from 'react';
import { generateSalt, deriveKeys, validateCryptoParams } from '@/lib/crypto';
import { initializeSession } from '@/lib/memory-manager';

interface RegistrationFormProps {
  onSuccess?: (user: { id: number; username: string }) => void;
  onError?: (error: string) => void;
}

interface FormData {
  username: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function RegistrationForm({ onSuccess, onError }: RegistrationFormProps) {
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (formData.username.trim().length > 50) {
      newErrors.username = 'Username must be less than 50 characters';
    } else if (!/^[a-zA-Z0-9._@-]+$/.test(formData.username.trim())) {
      newErrors.username = 'Username contains invalid characters';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (formData.password.length > 128) {
      newErrors.password = 'Password must be less than 128 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d])/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, number, and special character';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      // Generate salt client-side
      const salt = generateSalt();
      const iterations = 100000; // Minimum required iterations
      
      // Validate crypto parameters
      validateCryptoParams(iterations, salt);
      
      // Derive master key and authentication hash
      const { masterKey, authenticationHash } = await deriveKeys(
        formData.password,
        salt,
        iterations
      );

      // Prepare registration data (no plaintext password!)
      const registrationData = {
        username: formData.username.trim().toLowerCase(),
        password_salt: salt,
        authentication_hash: authenticationHash,
        kdf_iterations: iterations
      };

      // Submit to server
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      // Initialize session with master key
      // Note: In a real app, you'd typically redirect to login
      // For demo purposes, we'll auto-login after registration
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username.trim().toLowerCase(),
          authentication_hash: authenticationHash
        })
      });

      const loginResult = await loginResponse.json();

      if (loginResponse.ok && loginResult.success) {
        // Initialize session with master key in memory
        initializeSession(
          masterKey,
          result.user.username,
          loginResult.data.sessionToken
        );
      }

      // Clear form data
      setFormData({
        username: '',
        password: '',
        confirmPassword: ''
      });

      // Call success callback
      if (onSuccess) {
        onSuccess(result.user);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setErrors({ general: errorMessage });
      
      if (onError) {
        onError(errorMessage);
      }
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

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
        Create Account
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Field */}
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Username
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
            placeholder="Enter your username"
            disabled={isLoading}
            autoComplete="username"
            aria-describedby={errors.username ? 'username-error' : undefined}
          />
          {errors.username && (
            <p id="username-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.username}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label 
            htmlFor="password" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Password
          </label>
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
              placeholder="Enter your password"
              disabled={isLoading}
              autoComplete="new-password"
              aria-describedby={errors.password ? 'password-error' : undefined}
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
            <p id="password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label 
            htmlFor="confirmPassword" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            id="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleInputChange('confirmPassword')}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white ${
              errors.confirmPassword 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Confirm your password"
            disabled={isLoading}
            autoComplete="new-password"
            aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
          />
          {errors.confirmPassword && (
            <p id="confirm-password-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* General Error */}
        {errors.general && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.general}
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-2 px-4 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating Account...
            </span>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Security Notice */}
      <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
        <p className="text-xs text-blue-600 dark:text-blue-400">
          🔒 Your password is encrypted client-side and never sent to our servers in plaintext.
        </p>
      </div>
    </div>
  );
}

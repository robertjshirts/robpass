'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { SecurityLogger, LogCategory, createUserFriendlyError, logComponentError } from '@/lib/security-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorId: string;
}

/**
 * Error Boundary Component for RobPass
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors securely, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error securely
    logComponentError(error, errorInfo, 'ErrorBoundary');
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg 
                  className="h-8 w-8 text-red-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Something went wrong
                </h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {createUserFriendlyError(
                  this.state.error,
                  'An unexpected error occurred. Please try refreshing the page.'
                )}
              </p>
            </div>
            
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Error ID: {this.state.errorId}
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Refresh Page
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: undefined, errorId: '' })}
                className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-500">
                🔒 Your encrypted data remains secure. This error does not affect your stored passwords.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Hook for handling async errors in functional components
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error: Error, context?: string) => {
    SecurityLogger.error(
      LogCategory.UI,
      `Async error${context ? ` in ${context}` : ''}`,
      {
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      }
    );
    
    // In development, also log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Async error:', error);
    }
  }, []);
  
  return handleError;
}

/**
 * Component for displaying user-friendly error messages
 */
interface ErrorDisplayProps {
  error: string | Error | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, onDismiss, className = '' }: ErrorDisplayProps) {
  if (!error) return null;
  
  const errorMessage = createUserFriendlyError(error);
  
  return (
    <div className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
        <div className="ml-auto flex space-x-2">
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 font-medium"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-sm text-red-400 hover:text-red-300"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

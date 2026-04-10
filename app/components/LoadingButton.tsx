'use client';

/**
 * Reusable button component with loading state and double-click protection
 * Automatically disables and shows loading text during async operations
 */

import React from 'react';

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => Promise<void> | void;
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ loading = false, loadingText = 'Loading...', children, onClick, disabled, ...props }, ref) => {
    const [isLoading, setIsLoading] = React.useState(false);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading || loading) return; // Prevent double-click

      setIsLoading(true);
      try {
        const result = onClick?.(e);
        if (result instanceof Promise) {
          await result;
        }
      } finally {
        setIsLoading(false);
      }
    };

    const isDisabled = disabled || isLoading || loading;
    const displayText = isLoading || loading ? loadingText : children;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        onClick={handleClick}
        {...props}
        className={`
          ${props.className || ''}
          ${isDisabled ? 'opacity-60 cursor-not-allowed' : ''}
        `.trim()}
      >
        {displayText}
      </button>
    );
  }
);

LoadingButton.displayName = 'LoadingButton';

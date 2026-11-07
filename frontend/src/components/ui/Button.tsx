import React, { forwardRef } from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base styles: Rectangular border-radius (2px - 4px strictly, NO pill buttons)
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-[3px] select-none cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary'

    const sizeStyles = {
      sm: 'h-9 pointer-coarse:h-10 text-xs px-3 gap-1.5 leading-none',
      md: 'h-10 text-xs sm:text-sm px-4 gap-2 leading-none',
      lg: 'h-11 sm:h-12 text-sm sm:text-base px-6 gap-2.5 leading-none',
    }

    const variantStyles = {
      primary:
        'bg-accent-teal text-bg-primary hover:bg-accent-teal-hover font-semibold active:translate-y-[1px] shadow-xs',
      secondary:
        'bg-bg-surface hover:bg-bg-surface-hover text-text-primary border border-border-subtle hover:border-border-strong active:translate-y-[1px]',
      outline:
        'bg-transparent hover:bg-bg-surface text-text-primary border border-border-strong hover:border-accent-teal/50 active:translate-y-[1px]',
      danger:
        'bg-state-failure-dim text-state-failure border border-state-failure/40 hover:bg-state-failure/20 active:translate-y-[1px]',
      ghost:
        'bg-transparent hover:bg-bg-surface text-text-secondary hover:text-text-primary active:translate-y-[1px]',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-3.5 w-3.5 text-current shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="shrink-0 flex items-center justify-center">{leftIcon}</span>
        ) : null}
        <span className="truncate">{children}</span>
        {!isLoading && rightIcon && (
          <span className="shrink-0 flex items-center justify-center">{rightIcon}</span>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

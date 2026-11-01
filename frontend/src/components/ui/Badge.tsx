import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'failure' | 'warning' | 'accent' | 'outline'
  size?: 'sm' | 'md'
  children: React.ReactNode
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...rest
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-1.5 py-0.5 tracking-tight',
    md: 'text-xs px-2 py-0.5 tracking-normal',
  }

  const variantStyles = {
    default: 'bg-bg-surface-active text-text-secondary border border-border-subtle',
    success: 'bg-state-success-dim text-state-success border border-state-success/30',
    failure: 'bg-state-failure-dim text-state-failure border border-state-failure/30',
    warning: 'bg-state-warning-dim text-state-warning border border-state-warning/30',
    accent: 'bg-accent-dim text-accent-teal border border-accent-teal/30',
    outline: 'bg-transparent text-text-primary border border-border-strong',
  }

  return (
    <span
      {...rest}
      className={`inline-flex items-center font-mono font-medium rounded-[2px] ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  )
}

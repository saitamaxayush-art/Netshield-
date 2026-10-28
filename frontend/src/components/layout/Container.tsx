import React from 'react'

export interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'content' | 'wide' | 'narrow'
  as?: React.ElementType
  className?: string
  children: React.ReactNode
}

/**
 * Shared Container Component
 *
 * Guarantees pixel-perfect horizontal alignment across nav, hero, sections, and footer.
 * Responsive horizontal padding scale:
 * - Mobile (<640px): 20px (px-5)
 * - Tablet (640px-1024px): 32px (sm:px-8)
 * - Laptop/Desktop (1024px-1280px): 48px (lg:px-12)
 * - Wide Desktop (>1280px): 64px (xl:px-16)
 */
export const Container: React.FC<ContainerProps> = ({
  size = 'content',
  as: Component = 'div',
  className = '',
  children,
  ...props
}) => {
  const sizeStyles = {
    narrow: 'max-w-4xl',
    content: 'max-w-[1280px]',
    wide: 'max-w-[1440px]',
  }

  return (
    <Component
      className={`w-full mx-auto px-5 sm:px-8 lg:px-12 xl:px-16 ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}

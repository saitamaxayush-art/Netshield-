import React from 'react'

type Span = `${number} / ${number}` | '1 / -1'

/** One container for every landing surface: 1280px content, 20 / 32 / 56px padding. */
export function LContainer({
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag className={`ns-container ${className}`} data-container="" {...rest}>
      {children}
    </Tag>
  )
}

/** 4 / 8 / 12 column grid with token gutters. */
export function LGrid({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`ns-grid ${className}`} data-grid="" {...rest}>
      {children}
    </div>
  )
}

/**
 * Grid cell placed on named column spans per breakpoint (desktop 12,
 * tablet 8, mobile 4). Spans are CSS grid-column values, for example "1 / 8".
 */
export function Cell({
  d = '1 / -1',
  t = '1 / -1',
  m = '1 / -1',
  as: Tag = 'div',
  className = '',
  style,
  children,
  ...rest
}: React.HTMLAttributes<HTMLElement> & { d?: Span; t?: Span; m?: Span; as?: React.ElementType }) {
  return (
    <Tag
      className={`ns-cell ${className}`}
      style={{ '--gc-d': d, '--gc-t': t, '--gc-m': m, ...style } as React.CSSProperties}
      data-cell={`${d}|${t}|${m}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** Small uppercase mono label used as eyebrow and caption. */
export function Eyebrow({ children, className = '', ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`ns-micro ${className}`} style={{ margin: 0 }} {...rest}>
      {children}
    </p>
  )
}

export function ExampleTag({ children = 'Example' }: { children?: React.ReactNode }) {
  return <span className="ns-tag">{children}</span>
}

import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { motionEnabled } from '../motion/engine'

type Variant = 'primary' | 'outline' | 'quiet'
type Size = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: Variant
  size?: Size
  icon?: React.ReactNode
  iconPosition?: 'start' | 'end'
  cursor?: string
  className?: string
  children: React.ReactNode
}

const cls = (variant: Variant, size: Size, extra = '') =>
  `ns-btn ns-btn--${variant}${size === 'md' ? '' : ` ns-btn--${size}`} ${extra}`.trim()

function Inner({ icon, iconPosition = 'end', children }: Pick<BaseProps, 'icon' | 'iconPosition' | 'children'>) {
  return (
    <span className="ns-btn__inner">
      {iconPosition === 'start' && icon}
      <span>{children}</span>
      {iconPosition === 'end' && icon}
    </span>
  )
}

export function LButton({
  variant = 'outline',
  size = 'md',
  icon,
  iconPosition,
  cursor,
  className,
  children,
  ...rest
}: BaseProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button type="button" className={cls(variant, size, className)} data-cursor={cursor} {...rest}>
      <Inner icon={icon} iconPosition={iconPosition}>
        {children}
      </Inner>
    </button>
  )
}

/** Router link or in-page anchor styled as a button. */
export function LButtonLink({
  to,
  variant = 'outline',
  size = 'md',
  icon,
  iconPosition,
  cursor = 'Open',
  className,
  children,
  ...rest
}: BaseProps & { to: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>) {
  const c = cls(variant, size, className)
  const inner = (
    <Inner icon={icon} iconPosition={iconPosition}>
      {children}
    </Inner>
  )
  if (to.startsWith('#')) {
    return (
      <a href={to} className={c} data-cursor={cursor} {...rest}>
        {inner}
      </a>
    )
  }
  return (
    <Link to={to} className={c} data-cursor={cursor} {...rest}>
      {inner}
    </Link>
  )
}

/**
 * Magnetic wrapper: the child is pulled a few pixels toward a fine pointer
 * (damped by gsap.quickTo on the shared ticker). Off on touch and reduced motion.
 */
export function Magnetic({ children, strength = 0.22, max = 8 }: { children: React.ReactNode; strength?: number; max?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(
    () => {
      const el = ref.current
      if (!el || !motionEnabled() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
      const target = el.firstElementChild as HTMLElement | null
      if (!target) return
      const xTo = gsap.quickTo(target, 'x', { duration: 0.5, ease: 'power3.out' })
      const yTo = gsap.quickTo(target, 'y', { duration: 0.5, ease: 'power3.out' })
      const clamp = (v: number) => Math.max(-max, Math.min(max, v))
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const r = el.getBoundingClientRect()
        xTo(clamp((e.clientX - (r.left + r.width / 2)) * strength))
        yTo(clamp((e.clientY - (r.top + r.height / 2)) * strength))
      }
      const leave = () => {
        xTo(0)
        yTo(0)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      return () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave)
        gsap.set(target, { clearProps: 'transform' })
      }
    },
    { scope: ref }
  )
  return (
    <span ref={ref} className="ns-magnetic" style={{ display: 'inline-flex', padding: 0 }}>
      {children}
    </span>
  )
}

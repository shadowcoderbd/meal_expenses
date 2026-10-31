import clsx from 'clsx'
import { Check, Copy, Loader2, Minus, Plus, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'
import { create } from 'zustand'

/** Joins classes and lets later Tailwind classes override earlier ones (e.g. a caller's w-24 beats the default w-full). */
export const cn = (...args: Parameters<typeof clsx>) => twMerge(clsx(args))

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Exit animations without changing how callers mount/unmount things: when the element is
 * removed (or `active` turns false), a static copy is left in its place with
 * data-state="closed" so its CSS exit animation can play, then it is discarded.
 * `fixed` elements fall back to <body> if their parent disappeared too (e.g. on navigation).
 */
export function useExitAnimation<T extends HTMLElement>(active: boolean, duration = 220, fixed = false) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    const node = ref.current
    const parent = node?.parentElement
    if (!node) return
    return () => {
      if (reducedMotion()) return
      const clone = node.cloneNode(true) as HTMLElement
      // cloneNode copies attributes only; carry over what's typed into fields.
      const from = node.querySelectorAll<HTMLInputElement>('input, textarea, select')
      clone.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach((el, i) => (el.value = from[i]?.value ?? ''))
      queueMicrotask(() => {
        if (node.isConnected) return // StrictMode re-running effects, not a real removal
        const host = parent?.isConnected ? parent : fixed ? document.body : null
        if (!host) return
        clone.dataset.state = 'closed'
        clone.setAttribute('aria-hidden', 'true')
        clone.inert = true
        clone.style.pointerEvents = 'none'
        host.appendChild(clone)
        setTimeout(() => clone.remove(), duration)
      })
    }
  }, [active, duration, fixed])
  return ref
}

/**
 * A highlight that slides to the active item of a tab bar / segmented control. Put `ref` on a
 * `relative` container, mark the active child with data-active="true" (NavLink's
 * aria-current="page" also counts), give the items `relative` so they sit above it, and render
 * `indicator` inside the container. `className` styles the highlight (background, radius…).
 */
export function useSlidingIndicator<T extends HTMLElement>(activeKey: unknown, className: string) {
  const ref = useRef<T>(null)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const a = el.querySelector<HTMLElement>('[data-active="true"], [aria-current="page"]')
      setRect(a ? { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [activeKey])

  // Jump into place on first paint, slide on later changes.
  useEffect(() => {
    if (rect && !animate) requestAnimationFrame(() => setAnimate(true))
  }, [rect, animate])

  const indicator = rect && (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute left-0 top-0',
        animate && 'transition-[transform,width,height] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        className,
      )}
      style={{ transform: `translate(${rect.x}px, ${rect.y}px)`, width: rect.w, height: rect.h }}
    />
  )
  return { ref, indicator }
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon'; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        size === 'md' && 'h-11 px-4 text-sm',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'icon' && 'h-10 w-10',
        variant === 'primary' && 'bg-primary text-primary-fg hover:brightness-110',
        variant === 'secondary' && 'bg-surface-2 text-fg hover:bg-border',
        variant === 'ghost' && 'text-fg hover:bg-surface-2',
        variant === 'danger' && 'bg-danger-soft text-danger hover:brightness-95',
        className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

const fieldClass =
  'w-full h-11 rounded-xl border border-border bg-surface px-3 text-[15px] text-fg placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, className)} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(fieldClass, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  )
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const cardTones = {
  default: 'border-border bg-surface',
  accent: 'border-transparent bg-primary text-primary-fg',
  good: 'border-transparent bg-primary-soft',
  bad: 'border-transparent bg-danger-soft',
}

export function Card({ className, children, tone = 'default', ref }: { className?: string; children: ReactNode; tone?: keyof typeof cardTones; ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className={cn('card rounded-2xl border shadow-sm', cardTones[tone], className)}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm"
    >
      <span>{label}</span>
      <span className={clsx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-border')}>
        <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function Stepper({ value, onChange, step = 1, label }: { value: number; onChange: (v: number) => void; step?: number; label?: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button
        type="button"
        aria-label={`Decrease ${label ?? ''}`}
        onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-fg active:scale-95 disabled:opacity-40"
        disabled={value <= 0}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="tabular w-7 text-center text-base font-semibold">
        <span key={value} className="anim-bump">
          {value}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Increase ${label ?? ''}`}
        onClick={() => onChange(+(value + step).toFixed(2))}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary active:scale-95"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  const ref = useExitAnimation<HTMLDivElement>(open, 240, true)
  if (!open) return null
  return (
    <div ref={ref} className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-backdrop absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          const ta = document.createElement('textarea')
          ta.value = text
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          ta.remove()
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{children}</p>
}

// ---- confirm dialog ----

interface ConfirmState {
  request: { title: string; body: ReactNode; confirmLabel: string; danger: boolean; resolve: (ok: boolean) => void } | null
}
const useConfirmStore = create<ConfirmState>(() => ({ request: null }))

export function confirm(title: string, body: ReactNode, opts: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) =>
    useConfirmStore.setState({ request: { title, body, confirmLabel: opts.confirmLabel ?? 'Confirm', danger: opts.danger ?? true, resolve } }),
  )
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.request)
  const close = (ok: boolean) => {
    req?.resolve(ok)
    useConfirmStore.setState({ request: null })
  }
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.title ?? ''}
      footer={
        <>
          <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={req?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>
            {req?.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{req?.body}</div>
    </Modal>
  )
}

// ---- toasts ----

const useToastStore = create<{ items: { id: number; text: string }[] }>(() => ({ items: [] }))

export function toast(text: string) {
  const id = Date.now() + Math.random()
  useToastStore.setState((s) => ({ items: [...s.items, { id, text }] }))
  setTimeout(() => useToastStore.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2800)
}

function Toast({ text }: { text: string }) {
  const ref = useExitAnimation<HTMLDivElement>(true, 200)
  return (
    <div ref={ref} className="anim-toast rounded-xl bg-fg px-4 py-2.5 text-sm text-bg shadow-lg">
      {text}
    </div>
  )
}

export function ToastHost() {
  const items = useToastStore((s) => s.items)
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {items.map((t) => (
        <Toast key={t.id} text={t.text} />
      ))}
    </div>
  )
}

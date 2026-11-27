import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'

export function cx(...args: Array<string | false | null | undefined>) {
  return args.filter(Boolean).join(' ')
}

export const inputClass =
  'w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-ink placeholder:text-soft focus:outline-none focus:border-primary'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('bg-surface border border-line rounded-card p-5', className)}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle ? <p className="text-soft text-sm mt-1">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, disabled, ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50 disabled:pointer-events-none'
  const sizes = size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-4 text-sm'
  const variants = {
    primary: 'bg-primary text-primary-ink hover:brightness-110',
    ghost: 'border border-line text-ink hover:bg-surface-2',
    danger: 'text-expense hover:bg-expense/10',
  }
  return <button className={cx(base, sizes, variants[variant], className)} disabled={disabled} {...props} />
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-surface border border-line rounded-t-2xl sm:rounded-card max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-3">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-soft hover:text-ink transition duration-200 rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs text-soft mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-soft mt-1">{hint}</span> : null}
    </label>
  )
}

export function ProgressBar({
  value,
  tone = 'primary',
}: {
  value: number
  tone?: 'primary' | 'income' | 'expense' | 'warn'
}) {
  const tones = {
    primary: 'bg-primary',
    income: 'bg-income',
    expense: 'bg-expense',
    warn: 'bg-warn',
  }
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
      <div className={cx('h-full rounded-full transition-all duration-300', tones[tone])} style={{ width: pct + '%' }} />
    </div>
  )
}

export function Stat({
  label,
  value,
  tone = 'default',
  hint,
}: {
  label: string
  value: string
  tone?: 'default' | 'income' | 'expense' | 'primary'
  hint?: string
}) {
  const tones = {
    default: 'text-ink',
    income: 'text-income',
    expense: 'text-expense',
    primary: 'text-primary',
  }
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-soft">{label}</div>
      <div className={cx('font-display text-2xl tabular mt-1', tones[tone])}>{value}</div>
      {hint ? <div className="text-xs text-soft mt-1">{hint}</div> : null}
    </div>
  )
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 bg-surface-2 rounded-lg p-1">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'px-3 h-8 rounded-md text-xs font-medium transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
              active ? 'bg-surface text-ink border border-line' : 'text-soft hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode
  title: string
  text?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 border border-dashed border-line rounded-card px-6 py-12">
      {icon ? <div className="text-soft">{icon}</div> : null}
      <div>
        <div className="font-display text-base font-medium text-ink">{title}</div>
        {text ? <p className="text-sm text-soft mt-1 max-w-sm">{text}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function ScopeBadge({ escopo }: { escopo: 'pessoal' | 'empresa' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[11px]',
        escopo === 'empresa' ? 'text-primary' : 'text-soft',
      )}
    >
      {escopo === 'empresa' ? 'Empresa' : 'Pessoal'}
    </span>
  )
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="text-sm text-expense bg-expense/10 rounded-lg px-3 py-2">{message}</div>
}

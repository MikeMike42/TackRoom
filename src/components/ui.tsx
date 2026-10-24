import { useEffect, type ReactNode } from 'react'
import type { Option, Tone } from '../lib/modules'

/* ---------- Icons (stroke, 24 grid) ---------- */
const PATHS: Record<string, string> = {
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z M9 12l2 2 4-4',
  'file-signature': 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z M14 3v5h5 M8 17c1-2 2-2 3 0s2 2 3-1 1.5-1 2 0',
  layers: 'M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  message: 'M4 5h16v11H9l-5 4V5z M8 9h8 M8 12h5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z M4 19a2 2 0 0 1 2-2h13 M9 7h6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c0-4 3.5-6 8-6s8 2 8 6',
  horse: 'M5 21v-6c0-3 2-5 5-5h4l3-4 2 1-1 4v4 M9 21v-4 M15 21v-4 M12 10V7l-2-3',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z',
  plus: 'M12 5v14 M5 12h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z M20 20l-4.5-4.5',
  x: 'M6 6l12 12 M18 6L6 18',
  copy: 'M9 9h10v11H9V9z M5 15V4h10',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
  external: 'M14 4h6v6 M20 4l-9 9 M19 14v6H4V5h6',
  logout: 'M10 4H5v16h5 M14 8l4 4-4 4 M9 12h9',
  calendar: 'M4 6h16v14H4V6z M4 10h16 M8 3v4 M16 3v4',
  alert: 'M12 3l10 18H2L12 3z M12 10v4 M12 17v1',
  check: 'M5 12l5 5L20 7',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  menu: 'M4 7h16 M4 12h16 M4 17h16',
  edit: 'M4 20h4l10-10-4-4L4 16v4z M13 7l4 4',
  chevron: 'M9 6l6 6-6 6',
}

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.layers} />
    </svg>
  )
}

/* ---------- Pills ---------- */
export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>
}

export function OptionPill({ options, value }: { options?: Option[]; value: unknown }) {
  const opt = options?.find((o) => o.value === value)
  if (!opt) return value ? <Pill>{String(value)}</Pill> : null
  return <Pill tone={opt.tone ?? 'neutral'}>{opt.label}</Pill>
}

/* ---------- Buttons ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle'
  icon?: string
}
export function Button({ variant = 'subtle', icon, children, className = '', ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  )
}

/* ---------- Modal / drawer ---------- */
export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

/* ---------- Empty state ---------- */
export function Empty({ icon, title, body, action }: { icon: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

/* ---------- Formatting ---------- */
export const fmtDate = (v: unknown) => {
  if (!v || typeof v !== 'string') return ''
  const d = new Date(v.length === 10 ? v + 'T00:00:00' : v)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
export const fmtMoney = (v: unknown) =>
  v === null || v === undefined || v === '' ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v))

export const daysUntil = (v: unknown) => {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

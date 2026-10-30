import clsx from 'clsx'
import { AlertCircle, Check, ChevronDown, CloudOff, Loader2, Receipt, RefreshCw, Settings, SlidersHorizontal, UtensilsCrossed, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom'
import { refreshAll, useData, useMeta } from '../store/data'

function SyncIndicator() {
  const status = useData((s) => s.status)
  const error = useData((s) => s.error)
  const [spinning, setSpinning] = useState(false)
  const label =
    status === 'saving' ? 'Saving…' : status === 'offline' ? 'Offline' : status === 'error' ? 'Sync error' : 'Saved'
  return (
    <button
      title={error ?? 'Tap to refresh'}
      onClick={async () => {
        setSpinning(true)
        await refreshAll()
        setSpinning(false)
      }}
      className={clsx(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        status === 'error' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted',
      )}
    >
      {spinning ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : status === 'saving' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === 'offline' ? (
        <CloudOff className="h-3.5 w-3.5" />
      ) : status === 'error' ? (
        <AlertCircle className="h-3.5 w-3.5" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function PeriodSwitcher({ periodId }: { periodId?: string }) {
  const meta = useMeta()!
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const current = meta.periods.find((p) => p.id === periodId)

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative min-w-0">
      <button onClick={() => setOpen(!open)} className="flex min-w-0 items-center gap-1 rounded-lg px-1 py-1 text-left hover:bg-surface-2">
        <span className="truncate text-lg font-bold">{current?.name ?? 'Meal Expenses'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
          <div className="max-h-72 overflow-y-auto py-1">
            {[...meta.periods].reverse().map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setOpen(false)
                  navigate(`/p/${p.id}/expenses`)
                }}
                className={clsx('block w-full truncate px-4 py-2.5 text-left text-sm hover:bg-surface-2', p.id === periodId && 'font-semibold text-primary')}
              >
                {p.name}
              </button>
            ))}
          </div>
          <Link to="/periods" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-sm font-medium text-primary hover:bg-surface-2">
            Manage periods…
          </Link>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const match = useMatch('/p/:periodId/*')
  const periodId = match?.params.periodId
  const meta = useMeta()!
  const fallback = periodId ?? meta.periods[meta.periods.length - 1]?.id
  const base = fallback ? `/p/${fallback}` : '/periods'

  const tabs = [
    { to: fallback ? `${base}/expenses` : '/periods', label: 'Expenses', icon: Receipt },
    { to: fallback ? `${base}/meals` : '/periods', label: 'Meals', icon: UtensilsCrossed },
    { to: fallback ? `${base}/summary` : '/periods', label: 'Summary', icon: Wallet },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <PeriodSwitcher periodId={periodId} />
          {periodId && (
            <NavLink
              to={`/p/${periodId}/settings`}
              title="Period settings"
              aria-label="Period settings"
              className={({ isActive }) => clsx('shrink-0 rounded-lg p-2', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2')}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </NavLink>
          )}
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {tabs.map((t) => (
              <NavLink
                key={t.label}
                to={t.to}
                className={({ isActive }) =>
                  clsx('flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium', isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2')
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto sm:ml-2">
            <SyncIndicator />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:pb-10">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-4">
          {tabs.map((t) => (
            <NavLink
              key={t.label}
              to={t.to}
              className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', isActive ? 'text-primary' : 'text-muted')}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

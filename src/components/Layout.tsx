import clsx from 'clsx'
import { AlertCircle, Calculator, Check, ChevronDown, CloudOff, Loader2, Moon, Receipt, RefreshCw, Settings, SlidersHorizontal, Sun, UtensilsCrossed, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { refreshAll, useData, useMeta } from '../store/data'
import { useExitAnimation, useSlidingIndicator } from './ui'

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
        'flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full text-xs font-medium sm:px-2.5',
        status === 'error' ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted',
      )}
    >
      {spinning ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : status === 'saving' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : status === 'offline' ? (
        <CloudOff className="h-4 w-4" />
      ) : status === 'error' ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function ThemeToggle() {
  const resolved = useTheme((s) => s.resolved)
  const setPref = useTheme((s) => s.setPref)
  const next = resolved === 'dark' ? 'light' : 'dark'
  return (
    <button
      onClick={() => setPref(next)}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-muted hover:text-fg"
    >
      <span key={resolved} className="anim-spin-in">
        {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </button>
  )
}

function PeriodSwitcher({ periodId }: { periodId?: string }) {
  const meta = useMeta()!
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const current = meta.periods.find((p) => p.id === periodId)
  const menuRef = useExitAnimation<HTMLDivElement>(open, 140)

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div ref={ref} className="relative min-w-0">
      <button onClick={() => setOpen(!open)} className="flex min-w-0 items-center gap-1 rounded-lg px-1 py-1 text-left hover:bg-surface-2">
        <span className="truncate text-lg font-bold">{current?.name ?? 'Meal Expenses'}</span>
        <ChevronDown className={clsx('h-4 w-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <div ref={menuRef} className="anim-menu absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
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

const TAB_ORDER = ['expenses', 'meals', 'summary', 'bill', 'settings']

export default function Layout() {
  const location = useLocation()
  const match = useMatch('/p/:periodId/*')
  const periodId = match?.params.periodId
  const meta = useMeta()!
  const fallback = periodId ?? meta.periods[meta.periods.length - 1]?.id
  const base = fallback ? `/p/${fallback}` : '/periods'

  const tabs = [
    { to: fallback ? `${base}/expenses` : '/periods', label: 'Expenses', icon: Receipt },
    { to: fallback ? `${base}/meals` : '/periods', label: 'Meals', icon: UtensilsCrossed },
    { to: fallback ? `${base}/summary` : '/periods', label: 'Summary', icon: Wallet },
    { to: fallback ? `${base}/bill` : '/periods', label: 'Bill', icon: Calculator },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]
  // Which way the page slides in: by tab order, like the nav highlight.
  const tabIndex = (path: string) => TAB_ORDER.indexOf(path.split('/').pop()!)
  // Worked out once per navigation, so later re-renders on the same page don't reset it.
  const slide = useRef({ path: location.pathname, dir: 0 })
  if (slide.current.path !== location.pathname) {
    const from = tabIndex(slide.current.path)
    const to = tabIndex(location.pathname)
    slide.current = { path: location.pathname, dir: from < 0 || to < 0 || from === to ? 0 : to > from ? 1 : -1 }
  }
  const dir = slide.current.dir

  const topNav = useSlidingIndicator<HTMLElement>(location.pathname, 'rounded-xl bg-primary-soft')
  const bottomNav = useSlidingIndicator<HTMLDivElement>(location.pathname, 'rounded-xl bg-primary-soft')

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
          <nav ref={topNav.ref} className="relative ml-auto hidden items-center gap-1 sm:flex">
            {topNav.indicator}
            {tabs.map((t) => (
              <NavLink
                key={t.label}
                to={t.to}
                className={({ isActive }) =>
                  clsx(
                    'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-300',
                    isActive ? 'text-primary' : 'text-muted hover:bg-surface-2',
                  )
                }
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:ml-2">
            <ThemeToggle />
            <SyncIndicator />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl overflow-x-clip px-4 pb-28 pt-4 sm:pb-10">
        <div key={location.pathname} className="anim-page" style={{ '--dir': dir } as CSSProperties}>
          <Outlet />
        </div>
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div ref={bottomNav.ref} className="relative grid grid-cols-5 gap-1 px-2 py-1.5">
          {bottomNav.indicator}
          {tabs.map((t) => (
            <NavLink
              key={t.label}
              to={t.to}
              title={t.label}
              aria-label={t.label}
              className={({ isActive }) =>
                clsx(
                  'relative mx-auto flex aspect-square w-full max-w-[3.25rem] items-center justify-center rounded-xl transition-colors duration-300',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              {({ isActive }) => <t.icon className={clsx('h-6 w-6 transition-transform duration-300', isActive && 'scale-110')} />}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

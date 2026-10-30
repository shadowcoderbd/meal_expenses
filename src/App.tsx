import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ConfirmHost, ToastHost } from './components/ui'
import BillPage from './pages/BillPage'
import DayPage from './pages/DayPage'
import ExpensesPage from './pages/ExpensesPage'
import LoginPage from './pages/LoginPage'
import MealsPage from './pages/MealsPage'
import PeriodSettingsPage from './pages/PeriodSettingsPage'
import PeriodsPage from './pages/PeriodsPage'
import SettingsPage from './pages/SettingsPage'
import SetupPage, { MissingRepoConfig } from './pages/SetupPage'
import SummaryPage from './pages/SummaryPage'
import { useAuth } from './store/auth'
import { hasPendingChanges, loadMeta, refreshAll, useMeta } from './store/data'

function FullscreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )
}

/** Opens the most recently created period, so landing on the app needs no extra taps. */
function Home() {
  const meta = useMeta()
  if (!meta) return <FullscreenSpinner />
  const latest = meta.periods[meta.periods.length - 1]
  return <Navigate to={latest ? `/p/${latest.id}/expenses` : '/periods'} replace />
}

function AuthedApp() {
  const meta = useMeta()
  const [error, setError] = useState<string>()

  useEffect(() => {
    loadMeta().catch((e) => setError(e.message))
    const onFocus = () => document.visibilityState === 'visible' && void refreshAll()
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingChanges()) e.preventDefault()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('online', onFocus)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('online', onFocus)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  if (!meta) {
    if (error)
      return (
        <div className="mx-auto max-w-md p-6 text-center">
          <p className="font-semibold">Could not load data</p>
          <p className="mt-1 text-sm text-muted">{error}</p>
          <button className="mt-4 text-sm text-primary underline" onClick={() => useAuth.getState().logout()}>
            Log out
          </button>
        </div>
      )
    return <FullscreenSpinner />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="periods" element={<PeriodsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="p/:periodId">
          <Route index element={<Navigate to="expenses" replace />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="meals" element={<MealsPage />} />
          <Route path="meals/:date" element={<DayPage />} />
          <Route path="summary" element={<SummaryPage />} />
          <Route path="bill" element={<BillPage />} />
          <Route path="settings" element={<PeriodSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const { appRepo, session, initialised, checkInitialised } = useAuth()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!session) checkInitialised().catch((e) => setError(e.message))
  }, [session, checkInitialised])

  let content
  if (!appRepo) content = <MissingRepoConfig />
  else if (session) content = <AuthedApp />
  else if (error) content = <div className="p-6 text-center text-sm text-danger">{error}</div>
  else if (initialised === null) content = <FullscreenSpinner />
  else content = initialised ? <LoginPage /> : <SetupPage />

  return (
    <>
      {content}
      <ConfirmHost />
      <ToastHost />
    </>
  )
}

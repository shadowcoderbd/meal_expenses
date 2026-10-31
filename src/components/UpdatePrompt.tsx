import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from './ui'

const HOUR = 60 * 60 * 1000

/** Shows a banner when a new version of the app has been deployed. */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Installed apps can stay open for days; check for new deploys regularly.
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
  })

  if (!needRefresh) return null
  return (
    <div className="no-print anim-toast fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-xl sm:bottom-6">
      <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">A new version is available.</p>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
        Later
      </Button>
      <Button size="sm" onClick={() => void updateServiceWorker(true)}>
        Update
      </Button>
    </div>
  )
}

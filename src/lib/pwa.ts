import { create } from 'zustand'

/** Chrome's install prompt event (not in the DOM typings). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

interface InstallState {
  /** Set when the browser allows installing (Android Chrome, desktop Chrome/Edge). */
  promptEvent: BeforeInstallPromptEvent | null
  installed: boolean
  install: () => Promise<void>
}

export const useInstall = create<InstallState>((set, get) => ({
  promptEvent: null,
  installed: standalone(),
  async install() {
    const e = get().promptEvent
    if (!e) return
    await e.prompt()
    const { outcome } = await e.userChoice
    set({ promptEvent: null, installed: outcome === 'accepted' })
  },
}))

// Registered at import time: the event fires early, often before React has rendered.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  useInstall.setState({ promptEvent: e as BeforeInstallPromptEvent })
})
window.addEventListener('appinstalled', () => useInstall.setState({ installed: true, promptEvent: null }))

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

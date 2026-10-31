import { create } from 'zustand'

export type ThemePref = 'system' | 'light' | 'dark'

// Not prefixed with "meal." so logging out keeps the choice.
const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const BAR_COLORS = { light: '#ffffff', dark: '#151e1c' }

/** Points both theme-color metas (light/dark media) at the chosen theme, or restores them for "system". */
function applyBarColor(pref: ThemePref) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const scheme = m.media.includes('dark') ? 'dark' : 'light'
    m.content = BAR_COLORS[pref === 'system' ? scheme : pref]
  })
}
applyBarColor(readPref())

const resolve = (pref: ThemePref): 'light' | 'dark' => (pref === 'system' ? (media.matches ? 'dark' : 'light') : pref)

interface ThemeState {
  pref: ThemePref
  /** The theme actually shown. */
  resolved: 'light' | 'dark'
  setPref: (pref: ThemePref) => void
}

export const useTheme = create<ThemeState>((set) => ({
  pref: readPref(),
  resolved: resolve(readPref()),
  setPref(pref) {
    try {
      if (pref === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, pref)
    } catch {
      /* ignore */
    }
    // Fade colours instead of snapping, only while switching.
    const root = document.documentElement
    root.classList.add('theme-transition')
    setTimeout(() => root.classList.remove('theme-transition'), 350)
    if (pref === 'system') delete root.dataset.theme
    else root.dataset.theme = pref
    applyBarColor(pref)
    set({ pref, resolved: resolve(pref) })
  },
}))

media.addEventListener('change', () => useTheme.setState((s) => ({ resolved: resolve(s.pref) })))

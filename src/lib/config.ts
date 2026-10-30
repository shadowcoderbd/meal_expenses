/**
 * Where the app's own repo lives. users.json is stored on the `auth` branch of this
 * (public) repo so it can be read before login, without a token.
 *
 * On GitHub Pages this is detected from the URL (https://<owner>.github.io/<repo>/).
 * For local development set VITE_GH_OWNER / VITE_GH_APP_REPO in .env.local.
 */
export interface AppRepo {
  owner: string
  repo: string
}

export const AUTH_BRANCH = 'auth'
export const USERS_PATH = 'users.json'

export function detectAppRepo(): AppRepo | null {
  const envOwner = import.meta.env.VITE_GH_OWNER as string | undefined
  const envRepo = import.meta.env.VITE_GH_APP_REPO as string | undefined
  if (envOwner && envRepo) return { owner: envOwner, repo: envRepo }

  const host = window.location.hostname
  if (host.endsWith('.github.io')) {
    const owner = host.replace(/\.github\.io$/, '')
    const first = window.location.pathname.split('/').filter(Boolean)[0]
    return { owner, repo: first ?? host }
  }
  return null
}

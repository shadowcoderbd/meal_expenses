import { create } from 'zustand'
import { AUTH_BRANCH, USERS_PATH, detectAppRepo, type AppRepo } from '../lib/config'
import { createEntry, generatePassword, hashUsername, normaliseUsername, openEntry, type UsersFile } from '../lib/crypto'
import { ConflictError, ensureBranch, getRepo, readJson, writeJson } from '../lib/github'
import type { Session } from '../lib/types'
import { ensureFounder } from './data'

const SESSION_KEY = 'meal.session'

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

function saveSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable: session lasts for this tab only */
  }
}

interface AuthState {
  appRepo: AppRepo | null
  session: Session | null
  /** null = not checked yet, false = no users.json (first run) */
  initialised: boolean | null
  checkInitialised: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  setup: (input: { dataRepo: string; token: string; name: string; username: string; password: string }) => Promise<void>
}

const pepper = (r: AppRepo) => `${r.owner}/${r.repo}`.toLowerCase()

function usersTarget(token?: string) {
  const r = useAuth.getState().appRepo!
  return { owner: r.owner, repo: r.repo, path: USERS_PATH, branch: AUTH_BRANCH, token }
}

/** Read-modify-write on users.json with conflict retry. */
async function updateUsers(token: string, message: string, mutate: (f: UsersFile) => UsersFile): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const current = await readJson<UsersFile>(usersTarget(token))
    const next = mutate(current?.data ?? { version: 1, users: [] })
    try {
      await writeJson(usersTarget(token), next, current?.sha, message)
      return
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e
    }
  }
  throw new Error('Could not save users after several attempts. Please try again.')
}

export const useAuth = create<AuthState>((set, get) => ({
  appRepo: detectAppRepo(),
  session: loadSession(),
  initialised: null,

  async checkInitialised() {
    if (!get().appRepo) return
    const file = await readJson<UsersFile>(usersTarget(get().session?.token))
    set({ initialised: !!file && file.data.users.length > 0 })
  },

  async login(username, password) {
    const file = await readJson<UsersFile>(usersTarget())
    const id = await hashUsername(username, pepper(get().appRepo!))
    const entry = file?.data.users.find((u) => u.id === id)
    const session = entry ? await openEntry(entry, password) : null
    if (!session) throw new Error('Wrong username or password')
    saveSession(session)
    set({ session })
  },

  logout() {
    saveSession(null)
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('meal.'))
        .forEach((k) => localStorage.removeItem(k))
    } catch {
      /* ignore */
    }
    set({ session: null })
    window.location.reload()
  },

  async setup({ dataRepo, token, name, username, password }) {
    const app = get().appRepo!
    const [owner, repo] = dataRepo.trim().split('/')
    if (!owner || !repo) throw new Error('Data repository must look like owner/repo')

    const data = await getRepo(owner, repo, token).catch(() => {
      throw new Error(`The token cannot access ${owner}/${repo}. Check the repo name and the token's repository access.`)
    })
    if (!data.permissions?.push) throw new Error(`The token has no write access to ${owner}/${repo} (needs Contents: Read and write).`)
    const appInfo = await getRepo(app.owner, app.repo, token).catch(() => {
      throw new Error(`The token cannot access ${app.owner}/${app.repo}. Add this repo to the token as well.`)
    })
    if (!appInfo.permissions?.push) throw new Error(`The token has no write access to ${app.owner}/${app.repo}.`)

    await ensureBranch(app.owner, app.repo, AUTH_BRANCH, token)
    const existing = await readJson<UsersFile>(usersTarget(token))
    if (existing && existing.data.users.length > 0) throw new Error('This app is already set up. Please log in instead.')

    const session: Session = { token, memberId: '', username: normaliseUsername(username), dataRepo: { owner, repo } }
    session.memberId = await ensureFounder(session, name.trim() || session.username)

    const entry = await createEntry(session, password, pepper(app))
    await updateUsers(token, `Set up login for ${session.username}`, (f) => ({ ...f, users: [...f.users, entry] }))
    saveSession(session)
    set({ session, initialised: true })
  },
}))

// ---- user management (requires a logged-in session) ----

function requireSession(): Session {
  const s = useAuth.getState().session
  if (!s) throw new Error('Not logged in')
  return s
}

export async function usernameTaken(username: string): Promise<boolean> {
  const s = requireSession()
  const file = await readJson<UsersFile>(usersTarget(s.token))
  const id = await hashUsername(username, pepper(useAuth.getState().appRepo!))
  return !!file?.data.users.some((u) => u.id === id)
}

/** Creates or replaces a login for a member and returns the generated password. */
export async function issuePassword(memberId: string, username: string): Promise<string> {
  const s = requireSession()
  const password = generatePassword()
  const session: Session = { token: s.token, dataRepo: s.dataRepo, memberId, username: normaliseUsername(username) }
  const entry = await createEntry(session, password, pepper(useAuth.getState().appRepo!))
  await updateUsers(s.token, 'Issue password', (f) => ({ ...f, users: [...f.users.filter((u) => u.id !== entry.id), entry] }))
  return password
}

export async function revokeLogin(username: string): Promise<void> {
  const s = requireSession()
  const id = await hashUsername(username, pepper(useAuth.getState().appRepo!))
  await updateUsers(s.token, 'Remove login', (f) => ({ ...f, users: f.users.filter((u) => u.id !== id) }))
}

export async function changeOwnPassword(current: string, next: string): Promise<void> {
  const s = requireSession()
  const app = useAuth.getState().appRepo!
  const file = await readJson<UsersFile>(usersTarget(s.token))
  const id = await hashUsername(s.username, pepper(app))
  const entry = file?.data.users.find((u) => u.id === id)
  if (!entry || !(await openEntry(entry, current))) throw new Error('Current password is wrong')
  const fresh = await createEntry(s, next, pepper(app))
  await updateUsers(s.token, 'Change password', (f) => ({ ...f, users: f.users.map((u) => (u.id === id ? fresh : u)) }))
}

/**
 * Swaps the GitHub token (after expiry or to lock out a former member). Every other
 * user gets a new password because their entries can only be re-encrypted with one.
 */
export async function replaceToken(
  newToken: string,
  currentPassword: string,
  others: { memberId: string; username: string }[],
): Promise<{ username: string; password: string }[]> {
  const s = requireSession()
  const app = useAuth.getState().appRepo!
  const file = await readJson<UsersFile>(usersTarget(s.token))
  const ownId = await hashUsername(s.username, pepper(app))
  const own = file?.data.users.find((u) => u.id === ownId)
  if (!own || !(await openEntry(own, currentPassword))) throw new Error('Current password is wrong')

  for (const [o, r] of [
    [s.dataRepo.owner, s.dataRepo.repo],
    [app.owner, app.repo],
  ]) {
    const info = await getRepo(o, r, newToken).catch(() => {
      throw new Error(`The new token cannot access ${o}/${r}`)
    })
    if (!info.permissions?.push) throw new Error(`The new token has no write access to ${o}/${r}`)
  }

  const session: Session = { ...s, token: newToken }
  const entries = [await createEntry(session, currentPassword, pepper(app))]
  const issued: { username: string; password: string }[] = []
  for (const o of others) {
    const password = generatePassword()
    entries.push(await createEntry({ ...session, memberId: o.memberId, username: normaliseUsername(o.username) }, password, pepper(app)))
    issued.push({ username: o.username, password })
  }
  const latest = await readJson<UsersFile>({ ...usersTarget(newToken) })
  await writeJson(usersTarget(newToken), { version: 1, users: entries } satisfies UsersFile, latest?.sha, 'Rotate access token')
  saveSession(session)
  useAuth.setState({ session })
  return issued
}

/**
 * Sync engine: each JSON file in the data repo is held as
 *   remote  – last version read from / written to GitHub
 *   sha     – GitHub's version id for `remote`
 *   pending – operations not yet saved
 * The UI sees `pending` applied on top of `remote`. Saves are debounced, and on a
 * conflict the latest file is refetched and the pending operations are re-applied.
 * Everything is cached in localStorage so the app opens instantly and survives offline edits.
 */
import { create } from 'zustand'
import { ConflictError, deleteFile, readJson, writeJson } from '../lib/github'
import { nowIso } from '../lib/ids'
import { DEFAULT_META, applyMetaOp, applyPeriodOp, describeMetaOp, describePeriodOp } from '../lib/reducers'
import type { Meta, MetaOp, Period, PeriodOp, Session } from '../lib/types'
import { useAuth } from './auth'

const CACHE_KEY = 'meal.cache'
const META_PATH = 'meta.json'
export const periodPath = (id: string) => `periods/${id}.json`

type Op = MetaOp | PeriodOp
type Doc = Meta | Period

interface FileState {
  remote: Doc | null
  sha?: string
  pending: Op[]
}

export type SyncStatus = 'idle' | 'saving' | 'offline' | 'error'

interface DataState {
  files: Record<string, FileState>
  loaded: Record<string, boolean>
  status: SyncStatus
  error?: string
}

function loadCache(): Record<string, FileState> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const useData = create<DataState>(() => ({ files: loadCache(), loaded: {}, status: 'idle' }))

useData.subscribe((s, prev) => {
  if (s.files === prev.files) return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s.files))
  } catch {
    /* storage full or unavailable; GitHub is still the source of truth */
  }
})

const isMeta = (path: string) => path === META_PATH

function applyOps(path: string, base: Doc | null, ops: Op[]): Doc | null {
  if (isMeta(path)) return ops.reduce((d, op) => applyMetaOp(d, op as MetaOp), (base as Meta) ?? DEFAULT_META)
  // A period file only exists once a 'replace' op has created it.
  return ops.reduce<Period | null>((d, op) => {
    if (op.type === 'replace') return (op as Extract<PeriodOp, { type: 'replace' }>).period
    return d ? applyPeriodOp(d, op as PeriodOp) : d
  }, base as Period | null)
}

function view(path: string, files: Record<string, FileState>): Doc | null {
  const f = files[path]
  if (!f) return null
  return f.pending.length ? applyOps(path, f.remote, f.pending) : f.remote
}

// Memoise views so components get stable references.
const viewCache = new Map<string, { file: FileState; doc: Doc | null }>()
function cachedView(path: string, files: Record<string, FileState>): Doc | null {
  const f = files[path]
  const hit = viewCache.get(path)
  if (hit && hit.file === f) return hit.doc
  const doc = view(path, files)
  if (f) viewCache.set(path, { file: f, doc })
  return doc
}

export const useMeta = (): Meta | null => useData((s) => cachedView(META_PATH, s.files) as Meta | null)
export const usePeriod = (id: string | undefined): Period | null =>
  useData((s) => (id ? (cachedView(periodPath(id), s.files) as Period | null) : null))

function session(): Session {
  const s = useAuth.getState().session
  if (!s) throw new Error('Not logged in')
  return s
}

function target(path: string, s = session()) {
  return { owner: s.dataRepo.owner, repo: s.dataRepo.repo, path, token: s.token }
}

function setFile(path: string, f: FileState) {
  useData.setState((s) => ({ files: { ...s.files, [path]: f } }))
}

// ---- loading ----

export async function load(path: string): Promise<void> {
  const res = await readJson<Doc>(target(path))
  const cur = useData.getState().files[path]
  useData.setState((s) => ({ loaded: { ...s.loaded, [path]: true } }))
  if (!res) {
    if (!cur?.pending.length) {
      useData.setState((s) => {
        const files = { ...s.files }
        delete files[path]
        return { files }
      })
    }
    return
  }
  if (cur && cur.sha === res.sha) return
  setFile(path, { remote: res.data, sha: res.sha, pending: cur?.pending ?? [] })
  if (cur?.pending.length) scheduleFlush(path)
}

export const loadMeta = () => load(META_PATH)
export const loadPeriod = (id: string) => load(periodPath(id))

/** Re-reads every file we have open (on focus / manual refresh) and pushes anything pending. */
export async function refreshAll(): Promise<void> {
  const paths = Object.keys(useData.getState().files)
  if (!paths.includes(META_PATH)) paths.push(META_PATH)
  try {
    await Promise.all(paths.map((p) => (inflight.has(p) ? Promise.resolve() : load(p))))
    if (useData.getState().status === 'offline') useData.setState({ status: 'idle', error: undefined })
    paths.forEach((p) => useData.getState().files[p]?.pending.length && scheduleFlush(p))
  } catch (e) {
    markError(e)
  }
}

// ---- writing ----

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const inflight = new Set<string>()

export function dispatchMeta(op: MetaOp) {
  dispatch(META_PATH, op)
}

export function dispatchPeriod(id: string, op: PeriodOp) {
  dispatch(periodPath(id), op)
}

function dispatch(path: string, op: Op) {
  const f = useData.getState().files[path] ?? { remote: null, pending: [] }
  setFile(path, { ...f, pending: [...f.pending, op] })
  scheduleFlush(path)
}

function scheduleFlush(path: string, delay = 800) {
  clearTimeout(timers.get(path))
  timers.set(path, setTimeout(() => void flush(path), delay))
}

function markError(e: unknown) {
  const offline = e instanceof TypeError || !navigator.onLine
  useData.setState({
    status: offline ? 'offline' : 'error',
    error: offline ? 'Offline – changes are saved on this device and will sync later' : (e as Error).message,
  })
}

async function flush(path: string): Promise<void> {
  if (inflight.has(path)) return scheduleFlush(path)
  inflight.add(path)
  useData.setState({ status: 'saving' })
  try {
    for (let conflicts = 0; ; ) {
      const f = useData.getState().files[path]
      if (!f || f.pending.length === 0) break
      if (!f.remote && !isMeta(path) && f.pending[0].type !== 'replace' && f.sha === undefined) {
        // Edits to a period this device hasn't loaded yet: fetch it first so they apply on top.
        const fresh = await readJson<Doc>(target(path))
        if (fresh) {
          setFile(path, { remote: fresh.data, sha: fresh.sha, pending: useData.getState().files[path].pending })
          continue
        }
      }
      const ops = f.pending
      const next = applyOps(path, f.remote, ops)
      if (!next) {
        // Edits to a period that no longer exists: drop them.
        setFile(path, { ...f, pending: [] })
        break
      }
      const describe = (op: Op) => (isMeta(path) ? describeMetaOp(op as MetaOp) : describePeriodOp(op as PeriodOp))
      const message = `${describe(ops[ops.length - 1])}${ops.length > 1 ? ` (+${ops.length - 1} more)` : ''} – by ${session().username}`
      try {
        const sha = await writeJson(target(path), next, f.sha, message)
        const latest = useData.getState().files[path]
        setFile(path, { remote: next, sha, pending: latest.pending.slice(ops.length) })
      } catch (e) {
        if (!(e instanceof ConflictError) || ++conflicts > 5) throw e
        const fresh = await readJson<Doc>(target(path))
        const latest = useData.getState().files[path]
        setFile(path, { remote: fresh?.data ?? null, sha: fresh?.sha, pending: latest.pending })
      }
    }
    useData.setState({ status: 'idle', error: undefined })
  } catch (e) {
    markError(e)
  } finally {
    inflight.delete(path)
  }
}

export function hasPendingChanges(): boolean {
  return Object.values(useData.getState().files).some((f) => f.pending.length > 0)
}

// ---- period lifecycle ----

export function createPeriod(period: Period) {
  dispatchPeriod(period.id, { type: 'replace', period })
  dispatchMeta({ type: 'addPeriod', period: { id: period.id, name: period.name, createdAt: period.createdAt } })
}

export async function deletePeriod(id: string) {
  const path = periodPath(id)
  dispatchMeta({ type: 'removePeriod', id })
  clearTimeout(timers.get(path))
  let sha = useData.getState().files[path]?.sha
  if (!sha) sha = (await readJson(target(path)))?.sha
  if (sha) await deleteFile(target(path), sha, `Delete period ${id} – by ${session().username}`)
  useData.setState((s) => {
    const files = { ...s.files }
    delete files[path]
    return { files }
  })
}

// ---- backup / restore ----

export async function exportAll(): Promise<{ meta: Meta; periods: Record<string, Period> }> {
  await loadMeta()
  const meta = cachedView(META_PATH, useData.getState().files) as Meta
  const periods: Record<string, Period> = {}
  for (const p of meta.periods) {
    await loadPeriod(p.id)
    const doc = cachedView(periodPath(p.id), useData.getState().files) as Period | null
    if (doc) periods[p.id] = doc
  }
  return { meta, periods }
}

export async function restoreAll(meta: Meta, periods: Record<string, Period>) {
  const current = (await exportAll()).meta
  for (const p of current.periods) {
    if (!periods[p.id]) await deletePeriod(p.id)
  }
  for (const period of Object.values(periods)) dispatchPeriod(period.id, { type: 'replace', period })
  dispatchMeta({ type: 'replace', meta })
}

// ---- first-run setup ----

/** Makes sure meta.json exists and contains the founding member. Returns the member id. */
export async function ensureFounder(s: Session, name: string): Promise<string> {
  const t = target(META_PATH, s)
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await readJson<Meta>(t)
    const meta = existing?.data ?? DEFAULT_META
    const found = meta.members.find((m) => m.username === s.username)
    if (found) return found.id
    const member = { id: `m-${s.username}`, name, username: s.username, active: true, createdAt: nowIso() }
    try {
      await writeJson(t, applyMetaOp(meta, { type: 'upsertMember', member }), existing?.sha, `Initial setup – by ${s.username}`)
      return member.id
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e
    }
  }
  throw new Error('Could not initialise data repository')
}

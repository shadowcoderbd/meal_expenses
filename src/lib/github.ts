/** Thin wrapper over the GitHub REST "contents" API used as the app's database. */

const API = 'https://api.github.com'

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

/** Thrown when the file changed on GitHub since we last read it (stale sha). */
export class ConflictError extends GitHubError {}

export interface FileResult<T> {
  data: T
  sha: string
}

interface Target {
  owner: string
  repo: string
  path: string
  branch?: string
  token?: string
}

function headers(token?: string): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function contentsUrl({ owner, repo, path }: Target): string {
  return `${API}/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

async function fail(res: Response): Promise<never> {
  let message = `GitHub request failed (${res.status})`
  try {
    const body = await res.json()
    if (body?.message) message = `${message}: ${body.message}`
  } catch {
    /* ignore */
  }
  if (res.status === 409 || (res.status === 422 && message.includes('sha'))) throw new ConflictError(message, res.status)
  throw new GitHubError(message, res.status)
}

/** Returns null when the file does not exist. */
export async function readJson<T>(t: Target): Promise<FileResult<T> | null> {
  const url = new URL(contentsUrl(t))
  if (t.branch) url.searchParams.set('ref', t.branch)
  const res = await fetch(url, { headers: headers(t.token), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) return fail(res)
  const body = await res.json()
  let text: string
  if (body.content) {
    text = decodeBase64(body.content)
  } else {
    // Files over 1 MB come back without inline content; fetch the blob instead.
    const blob = await fetch(`${API}/repos/${t.owner}/${t.repo}/git/blobs/${body.sha}`, {
      headers: headers(t.token),
      cache: 'no-store',
    })
    if (!blob.ok) return fail(blob)
    text = decodeBase64((await blob.json()).content)
  }
  return { data: JSON.parse(text) as T, sha: body.sha }
}

/** Creates or updates a file. Pass the last-known sha (undefined to create). Returns the new sha. */
export async function writeJson(t: Target, data: unknown, sha: string | undefined, message: string): Promise<string> {
  const res = await fetch(contentsUrl(t), {
    method: 'PUT',
    headers: headers(t.token),
    body: JSON.stringify({
      message,
      content: encodeBase64(JSON.stringify(data, null, 2) + '\n'),
      sha,
      branch: t.branch,
    }),
  })
  if (!res.ok) return fail(res)
  return (await res.json()).content.sha
}

export async function deleteFile(t: Target, sha: string, message: string): Promise<void> {
  const res = await fetch(contentsUrl(t), {
    method: 'DELETE',
    headers: headers(t.token),
    body: JSON.stringify({ message, sha, branch: t.branch }),
  })
  if (!res.ok && res.status !== 404) return fail(res)
}

export async function getRepo(owner: string, repo: string, token: string): Promise<{ private: boolean; default_branch: string; permissions?: { push?: boolean } }> {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers(token), cache: 'no-store' })
  if (!res.ok) return fail(res)
  return res.json()
}

/** Creates `branch` from the repo's default branch if it does not exist yet. */
export async function ensureBranch(owner: string, repo: string, branch: string, token: string): Promise<void> {
  const base = `${API}/repos/${owner}/${repo}/git`
  const existing = await fetch(`${base}/ref/heads/${branch}`, { headers: headers(token), cache: 'no-store' })
  if (existing.ok) return
  if (existing.status !== 404) return fail(existing)
  const info = await getRepo(owner, repo, token)
  const head = await fetch(`${base}/ref/heads/${info.default_branch}`, { headers: headers(token), cache: 'no-store' })
  if (!head.ok) return fail(head)
  const sha = (await head.json()).object.sha
  const res = await fetch(`${base}/refs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
  if (!res.ok) return fail(res)
}

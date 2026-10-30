/**
 * Password-based login without a server.
 *
 * users.json is public. Each entry holds the session payload (GitHub token, member id, ...)
 * encrypted with AES-GCM under a key derived from the user's password (PBKDF2-SHA256).
 * Usernames are stored only as salted SHA-256 hashes. A wrong password simply fails to decrypt.
 */
import type { Session } from './types'

export const PBKDF2_ITERATIONS = 600_000
export const MIN_PASSWORD_LENGTH = 10

export interface UserEntry {
  /** sha256 of the normalised username */
  id: string
  salt: string
  iv: string
  iterations: number
  ciphertext: string
  updatedAt: string
}

export interface UsersFile {
  version: 1
  users: UserEntry[]
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export function normaliseUsername(username: string): string {
  return username.trim().toLowerCase()
}

export async function hashUsername(username: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`meal-expenses:${pepper}:${normaliseUsername(username)}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createEntry(session: Session, password: string, pepper: string): Promise<UserEntry> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const plain = new TextEncoder().encode(JSON.stringify(session))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return {
    id: await hashUsername(session.username, pepper),
    salt: toB64(salt),
    iv: toB64(iv),
    iterations: PBKDF2_ITERATIONS,
    ciphertext: toB64(ciphertext),
    updatedAt: new Date().toISOString(),
  }
}

/** Returns null when the password is wrong. */
export async function openEntry(entry: UserEntry, password: string): Promise<Session | null> {
  try {
    const key = await deriveKey(password, fromB64(entry.salt), entry.iterations)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(entry.iv) }, key, fromB64(entry.ciphertext))
    return JSON.parse(new TextDecoder().decode(plain)) as Session
  } catch {
    return null
  }
}

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** 16 random characters from an unambiguous alphabet, grouped for readability (~92 bits). */
export function generatePassword(): string {
  const out: string[] = []
  const bytes = crypto.getRandomValues(new Uint8Array(64))
  for (const b of bytes) {
    // Rejection sampling keeps the distribution uniform.
    if (b < 256 - (256 % ALPHABET.length)) out.push(ALPHABET[b % ALPHABET.length])
    if (out.length === 16) break
  }
  return out.join('').match(/.{4}/g)!.join('-')
}

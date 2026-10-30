import { describe, expect, it } from 'vitest'
import { createEntry, generatePassword, hashUsername, openEntry } from '../crypto'
import { decodeBase64, encodeBase64 } from '../github'

const session = { token: 'github_pat_x', memberId: 'm1', username: 'rahim', dataRepo: { owner: 'o', repo: 'r' } }

describe('login encryption', () => {
  it('opens with the right password and fails with a wrong one', async () => {
    const entry = await createEntry(session, 'correct horse battery', 'o/app')
    expect(entry.ciphertext).not.toContain('github_pat')
    expect(await openEntry(entry, 'correct horse battery')).toEqual(session)
    expect(await openEntry(entry, 'wrong password!')).toBeNull()
  }, 20_000)

  it('hashes usernames case-insensitively and per app', async () => {
    expect(await hashUsername(' Rahim ', 'o/app')).toBe(await hashUsername('rahim', 'o/app'))
    expect(await hashUsername('rahim', 'o/app')).not.toBe(await hashUsername('rahim', 'o/other'))
  })

  it('generates readable random passwords', () => {
    const p = generatePassword()
    expect(p).toMatch(/^[a-zA-Z2-9]{4}(-[a-zA-Z2-9]{4}){3}$/)
    expect(generatePassword()).not.toBe(p)
  })
})

describe('base64', () => {
  it('round-trips non-ASCII text such as Bangla names', () => {
    const text = JSON.stringify({ name: 'রহিম', currency: '৳' })
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })
})

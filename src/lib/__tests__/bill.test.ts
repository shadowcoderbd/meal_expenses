import { describe, expect, it } from 'vitest'
import { computeBill } from '../bill'
import type { Bill } from '../types'

// The November 2026 sheet: Sayem & Abed in the small room, Shanto & Shaon in the big room.
const bill: Bill = {
  amounts: { rent: 16000, gas: 1080, utility: 1000, wifi: 840, maid: 2800, electricity: 1432 },
  rooms: [
    { id: 'small', name: 'Small Room', share: 17, memberIds: ['sayem', 'abed'] },
    { id: 'big', name: 'Big Room', share: 19, memberIds: ['shanto', 'shaon'] },
  ],
}
const members = ['sayem', 'abed', 'shanto', 'shaon']
// Mess expense in the sheet is what each person owes, i.e. the negative of their balance.
const balances = new Map([
  ['sayem', 40.22],
  ['abed', 226.25],
  ['shanto', 568.38],
  ['shaon', -834.85],
])

describe('computeBill', () => {
  const r = computeBill(bill, members, balances)
  const row = (id: string) => r.rows.find((x) => x.memberId === id)!

  it('matches the room split and payees from the sheet', () => {
    expect(r.totalRent).toBe(18080)
    expect(r.rooms[0].amount).toBeCloseTo(8537.78, 2)
    expect(r.rooms[1].amount).toBeCloseTo(9542.22, 2)
    expect(r.payees).toEqual({ bariwala: 19512, maid: 2800, wifi: 840, total: 23152 })
  })

  it('matches every per-person line from the sheet', () => {
    expect(row('sayem')).toMatchObject({ wifi: 210, maid: 700, electricity: 358, mess: -40.22 })
    expect(row('sayem').rent).toBeCloseTo(4268.89, 2)
    expect(row('shanto').rent).toBeCloseTo(4771.11, 2)
    expect(row('sayem').total).toBeCloseTo(5496.67, 2)
    expect(row('abed').total).toBeCloseTo(5310.64, 2)
    expect(row('shanto').total).toBeCloseTo(5470.73, 2)
    expect(row('shaon').total).toBeCloseTo(6873.96, 2)
    expect(r.rows.map((x) => x.rounded)).toEqual([5497, 5311, 5471, 6874])
    expect(r.roundedTotal).toBe(23153)
  })

  it('flags members without a room', () => {
    const res = computeBill({ ...bill, rooms: [bill.rooms[0]] }, members, new Map())
    expect(res.noRoom).toEqual(['shanto', 'shaon'])
  })
})

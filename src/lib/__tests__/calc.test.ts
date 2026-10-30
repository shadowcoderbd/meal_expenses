import { describe, expect, it } from 'vitest'
import { settle, summarize } from '../calc'
import type { Expense, Period } from '../types'

const expense = (e: Partial<Expense>): Expense => ({
  id: Math.random().toString(),
  amount: 0,
  description: '',
  quantity: 1,
  unit: 'pcs',
  date: '2026-10-01',
  category: 'Groceries',
  paidBy: 'a',
  isMeal: true,
  participants: [],
  createdBy: 'a',
  createdAt: '',
  updatedAt: '',
  ...e,
})

const period = (p: Partial<Period>): Period => ({
  version: 1,
  id: 'p',
  name: 'Test',
  createdAt: '',
  ratio: { b: 0.5, l: 1, d: 1 },
  memberIds: ['a', 'b'],
  expenses: [],
  meals: {},
  ...p,
})

describe('summarize', () => {
  it('matches the meal-rate example from the requirements (100 / 6.5 = 15.38)', () => {
    const s = summarize(
      period({
        expenses: [expense({ amount: 100 })],
        meals: {
          '2026-10-01': { a: { b: 2, l: 1, d: 2 }, b: { b: 1, l: 1, d: 1 } },
        },
      }),
    )
    expect(s.meals).toEqual({ b: 3, l: 2, d: 3 })
    expect(s.totalWeighted).toBe(6.5)
    expect(s.mealRate).toBeCloseTo(15.3846, 3)
  })

  it('charges meal cost by weighted meals and shared cost equally among participants', () => {
    const s = summarize(
      period({
        memberIds: ['a', 'b', 'c'],
        expenses: [
          expense({ amount: 300, paidBy: 'a' }),
          expense({ amount: 90, paidBy: 'b', isMeal: false, participants: ['a', 'b', 'c'] }),
        ],
        meals: { '2026-10-01': { a: { b: 0, l: 1, d: 1 }, b: { b: 0, l: 1, d: 0 }, c: { b: 0, l: 0, d: 0 } } },
      }),
    )
    const row = (id: string) => s.members.find((m) => m.memberId === id)!
    expect(s.mealRate).toBe(100)
    expect(row('a')).toMatchObject({ mealCost: 200, sharedCost: 30, paid: 300, balance: 70 })
    expect(row('b')).toMatchObject({ mealCost: 100, sharedCost: 30, paid: 90, balance: -40 })
    expect(row('c')).toMatchObject({ mealCost: 0, sharedCost: 30, paid: 0, balance: -30 })
    expect(s.settlements).toEqual([
      { from: 'b', to: 'a', amount: 40 },
      { from: 'c', to: 'a', amount: 30 },
    ])
    // Balances always sum to zero.
    expect(s.members.reduce((t, m) => t + m.balance, 0)).toBeCloseTo(0, 9)
  })

  it('reports meal cost as unallocated when no meals are recorded', () => {
    const s = summarize(period({ expenses: [expense({ amount: 50 })] }))
    expect(s.mealRate).toBe(0)
    expect(s.unallocatedMealCost).toBe(50)
  })

  it('includes people referenced by expenses even if removed from the period', () => {
    const s = summarize(period({ memberIds: ['a'], expenses: [expense({ amount: 10, paidBy: 'z', isMeal: false, participants: ['a', 'z'] })] }))
    expect(s.members.map((m) => m.memberId).sort()).toEqual(['a', 'z'])
  })
})

describe('settle', () => {
  it('produces transfers that zero out all balances', () => {
    const balances = [
      { id: 'a', balance: 120.5 },
      { id: 'b', balance: -60.25 },
      { id: 'c', balance: -60.25 },
      { id: 'd', balance: 0 },
    ]
    const t = settle(balances)
    expect(t).toHaveLength(2)
    expect(t.every((x) => x.to === 'a')).toBe(true)
    expect(t.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(120.5)
  })
})

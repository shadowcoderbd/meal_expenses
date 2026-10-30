import { describe, expect, it } from 'vitest'
import { DEFAULT_META, applyMetaOp, applyPeriodOp } from '../reducers'
import type { Period, PeriodOp } from '../types'

const base: Period = { version: 1, id: 'p', name: 'P', createdAt: '', ratio: { b: 0.5, l: 1, d: 1 }, memberIds: ['a', 'b'], expenses: [], meals: {} }

describe('period ops', () => {
  it('re-applying pending ops on a newer remote keeps both sides of a concurrent edit', () => {
    // Another person saved a meal for "a" while we set a meal for "b".
    const remote = applyPeriodOp(base, { type: 'setMeal', date: '2026-10-01', memberId: 'a', count: { b: 1, l: 1, d: 1 } })
    const pending: PeriodOp[] = [{ type: 'setMeal', date: '2026-10-01', memberId: 'b', count: { b: 0, l: 1, d: 0 } }]
    const merged = pending.reduce(applyPeriodOp, remote)
    expect(merged.meals['2026-10-01']).toEqual({ a: { b: 1, l: 1, d: 1 }, b: { b: 0, l: 1, d: 0 } })
  })

  it('upserts and deletes expenses by id', () => {
    const e = { id: 'e1', amount: 10 } as Period['expenses'][number]
    let p = applyPeriodOp(base, { type: 'upsertExpense', expense: e })
    p = applyPeriodOp(p, { type: 'upsertExpense', expense: { ...e, amount: 20 } })
    expect(p.expenses).toHaveLength(1)
    expect(p.expenses[0].amount).toBe(20)
    expect(applyPeriodOp(p, { type: 'deleteExpense', id: 'e1' }).expenses).toHaveLength(0)
  })

  it('removes a day', () => {
    const p = applyPeriodOp(base, { type: 'setDay', date: '2026-10-02', meals: { a: { b: 1, l: 1, d: 1 } } })
    expect(applyPeriodOp(p, { type: 'removeDay', date: '2026-10-02' }).meals).toEqual({})
  })
})

describe('meta ops', () => {
  it('does not add the same period twice', () => {
    const ref = { id: 'x', name: 'X', createdAt: '' }
    const m = applyMetaOp(applyMetaOp(DEFAULT_META, { type: 'addPeriod', period: ref }), { type: 'addPeriod', period: ref })
    expect(m.periods).toHaveLength(1)
  })
})

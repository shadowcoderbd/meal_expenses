/**
 * All changes are expressed as operations applied to the latest file from GitHub.
 * If a save hits a conflict, we refetch and re-apply the pending operations, so
 * concurrent edits by different people are merged instead of overwritten.
 */
import type { Meta, MetaOp, Period, PeriodOp } from './types'

export const DEFAULT_META: Meta = {
  version: 1,
  currency: '৳',
  members: [],
  categories: ['Groceries', 'Fish & Meat', 'Vegetables', 'Rice & Grains', 'Dining out', 'Gas', 'Utilities', 'Rent', 'Other'],
  units: ['pcs', 'kg', 'g', 'liter', 'ml', 'dozen', 'pack', 'bottle'],
  defaultRatio: { b: 0.5, l: 1, d: 1 },
  periods: [],
}

export function applyMetaOp(meta: Meta, op: MetaOp): Meta {
  switch (op.type) {
    case 'replace':
      return op.meta
    case 'upsertMember': {
      const exists = meta.members.some((m) => m.id === op.member.id)
      return {
        ...meta,
        members: exists ? meta.members.map((m) => (m.id === op.member.id ? op.member : m)) : [...meta.members, op.member],
      }
    }
    case 'updateSettings':
      return { ...meta, ...op.settings }
    case 'addPeriod':
      if (meta.periods.some((p) => p.id === op.period.id)) return meta
      return { ...meta, periods: [...meta.periods, op.period] }
    case 'renamePeriod':
      return { ...meta, periods: meta.periods.map((p) => (p.id === op.id ? { ...p, name: op.name } : p)) }
    case 'removePeriod':
      return { ...meta, periods: meta.periods.filter((p) => p.id !== op.id) }
  }
}

export function applyPeriodOp(period: Period, op: PeriodOp): Period {
  switch (op.type) {
    case 'replace':
      return op.period
    case 'upsertExpense': {
      const exists = period.expenses.some((e) => e.id === op.expense.id)
      return {
        ...period,
        expenses: exists
          ? period.expenses.map((e) => (e.id === op.expense.id ? op.expense : e))
          : [...period.expenses, op.expense],
      }
    }
    case 'deleteExpense':
      return { ...period, expenses: period.expenses.filter((e) => e.id !== op.id) }
    case 'setMeal':
      return {
        ...period,
        meals: { ...period.meals, [op.date]: { ...period.meals[op.date], [op.memberId]: op.count } },
      }
    case 'setDay':
      return { ...period, meals: { ...period.meals, [op.date]: { ...period.meals[op.date], ...op.meals } } }
    case 'removeDay': {
      const meals = { ...period.meals }
      delete meals[op.date]
      return { ...period, meals }
    }
    case 'addMembers':
      return { ...period, memberIds: [...period.memberIds, ...op.ids.filter((id) => !period.memberIds.includes(id))] }
    case 'updatePeriod':
      return { ...period, ...op.changes }
  }
}

export function describeMetaOp(op: MetaOp): string {
  switch (op.type) {
    case 'replace':
      return 'Restore settings from backup'
    case 'upsertMember':
      return `Update member ${op.member.name}`
    case 'updateSettings':
      return `Update settings (${Object.keys(op.settings).join(', ')})`
    case 'addPeriod':
      return `Create period "${op.period.name}"`
    case 'renamePeriod':
      return `Rename period to "${op.name}"`
    case 'removePeriod':
      return 'Delete period'
  }
}

export function describePeriodOp(op: PeriodOp): string {
  switch (op.type) {
    case 'replace':
      return 'Replace period data'
    case 'upsertExpense':
      return `Save expense: ${op.expense.description || op.expense.category} ${op.expense.amount}`
    case 'deleteExpense':
      return 'Delete expense'
    case 'setMeal':
      return `Set meals for ${op.date}`
    case 'setDay':
      return `Set meals for ${op.date}`
    case 'removeDay':
      return `Remove meals for ${op.date}`
    case 'addMembers':
      return 'Add members to period'
    case 'updatePeriod':
      return `Update period (${Object.keys(op.changes).join(', ')})`
  }
}

export type MealKind = 'b' | 'l' | 'd'

export interface MealRatio {
  b: number
  l: number
  d: number
}

/** Meals one member had on one day. */
export type MealCount = Record<MealKind, number>

export interface Member {
  id: string
  name: string
  username: string
  /** Inactive members keep their history but can no longer log in or be added to new periods. */
  active: boolean
  createdAt: string
}

export interface PeriodRef {
  id: string
  name: string
  createdAt: string
}

export interface Meta {
  version: 1
  currency: string
  members: Member[]
  categories: string[]
  units: string[]
  defaultRatio: MealRatio
  periods: PeriodRef[]
}

export interface Expense {
  id: string
  amount: number
  description: string
  /** Optional; omitted (along with unit) when no quantity was entered. */
  quantity?: number
  unit?: string
  /** YYYY-MM-DD */
  date: string
  category: string
  paidBy: string
  isMeal: boolean
  /** Members sharing a non-meal expense. Ignored when isMeal is true. */
  participants: string[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Period {
  version: 1
  id: string
  name: string
  createdAt: string
  ratio: MealRatio
  memberIds: string[]
  expenses: Expense[]
  /** date (YYYY-MM-DD) -> memberId -> meals */
  meals: Record<string, Record<string, MealCount>>
}

export type MetaOp =
  | { type: 'upsertMember'; member: Member }
  | { type: 'updateSettings'; settings: Partial<Pick<Meta, 'currency' | 'categories' | 'units' | 'defaultRatio'>> }
  | { type: 'addPeriod'; period: PeriodRef }
  | { type: 'renamePeriod'; id: string; name: string }
  | { type: 'removePeriod'; id: string }
  | { type: 'replace'; meta: Meta }

export type PeriodOp =
  | { type: 'upsertExpense'; expense: Expense }
  | { type: 'deleteExpense'; id: string }
  | { type: 'setMeal'; date: string; memberId: string; count: MealCount }
  | { type: 'setDay'; date: string; meals: Record<string, MealCount> }
  | { type: 'removeDay'; date: string }
  | { type: 'updatePeriod'; changes: Partial<Pick<Period, 'name' | 'ratio' | 'memberIds'>> }
  | { type: 'replace'; period: Period }

/** Decrypted content of a users.json entry; held in memory/localStorage while logged in. */
export interface Session {
  token: string
  memberId: string
  username: string
  dataRepo: { owner: string; repo: string }
}

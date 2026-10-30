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

/** Fixed monthly household bills (entered on the Bill page). */
export interface BillAmounts {
  rent: number
  gas: number
  utility: number
  wifi: number
  maid: number
  electricity: number
}

export interface Room {
  id: string
  name: string
  /** Relative weight of the room's rent, e.g. 17 (small) and 19 (big) out of 36. */
  share: number
  memberIds: string[]
}

export interface Bill {
  amounts: BillAmounts
  rooms: Room[]
}

export interface Meta {
  version: 1
  currency: string
  members: Member[]
  categories: string[]
  units: string[]
  defaultRatio: MealRatio
  periods: PeriodRef[]
  /** Amounts and rooms a period's bill starts from. */
  billDefaults?: Bill
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
  bill?: Bill
}

export type MetaOp =
  | { type: 'upsertMember'; member: Member }
  | { type: 'updateSettings'; settings: Partial<Pick<Meta, 'currency' | 'categories' | 'units' | 'defaultRatio' | 'billDefaults'>> }
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
  /** Adds members without touching others (safe to re-apply after a conflict). */
  | { type: 'addMembers'; ids: string[] }
  | { type: 'updatePeriod'; changes: Partial<Pick<Period, 'name' | 'ratio' | 'memberIds' | 'bill'>> }
  | { type: 'replace'; period: Period }

/** Decrypted content of a users.json entry; held in memory/localStorage while logged in. */
export interface Session {
  token: string
  memberId: string
  username: string
  dataRepo: { owner: string; repo: string }
}

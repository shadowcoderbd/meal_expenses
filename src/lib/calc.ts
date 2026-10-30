import type { MealCount, MealRatio, Period } from './types'

export interface MemberSummary {
  memberId: string
  meals: MealCount
  /** Meals weighted by the period's ratio. */
  weighted: number
  mealCost: number
  /** This member's share of non-meal expenses. */
  sharedCost: number
  paid: number
  /** paid - (mealCost + sharedCost). Positive = should receive money. */
  balance: number
}

export interface Settlement {
  from: string
  to: string
  amount: number
}

export interface PeriodSummary {
  totalExpense: number
  mealExpense: number
  otherExpense: number
  meals: MealCount
  totalWeighted: number
  /** Cost of one meal with ratio 1.0. */
  mealRate: number
  members: MemberSummary[]
  settlements: Settlement[]
  /** Meal expenses exist but no meals were recorded, so nobody is charged for them. */
  unallocatedMealCost: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function weightedMeals(c: MealCount | undefined, r: MealRatio): number {
  if (!c) return 0
  return c.b * r.b + c.l * r.l + c.d * r.d
}

export function dayTotals(day: Record<string, MealCount> | undefined): MealCount {
  const t = { b: 0, l: 0, d: 0 }
  for (const c of Object.values(day ?? {})) {
    t.b += c.b
    t.l += c.l
    t.d += c.d
  }
  return t
}

export function summarize(period: Period): PeriodSummary {
  // Anyone referenced by meals or expenses is included, even if later removed from the period.
  const ids = new Set(period.memberIds)
  for (const day of Object.values(period.meals)) Object.keys(day).forEach((id) => ids.add(id))
  for (const e of period.expenses) {
    ids.add(e.paidBy)
    if (!e.isMeal) e.participants.forEach((id) => ids.add(id))
  }

  const rows = new Map<string, MemberSummary>()
  for (const id of ids) {
    rows.set(id, { memberId: id, meals: { b: 0, l: 0, d: 0 }, weighted: 0, mealCost: 0, sharedCost: 0, paid: 0, balance: 0 })
  }

  const meals = { b: 0, l: 0, d: 0 }
  for (const day of Object.values(period.meals)) {
    for (const [id, c] of Object.entries(day)) {
      const row = rows.get(id)!
      row.meals.b += c.b
      row.meals.l += c.l
      row.meals.d += c.d
      meals.b += c.b
      meals.l += c.l
      meals.d += c.d
    }
  }

  let mealExpense = 0
  let otherExpense = 0
  for (const e of period.expenses) {
    rows.get(e.paidBy)!.paid += e.amount
    if (e.isMeal) {
      mealExpense += e.amount
    } else {
      otherExpense += e.amount
      const people = e.participants.length ? e.participants : [e.paidBy]
      for (const id of people) rows.get(id)!.sharedCost += e.amount / people.length
    }
  }

  let totalWeighted = 0
  for (const row of rows.values()) {
    row.weighted = weightedMeals(row.meals, period.ratio)
    totalWeighted += row.weighted
  }
  const mealRate = totalWeighted > 0 ? mealExpense / totalWeighted : 0

  for (const row of rows.values()) {
    row.mealCost = row.weighted * mealRate
    row.balance = row.paid - row.mealCost - row.sharedCost
  }

  const members = [...rows.values()]
  return {
    totalExpense: mealExpense + otherExpense,
    mealExpense,
    otherExpense,
    meals,
    totalWeighted,
    mealRate,
    members,
    settlements: settle(members.map((m) => ({ id: m.memberId, balance: m.balance }))),
    unallocatedMealCost: totalWeighted > 0 ? 0 : mealExpense,
  }
}

/** Greedy settle-up: the largest debtor pays the largest creditor until everyone is even. */
export function settle(balances: { id: string; balance: number }[]): Settlement[] {
  const creditors = balances.filter((b) => b.balance > 0.005).map((b) => ({ ...b, balance: round2(b.balance) }))
  const debtors = balances.filter((b) => b.balance < -0.005).map((b) => ({ ...b, balance: round2(-b.balance) }))
  creditors.sort((a, b) => b.balance - a.balance)
  debtors.sort((a, b) => b.balance - a.balance)

  const out: Settlement[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].balance, creditors[j].balance))
    if (amount > 0) out.push({ from: debtors[i].id, to: creditors[j].id, amount })
    debtors[i].balance = round2(debtors[i].balance - amount)
    creditors[j].balance = round2(creditors[j].balance - amount)
    if (debtors[i].balance <= 0.005) i++
    if (creditors[j].balance <= 0.005) j++
  }
  return out
}

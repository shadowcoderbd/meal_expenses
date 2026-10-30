/**
 * End-of-month bill:
 *   total rent  = rent + gas + utility, split between rooms by share, then equally within a room
 *   wifi, maid, electricity = split equally among the period's members
 *   mess expense = what the meal summary says each person owes (−balance)
 *   bariwala    = total rent + electricity
 */
import type { Bill, BillAmounts } from './types'

export const EMPTY_AMOUNTS: BillAmounts = { rent: 0, gas: 0, utility: 0, wifi: 0, maid: 0, electricity: 0 }

export interface BillRow {
  memberId: string
  rent: number
  wifi: number
  maid: number
  electricity: number
  mess: number
  total: number
  rounded: number
}

export interface BillResult {
  totalRent: number
  rooms: { id: string; name: string; amount: number; perMember: number; memberIds: string[] }[]
  payees: { bariwala: number; maid: number; wifi: number; total: number }
  rows: BillRow[]
  roundedTotal: number
  /** Members who pay rent but are in no room, and rooms whose rent nobody pays. */
  noRoom: string[]
  emptyRooms: string[]
}

/**
 * @param memberIds people sharing wifi, maid and electricity (the period's members)
 * @param balances meal-summary balance per member (positive = should receive)
 */
export function computeBill(bill: Bill, memberIds: string[], balances: Map<string, number>): BillResult {
  const a = bill.amounts
  const totalRent = a.rent + a.gas + a.utility
  const totalShare = bill.rooms.reduce((s, r) => s + r.share, 0)

  const rentOf = new Map<string, number>()
  const rooms = bill.rooms.map((r) => {
    const amount = totalShare > 0 ? (totalRent * r.share) / totalShare : 0
    const perMember = r.memberIds.length ? amount / r.memberIds.length : 0
    r.memberIds.forEach((id) => rentOf.set(id, (rentOf.get(id) ?? 0) + perMember))
    return { id: r.id, name: r.name, amount, perMember, memberIds: r.memberIds }
  })

  // Columns: period members, then anyone else who is in a room or has a mess balance.
  const ids = [...memberIds]
  for (const id of [...rentOf.keys(), ...[...balances].filter(([, b]) => Math.abs(b) > 0.005).map(([id]) => id)]) {
    if (!ids.includes(id)) ids.push(id)
  }

  const n = memberIds.length
  const each = (amount: number) => (n ? amount / n : 0)
  const rows = ids.map((id) => {
    const sharesBills = memberIds.includes(id)
    const row = {
      memberId: id,
      rent: rentOf.get(id) ?? 0,
      wifi: sharesBills ? each(a.wifi) : 0,
      maid: sharesBills ? each(a.maid) : 0,
      electricity: sharesBills ? each(a.electricity) : 0,
      mess: -(balances.get(id) ?? 0),
    }
    const total = row.rent + row.wifi + row.maid + row.electricity + row.mess
    return { ...row, total, rounded: Math.round(total) }
  })

  return {
    totalRent,
    rooms,
    payees: { bariwala: totalRent + a.electricity, maid: a.maid, wifi: a.wifi, total: totalRent + a.electricity + a.maid + a.wifi },
    rows,
    roundedTotal: rows.reduce((s, r) => s + r.rounded, 0),
    noRoom: memberIds.filter((id) => !rentOf.has(id)),
    emptyRooms: rooms.filter((r) => r.memberIds.length === 0 && r.amount > 0).map((r) => r.name),
  }
}

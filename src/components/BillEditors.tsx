import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../lib/ids'
import type { BillAmounts, Member, Room } from '../lib/types'
import { Button, Input } from './ui'

export const AMOUNT_FIELDS: { key: keyof BillAmounts; label: string }[] = [
  { key: 'rent', label: 'Rent' },
  { key: 'gas', label: 'Gas bill' },
  { key: 'utility', label: 'Utility' },
  { key: 'wifi', label: 'WiFi' },
  { key: 'maid', label: 'Maid' },
  { key: 'electricity', label: 'Electricity' },
]

type AmountTexts = Record<keyof BillAmounts, string>

const toTexts = (a: BillAmounts): AmountTexts =>
  Object.fromEntries(AMOUNT_FIELDS.map(({ key }) => [key, a[key] ? String(a[key]) : ''])) as AmountTexts

const toAmounts = (t: AmountTexts): BillAmounts =>
  Object.fromEntries(AMOUNT_FIELDS.map(({ key }) => [key, Math.max(0, Number(t[key]) || 0)])) as unknown as BillAmounts

/**
 * Inputs for the six bill amounts. Reports every change through onChange (for live totals)
 * and calls onCommit when a field loses focus, so typing doesn't create a save per keystroke.
 */
export function AmountsForm({
  value,
  currency,
  onChange,
  onCommit,
}: {
  value: BillAmounts
  currency: string
  onChange?: (a: BillAmounts) => void
  onCommit?: (a: BillAmounts) => void
}) {
  const [texts, setTexts] = useState(() => toTexts(value))
  const update = (key: keyof BillAmounts, text: string) => {
    const next = { ...texts, [key]: text }
    setTexts(next)
    onChange?.(toAmounts(next))
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {AMOUNT_FIELDS.map(({ key, label }) => (
        <label key={key} className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            {label} ({currency})
          </span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            placeholder="0"
            value={texts[key]}
            onChange={(e) => update(key, e.target.value)}
            onBlur={() => onCommit?.(toAmounts(texts))}
            className="tabular"
          />
        </label>
      ))}
    </div>
  )
}

export function RoomsEditor({ rooms, members, onChange }: { rooms: Room[]; members: Member[]; onChange: (rooms: Room[]) => void }) {
  const totalShare = rooms.reduce((s, r) => s + r.share, 0)
  const set = (id: string, changes: Partial<Room>) => onChange(rooms.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  const toggle = (room: Room, memberId: string) =>
    onChange(
      rooms.map((r) => {
        // A member lives in one room only.
        const without = r.memberIds.filter((m) => m !== memberId)
        if (r.id !== room.id) return { ...r, memberIds: without }
        return { ...r, memberIds: room.memberIds.includes(memberId) ? without : [...without, memberId] }
      }),
    )

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <div key={room.id} className="rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <Input value={room.name} onChange={(e) => set(room.id, { name: e.target.value })} placeholder="Room name" className="min-w-0 flex-1" />
            <Input
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={room.share || ''}
              onChange={(e) => set(room.id, { share: Math.max(0, Number(e.target.value) || 0) })}
              className="w-20 shrink-0 px-2 text-center"
              aria-label="Share"
              placeholder="Share"
            />
            <Button variant="ghost" size="icon" className="h-11 w-10 shrink-0" aria-label={`Remove ${room.name}`} onClick={() => onChange(rooms.filter((r) => r.id !== room.id))}>
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Pays {room.share || 0}/{totalShare || 0} of the total rent
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map((m) => {
              const on = room.memberIds.includes(m.id)
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => toggle(room, m.id)}
                  className={clsx('rounded-full border px-3 py-1 text-sm font-medium', on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted')}
                >
                  {m.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...rooms, { id: uid('r'), name: `Room ${rooms.length + 1}`, share: 1, memberIds: [] }])}>
        <Plus className="h-4 w-4" /> Add room
      </Button>
    </div>
  )
}

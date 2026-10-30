import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { MealKind, MealRatio } from '../lib/types'
import { Button, Input } from './ui'

const LABELS: Record<MealKind, string> = { b: 'Breakfast', l: 'Lunch', d: 'Dinner' }

export function RatioEditor({ value, onSave }: { value: MealRatio; onSave: (r: MealRatio) => void }) {
  const [draft, setDraft] = useState({ b: String(value.b), l: String(value.l), d: String(value.d) })
  const parsed = { b: Number(draft.b), l: Number(draft.l), d: Number(draft.d) }
  const valid = Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0) && parsed.b + parsed.l + parsed.d > 0
  const changed = parsed.b !== value.b || parsed.l !== value.l || parsed.d !== value.d

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(['b', 'l', 'd'] as MealKind[]).map((k) => (
          <label key={k} className="text-center">
            <span className="mb-1 block text-xs font-medium text-muted">{LABELS[k]}</span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              className="text-center font-semibold"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">
        Per-meal cost = total meal expense ÷ (breakfasts × {draft.b || 0} + lunches × {draft.l || 0} + dinners × {draft.d || 0}). For example 100 with 3
        breakfasts, 2 lunches and 3 dinners at 0.5 / 1 / 1 gives 100 ÷ 6.5 = 15.38 per full meal.
      </p>
      {changed && (
        <Button size="sm" disabled={!valid} onClick={() => onSave(parsed)}>
          Save ratio
        </Button>
      )}
    </div>
  )
}

export function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [text, setText] = useState('')
  const add = () => {
    const v = text.trim()
    if (v && !items.some((i) => i.toLowerCase() === v.toLowerCase())) onChange([...items, v])
    setText('')
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm">
            {i}
            <button className="rounded-full p-1 text-muted hover:bg-border hover:text-fg" aria-label={`Remove ${i}`} onClick={() => onChange(items.filter((x) => x !== i))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <Button type="submit" variant="secondary" size="icon" className="h-11 w-11 shrink-0" aria-label="Add">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

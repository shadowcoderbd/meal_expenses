import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { nowIso, today, uid } from '../lib/ids'
import type { Expense } from '../lib/types'
import { useAuth } from '../store/auth'
import { dispatchPeriod } from '../store/data'
import type { PeriodContext } from './PeriodGuard'
import { Button, ErrorText, Field, Input, Modal, Select, Toggle, confirm } from './ui'

export function ExpenseForm({ ctx, expense, onClose }: { ctx: PeriodContext; expense: Expense | 'new'; onClose: () => void }) {
  const me = useAuth((s) => s.session!.memberId)
  const { meta, period, periodMembers } = ctx
  const isNew = expense === 'new'
  const initial: Expense = isNew
    ? {
        id: uid('e'),
        amount: 0,
        description: '',
        date: today(),
        category: meta.categories[0] ?? 'Other',
        paidBy: periodMembers.some((m) => m.id === me) ? me : (periodMembers[0]?.id ?? me),
        isMeal: true,
        participants: periodMembers.map((m) => m.id),
        createdBy: me,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
    : expense
  const [form, setForm] = useState({
    ...initial,
    unit: initial.unit ?? meta.units[0] ?? 'pcs',
    amountText: isNew ? '' : String(initial.amount),
    qtyText: initial.quantity ? String(initial.quantity) : '',
  })
  const [error, setError] = useState<string>()
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Members who can be chosen: everyone in the period plus anyone already referenced by this expense.
  const choosable = ctx.members.filter((m) => period.memberIds.includes(m.id) || m.id === form.paidBy || form.participants.includes(m.id))

  function save() {
    const amount = Number(form.amountText)
    const quantity = form.qtyText === '' ? 0 : Number(form.qtyText)
    if (!(amount > 0)) return setError('Enter an amount greater than 0')
    if (!(quantity >= 0)) return setError('Quantity cannot be negative')
    if (!form.isMeal && form.participants.length === 0) return setError('Select at least one person who shared this expense')
    const { amountText: _a, qtyText: _q, quantity: _qty, unit, ...rest } = form
    const expense: Expense = { ...rest, amount, description: rest.description.trim(), date: rest.date || today(), updatedAt: nowIso() }
    // Quantity is optional: 0 or empty means nothing about quantity is stored.
    if (quantity > 0) Object.assign(expense, { quantity, unit })
    dispatchPeriod(period.id, { type: 'upsertExpense', expense })
    onClose()
  }

  async function remove() {
    if (await confirm('Delete expense?', 'This expense will be removed from the period.', { confirmLabel: 'Delete' })) {
      dispatchPeriod(period.id, { type: 'deleteExpense', id: initial.id })
      onClose()
    }
  }

  const toggleParticipant = (id: string) =>
    set('participants', form.participants.includes(id) ? form.participants.filter((p) => p !== id) : [...form.participants, id])

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Add expense' : 'Edit expense'}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" size="icon" className="h-11 w-11" onClick={remove} aria-label="Delete expense">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <Field label={`Amount (${meta.currency})`}>
          <Input
            autoFocus={isNew}
            inputMode="decimal"
            type="number"
            step="any"
            min="0"
            value={form.amountText}
            onChange={(e) => set('amountText', e.target.value)}
            placeholder="0"
            className="text-lg font-semibold"
          />
        </Field>
        <Field label="Description">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Rice, chicken, vegetables" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity (optional)">
            <Input inputMode="decimal" type="number" step="any" min="0" value={form.qtyText} onChange={(e) => set('qtyText', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Unit">
            <Select value={form.unit} onChange={(e) => set('unit', e.target.value)} disabled={!(Number(form.qtyText) > 0)}>
              {[...new Set([...meta.units, form.unit])].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {[...new Set([...meta.categories, form.category])].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Paid by">
          <Select value={form.paidBy} onChange={(e) => set('paidBy', e.target.value)}>
            {choosable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Toggle
          checked={form.isMeal}
          onChange={(v) => set('isMeal', v)}
          label={
            <span>
              <span className="block font-medium">Meal expense</span>
              <span className="text-xs text-muted">{form.isMeal ? 'Split by meals eaten' : 'Split equally among selected people'}</span>
            </span>
          }
        />
        {!form.isMeal && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium">Shared by</span>
              <button
                type="button"
                className="text-xs font-medium text-primary"
                onClick={() => set('participants', form.participants.length === choosable.length ? [] : choosable.map((m) => m.id))}
              >
                {form.participants.length === choosable.length ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {choosable.map((m) => {
                const on = form.participants.includes(m.id)
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggleParticipant(m.id)}
                    className={clsx(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                      on ? 'border-primary bg-primary-soft text-primary' : 'border-border text-muted',
                    )}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
            {form.participants.length > 0 && Number(form.amountText) > 0 && (
              <p className="mt-2 text-xs text-muted">
                {meta.currency}
                {(Number(form.amountText) / form.participants.length).toFixed(2)} each
              </p>
            )}
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

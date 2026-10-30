import clsx from 'clsx'
import { Plus, Receipt, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExpenseForm } from '../components/ExpenseForm'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { Button, Card, EmptyState } from '../components/ui'
import { summarize } from '../lib/calc'
import { money, num, prettyDate, weekday } from '../lib/format'
import type { Expense } from '../lib/types'

export function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <Card tone={accent ? 'accent' : 'default'} className="p-3.5">
      <p className={clsx('text-xs font-medium', accent ? 'opacity-80' : 'text-muted')}>{label}</p>
      <p className="tabular mt-1 text-xl font-bold">{value}</p>
      {sub && <p className={clsx('mt-0.5 text-xs', accent ? 'opacity-80' : 'text-muted')}>{sub}</p>}
    </Card>
  )
}

type Filter = 'all' | 'meal' | 'other'

function Expenses({ ctx }: { ctx: PeriodContext }) {
  const { period, meta, name } = ctx
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const summary = useMemo(() => summarize(period), [period])

  const groups = useMemo(() => {
    const list = period.expenses
      .filter((e) => filter === 'all' || (filter === 'meal' ? e.isMeal : !e.isMeal))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    const map = new Map<string, Expense[]>()
    for (const e of list) map.set(e.date, [...(map.get(e.date) ?? []), e])
    return [...map.entries()]
  }, [period.expenses, filter])

  const totalMeals = summary.meals.b + summary.meals.l + summary.meals.d

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard accent label="Total spent" value={money(summary.totalExpense, meta.currency)} sub={`${period.expenses.length} expenses`} />
        <StatCard label="Meal expenses" value={money(summary.mealExpense, meta.currency)} />
        <StatCard label="Shared (non-meal)" value={money(summary.otherExpense, meta.currency)} />
        <StatCard label="Meal rate" value={money(summary.mealRate, meta.currency)} sub={`${num(summary.totalWeighted)} weighted · ${totalMeals} meals`} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
          {(['all', 'meal', 'other'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium capitalize', filter === f ? 'bg-surface shadow-sm' : 'text-muted')}
            >
              {f === 'other' ? 'Shared' : f}
            </button>
          ))}
        </div>
        <Button className="hidden sm:inline-flex" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Add expense
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<Receipt className="h-7 w-7" />} title="No expenses yet">
            Tap <b>+</b> to add the first one.
          </EmptyState>
        </Card>
      ) : (
        groups.map(([date, items]) => (
          <section key={date}>
            <div className="mb-1.5 flex items-baseline justify-between px-1">
              <h3 className="text-sm font-semibold">
                {prettyDate(date)} <span className="font-normal text-muted">· {weekday(date)}</span>
              </h3>
              <span className="tabular text-xs text-muted">{money(items.reduce((s, e) => s + e.amount, 0), meta.currency)}</span>
            </div>
            <Card className="divide-y divide-border overflow-hidden">
              {items.map((e) => (
                <button key={e.id} onClick={() => setEditing(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', e.isMeal ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted')}>
                    {e.isMeal ? <Receipt className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.description || e.category}</p>
                    <p className="truncate text-xs text-muted">
                      {e.category}
                      {!!e.quantity && ` · ${num(e.quantity)} ${e.unit ?? ''}`} · paid by {name(e.paidBy)}
                      {!e.isMeal && ` · shared by ${e.participants.length}`}
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-semibold">{money(e.amount, meta.currency)}</span>
                </button>
              ))}
            </Card>
          </section>
        ))
      )}

      <button
        onClick={() => setEditing('new')}
        aria-label="Add expense"
        className="no-print fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-xl active:scale-95 sm:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {editing && <ExpenseForm key={editing === 'new' ? 'new' : editing.id} ctx={ctx} expense={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

export default function ExpensesPage() {
  return <PeriodGuard>{(ctx) => <Expenses ctx={ctx} />}</PeriodGuard>
}

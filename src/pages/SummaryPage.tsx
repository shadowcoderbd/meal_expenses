import clsx from 'clsx'
import { AlertTriangle, ArrowRight, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { Button, Card, SectionTitle } from '../components/ui'
import { summarize } from '../lib/calc'
import { money, num } from '../lib/format'
import { useAuth } from '../store/auth'
import { StatCard } from './ExpensesPage'

function Summary({ ctx }: { ctx: PeriodContext }) {
  const { period, meta, name } = ctx
  const me = useAuth((s) => s.session!.memberId)
  const s = useMemo(() => summarize(period), [period])
  const c = meta.currency
  const order = new Map(meta.members.map((m, i) => [m.id, i]))
  const rows = [...s.members].sort((a, b) => (order.get(a.memberId) ?? 99) - (order.get(b.memberId) ?? 99))
  const mine = s.members.find((m) => m.memberId === me)
  const ratio = period.ratio

  return (
    <div className="space-y-5">
      <div className="print-only mb-4">
        <h1 className="text-2xl font-bold">{period.name} — Meal summary</h1>
        <p className="text-sm">Printed {new Date().toLocaleString()}</p>
      </div>

      <div className="no-print flex items-center justify-between">
        <h2 className="text-base font-semibold">Summary</h2>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {s.unallocatedMealCost > 0 && (
        <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {money(s.unallocatedMealCost, c)} of meal expenses can't be split yet because no meals are recorded.
        </div>
      )}

      {mine && (
        <Card tone={mine.balance >= 0 ? 'good' : 'bad'} className="no-print p-4">
          <p className="text-sm text-muted">Your balance</p>
          <p className={clsx('tabular text-2xl font-bold', mine.balance >= 0 ? 'text-primary' : 'text-danger')}>
            {mine.balance >= 0 ? 'You get ' : 'You owe '}
            {money(Math.abs(mine.balance), c)}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total expense" value={money(s.totalExpense, c)} />
        <StatCard label="Meal expense" value={money(s.mealExpense, c)} />
        <StatCard label="Total meals" value={String(s.meals.b + s.meals.l + s.meals.d)} sub={`B ${s.meals.b} · L ${s.meals.l} · D ${s.meals.d}`} />
        <StatCard accent label="Meal rate" value={money(s.mealRate, c)} sub={`per meal (ratio 1.0)`} />
      </div>

      <Card className="p-4 text-sm">
        <p className="font-medium">How the meal rate is calculated</p>
        <p className="tabular mt-1 text-muted">
          {money(s.mealExpense, c)} ÷ ({s.meals.b}×{ratio.b} + {s.meals.l}×{ratio.l} + {s.meals.d}×{ratio.d}) = {money(s.mealExpense, c)} ÷ {num(s.totalWeighted)} ={' '}
          <b className="text-fg">{money(s.mealRate, c)}</b>
        </p>
      </Card>

      <section>
        <SectionTitle>Per person</SectionTitle>
        {/* Cards on phones */}
        <div className="space-y-3 sm:hidden print:hidden">
          {rows.map((r) => (
            <Card key={r.memberId} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{name(r.memberId)}</p>
                  <p className="text-xs text-muted">
                    B {r.meals.b} · L {r.meals.l} · D {r.meals.d} · {num(r.weighted)} weighted
                  </p>
                </div>
                <p className={clsx('tabular text-right font-bold', r.balance >= 0 ? 'text-good' : 'text-danger')}>
                  {r.balance >= 0 ? '+' : ''}
                  {money(r.balance, c)}
                </p>
              </div>
              <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Meal cost</dt>
                  <dd className="font-medium">{money(r.mealCost, c)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Shared</dt>
                  <dd className="font-medium">{money(r.sharedCost, c)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Paid</dt>
                  <dd className="font-medium">{money(r.paid, c)}</dd>
                </div>
              </dl>
            </Card>
          ))}
        </div>
        {/* Table on larger screens and in print */}
        <Card className="hidden overflow-x-auto sm:block print:block">
          <table className="tabular w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-2 py-2.5 text-right font-medium">B</th>
                <th className="px-2 py-2.5 text-right font-medium">L</th>
                <th className="px-2 py-2.5 text-right font-medium">D</th>
                <th className="px-2 py-2.5 text-right font-medium">Weighted</th>
                <th className="px-2 py-2.5 text-right font-medium">Meal cost</th>
                <th className="px-2 py-2.5 text-right font-medium">Shared</th>
                <th className="px-2 py-2.5 text-right font-medium">Paid</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.memberId}>
                  <td className="px-4 py-2.5 font-medium">{name(r.memberId)}</td>
                  <td className="px-2 py-2.5 text-right">{r.meals.b}</td>
                  <td className="px-2 py-2.5 text-right">{r.meals.l}</td>
                  <td className="px-2 py-2.5 text-right">{r.meals.d}</td>
                  <td className="px-2 py-2.5 text-right">{num(r.weighted)}</td>
                  <td className="px-2 py-2.5 text-right">{money(r.mealCost, c)}</td>
                  <td className="px-2 py-2.5 text-right">{money(r.sharedCost, c)}</td>
                  <td className="px-2 py-2.5 text-right">{money(r.paid, c)}</td>
                  <td className={clsx('px-4 py-2.5 text-right font-semibold', r.balance >= 0 ? 'text-good' : 'text-danger')}>
                    {r.balance >= 0 ? '+' : ''}
                    {money(r.balance, c)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-2 py-2.5 text-right">{s.meals.b}</td>
                <td className="px-2 py-2.5 text-right">{s.meals.l}</td>
                <td className="px-2 py-2.5 text-right">{s.meals.d}</td>
                <td className="px-2 py-2.5 text-right">{num(s.totalWeighted)}</td>
                <td className="px-2 py-2.5 text-right">{money(s.mealExpense - s.unallocatedMealCost, c)}</td>
                <td className="px-2 py-2.5 text-right">{money(s.otherExpense, c)}</td>
                <td className="px-2 py-2.5 text-right">{money(s.totalExpense, c)}</td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted">Balance = paid − meal cost − shared cost. Positive means the person should receive money.</p>
      </section>

      <section>
        <SectionTitle>Who pays whom</SectionTitle>
        <Card className="divide-y divide-border">
          {s.settlements.length === 0 ? (
            <p className="p-4 text-sm text-muted">Everyone is settled up.</p>
          ) : (
            s.settlements.map((t, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className={clsx('min-w-0 flex-1 truncate font-medium', t.from === me && 'text-danger')}>{name(t.from)}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted" />
                <span className={clsx('min-w-0 flex-1 truncate font-medium', t.to === me && 'text-good')}>{name(t.to)}</span>
                <span className="tabular shrink-0 font-semibold">{money(t.amount, c)}</span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  )
}

export default function SummaryPage() {
  return <PeriodGuard>{(ctx) => <Summary ctx={ctx} />}</PeriodGuard>
}

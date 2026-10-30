import clsx from 'clsx'
import { CalendarPlus, ChevronRight, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { Button, Card, EmptyState, Field, Input, Modal } from '../components/ui'
import { dayTotals, weightedMeals } from '../lib/calc'
import { num, prettyDate, weekday } from '../lib/format'
import { today } from '../lib/ids'
import type { MealKind } from '../lib/types'

export const MEAL_LABELS: Record<MealKind, string> = { b: 'Breakfast', l: 'Lunch', d: 'Dinner' }

function Meals({ ctx }: { ctx: PeriodContext }) {
  const { period } = ctx
  const navigate = useNavigate()
  const [picking, setPicking] = useState(false)
  const [date, setDate] = useState(today())
  const now = today()

  const days = Object.keys(period.meals).sort((a, b) => b.localeCompare(a))
  const totals = days.reduce(
    (acc, d) => {
      const t = dayTotals(period.meals[d])
      return { b: acc.b + t.b, l: acc.l + t.l, d: acc.d + t.d }
    },
    { b: 0, l: 0, d: 0 },
  )

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Total meals</p>
            <p className="tabular text-2xl font-bold">{totals.b + totals.l + totals.d}</p>
          </div>
          <div className="flex gap-4 text-center">
            {(['b', 'l', 'd'] as MealKind[]).map((k) => (
              <div key={k}>
                <p className="text-xs text-muted">
                  {MEAL_LABELS[k]} <span className="opacity-70">×{period.ratio[k]}</span>
                </p>
                <p className="tabular font-semibold">{totals[k]}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button className="flex-1 sm:flex-none" onClick={() => navigate(`/p/${period.id}/meals/${now}`)}>
          <UtensilsCrossed className="h-4 w-4" /> Today's meals
        </Button>
        <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setPicking(true)}>
          <CalendarPlus className="h-4 w-4" /> Other day
        </Button>
      </div>

      {days.length === 0 ? (
        <Card>
          <EmptyState icon={<UtensilsCrossed className="h-7 w-7" />} title="No meals recorded">
            Add today's meals, or pick any day — future days are fine for planning ahead.
          </EmptyState>
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {days.map((d) => {
            const t = dayTotals(period.meals[d])
            const weighted = Object.values(period.meals[d]).reduce((s, c) => s + weightedMeals(c, period.ratio), 0)
            return (
              <Link key={d} to={`/p/${period.id}/meals/${d}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <div className={clsx('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-xs leading-tight', d === now ? 'bg-primary text-primary-fg' : 'bg-surface-2')}>
                  <span className="font-bold">{prettyDate(d, { day: 'numeric' })}</span>
                  <span className="opacity-75">{prettyDate(d, { month: 'short' })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {weekday(d)}
                    {d > now && <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">Upcoming</span>}
                    {d === now && <span className="ml-2 text-xs font-normal text-muted">Today</span>}
                  </p>
                  <p className="text-xs text-muted">
                    B {t.b} · L {t.l} · D {t.d}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular font-semibold">{t.b + t.l + t.d}</p>
                  <p className="tabular text-[11px] text-muted">{num(weighted)} wt.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted" />
              </Link>
            )
          })}
        </Card>
      )}

      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title="Pick a day"
        footer={
          <Button className="flex-1" disabled={!date} onClick={() => navigate(`/p/${period.id}/meals/${date}`)}>
            Open
          </Button>
        }
      >
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Modal>
    </div>
  )
}

export default function MealsPage() {
  return <PeriodGuard>{(ctx) => <Meals ctx={ctx} />}</PeriodGuard>
}

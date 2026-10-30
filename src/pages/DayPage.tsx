import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Eraser } from 'lucide-react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { Button, Card, Stepper, confirm, toast } from '../components/ui'
import { dayTotals, weightedMeals } from '../lib/calc'
import { num, prettyDate, weekday } from '../lib/format'
import { today } from '../lib/ids'
import type { MealCount, MealKind } from '../lib/types'
import { dispatchPeriod } from '../store/data'
import { MEAL_LABELS } from './MealsPage'

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const ZERO: MealCount = { b: 0, l: 0, d: 0 }

function Day({ ctx, date }: { ctx: PeriodContext; date: string }) {
  const { period, periodMembers, members } = ctx
  const navigate = useNavigate()
  const day = period.meals[date] ?? {}

  // Members in the period, plus anyone who already has meals recorded for this day.
  const rows = members.filter((m) => period.memberIds.includes(m.id) || day[m.id])
  // Hide meal types whose ratio is 0 (e.g. breakfast not counted) unless something is recorded.
  const kinds = (['b', 'l', 'd'] as MealKind[]).filter((k) => period.ratio[k] > 0 || rows.some((m) => (day[m.id]?.[k] ?? 0) > 0))
  const totals = dayTotals(day)

  const set = (memberId: string, kind: MealKind, value: number) =>
    dispatchPeriod(period.id, { type: 'setMeal', date, memberId, count: { ...ZERO, ...day[memberId], [kind]: value } })

  function copyPrevious() {
    const previous = Object.keys(period.meals)
      .filter((d) => d < date)
      .sort()
      .pop()
    if (!previous) return toast('No earlier day to copy from')
    dispatchPeriod(period.id, { type: 'setDay', date, meals: period.meals[previous] })
    toast(`Copied from ${prettyDate(previous)}`)
  }

  function fillDefault() {
    const meals: Record<string, MealCount> = {}
    for (const m of periodMembers) meals[m.id] = { b: period.ratio.b > 0 ? 1 : 0, l: 1, d: 1 }
    dispatchPeriod(period.id, { type: 'setDay', date, meals })
  }

  async function clear() {
    if (await confirm('Clear this day?', `All meals for ${prettyDate(date)} will be removed.`, { confirmLabel: 'Clear' })) {
      dispatchPeriod(period.id, { type: 'removeDay', date })
      navigate(`/p/${period.id}/meals`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={`/p/${period.id}/meals`} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Back to meals">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="font-semibold">{prettyDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-xs text-muted">{date === today() ? 'Today' : date > today() ? 'Upcoming' : weekday(date) + ', ' + date.slice(0, 4)}</p>
        </div>
        <Link to={`/p/${period.id}/meals/${shiftDate(date, -1)}`} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Previous day">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <Link to={`/p/${period.id}/meals/${shiftDate(date, 1)}`} className="rounded-lg p-2 hover:bg-surface-2" aria-label="Next day">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted">
          No members in this period. Add them in{' '}
          <Link className="text-primary underline" to={`/p/${period.id}/settings`}>
            period settings
          </Link>
          .
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((m) => {
            const c = day[m.id] ?? ZERO
            return (
              <div key={m.id} className="px-4 py-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="font-medium">{m.name}</p>
                  <p className="tabular text-xs text-muted">
                    {c.b + c.l + c.d} meals · {num(weightedMeals(c, period.ratio))} wt.
                  </p>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${kinds.length}, minmax(0, 1fr))` }}>
                  {kinds.map((k) => (
                    <div key={k} className="flex flex-col items-center gap-1 rounded-xl bg-surface-2/60 py-2">
                      <span className="text-[11px] font-medium text-muted">{MEAL_LABELS[k]}</span>
                      <Stepper label={`${MEAL_LABELS[k]} for ${m.name}`} value={c[k]} onChange={(v) => set(m.id, k, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-between bg-surface-2/50 px-4 py-3 text-sm">
            <span className="font-semibold">Day total</span>
            <span className="tabular text-muted">
              {kinds.map((k) => `${MEAL_LABELS[k][0]} ${totals[k]}`).join(' · ')} ·{' '}
              <b className="text-fg">{totals.b + totals.l + totals.d}</b>
            </span>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={fillDefault}>
          Everyone eats
        </Button>
        <Button variant="secondary" size="sm" onClick={copyPrevious}>
          <Copy className="h-4 w-4" /> Copy previous day
        </Button>
        {period.meals[date] && (
          <Button variant="danger" size="sm" onClick={clear}>
            <Eraser className="h-4 w-4" /> Clear day
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Changes save automatically.</p>
    </div>
  )
}

export default function DayPage() {
  const { date } = useParams()
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return <Navigate to=".." replace />
  return <PeriodGuard>{(ctx) => <Day ctx={ctx} date={date} />}</PeriodGuard>
}

import { Loader2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Member, Meta, Period } from '../lib/types'
import { loadPeriod, periodPath, useData, useMeta, usePeriod } from '../store/data'

export interface PeriodContext {
  period: Period
  meta: Meta
  members: Member[]
  /** Members active in this period, in settings order. */
  periodMembers: Member[]
  name: (id: string) => string
}

/** Loads the period from the URL and renders children once it is available. */
export function PeriodGuard({ children }: { children: (ctx: PeriodContext) => ReactNode }) {
  const { periodId } = useParams()
  const meta = useMeta()!
  const period = usePeriod(periodId)
  const loaded = useData((s) => (periodId ? s.loaded[periodPath(periodId)] : false))
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (periodId) loadPeriod(periodId).catch((e) => setError(e.message))
  }, [periodId])

  if (!period) {
    if (error) return <p className="py-10 text-center text-sm text-danger">{error}</p>
    if (loaded)
      return (
        <div className="py-14 text-center">
          <p className="font-semibold">This period no longer exists</p>
          <Link to="/periods" className="mt-2 inline-block text-sm text-primary underline">
            See all periods
          </Link>
        </div>
      )
    return (
      <div className="flex justify-center py-16 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const byId = new Map(meta.members.map((m) => [m.id, m]))
  const periodMembers = meta.members.filter((m) => period.memberIds.includes(m.id))
  return (
    <>
      {children({
        period,
        meta,
        members: meta.members,
        periodMembers,
        name: (id) => byId.get(id)?.name ?? 'Unknown',
      })}
    </>
  )
}

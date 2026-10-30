import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { RatioEditor } from '../components/editors'
import { Button, Card, Field, Input, SectionTitle, toast } from '../components/ui'
import { dispatchMeta, dispatchPeriod } from '../store/data'

function PeriodSettings({ ctx }: { ctx: PeriodContext }) {
  const { period, members } = ctx
  const [name, setName] = useState(period.name)
  const choosable = members.filter((m) => m.active || period.memberIds.includes(m.id))

  const toggle = (id: string) => {
    const memberIds = period.memberIds.includes(id) ? period.memberIds.filter((x) => x !== id) : [...period.memberIds, id]
    dispatchPeriod(period.id, { type: 'updatePeriod', changes: { memberIds } })
  }

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>Period</SectionTitle>
        <Card className="space-y-3 p-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {name.trim() && name.trim() !== period.name && (
            <Button
              size="sm"
              onClick={() => {
                dispatchPeriod(period.id, { type: 'updatePeriod', changes: { name: name.trim() } })
                dispatchMeta({ type: 'renamePeriod', id: period.id, name: name.trim() })
                toast('Renamed')
              }}
            >
              Save name
            </Button>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Meal ratio for this period</SectionTitle>
        <Card className="p-4">
          <RatioEditor
            key={JSON.stringify(period.ratio)}
            value={period.ratio}
            onSave={(ratio) => {
              dispatchPeriod(period.id, { type: 'updatePeriod', changes: { ratio } })
              toast('Ratio saved')
            }}
          />
        </Card>
      </section>

      <section>
        <SectionTitle>Members in this period</SectionTitle>
        <Card className="divide-y divide-border">
          {choosable.map((m) => {
            const on = period.memberIds.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggle(m.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <span className={clsx('flex h-6 w-6 items-center justify-center rounded-md border', on ? 'border-primary bg-primary text-primary-fg' : 'border-border')}>
                  {on && <Check className="h-4 w-4" />}
                </span>
                <span className="flex-1 font-medium">{m.name}</span>
                {!m.active && <span className="text-xs text-muted">inactive</span>}
              </button>
            )
          })}
        </Card>
        <p className="mt-2 text-xs text-muted">Members appear in the meal sheet and as default sharers of new expenses.</p>
      </section>
    </div>
  )
}

export default function PeriodSettingsPage() {
  return <PeriodGuard>{(ctx) => <PeriodSettings ctx={ctx} />}</PeriodGuard>
}

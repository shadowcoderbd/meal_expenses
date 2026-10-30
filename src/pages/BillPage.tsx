import clsx from 'clsx'
import { AlertTriangle, Pencil, Printer, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AmountsForm, RoomsEditor } from '../components/BillEditors'
import { PeriodGuard, type PeriodContext } from '../components/PeriodGuard'
import { Button, Card, Modal, SectionTitle, confirm, toast } from '../components/ui'
import { EMPTY_AMOUNTS, computeBill } from '../lib/bill'
import { summarize } from '../lib/calc'
import { fixed2 } from '../lib/format'
import type { Bill, Room } from '../lib/types'
import { dispatchMeta, dispatchPeriod } from '../store/data'

const whole = (n: number) => Math.round(n).toLocaleString()

function BillView({ ctx }: { ctx: PeriodContext }) {
  const { period, meta, name, periodMembers } = ctx
  const saved: Bill = period.bill ?? meta.billDefaults ?? { amounts: EMPTY_AMOUNTS, rooms: [] }
  // Live amounts while typing; resets when the saved bill changes (e.g. someone else edited it).
  const savedKey = JSON.stringify(saved.amounts)
  const [draft, setDraft] = useState({ key: savedKey, amounts: saved.amounts })
  const amounts = draft.key === savedKey ? draft.amounts : saved.amounts
  const setAmounts = (a: typeof amounts) => setDraft({ key: savedKey, amounts: a })
  const [editingRooms, setEditingRooms] = useState<Room[] | null>(null)
  const c = meta.currency

  const bill: Bill = { amounts, rooms: saved.rooms }
  const summary = useMemo(() => summarize(period), [period])
  const balances = useMemo(() => new Map(summary.members.map((m) => [m.memberId, m.balance])), [summary])
  const r = computeBill(
    bill,
    periodMembers.map((m) => m.id),
    balances,
  )

  const roomCandidates = meta.members.filter((m) => m.active || period.memberIds.includes(m.id) || saved.rooms.some((x) => x.memberIds.includes(m.id)))
  const save = (next: Bill) => dispatchPeriod(period.id, { type: 'updatePeriod', changes: { bill: next } })
  const commitAmounts = (a: typeof amounts) => {
    if (!period.bill || JSON.stringify(a) !== JSON.stringify(period.bill.amounts)) save({ ...saved, amounts: a })
  }

  async function saveAsDefault() {
    if (await confirm('Save as default?', 'New periods will start with these amounts and rooms.', { confirmLabel: 'Save', danger: false })) {
      dispatchMeta({ type: 'updateSettings', settings: { billDefaults: bill } })
      toast('Saved as default')
    }
  }

  type Row = (typeof r.rows)[number]
  const groups: { label: string; lines: { label: string; value: (x: Row) => number }[] }[] = [
    {
      label: 'Prepaid',
      lines: [
        { label: 'Rent', value: (x) => x.rent },
        { label: 'WiFi', value: (x) => x.wifi },
      ],
    },
    {
      label: 'Postpaid',
      lines: [
        { label: 'Maid', value: (x) => x.maid },
        { label: 'Electricity', value: (x) => x.electricity },
        { label: 'Mess expense', value: (x) => x.mess },
      ],
    },
  ]

  // Active members who were added after this period was created.
  const missing = meta.members.filter((m) => m.active && !period.memberIds.includes(m.id))
  const addToPeriod = (ids: string[]) => {
    const fresh = ids.filter((id) => !period.memberIds.includes(id))
    if (fresh.length) dispatchPeriod(period.id, { type: 'addMembers', ids: fresh })
  }
  // Bills not covered by anyone's total (e.g. a room with nobody in it). Rounding alone stays under 1 per person.
  const unallocated = r.payees.total - r.rows.reduce((t, x) => t + x.total, 0)

  return (
    <div className="space-y-5">
      <div className="print-only mb-2">
        <h1 className="text-2xl font-bold">{period.name} — Monthly bill</h1>
        <p className="text-sm">Printed {new Date().toLocaleString()}</p>
      </div>

      <div className="no-print flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Monthly bill</h2>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <section className="no-print">
        <Card className="p-4">
          <AmountsForm key={savedKey} value={saved.amounts} currency={c} onChange={setAmounts} onCommit={commitAmounts} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted">
              Total rent (rent + gas + utility): <b className="tabular text-fg">{fixed2(r.totalRent)}</b>
            </span>
            <div className="flex gap-2">
              {!period.bill && (
                <Button size="sm" onClick={() => save(bill)}>
                  Save bill
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={saveAsDefault}>
                Save as default
              </Button>
            </div>
          </div>
          {!period.bill && <p className="mt-2 text-xs text-muted">Showing the default amounts. They're saved for this period once you edit or tap “Save bill”.</p>}
        </Card>
      </section>

      {missing.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-3 rounded-xl bg-primary-soft p-3 text-sm">
          <UserPlus className="h-4 w-4 shrink-0 text-primary" />
          <p className="min-w-0 flex-1">
            Not in this period: <b>{missing.map((m) => m.name).join(', ')}</b>. Only period members share WiFi, maid, electricity and appear here.
          </p>
          <Button size="sm" onClick={() => addToPeriod(missing.map((m) => m.id))}>
            Add to period
          </Button>
        </div>
      )}

      {(r.noRoom.length > 0 || r.emptyRooms.length > 0 || saved.rooms.length === 0 || Math.abs(unallocated) > 0.01) && (
        <div className="no-print flex gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            {saved.rooms.length === 0 && <p>Add rooms so the rent can be split.</p>}
            {saved.rooms.length > 0 && r.noRoom.length > 0 && <p>Not in any room (pays no rent): {r.noRoom.map(name).join(', ')}.</p>}
            {r.emptyRooms.length > 0 && <p>Nobody is assigned to: {r.emptyRooms.join(', ')}.</p>}
            {Math.abs(unallocated) > 0.01 && (
              <p>
                {fixed2(Math.abs(unallocated))} of the bills {unallocated > 0 ? 'is not charged to anyone' : 'is charged twice'}. Check the rooms and the
                period's members.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            action={
              <Button variant="ghost" size="sm" className="no-print" onClick={() => setEditingRooms(saved.rooms)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            }
          >
            Rooms
          </SectionTitle>
          {r.rooms.length === 0 ? (
            <p className="text-sm text-muted">No rooms yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {r.rooms.map((room) => (
                <div key={room.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{room.name}</p>
                    <p className="truncate text-xs text-muted">{room.memberIds.map(name).join(', ') || 'No members'}</p>
                  </div>
                  <span className="tabular font-semibold">{fixed2(room.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <SectionTitle>{period.name}</SectionTitle>
          <dl className="tabular divide-y divide-border text-sm">
            {[
              ['Bariwala', r.payees.bariwala],
              ['Maid', r.payees.maid],
              ['WiFi', r.payees.wifi],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2">
                <dt>{label}</dt>
                <dd>{whole(value as number)}</dd>
              </div>
            ))}
            <div className="flex justify-between py-2 text-lg font-bold">
              <dt>Total</dt>
              <dd className="text-danger">{whole(r.payees.total)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-muted">Bariwala = total rent + electricity.</p>
        </Card>
      </div>

      <section>
        <SectionTitle>Per person</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
          {r.rows.map((x) => (
            <Card key={x.memberId} className="p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border pb-3">
                <p className="truncate text-base font-semibold">{name(x.memberId)}</p>
                <p className="tabular text-2xl font-bold">{x.rounded.toLocaleString()}</p>
              </div>
              {groups.map((g) => (
                <div key={g.label} className="mb-2">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</p>
                  <dl className="tabular space-y-1 text-sm">
                    {g.lines.map((line) => {
                      const v = line.value(x)
                      return (
                        <div key={line.label} className="flex justify-between gap-3">
                          <dt className="text-muted">{line.label}</dt>
                          <dd className={clsx(line.label === 'Mess expense' && v < 0 && 'text-good')}>{fixed2(v)}</dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              ))}
              <div className="tabular mt-3 flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Total per person</span>
                <span>{fixed2(x.total)}</span>
              </div>
            </Card>
          ))}
        </div>
        <Card tone="accent" className="mt-3 flex items-center justify-between p-4">
          <span className="text-base font-semibold">Total (rounded)</span>
          <span className="tabular text-2xl font-bold">{r.roundedTotal.toLocaleString()}</span>
        </Card>
        <p className="mt-2 text-xs text-muted">
          Mess expense comes from the Summary: what each person owes for meals and shared expenses (negative = gets money back). Rent is split by room, WiFi,
          maid and electricity equally among the {periodMembers.length} period members.
        </p>
      </section>

      {editingRooms && (
        <Modal
          open
          onClose={() => setEditingRooms(null)}
          title="Rooms for this period"
          footer={
            <Button
              className="flex-1"
              onClick={() => {
                const rooms = editingRooms.filter((x) => x.name.trim())
                addToPeriod(rooms.flatMap((x) => x.memberIds))
                save({ ...bill, rooms })
                setEditingRooms(null)
              }}
            >
              Save rooms
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted">Share is the room's weight, e.g. 17 for the small room and 19 for the big room.</p>
          <RoomsEditor rooms={editingRooms} members={roomCandidates} onChange={setEditingRooms} />
          <p className="mt-3 text-xs text-muted">Anyone you put in a room is added to this period.</p>
        </Modal>
      )}
    </div>
  )
}

export default function BillPage() {
  return <PeriodGuard>{(ctx) => <BillView key={ctx.period.id} ctx={ctx} />}</PeriodGuard>
}

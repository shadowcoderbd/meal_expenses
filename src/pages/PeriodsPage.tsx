import { CalendarRange, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Card, Field, Input, Modal, SectionTitle, confirm, toast } from '../components/ui'
import { nowIso, slugify, uid } from '../lib/ids'
import { createPeriod, deletePeriod, dispatchMeta, dispatchPeriod, useMeta } from '../store/data'

export default function PeriodsPage() {
  const meta = useMeta()!
  const navigate = useNavigate()
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null)

  function save() {
    const name = editing!.name.trim()
    if (!name) return
    if (editing!.id) {
      dispatchMeta({ type: 'renamePeriod', id: editing!.id, name })
      dispatchPeriod(editing!.id, { type: 'updatePeriod', changes: { name } })
      setEditing(null)
      return
    }
    const id = `${slugify(name)}-${uid().slice(-6)}`
    createPeriod({
      version: 1,
      id,
      name,
      createdAt: nowIso(),
      ratio: { ...meta.defaultRatio },
      memberIds: meta.members.filter((m) => m.active).map((m) => m.id),
      expenses: [],
      meals: {},
    })
    setEditing(null)
    navigate(`/p/${id}/expenses`)
  }

  async function remove(id: string, name: string) {
    const ok = await confirm('Delete period?', <>All expenses and meals in “{name}” will be deleted. You can still recover it from the GitHub history.</>, {
      confirmLabel: 'Delete',
    })
    if (!ok) return
    try {
      await deletePeriod(id)
      toast('Period deleted')
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          <Button size="sm" onClick={() => setEditing({ name: '' })}>
            <Plus className="h-4 w-4" /> New period
          </Button>
        }
      >
        Periods
      </SectionTitle>
      <p className="-mt-2 text-sm text-muted">A period is anything you want to track separately: “October 2026”, “Trip to Cox's Bazar”…</p>

      {meta.periods.length === 0 ? (
        <Card className="p-2">
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <CalendarRange className="h-7 w-7" />
            </div>
            <p className="font-semibold">No periods yet</p>
            <p className="mt-1 text-sm text-muted">Create your first period to start adding expenses and meals.</p>
            <Button className="mt-4" onClick={() => setEditing({ name: '' })}>
              <Plus className="h-4 w-4" /> Create period
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {[...meta.periods].reverse().map((p) => (
            <div key={p.id} className="flex items-center gap-2 px-4 py-3">
              <Link to={`/p/${p.id}/expenses`} className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-muted">Created {new Date(p.createdAt).toLocaleDateString()}</p>
              </Link>
              <Button variant="ghost" size="icon" aria-label="Rename" onClick={() => setEditing({ id: p.id, name: p.name })}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => remove(p.id, p.name)}>
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
              <Link to={`/p/${p.id}/expenses`} aria-label="Open">
                <ChevronRight className="h-5 w-5 text-muted" />
              </Link>
            </div>
          ))}
        </Card>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Rename period' : 'New period'}
        footer={
          <Button className="flex-1" onClick={save} disabled={!editing?.name.trim()}>
            {editing?.id ? 'Save' : 'Create'}
          </Button>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <Field label="Name" hint={editing?.id ? undefined : 'New periods include all active members and the default meal ratio.'}>
            <Input autoFocus value={editing?.name ?? ''} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} placeholder="e.g. November 2026" />
          </Field>
        </form>
      </Modal>
    </div>
  )
}

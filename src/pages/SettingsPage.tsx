import clsx from 'clsx'
import { Download, KeyRound, LogOut, Monitor, Moon, RotateCcw, Sun, Upload, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { AmountsForm, RoomsEditor } from '../components/BillEditors'
import { ListEditor, RatioEditor } from '../components/editors'
import { Button, Card, CopyButton, ErrorText, Field, Input, Modal, SectionTitle, confirm, toast } from '../components/ui'
import { downloadJson, parseBackup } from '../lib/backup'
import { EMPTY_AMOUNTS } from '../lib/bill'
import { MIN_PASSWORD_LENGTH, normaliseUsername } from '../lib/crypto'
import { nowIso, today, uid } from '../lib/ids'
import { useTheme, type ThemePref } from '../lib/theme'
import type { Bill, Member } from '../lib/types'
import { changeOwnPassword, issuePassword, replaceToken, revokeLogin, useAuth, usernameTaken } from '../store/auth'
import { dispatchMeta, exportAll, restoreAll, useMeta } from '../store/data'

function Credentials({ items, onClose }: { items: { name: string; username: string; password: string }[]; onClose: () => void }) {
  const url = window.location.href.split('#')[0]
  const message = items.map((i) => `Meal Expenses login for ${i.name}\n${url}\nUsername: ${i.username}\nPassword: ${i.password}`).join('\n\n')
  return (
    <Modal open onClose={onClose} title="Share login details" footer={<Button className="flex-1" onClick={onClose}>Done</Button>}>
      <p className="mb-3 text-sm text-muted">
        Send these privately. This is the only time the password is shown — they can change it after logging in.
      </p>
      <div className="space-y-3">
        {items.map((i) => (
          <div key={i.username} className="rounded-xl bg-surface-2 p-3">
            <p className="font-medium">{i.name}</p>
            <p className="text-sm text-muted">
              Username: <span className="font-mono text-fg">{i.username}</span>
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="font-mono text-base font-semibold tracking-wide">{i.password}</span>
              <CopyButton text={i.password} label="Password" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <CopyButton text={message} label="Copy full message" />
      </div>
    </Modal>
  )
}

function MembersSection() {
  const meta = useMeta()!
  const me = useAuth((s) => s.session!.memberId)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', username: '' })
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const [issued, setIssued] = useState<{ name: string; username: string; password: string }[] | null>(null)
  const [renaming, setRenaming] = useState<Member | null>(null)

  async function add() {
    setError(undefined)
    const username = normaliseUsername(form.username)
    if (!form.name.trim()) return setError('Enter a name')
    if (!/^[a-z0-9._-]{3,}$/.test(username)) return setError('Username: at least 3 letters, numbers, dots, dashes or underscores')
    if (meta.members.some((m) => m.username === username)) return setError('That username is already used')
    setBusy('add')
    try {
      if (await usernameTaken(username)) throw new Error('That username is already used')
      const member: Member = { id: uid('m'), name: form.name.trim(), username, active: true, createdAt: nowIso() }
      const password = await issuePassword(member.id, username)
      dispatchMeta({ type: 'upsertMember', member })
      setIssued([{ name: member.name, username, password }])
      setAdding(false)
      setForm({ name: '', username: '' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function resetPassword(m: Member) {
    if (!(await confirm(`Reset password for ${m.name}?`, 'Their current password stops working immediately.', { confirmLabel: 'Reset', danger: false }))) return
    setBusy(m.id)
    try {
      const password = await issuePassword(m.id, m.username)
      if (!m.active) dispatchMeta({ type: 'upsertMember', member: { ...m, active: true } })
      setIssued([{ name: m.name, username: m.username, password }])
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function deactivate(m: Member) {
    const ok = await confirm(
      `Deactivate ${m.name}?`,
      <>
        They can no longer log in and won't be added to new periods. Their past meals and expenses are kept. To fully lock someone out, also
        replace the GitHub token below.
      </>,
      { confirmLabel: 'Deactivate' },
    )
    if (!ok) return
    setBusy(m.id)
    try {
      await revokeLogin(m.username)
      dispatchMeta({ type: 'upsertMember', member: { ...m, active: false } })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section>
      <SectionTitle
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
        }
      >
        Members
      </SectionTitle>
      <Card className="divide-y divide-border">
        {meta.members.map((m) => (
          <div key={m.id} className={clsx('flex flex-wrap items-center gap-2 px-4 py-3', !m.active && 'opacity-60')}>
            <button className="min-w-0 flex-1 text-left" onClick={() => setRenaming(m)}>
              <p className="truncate font-medium">
                {m.name} {m.id === me && <span className="text-xs font-normal text-muted">(you)</span>}
              </p>
              <p className="text-xs text-muted">
                @{m.username}
                {!m.active && ' · inactive'}
              </p>
            </button>
            {m.id !== me && (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" loading={busy === m.id} onClick={() => resetPassword(m)}>
                  {m.active ? 'Reset password' : 'Reactivate'}
                </Button>
                {m.active && (
                  <Button size="sm" variant="ghost" onClick={() => deactivate(m)}>
                    Deactivate
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add member"
        footer={
          <Button className="flex-1" loading={busy === 'add'} onClick={add}>
            Add & generate password
          </Button>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <Field label="Name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahim" />
          </Field>
          <Field label="Username" hint="Used to log in. Lowercase letters, numbers, . _ -">
            <Input value={form.username} autoCapitalize="none" onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. rahim" />
          </Field>
          <ErrorText>{error}</ErrorText>
          <button type="submit" hidden />
        </form>
      </Modal>

      {renaming && (
        <RenameMember
          member={renaming}
          onClose={() => setRenaming(null)}
          onSave={(name) => {
            dispatchMeta({ type: 'upsertMember', member: { ...renaming, name } })
            setRenaming(null)
          }}
        />
      )}
      {issued && <Credentials items={issued} onClose={() => setIssued(null)} />}
    </section>
  )
}

function RenameMember({ member, onClose, onSave }: { member: Member; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(member.name)
  return (
    <Modal
      open
      onClose={onClose}
      title="Rename member"
      footer={
        <Button className="flex-1" disabled={!name.trim()} onClick={() => onSave(name.trim())}>
          Save
        </Button>
      }
    >
      <Field label="Display name" hint="The username cannot be changed.">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
    </Modal>
  )
}

function AccountSection() {
  const { session, logout } = useAuth()
  const meta = useMeta()!
  const me = meta.members.find((m) => m.id === session!.memberId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function save() {
    setError(undefined)
    if (form.next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    if (form.next !== form.confirm) return setError('Passwords do not match')
    setBusy(true)
    try {
      await changeOwnPassword(form.current, form.next)
      toast('Password changed')
      setOpen(false)
      setForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionTitle>Account</SectionTitle>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{(me?.name ?? '?')[0].toUpperCase()}</div>
          <div className="min-w-0">
            <p className="truncate font-medium">{me?.name}</p>
            <p className="truncate text-xs text-muted">@{session!.username}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <KeyRound className="h-4 w-4" /> Change password
          </Button>
          <Button variant="secondary" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change password"
        footer={
          <Button className="flex-1" loading={busy} onClick={save}>
            Change password
          </Button>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          </Field>
          <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
            <Input type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          </Field>
          <ErrorText>{error}</ErrorText>
          <button type="submit" hidden />
        </form>
      </Modal>
    </section>
  )
}

function BackupSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'export' | 'import' | null>(null)

  async function doExport() {
    setBusy('export')
    try {
      const data = await exportAll()
      downloadJson(`meal-expenses-backup-${today()}.json`, { app: 'meal-expenses', exportedAt: nowIso(), ...data })
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function doImport(file: File) {
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      const ok = await confirm(
        'Restore backup?',
        <>
          This replaces <b>all</b> current data with the backup from {new Date(backup.exportedAt).toLocaleString()} ({backup.meta.periods.length} periods). Logins are not
          changed. The previous data stays in the GitHub history.
        </>,
        { confirmLabel: 'Restore' },
      )
      if (!ok) return
      setBusy('import')
      await restoreAll(backup.meta, backup.periods)
      toast('Backup restored')
    } catch (e) {
      toast((e as Error).message)
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <section>
      <SectionTitle>Backup & restore</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted">Download everything as one JSON file, or restore from a previous download. Every change is also kept in the GitHub data repository's history.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === 'export'} onClick={doExport}>
            <Download className="h-4 w-4" /> Download backup
          </Button>
          <Button variant="secondary" loading={busy === 'import'} onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> Restore backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </div>
      </Card>
    </section>
  )
}

function TokenSection() {
  const meta = useMeta()!
  const me = useAuth((s) => s.session!.memberId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ token: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [issued, setIssued] = useState<{ name: string; username: string; password: string }[] | null>(null)

  async function save() {
    setError(undefined)
    setBusy(true)
    try {
      const others = meta.members.filter((m) => m.active && m.id !== me)
      const result = await replaceToken(form.token.trim(), form.password, others.map((m) => ({ memberId: m.id, username: m.username })))
      setOpen(false)
      setForm({ token: '', password: '' })
      if (result.length) setIssued(result.map((r) => ({ ...r, name: others.find((m) => m.username === r.username)?.name ?? r.username })))
      else toast('Token replaced')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionTitle>GitHub access</SectionTitle>
      <Card className="space-y-3 p-4">
        <p className="text-sm text-muted">
          Replace the GitHub token when it expires or to lock out a former member (revoke the old token on GitHub afterwards). Every other active member gets a new
          password.
        </p>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <RotateCcw className="h-4 w-4" /> Replace token
        </Button>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Replace GitHub token"
        footer={
          <Button className="flex-1" loading={busy} onClick={save} disabled={!form.token || !form.password}>
            Replace token
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="New token" hint="Needs Contents: Read and write on the app and data repositories.">
            <Input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="github_pat_…" />
          </Field>
          <Field label="Your current password" hint="You keep your password; everyone else gets a new one.">
            <Input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <ErrorText>{error}</ErrorText>
        </div>
      </Modal>
      {issued && <Credentials items={issued} onClose={() => setIssued(null)} />}
    </section>
  )
}

function BillDefaultsSection() {
  const meta = useMeta()!
  const saved: Bill = meta.billDefaults ?? { amounts: EMPTY_AMOUNTS, rooms: [] }
  const [draft, setDraft] = useState<Bill>(saved)
  const changed = JSON.stringify(draft) !== JSON.stringify(saved)
  return (
    <section>
      <SectionTitle>Monthly bill defaults</SectionTitle>
      <Card className="space-y-4 p-4">
        <p className="text-sm text-muted">Each period's Bill page starts with these amounts and rooms. You can still change them per period.</p>
        <AmountsForm value={saved.amounts} currency={meta.currency} onChange={(amounts) => setDraft((d) => ({ ...d, amounts }))} />
        <div>
          <p className="mb-2 text-sm font-medium">Rooms</p>
          <RoomsEditor rooms={draft.rooms} members={meta.members.filter((m) => m.active)} onChange={(rooms) => setDraft((d) => ({ ...d, rooms }))} />
        </div>
        {changed && (
          <Button
            onClick={() => {
              dispatchMeta({ type: 'updateSettings', settings: { billDefaults: { ...draft, rooms: draft.rooms.filter((r) => r.name.trim()) } } })
              toast('Bill defaults saved')
            }}
          >
            Save bill defaults
          </Button>
        )}
      </Card>
    </section>
  )
}

function AppearanceSection() {
  const pref = useTheme((s) => s.pref)
  const setPref = useTheme((s) => s.setPref)
  const options: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: 'System', icon: Monitor },
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ]
  return (
    <section>
      <SectionTitle>Appearance</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => setPref(o.value)}
              aria-pressed={pref === o.value}
              className={clsx(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium',
                pref === o.value ? 'bg-surface text-fg shadow-sm' : 'text-muted',
              )}
            >
              <o.icon className="h-4 w-4" />
              {o.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Saved on this device. “System” follows your phone or computer setting.</p>
      </Card>
    </section>
  )
}

export default function SettingsPage() {
  const meta = useMeta()!
  const [currency, setCurrency] = useState(meta.currency)

  return (
    <div className="space-y-6">
      <AccountSection />
      <AppearanceSection />
      <MembersSection />

      <section>
        <SectionTitle>Default meal ratio</SectionTitle>
        <Card className="p-4">
          <RatioEditor
            key={JSON.stringify(meta.defaultRatio)}
            value={meta.defaultRatio}
            onSave={(defaultRatio) => {
              dispatchMeta({ type: 'updateSettings', settings: { defaultRatio } })
              toast('Default ratio saved')
            }}
          />
          <p className="mt-3 text-xs text-muted">New periods copy this ratio. Change an existing period's ratio from its own settings.</p>
        </Card>
      </section>

      <BillDefaultsSection key={JSON.stringify(meta.billDefaults ?? null)} />

      <section>
        <SectionTitle>Categories</SectionTitle>
        <Card className="p-4">
          <ListEditor items={meta.categories} placeholder="New category" onChange={(categories) => dispatchMeta({ type: 'updateSettings', settings: { categories } })} />
        </Card>
      </section>

      <section>
        <SectionTitle>Units</SectionTitle>
        <Card className="p-4">
          <ListEditor items={meta.units} placeholder="New unit (e.g. kg)" onChange={(units) => dispatchMeta({ type: 'updateSettings', settings: { units } })} />
        </Card>
      </section>

      <section>
        <SectionTitle>Currency</SectionTitle>
        <Card className="flex gap-2 p-4">
          <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="max-w-32" />
          {currency.trim() && currency !== meta.currency && (
            <Button onClick={() => dispatchMeta({ type: 'updateSettings', settings: { currency: currency.trim() } })}>Save</Button>
          )}
        </Card>
      </section>

      <BackupSection />
      <TokenSection />
    </div>
  )
}

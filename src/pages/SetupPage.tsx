import { KeyRound, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, ErrorText, Field, Input } from '../components/ui'
import { MIN_PASSWORD_LENGTH } from '../lib/crypto'
import { useAuth } from '../store/auth'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-lg">
            <UtensilsCrossed className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <Card className="p-5">{children}</Card>
      </div>
    </div>
  )
}

export function MissingRepoConfig() {
  return (
    <AuthShell title="Meal Expenses" subtitle="Configuration needed">
      <p className="text-sm text-muted">
        The app could not detect its GitHub repository. On GitHub Pages this is automatic. For local development, create
        <code className="mx-1 rounded bg-surface-2 px-1">.env.local</code>with:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">{`VITE_GH_OWNER=your-github-username\nVITE_GH_APP_REPO=meal_expenses`}</pre>
    </AuthShell>
  )
}

export default function SetupPage() {
  const { appRepo, setup } = useAuth()
  const [form, setForm] = useState({ dataRepo: `${appRepo!.owner}/meal-data`, token: '', name: '', username: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(undefined)
    if (!/^[a-z0-9._-]{3,}$/i.test(form.username.trim())) return setError('Username: at least 3 letters, numbers, dots, dashes or underscores')
    if (form.password.length < MIN_PASSWORD_LENGTH) return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    if (form.password !== form.confirm) return setError('Passwords do not match')
    setBusy(true)
    try {
      await setup({ dataRepo: form.dataRepo, token: form.token.trim(), name: form.name, username: form.username, password: form.password })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Set up Meal Expenses" subtitle="One-time setup. Afterwards everyone logs in with a username and password.">
      <ol className="mb-5 space-y-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
        <li>
          1. Create a <b>private</b> GitHub repository for the data (e.g. <code>meal-data</code>). It can be empty.
        </li>
        <li>
          2. Create a{' '}
          <a className="text-primary underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
            fine-grained token
          </a>{' '}
          with access to <b>{appRepo!.repo}</b> and the data repo, permission <b>Contents: Read and write</b>.
        </li>
        <li>3. Fill in the form below.</li>
      </ol>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Data repository" hint="owner/repo of the private data repository">
          <Input value={form.dataRepo} onChange={set('dataRepo')} required />
        </Field>
        <Field label="GitHub token" hint="Stored only in encrypted form; nobody needs to type it again.">
          <Input value={form.token} onChange={set('token')} type="password" autoComplete="off" placeholder="github_pat_…" required />
        </Field>
        <hr className="border-border" />
        <Field label="Your name">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Asibul" required />
        </Field>
        <Field label="Username">
          <Input value={form.username} onChange={set('username')} autoCapitalize="none" autoComplete="username" required />
        </Field>
        <Field label="Password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          <Input value={form.password} onChange={set('password')} type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Confirm password">
          <Input value={form.confirm} onChange={set('confirm')} type="password" autoComplete="new-password" required />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" loading={busy}>
          <KeyRound className="h-4 w-4" />
          Finish setup
        </Button>
      </form>
    </AuthShell>
  )
}

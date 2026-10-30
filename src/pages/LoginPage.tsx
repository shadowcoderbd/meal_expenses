import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorText, Field, Input } from '../components/ui'
import { useAuth } from '../store/auth'
import { AuthShell } from './SetupPage'

export default function LoginPage() {
  const login = useAuth((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await login(username, password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Meal Expenses" subtitle="Log in to your household">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" autoFocus required />
        </Field>
        <Field label="Password">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" required />
        </Field>
        <ErrorText>{error}</ErrorText>
        <Button type="submit" className="w-full" loading={busy}>
          <LogIn className="h-4 w-4" />
          Log in
        </Button>
        <p className="text-center text-xs text-muted">Don't have a password? Ask a household member to add you.</p>
      </form>
    </AuthShell>
  )
}

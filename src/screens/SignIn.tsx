import { useState, type FormEvent } from 'react'
import { TacoLogo } from '../components/TacoLogo'
import { signInWithPassword } from '../auth/authStore'
import { supabaseConfigured } from '../lib/supabase'

export function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabaseConfigured) {
      setError('Supabase is not configured. Check .env.local (VITE_ keys).')
      return
    }
    setBusy(true)
    const result = await signInWithPassword(email.trim(), password)
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="chooser">
      <TacoLogo />
      <h1>Taco</h1>
      <p>Sign in to pack together</p>
      <form className="sign-in" autoComplete="on" onSubmit={(e) => void onSubmit(e)}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            className="in"
            id="email"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            className="in"
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="sign-in-error">{error}</p> : null}
        <button
          type="submit"
          className="btn btn-primary btn-wide"
          disabled={busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="note">Accounts are created by Breanna — there’s no sign-up here.</p>
    </div>
  )
}

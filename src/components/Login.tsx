import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui'
import { Wordmark } from './Wordmark'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'reset'>('signin')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
        if (error) throw error
        setMsg({ tone: 'ok', text: 'Check your email for a reset link.' })
      }
    } catch (err) {
      setMsg({ tone: 'error', text: err instanceof Error ? err.message : 'Sign-in failed.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth">
      <div className="auth-card">
        <Wordmark large />
        <p className="muted">Waivers, contracts, offerings, scripts and homework for the barn.</p>
        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {mode === 'signin' && (
            <>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          {msg && <p className={msg.tone === 'error' ? 'field-error' : 'field-ok'}>{msg.text}</p>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}</Button>
          <button type="button" className="link-btn center" onClick={() => { setMode(mode === 'signin' ? 'reset' : 'signin'); setMsg(null) }}>
            {mode === 'signin' ? 'Forgot your password?' : 'Back to sign in'}
          </button>
        </form>
        <p className="muted small center">Staff accounts are created by the barn owner.</p>
      </div>
    </main>
  )
}

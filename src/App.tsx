import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { isConfigured, supabase } from './lib/supabase'
import { MODULES } from './lib/modules'
import { StoreProvider } from './lib/store'
import { Shell } from './components/Shell'
import { Login } from './components/Login'
import { Setup } from './components/Setup'
import { Dashboard } from './components/Dashboard'
import { RecordsModule } from './components/RecordsModule'
import { SignPage } from './components/SignPage'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <Setup />

  return (
    <BrowserRouter>
      <Routes>
        {/* Public: customers sign here without an account. */}
        <Route path="/sign/:token" element={<SignPage />} />
        {/* Everything else requires a staff login. */}
        <Route path="/*" element={<StaffApp session={session} />} />
      </Routes>
    </BrowserRouter>
  )
}

function StaffApp({ session }: { session: Session | null | undefined }) {
  if (session === undefined) return <main className="auth"><p className="muted">Loading…</p></main>
  if (!session) return <Login />
  return (
    <StoreProvider>
      <Routes>
        <Route element={<Shell session={session} />}>
          <Route index element={<Dashboard />} />
          {MODULES.map((m) => <Route key={m.key} path={m.key} element={<RecordsModule mod={m} />} />)}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </StoreProvider>
  )
}

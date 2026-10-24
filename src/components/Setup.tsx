import { Wordmark } from './Wordmark'

/** Shown when the Supabase environment variables are missing. */
export function Setup() {
  return (
    <main className="auth">
      <div className="auth-card setup">
        <Wordmark large />
        <h2>Almost there</h2>
        <p>This build has no Supabase connection. Add two environment variables and redeploy:</p>
        <pre className="mono">VITE_SUPABASE_URL=https://&lt;project-ref&gt;.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=&lt;anon public key&gt;</pre>
        <p className="muted small">Locally: put them in <code>.env.local</code>. On Netlify: Site configuration → Environment variables, then trigger a deploy. Full steps are in the README.</p>
      </div>
    </main>
  )
}

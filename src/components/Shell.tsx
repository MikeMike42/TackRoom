import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { MODULES } from '../lib/modules'
import { supabase } from '../lib/supabase'
import { useStore } from '../lib/store'
import { Icon } from './ui'
import { Wordmark } from './Wordmark'

type Theme = 'system' | 'light' | 'dark'

export function Shell({ session }: { session: Session }) {
  const { error, profiles } = useStore()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('theme') as Theme) || 'system' } catch { return 'system' }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* ignore */ }
  }, [theme])

  const me = profiles[session.user.id]
  const name = me?.full_name || session.user.email?.split('@')[0] || 'you'
  const cycle = () => setTheme(theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system')

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a className="skip" href="#main">Skip to content</a>
      <aside className="nav">
        <div className="nav-top">
          <Wordmark />
          <button className="icon-btn nav-close" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
        </div>
        <nav onClick={() => setOpen(false)}>
          <NavLink to="/" end><Icon name="home" /> Overview</NavLink>
          <span className="nav-group">Documents</span>
          {MODULES.filter((m) => ['waivers', 'contracts'].includes(m.key)).map((m) => <NavLink key={m.key} to={`/${m.key}`}><Icon name={m.icon} /> {m.label}</NavLink>)}
          <span className="nav-group">Library</span>
          {MODULES.filter((m) => ['offerings', 'scripts', 'homework'].includes(m.key)).map((m) => <NavLink key={m.key} to={`/${m.key}`}><Icon name={m.icon} /> {m.label}</NavLink>)}
          <span className="nav-group">Barn</span>
          {MODULES.filter((m) => ['clients', 'horses'].includes(m.key)).map((m) => <NavLink key={m.key} to={`/${m.key}`}><Icon name={m.icon} /> {m.label}</NavLink>)}
        </nav>
        <div className="nav-bottom">
          <div className="me">
            <span className="avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
            <span className="me-name">{name}</span>
          </div>
          <button className="icon-btn" onClick={cycle} title={`Theme: ${theme}`} aria-label="Switch theme"><Icon name={theme === 'dark' ? 'moon' : 'sun'} /></button>
          <button className="icon-btn" onClick={() => supabase.auth.signOut()} title="Sign out" aria-label="Sign out"><Icon name="logout" /></button>
        </div>
      </aside>
      <div className="nav-scrim" onClick={() => setOpen(false)} />
      <div className="content">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <Wordmark />
        </header>
        {error && <div className="banner-error">Couldn't load data: {error}</div>}
        <main id="main"><Outlet /></main>
      </div>
    </div>
  )
}

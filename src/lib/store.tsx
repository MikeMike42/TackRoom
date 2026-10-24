import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { MODULES, moduleByKey, type ModuleKey, type Row } from './modules'
import { listRows, listProfiles, type Profile } from './api'
import { supabase } from './supabase'

type Tables = Record<ModuleKey, Row[] | undefined>

type Store = {
  tables: Tables
  profiles: Record<string, Profile>
  loading: boolean
  error: string | null
  reload: (key?: ModuleKey) => Promise<void>
  /** Display label for a referenced row, e.g. a client's name. */
  labelFor: (key: ModuleKey, id: unknown) => string
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tables, setTables] = useState<Tables>({} as Tables)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const reload = useCallback(async (key?: ModuleKey) => {
    const mods = key ? [moduleByKey(key)!] : MODULES
    try {
      const results = await Promise.all(mods.map((m) => listRows(m)))
      if (!mounted.current) return
      setTables((t) => {
        const next = { ...t }
        mods.forEach((m, i) => { next[m.key] = results[i] })
        return next
      })
      setError(null)
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    ;(async () => {
      await Promise.all([
        reload(),
        listProfiles().then((ps) => {
          if (mounted.current) setProfiles(Object.fromEntries(ps.map((p) => [p.id, p])))
        }),
      ])
      if (mounted.current) setLoading(false)
    })()

    // Live updates: when a teammate changes a table, refetch just that table.
    const channel = supabase
      .channel('tack-room-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const mod = MODULES.find((m) => m.table === payload.table)
        if (mod) void reload(mod.key)
      })
      .subscribe()

    return () => {
      mounted.current = false
      void supabase.removeChannel(channel)
    }
  }, [reload])

  const labelFor = useCallback(
    (key: ModuleKey, id: unknown) => {
      if (!id) return ''
      const mod = moduleByKey(key)!
      const row = tables[key]?.find((r) => r.id === id)
      return row ? String(row[mod.titleKey] ?? '') : '…'
    },
    [tables],
  )

  const value = useMemo(
    () => ({ tables, profiles, loading, error, reload, labelFor }),
    [tables, profiles, loading, error, reload, labelFor],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}

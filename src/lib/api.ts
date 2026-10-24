import { supabase, DOCUMENTS_BUCKET } from './supabase'
import type { Module, Row } from './modules'

export async function listRows(mod: Module): Promise<Row[]> {
  const { data, error } = await supabase
    .from(mod.table)
    .select('*')
    .order(mod.orderBy.column, { ascending: mod.orderBy.ascending })
  if (error) throw error
  return (data ?? []) as Row[]
}

export async function saveRow(mod: Module, values: Record<string, unknown>, id?: string): Promise<Row> {
  const payload = sanitize(mod, values)
  const q = id
    ? supabase.from(mod.table).update(payload).eq('id', id)
    : supabase.from(mod.table).insert(payload)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data as Row
}

export async function deleteRow(mod: Module, row: Row): Promise<void> {
  const { error } = await supabase.from(mod.table).delete().eq('id', row.id)
  if (error) throw error
  const path = typeof row.file_path === 'string' ? row.file_path : null
  if (path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]).catch(() => undefined)
}

/** Drop audit columns and coerce empty strings to null so Postgres is happy. */
function sanitize(mod: Module, values: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const f of mod.fields) {
    let v = values[f.key]
    if (v === '' || v === undefined) v = null
    if ((f.type === 'number' || f.type === 'money') && v !== null) v = Number(v)
    if (f.type === 'tags' && v === null) v = []
    out[f.key] = v
  }
  return out
}

export async function uploadDocument(moduleKey: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${moduleKey}/${crypto.randomUUID()}-${safeName}`
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/pdf',
  })
  if (error) throw error
  return path
}

export async function documentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 60 * 10)
  if (error) throw error
  return data.signedUrl
}

export async function removeDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([path])
  if (error) throw error
}

export type Profile = { id: string; full_name: string | null; role: string }

export async function listProfiles(): Promise<Profile[]> {
  const { data } = await supabase.from('profiles').select('id, full_name, role')
  return (data ?? []) as Profile[]
}

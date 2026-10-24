import { useEffect, useRef, useState } from 'react'
import type { Field, ModuleKey } from '../lib/modules'
import { useStore } from '../lib/store'
import { documentUrl, removeDocument, uploadDocument } from '../lib/api'
import { Button, Icon } from './ui'
import { Markdown } from './Markdown'

type Props = {
  field: Field
  value: unknown
  onChange: (v: unknown) => void
  moduleKey: ModuleKey
}

export function FieldEditor({ field, value, onChange, moduleKey }: Props) {
  const id = `f-${field.key}`
  const common = { id, name: field.key, required: field.required }

  switch (field.type) {
    case 'text':
      return <input {...common} type="text" value={str(value)} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />
    case 'number':
      return <input {...common} type="number" inputMode="decimal" step="any" value={str(value)} onChange={(e) => onChange(e.target.value)} />
    case 'money':
      return (
        <div className="input-prefix">
          <span>$</span>
          <input {...common} type="number" inputMode="decimal" step="0.01" min="0" value={str(value)} onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    case 'date':
      return <input {...common} type="date" value={str(value)} onChange={(e) => onChange(e.target.value)} />
    case 'boolean':
      return (
        <label className="switch">
          <input id={id} type="checkbox" checked={Boolean(value ?? true)} onChange={(e) => onChange(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          <span>{value === false ? 'No' : 'Yes'}</span>
        </label>
      )
    case 'select':
      return (
        <select {...common} value={str(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">{field.required ? 'Choose…' : '—'}</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case 'ref':
      return <RefSelect field={field} value={value} onChange={onChange} />
    case 'textarea':
      return <AutoTextarea {...common} value={str(value)} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} minRows={field.key === 'body' ? 10 : 3} />
    case 'markdown':
      return <MarkdownEditor id={id} value={str(value)} placeholder={field.placeholder} onChange={onChange} />
    case 'tags':
      return <TagsInput id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} placeholder={field.placeholder} />
    case 'file':
      return <FileField id={id} value={typeof value === 'string' ? value : null} onChange={onChange} moduleKey={moduleKey} />
  }
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function RefSelect({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const { tables } = useStore()
  const target = field.ref!
  const rows = tables[target] ?? []
  const titleKey = target === 'clients' ? 'full_name' : 'name'
  return (
    <select id={`f-${field.key}`} value={str(value)} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {rows.map((r) => <option key={r.id} value={r.id}>{String(r[titleKey] ?? '')}</option>)}
    </select>
  )
}

function AutoTextarea({ minRows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, minRows * 24 + 20) + 'px'
  }, [props.value, minRows])
  return <textarea ref={ref} rows={minRows} {...props} />
}

function MarkdownEditor({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: unknown) => void; placeholder?: string }) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  return (
    <div className="md-editor">
      <div className="md-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>Write</button>
        <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>Preview</button>
      </div>
      {tab === 'write'
        ? <AutoTextarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} minRows={10} className="mono" />
        : <div className="md-preview"><Markdown source={value || '_Nothing written yet._'} /></div>}
    </div>
  )
}

function TagsInput({ id, value, onChange, placeholder }: { id: string; value: string[]; onChange: (v: unknown) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])))
    setDraft('')
  }
  return (
    <div className="tags-input">
      {value.map((t) => (
        <span key={t} className="tag">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}><Icon name="x" size={12} /></button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
        }}
      />
    </div>
  )
}

function FileField({ id, value, onChange, moduleKey }: { id: string; value: string | null; onChange: (v: unknown) => void; moduleKey: ModuleKey }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 25 * 1024 * 1024) { setErr('That file is over 25 MB.'); return }
    setBusy(true); setErr(null)
    try {
      const path = await uploadDocument(moduleKey, file)
      if (value) await removeDocument(value).catch(() => undefined)
      onChange(path)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  const open = async () => {
    if (!value) return
    try { window.open(await documentUrl(value), '_blank', 'noopener') } catch { setErr('Could not open the file.') }
  }

  const remove = async () => {
    if (!value) return
    setBusy(true)
    try { await removeDocument(value); onChange(null) } catch (e) { setErr(e instanceof Error ? e.message : 'Could not remove the file.') } finally { setBusy(false) }
  }

  const name = value ? value.split('/').pop()!.replace(/^[0-9a-f-]{36}-/, '') : null

  return (
    <div
      className={`file-field ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); void handle(e.dataTransfer.files[0]) }}
    >
      <input ref={inputRef} id={id} type="file" accept="application/pdf,image/*" hidden onChange={(e) => void handle(e.target.files?.[0])} />
      {value ? (
        <div className="file-row">
          <Icon name="file-signature" />
          <span className="file-name" title={name ?? ''}>{name}</span>
          <div className="file-actions">
            <Button type="button" icon="external" onClick={open} disabled={busy}>Open</Button>
            <Button type="button" icon="upload" onClick={() => inputRef.current?.click()} disabled={busy}>Replace</Button>
            <Button type="button" variant="danger" icon="trash" onClick={remove} disabled={busy}>Remove</Button>
          </div>
        </div>
      ) : (
        <button type="button" className="file-drop" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={20} />
          <span>{busy ? 'Uploading…' : 'Drop the signed PDF here, or click to choose'}</span>
          <small>PDF or image, up to 25 MB</small>
        </button>
      )}
      {err && <p className="field-error">{err}</p>}
    </div>
  )
}

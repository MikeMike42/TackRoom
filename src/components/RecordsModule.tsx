import { useMemo, useState } from 'react'
import type { Field, Module, Row } from '../lib/modules'
import { useStore } from '../lib/store'
import { documentUrl } from '../lib/api'
import { Button, Empty, Icon, Modal, OptionPill, Pill, daysUntil, fmtDate, fmtMoney } from './ui'
import { RecordForm } from './RecordForm'
import { Markdown } from './Markdown'

export function RecordsModule({ mod }: { mod: Module }) {
  const { tables, loading, labelFor } = useStore()
  const rows = tables[mod.key] ?? []
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Row | null | 'new'>(null)
  const [preview, setPreview] = useState<Row | null>(null)

  const filterFields = (mod.filters ?? []).map((k) => mod.fields.find((f) => f.key === k)!).filter(Boolean)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      for (const [k, v] of Object.entries(filters)) if (v && String(r[k] ?? '') !== v) return false
      if (!needle) return true
      const hay = mod.fields
        .map((f) => (f.type === 'ref' ? labelFor(f.ref!, r[f.key]) : f.type === 'tags' ? (r[f.key] as string[] | null)?.join(' ') : r[f.key]))
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, q, filters, mod, labelFor])

  const cell = (f: Field, r: Row) => {
    const v = r[f.key]
    switch (f.type) {
      case 'select': return <OptionPill options={f.options} value={v} />
      case 'ref': return labelFor(f.ref!, v) || <span className="muted">—</span>
      case 'date': {
        const d = daysUntil(v)
        const text = fmtDate(v)
        if (f.key === mod.expiryKey && d !== null && d <= 30) {
          return <span className={d < 0 ? 'date-bad' : 'date-warn'}>{text}{d < 0 ? ' · expired' : d === 0 ? ' · today' : ` · ${d}d`}</span>
        }
        return text || <span className="muted">—</span>
      }
      case 'money': return <span className="num">{fmtMoney(v)}</span>
      case 'number': return <span className="num">{v === null || v === undefined ? '' : String(v)}</span>
      case 'boolean': return v === false ? <Pill tone="neutral">No</Pill> : <Pill tone="good">Yes</Pill>
      default: return v ? String(v) : <span className="muted">—</span>
    }
  }

  const listFields = mod.fields.filter((f) => f.list)
  const hasFile = mod.fields.some((f) => f.type === 'file')

  return (
    <section className="module">
      <header className="module-head">
        <div>
          <h1>{mod.label}</h1>
          <p className="blurb">{mod.blurb}</p>
        </div>
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>New {mod.singular.toLowerCase()}</Button>
      </header>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" placeholder={`Search ${mod.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {filterFields.map((f) => (
          <select key={f.key} value={filters[f.key] ?? ''} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))} aria-label={f.label}>
            <option value="">All {f.label.toLowerCase()}s</option>
            {f.type === 'ref'
              ? (tables[f.ref!] ?? []).map((r) => <option key={r.id} value={r.id}>{labelFor(f.ref!, r.id)}</option>)
              : f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        <span className="count">{filtered.length} of {rows.length}</span>
      </div>

      {loading && rows.length === 0 ? (
        <p className="muted">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty icon={mod.icon} title={`No ${mod.label.toLowerCase()} yet`} body={mod.blurb} action={<Button variant="primary" icon="plus" onClick={() => setEditing('new')}>Add the first {mod.singular.toLowerCase()}</Button>} />
      ) : filtered.length === 0 ? (
        <Empty icon="search" title="Nothing matches" body="Try a different search or clear the filters." action={<Button onClick={() => { setQ(''); setFilters({}) }}>Clear</Button>} />
      ) : mod.view === 'table' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {listFields.map((f) => <th key={f.key} className={f.type === 'money' || f.type === 'number' ? 'num' : ''}>{f.label}</th>)}
                {hasFile && <th>File</th>}
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(r) }}>
                  {listFields.map((f, i) => <td key={f.key} className={`${i === 0 ? 'title-cell' : ''} ${f.type === 'money' || f.type === 'number' ? 'num' : ''}`}>{cell(f, r)}</td>)}
                  {hasFile && <td><FileLink path={r.file_path} /></td>}
                  <td className="row-actions"><Icon name="chevron" size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="cards">
          {filtered.map((r) => <Card key={r.id} mod={mod} row={r} onEdit={() => setEditing(r)} onPreview={() => setPreview(r)} />)}
        </div>
      )}

      {editing && <RecordForm mod={mod} row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {preview && (
        <Modal title={String(preview[mod.titleKey])} onClose={() => setPreview(null)} wide
          footer={<><span className="spacer" /><Button icon="edit" onClick={() => { setEditing(preview); setPreview(null) }}>Edit</Button></>}>
          <div className="preview-meta">
            {mod.statusKey && <OptionPill options={mod.fields.find((f) => f.key === mod.statusKey)?.options} value={preview[mod.statusKey]} />}
            {typeof preview.offering_id === 'string' && preview.offering_id && <span className="muted">{labelFor('offerings', preview.offering_id)}</span>}
            {typeof preview.estimated_minutes === 'number' && <span className="muted">~{preview.estimated_minutes} min</span>}
          </div>
          <Markdown source={String(preview.body ?? preview.description ?? '')} />
          {typeof preview.file_path === 'string' && preview.file_path && <p><FileLink path={preview.file_path} label="Open attached PDF" /></p>}
        </Modal>
      )}
    </section>
  )
}

function FileLink({ path, label = 'Open PDF' }: { path: unknown; label?: string }) {
  if (typeof path !== 'string' || !path) return <span className="muted">—</span>
  return (
    <button
      type="button"
      className="link-btn"
      onClick={async (e) => {
        e.stopPropagation()
        try { window.open(await documentUrl(path), '_blank', 'noopener') } catch { /* surfaced via UI elsewhere */ }
      }}
    >
      <Icon name="external" size={14} /> {label}
    </button>
  )
}

function Card({ mod, row, onEdit, onPreview }: { mod: Module; row: Row; onEdit: () => void; onPreview: () => void }) {
  const { labelFor } = useStore()
  const statusField = mod.fields.find((f) => f.key === mod.statusKey)
  const [copied, setCopied] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = [row.subject ? `Subject: ${row.subject}` : null, row.body].filter(Boolean).join('\n\n')
    try { await navigator.clipboard.writeText(String(text)); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* clipboard blocked */ }
  }

  if (mod.key === 'scripts') {
    const body = String(row.body ?? '')
    return (
      <article className="card script-card" onClick={onEdit}>
        <header>
          <OptionPill options={statusField?.options} value={row[mod.statusKey!]} />
          {typeof row.purpose === 'string' && row.purpose && <span className="muted small">{row.purpose}</span>}
        </header>
        <h3>{String(row.title)}</h3>
        {typeof row.subject === 'string' && row.subject && <p className="subject">{row.subject}</p>}
        <pre className="script-body">{highlight(body)}</pre>
        <footer>
          <div className="tags-row">{(row.tags as string[] | null)?.map((t) => <span key={t} className="tag">{t}</span>)}</div>
          <Button icon={copied ? 'check' : 'copy'} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        </footer>
      </article>
    )
  }

  if (mod.key === 'homework') {
    return (
      <article className="card" onClick={onPreview}>
        <header>
          <OptionPill options={statusField?.options} value={row[mod.statusKey!]} />
          {typeof row.offering_id === 'string' && row.offering_id && <span className="muted small">{labelFor('offerings', row.offering_id)}</span>}
        </header>
        <h3>{String(row.title)}</h3>
        <p className="excerpt">{excerpt(String(row.body ?? ''))}</p>
        <footer>
          <span className="muted small">
            {typeof row.level === 'string' && row.level ? cap(row.level) : ''}
            {typeof row.estimated_minutes === 'number' ? ` · ~${row.estimated_minutes} min` : ''}
            {typeof row.file_path === 'string' && row.file_path ? ' · PDF attached' : ''}
          </span>
          <Button icon="edit" onClick={(e) => { e.stopPropagation(); onEdit() }}>Edit</Button>
        </footer>
      </article>
    )
  }

  // offerings
  return (
    <article className={`card offering-card ${row.active === false ? 'inactive' : ''}`} onClick={onEdit}>
      <header>
        <OptionPill options={statusField?.options} value={row[mod.statusKey!]} />
        {row.active === false && <Pill tone="neutral">Not offered</Pill>}
      </header>
      <h3>{String(row.name)}</h3>
      <div className="offering-facts">
        {row.price !== null && row.price !== undefined && <strong className="price">{fmtMoney(row.price)}</strong>}
        <span className="muted small">
          {[
            typeof row.level === 'string' && row.level ? cap(row.level) : null,
            typeof row.lessons_included === 'number' ? `${row.lessons_included} lessons` : null,
            typeof row.duration_minutes === 'number' ? `${row.duration_minutes} min` : null,
            typeof row.validity_days === 'number' ? `use within ${row.validity_days}d` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>
      <p className="excerpt">{excerpt(String(row.description ?? ''))}</p>
    </article>
  )
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
const excerpt = (s: string, n = 180) => {
  const t = s.replace(/[#*_>`\-\[\]]+/g, ' ').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n).trimEnd() + '…' : t
}

/** Render {{placeholders}} in a script body with emphasis. */
function highlight(body: string) {
  const parts = body.split(/(\{\{[^}]+\}\})/g)
  return parts.map((p, i) => (/^\{\{[^}]+\}\}$/.test(p) ? <mark key={i}>{p}</mark> : <span key={i}>{p}</span>))
}

import { useState } from 'react'
import type { Module, Row } from '../lib/modules'
import { saveRow, deleteRow } from '../lib/api'
import { useStore } from '../lib/store'
import { FieldEditor } from './fields'
import { Button, Modal } from './ui'

type Props = { mod: Module; row: Row | null; onClose: () => void }

export function RecordForm({ mod, row, onClose }: Props) {
  const { reload } = useStore()
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const v: Record<string, unknown> = {}
    for (const f of mod.fields) {
      v[f.key] = row ? row[f.key] : f.type === 'boolean' ? true : f.type === 'tags' ? [] : f.type === 'select' && f.required ? f.options?.[0]?.value ?? '' : ''
    }
    return v
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const visible = mod.fields.filter((f) => !f.showWhen || f.showWhen.in.includes(String(values[f.showWhen.field] ?? '')))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await saveRow(mod, values, row?.id)
      await reload(mod.key)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row) return
    setSaving(true)
    try {
      await deleteRow(mod, row)
      await reload(mod.key)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
      setSaving(false)
    }
  }

  return (
    <Modal title={row ? `Edit ${mod.singular.toLowerCase()}` : `New ${mod.singular.toLowerCase()}`} onClose={onClose} wide
      footer={
        <>
          {row && !confirmDelete && <Button type="button" variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete</Button>}
          {row && confirmDelete && (
            <span className="confirm-row">
              <span>Delete this {mod.singular.toLowerCase()} for good?</span>
              <Button type="button" variant="danger" onClick={remove} disabled={saving}>Yes, delete</Button>
              <Button type="button" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            </span>
          )}
          <span className="spacer" />
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="record-form" variant="primary" disabled={saving}>{saving ? 'Saving…' : row ? 'Save changes' : `Add ${mod.singular.toLowerCase()}`}</Button>
        </>
      }
    >
      <form id="record-form" className="form-grid" onSubmit={submit}>
        {visible.map((f) => (
          <div key={f.key} className={`form-field ${f.wide ? 'wide' : ''}`}>
            <label htmlFor={`f-${f.key}`}>{f.label}{f.required && <span className="req" aria-hidden="true"> *</span>}</label>
            <FieldEditor field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} moduleKey={mod.key} />
            {f.help && <small className="help">{f.help}</small>}
          </div>
        ))}
        {error && <p className="field-error wide">{error}</p>}
      </form>
    </Modal>
  )
}

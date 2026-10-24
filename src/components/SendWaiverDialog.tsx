import { useState } from 'react'
import type { Row } from '../lib/modules'
import { useStore } from '../lib/store'
import { sendWaiver } from '../lib/signing'
import { Button, Modal } from './ui'

export function SendWaiverDialog({ waiver, onClose }: { waiver: Row; onClose: () => void }) {
  const { tables, labelFor, reload } = useStore()
  const client = tables.clients?.find((c) => c.id === waiver.client_id)
  const [email, setEmail] = useState(String(waiver.signer_email ?? client?.email ?? ''))
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sentLink, setSentLink] = useState<string | null>(null)

  const templateName = labelFor('waiver_templates', waiver.template_id)
  const resend = Boolean(waiver.sent_at)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const res = await sendWaiver(waiver.id, email.trim(), message.trim())
      await reload('waivers')
      setSentLink(res.link)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not send.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={resend ? 'Resend for signature' : 'Send for signature'} onClose={onClose}
      footer={sentLink ? <><span className="spacer" /><Button variant="primary" onClick={onClose}>Done</Button></> : (
        <>
          <span className="spacer" />
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="send-form" variant="primary" disabled={busy || !waiver.template_id}>{busy ? 'Sending…' : 'Send email'}</Button>
        </>
      )}
    >
      {sentLink ? (
        <div className="sent-ok">
          <p><strong>Sent to {email}.</strong> The link is good for 14 days; the waiver will flip to <em>Signed</em> here the moment they finish.</p>
          <p className="muted small">If the email doesn't arrive, you can also share the link directly:</p>
          <code className="link-box">{sentLink}</code>
          <Button icon="copy" onClick={() => navigator.clipboard.writeText(sentLink).catch(() => undefined)}>Copy link</Button>
        </div>
      ) : (
        <form id="send-form" className="form-grid" onSubmit={send}>
          <div className="form-field wide">
            <label>Document</label>
            <div className="readonly">{String(waiver.title)}{templateName ? <span className="muted"> · {templateName}</span> : <span className="date-bad"> · no template chosen</span>}</div>
            {!waiver.template_id && <small className="help">Edit the waiver and pick a template first; the template holds the text they'll sign.</small>}
          </div>
          <div className="form-field wide">
            <label htmlFor="send-email">Send to</label>
            <input id="send-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rider@example.com" />
            {client && !client.email && <small className="help">This rider has no email on file; it will be saved on the waiver.</small>}
          </div>
          <div className="form-field wide">
            <label htmlFor="send-msg">Personal note <span className="muted">(optional)</span></label>
            <textarea id="send-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Looking forward to seeing you Saturday!" />
          </div>
          {resend && <p className="help wide">Resending creates a new link and invalidates the old one.</p>}
          {err && <p className="field-error wide">{err}</p>}
        </form>
      )}
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CONSENT_TEXT, getWaiverForSigning, submitSignature, uploadSignature, type SigningView } from '../lib/signing'
import { Markdown } from './Markdown'
import { SignaturePad } from './SignaturePad'
import { Button, Icon } from './ui'
import { Wordmark } from './Wordmark'

type State = 'loading' | 'ready' | 'invalid' | 'expired' | 'already' | 'submitting' | 'done'

export function SignPage() {
  const { token = '' } = useParams()
  const [view, setView] = useState<SigningView | null>(null)
  const [state, setState] = useState<State>('loading')
  const [err, setErr] = useState<string | null>(null)

  const [signerName, setSignerName] = useState('')
  const [isMinor, setIsMinor] = useState(false)
  const [guardianName, setGuardianName] = useState('')
  const [sig, setSig] = useState<string | null>(null)
  const [guardianSig, setGuardianSig] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [readToEnd, setReadToEnd] = useState(false)

  useEffect(() => {
    document.documentElement.removeAttribute('data-theme')
    getWaiverForSigning(token)
      .then((v) => {
        if (!v) return setState('invalid')
        setView(v)
        setSignerName(v.rider_name ?? '')
        setState(v.signed ? 'already' : v.expired ? 'expired' : 'ready')
      })
      .catch(() => setState('invalid'))
  }, [token])

  const needsGuardian = isMinor && (view?.requires_guardian_for_minors ?? true)
  const canSubmit = signerName.trim() && sig && consent && (!needsGuardian || (guardianName.trim() && guardianSig))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !sig) return
    setState('submitting'); setErr(null)
    try {
      const sigPath = await uploadSignature(token, 'rider', sig)
      const gPath = needsGuardian && guardianSig ? await uploadSignature(token, 'guardian', guardianSig) : null
      const ok = await submitSignature({ token, signerName: signerName.trim(), isMinor, guardianName: guardianName.trim(), signaturePath: sigPath, guardianSignaturePath: gPath })
      if (!ok) { setState('invalid'); return }
      setState('done')
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Something went wrong. Please try again.')
      setState('ready')
    }
  }

  return (
    <main className="sign">
      <header className="sign-head">
        <Wordmark />
      </header>

      {state === 'loading' && <p className="muted center">Loading your document…</p>}

      {state === 'invalid' && <Notice icon="alert" title="This link isn't valid" body="It may have been used already or typed incorrectly. Ask the barn to send a fresh one." />}
      {state === 'expired' && <Notice icon="calendar" title="This link has expired" body="Signing links are good for 14 days. Ask the barn to send a new one." />}
      {state === 'already' && <Notice icon="check" title="Already signed" body="This document has been signed. Nothing more to do." tone="good" />}
      {state === 'done' && <Notice icon="check" title="Thank you, you're all set" body={`${view?.title ?? 'The document'} has been signed and sent to the barn. You can close this page.`} tone="good" />}

      {view && (state === 'ready' || state === 'submitting') && (
        <form className="sign-card" onSubmit={submit}>
          <h1>{view.title}</h1>
          {view.rider_name && <p className="muted">Prepared for {view.rider_name}</p>}

          <div
            className="sign-doc"
            onScroll={(e) => { const el = e.currentTarget; if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) setReadToEnd(true) }}
            ref={(el) => { if (el && el.scrollHeight <= el.clientHeight + 2) setReadToEnd(true) }}
          >
            <Markdown source={view.body} />
          </div>
          {!readToEnd && <p className="muted small center">Scroll to the end of the document to continue.</p>}

          <fieldset className="sign-fields" disabled={!readToEnd || state === 'submitting'}>
            <div className="form-field">
              <label htmlFor="signer">Rider's full legal name</label>
              <input id="signer" type="text" autoComplete="name" required value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>

            <label className="check">
              <input type="checkbox" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} />
              <span>The rider is under 18</span>
            </label>

            <div className="form-field">
              <label htmlFor="sig">{needsGuardian ? "Rider's signature" : 'Signature'}</label>
              <SignaturePad id="sig" onChange={setSig} />
            </div>

            {needsGuardian && (
              <>
                <div className="form-field">
                  <label htmlFor="guardian">Parent or guardian's full legal name</label>
                  <input id="guardian" type="text" required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="gsig">Parent or guardian's signature</label>
                  <SignaturePad id="gsig" onChange={setGuardianSig} />
                </div>
              </>
            )}

            <label className="check consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{CONSENT_TEXT}</span>
            </label>

            {err && <p className="field-error">{err}</p>}

            <Button type="submit" variant="primary" disabled={!canSubmit || state === 'submitting'} className="sign-submit">
              {state === 'submitting' ? 'Submitting…' : 'Sign and submit'}
            </Button>
            <p className="muted small center">Signed on {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. A copy stays on file with the barn.</p>
          </fieldset>
        </form>
      )}
    </main>
  )
}

function Notice({ icon, title, body, tone }: { icon: string; title: string; body: string; tone?: 'good' }) {
  return (
    <div className={`sign-card notice ${tone ?? ''}`}>
      <div className="notice-icon"><Icon name={icon} size={26} /></div>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
    </div>
  )
}

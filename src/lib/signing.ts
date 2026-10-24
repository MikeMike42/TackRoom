import { supabase, DOCUMENTS_BUCKET } from './supabase'
import type { Row } from './modules'

export const CONSENT_TEXT =
  'I agree to sign this document electronically and understand that my electronic signature is legally binding, the same as a handwritten signature.'

/* ---------- Staff: send for signature ---------- */
export async function sendWaiver(waiverId: string, email: string, message: string) {
  const { data, error } = await supabase.functions.invoke('send-waiver', {
    body: { waiver_id: waiverId, email, message },
  })
  if (error) {
    // supabase-js wraps non-2xx responses; try to surface the function's own message.
    let detail = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) { const j = await ctx.json(); if (j?.error) detail = j.error }
    } catch { /* keep generic */ }
    throw new Error(detail)
  }
  return data as { ok: true; link: string; expires: string }
}

/* ---------- Public: signing page ---------- */
export type SigningView = {
  title: string
  body: string
  rider_name: string | null
  requires_guardian_for_minors: boolean
  signed: boolean
  expired: boolean
}

export async function getWaiverForSigning(token: string): Promise<SigningView | null> {
  const { data, error } = await supabase.rpc('get_waiver_for_signing', { p_token: token })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row as SigningView) ?? null
}

export async function uploadSignature(token: string, who: 'rider' | 'guardian', dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `signatures/${token}/${who}-${Date.now()}.png`
  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false })
  if (error) throw error
  return path
}

export async function submitSignature(args: {
  token: string
  signerName: string
  isMinor: boolean
  guardianName: string
  signaturePath: string
  guardianSignaturePath: string | null
}): Promise<boolean> {
  const { data, error } = await supabase.rpc('submit_waiver_signature', {
    p_token: args.token,
    p_signer_name: args.signerName,
    p_is_minor: args.isMinor,
    p_guardian_name: args.guardianName,
    p_signature_path: args.signaturePath,
    p_guardian_signature_path: args.guardianSignaturePath ?? '',
    p_user_agent: navigator.userAgent,
    p_consent_text: CONSENT_TEXT,
  })
  if (error) throw error
  return Boolean(data)
}

/* ---------- Staff: build the signed PDF in the browser ---------- */
export async function buildSignedPdf(waiver: Row, riderName: string): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const PAGE: [number, number] = [612, 792]
  const M = 56
  const width = PAGE[0] - M * 2
  let page = pdf.addPage(PAGE)
  let y = PAGE[1] - M

  const ensure = (h: number) => { if (y - h < M) { page = pdf.addPage(PAGE); y = PAGE[1] - M } }
  const text = (s: string, size: number, f = font, color = rgb(0.11, 0.13, 0.1)) => {
    for (const para of s.split('\n')) {
      const lines = wrap(para, f, size, width)
      for (const line of lines) {
        ensure(size * 1.4)
        page.drawText(line, { x: M, y: y - size, size, font: f, color })
        y -= size * 1.4
      }
      if (lines.length === 0) y -= size * 0.8
    }
  }

  text(String(waiver.title ?? 'Waiver'), 20, bold)
  y -= 6
  text(`Rider: ${riderName || String(waiver.signer_name ?? '')}`, 11, font, rgb(0.4, 0.45, 0.4))
  y -= 14

  // Body: strip the most common markdown markers for the PDF.
  const body = String(waiver.body_snapshot ?? '')
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`/g, '')
    if (/^#{1,3}\s/.test(line)) { y -= 6; text(line.replace(/^#+\s*/, ''), 13, bold); y -= 2 }
    else if (/^\s*[-*]\s/.test(line)) text('•  ' + line.replace(/^\s*[-*]\s*/, ''), 11)
    else if (line.trim() === '---') { y -= 8 }
    else text(line, 11)
  }

  // Signature block
  y -= 20
  ensure(160)
  page.drawLine({ start: { x: M, y }, end: { x: M + width, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.78) })
  y -= 16
  text('Signatures', 13, bold)
  y -= 6

  const drawSig = async (label: string, name: string, path: string | null) => {
    ensure(90)
    if (path) {
      const { data } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path)
      if (data) {
        const img = await pdf.embedPng(await data.arrayBuffer())
        const h = 56; const w = Math.min(220, (img.width / img.height) * h)
        page.drawImage(img, { x: M, y: y - h, width: w, height: h })
        y -= h + 4
      }
    }
    page.drawLine({ start: { x: M, y }, end: { x: M + 260, y }, thickness: 0.75, color: rgb(0.2, 0.2, 0.2) })
    y -= 12
    text(`${label}: ${name}`, 10, font, rgb(0.3, 0.33, 0.3))
    y -= 8
  }

  await drawSig(waiver.signer_is_minor ? 'Rider (minor)' : 'Rider', String(waiver.signer_name ?? ''), waiver.signature_path as string | null)
  if (waiver.guardian_name) await drawSig('Parent / guardian', String(waiver.guardian_name), waiver.guardian_signature_path as string | null)

  // Audit trail
  y -= 10
  ensure(120)
  page.drawLine({ start: { x: M, y }, end: { x: M + width, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.78) })
  y -= 16
  text('Electronic signature record', 11, bold)
  const when = waiver.signed_at ? new Date(String(waiver.signed_at)) : null
  const sent = waiver.sent_at ? new Date(String(waiver.sent_at)) : null
  const audit = [
    sent ? `Sent to ${waiver.signer_email ?? ''} on ${sent.toLocaleString()}` : null,
    when ? `Signed on ${when.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})` : null,
    waiver.consent_text ? `Consent: "${waiver.consent_text}"` : null,
    waiver.signer_user_agent ? `Device: ${waiver.signer_user_agent}` : null,
    `Document ID: ${waiver.id}`,
  ].filter(Boolean).join('\n')
  text(audit, 8.5, font, rgb(0.4, 0.45, 0.4))

  return pdf.save()
}

function wrap(s: string, font: { widthOfTextAtSize(t: string, z: number): number }, size: number, max: number): string[] {
  if (!s.trim()) return []
  const words = s.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (font.widthOfTextAtSize(t, size) > max && cur) { lines.push(cur); cur = w } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

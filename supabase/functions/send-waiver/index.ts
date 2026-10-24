// Supabase Edge Function: send-waiver
// Called by staff from the app. Verifies the caller is signed in, generates a
// single-use signing token on the waiver, and emails the link via Resend.
//
// Secrets (set with `supabase secrets set`):
//   RESEND_API_KEY   — from resend.com
//   FROM_EMAIL       — e.g. "Willow Creek Stables <waivers@yourdomain.com>"
//                      (must be a verified domain in Resend, or use onboarding@resend.dev while testing)
//   APP_URL          — e.g. https://tack-room.netlify.app
//   BUSINESS_NAME    — shown in the email
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const TOKEN_DAYS = 14

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Who is calling? Must be a signed-in staff member.
  const asCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !user) return json({ error: 'Not signed in.' }, 401)

  let body: { waiver_id?: string; email?: string; message?: string }
  try { body = await req.json() } catch { return json({ error: 'Bad request body.' }, 400) }
  const { waiver_id, email, message } = body
  if (!waiver_id || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'A waiver id and a valid email are required.' }, 400)
  }

  // 2. Load the waiver + template with elevated rights.
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: waiver, error: wErr } = await admin
    .from('waivers')
    .select('id, title, template_id, client_id, signed_at, waiver_templates(body, name), clients(full_name)')
    .eq('id', waiver_id)
    .single()
  if (wErr || !waiver) return json({ error: 'Waiver not found.' }, 404)
  if (waiver.signed_at) return json({ error: 'This waiver is already signed.' }, 409)
  const template = (waiver as any).waiver_templates as { body: string; name: string } | null
  if (!template?.body?.trim()) return json({ error: 'Pick a waiver template with text before sending.' }, 400)

  // 3. Mint a token, snapshot the text, mark as sent.
  const token = randomToken()
  const expires = new Date(Date.now() + TOKEN_DAYS * 86400000).toISOString()
  const { error: upErr } = await admin.from('waivers').update({
    sign_token: token,
    token_expires_at: expires,
    sent_at: new Date().toISOString(),
    signer_email: email,
    body_snapshot: template.body,
    status: 'sent',
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }).eq('id', waiver_id)
  if (upErr) return json({ error: upErr.message }, 500)

  // 4. Email it.
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const link = `${appUrl}/sign/${token}`
  const business = Deno.env.get('BUSINESS_NAME') ?? 'the barn'
  const riderName = (waiver as any).clients?.full_name as string | undefined

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1b2219">
      <h2 style="margin:0 0 12px;font-weight:600">${esc(waiver.title)}</h2>
      <p>Hi${riderName ? ' ' + esc(riderName.split(' ')[0]) : ''},</p>
      ${message ? `<p>${esc(message)}</p>` : ''}
      <p>${esc(business)} needs your signature on the following document before your next visit. It takes about two minutes and works on your phone.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#2d5d3d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;display:inline-block">Review and sign</a>
      </p>
      <p style="color:#7a8276;font-size:13px">This link is personal to you and expires in ${TOKEN_DAYS} days. If the button doesn't work, copy this address into your browser:<br>${link}</p>
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') ?? 'onboarding@resend.dev',
      to: [email],
      subject: `Please sign: ${waiver.title}`,
      html,
      text: `${waiver.title}\n\n${business} needs your signature. Review and sign here (expires in ${TOKEN_DAYS} days):\n${link}`,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: `Email failed: ${detail}` }, 502)
  }

  return json({ ok: true, link, expires })
})

function randomToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

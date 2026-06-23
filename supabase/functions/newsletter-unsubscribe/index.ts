// Edge Function: newsletter-unsubscribe
// ────────────────────────────────────────────────────────────────────────────
// Dezabonare INIȚIATĂ DIN ADMIN (pagina admin-newsletter.html). Spre deosebire de
// subscribe/confirm (publice), aici cere ca apelantul să fie superadmin.
//
// Face DOUĂ lucruri, ca lista să rămână consistentă:
//   1. Supabase (sursa de adevăr): status='unsubscribed', unsubscribed_at=now().
//   2. Resend (lista de trimitere efectivă): marchează contactul unsubscribed=true,
//      ca persoana să nu mai primească broadcasturi. Best-effort — dacă pică,
//      raportăm înapoi (`resend_ok:false`) ca adminul să știe.
//
// Apel din admin: sb.functions.invoke('newsletter-unsubscribe', { body: { email } }).
// invoke trimite JWT-ul superadminului logat ca Authorization → deploy NORMAL
// (cu verificare JWT, FĂRĂ --no-verify-jwt).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ─── 1. Cine apelează? Trebuie să fie superadmin. ───────────────────────
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) return json({ ok: false, error: 'Neautentificat' }, 401)

    // Client cu JWT-ul apelantului, doar ca să aflăm identitatea.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: uErr } = await userClient.auth.getUser()
    if (uErr || !user) return json({ ok: false, error: 'Neautentificat' }, 401)

    // Client cu service_role pentru verificare + scriere (ocolește RLS).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: prof } = await admin
      .from('profiles')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!prof || !prof.is_super_admin) {
      return json({ ok: false, error: 'Acces interzis' }, 403)
    }

    // ─── 2. Validare input ──────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}))
    const normalized = ((body as { email?: string }).email || '').toString().trim().toLowerCase()
    if (!normalized) return json({ ok: false, error: 'Email lipsă' }, 400)

    // ─── 3. Supabase = sursa de adevăr ──────────────────────────────────────
    const { error: updErr } = await admin
      .from('newsletter_subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('email', normalized)
    if (updErr) throw updErr

    // ─── 4. Resend = lista de trimitere efectivă (best-effort) ──────────────
    let resendOk = true
    if (RESEND_API_KEY) {
      try {
        const resp = await fetch(`https://api.resend.com/contacts/${encodeURIComponent(normalized)}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ unsubscribed: true }),
        })
        if (!resp.ok) {
          resendOk = false
          console.error('Resend unsubscribe non-ok:', resp.status, await resp.text())
        }
      } catch (e) {
        resendOk = false
        console.error('Resend unsubscribe failed:', (e as Error).message)
      }
    }

    return json({ ok: true, resend_ok: resendOk })
  } catch (error) {
    console.error('Error in newsletter-unsubscribe:', error)
    return json({ ok: false, error: 'Eroare internă' }, 500)
  }
})

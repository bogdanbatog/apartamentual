// Edge Function: newsletter-confirm
// ────────────────────────────────────────────────────────────────────────────
// Pasul 2 din double opt-in. Utilizatorul apasă linkul din emailul de confirmare
// → GET ?token=<uuid>. Dacă tokenul e valid și abonatul e 'pending', îl marcăm
// 'confirmed' și creăm contactul GLOBAL în Resend (POST /contacts — modelul nou
// nov. 2025, FĂRĂ audience_id). Apoi facem 302 redirect spre pagina de mulțumire.
//
// ⚠️ DEPLOY: această funcție e accesată direct din browser (clic pe link din
// email), FĂRĂ header Authorization. Trebuie deployată cu:
//     npx supabase functions deploy newsletter-confirm --no-verify-jwt
// Altfel Supabase respinge cererea cu 401 înainte să ajungă la cod.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const PLATFORM_URL = 'https://apartamentual.ro'

const SUCCESS_URL = `${PLATFORM_URL}/newsletter-confirmat.html`
const ERROR_URL = `${PLATFORM_URL}/newsletter-confirmat.html?error=1`

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (!token) return redirect(ERROR_URL)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: sub, error: selErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, status')
      .eq('confirm_token', token)
      .maybeSingle()
    if (selErr) throw selErr
    if (!sub) return redirect(ERROR_URL)

    // Deja confirmat → idempotent, doar redirect spre succes.
    if (sub.status === 'confirmed') return redirect(SUCCESS_URL)

    // Doar 'pending' poate fi confirmat. (Un 'unsubscribed' cu token vechi sau
    // orice altă stare → considerăm linkul invalid.)
    if (sub.status !== 'pending') return redirect(ERROR_URL)

    // Marcăm confirmat.
    const { error: updErr } = await supabase
      .from('newsletter_subscribers')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', sub.id)
    if (updErr) throw updErr

    // Creăm contactul GLOBAL în Resend (model nou: fără audience_id).
    // Idempotent: dacă există deja, tratăm răspunsul non-ok ca succes — abonatul
    // e deja 'confirmed' în Supabase, care rămâne sursa noastră de adevăr.
    if (RESEND_API_KEY) {
      try {
        const resp = await fetch('https://api.resend.com/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: sub.email, unsubscribed: false }),
        })
        if (!resp.ok) {
          const t = await resp.text()
          // ex: contactul există deja → ok, operația e idempotentă.
          console.error('Resend contacts non-ok (tratat ca idempotent):', resp.status, t)
        }
      } catch (e) {
        // Nu blocăm confirmarea pe o eroare temporară Resend; abonatul e deja
        // 'confirmed' în Supabase și putem resincroniza ulterior.
        console.error('Resend contacts call failed:', (e as Error).message)
      }
    }

    return redirect(SUCCESS_URL)
  } catch (error) {
    console.error('Error in newsletter-confirm:', error)
    return redirect(ERROR_URL)
  }
})

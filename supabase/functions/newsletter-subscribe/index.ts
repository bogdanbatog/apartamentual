// Edge Function: newsletter-subscribe
// ────────────────────────────────────────────────────────────────────────────
// Primește o cerere de abonare la newsletter de pe site (footer sau banda de pe
// homepage), scrie abonatul în Supabase cu status='pending' (folosind
// service_role, deci ocolește RLS) și trimite un email de confirmare (double
// opt-in) prin Resend.
//
// Sursa de adevăr pentru consimțământ (dovadă GDPR) este tabelul
// public.newsletter_subscribers. Lista de trimitere efectivă (contactele globale
// Resend) se populează abia DUPĂ confirmare, în edge function-ul newsletter-confirm.
//
// Convenții respectate (vezi notify-admins): serve() din std/http, CORS '*',
// Resend prin fetch, from 'apartamentual@ltfbstudio.ro'.
//
// Apel din frontend: prin clientul global `sb`:
//   sb.functions.invoke('newsletter-subscribe', { body: { email, source } })
// (invoke trimite automat anon-key ca Authorization, deci se deployează NORMAL,
//  cu verificare JWT — NU are nevoie de --no-verify-jwt.)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

// Validare email simplă, suficient de strictă pentru a respinge gunoi evident.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Fereastra anti-abuz: nu retrimitem un email de confirmare dacă a fost deja o
// cerere pentru aceeași adresă în ultimele 2 minute.
const RESEND_THROTTLE_MS = 2 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

// ─── Email de confirmare (double opt-in), ton calm de arhitect ──────────────
function buildConfirmEmailHtml(confirmUrl: string): string {
  return `
  <div style="font-family:'Mona Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#faf8f3;color:#555555;">
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e8e3d8;">
      <h1 translate="no" class="notranslate" style="margin:0;font-size:22px;color:#1a1a1a;font-weight:600;">apartamen<span style="color:#c2604a;">TU</span>al</h1>
      <p translate="no" class="notranslate" style="margin:4px 0 0;font-size:12px;color:#8a8a8a;">by LTFB Studio</p>
    </div>
    <div style="padding:32px 8px;">
      <h2 style="margin:0 0 16px;font-size:20px;color:#1a1a1a;line-height:1.3;">Mai e un pas: confirmă-ți adresa</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Bună,</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Mulțumim că vrei să primești newsletterul <span translate="no" class="notranslate">ApartamenTUal</span> — povestea reală a construcției colaborative, terenuri noi și pașii practici din spatele blocurilor construite în grup.</p>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Mai e un singur pas: confirmă-ți adresa.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${confirmUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">Confirmă abonarea</a>
      </div>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8a8a8a;">Dacă nu te-ai abonat tu, poți ignora liniștit acest email.<br><br>Dacă butonul nu funcționează, copiază acest link în browser:<br><a href="${confirmUrl}" style="color:#c2604a;word-break:break-all;">${confirmUrl}</a></p>
    </div>
    <div style="border-top:1px solid #e8e3d8;padding:20px 8px 0;text-align:center;">
      <p style="margin:0;font-size:13px;color:#8a8a8a;">Echipa <span translate="no" class="notranslate">ApartamenTUal</span><br><a href="https://apartamentual.ro" style="color:#c2604a;text-decoration:none;">apartamentual.ro</a></p>
    </div>
  </div>
  `
}

// ─── Notificare internă pentru un abonat NOU ───────────────────────────────
// Slack #app_events + email la apartamentual@ltfbstudio.ro, prin notify-admins.
// Best-effort: o eroare aici NU strică abonarea. Extrasă ca funcție fiindcă e
// folosită din două locuri (fluxul normal cu double opt-in și cel de la
// înregistrare, cu adresa deja verificată).
// `status` spune pe care dintre cele două trasee a venit abonarea: 'pending'
// (din footer/homepage, așteaptă clic pe linkul de confirmare) sau 'confirmed'
// (de la înregistrarea contului, adresă deja dovedită). notify-admins alege
// textul notificării după el — altfel Slack ar raporta „pending" și pentru
// abonările care sunt de fapt deja active pe listă.
async function notifyNewSubscriber(
  email: string,
  source: string,
  zone: string | null,
  status: 'pending' | 'confirmed',
) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-admins`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'newsletter_signup',
        data: {
          // Destinatar explicit: notificările de newsletter merg la
          // apartamentual@ltfbstudio.ro (nu la ADMIN_EMAIL). Pentru că setăm un
          // recipient explicit, notify-admins NU mai adaugă și CC-ul de
          // superadmin → emailul ajunge DOAR aici.
          recipient_email: 'apartamentual@ltfbstudio.ro',
          email,
          source,
          zone_interest: zone,
          status,
        },
      }),
    })
  } catch (e) {
    console.error('notify-admins (newsletter_signup) failed:', (e as Error).message)
  }
}

// ─── Contact global în Resend (model nou nov. 2025, fără audience_id) ───────
// Idempotent: dacă există deja, tratăm răspunsul non-ok ca succes — Supabase
// rămâne sursa noastră de adevăr. Aceeași logică ca în newsletter-confirm.
async function createResendContact(email: string) {
  if (!RESEND_API_KEY) return
  try {
    const resp = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      console.error('Resend contacts non-ok (tratat ca idempotent):', resp.status, t)
    }
  } catch (e) {
    console.error('Resend contacts call failed:', (e as Error).message)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json().catch(() => ({}))
    const { email, source, zone_interest, verified_signup } = payload as {
      email?: string; source?: string; zone_interest?: string; verified_signup?: boolean
    }

    // Validare + normalizare (lowercase + trim). Stocăm mereu lowercase, ca
    // unique index-ul pe lower(email) să nu poată fi ocolit.
    const normalized = (email || '').toString().trim().toLowerCase()
    if (!EMAIL_RE.test(normalized)) {
      return json({ ok: false, error: 'Email invalid' }, 400)
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Caut abonatul existent (email stocat deja lowercase).
    const { data: existing, error: selErr } = await supabase
      .from('newsletter_subscribers')
      .select('id, status, consent_at')
      .eq('email', normalized)
      .maybeSingle()
    if (selErr) throw selErr

    // ── Mod „abonare la înregistrare" (fără al doilea email de confirmare) ──
    // Apelat din pagina de bun-venit, imediat după ce utilizatorul a dat clic pe
    // linkul de confirmare a CONTULUI. În acest punct adresa e deja dovedită de
    // Supabase Auth, iar bifa de la înregistrare e consimțământul explicit, deci
    // putem marca direct 'confirmed' fără să mai trimitem un email de confirmare.
    //
    // SECURITATE: acceptăm asta DOAR dacă tokenul din headerul Authorization e un
    // JWT de utilizator real, cu emailul confirmat, ȘI emailul din cerere e chiar
    // al acelui utilizator. Fără verificările astea, oricine ar putea abona pe
    // altcineva sărind peste double opt-in.
    if (verified_signup === true) {
      const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
      if (!jwt) return json({ ok: false, error: 'Neautorizat' }, 401)

      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt)
      const authUser = userData?.user
      if (userErr || !authUser) return json({ ok: false, error: 'Neautorizat' }, 401)
      if (!authUser.email_confirmed_at) {
        return json({ ok: false, error: 'Email neconfirmat' }, 403)
      }
      if ((authUser.email || '').toLowerCase() !== normalized) {
        return json({ ok: false, error: 'Emailul nu corespunde contului' }, 403)
      }

      // S-a dezabonat cândva → NU îl reabonăm automat, îi respectăm decizia.
      if (existing && existing.status === 'unsubscribed') {
        return json({ ok: true, respected_unsubscribe: true })
      }
      // Deja pe listă → nimic de făcut (apelul e idempotent).
      if (existing && existing.status === 'confirmed') {
        return json({ ok: true, already: true })
      }

      const nowIso = new Date().toISOString()
      if (existing) {
        // Era 'pending' (se abonase de pe site, dar n-a apăsat linkul din email).
        // Îl confirmăm acum și păstrăm consimțământul original ca dovadă GDPR.
        const { error } = await supabase
          .from('newsletter_subscribers')
          .update({
            status: 'confirmed',
            confirmed_at: nowIso,
            consent_at: existing.consent_at || nowIso,
          })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        // Abonat nou, direct 'confirmed'. `confirm_token` primește valoarea
        // implicită din schemă (gen_random_uuid), nu e folosit pe traseul ăsta.
        const { error } = await supabase
          .from('newsletter_subscribers')
          .insert({
            email: normalized,
            status: 'confirmed',
            source: source || 'register',
            zone_interest: zone_interest || null,
            consent_at: nowIso,
            confirmed_at: nowIso,
          })
        if (error) throw error
      }

      await createResendContact(normalized)
      if (!existing) {
        // Traseul de la înregistrare: abonatul e scris direct 'confirmed'.
        await notifyNewSubscriber(normalized, source || 'register', zone_interest || null, 'confirmed')
      }

      return json({ ok: true, confirmed: true })
    }

    let tokenToSend: string | null = null
    let isNew = false

    if (existing) {
      if (existing.status === 'confirmed') {
        // Deja confirmat → nu retrimitem nimic.
        return json({ ok: true, already: true })
      }

      if (existing.status === 'pending') {
        // Anti-abuz: dacă a fost o cerere recentă, nu retrimitem (răspundem ok
        // oricum, ca să nu divulgăm existența adresei).
        const last = existing.consent_at ? new Date(existing.consent_at).getTime() : 0
        if (Date.now() - last < RESEND_THROTTLE_MS) {
          return json({ ok: true })
        }
        // Regenerăm tokenul, reîmprospătăm consimțământul și retrimitem.
        const newToken = crypto.randomUUID()
        const { error } = await supabase
          .from('newsletter_subscribers')
          .update({ confirm_token: newToken, consent_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (error) throw error
        tokenToSend = newToken
      } else {
        // status === 'unsubscribed' → tratăm ca reabonare.
        const newToken = crypto.randomUUID()
        const { error } = await supabase
          .from('newsletter_subscribers')
          .update({
            status: 'pending',
            confirm_token: newToken,
            consent_at: new Date().toISOString(),
            unsubscribed_at: null,
          })
          .eq('id', existing.id)
        if (error) throw error
        tokenToSend = newToken
      }
    } else {
      // Abonat nou.
      const newToken = crypto.randomUUID()
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email: normalized,
          status: 'pending',
          source: source || null,
          zone_interest: zone_interest || null,
          confirm_token: newToken,
          consent_at: new Date().toISOString(),
        })
      if (error) throw error
      tokenToSend = newToken
      isNew = true
    }

    // Trimitem emailul de confirmare prin Resend.
    if (tokenToSend && RESEND_API_KEY) {
      const confirmUrl = `${SUPABASE_URL}/functions/v1/newsletter-confirm?token=${tokenToSend}`
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ApartamenTUal by LTFB Studio <apartamentual@ltfbstudio.ro>',
          to: [normalized],
          subject: 'Confirmă abonarea la newsletter ApartamenTUal',
          html: buildConfirmEmailHtml(confirmUrl),
        }),
      })
      if (!resp.ok) {
        const t = await resp.text()
        console.error('Resend confirm email error:', t)
        return json({ ok: false, error: 'Nu am putut trimite emailul de confirmare. Încearcă din nou.' }, 502)
      }
    }

    // Notificare internă (Slack #app_events + email), doar pentru abonați noi.
    if (isNew) {
      // Traseul normal (footer/homepage): abonatul rămâne 'pending' până confirmă.
      await notifyNewSubscriber(normalized, source || 'necunoscut', zone_interest || null, 'pending')
    }

    return json({ ok: true })
  } catch (error) {
    console.error('Error in newsletter-subscribe:', error)
    return json({ ok: false, error: 'Eroare internă' }, 500)
  }
})

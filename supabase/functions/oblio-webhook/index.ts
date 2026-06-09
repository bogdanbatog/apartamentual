// Edge Function: oblio-webhook
// Primește notificări de la Oblio (webhook) când o proformă/factură e încasată.
// Marchează comanda ca paid, salvează detaliile facturii fiscale generate
// automat, și notifică superadmin (email + Slack).
//
// Webhook-uri Oblio relevante:
//   - "invoice"   — factură fiscală creată/modificată (apare după ce proforma a fost plătită)
//   - "proforma"  — proformă creată/modificată/încasată
//
// Configurare webhook în Oblio: se face printr-un singur API call (descris în README).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-oblio-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const rawBody = await req.text()
    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }

    // Initialize Supabase admin client (service_role bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Optional shared-secret check (dacă Oblio îți permite să configurezi un secret în webhook)
    const expectedSecret = Deno.env.get('OBLIO_WEBHOOK_SECRET')
    if (expectedSecret) {
      const provided = req.headers.get('x-oblio-signature') || req.headers.get('x-webhook-secret')
      if (provided !== expectedSecret) {
        console.warn('Webhook signature mismatch')
        return jsonResponse({ error: 'Invalid signature' }, 401)
      }
    }

    // Idempotency key: hash of (topic + serie + numar + status)
    const topic = payload.topic || payload.event || 'unknown'
    const docData = payload.data || payload
    const serie = docData.seriesName || docData.serie || ''
    const numar = docData.number || docData.numar || ''
    const status = docData.status || docData.collected || ''
    const idempotencyKey = `oblio_${topic}_${serie}_${numar}_${status}`

    // Lookup comanda by oblio_factura_serie + oblio_factura_numar
    // (we stored these when we created the proforma)
    const { data: comanda, error: lookupError } = await supabase
      .from('comenzi_analize')
      .select('id, status, order_id, email, tip_persoana, nume, prenume, denumire_firma, pret_total, oblio_factura_serie, oblio_factura_numar')
      .eq('oblio_factura_serie', serie)
      .eq('oblio_factura_numar', numar)
      .maybeSingle()

    if (lookupError) {
      console.error('Lookup error:', lookupError)
      return jsonResponse({ error: 'DB lookup failed' }, 500)
    }

    if (!comanda) {
      // Webhook for an Oblio document we don't have in DB — log and ignore
      console.log(`Webhook for unknown doc ${serie} ${numar} — ignoring`)
      return jsonResponse({ success: true, message: 'Document not found in DB, ignored' })
    }

    // Idempotency: dacă log-ul cu această cheie există deja, ignorăm webhook-ul duplicat
    const { data: existingLog } = await supabase
      .from('comenzi_analize_log')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existingLog) {
      console.log(`Duplicate webhook for ${idempotencyKey} — ignoring`)
      return jsonResponse({ success: true, message: 'Duplicate webhook ignored' })
    }

    // Detectăm dacă e plată confirmată
    const isPaid = detectPaid(topic, docData)

    // Log webhook received
    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comanda.id,
      event_type: 'netopia_callback_received',  // reused: orice notificare de plată
      success: true,
      message: `Oblio webhook: ${topic} — ${isPaid ? 'PLATIT' : 'updated'}`,
      payload: payload,
      idempotency_key: idempotencyKey,
    })

    // Dacă plata e confirmată și comanda nu e deja paid, o procesăm
    if (isPaid && comanda.status === 'pending_payment') {
      await processPayment(supabase, comanda, docData)
    }

    return jsonResponse({
      success: true,
      comanda_id: comanda.id,
      status_after: isPaid ? 'paid' : comanda.status,
    })

  } catch (error) {
    console.error('Unhandled error:', error)
    return jsonResponse({ error: (error as Error).message }, 500)
  }
})

// =====================================================
// PROCESS PAYMENT
// =====================================================

async function processPayment(supabase: any, comanda: any, docData: any) {
  // Update comanda status to paid
  const updateFields: any = {
    status: 'paid',
    paid_at: new Date().toISOString(),
  }

  // Dacă webhook-ul include factura fiscală generată automat (după plata proformei),
  // salvăm detaliile facturii. Oblio convertește proforma în factură când "Factureaza
  // Proformele incasate cu Cardul" e activ.
  if (docData.invoiceSeriesName && docData.invoiceNumber) {
    updateFields.oblio_factura_serie = docData.invoiceSeriesName
    updateFields.oblio_factura_numar = docData.invoiceNumber
    if (docData.invoiceLink || docData.link) {
      updateFields.oblio_factura_url = docData.invoiceLink || docData.link
    }
  }

  await supabase
    .from('comenzi_analize')
    .update(updateFields)
    .eq('id', comanda.id)

  // Log status change
  await supabase.from('comenzi_analize_log').insert({
    comanda_id: comanda.id,
    event_type: 'status_changed',
    success: true,
    message: 'Status: pending_payment → paid',
    payload: { invoice_data: docData },
  })

  // Trimite email de confirmare către user (Oblio trimite separat factura PDF)
  await sendUserConfirmationEmail(supabase, comanda)

  // Notifică superadmin (email + Slack) prin notify-admins
  await notifySuperAdmin(supabase, comanda, docData)
}

// =====================================================
// EMAIL TO USER
// =====================================================

async function sendUserConfirmationEmail(supabase: any, comanda: any) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not set — skipping user email')
    return
  }

  const numeClient = comanda.tip_persoana === 'PF'
    ? `${comanda.prenume} ${comanda.nume}`
    : comanda.denumire_firma

  const subject = `Comandă confirmată — ${comanda.order_id}`
  const html = `
    <div style="font-family: 'Mona Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #555555;">
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333333 100%); color: white; padding: 2rem 1.5rem; text-align: center;">
        <h1 style="margin: 0; font-size: 1.5rem; font-weight: 600;">apartamen<span style="color: #c2604a;">TU</span>al</h1>
        <p style="margin: 0.5rem 0 0; opacity: 0.85;">Comandă confirmată</p>
      </div>
      <div style="padding: 2rem 1.5rem; background: #faf8f3;">
        <h2 style="margin: 0 0 1rem; color: #1a1a1a;">Mulțumim, ${escapeHtml(numeClient)}!</h2>
        <p>Plata pentru analiza preliminară a fost primită cu succes.</p>
        <div style="background: #ffffff; padding: 1rem 1.25rem; border-radius: 12px; margin: 1.5rem 0; border-left: 4px solid #c2604a;">
          <div style="font-size: 0.85rem; color: #8a8a8a; margin-bottom: 0.25rem;">Număr comandă</div>
          <div style="font-size: 1.1rem; font-weight: 600; color: #1a1a1a;">${escapeHtml(comanda.order_id)}</div>
        </div>
        <h3 style="margin: 1.5rem 0 0.75rem; color: #1a1a1a;">Ce urmează?</h3>
        <ol style="padding-left: 1.25rem; color: #555555; line-height: 1.7;">
          <li>Vei primi separat <strong>factura fiscală</strong> de la Oblio (pe adresa ta de email).</li>
          <li>Echipa noastră analizează terenul și pregătește raportul tehnic.</li>
          <li>În <strong>maxim 3-5 zile lucrătoare</strong> primești pe email un PDF cu analiza completă.</li>
        </ol>
        <p style="margin: 1.5rem 0 0; color: #8a8a8a; font-size: 0.9rem;">Pentru orice întrebare, scrie-ne la <a href="mailto:apartamentual@ltfbstudio.ro" style="color: #c2604a;">apartamentual@ltfbstudio.ro</a>.</p>
      </div>
      <div style="padding: 1rem 1.5rem; background: #1a1a1a; color: #b5ada0; text-align: center; font-size: 0.8rem;">
        ApartamenTUal — locuințe colaborative, după modelul Baugruppen<br>
        <a href="https://apartamentual.ro" style="color: #e8e3d8; text-decoration: none;">apartamentual.ro</a>
      </div>
    </div>
  `

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ApartamenTUal <apartamentual@ltfbstudio.ro>',
        to: [comanda.email],
        subject: subject,
        html: html,
      }),
    })

    const ok = resp.ok
    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comanda.id,
      event_type: ok ? 'email_user_sent' : 'email_failed',
      success: ok,
      message: ok ? 'Email confirmare trimis user-ului' : `Email failed: ${await resp.text()}`,
    })
  } catch (err) {
    console.error('User email error:', err)
    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comanda.id,
      event_type: 'email_failed',
      success: false,
      message: 'Email user error: ' + (err as Error).message,
    })
  }
}

// =====================================================
// NOTIFY SUPERADMIN
// =====================================================

async function notifySuperAdmin(supabase: any, comanda: any, docData: any) {
  const numeClient = comanda.tip_persoana === 'PF'
    ? `${comanda.prenume} ${comanda.nume}`
    : comanda.denumire_firma

  try {
    await supabase.functions.invoke('notify-admins', {
      body: {
        event_type: 'comanda_platita',
        data: {
          order_id: comanda.order_id,
          email: comanda.email,
          tip_persoana: comanda.tip_persoana,
          nume_client: numeClient,
          pret: comanda.pret_total,
          factura: docData.invoiceSeriesName && docData.invoiceNumber
            ? `${docData.invoiceSeriesName} ${docData.invoiceNumber}`
            : 'În curs de generare',
        },
      },
    })

    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comanda.id,
      event_type: 'email_admin_sent',
      success: true,
      message: 'Notificare superadmin trimisă',
    })
  } catch (err) {
    console.error('Admin notify error:', err)
    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comanda.id,
      event_type: 'email_failed',
      success: false,
      message: 'Notify admin error: ' + (err as Error).message,
    })
  }
}

// =====================================================
// HELPERS
// =====================================================

function detectPaid(topic: string, data: any): boolean {
  // Oblio webhook se poate manifesta cu mai multe shape-uri.
  // Detectăm "plata confirmata" cu cea mai largă acoperire.
  if (data.collected === 1 || data.collected === '1' || data.collected === true) return true
  if (data.status === 'paid' || data.status === 'incasata' || data.status === 'collected') return true
  // Dacă există invoiceNumber în webhook = proforma a fost convertită în factură = e plătită
  if (data.invoiceNumber || data.invoiceSeriesName) return true
  return false
}

function escapeHtml(s: string): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: status,
  })
}

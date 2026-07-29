// Edge Function: creeaza-proforma-oblio
// Creează o proformă în Oblio (cu butonul "Plătește cu cardul" prin Netopia)
// pentru o comandă de analiză preliminară ApartamenTUal.
//
// Flow:
//   1. Primește datele formularului (PF/PJ + descriere teren)
//   2. Inserează rândul în comenzi_analize (status pending_payment)
//   3. Apelează Oblio API: POST /api/docs/proforma
//   4. Salvează seria + numărul proformei în DB
//   5. Returnează URL-ul proformei (cu butonul de plată)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// =====================================================
// TYPES
// =====================================================

interface ComandaInput {
  // Tip facturare
  tip_persoana: 'PF' | 'PJ'

  // Date contact comune
  email: string
  telefon?: string

  // Date PF
  nume?: string
  prenume?: string
  cnp?: string

  // Date PJ
  denumire_firma?: string
  cui?: string
  reg_com?: string

  // Adresa facturare (comună)
  adresa: string
  oras: string
  judet: string
  cod_postal?: string

  // Detalii teren
  nr_cadastral?: string
  adresa_teren?: string
  descriere_teren: string
  link_teren?: string

  // Dacă vine din pagina unui teren, păstrăm referința
  teren_id?: string

  // Acceptare termeni (must be true)
  accept_termeni: boolean
  accept_gdpr: boolean
  accept_retur: boolean
}

interface OblioProformaResponse {
  status: number
  statusMessage?: string
  data?: {
    seriesName: string
    number: string
    link: string         // URL public către proforma cu buton plată
    einvoice?: string
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    // Parse input
    const input: ComandaInput = await req.json()

    // Validate input
    const validationError = validateInput(input)
    if (validationError) {
      return jsonResponse({ error: validationError }, 400)
    }

    // Initialize Supabase admin client (service_role bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Generate order_id
    const orderId = generateOrderId()

    // 2. Compute pricing (TVA 21% inclus)
    const pretTotal = 99.00
    const cotaTva = 21
    const pretFaraTva = round2(pretTotal / (1 + cotaTva / 100))
    const tvaValoare = round2(pretTotal - pretFaraTva)

    // 3. Get user_id if authenticated (optional — guest checkout supported)
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const userToken = authHeader.replace('Bearer ', '')
      const { data: userData } = await supabase.auth.getUser(userToken)
      if (userData?.user) {
        userId = userData.user.id
      }
    }

    // 4. Insert into comenzi_analize
    const { data: comanda, error: insertError } = await supabase
      .from('comenzi_analize')
      .insert({
        order_id: orderId,
        user_id: userId,
        tip_persoana: input.tip_persoana,
        email: input.email.trim().toLowerCase(),
        telefon: input.telefon?.trim() || null,
        nume: input.nume?.trim() || null,
        prenume: input.prenume?.trim() || null,
        cnp: input.cnp?.trim() || null,
        denumire_firma: input.denumire_firma?.trim() || null,
        cui: input.cui?.trim() || null,
        reg_com: input.reg_com?.trim() || null,
        adresa: input.adresa.trim(),
        oras: input.oras.trim(),
        judet: input.judet.trim(),
        cod_postal: input.cod_postal?.trim() || null,
        produs: 'analiza_preliminara',
        pret_total: pretTotal,
        pret_fara_tva: pretFaraTva,
        tva: tvaValoare,
        cota_tva: cotaTva,
        moneda: 'RON',
        nr_cadastral: input.nr_cadastral?.trim() || null,
        adresa_teren: input.adresa_teren?.trim() || null,
        descriere_teren: input.descriere_teren.trim(),
        link_teren: input.link_teren?.trim() || null,
        status: 'pending_payment',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return jsonResponse({ error: 'Eroare la salvarea comenzii: ' + insertError.message }, 500)
    }

    // Log: comanda creata
    await logEvent(supabase, comanda.id, 'order_created', true, 'Comanda inserată în DB', {
      order_id: orderId,
      pret: pretTotal,
    })

    // 5. Apelează Oblio API pentru a crea proforma
    const oblioResult = await createOblioProforma(input, orderId, pretTotal, supabase, comanda.id)

    if (!oblioResult.success) {
      // Mark comanda as failed in case of Oblio error
      await supabase
        .from('comenzi_analize')
        .update({ status: 'failed' })
        .eq('id', comanda.id)

      await logEvent(supabase, comanda.id, 'error', false, 'Eroare Oblio: ' + oblioResult.error, {
        oblio_response: oblioResult.raw,
      })

      return jsonResponse({
        error: 'Nu am putut crea proforma. ' + (oblioResult.error || 'Eroare necunoscută.'),
      }, 500)
    }

    // 6. Update comanda cu detaliile proformei Oblio
    await supabase
      .from('comenzi_analize')
      .update({
        oblio_factura_serie: oblioResult.seriesName,
        oblio_factura_numar: oblioResult.number,
        oblio_factura_url: oblioResult.link,
        oblio_response: oblioResult.raw,
      })
      .eq('id', comanda.id)

    // 7. Notificare Slack/Email pentru superadmin (comanda nouă)
    try {
      await supabase.functions.invoke('notify-admins', {
        body: {
          event_type: 'comanda_creata',
          data: {
            order_id: orderId,
            email: input.email,
            tip_persoana: input.tip_persoana,
            nume_client: input.tip_persoana === 'PF'
              ? `${input.prenume} ${input.nume}`
              : input.denumire_firma,
            pret: pretTotal,
            nr_cadastral: input.nr_cadastral?.trim() || null,
            adresa_teren: input.adresa_teren?.trim() || null,
            // Descrierea merge integral: e singurul loc din care aflăm ce vrea
            // clientul. Plafonul de afișare se aplică în notify-admins.
            descriere_teren: input.descriere_teren.trim(),
            link_teren: input.link_teren?.trim() || null,
            proforma: `${oblioResult.seriesName} ${oblioResult.number}`,
            proforma_url: oblioResult.link,
          },
        },
      })
    } catch (notifyErr) {
      // Non-fatal — notification failures don't block the order
      console.error('Notify error (non-fatal):', notifyErr)
    }

    // 8. Returnează URL-ul proformei către frontend
    return jsonResponse({
      success: true,
      order_id: orderId,
      payment_url: oblioResult.link,
      proforma: `${oblioResult.seriesName} ${oblioResult.number}`,
    })

  } catch (error) {
    console.error('Unhandled error:', error)
    return jsonResponse({ error: 'Eroare neașteptată: ' + (error as Error).message }, 500)
  }
})

// =====================================================
// VALIDATION
// =====================================================

function validateInput(input: ComandaInput): string | null {
  if (!input.tip_persoana || !['PF', 'PJ'].includes(input.tip_persoana)) {
    return 'Tipul persoanei trebuie să fie PF sau PJ'
  }

  if (!input.email || !isValidEmail(input.email)) {
    return 'Email invalid'
  }

  if (input.tip_persoana === 'PF') {
    if (!input.nume?.trim()) return 'Numele este obligatoriu'
    if (!input.prenume?.trim()) return 'Prenumele este obligatoriu'
  } else {
    if (!input.denumire_firma?.trim()) return 'Denumirea firmei este obligatorie'
    if (!input.cui?.trim()) return 'CUI-ul este obligatoriu'
    if (!input.reg_com?.trim()) return 'Reg. Comerțului este obligatoriu'
  }

  if (!input.adresa?.trim()) return 'Adresa este obligatorie'
  if (!input.oras?.trim()) return 'Orașul este obligatoriu'
  if (!input.judet?.trim()) return 'Județul este obligatoriu'
  // Terenul trebuie identificat prin CEL PUȚIN unul: nr. cadastral SAU adresa exactă.
  const hasCadastral = !!input.nr_cadastral?.trim() && input.nr_cadastral.trim().length >= 3
  const hasAdresaTeren = !!input.adresa_teren?.trim() && input.adresa_teren.trim().length >= 5
  if (!hasCadastral && !hasAdresaTeren) {
    return 'Te rugăm să completezi fie numărul cadastral (minim 3 caractere), fie adresa exactă a terenului'
  }
  if (!input.descriere_teren?.trim() || input.descriere_teren.trim().length < 10) {
    return 'Te rugăm să descrii terenul (minim 10 caractere)'
  }

  if (!input.accept_termeni || !input.accept_gdpr || !input.accept_retur) {
    return 'Trebuie să accepți toți termenii înainte de a continua'
  }

  return null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// =====================================================
// OBLIO API CALL
// =====================================================

interface OblioCallResult {
  success: boolean
  seriesName?: string
  number?: string
  link?: string
  error?: string
  raw?: any
}

async function createOblioProforma(
  input: ComandaInput,
  orderId: string,
  pretTotal: number,
  supabase: any,
  comandaId: string
): Promise<OblioCallResult> {
  const oblioEmail = Deno.env.get('OBLIO_API_EMAIL')!
  const oblioSecret = Deno.env.get('OBLIO_API_SECRET')!
  const oblioCif = Deno.env.get('OBLIO_CIF')!  // ex: RO22004992
  const oblioSerie = Deno.env.get('OBLIO_SERIE_PROFORMA') || 'APT'

  // Step 1: Get access token from Oblio
  // Oblio uses OAuth2 client_credentials flow
  const tokenResp = await fetch('https://www.oblio.eu/api/authorize/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: oblioEmail,
      client_secret: oblioSecret,
      grant_type: 'client_credentials',
    }).toString(),
  })

  if (!tokenResp.ok) {
    const errText = await tokenResp.text()
    return { success: false, error: 'Autentificare Oblio eșuată: ' + errText }
  }

  const tokenJson = await tokenResp.json()
  const accessToken = tokenJson.access_token
  if (!accessToken) {
    return { success: false, error: 'Token Oblio lipsă în răspuns' }
  }

  // Step 2: Build proforma payload
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const dueDate = addDays(new Date(), 7).toISOString().slice(0, 10) // 7 zile valabilitate

  // Client data — depends on PF/PJ
  const client: any = {
    address: input.adresa,
    city: input.oras,
    state: input.judet,
    country: 'Romania',
    email: input.email,
    phone: input.telefon || '',
  }

  if (input.tip_persoana === 'PF') {
    client.cif = input.cnp || ''
    // Includem order_id în nume pentru a forța Oblio să creeze un client nou
    // la fiecare comandă (altfel clientul e identificat după nume + reutilizat,
    // ceea ce poate cauza ca emailul să nu fie trimis la comenzi ulterioare).
    client.name = `${input.prenume} ${input.nume} (${orderId})`
    client.vatPayer = 0
  } else {
    client.cif = input.cui || ''
    // Acelaşi raţionament ca la PF — adăugăm order_id pentru unicitate
    client.name = `${input.denumire_firma || ''} (${orderId})`
    client.rc = input.reg_com || ''
    client.vatPayer = 1  // assumption — we don't know if client is VAT-payer; safe default
  }

  // Build the request body for Oblio
  const proformaBody: any = {
    cif: oblioCif,
    client: client,
    issueDate: today,
    dueDate: dueDate,
    seriesName: oblioSerie,
    language: 'RO',
    precision: 2,
    currency: 'RON',
    products: [
      {
        name: 'Analiza preliminara teren',
        description: input.descriere_teren.substring(0, 500),
        price: pretTotal,
        measuringUnit: 'buc',
        currency: 'RON',
        vatName: 'Normala',
        vatPercentage: 21,
        vatIncluded: true,    // Trimitem pretul cu TVA inclus (cf. strategie A)
        quantity: 1,
        productType: 'Serviciu',
      },
    ],
    issuerName: '',
    mentions: `Order ID: ${orderId}`,
    workStation: 'Sediu',
    useStock: 0,
    sendEmail: 1,  // Oblio trimite automat email cu proforma + buton plată
    // idempotencyKey previne duplicarea proformelor dacă request-ul e retry-uit
    idempotencyKey: orderId,
  }

  // Log request payload (fără date sensibile)
  await logEvent(supabase, comandaId, 'oblio_invoice_request', true,
    'Trimitere proforma către Oblio', { request: { ...proformaBody, client: { name: client.name } } })

  // Step 3: Call Oblio API to create proforma
  const proformaResp = await fetch('https://www.oblio.eu/api/docs/proforma', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(proformaBody),
  })

  const proformaJson: OblioProformaResponse = await proformaResp.json()

  // Log response
  await logEvent(supabase, comandaId, 'oblio_invoice_response',
    proformaResp.ok && proformaJson.status === 200,
    proformaJson.statusMessage || `HTTP ${proformaResp.status}`,
    { response: proformaJson }
  )

  if (!proformaResp.ok || proformaJson.status !== 200 || !proformaJson.data) {
    return {
      success: false,
      error: proformaJson.statusMessage || `Oblio HTTP ${proformaResp.status}`,
      raw: proformaJson,
    }
  }

  return {
    success: true,
    seriesName: proformaJson.data.seriesName,
    number: proformaJson.data.number,
    link: proformaJson.data.link,
    raw: proformaJson,
  }
}

// =====================================================
// HELPERS
// =====================================================

function generateOrderId(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  // 6-character random hex (lowercase)
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return `APT-${yyyy}${mm}${dd}-${rnd}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

async function logEvent(
  supabase: any,
  comandaId: string,
  eventType: string,
  success: boolean,
  message: string,
  payload: any = null
) {
  try {
    await supabase.from('comenzi_analize_log').insert({
      comanda_id: comandaId,
      event_type: eventType,
      success: success,
      message: message,
      payload: payload,
    })
  } catch (err) {
    console.error('Log insert error:', err)
  }
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: status,
  })
}

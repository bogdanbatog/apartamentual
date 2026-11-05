// Edge Function: email-bun-venit
// ═══════════════════════════════════════════════════════════════════════════
//
// CE FACE
// În fiecare dimineață, la 10 (ora României), trimite emailul de bun venit
// semnat de Lucian fiecărui cont NOU care și-a completat profilul. Pleacă o
// singură dată per om, a doua zi după înregistrare.
//
// TEXTUL e cel aprobat de Lucian pe 4 noiembrie 2026 (NOTES.md, TODO
// 2026-11-03), pus literal. ⚠️ Nu-l reformula aici. Singurele adaptări sunt
// gramaticale (singular / plural) și cazul „nimeni altcineva în zonele tale”,
// marcat mai jos cu [B0] (text aprobat separat, tot pe 4 nov.).
//
// CINE DECIDE CE
//   • CINE primește și CIFRELE → funcția SQL `lot_bun_venit(...)`
//     (`db_schema/email-bun-venit/1-baza.sql`).
//   • CE SCRIE și CUM ARATĂ → funcțiile `continut()` / `html()` de mai jos.
//   • CÂND pleacă → funcția asta (ora, verificată la București).
//
// DE CE DIRECT PRIN RESEND ȘI NU PRIN `notify-admins`
//   1. FROM personal („Lucian Luță de la ApartamenTUal”) și reply-to: răspunsul
//      la „ce te-a adus aici?” trebuie să ajungă la Lucian.
//   2. Ocolim limita de invocări edge → edge (memoria
//      „edge function cheamă edge function”), care a oprit digestul pe 27 aug.
//   ⚠️ Consecință: emailul NU apare în `notification_log`. Urma lui e în
//   `bun_venit_log` (cine, când, ce variantă, id-ul de la Resend).
//
// CUM E PORNITĂ
// `pg_cron` o cheamă din oră în oră (`2-programare.sql`), iar funcția verifică
// singură dacă la București e între 10 și 12. Același motiv ca la digesturi:
// pg_cron socotește în UTC, România schimbă ora de două ori pe an.
// Rularea de la 10 trimite tot (în mod normal 0-3 oameni). Cele de la 11 și 12
// există doar ca plasă: dacă la 10 a picat ceva, reiau ce n-a plecat.
//
// POARTA DE INTRARE
// Se deployează cu `--no-verify-jwt`. Singura poartă e antetul
// `x-cron-secret`, comparat cu CRON_SECRET (același ca la digesturi).
// Fără secret configurat pe server, refuză tot.
//
// SLACK
// Un singur mesaj pe zi, doar dacă a plecat ceva sau a eșuat ceva. Zilele fără
// conturi noi sunt tăcute.
//
// DEPLOY
//   npx supabase functions deploy email-bun-venit --no-verify-jwt
//
// PROBE MANUALE (PowerShell, vezi memoria „secretul de cron doar din cron.job”):
//
//   1. Cine AR primi, fără să trimită nimic:
//        -Body '{"force": true, "dry_run": true}'
//
//   2. Cum ARATĂ emailul: câte UN email din fiecare variantă prezentă în lot
//      (A / B / B0), cu datele omului real, trimis la adresa ta. Jurnalul nu
//      se atinge, omul nu primește nimic:
//        -Body '{"force": true, "dry_run": true, "email_proba": "office@ltfbstudio.ro"}'
//      Dacă lotul e gol, adaugă `"cu_azi": true` (include și conturile de azi),
//      sau `"de_la_zile": 30` (pornește lotul de acum 30 de zile, doar la probă).
//
//   3. Prima trimitere reală, prudentă (doar primul om din lot):
//        -Body '{"force": true, "limita": 1}'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ── Reglaje ────────────────────────────────────────────────────────────────

// ⚠️ DATA DE PORNIRE: doar conturile făcute de atunci încolo primesc emailul
// (decizia din 4 nov.: „doar conturile noi, de la pornire încolo”). Cine și-a
// făcut cont înainte nu primește nimic, nici dacă își completează profilul
// mai târziu.
// 1 noiembrie, nu ziua deploy-ului (decizia lui Lucian, 4 nov.): așa îi prinde
// și pe cei 5 veniți între 1 și 3 noiembrie, la prima rulare.
const DATA_PORNIRE = '2026-11-01T00:00:00+02:00'

// Fereastra de trimitere, la București.
const ORA_TRIMITERII = 10
const ORA_ULTIMEI_INCERCARI = 12

// Expeditorul și răspunsurile. Aceleași ca la newsletterul din 31 oct.
const FROM = 'Lucian Luță de la ApartamenTUal <apartamentual@ltfbstudio.ro>'
const REPLY_TO = 'apartamentual@ltfbstudio.ro'

const SUBIECT = 'Ce urmează după ce ți-ai făcut cont'

// Linkurile. `utm_*` ca Plausible să arate câte vizite vin din email.
const SITE = 'https://apartamentual.ro'
const UTM = 'utm_source=email&utm_campaign=bun-venit'
const LINK_GRUPURI = `${SITE}/grupuri.html?${UTM}`
const LINK_UTILIZATORI = `${SITE}/utilizatori.html?${UTM}`

// Pseudonime la care nu dăm bună ziua pe nume (porecle). Aceeași listă ca în
// campaniile locale; comparația se face cu litere mici.
const SALUT_FARA_NUME = ['deatharrow', 'vultur', 'alint']

// Câte zone se scriu în paranteză. Peste atât: primele 3 + „și încă N”.
const MAX_ZONE_SCRISE = 4

// Plafon de siguranță pe rulare. În mod normal sunt 0-3 conturi pe zi; un lot
// de 30 ar însemna că s-a întâmplat ceva neobișnuit (o reclamă, o greșeală la
// DATA_PORNIRE). Restul pleacă la rularea de la ora următoare.
const MAX_PER_RULARE = 30
const PAUZA_INTRE_EMAILURI_MS = 600   // Resend acceptă 2 pe secundă
const MAX_INCERCARI_RESEND = 4

// ── Ajutoare ───────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function oraLaBucuresti(d: Date): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(d)
  return Number(s)
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Textul ─────────────────────────────────────────────────────────────────

/** „cristian” → „Cristian”. Numele scrise deja cu majusculă rămân neatinse. */
function numeAfisat(nume: string): string {
  const n = (nume || '').trim()
  if (!n) return ''
  if (n === n.toLowerCase()) return n.charAt(0).toUpperCase() + n.slice(1)
  return n
}

function salut(nume: string): string {
  const n = numeAfisat(nume)
  if (!n || SALUT_FARA_NUME.includes(n.toLowerCase())) return 'Bună,'
  return `Bună, ${n},`
}

/** ['Titan', 'Dristor', 'Vitan'] → „Dristor, Titan și Vitan”. */
function listaZone(zone: string[]): string {
  const z = (zone || []).filter(Boolean)
  if (z.length === 0) return ''
  if (z.length === 1) return z[0]
  if (z.length <= MAX_ZONE_SCRISE) {
    return `${z.slice(0, -1).join(', ')} și ${z[z.length - 1]}`
  }
  const rest = z.length - 3
  return `${z.slice(0, 3).join(', ')} și încă ${rest === 1 ? 'o zonă' : `${rest} zone`}`
}

/** Acordul cu numeralul: 1 om / 5 oameni / 25 de oameni. */
function oameni(n: number): string {
  if (n === 1) return '1 om înscris'
  if (n % 100 >= 1 && n % 100 <= 19) return `${n} oameni înscriși`
  return `${n} de oameni înscriși`
}

function grupuri(g: number): string {
  if (g === 1) return '1 grup care se formează'
  if (g % 100 >= 1 && g % 100 <= 19) return `${g} grupuri care se formează`
  return `${g} de grupuri care se formează`
}

type Om = {
  user_id: string
  email: string
  nume: string
  creat_la: string
  zone: string[] | null
  nr_oameni: number
  nr_grupuri: number
}

type Varianta = 'A' | 'B' | 'B0'

function varianta(om: Om): Varianta {
  if ((om.nr_grupuri ?? 0) > 0) return 'A'
  if ((om.nr_oameni ?? 0) > 0) return 'B'
  return 'B0'
}

/**
 * Emailul ca structură de date. Din ea ies ȘI varianta HTML, ȘI cea text, ca
 * să nu spună niciodată lucruri diferite.
 *
 * ⚠️ Fără liniuță lungă în tot ce citește omul (regula din CLAUDE.md).
 * ⚠️ Fără procente de economie. Textul de mai jos nu are niciunul.
 * ⚠️ Nu pune apostrofuri inverse în textele de mai jos: sunt în template
 *    string-uri și l-ar închide la mijloc. Se prinde cu `deno check`.
 */
function continut(om: Om) {
  const v = varianta(om)
  const zone = listaZone(om.zone ?? [])
  const N = om.nr_oameni ?? 0
  const G = om.nr_grupuri ?? 0

  let paragrafVarianta: string[]
  let buton: { text: string; href: string }

  if (v === 'A') {
    // Textul aprobat: „sunt acum {N} oameni înscriși și {G} grupuri care se
    // formează”. Dacă nu e nimeni altcineva înscris (grupul e al cuiva cu alte
    // zone principale), partea cu oamenii cade, ca să nu scriem „0 oameni”.
    const cifre = N > 0
      ? `sunt acum ${oameni(N)} și ${grupuri(G)}`
      : `${G === 1 ? 'este' : 'sunt'} acum ${grupuri(G)}`
    paragrafVarianta = [
      `În zonele pe care le-ai ales (${zone}) ${cifre}. Cel mai bun pas următor e să te uiți la ${G === 1 ? 'el' : 'ele'}.`,
    ]
    buton = { text: 'Vezi grupurile din zonele tale', href: LINK_GRUPURI }
  } else if (v === 'B') {
    // La un singur om, „profilurile celor... invită-i” devine singular.
    const invitatie = N === 1
      ? 'Vizitează profilul celui care are aceleași zone preferate ca tine și invită-l în grupul creat de tine.'
      : 'Vizitează profilurile celor care au aceleași zone preferate ca tine și invită-i în grupul creat de tine.'
    paragrafVarianta = [
      `În zonele pe care le-ai ales (${zone}) ${N === 1 ? 'este' : 'sunt'} acum ${oameni(N)}, dar încă niciun grup. ` +
      'Un grup începe cu cineva care îl creează și îi invită pe ceilalți. ' +
      invitatie +
      ' Apoi veți putea vorbi pe WhatsApp și veți căuta împreună terenuri.',
    ]
    buton = { text: 'Vezi cine mai caută în zonele tale', href: LINK_UTILIZATORI }
  } else {
    // [B0] Nimeni altcineva în zonele lui și niciun grup. Cazul nu era în
    // ciorna din 4 nov.; textul l-a propus Claude și l-a aprobat Lucian tot
    // pe 4 nov. Păstrează cât mai mult din varianta B.
    paragrafVarianta = [
      `În zonele pe care le-ai ales (${zone}) încă nu s-a mai înscris nimeni în afară de tine și nu există niciun grup. ` +
      'Un grup începe cu cineva care îl creează și îi invită pe ceilalți. ' +
      'Poți filtra utilizatorii după oraș și zonă, ca să vezi cine caută în zonele apropiate de ale tale, și îi poți invita în grupul creat de tine. ' +
      'Apoi veți putea vorbi pe WhatsApp și veți putea căuta împreună terenuri.',
    ]
    buton = { text: 'Vezi cine mai caută pe platformă', href: LINK_UTILIZATORI }
  }

  return {
    varianta: v,
    salut: salut(om.nume),
    inceput: [
      'Sunt Lucian Luță, arhitect și co-fondator ApartamenTUal. Ți-ai completat profilul și aș vrea să-ți scriu eu un mesaj de bun venit.',
      'Și eu îmi construiesc apartamentul așa. Împreună cu alte câteva familii pe care nu le cunoșteam înainte, facem un bloc în București, pe strada Județului, fără dezvoltator. Nu e un drum scurt: durează câțiva ani și cere implicare (întâlniri, decizii luate împreună, coordonare). În schimb, toți banii noștri rămân în apartamentele noastre și știm unde s-a dus fiecare leu. Și avem apartamentele așa cum ni le dorim.',
      ...paragrafVarianta,
    ],
    buton,
    dupaButon: [
      'În „Spațiul tău” de pe platformă vei găsi primii pași, iar dacă ai vreo dificultate ne poți întreba oricând, gratuit.',
      'Tot acolo găsești și grupul de discuții generale pe WhatsApp.',
      '**Am o singură întrebare: ce te-a adus aici?** Poți răspunde direct la acest email, chiar și cu un rând. Citesc tot ce primesc.',
    ],
    semnatura: ['Mulțumesc,', 'Lucian Luță', 'arhitect, co-fondator ApartamenTUal'],
    subsol: 'Ai primit acest mesaj pentru că ți-ai făcut cont pe ApartamenTUal. Scriu rar, doar când am ceva ce te privește direct. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop”.',
  }
}

/** **text** → <strong>text</strong>, după escapare. */
function bold(s: string): string {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

/**
 * Același șablon ca newsletterul din 31 oct. (`scripts/emailuri-newsletter-
 * 2026-10-31/`): fundal crem, logo text, buton TERRACOTTA (nu negru: pe
 * clienții cu fundal închis, butonul negru se topea în fundal).
 */
function html(om: Om): string {
  const c = continut(om)
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`

  return `
    <div style="font-family:'Mona Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#faf8f3;color:#555555;">
      <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e8e3d8;">
        <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:600;">
          apartamen<span style="color:#c2604a;">TU</span>al
        </h1>
        <p style="margin:4px 0 0;font-size:12px;color:#8a8a8a;">by LTFB studio</p>
      </div>
      <div style="padding:32px 8px;">
        ${p(c.salut)}
        ${c.inceput.map(p).join('')}
        <div style="text-align:center;margin:28px 0 32px;">
          <a href="${esc(c.buton.href)}" style="display:inline-block;background:#c2604a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;border:1px solid #a54c38;font-weight:700;font-size:16px;">
            ${esc(c.buton.text)}
          </a>
        </div>
        ${c.dupaButon.map(p).join('')}
        <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
          ${c.semnatura.map(esc).join('<br>')}
        </p>
      </div>
      <div style="border-top:1px solid #e8e3d8;padding:20px 8px 0;">
        <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#8a8a8a;">${esc(c.subsol)}</p>
        <p style="margin:0;font-size:13px;color:#8a8a8a;text-align:center;">
          <a href="${SITE}" style="color:#c2604a;text-decoration:none;">apartamentual.ro</a>
        </p>
      </div>
    </div>`
}

function text(om: Om): string {
  const c = continut(om)
  const fara = (s: string) => s.replace(/\*\*/g, '')
  const linii: string[] = [c.salut, '']
  c.inceput.forEach((x) => linii.push(fara(x), ''))
  // În varianta text linkul se scrie întreg, pe rândul lui.
  linii.push(`${c.buton.text}: ${c.buton.href}`, '')
  c.dupaButon.forEach((x) => linii.push(fara(x), ''))
  linii.push(...c.semnatura)
  linii.push('', '---', c.subsol)
  return linii.join('\n')
}

// ── Trimiterea (Resend), cu reîncercare la 429 / 5xx ───────────────────────

async function trimiteResend(
  apiKey: string,
  catre: string,
  subiect: string,
  om: Om,
): Promise<{ ok: boolean; id?: string; eroare?: string }> {
  let ultimaEroare = 'necunoscută'
  for (let incercare = 1; incercare <= MAX_INCERCARI_RESEND; incercare++) {
    let resp: Response
    try {
      resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [catre],
          reply_to: REPLY_TO,
          subject: subiect,
          html: html(om),
          text: text(om),
          headers: { 'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=stop>` },
        }),
      })
    } catch (e) {
      ultimaEroare = `rețea: ${e instanceof Error ? e.message : String(e)}`
      await sleep(400 * 2 ** (incercare - 1) + Math.random() * 300)
      continue
    }

    const corp = await resp.text()
    if (resp.ok) {
      let id: string | undefined
      try { id = JSON.parse(corp).id } catch { /* 2xx fără JSON: tot reușită */ }
      return { ok: true, id }
    }

    ultimaEroare = `HTTP ${resp.status}: ${corp.slice(0, 300)}`
    const reincercabil = resp.status === 429 || resp.status >= 500
    if (!reincercabil || incercare === MAX_INCERCARI_RESEND) break

    const retryAfter = parseFloat(resp.headers.get('retry-after') || '0')
    await sleep(retryAfter > 0 ? retryAfter * 1000 : 400 * 2 ** (incercare - 1) + Math.random() * 300)
  }
  return { ok: false, eroare: ultimaEroare }
}

// ── Funcția ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── 1. Poarta ────────────────────────────────────────────────────────────
  const secretAsteptat = Deno.env.get('CRON_SECRET')
  if (!secretAsteptat) {
    console.error('CRON_SECRET nu e configurat, funcția refuză tot.')
    return json({ error: 'CRON_SECRET neconfigurat pe server' }, 500)
  }
  if (req.headers.get('x-cron-secret') !== secretAsteptat) {
    return json({ error: 'nepermis' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'lipsesc SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500)
  }

  const antete = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  try {
    const corp = await req.json().catch(() => ({}))
    const fortat = corp?.force === true
    const doarProba = corp?.dry_run === true

    // Adresa la care pleacă emailurile de probă. Merge NUMAI cu `dry_run`,
    // altfel ar fi o cale de a trimite emailuri reale fără urmă în jurnal.
    const emailProba = doarProba && typeof corp?.email_proba === 'string' && corp.email_proba.includes('@')
      ? corp.email_proba.trim()
      : null

    const limita = Number.isInteger(corp?.limita) && corp.limita > 0 ? corp.limita : null

    const acum = new Date()
    const ora = oraLaBucuresti(acum)

    // ── 2. E ora potrivită? ─────────────────────────────────────────────────
    if (!fortat && (ora < ORA_TRIMITERII || ora > ORA_ULTIMEI_INCERCARI)) {
      return json({
        sarit: true,
        motiv: `la București e ora ${ora}; emailul de bun venit pleacă între ${ORA_TRIMITERII} și ${ORA_ULTIMEI_INCERCARI}`,
      })
    }

    // ── 3. Lotul ────────────────────────────────────────────────────────────
    // Două lărgiri, DOAR la probă (dry_run), ca să ai pe cine vedea înainte să
    // existe conturi noi: `cu_azi` include și conturile făcute azi,
    // `de_la_zile` mută data de pornire în urmă. La trimiterea reală nu se
    // citesc niciodată: data de pornire rămâne DATA_PORNIRE.
    const deLaZile = doarProba && Number.isFinite(Number(corp?.de_la_zile))
      ? Math.min(Math.max(Math.round(Number(corp.de_la_zile)), 1), 60)
      : null
    const deLa = deLaZile
      ? new Date(acum.getTime() - deLaZile * 24 * 3600 * 1000).toISOString()
      : new Date(DATA_PORNIRE).toISOString()

    const parametri: Record<string, string> = { p_de_la: deLa }
    if (doarProba && corp?.cu_azi === true) parametri.p_inainte_de = acum.toISOString()

    const resLot = await fetch(`${supabaseUrl}/rest/v1/rpc/lot_bun_venit`, {
      method: 'POST',
      headers: antete,
      body: JSON.stringify(parametri),
    })
    if (!resLot.ok) {
      throw new Error(`lot_bun_venit a răspuns ${resLot.status}: ${await resLot.text()}`)
    }
    const lot: Om[] = await resLot.json()

    if (lot.length === 0) {
      // Zilele fără conturi noi sunt tăcute, și pe Slack.
      return json({ ora_bucuresti: ora, proba: doarProba, in_lot: 0, trimise: 0 })
    }

    if (!doarProba && !resendKey) {
      return json({ error: 'lipsește RESEND_API_KEY' }, 500)
    }

    // ── 4. Proba: nimic către oameni, cel mult un email per variantă la tine ─
    if (doarProba) {
      const rezultate: any[] = []
      const varianteTrimise = new Set<Varianta>()

      for (const om of lot) {
        const v = varianta(om)
        const rand: any = {
          nume: om.nume,
          email: om.email,
          creat_la: om.creat_la,
          zone: om.zone,
          nr_oameni: om.nr_oameni,
          nr_grupuri: om.nr_grupuri,
          varianta: v,
          paragraf: continut(om).inceput[2],
        }

        if (emailProba && resendKey && !varianteTrimise.has(v)) {
          varianteTrimise.add(v)
          const r = await trimiteResend(resendKey, emailProba, `[TEST ${v}] ${SUBIECT}`, om)
          rand.email_proba = r.ok ? `trimis la ${emailProba}` : `eșuat: ${r.eroare}`
          await sleep(PAUZA_INTRE_EMAILURI_MS)
        }
        rezultate.push(rand)
      }

      return json({
        ora_bucuresti: ora,
        proba: true,
        data_pornire: deLa,
        in_lot: lot.length,
        variante: {
          A: rezultate.filter((r) => r.varianta === 'A').length,
          B: rezultate.filter((r) => r.varianta === 'B').length,
          B0: rezultate.filter((r) => r.varianta === 'B0').length,
        },
        rezultate,
      })
    }

    // ── 5. Trimiterea reală ─────────────────────────────────────────────────
    const cati = Math.min(limita ?? MAX_PER_RULARE, MAX_PER_RULARE)
    const deProcesat = lot.slice(0, cati)
    const ramasi = lot.length - deProcesat.length
    const rezultate: any[] = []

    for (const om of deProcesat) {
      const v = varianta(om)
      const r = await trimiteResend(resendKey!, om.email, SUBIECT, om)

      if (!r.ok) {
        // Fără rând de jurnal: omul rămâne în lot și se reîncearcă la rularea
        // de la ora următoare (sau mâine).
        console.error(`Resend a refuzat ${om.email}: ${r.eroare}`)
        rezultate.push({ nume: om.nume, varianta: v, eroare: r.eroare })
        await sleep(PAUZA_INTRE_EMAILURI_MS)
        continue
      }

      // Jurnalul, abia după trimiterea reușită.
      const resJurnal = await fetch(`${supabaseUrl}/rest/v1/bun_venit_log`, {
        method: 'POST',
        headers: { ...antete, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: om.user_id,
          varianta: v,
          nr_oameni: om.nr_oameni ?? 0,
          nr_grupuri: om.nr_grupuri ?? 0,
          resend_id: r.id ?? null,
        }),
      })

      if (!resJurnal.ok) {
        // Emailul a plecat deja. Fără rândul ăsta, omul l-ar primi din nou la
        // rularea următoare, deci semnalăm zgomotos (și pe Slack).
        console.error(`Jurnal neînregistrat pentru ${om.email}: ${await resJurnal.text()}`)
        rezultate.push({ nume: om.nume, varianta: v, trimis: true, avertisment: 'JURNAL NEÎNREGISTRAT' })
      } else {
        rezultate.push({ nume: om.nume, varianta: v, trimis: true })
      }

      await sleep(PAUZA_INTRE_EMAILURI_MS)
    }

    const raspuns = {
      ora_bucuresti: ora,
      proba: false,
      in_lot: lot.length,
      ramasi,
      trimise: rezultate.filter((r) => r.trimis).length,
      erori: rezultate.filter((r) => r.eroare).length,
      rezultate,
    }

    await anuntaSlack(rezumatSlack(raspuns, rezultate))
    return json(raspuns)

  } catch (err) {
    console.error('email-bun-venit a eșuat:', err)
    await anuntaSlack(`🚨 *Email de bun venit*: rularea a eșuat (${err instanceof Error ? err.message : String(err)}).`)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// ── Slack: un mesaj pe rulare, doar când s-a întâmplat ceva ────────────────

function rezumatSlack(raspuns: any, rezultate: any[]): string {
  const linii: string[] = []
  const trimisi = rezultate.filter((r) => r.trimis)

  if (trimisi.length > 0) {
    // Pseudonimele și varianta, ca să știe Lucian cui i-a scris când vine
    // un răspuns. Fără adrese de email pe Slack.
    const cine = trimisi.map((r) => `${r.nume} (${r.varianta})`).join(', ')
    linii.push(`👋 *Email de bun venit*: ${trimisi.length} trimise. ${cine}`)
  }
  if (raspuns.erori > 0) {
    linii.push(`⚠️ ${raspuns.erori} eșecuri la Resend (se reîncearcă la rularea următoare).`)
  }
  if (raspuns.ramasi > 0) {
    linii.push(`⏳ Au mai rămas ${raspuns.ramasi} (plafon de ${MAX_PER_RULARE} pe rulare). Pleacă la ora următoare.`)
  }
  const faraJurnal = rezultate.filter((r) => r.avertisment).length
  if (faraJurnal > 0) {
    linii.push(`🚨 ${faraJurnal} emailuri trimise FĂRĂ rând în \`bun_venit_log\`: risc de repetare.`)
  }
  return linii.join('\n')
}

async function anuntaSlack(textMesaj: string): Promise<void> {
  if (!textMesaj) return
  const webhook = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textMesaj }),
    })
  } catch (err) {
    console.error('Anunțul pe Slack a eșuat:', err)
  }
}

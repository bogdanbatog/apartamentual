// Edge Function: digest-anunturi-grup
// ═══════════════════════════════════════════════════════════════════════════
//
// CE FACE
// Seara, la ora 19:00 ora României, trimite membrilor fiecărui grup un email
// scurt: câte anunțuri s-au scris de la ultimul digest încoace și primele
// cuvinte din ultimul. Fără textul integral — emailul spune „merită să intri",
// nu ține loc de intrat.
//
// Dacă într-un grup nu s-a scris nimic, nu pleacă niciun email pentru el.
//
// CUM E PORNITĂ
// `pg_cron` o cheamă DIN ORĂ ÎN ORĂ, iar funcția verifică ea dacă la București
// e ora 19. Pare ocolit, dar e singura variantă care nu se strică singură:
// pg_cron rulează în UTC, iar România schimbă ora de două ori pe an. O sarcină
// programată la 16:00 UTC (= 19:00 la noi acum, în august) ar începe să trimită
// la 18:00 după ultima duminică din octombrie, fără să crape nimic și fără să
// observe cineva luni de zile.
//
// POARTA DE INTRARE
// Funcția se deployează cu `--no-verify-jwt`, deci adresa ei e publică. Singura
// poartă e antetul `x-cron-secret`, comparat cu variabila de mediu CRON_SECRET.
// Verificarea eșuează ÎNCHIS: dacă secretul nu e configurat pe server, funcția
// refuză tot, în loc să lase trecerea liberă.
//
// FEREASTRA DE TIMP
// Nu folosim „ziua calendaristică". Motivul: o comparație de tipul
// `created_at >= '2026-08-04'` se face în UTC și pierde tăcut mesajele scrise
// între miezul nopții și 3 dimineața, ora României. Folosim în schimb
// „de la ultima trimitere pentru grupul ăsta încoace" (sau ultimele 24 de ore,
// dacă e primul digest). Efect secundar bun: dacă o seară eșuează, mesajele
// nu se pierd — intră în digestul de a doua zi.
//
// DEPLOY
//   npx supabase functions deploy digest-anunturi-grup --no-verify-jwt
//
// PROBĂ MANUALĂ (fără să aștepți ora 19):
//   curl -X POST https://<proiect>.supabase.co/functions/v1/digest-anunturi-grup \
//        -H "x-cron-secret: <secretul>" \
//        -H "Content-Type: application/json" \
//        -d '{"force": true, "dry_run": true}'
//   `dry_run` calculează tot și îți arată ce AR trimite, fără să trimită.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ── Reglaje ────────────────────────────────────────────────────────────────

// Ora (la București) la care pleacă digestul.
const ORA_TRIMITERII = 19

// Fereastra folosită la primul digest al unui grup, când n-avem trimitere
// anterioară de la care să pornim.
const FEREASTRA_INITIALA_ORE = 24

// Plasa de siguranță: chiar dacă ultima trimitere a fost acum două săptămâni
// (funcția a stat picată), nu adunăm mai mult de atât într-un singur email.
const FEREASTRA_MAXIMA_ZILE = 7

// A doua execuție în aceeași seară nu mai trimite nimic.
const PRAG_ANTI_DUBLARE_ORE = 12

// Câte caractere din ultimul anunț intră în email.
const LUNGIME_PREVIEW = 90

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Ajutoare ───────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Ora locală la București, 0–23. `hourCycle: 'h23'` e important: fără el,
// miezul nopții poate ieși „24" în unele localizări, iar comparația cu 19
// ar deveni loterie la schimbarea orei.
function oraLaBucuresti(d: Date): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(d)
  return Number(s)
}

// Primele cuvinte dintr-un anunț, tăiate la cuvânt întreg, nu la jumătate de
// literă. Dacă tăietura ar cădea prea devreme (un cuvânt foarte lung), tăiem
// brutal — mai bine ciuntit decât gol.
function primeleCuvinte(text: string, maxim = LUNGIME_PREVIEW): string {
  const curat = String(text || '').replace(/\s+/g, ' ').trim()
  if (curat.length <= maxim) return curat
  const taiat = curat.slice(0, maxim)
  const ultimulSpatiu = taiat.lastIndexOf(' ')
  const bucata = ultimulSpatiu > maxim * 0.6 ? taiat.slice(0, ultimulSpatiu) : taiat
  return bucata + '…'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // ── 1. Poarta ────────────────────────────────────────────────────────────
  const secretAsteptat = Deno.env.get('CRON_SECRET')
  if (!secretAsteptat) {
    console.error('CRON_SECRET nu e configurat — funcția refuză tot.')
    return json({ error: 'CRON_SECRET neconfigurat pe server' }, 500)
  }
  if (req.headers.get('x-cron-secret') !== secretAsteptat) {
    return json({ error: 'nepermis' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'lipsesc SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY' }, 500)
  }

  const antete = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  async function citeste(caleSiFiltre: string): Promise<any[]> {
    const res = await fetch(`${supabaseUrl}/rest/v1/${caleSiFiltre}`, { headers: antete })
    if (!res.ok) {
      throw new Error(`REST ${caleSiFiltre.split('?')[0]} a răspuns ${res.status}: ${await res.text()}`)
    }
    return await res.json()
  }

  try {
    const corp = await req.json().catch(() => ({}))
    const fortat = corp?.force === true
    const doarProba = corp?.dry_run === true
    const doarGrupul = typeof corp?.grup_id === 'string' && UUID_RE.test(corp.grup_id)
      ? corp.grup_id
      : null

    const acum = new Date()
    const ora = oraLaBucuresti(acum)

    // ── 2. E ora potrivită? ────────────────────────────────────────────────
    if (!fortat && ora !== ORA_TRIMITERII) {
      return json({
        sarit: true,
        motiv: `la București e ora ${ora}; digestul pleacă la ${ORA_TRIMITERII}`,
      })
    }

    // ── 3. Anunțurile din perioada acoperită ───────────────────────────────
    // Luăm dintr-un foc tot ce s-a scris în ultimele FEREASTRA_MAXIMA_ZILE
    // zile, apoi tăiem per grup după fereastra lui. E o tabelă mică.
    const limitaMaxima = new Date(acum.getTime() - FEREASTRA_MAXIMA_ZILE * 24 * 3600 * 1000)

    const anunturi = await citeste(
      `grup_anunturi?select=id,grup_id,user_id,content,created_at` +
      `&created_at=gte.${limitaMaxima.toISOString()}` +
      `&order=created_at.asc`
    )

    if (anunturi.length === 0) {
      return json({ trimise: 0, motiv: 'niciun anunț în perioada acoperită' })
    }

    // ── 4. Ultima trimitere per grup ───────────────────────────────────────
    const idGrupuri = [...new Set(anunturi.map((a: any) => a.grup_id).filter(Boolean))]
      .filter((id: string) => UUID_RE.test(id))
      .filter((id: string) => !doarGrupul || id === doarGrupul)

    if (idGrupuri.length === 0) {
      return json({ trimise: 0, motiv: 'niciun grup de procesat' })
    }

    const jurnal = await citeste(
      `grup_anunturi_digest_log?select=grup_id,trimis_la` +
      `&grup_id=in.(${idGrupuri.join(',')})` +
      `&order=trimis_la.desc`
    )
    const ultimaTrimitere = new Map<string, string>()
    for (const rand of jurnal) {
      // Sortat descrescător, deci primul rând văzut per grup e cel mai recent.
      if (!ultimaTrimitere.has(rand.grup_id)) ultimaTrimitere.set(rand.grup_id, rand.trimis_la)
    }

    // ── 5. Membri, grupuri, profiluri ──────────────────────────────────────
    const grupuri = await citeste(
      `grupuri?select=id,nume&id=in.(${idGrupuri.join(',')})`
    )
    const numeGrup = new Map<string, string>(grupuri.map((g: any) => [g.id, g.nume]))

    const membri = await citeste(
      `grup_membri?select=grup_id,user_id&status=eq.activ&grup_id=in.(${idGrupuri.join(',')})`
    )

    const idUtilizatori = [...new Set([
      ...membri.map((m: any) => m.user_id),
      ...anunturi.map((a: any) => a.user_id),
    ].filter((id: any) => typeof id === 'string' && UUID_RE.test(id)))]

    const profiluri = idUtilizatori.length > 0
      ? await citeste(
          `profiles?select=user_id,pseudonym,account_status,is_demo,email_anunturi_grup` +
          `&user_id=in.(${idUtilizatori.join(',')})`
        )
      : []
    const profilDupaId = new Map<string, any>(profiluri.map((p: any) => [p.user_id, p]))

    // ── 6. Câte un email per grup ──────────────────────────────────────────
    const rezultate: any[] = []

    for (const grupId of idGrupuri) {
      const ultima = ultimaTrimitere.get(grupId)

      // 6a. Anti-dublare: am trimis deja în seara asta?
      if (ultima && !doarProba) {
        const oreDeAtunci = (acum.getTime() - new Date(ultima).getTime()) / 3600000
        if (oreDeAtunci < PRAG_ANTI_DUBLARE_ORE) {
          rezultate.push({ grup: numeGrup.get(grupId), sarit: 'trimis deja recent' })
          continue
        }
      }

      // 6b. Fereastra grupului: de la ultima trimitere, sau ultimele 24h.
      const inceputImplicit = new Date(acum.getTime() - FEREASTRA_INITIALA_ORE * 3600 * 1000)
      let fereastraDeLa = ultima ? new Date(ultima) : inceputImplicit
      if (fereastraDeLa < limitaMaxima) fereastraDeLa = limitaMaxima

      const aleGrupului = anunturi.filter((a: any) =>
        a.grup_id === grupId && new Date(a.created_at) > fereastraDeLa
      )
      if (aleGrupului.length === 0) {
        rezultate.push({ grup: numeGrup.get(grupId), sarit: 'niciun anunț nou' })
        continue
      }

      // 6c. Cine primește. Trei filtre, în ordine:
      //     - contul nu e șters și nu e un profil-exemplu;
      //     - omul n-a oprit emailul din profil;
      //     - există măcar un anunț scris de ALTCINEVA (nu-ți trimitem email
      //       ca să afli că ai scris tu ceva).
      const autori = new Set(aleGrupului.map((a: any) => a.user_id))

      const destinatari = membri
        .filter((m: any) => m.grup_id === grupId)
        .map((m: any) => m.user_id)
        .filter((uid: string) => {
          const p = profilDupaId.get(uid)
          if (!p) return false
          if (p.account_status === 'deleted') return false
          if (p.is_demo === true) return false
          if (p.email_anunturi_grup === false) return false
          // Are măcar un anunț care nu e al lui?
          return [...autori].some((a) => a !== uid)
        })

      const destinatariUnici = [...new Set(destinatari)]
      if (destinatariUnici.length === 0) {
        rezultate.push({ grup: numeGrup.get(grupId), sarit: 'niciun destinatar eligibil' })
        continue
      }

      // 6d. Conținutul: numărul și primele cuvinte din ULTIMUL anunț.
      const ultimAnunt = aleGrupului[aleGrupului.length - 1]
      const profilAutor = profilDupaId.get(ultimAnunt.user_id)
      const numeAutor = (profilAutor?.pseudonym || '').trim() || 'Un membru'

      const payload = {
        event_type: 'anunturi_digest',
        data: {
          group_id: grupId,
          group_name: numeGrup.get(grupId) || 'grupul tău',
          numar_anunturi: aleGrupului.length,
          autor_ultim: numeAutor,
          preview_ultim: primeleCuvinte(ultimAnunt.content),
          recipient_user_ids: destinatariUnici,
        },
      }

      if (doarProba) {
        rezultate.push({
          grup: numeGrup.get(grupId),
          proba: true,
          fereastra_de_la: fereastraDeLa.toISOString(),
          numar_anunturi: aleGrupului.length,
          destinatari: destinatariUnici.length,
          preview: payload.data.preview_ultim,
        })
        continue
      }

      // 6e. Trimiterea. Refolosim `notify-admins`: acolo stau șablonul de
      //     email, rezolvarea adreselor din user_id și reîncercarea când
      //     Resend ne refuză temporar (429).
      const res = await fetch(`${supabaseUrl}/functions/v1/notify-admins`, {
        method: 'POST',
        headers: antete,
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // NU scriem în jurnal. Fără rând de jurnal, fereastra rămâne deschisă
        // și mesajele intră în digestul de mâine — nu se pierd.
        const text = await res.text()
        console.error(`notify-admins a răspuns ${res.status} pentru grupul ${grupId}: ${text}`)
        rezultate.push({ grup: numeGrup.get(grupId), eroare: `notify-admins ${res.status}` })
        continue
      }

      // 6f. Jurnalul — abia după trimiterea reușită.
      const resJurnal = await fetch(`${supabaseUrl}/rest/v1/grup_anunturi_digest_log`, {
        method: 'POST',
        headers: { ...antete, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          grup_id: grupId,
          fereastra_de_la: fereastraDeLa.toISOString(),
          numar_anunturi: aleGrupului.length,
          numar_destinatari: destinatariUnici.length,
        }),
      })
      if (!resJurnal.ok) {
        // Emailurile au plecat deja. Semnalăm zgomotos: fără rândul ăsta,
        // mâine se poate trimite din nou aceeași fereastră.
        console.error(`Jurnal neînregistrat pentru grupul ${grupId}: ${await resJurnal.text()}`)
      }

      rezultate.push({
        grup: numeGrup.get(grupId),
        trimis: true,
        numar_anunturi: aleGrupului.length,
        destinatari: destinatariUnici.length,
      })
    }

    return json({
      ora_bucuresti: ora,
      proba: doarProba,
      grupuri_procesate: rezultate.length,
      rezultate,
    })

  } catch (err) {
    console.error('digest-anunturi-grup a eșuat:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

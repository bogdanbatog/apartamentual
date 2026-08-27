// Edge Function: digest-terenuri-zone
// ═══════════════════════════════════════════════════════════════════════════
//
// CE FACE
// Luni dimineața, la ora 10:00 ora României, trimite fiecărui om care a bifat
// zone în profil un email cu terenurile noi apărute în zonele lui de la
// ultimul email încoace. Dacă n-a apărut nimic, nu pleacă niciun email —
// săptămânile goale sunt tăcute.
//
// ⚠️ SPRE DEOSEBIRE DE `digest-anunturi-grup`, de la care e copiată structura,
// emailul ăsta e PERSONALIZAT PER OM (zonele lui, terenurile lui, cifrele lui).
// Digestul de anunțuri trimite același text unui grup întreg dintr-un singur
// apel (`recipient_user_ids`); aici e câte un apel la `notify-admins` per
// persoană, secvențial, cu o pauză mică între ele.
//
// CINE DECIDE CE
//   • CINE primește și CE conține  → funcția SQL `lot_terenuri_noi(...)`,
//     probată pe date reale (62 de destinatari, 719 terenuri, 13 august).
//     ⚠️ NU rescrie logica aia aici. Funcția asta doar o cheamă.
//   • CUM ARATĂ emailul → `case 'terenuri_noi_zone'` din `notify-admins`.
//   • CÂND pleacă → funcția asta (ziua + ora, verificate la București).
//
// CUM E PORNITĂ
// `pg_cron` o cheamă DIN ORĂ ÎN ORĂ, iar funcția verifică ea dacă la București
// e luni, ora 10. Motivul e același ca la digestul de anunțuri: pg_cron
// socotește în UTC, iar România schimbă ora de două ori pe an. O sarcină
// programată la ora fixă în UTC ar începe să trimită cu o oră mai devreme după
// ultima duminică din octombrie — tăcut, șase luni pe an.
// 167 din 168 de execuții săptămânale se termină instantaneu cu „nu e ora".
//
// POARTA DE INTRARE
// Se deployează cu `--no-verify-jwt`, deci adresa e publică. Singura poartă e
// antetul `x-cron-secret`, comparat cu variabila de mediu CRON_SECRET.
// Verificarea eșuează ÎNCHIS: fără secret configurat pe server, refuză tot.
//
// FEREASTRA DE TIMP
// Nu e „ultimele 7 zile calendaristice", ci „de la ultima trimitere CĂTRE OMUL
// ĂSTA încoace" — calculată în SQL, din `terenuri_digest_log`. Dacă o luni
// pică trimiterea, terenurile nu se pierd; intră în emailul de săptămâna
// viitoare. Plafonul de siguranță (14 zile) se dă DE AICI, ca podea a
// ferestrei, ca să stea într-un singur loc, nu ascuns în SQL.
//
// SLACK
// `notify-admins` NU postează nimic pentru `terenuri_noi_zone` (e în
// `SKIP_SLACK` acolo) — altfel `#app_events` ar primi ~62 de mesaje într-o
// dimineață. Rezumatul îl trimite funcția asta, o singură dată, la final.
//
// DEPLOY
//   npx supabase functions deploy digest-terenuri-zone --no-verify-jwt
//
// PROBE MANUALE (din `C:\Users\lucia\supabase`, sau de oriunde cu curl):
//
//   1. Ce AR trimite, fără să trimită nimic:
//      curl -X POST https://<proiect>.supabase.co/functions/v1/digest-terenuri-zone \
//           -H "x-cron-secret: <secretul>" -H "Content-Type: application/json" \
//           -d '{"force": true, "dry_run": true}'
//
//   2. Cum ARATĂ emailul (un singur email, cu datele primului om din lot,
//      trimis la adresa ta; jurnalul NU se atinge, nimeni altcineva nu
//      primește nimic):
//      curl ... -d '{"force": true, "dry_run": true, "email_proba": "office@ltfbstudio.ro"}'
//
//   3. Prima trimitere reală, prudentă — doar primii 2 oameni din lot:
//      curl ... -d '{"force": true, "limita": 2}'
//
//   4. Trimiterea reală, tot lotul:
//      curl ... -d '{"force": true}'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

// ── Reglaje ────────────────────────────────────────────────────────────────

// Ziua și ora (la București) la care pleacă digestul. Decizia lui Lucian,
// 13 august: luni 10:00 prinde terenurile apărute în weekend și păstrează
// senzația de „început de săptămână".
const ZIUA_TRIMITERII = 'Mon'
const ZIUA_TRIMITERII_RO = 'luni'
const ORA_TRIMITERII = 10

// Ultima oră la care digestul mai are voie să plece. Fereastra 10:00-13:00
// există ca să se poată drena un lot mai mare decât `MAX_PER_RULARE`: cronul
// bate oricum din oră în oră, deci ce n-a încăput la 10:00 pleacă la 11:00.
//
// ⚠️ În săptămânile obișnuite nu se schimbă nimic: la 10:00 pleacă tot, iar la
// 11:00 lotul e gol și funcția se întoarce tăcută, exact ca înainte. Ora 13
// e o oprire fermă: mai târziu de atât, un email „terenuri noi" trimis în
// mijlocul zilei de luni nu mai seamănă cu începutul de săptămână promis.
const ORA_ULTIMEI_INCERCARI = 13

// Câți oameni procesează o singură rulare. Nu e o limită de timp, ci una de
// invocări: fiecare om înseamnă un apel către `notify-admins`, iar platforma
// refuză rafalele lungi (vezi comentariul de la `cheamaNotifyAdmins`). 30 de
// apeluri la 700 ms distanță înseamnă circa 25 de secunde de rafală, cu marjă
// bună față de pragul la care am fost refuziți pe 27 august (60 de apeluri la
// 300 ms).
//
// ⚠️ Nu ridica cifra fără să ridici și `PAUZA_INTRE_EMAILURI_MS`. Cele două
// împreună dau ritmul, iar ritmul e cel limitat, nu numărul.
const MAX_PER_RULARE = 30

// Podeaua ferestrei. Cine n-a primit niciodată emailul pornește de aici; cine
// a primit pornește de la ultima lui trimitere. Nimeni nu primește vreodată
// terenuri mai vechi de atât, nici dacă funcția stă picată o lună.
const FEREASTRA_MAXIMA_ZILE = 14

// Peste atâtea zone bifate în profil, omul nu primește emailul: la 30+ zone
// orice teren nou se potrivește, deci emailul n-ar mai fi un semnal.
// ⚠️ E despre ZONE bifate, nu despre terenuri. Pragul 20 taie exact 2 oameni
// din 70 (măsurat 12 august) — ceilalți 68 au cel mult 19 zone.
const PRAG_ZONE = 20

// Plafon de SIGURANȚĂ pe câte terenuri intră într-un email, nu unul editorial:
// câte apar ca dreptunghiuri cu poză și câte ca linii scurte decide șablonul
// din `notify-admins` (`CATE_CU_POZA`). Cel mai încărcat om avea 27 (13 aug).
const MAX_TERENURI = 40

// Dacă omului i-a plecat emailul acum mai puțin de atât, îl sărim. E o plasă
// în plus: în mod normal funcția SQL îl scoate singură din lot, fiindcă
// fereastra lui începe de la ultima trimitere și nu mai are terenuri noi.
const PRAG_ANTI_DUBLARE_ORE = 20

// Pauza dintre două apeluri la `notify-admins`. Are acum DOUĂ motive, nu unul:
//
//   1. Resend refuză cu 429 rafalele (s-au pierdut 18 emailuri într-un minut
//      pe 26 iulie). `notify-admins` are reîncercare cu componentă aleatoare,
//      dar e mai ieftin să nu ajungem acolo.
//   2. ⚠️ Supabase limitează și cât de des poate o funcție să cheme altă
//      funcție. Pe 27 august, la 300 ms, al 61-lea apel a fost refuzat și a
//      oprit toată rularea. Urcată la 700 ms, împreună cu `MAX_PER_RULARE`.
const PAUZA_INTRE_EMAILURI_MS = 700

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// ⚠️ DE CE EXISTĂ FUNCȚIA ASTA (27 august 2026, dintr-o pățanie reală).
//
// Supabase limitează cât de des poate o edge function să cheme altă edge
// function. La trimiterea de recuperare din 27 august, cu 66 de oameni în lot
// și 300 ms între apeluri, al 61-lea `fetch` către `notify-admins` a fost
// refuzat de platformă, NU de `notify-admins`:
//
//     RateLimitError: Rate limit exceeded for function. Retry after 1562ms.
//
// ⚠️ Refuzul ăsta nu vine ca un răspuns cu status urât, pe care să-l poți citi
// din `res.status`. `fetch` ARUNCĂ. Iar apelul fiind un `await fetch` gol,
// eroarea a urcat până la `catch`-ul de sus și a oprit toată rularea: ultimii
// 4 oameni n-au primit nimic, jurnalul lor a rămas gol (bine) și rezumatul de
// pe Slack n-a mai plecat (rău, fiindcă eșecul a fost invizibil).
//
// Aici e reparația: apelul se reîncearcă, respectând `retryAfterMs` cerut de
// platformă, iar dacă tot nu merge întoarce `null` în loc să arunce. Un om
// pierdut nu mai înseamnă un lot pierdut.
const REINCERCARI_LA_REFUZ = 3
const MARJA_PESTE_RETRY_MS = 250

async function cheamaNotifyAdmins(
  supabaseUrl: string,
  antete: Record<string, string>,
  payload: unknown,
): Promise<Response | null> {
  for (let incercare = 1; incercare <= REINCERCARI_LA_REFUZ; incercare++) {
    try {
      return await fetch(`${supabaseUrl}/functions/v1/notify-admins`, {
        method: 'POST',
        headers: antete,
        body: JSON.stringify(payload),
      })
    } catch (err) {
      // `retryAfterMs` vine chiar din eroarea platformei. Când lipsește (altă
      // eroare de rețea), urcăm noi: 2s, 4s, 6s.
      const cerut = Number((err as any)?.retryAfterMs)
      const asteptare = Number.isFinite(cerut) && cerut > 0
        ? cerut + MARJA_PESTE_RETRY_MS
        : incercare * 2000

      if (incercare === REINCERCARI_LA_REFUZ) {
        console.error(`Apelul la notify-admins a eșuat de ${REINCERCARI_LA_REFUZ} ori:`, err)
        return null
      }

      console.warn(`Apel refuzat (încercarea ${incercare}), reiau peste ${asteptare} ms:`, err)
      await sleep(asteptare)
    }
  }
  return null
}

// Ora locală la București, 0–23. `hourCycle: 'h23'` e important: fără el,
// miezul nopții poate ieși „24" în unele localizări, iar comparația ar deveni
// loterie exact la schimbarea orei.
function oraLaBucuresti(d: Date): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(d)
  return Number(s)
}

// Ziua săptămânii la București, ca 'Mon'…'Sun'. Se ia din același fus ca ora:
// la 00:30 luni în România e încă duminică în UTC, deci o verificare pe
// `getUTCDay()` ar sări trimiterea o dată pe an, la schimbarea orei.
function ziLaBucuresti(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Bucharest',
    weekday: 'short',
  }).format(d)
}

// Normalizarea folosită la potrivirea teren ↔ zonă, IDENTICĂ cu cea din SQL
// (`lower(btrim(...))`). Se folosește doar la numărătoarea terenurilor care
// n-au putut fi legate de nicio zonă — potrivirea reală se face în SQL.
function normalizeaza(s: unknown): string {
  return String(s ?? '').trim().toLowerCase()
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

    // Adresa la care se trimite UN email de probă, cu datele primului om din
    // lot. Merge numai împreună cu `dry_run` — altfel ar fi o cale de a
    // trimite emailuri reale fără urmă în jurnal.
    const emailProba = doarProba && typeof corp?.email_proba === 'string' && corp.email_proba.includes('@')
      ? corp.email_proba.trim()
      : null

    // Plafon prudent pentru primele rulări reale: procesează doar primii N
    // oameni din lot (lotul vine ordonat descrescător după câte terenuri are
    // fiecare, deci N=2 înseamnă cei mai încărcați doi).
    const limita = Number.isInteger(corp?.limita) && corp.limita > 0 ? corp.limita : null

    const acum = new Date()
    const ora = oraLaBucuresti(acum)
    const zi = ziLaBucuresti(acum)

    // ── 2. E ziua și ora potrivită? ────────────────────────────────────────
    // ⚠️ E o FEREASTRĂ, nu o oră fixă (schimbat 27 august). Rularea de la 10:00
    // trimite tot ce încape în `MAX_PER_RULARE`; dacă a rămas lume, cronul o
    // cheamă din nou la 11:00 și la 12:00, iar restul pleacă atunci. Când n-a
    // rămas nimeni, rulările următoare găsesc lotul gol și tac.
    if (!fortat && (zi !== ZIUA_TRIMITERII || ora < ORA_TRIMITERII || ora > ORA_ULTIMEI_INCERCARI)) {
      return json({
        sarit: true,
        motiv: `la București e ${zi}, ora ${ora}; digestul pleacă ${ZIUA_TRIMITERII_RO} între ${ORA_TRIMITERII} și ${ORA_ULTIMEI_INCERCARI}`,
      })
    }

    // ── 3. Lotul: cine primește și ce ──────────────────────────────────────
    // Toată logica (excluderi, prag, fereastră per persoană, acord gramatical,
    // lista de terenuri) stă în SQL și e probată pe date reale. Aici doar
    // chemăm și dăm podeaua ferestrei.
    //
    // ⚠️ Podeaua se poate coborî PUNCTUAL, dintr-o comandă dată de mână, când
    // s-a sărit o trimitere și vrem să recuperăm terenurile rămase în gol
    // (cazul din 27 august: ultima campanie fusese pe 3 august, iar podeaua de
    // 14 zile ar fi lăsat afară tot ce s-a adăugat între 3 și 13 august).
    //
    // Merge NUMAI împreună cu `force`, deci sarcina de cron nu poate lărgi
    // fereastra niciodată: ea trimite corpul fără `force` și cade automat pe
    // constanta de mai sus. Plafon dur la 60 de zile, ca o cifră greșit tastată
    // să nu trimită cuiva un email cu terenuri de anul trecut.
    //
    // De ce parametru și nu constanta schimbată: schimbată, ar fi cerut un al
    // doilea deploy ca să pună lucrurile la loc înainte de prima rulare
    // automată, iar deploy-ul acela e exact genul de pas care se uită.
    const fereastraZile = fortat && Number.isFinite(Number(corp?.fereastra_zile))
      ? Math.min(Math.max(Math.round(Number(corp.fereastra_zile)), 1), 60)
      : FEREASTRA_MAXIMA_ZILE

    const podea = new Date(acum.getTime() - fereastraZile * 24 * 3600 * 1000)

    const resLot = await fetch(`${supabaseUrl}/rest/v1/rpc/lot_terenuri_noi`, {
      method: 'POST',
      headers: antete,
      body: JSON.stringify({
        p_de_la: podea.toISOString(),
        p_prag_zone: PRAG_ZONE,
        p_max_terenuri: MAX_TERENURI,
      }),
    })
    if (!resLot.ok) {
      throw new Error(`lot_terenuri_noi a răspuns ${resLot.status}: ${await resLot.text()}`)
    }
    const lot: any[] = await resLot.json()

    // ── 4. Terenurile care n-au putut fi legate de nicio zonă ──────────────
    // Asta înlocuiește ochiul omenesc de la campania manuală. Potrivirea se
    // face pe TEXT (nu există cheie străină teren → zonă), deci un diacritic
    // schimbat într-un singur loc ar rupe legătura în tăcere și terenul n-ar
    // ajunge la nimeni. Verificat pe 12 august: 46 din 46 se legau corect.
    let terenuriNelegate: Array<{ id: string; titlu: string; oras: string; cartier: string }> = []
    try {
      const terenuriNoi = await citeste(
        `terenuri?select=id,titlu,oras,cartier` +
        `&created_at=gte.${podea.toISOString()}` +
        `&deleted_at=is.null&status=eq.approved`
      )
      if (terenuriNoi.length > 0) {
        const orase = await citeste(`cities?select=id,name`)
        const zone = await citeste(`zones?select=id,name,city_id`)
        const idOras = new Map<string, number>(orase.map((c: any) => [normalizeaza(c.name), c.id]))
        const cheiZone = new Set<string>(zone.map((z: any) => `${z.city_id}|${normalizeaza(z.name)}`))

        terenuriNelegate = terenuriNoi
          .filter((t: any) => {
            const cityId = idOras.get(normalizeaza(t.oras))
            if (cityId === undefined) return true
            return !cheiZone.has(`${cityId}|${normalizeaza(t.cartier)}`)
          })
          .map((t: any) => ({ id: t.id, titlu: t.titlu, oras: t.oras, cartier: t.cartier }))
      }
    } catch (err) {
      // O verificare de igienă n-are voie să oprească trimiterea.
      console.error('Verificarea terenurilor nelegate a eșuat:', err)
    }

    // ── 5. Nimic de trimis? Tăcere. ────────────────────────────────────────
    if (lot.length === 0) {
      const raspuns = {
        zi_bucuresti: zi,
        ora_bucuresti: ora,
        proba: doarProba,
        trimise: 0,
        motiv: 'niciun teren nou în zonele bifate de cineva',
        terenuri_nelegate: terenuriNelegate.length,
      }
      // Săptămânile goale sunt tăcute și pe Slack — cu o singură excepție:
      // dacă există terenuri noi pe care nu le-a putut lega nimeni de nicio
      // zonă, tăcerea ar ascunde exact defecțiunea pe care o urmărim.
      if (!doarProba && terenuriNelegate.length > 0) {
        await anuntaSlack(rezumatSlack(raspuns, [], terenuriNelegate))
      }
      return json(raspuns)
    }

    // ── 6. Câte un email per persoană ──────────────────────────────────────
    const rezultate: any[] = []

    // ⚠️ Plafonul se aplică ȘI peste `limita` cerută de mână, dinadins: o
    // comandă manuală cu `limita: 60` ar reproduce exact refuzul din 27 august.
    // Cine vrea tot lotul dă comanda de două ori; oamenii serviți ies singuri
    // prin jurnal, deci a doua rulare nu poate dubla nimic.
    const cati = Math.min(limita ?? MAX_PER_RULARE, MAX_PER_RULARE)
    const deProcesat = lot.slice(0, cati)
    const ramasi = lot.length - deProcesat.length

    for (const om of deProcesat) {
      const terenuri: any[] = Array.isArray(om.terenuri_lista) ? om.terenuri_lista : []

      // 6a. Anti-dublare. `fereastra_de_la` vine din SQL ca „ultima trimitere
      //     către omul ăsta, dar nu mai devreme de podea". Dacă e foarte
      //     recentă, înseamnă că i-a plecat emailul adineauri.
      if (!doarProba && om.fereastra_de_la) {
        const oreDeAtunci = (acum.getTime() - new Date(om.fereastra_de_la).getTime()) / 3600000
        if (oreDeAtunci < PRAG_ANTI_DUBLARE_ORE) {
          rezultate.push({ nume: om.nume, sarit: 'trimis deja recent' })
          continue
        }
      }

      if (terenuri.length === 0) {
        // N-ar trebui să se întâmple (funcția întoarce doar oameni cu
        // potriviri), dar un email „au apărut terenuri noi" fără niciun teren
        // e mai rău decât niciun email.
        rezultate.push({ nume: om.nume, sarit: 'lista de terenuri goală' })
        continue
      }

      const payload = {
        event_type: 'terenuri_noi_zone',
        data: {
          // ⚠️ Cheia e `recipient_email`, adică destinatar explicit: așa
          //    `notify-admins` trimite EXACT un email, omului potrivit, fără
          //    copie la superadmin (evenimentul nu e în listele de CC).
          recipient_email: om.email,
          // ⚠️ NU `user_id` și nici vreo cheie terminată în `_user_id`:
          //    `hydrateEmailsFromUserIds` ar face o interogare în plus pentru
          //    fiecare om, degeaba — avem deja adresa din lot.
          uid: om.user_id,
          nume: om.nume,
          zona_1: om.zona_1,
          zona_2: om.zona_2,
          zona_3: om.zona_3,
          terenuri_1_text: om.terenuri_1_text,
          total_terenuri: om.total_terenuri,
          total_zone_cu_terenuri: om.total_zone_cu_terenuri,
          terenuri,
        },
      }

      if (doarProba) {
        const randProba: any = {
          nume: om.nume,
          email: om.email,
          proba: true,
          fereastra_de_la: om.fereastra_de_la,
          total_terenuri: om.total_terenuri,
          zone: [om.zona_1, om.zona_2, om.zona_3].filter(Boolean),
          total_zone_cu_terenuri: om.total_zone_cu_terenuri,
          nr_zone_bifate: om.nr_zone_bifate,
          terenuri_in_email: terenuri.length,
          primele_titluri: terenuri.slice(0, 3).map((t: any) => t.titlu),
        }

        // Un singur email de probă, cu datele primului om, la adresa cerută.
        // Jurnalul rămâne neatins, iar omul din lot nu primește nimic.
        if (emailProba && rezultate.length === 0) {
          const res = await cheamaNotifyAdmins(supabaseUrl, antete, {
            ...payload,
            data: { ...payload.data, recipient_email: emailProba },
          })
          randProba.email_proba_trimis = !res
            ? 'eșuat: apel refuzat de platformă (limită de invocări)'
            : res.ok
              ? emailProba
              : `eșuat: ${res.status} ${await res.text()}`
        }

        rezultate.push(randProba)
        continue
      }

      // 6b. Trimiterea. Refolosim `notify-admins`: acolo stau șablonul,
      //     jurnalul de notificări și reîncercarea la 429-urile de la Resend.
      const res = await cheamaNotifyAdmins(supabaseUrl, antete, payload)

      // Apelul n-a ajuns niciodată la `notify-admins`: platforma l-a refuzat de
      // trei ori la rând. Îl tratăm ca pe orice eșec de trimitere, adică fără
      // rând de jurnal, ca să reintre în digestul următor.
      if (!res) {
        rezultate.push({ nume: om.nume, eroare: 'apel refuzat de platformă (limită de invocări)' })
        await sleep(PAUZA_INTRE_EMAILURI_MS)
        continue
      }

      if (!res.ok) {
        // NU scriem în jurnal. Fără rând de jurnal, fereastra omului rămâne
        // deschisă și terenurile intră în emailul de săptămâna viitoare —
        // nu se pierd.
        const text = await res.text()
        console.error(`notify-admins a răspuns ${res.status} pentru ${om.email}: ${text}`)
        rezultate.push({ nume: om.nume, eroare: `notify-admins ${res.status}` })
        await sleep(PAUZA_INTRE_EMAILURI_MS)
        continue
      }

      // 6c. Jurnalul — abia după trimiterea reușită. Din el se calculează
      //     fereastra omului la rularea următoare.
      const resJurnal = await fetch(`${supabaseUrl}/rest/v1/terenuri_digest_log`, {
        method: 'POST',
        headers: { ...antete, 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          user_id: om.user_id,
          fereastra_de_la: om.fereastra_de_la,
          nr_terenuri: om.total_terenuri,
          nr_zone: om.total_zone_cu_terenuri,
        }),
      })
      if (!resJurnal.ok) {
        // Emailul a plecat deja. Semnalăm zgomotos: fără rândul ăsta, la
        // rularea următoare omul ar primi din nou aceleași terenuri.
        console.error(`Jurnal neînregistrat pentru ${om.email}: ${await resJurnal.text()}`)
        rezultate.push({
          nume: om.nume,
          trimis: true,
          total_terenuri: om.total_terenuri,
          avertisment: 'JURNAL NEÎNREGISTRAT — riscă repetarea săptămâna viitoare',
        })
        await sleep(PAUZA_INTRE_EMAILURI_MS)
        continue
      }

      rezultate.push({
        nume: om.nume,
        trimis: true,
        total_terenuri: om.total_terenuri,
        terenuri_in_email: terenuri.length,
      })

      await sleep(PAUZA_INTRE_EMAILURI_MS)
    }

    const raspuns = {
      zi_bucuresti: zi,
      ora_bucuresti: ora,
      proba: doarProba,
      // Câte zile în urmă a mers podeaua la rularea asta. Scris în răspuns
      // dinadins: altfel, dintr-un raport nu se poate deosebi „n-au apărut
      // terenuri mai vechi" de „parametrul n-a fost citit".
      fereastra_zile: fereastraZile,
      in_lot: lot.length,
      procesati: rezultate.length,
      // Câți au rămas nedistribuiți din cauza plafonului. La rulările automate
      // pleacă la ora următoare; la o comandă manuală, dai comanda din nou.
      ramasi,
      trimise: rezultate.filter((r) => r.trimis === true).length,
      erori: rezultate.filter((r) => r.eroare).length,
      terenuri_nelegate: terenuriNelegate.length,
      terenuri_nelegate_detalii: terenuriNelegate.slice(0, 10),
      rezultate,
    }

    // ── 7. Rezumatul pe Slack, o singură dată ──────────────────────────────
    // La `dry_run` nu postăm nimic: proba se citește direct în răspunsul HTTP,
    // iar canalul n-are de ce să afle că ne-am uitat.
    if (!doarProba) {
      await anuntaSlack(rezumatSlack(raspuns, rezultate, terenuriNelegate))
    }

    return json(raspuns)

  } catch (err) {
    console.error('digest-terenuri-zone a eșuat:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// Slack — un singur mesaj per rulare
// ═══════════════════════════════════════════════════════════════════════════

function rezumatSlack(
  raspuns: any,
  rezultate: any[],
  nelegate: Array<{ titlu: string; oras: string; cartier: string }>,
): string {
  const trimise = raspuns.trimise ?? 0
  const linii: string[] = []

  if (trimise === 0) {
    linii.push(`📭 *Digest terenuri* — niciun email (${raspuns.motiv || 'nimic de trimis'}).`)
  } else {
    const totalTerenuri = rezultate
      .filter((r) => r.trimis === true)
      .reduce((s, r) => s + (Number(r.total_terenuri) || 0), 0)
    linii.push(`📬 *Digest terenuri* — ${trimise} emailuri trimise, ${totalTerenuri} potriviri teren×om.`)
  }

  if (raspuns.erori > 0) {
    linii.push(`⚠️ ${raspuns.erori} eșecuri la trimitere (terenurile lor intră în digestul viitor).`)
  }

  // Plafonul de invocări a tăiat lotul. Se scrie pe Slack tocmai ca să nu fie
  // tăcut: pe 27 august, o rulare oprită la jumătate n-a lăsat nicio urmă.
  if ((raspuns.ramasi ?? 0) > 0) {
    linii.push(
      `⏳ Au mai rămas ${raspuns.ramasi} de trimis (plafon de ${raspuns.procesati} pe rulare). ` +
      `Pleacă singuri la rularea de la ora următoare.`
    )
  }

  const faraJurnal = rezultate.filter((r) => r.avertisment).length
  if (faraJurnal > 0) {
    linii.push(`🚨 ${faraJurnal} emailuri trimise FĂRĂ rând de jurnal — risc de repetare.`)
  }

  if (nelegate.length > 0) {
    // Ăsta e motivul principal pentru care există mesajul de pe Slack.
    const exemple = nelegate.slice(0, 5)
      .map((t) => `„${t.titlu}" (${t.oras} / ${t.cartier})`)
      .join(', ')
    linii.push(
      `🚨 *${nelegate.length} terenuri noi nu s-au putut lega de nicio zonă* — nu ajung la nimeni. ` +
      `Verifică scrierea cartierului în \`zones\` și în \`orase-cartiere.js\`: ${exemple}`
    )
  }

  return linii.join('\n')
}

async function anuntaSlack(text: string): Promise<void> {
  const webhook = Deno.env.get('SLACK_WEBHOOK_URL')
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (err) {
    // Slack e informativ. Dacă pică, emailurile au plecat oricum.
    console.error('Anunțul pe Slack a eșuat:', err)
  }
}

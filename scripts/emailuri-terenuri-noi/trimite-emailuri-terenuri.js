#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „au aparut terenuri noi in zonele tale”
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/terenuri-noi/
 * 4-lot-destinatari.sql`) si compune cate un email personalizat pentru fiecare
 * persoana, cu zonele ei in care au aparut terenuri noi.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend.
 *
 * Structura e aceeasi cu `scripts/emailuri-zone/trimite-emailuri-zone.js`
 * (campania din 28 iulie 2026) -- daca ai folosit-o pe aia, comenzile sunt
 * identice, se schimba doar CSV-ul si textul.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile
 *      compuse, ca sa le deschizi in browser si sa le citesti:
 *
 *        node scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js --csv="cale/catre.csv"
 *
 *   2. TEST — trimite 3 emailuri reprezentative DOAR catre tine
 *      (unul cu multe terenuri, unul cu unul singur, unul din mijloc):
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — trimite catre toti cei din CSV. Cere DOUA steaguri,
 *      ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js --csv="cale/catre.csv" --mod=live --confirm-trimit
 *
 * SIGURANTA:
 *   - Cheia API se ia DOAR din variabila de mediu RESEND_API_KEY, niciodata
 *     din linia de comanda si niciodata scrisa in vreun fisier.
 *   - Fiecare trimitere reusita se scrie in `local/trimise-<data>.json`. La o
 *     re-rulare, adresele deja trimise sunt SARITE automat. Nu sterge fisierul
 *     ala daca nu vrei sa trimiti a doua oara acelorasi oameni.
 *   - Pauza de 600 ms intre trimiteri (Resend accepta 2 cereri/secunda) +
 *     reincercare cu asteptare crescatoare la 429 / 5xx.
 *
 * ALTE OPTIUNI:
 *   --subiect=1|2|3     varianta de subiect (vezi SUBIECTE mai jos). Implicit 1.
 *   --test-email=...    unde se trimit probele in modul test.
 *   --limita=N          proceseaza doar primele N randuri (util la testare).
 *   --doar=email1,email2  trimite doar catre adresele astea (din CSV).
 *   --fara=email1,email2  sare peste adresele astea (ex. cine a cerut „stop”).
 *   --iesire=cale       unde se scriu previzualizarile. Implicit `local/`.
 * =============================================================================
 */

const fs = require('fs')
const path = require('path')

// ─────────────────────────────────────────────────────────────────────────────
// Reglaje
// ─────────────────────────────────────────────────────────────────────────────

const FROM = 'ApartamenTUal <apartamentual@ltfbstudio.ro>'
const REPLY_TO = 'apartamentual@ltfbstudio.ro'
const TEST_EMAIL = 'apartamentual@ltfbstudio.ro'
const LINK_TERENURI = 'https://apartamentual.ro/terenuri.html'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Pentru ele emailul incepe simplu cu „Salut,”.
const SALUT_FARA_NUME = []

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ⚠️ AICI se trec cei care au cerut „stop” dupa campania din 28 iulie 2026.
//    Opt-out-ul se noteaza deocamdata manual -- nu exista flag de consimtamant
//    pe `profiles`, doar la newsletter.
// Se pot adauga si la rulare, cu --fara=email1,email2
const EXCLUSI_IMPLICIT = [
  // 'cineva@care.a.cerut', // „stop” la campania din 28 iulie
]

// ─────────────────────────────────────────────────────────────────────────────
// Cine a primit si emailul din 28 iulie („zonele tale au cerere, dar niciun grup”)
// ─────────────────────────────────────────────────────────────────────────────
// Cei care l-au primit atunci deschid emailul cu o fraza de legatura, ca sa nu
// para ca le scriem din senin a doua oara in cateva zile. Ceilalti primesc
// varianta curata, fara referinta la un email pe care nu l-au vazut niciodata.
//
// Lista NU se scrie de mana: se citeste din jurnalul campaniei precedente, deci
// nu are cum sa se desincronizeze de realitate.
//   --precedent=cale.json   alt jurnal
//   --fara-precedent        toata lumea primeste varianta pentru oameni noi
const JURNAL_PRECEDENT = path.join(__dirname, '..', 'emailuri-zone', 'local',
                                   'trimise-2026-07-28.json')

let PRIMIT_IN_IULIE = new Set()

function incarcaPrecedent() {
  if (A['fara-precedent']) return new Set()
  const cale = A.precedent || JURNAL_PRECEDENT
  if (!fs.existsSync(cale)) {
    console.log(`⚠ Nu gasesc jurnalul campaniei precedente: ${cale}`)
    console.log('  Toti destinatarii primesc varianta pentru oameni noi.\n')
    return new Set()
  }
  try {
    const j = JSON.parse(fs.readFileSync(cale, 'utf8'))
    // doar trimiterile reale reusite; probele `test` au plecat catre noi
    return new Set(j.filter(x => x.ok && x.mod === 'live')
                    .map(x => String(x.email).toLowerCase()))
  } catch (e) {
    console.log(`⚠ Jurnalul precedent nu se poate citi (${e.message}).`)
    console.log('  Toti destinatarii primesc varianta pentru oameni noi.\n')
    return new Set()
  }
}

// Implicit 1: cifra din subiect e despre TERENURI (informatie utila), nu
// despre oameni. Vezi nota din email_templates/email-terenuri-noi-in-zonele-tale.md
const SUBIECT_IMPLICIT = 1

const SUBIECTE = {
  1: r => `${textTerenuri(nr(r.terenuri_1))} în ${r.zona_1}`,
  2: () => 'Au apărut terenuri noi în zonele pe care le urmărești',
  3: r => `${r.zona_1}: ${textTerenuri(nr(r.terenuri_1))}`,
}

const PREHEADER = 'Le-am adăugat săptămâna asta pe platformă.'

// ─────────────────────────────────────────────────────────────────────────────
// Argumente
// ─────────────────────────────────────────────────────────────────────────────

function args() {
  const out = {}
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/)
    if (m) out[m[1]] = m[2] === undefined ? true : m[2]
  }
  return out
}

const A = args()
const MOD = A.mod || 'dry'
const CSV = A.csv
const DIR_IESIRE = A.iesire || path.join(__dirname, 'local')

if (!CSV) {
  console.error('Lipseste --csv="cale/catre/export.csv" (exportul interogarii 1).')
  process.exit(1)
}
if (!['dry', 'test', 'live'].includes(MOD)) {
  console.error(`Mod necunoscut: ${MOD}. Foloseste --mod=dry | test | live.`)
  process.exit(1)
}
if (!SUBIECTE[A.subiect || SUBIECT_IMPLICIT]) {
  console.error('--subiect trebuie sa fie 1, 2 sau 3.')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV (cu ghilimele, virgule si randuri pe mai multe linii — un parser naiv pe
// split(',') ar strica fisierul la primul nume de zona cu virgula in el)
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text) {
  const t = text.replace(/^﻿/, '')
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = [] }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  const header = rows.shift().map(h => h.trim())
  return rows
    .filter(r => r.length > 1 && r.some(v => v.trim() !== ''))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

// ─────────────────────────────────────────────────────────────────────────────
// Continutul emailului
// ─────────────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const nr = v => parseInt(v, 10)

/**
 * Acordul in limba romana pentru numarul de terenuri:
 *   1 -> „1 teren nou”, 2..19 -> „3 terenuri noi”, 20+ -> „21 de terenuri noi”
 * Singura sursa de adevar pentru text; interogarea SQL scoate aceeasi forma
 * pe coloana `terenuri_1_text`, dar scriptul si-o calculeaza singur, ca sa nu
 * depinda de o coloana care s-ar putea sa lipseasca dintr-un export vechi.
 */
function textTerenuri(n) {
  if (!Number.isFinite(n)) return ''
  if (n === 1) return '1 teren nou'
  if (n < 20) return `${n} terenuri noi`
  return `${n} de terenuri noi`
}

/** „cristian” -> „Cristian”. Numele deja scrise cu majuscula raman neatinse. */
function numeAfisat(nume) {
  const n = (nume || '').trim()
  if (!n) return ''
  if (n === n.toLowerCase()) return n.charAt(0).toUpperCase() + n.slice(1)
  return n
}

/** Zonele lui cu terenuri noi, ca lista de perechi { zona, text }. */
function zonele(r) {
  const out = []
  for (const i of [1, 2, 3]) {
    const z = r[`zona_${i}`]
    const n = nr(r[`terenuri_${i}`])
    if (z && Number.isFinite(n) && n > 0) out.push({ zona: z, text: textTerenuri(n) })
  }
  return out
}

function salut(r) {
  const n = numeAfisat(r.nume)
  if (!n || SALUT_FARA_NUME.includes(n.toLowerCase())) return 'Salut,'
  return `Salut, ${n},`
}

/**
 * Paragrafele emailului, in ordine, ca text simplu (fara HTML).
 * Din ele se genereaza si varianta HTML, si cea text — ca sa nu ajunga
 * niciodata sa spuna lucruri diferite.
 */
function continut(r) {
  const zs = zonele(r)
  const totalZone = nr(r.total_zone_cu_terenuri) || zs.length
  const esteUnaSingura = totalZone === 1

  // Cei 29 care au primit si emailul din 28 iulie primesc o deschidere care
  // leaga cele doua mesaje. Atunci le-am spus „nu s-a pornit niciun grup”;
  // acum le spunem ce s-a schimbat intre timp.
  const aPrimitInIulie = PRIMIT_IN_IULIE.has(String(r.email || '').toLowerCase())

  const intro = esteUnaSingura
    ? (aPrimitInIulie
        ? `Acum câteva zile îți scriam că în ${zs[0].zona} nu se pornise încă niciun grup. Între timp am adăugat ${zs[0].text} exact acolo.`
        : `Ai bifat ${zs[0].zona} printre zonele în care ai vrea să locuiești. Tocmai am adăugat ${zs[0].text} exact acolo.`)
    : (aPrimitInIulie
        ? 'Acum câteva zile îți scriam că în zonele pe care le-ai bifat nu se pornise încă niciun grup. Între timp au apărut terenuri, iar o parte sunt exact acolo:'
        : 'Când ți-ai făcut contul ai bifat zonele în care ai vrea să locuiești. Am adăugat terenuri noi pe platformă și o parte sunt exact acolo:')

  const restulZonelor = totalZone > zs.length
    ? `Și încă ${totalZone - zs.length} ${totalZone - zs.length === 1 ? 'zonă bifată de tine a primit' : 'zone bifate de tine au primit'} terenuri.`
    : null

  return {
    salut: salut(r),
    intro,
    zone: esteUnaSingura ? [] : zs,
    restulZonelor: esteUnaSingura ? null : restulZonelor,
    paragrafe: [
      'Ce sunt, ca să știi de la început la ce te uiți: terenuri de vânzare pe care le-am strâns noi într-un singur loc, cu suprafața, prețul și prețul pe mp puse cap la cap, ca să nu cauți tu prin zeci de anunțuri. **Nu sunt rezervate și nu sunt ale noastre.**',
      'Dacă vreunul ți se pare bun, îl poți **adăuga la profil**. Nu te obligă la nimic: e felul în care platforma află că terenul te interesează. Tot acolo vezi cine s-a mai arătat interesat de el, oameni și grupuri.',
      'Iar dacă vrei să mergi mai departe, poți **porni un grup** și lega de el terenurile care vă plac. Cam așa începe de fiecare dată: câțiva oameni care caută în același loc și un teren care le place tuturor.',
    ],
    dupaButon: [
      'Dacă niciunul nu ți se potrivește, e în regulă: rămâi cu zonele bifate și îți scriem când mai apar.',
    ],
    semnatura: ['Lucian', 'ApartamenTUal / LTFB Studio'],
    subsol: 'Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal și ai bifat aceste zone ca zone de interes. Dacă nu vrei să primești astfel de anunțuri, răspunde la acest email cu „stop” și nu-ți mai scriem.',
  }
}

/** **text** -> <strong>text</strong>, dupa escapare. */
function bold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

function html(r) {
  const c = continut(r)
  const p = t => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`

  const zoneHtml = c.zone.length
    ? `<table style="width:100%;border-collapse:collapse;margin:16px 0 20px;background:#f3f0e7;border-radius:8px;overflow:hidden;">
         ${c.zone.map(z => `
           <tr>
             <td style="padding:12px 16px;font-size:15px;color:#1a1a1a;border-bottom:1px solid #e8e3d8;font-weight:600;">${esc(z.zona)}</td>
             <td style="padding:12px 16px;font-size:14px;color:#c2604a;border-bottom:1px solid #e8e3d8;text-align:right;white-space:nowrap;">${esc(z.text)}</td>
           </tr>`).join('')}
       </table>`
    : ''

  return `
    <div style="font-family:'Mona Sans',-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#faf8f3;color:#555555;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(PREHEADER)}</div>
      <div style="text-align:center;padding:24px 0;border-bottom:1px solid #e8e3d8;">
        <h1 style="margin:0;font-size:22px;color:#1a1a1a;font-weight:600;">
          apartamen<span style="color:#c2604a;">TU</span>al
        </h1>
        <p style="margin:4px 0 0;font-size:12px;color:#8a8a8a;">by LTFB studio</p>
      </div>
      <div style="padding:32px 8px;">
        ${p(c.salut)}
        ${p(c.intro)}
        ${zoneHtml}
        ${c.restulZonelor ? p(c.restulZonelor) : ''}
        ${c.paragrafe.map(p).join('')}
        <div style="text-align:center;margin:28px 0;">
          <a href="${LINK_TERENURI}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
            Vezi terenurile
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
          <a href="https://apartamentual.ro" style="color:#c2604a;text-decoration:none;">apartamentual.ro</a>
        </p>
      </div>
    </div>`
}

function text(r) {
  const c = continut(r)
  const linii = [c.salut, '', c.intro]
  if (c.zone.length) {
    linii.push('')
    c.zone.forEach(z => linii.push(`  ${z.zona}: ${z.text}`))
  }
  if (c.restulZonelor) linii.push('', c.restulZonelor)
  c.paragrafe.forEach(x => linii.push('', x.replace(/\*\*/g, '')))
  linii.push('', `Vezi terenurile: ${LINK_TERENURI}`)
  c.dupaButon.forEach(x => linii.push('', x))
  linii.push('', ...c.semnatura)
  linii.push('', '---', c.subsol)
  return linii.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// Trimitere (Resend), cu reincercare
// ─────────────────────────────────────────────────────────────────────────────

const asteapta = ms => new Promise(res => setTimeout(res, ms))

async function trimite(apiKey, mesaj) {
  let ultimaEroare = 'necunoscuta'
  for (let incercare = 1; incercare <= MAX_INCERCARI; incercare++) {
    let resp
    try {
      resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mesaj),
      })
    } catch (e) {
      ultimaEroare = `retea: ${e.message}`
      await asteapta(400 * 2 ** (incercare - 1) + Math.random() * 300)
      continue
    }

    const corp = await resp.text()
    if (resp.ok) {
      let id = null
      try { id = JSON.parse(corp).id } catch { /* raspuns neasteptat, dar 2xx */ }
      return { ok: true, id, incercari: incercare }
    }

    ultimaEroare = `HTTP ${resp.status}: ${corp.slice(0, 300)}`
    const reincercabil = resp.status === 429 || resp.status >= 500
    if (!reincercabil || incercare === MAX_INCERCARI) break

    const retryAfter = parseFloat(resp.headers.get('retry-after') || '0')
    const pauza = retryAfter > 0
      ? retryAfter * 1000
      : 400 * 2 ** (incercare - 1) + Math.random() * 300
    await asteapta(pauza)
  }
  return { ok: false, eroare: ultimaEroare, incercari: MAX_INCERCARI }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jurnalul trimiterilor (ca o re-rulare sa nu trimita de doua ori)
// ─────────────────────────────────────────────────────────────────────────────

function caleJurnal() {
  const zi = new Date().toISOString().slice(0, 10)
  return path.join(DIR_IESIRE, `trimise-${zi}.json`)
}

function citesteJurnal() {
  const f = caleJurnal()
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return [] }
}

function scrieJurnal(intrari) {
  fs.writeFileSync(caleJurnal(), JSON.stringify(intrari, null, 2), 'utf8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Rularea
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`Nu gasesc fisierul CSV: ${CSV}`)
    process.exit(1)
  }
  fs.mkdirSync(DIR_IESIRE, { recursive: true })

  let randuri = parseCsv(fs.readFileSync(CSV, 'utf8'))

  const obligatorii = ['email', 'nume', 'zona_1', 'terenuri_1',
                       'total_zone_cu_terenuri', 'total_terenuri']
  const lipsa = obligatorii.filter(c => !(c in (randuri[0] || {})))
  if (lipsa.length) {
    console.error(`CSV-ul nu pare exportul interogarii 1. Lipsesc coloanele: ${lipsa.join(', ')}`)
    process.exit(1)
  }

  if (A.doar) {
    const set = new Set(String(A.doar).toLowerCase().split(',').map(s => s.trim()))
    randuri = randuri.filter(r => set.has(r.email.toLowerCase()))
  }
  const deExclus = new Set([
    ...EXCLUSI_IMPLICIT.map(e => e.toLowerCase()),
    ...(A.fara ? String(A.fara).toLowerCase().split(',').map(s => s.trim()) : []),
  ])
  if (deExclus.size) {
    const scosi = randuri.filter(r => deExclus.has(r.email.toLowerCase()))
    randuri = randuri.filter(r => !deExclus.has(r.email.toLowerCase()))
    if (scosi.length) console.log(`Exclusi: ${scosi.map(r => r.email).join(', ')}`)
  }
  if (A.limita) randuri = randuri.slice(0, parseInt(A.limita, 10))

  const varSubiect = A.subiect || SUBIECT_IMPLICIT
  const facSubiect = SUBIECTE[varSubiect]

  // Verificari de igiena inainte de orice trimitere
  const fara_email = randuri.filter(r => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))
  if (fara_email.length) {
    console.error(`Adrese care nu arata a email (${fara_email.length}): ${fara_email.map(r => r.email).join(', ')}`)
    process.exit(1)
  }
  const duplicate = randuri.map(r => r.email.toLowerCase())
    .filter((e, i, a) => a.indexOf(e) !== i)
  if (duplicate.length) {
    console.error(`Adrese duplicate in CSV: ${[...new Set(duplicate)].join(', ')} — opresc, ca sa nu primeasca nimeni doua emailuri.`)
    process.exit(1)
  }
  // Un rand fara zona_1 sau fara numar de terenuri ar produce un email gaunos
  // („ terenuri noi in ”). Mai bine ne oprim decat sa trimitem asa ceva.
  const fara_zona = randuri.filter(r => !r.zona_1 || !Number.isFinite(nr(r.terenuri_1)))
  if (fara_zona.length) {
    console.error(`Randuri fara zona_1 / terenuri_1 (${fara_zona.length}): ${fara_zona.map(r => r.email).join(', ')}`)
    console.error('Verifica interogarea — fiecare destinatar trebuie sa aiba cel putin o zona cu terenuri noi.')
    process.exit(1)
  }

  // Cine a primit si campania din iulie -> deschidere cu fraza de legatura
  PRIMIT_IN_IULIE = incarcaPrecedent()
  const cuLegatura = randuri.filter(r => PRIMIT_IN_IULIE.has(r.email.toLowerCase())).length

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari in fisier: ${randuri.length}`)
  console.log(`  ${cuLegatura} au primit si emailul din 28 iulie -> deschidere cu fraza de legatura`)
  console.log(`  ${randuri.length - cuLegatura} sunt oameni noi -> deschidere obisnuita`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect (varianta ${varSubiect}), exemplu: „${facSubiect(randuri[0])}”\n`)

  // ── TREAPTA 1: proba, fara retea ──────────────────────────────────────────
  if (MOD === 'dry') {
    const dirPreview = path.join(DIR_IESIRE, 'previzualizare')
    fs.mkdirSync(dirPreview, { recursive: true })
    let index = []

    randuri.forEach((r, i) => {
      const nrOrd = String(i + 1).padStart(2, '0')
      const numeFisier = `${nrOrd}-${r.email.replace(/[^a-z0-9._-]/gi, '_')}.html`
      fs.writeFileSync(path.join(dirPreview, numeFisier), html(r), 'utf8')
      index.push({ nr: nrOrd, email: r.email, nume: r.nume, subiect: facSubiect(r), fisier: numeFisier })
      console.log(`${nrOrd}. ${r.email.padEnd(34)} ${facSubiect(r)}`)
    })

    // o pagina care le aduna pe toate, ca sa le rasfoiesti dintr-un loc
    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare emailuri terenuri</title>
      <body style="font-family:system-ui;background:#faf8f3;padding:24px;">
      <h1 style="font-size:20px;">Previzualizare — ${index.length} emailuri</h1>
      <ol>${index.map(x => `<li><a href="previzualizare/${x.fisier}">${esc(x.email)}</a> — ${esc(x.subiect)}</li>`).join('')}</ol>`
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), cuprins, 'utf8')

    // varianta text a primului email, ca sa vezi cum arata si fara HTML
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(randuri[0]), 'utf8')

    console.log(`\n✓ Nu s-a trimis nimic. Deschide:`)
    console.log(`  ${path.join(DIR_IESIRE, 'previzualizare.html')}`)
    console.log(`\nCand esti multumit: --mod=test (doar catre tine), apoi --mod=live --confirm-trimit.\n`)
    return
  }

  // ── Trimitere reala: de aici incolo e nevoie de cheie ─────────────────────
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('Lipseste RESEND_API_KEY din mediu.')
    console.error('PowerShell:  $env:RESEND_API_KEY="re_xxx"   (in aceeasi fereastra, inainte de a rula)')
    process.exit(1)
  }

  let tinte
  if (MOD === 'test') {
    const catre = A['test-email'] || TEST_EMAIL
    // trei cazuri diferite: cele mai multe terenuri, cele mai putine, unul din mijloc
    const sortat = [...randuri].sort((a, b) => (nr(b.total_terenuri) || 0) - (nr(a.total_terenuri) || 0))
    const alese = [sortat[0], sortat[sortat.length - 1], sortat[Math.floor(sortat.length / 2)]]
      .filter((v, i, a) => v && a.indexOf(v) === i)
    tinte = alese.map(r => ({ rand: r, catre, subiectPrefix: '[TEST] ' }))
    console.log(`Trimit ${tinte.length} probe catre ${catre}:`)
    alese.forEach(r => console.log(`  - ca si cum ar fi ${r.email} (${r.nume}, ${r.total_terenuri} terenuri in ${r.total_zone_cu_terenuri} zone)`))
  } else {
    if (!A['confirm-trimit']) {
      console.error('Modul „live” trimite catre TOTI din CSV.')
      console.error('Daca chiar asta vrei, adauga si steagul --confirm-trimit.')
      process.exit(1)
    }
    tinte = randuri.map(r => ({ rand: r, catre: r.email, subiectPrefix: '' }))
  }

  const jurnal = citesteJurnal()
  const dejaTrimise = new Set(
    jurnal.filter(x => x.ok && x.mod === MOD).map(x => `${x.mod}:${x.email}`)
  )

  let reusite = 0, esecuri = 0, sarite = 0
  for (let i = 0; i < tinte.length; i++) {
    const { rand, catre, subiectPrefix } = tinte[i]
    const cheie = `${MOD}:${rand.email}`

    if (dejaTrimise.has(cheie)) {
      sarite++
      console.log(`(${i + 1}/${tinte.length}) ${rand.email} — SARIT, e deja in jurnalul de azi`)
      continue
    }

    const mesaj = {
      from: FROM,
      to: [catre],
      reply_to: REPLY_TO,
      subject: subiectPrefix + facSubiect(rand),
      html: html(rand),
      text: text(rand),
      headers: {
        'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=stop>`,
      },
    }

    const rez = await trimite(apiKey, mesaj)
    jurnal.push({
      mod: MOD,
      email: rand.email,
      catre,
      ok: rez.ok,
      id: rez.id || null,
      eroare: rez.eroare || null,
      incercari: rez.incercari,
      la: new Date().toISOString(),
    })
    scrieJurnal(jurnal)   // scriem dupa fiecare, ca o intrerupere sa nu piarda nimic

    if (rez.ok) {
      reusite++
      console.log(`(${i + 1}/${tinte.length}) ✓ ${catre}${catre !== rand.email ? ` [${rand.email}]` : ''} — ${rez.id}`)
    } else {
      esecuri++
      console.log(`(${i + 1}/${tinte.length}) ✗ ${catre} — ${rez.eroare}`)
    }

    if (i < tinte.length - 1) await asteapta(PAUZA_MS)
  }

  console.log(`\nGata. Trimise: ${reusite}. Esuate: ${esecuri}. Sarite: ${sarite}.`)
  console.log(`Jurnal: ${caleJurnal()}`)
  if (esecuri) console.log('Re-ruleaza aceeasi comanda — cele reusite sunt sarite, se reincearca doar cele esuate.')
}

main().catch(e => { console.error(e); process.exit(1) })

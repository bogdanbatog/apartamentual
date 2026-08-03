#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „corectie ora webinar — joi 6 august, 11:30”
 * =============================================================================
 *
 * Citeste CSV-ul cu inscrisii la webinar (exportul de invitati din Luma) si
 * trimite fiecaruia acelasi mesaj scurt: ora corecta e 11:30, nu 10:30.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend.
 *
 * Acelasi tipar ca `scripts/emailuri-terenuri-noi/` — comenzile sunt identice,
 * se schimba doar CSV-ul si textul.
 *
 * DE UNDE IA CSV-UL:
 *   Luma -> evenimentul din 6 august -> Guests -> Export / Download CSV.
 *   Scriptul recunoaste singur coloana de email (`email`) si pe cea de nume
 *   (`name`, `nume`, `first_name`). Restul coloanelor sunt ignorate.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc emailurile
 *      compuse, ca sa le deschizi in browser si sa le citesti:
 *
 *        node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="cale/catre.csv"
 *
 *   2. TEST — trimite 1 email DOAR catre tine:
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — trimite catre toti cei din CSV. Cere DOUA steaguri,
 *      ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="cale/catre.csv" --mod=live --confirm-trimit
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
 *   --test-email=...      unde se trimite proba in modul test.
 *   --limita=N            proceseaza doar primele N randuri.
 *   --doar=email1,email2  trimite doar catre adresele astea (din CSV).
 *   --fara=email1,email2  sare peste adresele astea (ex. cine a cerut „stop”).
 *   --iesire=cale         unde se scriu previzualizarile. Implicit `local/`.
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
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

const SUBIECT = 'Webinar ApartamenTUal, joi 6 august, ora 11:30'
const PREHEADER = 'Ora corectă este 11:30, nu 10:30.'

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ⚠️ AICI se trec cei care au cerut „stop” la campaniile precedente.
// Se pot adauga si la rulare, cu --fara=email1,email2
const EXCLUSI_IMPLICIT = [
  // 'cineva@care.a.cerut', // „stop”
]

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
  console.error('Lipseste --csv="cale/catre/invitati-luma.csv".')
  process.exit(1)
}
if (!['dry', 'test', 'live'].includes(MOD)) {
  console.error(`Mod necunoscut: ${MOD}. Foloseste --mod=dry | test | live.`)
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV (cu ghilimele, virgule si randuri pe mai multe linii — un parser naiv pe
// split(',') ar strica fisierul la primul nume cu virgula in el)
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

/**
 * Exportul Luma nu are aceleasi capete de coloana ca interogarile noastre SQL.
 * Aducem fiecare rand la forma { email, nume }, indiferent cum se cheama
 * coloanele in fisier. Daca nu gasim o coloana de email, ne oprim — mai bine
 * o eroare clara decat un lot gol trimis in tacere.
 */
function normalizeaza(randuri) {
  if (!randuri.length) return []
  const chei = Object.keys(randuri[0])
  const gaseste = nume => chei.find(c => nume.includes(c.trim().toLowerCase()))

  const cEmail = gaseste(['email', 'e-mail', 'email address', 'adresa'])
  const cNume = gaseste(['name', 'nume', 'first name', 'first_name', 'full name'])

  if (!cEmail) {
    console.error(`CSV-ul nu are o coloana de email. Coloane gasite: ${chei.join(', ')}`)
    process.exit(1)
  }
  console.log(`Coloana email: „${cEmail}”${cNume ? `, coloana nume: „${cNume}”` : ', fara coloana de nume'}`)

  return randuri
    .map(r => ({ email: (r[cEmail] || '').trim(), nume: cNume ? (r[cNume] || '').trim() : '' }))
    .filter(r => r.email)
}

// ─────────────────────────────────────────────────────────────────────────────
// Continutul emailului
// ─────────────────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Paragrafele emailului, in ordine, ca text simplu (fara HTML).
 * Din ele se genereaza si varianta HTML, si cea text — ca sa nu ajunga
 * niciodata sa spuna lucruri diferite.
 *
 * Mesajul e acelasi pentru toata lumea: nu personalizam cu numele, pentru ca
 * exportul Luma are si pseudonime, iar un „Bună ziua, xyz123,” suna fals.
 */
const CONTINUT = {
  salut: 'Bună ziua,',
  paragrafe: [
    'O precizare despre ora webinarului de joi, 6 august: începe la **11:30** și durează până la 12:30.',
    'Pe site a apărut o vreme ora 10:30, din greșeala noastră. Ora corectă este **11:30**. Linkul de Zoom rămâne același, îl primiți și cu o zi înainte.',
  ],
  semnatura: ['Ne vedem joi,', 'Lucian'],
  // Corpul e la „dumneavoastră” (asa e scris mesajul), deci si subsolul —
  // altfel emailul schimba persoana de la un paragraf la altul.
  subsol: 'Ați primit acest mesaj pentru că v-ați înscris la webinarul ApartamenTUal din 6 august. Dacă nu mai vreți să primiți emailuri de la noi, răspundeți cu „stop”.',
}

/** **text** -> <strong>text</strong>, dupa escapare. */
function bold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

function html() {
  const c = CONTINUT
  const p = t => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`

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
        ${c.paragrafe.map(p).join('')}
        <table style="width:100%;border-collapse:collapse;margin:16px 0 4px;background:#f3f0e7;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:12px 16px;font-size:15px;color:#1a1a1a;border-bottom:1px solid #e8e3d8;font-weight:600;">Joi, 6 august 2026</td>
            <td style="padding:12px 16px;font-size:14px;color:#c2604a;border-bottom:1px solid #e8e3d8;text-align:right;white-space:nowrap;">11:30 – 12:30</td>
          </tr>
        </table>
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

function text() {
  const c = CONTINUT
  const linii = [c.salut]
  c.paragrafe.forEach(x => linii.push('', x.replace(/\*\*/g, '')))
  linii.push('', 'Joi, 6 august 2026, 11:30 – 12:30')
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

  let randuri = normalizeaza(parseCsv(fs.readFileSync(CSV, 'utf8')))

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

  // Verificari de igiena inainte de orice trimitere
  const fara_email = randuri.filter(r => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email))
  if (fara_email.length) {
    console.error(`Adrese care nu arata a email (${fara_email.length}): ${fara_email.map(r => r.email).join(', ')}`)
    process.exit(1)
  }
  // Luma poate avea aceeasi adresa de doua ori (inscriere + lista de asteptare).
  // Aici nu ne oprim, doar pastram prima aparitie — mesajul e identic pentru toti.
  const vazute = new Set()
  const inainte = randuri.length
  randuri = randuri.filter(r => {
    const e = r.email.toLowerCase()
    if (vazute.has(e)) return false
    vazute.add(e)
    return true
  })
  if (randuri.length < inainte) {
    console.log(`Duplicate in CSV, pastrata prima aparitie: ${inainte - randuri.length}`)
  }

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari: ${randuri.length}`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect: „${SUBIECT}”\n`)

  // ── TREAPTA 1: proba, fara retea ──────────────────────────────────────────
  if (MOD === 'dry') {
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), html(), 'utf8')
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(), 'utf8')
    fs.writeFileSync(path.join(DIR_IESIRE, 'destinatari.txt'),
                     randuri.map((r, i) => `${String(i + 1).padStart(2, '0')}. ${r.email}`).join('\n'), 'utf8')

    randuri.forEach((r, i) => console.log(`${String(i + 1).padStart(2, '0')}. ${r.email}`))

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
    tinte = [{ email: catre, catre, subiectPrefix: '[TEST] ' }]
    console.log(`Trimit 1 proba catre ${catre}.`)
  } else {
    if (!A['confirm-trimit']) {
      console.error('Modul „live” trimite catre TOTI din CSV.')
      console.error('Daca chiar asta vrei, adauga si steagul --confirm-trimit.')
      process.exit(1)
    }
    tinte = randuri.map(r => ({ email: r.email, catre: r.email, subiectPrefix: '' }))
  }

  const jurnal = citesteJurnal()
  const dejaTrimise = new Set(
    jurnal.filter(x => x.ok && x.mod === MOD).map(x => `${x.mod}:${x.email}`)
  )

  let reusite = 0, esecuri = 0, sarite = 0
  for (let i = 0; i < tinte.length; i++) {
    const { email, catre, subiectPrefix } = tinte[i]
    const cheie = `${MOD}:${email}`

    if (dejaTrimise.has(cheie)) {
      sarite++
      console.log(`(${i + 1}/${tinte.length}) ${email} — SARIT, e deja in jurnalul de azi`)
      continue
    }

    const mesaj = {
      from: FROM,
      to: [catre],
      reply_to: REPLY_TO,
      subject: subiectPrefix + SUBIECT,
      html: html(),
      text: text(),
      headers: {
        'List-Unsubscribe': `<mailto:${REPLY_TO}?subject=stop>`,
      },
    }

    const rez = await trimite(apiKey, mesaj)
    jurnal.push({
      mod: MOD,
      email,
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
      console.log(`(${i + 1}/${tinte.length}) ✓ ${catre} — ${rez.id}`)
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

#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „zonele tale au cerere, dar niciun grup”
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/analiza-zone/
 * 5-merge-multizona.sql`) si compune cate un email personalizat pentru fiecare
 * persoana, cu zonele ei fara grup.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile
 *      compuse, ca sa le deschizi in browser si sa le citesti:
 *
 *        node scripts/emailuri-zone/trimite-emailuri-zone.js --csv="cale/catre.csv"
 *
 *   2. TEST — trimite 3 emailuri reprezentative DOAR catre tine
 *      (unul cu multe zone, unul cu o singura zona, unul din mijloc):
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-zone/trimite-emailuri-zone.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — trimite catre toti cei din CSV. Cere DOUA steaguri,
 *      ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-zone/trimite-emailuri-zone.js --csv="cale/catre.csv" --mod=live --confirm-trimit
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
 *   --subiect=1|2|3     varianta de subiect (vezi SUBIECTE mai jos). Implicit 2.
 *   --test-email=...    unde se trimit probele in modul test. Implicit adresa
 *                       din TEST_EMAIL de mai jos.
 *   --limita=N          proceseaza doar primele N randuri (util la testare).
 *   --doar=email1,email2  trimite doar catre adresele astea (din CSV).
 *   --fara=email1,email2  sare peste adresele astea (ex. cineva care a cerut „stop”).
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
const LINK_GRUP_NOU = 'https://apartamentual.ro/grup-nou.html'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Pentru ele emailul incepe simplu cu „Salut,”.
const SALUT_FARA_NUME = []

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// Se pot adauga si la rulare, cu --fara=email1,email2
const EXCLUSI_IMPLICIT = [
  'vlad.radu@gmail.com',  // „DeathArrow”: 21 de zone bifate fara grup (jumatate
                          // de Bucuresti) -> „zonele tale” ar suna fals. Decizie
                          // Lucian, 28 iulie 2026.
]

// Varianta aleasa de Lucian pe 28 iulie 2026: 2 (fara cifra in subiect).
// Se poate schimba la rulare cu --subiect=1|2|3
const SUBIECT_IMPLICIT = 2

const SUBIECTE = {
  1: r => `${r.zona_1}: ${r.oameni_1_text}, niciun grup`,
  2: r => `În ${r.zona_1} nu s-a pornit încă niciun grup`,
  3: () => 'Zonele în care cauți nu au încă niciun grup',
}

const PREHEADER = 'Ești unul dintre ei. Deocamdată nu v-ați întâlnit.'

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
  console.error('Lipseste --csv="cale/catre/export.csv" (exportul interogarii 5).')
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
// CSV (cu ghilimele, virgule si randuri pe mai multe linii — `zone_pentru_email`
// contine "\n", deci un parser naiv pe split(',') ar strica tot fisierul)
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

/** „cristian” -> „Cristian”. Numele deja scrise cu majuscula raman neatinse. */
function numeAfisat(nume) {
  const n = (nume || '').trim()
  if (!n) return ''
  if (n === n.toLowerCase()) return n.charAt(0).toUpperCase() + n.slice(1)
  return n
}

/** Zonele lui, ca lista de perechi { zona, oameni_text }. */
function zonele(r) {
  const out = []
  for (const i of [1, 2, 3]) {
    const z = r[`zona_${i}`]
    const o = parseInt(r[`oameni_${i}`], 10)
    if (z && Number.isFinite(o)) {
      out.push({ zona: z, text: o >= 20 ? `${o} de oameni` : `${o} oameni` })
    }
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
  const total = parseInt(r.total_zone, 10) || zs.length
  const esteUnaSingura = total === 1

  const intro = esteUnaSingura
    ? `Ți-ai trecut ${zs[0].zona} printre zonele în care ai vrea să locuiești. Nu ești singurul: chiar acum sunt ${zs[0].text} care caută exact acolo. Și nu există încă niciun grup pentru zona asta.`
    : 'Când ți-ai făcut contul pe ApartamenTUal ai bifat zonele în care ai vrea să locuiești. Iată cum arată ele astăzi:'

  // Cand exista randul „Si inca N zone...”, el spune deja ca nu e niciun grup
  // in niciuna, deci propozitia de dupa lista ar repeta acelasi lucru. Se
  // pastreaza una singura, dupa caz.
  const restulZonelor = total > zs.length
    ? `Și încă ${total - zs.length} ${total - zs.length === 1 ? 'zonă' : 'zone'} bifate, tot fără niciun grup.`
    : null

  return {
    salut: salut(r),
    intro,
    zone: esteUnaSingura ? [] : zs,
    restulZonelor: esteUnaSingura ? null : restulZonelor,
    dupaZone: (esteUnaSingura || restulZonelor)
      ? null
      : 'În niciuna dintre ele nu există încă vreun grup.',
    paragrafe: [
      'Așa arată, de fapt, momentul dinaintea unui grup de construcție: câțiva oameni care vor același lucru, în același loc, dar care nu s-au întâlnit încă. Noi am trecut exact prin punctul ăsta la Județului Housing, câteva familii care la început nu se cunoșteau între ele.',
      '**Un grup nu începe cu un teren. Începe cu o conversație.**',
      'Când pornești un grup nu semnezi nimic și nu te angajezi la nimic. Deschizi un loc unde ceilalți care caută în aceeași zonă pot cere să intre, iar tu, ca fondator, aprobi cine intră. De acolo discutați ce fel de bloc vreți, ce buget aveți și dacă are sens să mergeți mai departe împreună.',
      `Grupul apare imediat pe platformă, iar ceilalți care caută în ${zs[0].zona} îl văd și pot cere să intre. Primești o notificare la fiecare cerere.`,
    ],
    dupaButon: [
      'Dacă preferi să nu-l pornești tu, e în regulă: rămâi cu zonele bifate și te anunțăm în momentul în care apare un grup în vreuna dintre ele.',
      'Un lucru pe care nu vrem să-l ascundem: drumul e lung. Găsit teren, autorizații, ani, nu luni, și multe decizii luate împreună. În schimb, toți banii tăi rămân în apartamentul tău.',
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
        ${c.dupaZone ? p(c.dupaZone) : ''}
        ${c.paragrafe.map(p).join('')}
        <div style="text-align:center;margin:28px 0;">
          <a href="${LINK_GRUP_NOU}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
            Pornește un grup
          </a>
          <p style="margin:10px 0 0;font-size:13px;color:#8a8a8a;">durează vreo două minute</p>
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
  if (c.dupaZone) linii.push('', c.dupaZone)
  c.paragrafe.forEach(x => linii.push('', x.replace(/\*\*/g, '')))
  linii.push('', `Pornește un grup: ${LINK_GRUP_NOU}`)
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

  const obligatorii = ['email', 'nume', 'zona_1', 'oameni_1', 'oameni_1_text', 'total_zone']
  const lipsa = obligatorii.filter(c => !(c in (randuri[0] || {})))
  if (lipsa.length) {
    console.error(`CSV-ul nu pare exportul interogarii 5. Lipsesc coloanele: ${lipsa.join(', ')}`)
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

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari in fisier: ${randuri.length}`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect (varianta ${varSubiect}), exemplu: „${facSubiect(randuri[0])}”\n`)

  // ── TREAPTA 1: proba, fara retea ──────────────────────────────────────────
  if (MOD === 'dry') {
    const dirPreview = path.join(DIR_IESIRE, 'previzualizare')
    fs.mkdirSync(dirPreview, { recursive: true })
    let index = []

    randuri.forEach((r, i) => {
      const nr = String(i + 1).padStart(2, '0')
      const numeFisier = `${nr}-${r.email.replace(/[^a-z0-9._-]/gi, '_')}.html`
      fs.writeFileSync(path.join(dirPreview, numeFisier), html(r), 'utf8')
      index.push({ nr, email: r.email, nume: r.nume, subiect: facSubiect(r), fisier: numeFisier })
      console.log(`${nr}. ${r.email.padEnd(34)} ${facSubiect(r)}`)
    })

    // o pagina care le aduna pe toate, ca sa le rasfoiesti dintr-un loc
    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare emailuri</title>
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
    // trei cazuri diferite: cele mai multe zone, cele mai putine, unul din mijloc
    const sortat = [...randuri].sort((a, b) => (+b.total_zone) - (+a.total_zone))
    const alese = [sortat[0], sortat[sortat.length - 1], sortat[Math.floor(sortat.length / 2)]]
      .filter((v, i, a) => v && a.indexOf(v) === i)
    tinte = alese.map(r => ({ rand: r, catre, subiectPrefix: '[TEST] ' }))
    console.log(`Trimit ${tinte.length} probe catre ${catre}:`)
    alese.forEach(r => console.log(`  - ca si cum ar fi ${r.email} (${r.nume}, ${r.total_zone} zone)`))
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

#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „profilul necompletat te blocheaza, concret”
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/
 * emailuri-profil-incomplet/1-lot-pentru-email.sql`) si compune cate un email
 * personalizat: ce anume ii lipseste fiecaruia din profil si ce nu poate face
 * din cauza asta.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend. Acelasi tipar ca `scripts/emailuri-zone/`.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile:
 *
 *        node scripts/emailuri-profil-incomplet/trimite-emailuri-profil.js --csv="cale/catre.csv"
 *
 *   2. TEST — trimite 3 emailuri reprezentative DOAR catre tine:
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-profil-incomplet/trimite-emailuri-profil.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — cere DOUA steaguri, ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-profil-incomplet/trimite-emailuri-profil.js --csv="cale/catre.csv" --mod=live --confirm-trimit
 *
 * SIGURANTA:
 *   - Cheia API se ia DOAR din variabila de mediu RESEND_API_KEY.
 *   - Fiecare trimitere reusita se scrie in `local/trimise-<data>.json`. La o
 *     re-rulare, adresele deja trimise sunt SARITE automat. Nu sterge fisierul
 *     ala daca nu vrei sa trimiti a doua oara acelorasi oameni.
 *   - Pauza de 600 ms intre trimiteri + reincercare la 429 / 5xx.
 *
 * DOUA FRAZE CARE SE SCHIMBA DE LA OM LA OM (nu le atinge fara sa citesti
 * `email_templates/email-profil-incomplet.md`):
 *   - „nu apari in lista de utilizatori” apare DOAR daca apare_in_utilizatori=nu.
 *     Cine are pseudonim APARE in pagina, chiar daca nu poate intra in grupuri.
 *   - deschiderea e alta pentru cei carora le-am scris deja in iulie
 *     (notificat_iulie=da) — altfel ar fi al treilea mesaj identic.
 *
 * ALTE OPTIUNI:
 *   --subiect=1|2|3     varianta de subiect (vezi SUBIECTE mai jos). Implicit 1.
 *   --doar-noi          trimite doar celor care NU au primit emailul din iulie.
 *   --doar-repetati     invers: doar celor din iulie (ca sa-i trimiti separat).
 *   --test-email=...    unde se trimit probele in modul test.
 *   --limita=N          proceseaza doar primele N randuri.
 *   --doar=a@b.ro,...   trimite doar catre adresele astea (din CSV).
 *   --fara=a@b.ro,...   sare peste adresele astea (cine a cerut „stop”).
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
const LINK_PROFIL = 'https://apartamentual.ro/profile-edit-new.html'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Pentru ele emailul incepe simplu cu „Salut,”.
const SALUT_FARA_NUME = ['deatharrow']

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ✏️ AICI se adauga cine raspunde cu „stop” — nu exista flag de consimtamant
//    pe `profiles`, deci opt-out-ul se tine de mana, ca la campania de zone.
const EXCLUSI_IMPLICIT = [
]

// Varianta implicita de subiect: 1 (spune ce se intampla, fara sa acuze).
const SUBIECT_IMPLICIT = 1

const SUBIECTE = {
  1: () => 'Ce te oprește acum să intri într-un grup',
  2: r => {
    const n = parseInt(r.nr_lipsuri, 10) || 0
    return n === 1
      ? 'Îți mai lipsește un lucru din profil'
      : `Îți mai lipsesc ${n} lucruri din profil`
  },
  3: () => 'Profilul tău a rămas neterminat — și acum contează',
}

const PREHEADER = 'Nu e o formalitate. Fără profil, cererea de intrare nu trece.'

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
if (A['doar-noi'] && A['doar-repetati']) {
  console.error('--doar-noi si --doar-repetati se exclud reciproc.')
  process.exit(1)
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV (cu ghilimele, virgule si randuri pe mai multe linii — coloana
// `lipseste_pentru_email` contine "\n", deci un parser naiv pe split(',') ar
// strica tot fisierul)
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

function salut(r) {
  const n = numeAfisat(r.nume)
  if (!n || SALUT_FARA_NUME.includes(n.toLowerCase())) return 'Salut,'
  return `Salut, ${n},`
}

/** Lipsurile lui, ca lista de randuri. Vin din SQL, separate prin "\n". */
function lipsuri(r) {
  return String(r.lipseste_pentru_email || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
}

const daNu = v => String(v || '').trim().toLowerCase() === 'da'

/**
 * Paragrafele emailului, in ordine, ca text simplu (fara HTML).
 * Din ele se genereaza si varianta HTML, si cea text — ca sa nu ajunga
 * niciodata sa spuna lucruri diferite.
 */
function continut(r) {
  const esteRepetat = daNu(r.notificat_iulie)
  const apareInLista = daNu(r.apare_in_utilizatori)

  // Deschiderea: pentru cine a mai primit un email in iulie, ăsta e al treilea
  // mesaj. Daca nu spune de ce revenim, e doar insistenta.
  // Amandoua variantele se termina cu „:” — dupa ele urmeaza lista de mai jos.
  const intro = esteRepetat
    ? 'Ți-am mai scris în iulie despre profilul rămas neterminat. Revenim fiindcă între timp s-a schimbat ceva: profilul necompletat te va împiedica să faci următoarele lucruri pe platformă:'
    : `Ți-ai făcut cont pe ApartamenTUal pe ${r.inregistrat_text || 'vremea aceea'}, dar profilul a rămas neterminat. Îți scriem fiindcă acest lucru te va împiedica să faci următoarele lucruri pe platformă:`

  const blocaje = [
    '**Nu te poți alătura niciunui grup.** Cererea de intrare nu trece de platformă, oricât de potrivit ai fi pentru grupul acela.',
    '**Nu poți porni un grup al tău.** Formularul de creare nu ți se va deschide.',
  ]
  // Fraza asta e adevarata DOAR pentru cine n-are pseudonim. Cine are pseudonim
  // apare in pagina Utilizatori, chiar daca nu poate intra in niciun grup.
  if (!apareInLista) {
    blocaje.push('**Nu apari în lista de utilizatori** — cine caută în aceeași zonă cu tine nu are cum să dea de tine.')
  }

  const lista = lipsuri(r)

  return {
    salut: salut(r),
    intro,
    blocaje,
    paragrafe: [
      // „Amandoua” tine doar cat sunt doua puncte. Cine n-are pseudonim vede
      // trei, iar al treilea (nu apare in lista) NU e o regula din august.
      `${blocaje.length > 2 ? 'Primele două' : 'Amândouă'} sunt din august. Când am început platforma, aceste lucruri se puteau face și cu profilul necompletat, dar am rectificat aspectul acesta pentru transparență și pentru eficiența scopului platformei: găsirea de grupuri cu care să-ți construiești propriul apartament.`,
      'Nu sunt reguli puse ca să fie. Un grup de construcție ajunge, în timp, să însemne câțiva oameni care semnează împreună pentru un teren și pentru un constructor. Înainte de asta vor să știe cu cine stau de vorbă: în ce oraș cauți, ce fel de apartament, în ce zone. Fondatorul care aprobă cererile se uită exact la lucrurile astea, iar un profil gol nu-i spune nimic despre tine.',
    ],
    // Acordul: cine are o singura lipsa nu trebuie sa citeasca „mai lipsesc”.
    inainteDeLipsuri: lista.length === 1
      ? 'La tine mai lipsește un singur lucru:'
      : 'La tine mai lipsesc:',
    lipsuri: lista,
    dupaButon: [
      'După ce salvezi, se deblochează pe loc: poți cere să intri în orice grup deschis și poți porni unul al tău.',
      'Dacă între timp nu mai cauți apartament, e perfect în regulă — răspunde la acest email cu „stop” și nu-ți mai scriem.',
    ],
    semnatura: ['Lucian', 'ApartamenTUal / LTFB Studio'],
    subsol: 'Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal, iar profilul a rămas neterminat. Nu e un buletin informativ, e o explicație despre ce nu funcționează în contul tău. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop”.',
  }
}

/** **text** -> <strong>text</strong>, dupa escapare. */
function bold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

function html(r) {
  const c = continut(r)
  const p = t => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`

  const blocajeHtml = `
    <ul style="margin:0 0 20px;padding-left:20px;">
      ${c.blocaje.map(b => `<li style="margin:0 0 10px;font-size:15px;line-height:1.6;">${bold(b)}</li>`).join('')}
    </ul>`

  const lipsuriHtml = c.lipsuri.length
    ? `<table style="width:100%;border-collapse:collapse;margin:12px 0 20px;background:#f3f0e7;border-radius:8px;overflow:hidden;">
         ${c.lipsuri.map(l => `
           <tr>
             <td style="padding:12px 16px;font-size:15px;color:#1a1a1a;border-bottom:1px solid #e8e3d8;">${esc(l)}</td>
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
        ${blocajeHtml}
        ${c.paragrafe.map(p).join('')}
        ${p(`**${c.inainteDeLipsuri}**`)}
        ${lipsuriHtml}
        <div style="text-align:center;margin:28px 0;">
          <a href="${LINK_PROFIL}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
            Completează profilul
          </a>
          <p style="margin:10px 0 0;font-size:13px;color:#8a8a8a;">durează două-trei minute</p>
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
  const fara = s => s.replace(/\*\*/g, '')
  const linii = [c.salut, '', c.intro, '']
  c.blocaje.forEach(b => linii.push(`  - ${fara(b)}`))
  c.paragrafe.forEach(x => linii.push('', fara(x)))
  linii.push('', c.inainteDeLipsuri)
  c.lipsuri.forEach(l => linii.push(`  - ${l}`))
  linii.push('', `Completează profilul: ${LINK_PROFIL}`, 'durează două-trei minute')
  c.dupaButon.forEach(x => linii.push('', fara(x)))
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

  const obligatorii = ['email', 'nume', 'nr_lipsuri', 'lipseste_pentru_email',
                       'apare_in_utilizatori', 'notificat_iulie']
  const lipsa = obligatorii.filter(c => !(c in (randuri[0] || {})))
  if (lipsa.length) {
    console.error(`CSV-ul nu pare exportul interogarii 1. Lipsesc coloanele: ${lipsa.join(', ')}`)
    process.exit(1)
  }

  if (A['doar-noi'])      randuri = randuri.filter(r => !daNu(r.notificat_iulie))
  if (A['doar-repetati']) randuri = randuri.filter(r =>  daNu(r.notificat_iulie))

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
  if (!randuri.length) {
    console.error('Nu a ramas niciun destinatar dupa filtre. Opresc.')
    process.exit(1)
  }
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
  // Emailul e degeaba daca nu spune ce lipseste. Un rand fara lipsuri inseamna
  // ca omul si-a completat profilul intre interogare si trimitere.
  const faraLipsuri = randuri.filter(r => lipsuri(r).length === 0)
  if (faraLipsuri.length) {
    console.error(`Randuri fara nicio lipsa (profil completat intre timp?): ${faraLipsuri.map(r => r.email).join(', ')}`)
    console.error('Re-ruleaza interogarea 1 si exporta din nou, sau scoate-i cu --fara=...')
    process.exit(1)
  }

  const nrRepetati = randuri.filter(r => daNu(r.notificat_iulie)).length
  const nrFaraNume = randuri.filter(r => !r.nume).length
  const nrNuApar   = randuri.filter(r => !daNu(r.apare_in_utilizatori)).length

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari: ${randuri.length}`)
  console.log(`  din care le-am mai scris in iulie: ${nrRepetati} (primesc alta deschidere)`)
  console.log(`  din care fara pseudonim:           ${nrFaraNume} (primesc „Salut,” simplu)`)
  console.log(`  din care NU apar la Utilizatori:   ${nrNuApar} (primesc si fraza a treia)`)
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
      const semne = [
        daNu(r.notificat_iulie) ? 'repetat' : null,
        !daNu(r.apare_in_utilizatori) ? 'nu apare in lista' : null,
        !r.nume ? 'fara nume' : null,
      ].filter(Boolean)
      index.push({ nr, email: r.email, nume: r.nume, subiect: facSubiect(r), fisier: numeFisier, semne })
      console.log(`${nr}. ${r.email.padEnd(34)} ${r.nr_lipsuri} lipsuri${semne.length ? '  [' + semne.join(', ') + ']' : ''}`)
    })

    // o pagina care le aduna pe toate, ca sa le rasfoiesti dintr-un loc
    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare emailuri profil</title>
      <body style="font-family:system-ui;background:#faf8f3;padding:24px;">
      <h1 style="font-size:20px;">Previzualizare — ${index.length} emailuri</h1>
      <ol>${index.map(x => `<li><a href="previzualizare/${x.fisier}">${esc(x.email)}</a> — ${esc(x.subiect)}${x.semne.length ? ` <em style="color:#c2604a;">(${esc(x.semne.join(', '))})</em>` : ''}</li>`).join('')}</ol>`
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), cuprins, 'utf8')

    // varianta text a primului email, ca sa vezi cum arata si fara HTML
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(randuri[0]), 'utf8')

    console.log(`\n✓ Nu s-a trimis nimic. Deschide:`)
    console.log(`  ${path.join(DIR_IESIRE, 'previzualizare.html')}`)
    console.log(`\nCiteste macar unul din fiecare fel: unul „repetat”, unul „nu apare in lista”, unul „fara nume”.`)
    console.log(`Cand esti multumit: --mod=test (doar catre tine), apoi --mod=live --confirm-trimit.\n`)
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
    // Trei cazuri cat mai diferite, ca sa vezi toate variantele de text:
    // cel mai gol profil, unul caruia i-am scris deja in iulie, si unul
    // „obisnuit” (cu nume, care apare in lista).
    const dupaLipsuri = [...randuri].sort((a, b) => (+b.nr_lipsuri) - (+a.nr_lipsuri))
    const alese = [
      dupaLipsuri[0],
      randuri.find(r => daNu(r.notificat_iulie)),
      randuri.find(r => r.nume && daNu(r.apare_in_utilizatori)),
      dupaLipsuri[dupaLipsuri.length - 1],
    ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 3)

    tinte = alese.map(r => ({ rand: r, catre, subiectPrefix: '[TEST] ' }))
    console.log(`Trimit ${tinte.length} probe catre ${catre}:`)
    alese.forEach(r => console.log(`  - ca si cum ar fi ${r.email} (${r.nume || 'fara nume'}, ${r.nr_lipsuri} lipsuri, ${daNu(r.notificat_iulie) ? 'repetat' : 'nou'})`))
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

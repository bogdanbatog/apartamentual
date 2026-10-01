#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „trezire” — octombrie 2026
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/emailuri-trezire/
 * 4-lot-pentru-email.sql`) si trimite emailul personal al lui Lucian catre cei
 * cu profil complet care nu sunt in niciun grup. Emailul cere un raspuns scurt
 * („de ce te-ai oprit?”) si ii invita in grupul general de WhatsApp.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend. Acelasi tipar ca `scripts/emailuri-webinar-septembrie/`.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile:
 *
 *        node scripts/emailuri-trezire/trimite-emailuri-trezire.js --csv="cale/catre.csv"
 *
 *   2. TEST — cate un email din fiecare varianta, DOAR catre tine:
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-trezire/trimite-emailuri-trezire.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — cere DOUA steaguri, ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-trezire/trimite-emailuri-trezire.js --csv="cale/catre.csv" --mod=live --confirm-trimit
 *
 * SIGURANTA:
 *   - Cheia API se ia DOAR din variabila de mediu RESEND_API_KEY.
 *   - Fiecare trimitere reusita se scrie in `local/trimise-<data>.json`. La o
 *     re-rulare, adresele deja trimise sunt SARITE automat (din TOATE jurnalele
 *     din folder). Nu sterge fisierele alea.
 *   - Pauza de 600 ms intre trimiteri + reincercare la 429 / 5xx.
 *   - Conturile mai noi de 30 de zile sunt REFUZATE, chiar daca ajung in CSV
 *     (vezi ZILE_MINIME_CONT). Emailul spune „de atunci nu te-am mai vazut”,
 *     ceea ce dupa o saptamana suna a repros.
 *
 * ALTE OPTIUNI:
 *   --subiect=1|2|3     varianta de subiect (vezi SUBIECTE mai jos). Implicit 1.
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

// Emailul e scris la persoana intai, de Lucian, deci si expeditorul poarta
// numele lui. Adresa ramane cea verificata in Resend (domeniul ltfbstudio.ro).
const FROM = 'Lucian Luță de la ApartamenTUal <apartamentual@ltfbstudio.ro>'
// ✏️ Raspunsurile sunt rostul emailului. Daca vrei sa-ti vina direct tie si nu
//    in casuta comuna, schimba adresa de aici (si linia din README).
const REPLY_TO = 'apartamentual@ltfbstudio.ro'
const TEST_EMAIL = 'apartamentual@ltfbstudio.ro'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Cine si-a facut contul mai recent de atat nu primeste emailul (decizia lui
// Lucian, 1 octombrie 2026). SQL-ul ii scoate deja; scriptul verifica a doua oara.
const ZILE_MINIME_CONT = 30

// Linkul de invitatie din `frontend/index.html` (WHATSAPP_URL). Daca il
// regenerezi in WhatsApp, schimba-l in AMANDOUA locurile.
// In grup e pornit „Aproba membrii noi”: dupa trimitere, cineva trebuie sa
// aprobe cererile.
const WHATSAPP_URL = 'https://chat.whatsapp.com/CBkvFTkDyUCALaVB86XS9H'

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Lista vine din campania de webinar din septembrie;
// comparatia se face pe varianta cu litere mici.
const SALUT_FARA_NUME = ['deatharrow', 'vultur', 'alint']

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ✏️ AICI se adauga cine raspunde cu „stop” — nu exista flag de consimtamant
//    pe `profiles`, deci opt-out-ul se tine de mana, ca la campaniile dinainte.
const EXCLUSI_IMPLICIT = [
]

const SUBIECT_IMPLICIT = 1

const SUBIECTE = {
  1: () => 'O întrebare scurtă de la ApartamenTUal',
  2: () => 'Ce te-a oprit după înscriere?',
  3: () => 'Te pot întreba ceva? Un rând e de ajuns',
}

const PREHEADER = 'Vreau să înțeleg ce te-a oprit după înscriere. Un rând ca răspuns e de ajuns.'

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
  console.error('Lipseste --csv="cale/catre/export.csv" (exportul interogarii 4).')
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
// CSV (cu ghilimele si virgule; acelasi parser ca la celelalte campanii)
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

/**
 * Emailul, ca structura de date. Din ea se genereaza SI varianta HTML, SI cea
 * text, ca sa nu ajunga niciodata sa spuna lucruri diferite.
 *
 * ⚠️ Textul e al lui Lucian, la persoana intai (cerinta lui, 1 octombrie 2026).
 *    Nu trece la „noi” cand adaugi o fraza.
 *
 * ⚠️ „Nu te-am mai vazut pe platforma” e reformularea aleasa pentru „n-ai facut
 *    nimic”: vorbeste despre ce n-am vazut eu, nu despre ce n-a facut el.
 *
 * ⚠️ Fara liniuta lunga in tot ce citeste omul (regula din CLAUDE.md). Aici nu
 *    exista niciuna; daca adaugi o fraza, rescrie-o, nu inlocui semnul.
 */
function continut(r) {
  return {
    salut: salut(r),

    inainte: [
      'Sunt Lucian Luță, arhitect și co-fondator ApartamenTUal. Îți mulțumesc că te-ai înscris pe platformă. Am făcut-o ca să se poată întâlni oamenii care nu-și găsesc apartamentul potrivit și vor să-și construiască un bloc împreună cu viitorii vecini.',
      'Ți-ai făcut timp să-ți completezi profilul, și asta nu e puțin lucru. De atunci însă nu te-am mai văzut pe platformă și aș vrea să înțeleg de ce. Poate n-ai avut timp. Poate credeai că e vorba despre altceva. Poate nu știi ce să faci mai departe sau nu ți-e clar cum funcționează. Sau poate e cu totul alt motiv.',
      '**Îmi poți răspunde la acest email, chiar și cu un singur rând?**',
      'Eu, împreună cu alte câteva familii pe care nu le cunoșteam înainte, mi-am construit apartamentul fără dezvoltator. N-a fost ușor și a durat mai mult decât ne așteptam, dar cu o coordonare bună am reușit. Nu vreau să te conving de nimic. Vreau doar să aflu unde s-a oprit drumul tău după înscriere, ca să-l fac mai ușor pentru cei care vin după tine.',
      'Am făcut și un grup general de discuții pe WhatsApp pentru toți cei înscriși pe platformă. Am observat că grupurile formate aici discută mult mai ușor pe WhatsApp-ul lor. Sunt și eu în grup: vorbim liber despre proces și despre experiența mea, iar tu poți pune orice întrebare.',
    ],

    buton: {
      text: 'Intră în grupul de WhatsApp',
      href: WHATSAPP_URL,
      // „Aproba membrii noi” e pornit in grup; fraza spune exact ce urmeaza,
      // fara sa promita cat dureaza.
      sub: 'Cererea de intrare o aprob eu.',
    },

    semnatura: ['Mulțumesc,', 'Lucian Luță', 'arhitect, co-fondator ApartamenTUal'],

    subsol: 'Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal. Scriu rar, doar când am ceva ce te privește direct. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop”.',
  }
}

/** **text** -> <strong>text</strong>, dupa escapare. */
function bold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

/**
 * ⚠️ BUTONUL E TERRACOTTA (#c2604a), NU NEGRU. Vezi comentariul din
 * `scripts/emailuri-noutati-platforma/`: pe negru, in clientii care afiseaza
 * mesajele pe fundal inchis, blocul se topea in fundal si nu se mai vedea ca e
 * un buton.
 *
 * ⚠️ Nu pune apostrofuri inverse in HTML-ul de mai jos, nici in comentarii: tot
 * blocul e un template string, iar un apostrof invers il inchide la mijloc.
 * Se prinde cu `node --check`.
 */
function html(r) {
  const c = continut(r)
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
        ${c.inainte.map(p).join('')}
        <div style="text-align:center;margin:32px 0 24px;">
          <a href="${c.buton.href}" style="display:inline-block;background:#c2604a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;border:1px solid #a54c38;font-weight:700;font-size:16px;">
            ${esc(c.buton.text)}
          </a>
          <p style="margin:10px 0 0;font-size:13px;color:#8a8a8a;">${esc(c.buton.sub)}</p>
        </div>
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
  const linii = [c.salut, '']
  c.inainte.forEach(x => linii.push(fara(x), ''))
  // In varianta text linkul se scrie intreg, pe randul lui: nu exista ancora.
  linii.push(`${c.buton.text}: ${c.buton.href}`, c.buton.sub, '')
  linii.push(...c.semnatura)
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

/**
 * Scriem in fisierul zilei (ora Bucurestiului), dar setul de „deja trimise” se
 * aduna din TOATE jurnalele din folder. Altfel o trimitere la 23:50 re-rulata
 * la 00:10 ar deschide un jurnal gol si tot lotul ar primi emailul a doua oara.
 */
function ziLocala() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' }).format(new Date())
}

function caleJurnal() {
  return path.join(DIR_IESIRE, `trimise-${ziLocala()}.json`)
}

function citesteFisierJurnal(f) {
  if (!fs.existsSync(f)) return []
  try {
    const x = JSON.parse(fs.readFileSync(f, 'utf8'))
    return Array.isArray(x) ? x : []
  } catch { return [] }
}

function citesteJurnalAzi() {
  return citesteFisierJurnal(caleJurnal())
}

function citesteToateJurnalele() {
  if (!fs.existsSync(DIR_IESIRE)) return []
  return fs.readdirSync(DIR_IESIRE)
    .filter(n => /^trimise-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .flatMap(n => citesteFisierJurnal(path.join(DIR_IESIRE, n)))
}

function scrieJurnal(intrari) {
  fs.writeFileSync(caleJurnal(), JSON.stringify(intrari, null, 2), 'utf8')
}

// ─────────────────────────────────────────────────────────────────────────────
// Rularea
// ─────────────────────────────────────────────────────────────────────────────

/** Semnele care fac emailul sa arate altfel. Se uita la SALUTUL calculat. */
function semne(r) {
  return [salut(r) === 'Salut,' ? 'salut simplu' : null].filter(Boolean)
}

/** Cate zile au trecut de la `cont_din` (AAAA-LL-ZZ, ora Bucurestiului). */
function zileDeLa(zi) {
  return Math.floor((Date.parse(ziLocala()) - Date.parse(zi)) / 86400000)
}

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`Nu gasesc fisierul CSV: ${CSV}`)
    process.exit(1)
  }
  fs.mkdirSync(DIR_IESIRE, { recursive: true })

  let randuri = parseCsv(fs.readFileSync(CSV, 'utf8'))

  const obligatorii = ['email', 'nume', 'cont_din']
  const lipsa = obligatorii.filter(c => !(c in (randuri[0] || {})))
  if (lipsa.length) {
    console.error(`CSV-ul nu pare exportul interogarii 4. Lipsesc coloanele: ${lipsa.join(', ')}`)
    process.exit(1)
  }

  // A doua plasa pentru conturile proaspete: SQL-ul ii scoate deja, dar un CSV
  // vechi sau o interogare modificata i-ar putea strecura inapoi.
  const proaspeti = randuri.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.cont_din) || zileDeLa(r.cont_din) < ZILE_MINIME_CONT)
  if (proaspeti.length) {
    console.error(`Conturi mai noi de ${ZILE_MINIME_CONT} de zile (sau fara data) in CSV: ${proaspeti.map(r => `${r.email} (${r.cont_din || '?'})`).join(', ')}`)
    console.error('Nu primesc emailul acesta. Re-exporta interogarea 4 in ziua trimiterii.')
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

  // ── Verificari de igiena inainte de orice trimitere ───────────────────────
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
    console.error(`Adrese duplicate in CSV: ${[...new Set(duplicate)].join(', ')}. Opresc, ca sa nu primeasca nimeni doua emailuri.`)
    process.exit(1)
  }

  const nrSalutSimplu = randuri.filter(r => salut(r) === 'Salut,').length

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari: ${randuri.length}`)
  console.log(`  primesc „Salut,” simplu: ${nrSalutSimplu} (fara pseudonim, plus poreclele din SALUT_FARA_NUME)`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect (varianta ${varSubiect}): „${facSubiect(randuri[0])}”`)
  console.log(`Raspunsurile ajung la: ${REPLY_TO}`)
  console.log(`WhatsApp: ${WHATSAPP_URL}`)
  console.log('')

  // ── TREAPTA 1: proba, fara retea ──────────────────────────────────────────
  if (MOD === 'dry') {
    const dirPreview = path.join(DIR_IESIRE, 'previzualizare')
    fs.mkdirSync(dirPreview, { recursive: true })
    const index = []

    randuri.forEach((r, i) => {
      const nr = String(i + 1).padStart(2, '0')
      const numeFisier = `${nr}-${r.email.replace(/[^a-z0-9._-]/gi, '_')}.html`
      fs.writeFileSync(path.join(dirPreview, numeFisier), html(r), 'utf8')
      const s = semne(r)
      index.push({ nr, email: r.email, subiect: facSubiect(r), fisier: numeFisier, semne: s })
      console.log(`${nr}. ${r.email.padEnd(34)} cont din ${r.cont_din}${s.length ? '  [' + s.join(', ') + ']' : ''}`)
    })

    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare email trezire</title>
      <body style="font-family:system-ui;background:#faf8f3;padding:24px;">
      <h1 style="font-size:20px;">Previzualizare, ${index.length} emailuri</h1>
      <ol>${index.map(x => `<li><a href="previzualizare/${x.fisier}">${esc(x.email)}</a> ${esc(x.subiect)}${x.semne.length ? ` <em style="color:#c2604a;">(${esc(x.semne.join(', '))})</em>` : ''}</li>`).join('')}</ol>`
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), cuprins, 'utf8')
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(randuri[0]), 'utf8')

    console.log(`\n✓ Nu s-a trimis nimic. Deschide:`)
    console.log(`  ${path.join(DIR_IESIRE, 'previzualizare.html')}`)
    console.log(`\nCiteste unul cu nume si unul marcat „salut simplu”. Butonul trebuie sa duca la ${WHATSAPP_URL}.`)
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
    // Cate un exemplar din fiecare varianta care exista in lot (salut pe nume /
    // salut simplu). Pe un lot omogen iese una singura.
    const alese = [
      randuri.find(r => salut(r) !== 'Salut,'),
      randuri.find(r => salut(r) === 'Salut,'),
    ].filter((v, i, a) => v && a.indexOf(v) === i)

    tinte = alese.map(r => ({ rand: r, catre, subiectPrefix: '[TEST] ' }))
    console.log(`Trimit ${tinte.length} probe catre ${catre}:`)
    alese.forEach(r => console.log(`  - ca si cum ar fi ${r.email} („${salut(r)}”)`))
  } else {
    if (!A['confirm-trimit']) {
      console.error('Modul „live” trimite catre TOTI din CSV.')
      console.error('Daca chiar asta vrei, adauga si steagul --confirm-trimit.')
      process.exit(1)
    }
    tinte = randuri.map(r => ({ rand: r, catre: r.email, subiectPrefix: '' }))
  }

  const jurnal = citesteJurnalAzi()
  const dejaTrimise = new Set(
    citesteToateJurnalele()
      .filter(x => x.ok && x.mod === MOD)
      .map(x => `${x.mod}:${x.email}`)
  )
  if (dejaTrimise.size) {
    console.log(`Jurnale gasite in folder: ${dejaTrimise.size} adrese deja servite in modul „${MOD}”. Alea se sar.`)
  }

  let reusite = 0, esecuri = 0, sarite = 0
  for (let i = 0; i < tinte.length; i++) {
    const { rand, catre, subiectPrefix } = tinte[i]
    const cheie = `${MOD}:${rand.email}`

    if (dejaTrimise.has(cheie)) {
      sarite++
      console.log(`(${i + 1}/${tinte.length}) ${rand.email} — SARIT, e deja intr-un jurnal din folder`)
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
  if (esecuri) console.log('Re-ruleaza aceeasi comanda. Cele reusite sunt sarite, se reincearca doar cele esuate.')
}

main().catch(e => { console.error(e); process.exit(1) })

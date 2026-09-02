#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „memento webinar” — 2 septembrie 2026
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/
 * emailuri-webinar-septembrie/1-lot-pentru-email.sql`) si trimite mementoul cu
 * o zi inainte de a doua editie a webinarului (joi, 3 septembrie 2026, 11:30).
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend. Acelasi tipar ca `scripts/emailuri-noutati-platforma/`.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile:
 *
 *        node scripts/emailuri-webinar-septembrie/trimite-emailuri-webinar-septembrie.js --csv="cale/catre.csv"
 *
 *   2. TEST — cate un email din fiecare varianta, DOAR catre tine:
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-webinar-septembrie/trimite-emailuri-webinar-septembrie.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — cere DOUA steaguri, ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-webinar-septembrie/trimite-emailuri-webinar-septembrie.js --csv="cale/catre.csv" --mod=live --confirm-trimit
 *
 * SIGURANTA:
 *   - Cheia API se ia DOAR din variabila de mediu RESEND_API_KEY.
 *   - Fiecare trimitere reusita se scrie in `local/trimise-<data>.json`. La o
 *     re-rulare, adresele deja trimise sunt SARITE automat. Nu sterge fisierul
 *     ala daca nu vrei sa trimiti a doua oara acelorasi oameni.
 *   - Pauza de 600 ms intre trimiteri + reincercare la 429 / 5xx.
 *   - ⚠️ Emailul spune „maine”. Daca il rulezi in ziua webinarului sau dupa,
 *     scriptul REFUZA modul live. Vezi verificarea de data mai jos.
 *
 * UN SINGUR FEL DE EMAIL PENTRU TOATA LUMEA. Spre deosebire de campania din 25
 * august, aici nu conteaza `profil_complet`, `are_grup` sau `are_teren`: butonul
 * duce la Luma, in afara platformei, iar la webinar se intra cu un link, nu cu
 * un cont. Singura diferenta e salutul: `nume` gol → „Salut,” simplu.
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

const FROM = 'ApartamenTUal <apartamentual@ltfbstudio.ro>'
const REPLY_TO = 'apartamentual@ltfbstudio.ro'
const TEST_EMAIL = 'apartamentual@ltfbstudio.ro'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Pentru ele emailul incepe simplu cu „Salut,”.
//
// `vultur` si `alint` s-au adaugat pe 2 septembrie 2026, citind lista cu ochiul:
// „Vultur” e o porecla ca DeathArrow, iar „Alint” pare „Alin T.” scris fara punct
// (aceeasi familie ca `cosmin.tortolea@gmail.com` din lot). Amandoua sunt scrise
// cu litere mici aici; comparatia se face pe varianta mica.
const SALUT_FARA_NUME = ['deatharrow', 'vultur', 'alint']

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ✏️ AICI se adauga cine raspunde cu „stop” — nu exista flag de consimtamant
//    pe `profiles`, deci opt-out-ul se tine de mana, ca la campaniile dinainte.
const EXCLUSI_IMPLICIT = [
]

// ─────────────────────────────────────────────────────────────────────────────
// Webinarul
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ AL PATRULEA LOC in care e scrisa ora webinarului. Celelalte trei:
//    `frontend/index.html`, constanta WEBINAR din
//    `supabase/functions/notify-admins/index.ts` si pagina de pe Luma.
//    Verificate pe 2 septembrie 2026. Un grep prin repo NU acopera Luma.
//
// ⚠️ Fiecare editie are ALT URL Luma. Septembrie 2026 = 00ig0k40.
//
// `data` (ISO) nu apare nicaieri in text: e doar pentru verificarea de mai jos,
// care opreste modul live daca trimiterea aluneca in ziua webinarului sau dupa.
// Emailul spune „maine” de sase ori; trimis in ziua evenimentului ar minti, iar
// trimis a doua zi ar fi o invitatie la trecut.
const WEBINAR = {
  data: '2026-09-03',
  ziSiOra: 'joi, 3 septembrie, ora 11:30, online',
  url: 'https://luma.com/00ig0k40',
}

const SUBIECT_IMPLICIT = 1

const SUBIECTE = {
  1: () => 'Mâine dimineață, la 11:30: primii pași, explicați live',
  2: () => 'Mâine, 3 septembrie: primii pași în construcția în grup',
  3: () => 'Ai cont pe ApartamenTUal și nu știi ce urmează? Mâine îți explicăm',
}

const PREHEADER = 'A doua ediție a webinarului, online și gratuit. De la formarea grupului până la teren, asociere și bani.'

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
 * ⚠️ Textul e al lui Lucian, aprobat pe 2 septembrie 2026. Nu-l rescrie fara
 *    sa treci si prin `email_templates/email-webinar-septembrie.md`, unde scrie
 *    ce s-a schimbat fata de ciorna si de ce.
 *
 * ⚠️ Fara liniuta lunga in tot ce citeste omul (regula din CLAUDE.md). Aici nu
 *    exista niciuna; daca adaugi o fraza, rescrie-o, nu inlocui semnul.
 */
function continut(r) {
  return {
    salut: salut(r),

    intro: [
      'Mâine, 3 septembrie, de la 11:30, ținem a doua ediție a webinarului nostru despre construcția în grup. E online, durează cam o oră, participarea e gratuită.',
      'Îți scriu și pentru că mulți dintre voi v-ați făcut cont pe platformă și v-ați oprit acolo, ceea ce e cât se poate de normal: nu e clar de la început ce urmează. Exact despre asta vorbim mâine, primii pași. Chiar dacă nu ești hotărât să mergi pe drumul acesta și ești doar curios, îți explicăm:',
    ],

    lista: [
      'cum se formează un grup și cum intri într-unul',
      'cum alegi terenul și ce verifici înainte',
      'ce formă de asociere folosești și ce se întâmplă dacă cineva se retrage',
      'cum se plătește, pe etape, și ce spun băncile',
    ],

    dupaLista: [
      'Aducem și ceva nou: i-am întrebat direct pe arhitecții unui proiect din Berlin, construit acum zece ani de 24 de familii, cum au rezolvat ei asocierea, cumpărarea terenului și finanțarea. Ne-au răspuns în detaliu și povestim mâine ce am aflat.',
      'La prima ediție, partea cea mai bună au fost întrebările voastre. Dacă ai una, poți să mi-o trimiți din timp, ca răspuns la acest mail, sau s-o pui live.',
    ],

    buton: {
      text: 'Înscrie-te la webinar',
      href: WEBINAR.url,
      sub: WEBINAR.ziSiOra,
    },

    // ⚠️ Lista de inscrisi e la Luma, nu in baza noastra, deci nu putem scoate
    //    din lot pe cine s-a inscris deja. Fraza a doua rezolva ce filtrul nu poate.
    dupaButon: [
      'Dacă nu poți fi prezent la ora aceea, înscrie-te oricum: îți trimitem înregistrarea după. Iar dacă te-ai înscris deja, ne vedem mâine.',
    ],

    semnatura: ['Lucian', 'ApartamenTUal / LTFB Studio'],

    subsol: 'Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal. Îți scriem rar, doar când se schimbă ceva ce te privește direct. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop”.',
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
 * Pagina iese goala si consola e curata. Se prinde cu `node --check`.
 */
function html(r) {
  const c = continut(r)
  const p = t => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`
  const ul = items => `
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${items.map(i => `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;">${bold(i)}</li>`).join('')}
    </ul>`

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
        ${c.intro.map(p).join('')}
        ${ul(c.lista)}
        ${c.dupaLista.map(p).join('')}
        <div style="text-align:center;margin:32px 0 24px;">
          <!-- Butonul e terracotta, nu negru. Vezi comentariul de deasupra
               functiei html(), unde scrie de ce. -->
          <a href="${c.buton.href}" style="display:inline-block;background:#c2604a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;border:1px solid #a54c38;font-weight:700;font-size:16px;">
            ${esc(c.buton.text)}
          </a>
          <p style="margin:10px 0 0;font-size:13px;color:#8a8a8a;">${esc(c.buton.sub)}</p>
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
  const linii = [c.salut, '']
  c.intro.forEach(x => linii.push(fara(x), ''))
  c.lista.forEach(x => linii.push(`  - ${fara(x)}`))
  linii.push('')
  c.dupaLista.forEach(x => linii.push(fara(x), ''))
  // In varianta text linkul se scrie intreg, pe randul lui: nu exista ancora.
  linii.push(`${c.buton.text}: ${c.buton.href}`, c.buton.sub, '')
  c.dupaButon.forEach(x => linii.push(fara(x), ''))
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
 * ⚠️ CAPCANA ZILEI DIN NUMELE JURNALULUI. Campaniile din august scriau
 * `trimise-<zi UTC>.json` si citeau DOAR fisierul zilei curente. La granita
 * dintre zile asta poate merge in doua feluri, si doar unul e nevinovat:
 *
 *   - deschis jurnalul de IERI  → oamenii de ieri sunt sariti. Neplacut doar
 *     daca vrei sa trimiti aceleiasi liste a doua zi, ceea ce la o campanie
 *     de o singura data nu se intampla niciodata.
 *   - deschis un jurnal GOL     → toata lista primeste emailul A DOUA OARA.
 *
 * O trimitere la 23:50 re-rulata la 00:10 pica exact pe al doilea caz daca ziua
 * e cea locala (fisier nou, gol). Deci nu se rezolva schimband fusul: ziua ramane
 * cea de la Bucuresti pentru fisierul in care SCRIEM (ca sa fie usor de citit
 * cand s-a trimis), dar setul de „deja trimise" se aduna din TOATE jurnalele din
 * folder. Asa, o re-rulare nu are cum sa trimita de doua ori, indiferent de ora.
 */
function ziLocala() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' }).format(new Date())
}

/** Fisierul in care se scrie de acum incolo. */
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

/** Doar intrarile din fisierul de azi: alea se rescriu la fiecare trimitere. */
function citesteJurnalAzi() {
  return citesteFisierJurnal(caleJurnal())
}

/** TOATE intrarile din folder, pentru setul de „deja trimise”. */
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

/**
 * Semnele care fac emailul sa arate altfel. Se scriu si in previzualizare.
 *
 * ⚠️ Se uita la SALUTUL calculat, nu la coloana `nume` goala. Cine are un
 * pseudonim din `SALUT_FARA_NUME` (DeathArrow, Vultur, Alint) are coloana plina
 * dar primeste tot „Salut,” simplu. Numarat pe coloana, contorul spunea 8 acolo
 * unde adevarul e 11.
 */
function semne(r) {
  return [salut(r) === 'Salut,' ? 'salut simplu' : null].filter(Boolean)
}

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`Nu gasesc fisierul CSV: ${CSV}`)
    process.exit(1)
  }
  fs.mkdirSync(DIR_IESIRE, { recursive: true })

  let randuri = parseCsv(fs.readFileSync(CSV, 'utf8'))

  const obligatorii = ['email', 'nume']
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

  // ⚠️ Emailul spune „maine” de sase ori. Trimis in ziua webinarului minte,
  //    trimis a doua zi e o invitatie la trecut. Verificarea e pe ora
  //    Bucurestiului, nu pe UTC.
  const azi = ziLocala()
  if (azi >= WEBINAR.data) {
    console.error(`\n⚠️  Azi e ${azi}, iar webinarul e pe ${WEBINAR.data}.`)
    console.error('Emailul spune „mâine”. Nu-l pot trimite azi fara sa minta.')
    console.error('Daca vrei sa trimiti totusi ceva, rescrie textul din `continut()` intai.')
    if (MOD !== 'dry') process.exit(1)
    console.error('(Continui doar fiindca e proba, care nu trimite nimic.)\n')
  }

  const nrSalutSimplu = randuri.filter(r => salut(r) === 'Salut,').length

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari: ${randuri.length}`)
  console.log(`  primesc „Salut,” simplu: ${nrSalutSimplu} (fara pseudonim, plus poreclele din SALUT_FARA_NUME)`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect (varianta ${varSubiect}): „${facSubiect(randuri[0])}”`)
  console.log(`Webinar: ${WEBINAR.ziSiOra} — ${WEBINAR.url}`)
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
      console.log(`${nr}. ${r.email.padEnd(34)}${s.length ? '  [' + s.join(', ') + ']' : ''}`)
    })

    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare memento webinar</title>
      <body style="font-family:system-ui;background:#faf8f3;padding:24px;">
      <h1 style="font-size:20px;">Previzualizare, ${index.length} emailuri</h1>
      <ol>${index.map(x => `<li><a href="previzualizare/${x.fisier}">${esc(x.email)}</a> ${esc(x.subiect)}${x.semne.length ? ` <em style="color:#c2604a;">(${esc(x.semne.join(', '))})</em>` : ''}</li>`).join('')}</ol>`
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), cuprins, 'utf8')
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(randuri[0]), 'utf8')

    console.log(`\n✓ Nu s-a trimis nimic. Deschide:`)
    console.log(`  ${path.join(DIR_IESIRE, 'previzualizare.html')}`)
    console.log(`\nCiteste unul cu nume si unul marcat „salut simplu”. Verifica butonul: trebuie sa duca la`)
    console.log(`${WEBINAR.url} si sub el sa scrie ${WEBINAR.ziSiOra}.`)
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
    // Cate un exemplar din fiecare varianta care exista in lot. Aici sunt doar
    // doua (salut pe nume / salut simplu), iar pe un lot omogen iese una singura.
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

  // Scriem in fisierul de azi, dar ne uitam in toate. Vezi comentariul de la
  // `citesteToateJurnalele`: un jurnal gol la granita dintre zile inseamna
  // trimitere dubla catre tot lotul.
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

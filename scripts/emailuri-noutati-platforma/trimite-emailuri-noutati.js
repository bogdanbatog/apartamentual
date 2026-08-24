#!/usr/bin/env node
/**
 * =============================================================================
 * TRIMITERE EMAILURI „ce s-a schimbat pe platforma” (august 2026)
 * =============================================================================
 *
 * Citeste CSV-ul exportat din Supabase (interogarea `db_schema/
 * emailuri-noutati-platforma/1-lot-pentru-email.sql`) si trimite anuntul cu
 * modificarile facute pe platforma intre 15 si 23 august.
 *
 * Ruleaza LOCAL, pe calculatorul tau. Nu atinge baza de date, nu atinge
 * platforma, nu atinge zona de plati. Doar citeste un fisier CSV si trimite
 * emailuri prin API-ul Resend. Acelasi tipar ca `scripts/emailuri-profil-incomplet/`.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA (dry-run) — nu trimite nimic, doar scrie pe disc toate emailurile:
 *
 *        node scripts/emailuri-noutati-platforma/trimite-emailuri-noutati.js --csv="cale/catre.csv"
 *
 *   2. TEST — cate un email din fiecare varianta, DOAR catre tine:
 *
 *        $env:RESEND_API_KEY="re_xxx"
 *        node scripts/emailuri-noutati-platforma/trimite-emailuri-noutati.js --csv="cale/catre.csv" --mod=test
 *
 *   3. LOTUL INTREG — cere DOUA steaguri, ca sa nu se intample din greseala:
 *
 *        node scripts/emailuri-noutati-platforma/trimite-emailuri-noutati.js --csv="cale/catre.csv" --mod=live --confirm-trimit
 *
 * SIGURANTA:
 *   - Cheia API se ia DOAR din variabila de mediu RESEND_API_KEY.
 *   - Fiecare trimitere reusita se scrie in `local/trimise-<data>.json`. La o
 *     re-rulare, adresele deja trimise sunt SARITE automat. Nu sterge fisierul
 *     ala daca nu vrei sa trimiti a doua oara acelorasi oameni.
 *   - Pauza de 600 ms intre trimiteri + reincercare la 429 / 5xx.
 *
 * ⚠️ TREI LUCRURI CARE SE SCHIMBA DE LA OM LA OM. Nu le atinge fara sa citesti
 *    `email_templates/email-noutati-platforma-august.md`:
 *
 *   1. `profil_complet=nu` → ALT FINAL SI ALT BUTON. Cine are profilul
 *      incomplet nu ajunge pe homepage: `js/nav.js:716-728` il redirectioneaza
 *      la formularul de profil de pe ORICE pagina. Un buton „Intra in spatiul
 *      tau” l-ar duce in alta parte decat scrie pe el.
 *   2. `are_grup` / `are_teren` = nu la amandoua → primeste fraza care spune ce
 *      vede totusi. Cardurile „Terenurile tale” si „Grupurile tale” lipsesc
 *      pentru el (`frontend/index.html:4202-4204`).
 *   3. `nume` gol → „Salut,” simplu.
 *
 * ALTE OPTIUNI:
 *   --subiect=1|2|3     varianta de subiect (vezi SUBIECTE mai jos). Implicit 1.
 *   --doar-completi     doar cei cu profilul complet (varianta principala).
 *   --doar-incompleti   invers: doar cei cu profilul neterminat.
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
const LINK_ACASA = 'https://apartamentual.ro'
const LINK_PROFIL = 'https://apartamentual.ro/profile-edit-new.html'
const PAUZA_MS = 600            // 2 cereri/secunda la Resend -> 600ms e confortabil
const MAX_INCERCARI = 4

// Pseudonime la care NU dam buna ziua pe nume (porecle care ar suna fals
// intr-un „Salut, X,”). Pentru ele emailul incepe simplu cu „Salut,”.
const SALUT_FARA_NUME = ['deatharrow']

// Adrese scoase din lot din start, oricare ar fi CSV-ul.
// ✏️ AICI se adauga cine raspunde cu „stop” — nu exista flag de consimtamant
//    pe `profiles`, deci opt-out-ul se tine de mana, ca la campaniile dinainte.
const EXCLUSI_IMPLICIT = [
]

const SUBIECT_IMPLICIT = 1

const SUBIECTE = {
  1: () => 'Ce s-a schimbat pe platformă în ultimele două săptămâni',
  2: () => 'Homepage-ul tău e acum spațiul tău de lucru',
  3: () => 'Ți-am pus grupurile, terenurile și oamenii într-un singur ecran',
}

const PREHEADER = 'Grupurile, terenurile și oamenii din zonele tale, într-un singur ecran.'

// ─────────────────────────────────────────────────────────────────────────────
// Webinarul din P.S.
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️ AL TREILEA LOC in care e scrisa ora webinarului. Celelalte doua:
//    `frontend/index.html` (blocul de webinar si `WEBINAR_ORA` din scriptul de
//    la finalul paginii) si pagina de pe Luma. Verificate pe 24 august 2026:
//    joi, 3 septembrie, 11:30, https://luma.com/00ig0k40. Daca se muta ora sau
//    linkul, se muta in toate trei; un grep prin repo NU acopera Luma.
//
// ⚠️ Data e scrisa DE MANA, nu calculata, desi homepage-ul o calculeaza (prima
//    joi a lunii). Aici e corect asa: campania asta se trimite o data, intr-o
//    dimineata anume, si o data gresita lipita de un link Luma vechi ar trimite
//    oamenii la evenimentul de luna trecuta. O data scrisa de mana, cand e
//    gresita, e gresita vizibil. Acelasi rationament ca la emailul de terenuri.
//
// ⚠️ „a doua editie" e o afirmatie despre trecut, nu despre calendar. Homepage-ul
//    spune „in prima joi a fiecarei luni", ceea ce nu contrazice, dar nici nu
//    confirma numaratoarea. Cine schimba luna verifica si cifra.
const WEBINAR = {
  cand: 'Joi, 3 septembrie, de la 11:30',
  url: 'https://luma.com/00ig0k40',
}

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
if (A['doar-completi'] && A['doar-incompleti']) {
  console.error('--doar-completi si --doar-incompleti se exclud reciproc.')
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

const daNu = v => String(v || '').trim().toLowerCase() === 'da'

/**
 * Emailul, ca structura de date. Din ea se genereaza SI varianta HTML, SI cea
 * text, ca sa nu ajunga niciodata sa spuna lucruri diferite.
 *
 * Sectiunile sunt aceleasi pentru toata lumea. Se schimba doar finalul:
 * butonul, fraza de sub el si, pentru cine n-are nici grup nici teren, un rand
 * in plus care spune ce vede totusi.
 */
function continut(r) {
  const profilComplet = daNu(r.profil_complet)
  const areGrup = daNu(r.are_grup)
  const areTeren = daNu(r.are_teren)

  const sectiuni = [
    {
      titlu: 'Homepage-ul, după ce te loghezi, e acum spațiul tău',
      intro: 'Într-un singur ecran vezi:',
      lista: [
        'grupurile tale și ce s-a întâmplat în ele de la ultima ta vizită',
        'terenurile tale, cu câți oameni și câte grupuri sunt interesate de fiecare',
        'utilizatorii noi înscriși care caută în aceleași zone ca tine',
        'pașii de urmat după ce intri într-un grup',
        'ultimul episod din serialul Județului Housing și data următorului webinar',
      ],
      dupa: ['Tot acolo au ajuns și notele tale, care înainte stăteau în profil.'],
    },
    {
      titlu: 'Cauți mai ușor',
      paragrafe: [
        'La terenuri ai o bifă „Doar terenurile din zonele mele”, iar lista începe cu cele mai noi. La utilizatori poți bifa cine are zone comune cu tine, cine s-a înscris în ultimele două săptămâni și cine are interese comune cu tine.',
        'Pagina unui teren și pagina unui grup încep acum cu o scurtă introducere despre ce poți face acolo.',
      ],
    },
    {
      titlu: 'Butonul „Cere consultanță” se numește acum „Ai o întrebare?”',
      paragrafe: [
        'Suna a ofertă și nu-l apăsa nimeni. Întreabă-ne orice nu ți-e clar despre platformă sau despre construcția în grup: răspunde un arhitect din echipă, iar răspunsul scris nu costă nimic.',
      ],
    },
    {
      titlu: 'Ce pregătim',
      lista: [
        '**În fiecare luni, un email cu terenurile noi** apărute în zonele pe care le-ai bifat.',
        '**Etapizarea plăților pe toată durata procesului**, pe procente și pe timp, din experiența de la Județului. Nu ai nevoie de toți banii deodată.',
        '**În grup:** o zonă cu organizarea pe apartamente și un „secretariat” al grupului, cu rezumat actualizat al discuțiilor și al stadiului.',
        '**Episoade noi din serial:** contractul de asociere, partea financiară, alegerea constructorului.',
      ],
    },
  ]

  // ── FINALUL, care se schimba de la om la om ────────────────────────────────
  //
  // Cine n-are profilul terminat NU AJUNGE pe homepage: nav.js il duce la
  // formularul de profil de pe orice pagina. Deci nici butonul, nici fraza de
  // dupa el n-au voie sa fie aceleasi. Nu e o campanie de profil incomplet
  // deghizata: motivul e cel adevarat, adica vrem sa vada ce am construit.
  const buton = profilComplet
    ? { text: 'Intră în spațiul tău', href: LINK_ACASA, sub: 'e chiar prima pagină, după ce te loghezi' }
    : { text: 'Termină-ți profilul', href: LINK_PROFIL, sub: 'durează două-trei minute' }

  const dupaButon = []
  if (!profilComplet) {
    dupaButon.push('La tine e un pas în plus: profilul a rămas neterminat, iar până îl termini platforma te trimite înapoi la el de pe orice pagină. Nu e un zid pus împotriva ta. Spațiul de lucru se construiește din ce scrii acolo: fără orașul și zonele tale, n-are ce terenuri să-ți arate și n-are cu cine să te potrivească.')
  }
  // Doua carduri din sapte lipsesc pentru cine n-are nici grup, nici teren.
  // Fara randul asta, deschide si cauta ceva ce nu exista.
  // ⚠️ Doar pentru cine are profilul terminat. Celuilalt i-am spus deja, mai
  // sus, ca nici nu ajunge pe homepage; doua explicatii una peste alta despre
  // ce n-o sa vada acolo sunt un email care descurajeaza, nu unul care anunta.
  if (profilComplet && !areGrup && !areTeren) {
    dupaButon.push('Ce vezi acolo depinde de ce ai. Dacă n-ai încă niciun grup și niciun teren la favorite, cardurile lor lipsesc, iar în locul lor îți rămân noutățile din zonele tale, oamenii care caută unde cauți și tu, și pașii.')
  }

  // ── PENTRU CINE DOAR SE UITA ───────────────────────────────────────────────
  //
  // Cerut de Lucian, 25 august. Cea mai mare parte a listei n-a facut niciodata
  // nimic pe platforma, si un email care insira noutati fara sa spuna „e in
  // regula asa" ii pune pe toti in intarziere.
  //
  // ⚠️ Conditia e `!areTeren`, NU „nici grup nici teren": indemnul e despre
  //    terenuri, deci cine are deja terenuri salvate l-a facut. Cine e intr-un
  //    grup dar n-a salvat niciun teren il primeste, si e bine, fiindca pentru
  //    grupul lui exact asta lipseste.
  //
  // ⚠️ NU se trimite celor cu profilul neterminat, desi si ei doar se uita.
  //    Motivul e ca sfatul nu se poate urma: `js/nav.js` ii intoarce la profil
  //    de pe ORICE pagina, deci nu pot ajunge la lista de terenuri. Le-am spus
  //    deja, mai sus, ce au de facut intai.
  //
  // Afirmatia „ceilalti vad ca e cineva interesat" e adevarata si scrisa la
  // fel in ghid (`ce-este/cum-functioneaza.html#cum-incepi-pasi`) si in cardul
  // „Terenurile tale" de pe homepage, care arata cati oameni si cate grupuri
  // sunt interesate de fiecare teren.
  if (profilComplet && !areTeren) {
    dupaButon.push('Dacă deocamdată doar te uiți, e în regulă, așa încep cei mai mulți. Un pas mic care ajută totuși: când vezi un teren care ți-ar plăcea, adaugă-l la profilul tău. Nu te obligă la nimic, dar ceilalți văd că e cineva interesat de el, iar grupurile se nasc exact din întâlnirile astea.')
  }

  return {
    salut: salut(r),
    intro: 'Am schimbat destul de mult pe platformă în ultimele două săptămâni. Dacă intri azi, găsești altceva decât ai lăsat, așa că îți spunem pe scurt ce.',
    sectiuni,
    buton,
    dupaButon,
    semnatura: ['Lucian și Liviu', 'ApartamenTUal / LTFB Studio'],
    // P.S.-ul cu webinarul. Merge la TOATA lumea, inclusiv la cei cu profilul
    // neterminat: la webinar se intra cu un link, nu cu un cont.
    // Stă DUPA semnatura, unde ii e locul si unde se citeste.
    ps: {
      text: `${WEBINAR.cand}, ținem a doua ediție a webinarului despre construcția în grup, online și gratuit. La prima ediție, partea cea mai bună au fost întrebările. Te poți înscrie aici:`,
      url: WEBINAR.url,
    },
    subsol: 'Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal. Îți scriem rar, doar când se schimbă ceva ce te privește direct. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop”.',
  }
}

/** **text** -> <strong>text</strong>, dupa escapare. */
function bold(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1a1a1a;">$1</strong>')
}

/**
 * ⚠️ BUTONUL E TERRACOTTA (#c2604a), NU NEGRU. Schimbat pe 24 august 2026, dupa
 * proba pe email. Era #1a1a1a, ca butoanele de pe site. In clientii care afiseaza
 * mesajele pe fundal negru, blocul se topea in fundal si nu se mai vedea ca e un
 * buton. Terracotta e culoarea folosita deja in logo si in linkurile emailurilor
 * noastre, si e mijlocie: se distinge si pe cremul nostru, si pe negru. Marginea
 * mai inchisa ii da o muchie in clientii care schimba fundalul din mers.
 *
 * ⚠️ Aceeasi problema o au si butoanele celorlalte campanii din scripts/emailuri-*,
 * inca negre. Nu s-au atins in sesiunea aia.
 *
 * ⚠️ Nu pune apostrofuri inverse in HTML-ul de mai jos, nici in comentarii: tot
 * blocul e un template string, iar un apostrof invers il inchide la mijloc. Pagina
 * iese goala si consola e curata. Se prinde cu `node --check`.
 */
function html(r) {
  const c = continut(r)
  const p = t => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${bold(t)}</p>`
  const h = t => `<h2 style="margin:28px 0 12px;font-size:16px;line-height:1.4;color:#1a1a1a;font-weight:600;">${bold(t)}</h2>`
  const ul = items => `
    <ul style="margin:0 0 16px;padding-left:20px;">
      ${items.map(i => `<li style="margin:0 0 8px;font-size:15px;line-height:1.6;">${bold(i)}</li>`).join('')}
    </ul>`

  const sectiuniHtml = c.sectiuni.map(s => [
    h(s.titlu),
    s.intro ? p(s.intro) : '',
    s.lista ? ul(s.lista) : '',
    (s.paragrafe || []).map(p).join(''),
    (s.dupa || []).map(p).join(''),
  ].join('')).join('')

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
        ${sectiuniHtml}
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
        <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e3d8;font-size:15px;line-height:1.6;">
          <strong style="color:#1a1a1a;">P.S.</strong> ${esc(c.ps.text)}
          <a href="${c.ps.url}" style="color:#c2604a;font-weight:600;">${esc(c.ps.url)}</a>
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
  const linii = [c.salut, '', c.intro]
  c.sectiuni.forEach(s => {
    linii.push('', fara(s.titlu).toUpperCase())
    if (s.intro) linii.push('', s.intro)
    if (s.lista) s.lista.forEach(i => linii.push(`  - ${fara(i)}`))
    ;(s.paragrafe || []).forEach(x => linii.push('', fara(x)))
    ;(s.dupa || []).forEach(x => linii.push('', fara(x)))
  })
  linii.push('', `${c.buton.text}: ${c.buton.href}`, c.buton.sub)
  c.dupaButon.forEach(x => linii.push('', fara(x)))
  linii.push('', ...c.semnatura)
  // In varianta text linkul se scrie intreg, pe randul lui: nu exista ancora.
  linii.push('', `P.S. ${c.ps.text}`, c.ps.url)
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

/** Semnele care fac emailul sa arate altfel. Se scriu si in previzualizare. */
function semne(r) {
  return [
    !daNu(r.profil_complet) ? 'profil neterminat' : null,
    // Doar cand fraza chiar apare: pentru profilul neterminat e sarita
    // dinadins (vezi `continut`), deci n-are ce cauta in lista de semne.
    (daNu(r.profil_complet) && !daNu(r.are_grup) && !daNu(r.are_teren)) ? 'fara grup si teren' : null,
    !r.nume ? 'fara nume' : null,
  ].filter(Boolean)
}

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`Nu gasesc fisierul CSV: ${CSV}`)
    process.exit(1)
  }
  fs.mkdirSync(DIR_IESIRE, { recursive: true })

  let randuri = parseCsv(fs.readFileSync(CSV, 'utf8'))

  const obligatorii = ['email', 'nume', 'profil_complet', 'are_grup', 'are_teren']
  const lipsa = obligatorii.filter(c => !(c in (randuri[0] || {})))
  if (lipsa.length) {
    console.error(`CSV-ul nu pare exportul interogarii 1. Lipsesc coloanele: ${lipsa.join(', ')}`)
    process.exit(1)
  }

  if (A['doar-completi'])   randuri = randuri.filter(r =>  daNu(r.profil_complet))
  if (A['doar-incompleti']) randuri = randuri.filter(r => !daNu(r.profil_complet))

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
    console.error(`Adrese duplicate in CSV: ${[...new Set(duplicate)].join(', ')} — opresc, ca sa nu primeasca nimeni doua emailuri.`)
    process.exit(1)
  }
  // Coloanele de „da/nu” trebuie sa fie chiar da sau nu. O coloana goala ar
  // trece tacut drept „nu” si ar trimite tuturor varianta pentru profil
  // neterminat, adica un email gresit catre tot lotul.
  const steaguri = ['profil_complet', 'are_grup', 'are_teren']
  const stricate = randuri.filter(r => steaguri.some(c => !['da', 'nu'].includes(String(r[c]).trim().toLowerCase())))
  if (stricate.length) {
    console.error(`Randuri cu steaguri care nu sunt „da” sau „nu” (${stricate.length}): ${stricate.slice(0, 5).map(r => r.email).join(', ')}`)
    console.error('Re-exporta CSV-ul din interogarea 1, nu-l edita de mana.')
    process.exit(1)
  }

  const nrIncompleti = randuri.filter(r => !daNu(r.profil_complet)).length
  const nrGoi = randuri.filter(r => daNu(r.profil_complet) && !daNu(r.are_grup) && !daNu(r.are_teren)).length
  const nrFaraNume = randuri.filter(r => !r.nume).length

  console.log(`\nCSV: ${CSV}`)
  console.log(`Destinatari: ${randuri.length}`)
  console.log(`  cu profilul neterminat:    ${nrIncompleti} (alt buton: „Termina-ti profilul”)`)
  console.log(`  fara grup si fara teren:   ${nrGoi} (primesc fraza despre ce vad totusi)`)
  console.log(`  fara nume afisat:          ${nrFaraNume} (primesc „Salut,” simplu)`)
  console.log(`Mod: ${MOD}`)
  console.log(`Subiect (varianta ${varSubiect}): „${facSubiect(randuri[0])}”`)
  // ⚠️ Aici era un avertisment la peste 80 de destinatari, cat tineam de plafonul
  // de 100 pe zi al planului gratuit Resend. A iesit pe 24 august 2026: contul e
  // pe plan platit, 50.000 pe luna si fara plafon zilnic, deci un lot de campanie
  // nu are cum sa-l atinga. Ce a RAMAS in picioare e cu totul altceva: limita de
  // 2 cereri pe secunda a API-ului, care e a planului tuturor si de care se ocupa
  // `PAUZA_MS`. Nu scoate pauza aia.
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

    const cuprins = `<!doctype html><meta charset="utf-8"><title>Previzualizare emailuri noutati</title>
      <body style="font-family:system-ui;background:#faf8f3;padding:24px;">
      <h1 style="font-size:20px;">Previzualizare — ${index.length} emailuri</h1>
      <ol>${index.map(x => `<li><a href="previzualizare/${x.fisier}">${esc(x.email)}</a> — ${esc(x.subiect)}${x.semne.length ? ` <em style="color:#c2604a;">(${esc(x.semne.join(', '))})</em>` : ''}</li>`).join('')}</ol>`
    fs.writeFileSync(path.join(DIR_IESIRE, 'previzualizare.html'), cuprins, 'utf8')
    fs.writeFileSync(path.join(DIR_IESIRE, 'exemplu-text.txt'), text(randuri[0]), 'utf8')

    console.log(`\n✓ Nu s-a trimis nimic. Deschide:`)
    console.log(`  ${path.join(DIR_IESIRE, 'previzualizare.html')}`)
    console.log(`\nCiteste macar unul din fiecare fel: unul curat, unul „profil neterminat”,`)
    console.log(`unul „fara grup si teren”, unul „fara nume”.`)
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
    // Cate un exemplar din fiecare varianta de text care exista in lot. Pe un
    // lot omogen ies mai putine de patru; nu e defectiune.
    const alese = [
      randuri.find(r => daNu(r.profil_complet) && (daNu(r.are_grup) || daNu(r.are_teren)) && r.nume),
      randuri.find(r => !daNu(r.profil_complet)),
      randuri.find(r => daNu(r.profil_complet) && !daNu(r.are_grup) && !daNu(r.are_teren)),
      randuri.find(r => !r.nume),
    ].filter((v, i, a) => v && a.indexOf(v) === i)

    tinte = alese.map(r => ({ rand: r, catre, subiectPrefix: '[TEST] ' }))
    console.log(`Trimit ${tinte.length} probe catre ${catre}:`)
    alese.forEach(r => console.log(`  - ca si cum ar fi ${r.email} (${r.nume || 'fara nume'}${semne(r).length ? ', ' + semne(r).join(', ') : ', varianta curata'})`))
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

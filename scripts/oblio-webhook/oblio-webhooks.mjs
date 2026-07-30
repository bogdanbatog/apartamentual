#!/usr/bin/env node
/**
 * oblio-webhooks.mjs — administrare webhook-uri Oblio, din linia de comandă.
 *
 * DE CE EXISTĂ: pe 29 iulie 2026 prima comandă reală plătită (APT-20260729-80d946)
 * a rămas `pending_payment` la noi, fiindcă Oblio nu ne-a apelat niciodată
 * `oblio-webhook`. Nu exista nicăieri codul care înregistrează webhook-ul.
 * Scriptul ăsta îl înregistrează, îl listează și îl șterge.
 *
 * NU ATINGE NIMIC din platformă: nici baza de date, nici funcțiile edge,
 * nici frontendul. Vorbește DOAR cu API-ul Oblio.
 *
 * CHEILE se citesc din variabile de mediu, niciodată din linia de comandă
 * (linia de comandă rămâne în istoricul PowerShell; variabilele de mediu, nu):
 *
 *   $env:OBLIO_API_EMAIL  = "..."     # emailul de cont Oblio (client_id)
 *   $env:OBLIO_API_SECRET = "..."     # secretul din Oblio -> Setari -> API
 *   $env:OBLIO_CIF        = "RO..."   # CIF-ul firmei, ca în Oblio
 *
 * FOLOSIRE:
 *   node oblio-webhooks.mjs list
 *   node oblio-webhooks.mjs register --topic=Collect/Inserted --endpoint=https://... --confirm
 *   node oblio-webhooks.mjs delete --id=123 --confirm
 *
 * `register` și `delete` REFUZĂ să pornească fără `--confirm` (aceeași plasă
 * de siguranță ca la scriptul de campanie din scripts/emailuri-zone/).
 */

const API = 'https://www.oblio.eu/api'

// ---------------------------------------------------------------- argumente

const argv = process.argv.slice(2)
const comanda = argv.find(a => !a.startsWith('--')) || ''
const steag = (nume) => {
  const gasit = argv.find(a => a === `--${nume}` || a.startsWith(`--${nume}=`))
  if (!gasit) return null
  return gasit.includes('=') ? gasit.slice(gasit.indexOf('=') + 1) : true
}

// ------------------------------------------------------------------ ajutoare

/**
 * Ascunde cheia din orice adresă afișată în consolă.
 * OBLIGATORIU la afișarea răspunsurilor brute de la Oblio: la înregistrare,
 * Oblio întoarce în răspuns endpoint-ul COMPLET, deci cu tot cu ?k=...
 * (așa a ajuns cheia pe ecran prima dată, pe 30 iulie 2026).
 */
function mascheaza(text) {
  return String(text ?? '').replace(/([?&]k=)[^&"'\\\s]+/g, '$1***')
}

function iesiCuEroare(mesaj) {
  console.error(`\n  EROARE: ${mesaj}\n`)
  process.exit(1)
}

function citesteMediu() {
  const email = process.env.OBLIO_API_EMAIL
  const secret = process.env.OBLIO_API_SECRET
  const cif = process.env.OBLIO_CIF
  const lipsa = []
  if (!email) lipsa.push('OBLIO_API_EMAIL')
  if (!secret) lipsa.push('OBLIO_API_SECRET')
  if (!cif) lipsa.push('OBLIO_CIF')
  if (lipsa.length) {
    iesiCuEroare(
      `lipsesc variabilele de mediu: ${lipsa.join(', ')}\n` +
      `  Setează-le în PowerShell, de exemplu:\n` +
      `    $env:OBLIO_API_EMAIL="contul@tau.ro"\n` +
      `    $env:OBLIO_API_SECRET="..."\n` +
      `    $env:OBLIO_CIF="RO12345678"`
    )
  }
  return { email, secret, cif }
}

/** Autentificare OAuth2 client_credentials — exact ca în creeaza-proforma-oblio. */
async function iaToken({ email, secret }) {
  const resp = await fetch(`${API}/authorize/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: email,
      client_secret: secret,
      grant_type: 'client_credentials',
    }).toString(),
  })
  const text = await resp.text()
  if (!resp.ok) iesiCuEroare(`autentificare Oblio eșuată (HTTP ${resp.status}): ${text}`)
  let json
  try { json = JSON.parse(text) } catch { iesiCuEroare(`răspuns neinteligibil la autentificare: ${text}`) }
  if (!json.access_token) iesiCuEroare(`Oblio nu a întors access_token: ${text}`)
  return json.access_token
}

/** Apel autentificat către API-ul Oblio, cu raportare clară a erorilor. */
async function apel(token, metoda, cale, corp = null) {
  const resp = await fetch(`${API}${cale}`, {
    method: metoda,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: corp ? JSON.stringify(corp) : undefined,
  })
  const text = await resp.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* lăsăm textul brut */ }
  return { httpStatus: resp.status, json, text }
}

// ------------------------------------------------------------------ comenzi

async function cmdList(token, cif) {
  const r = await apel(token, 'GET', `/webhooks?cif=${encodeURIComponent(cif)}`)
  console.log(`\n  HTTP ${r.httpStatus}`)

  const lista = r.json?.data
  if (!Array.isArray(lista)) {
    console.log('  Răspuns brut de la Oblio:\n')
    console.log('  ' + mascheaza(r.text || '(gol)').replace(/\n/g, '\n  '))
    console.log()
    return
  }

  if (lista.length === 0) {
    console.log('\n  ZERO webhook-uri înregistrate pentru acest CIF.')
    console.log('  Adică Oblio nu are unde să ne anunțe că o proformă a fost încasată.\n')
    return
  }

  console.log(`\n  ${lista.length} webhook(uri) înregistrate:\n`)
  for (const w of lista) {
    console.log(`    id:       ${w.id}`)
    console.log(`    topic:    ${w.topic}`)
    console.log(`    endpoint: ${mascheaza(w.endpoint)}`)
    console.log()
  }
}

async function cmdRegister(token, cif) {
  const topic = steag('topic')
  const endpoint = steag('endpoint')

  if (!topic || topic === true) iesiCuEroare('lipsește --topic=... (ex: Collect/Inserted)')
  if (!endpoint || endpoint === true) iesiCuEroare('lipsește --endpoint=https://...')
  if (!String(endpoint).startsWith('https://')) iesiCuEroare('endpoint-ul trebuie să fie https://')

  console.log('\n  Se înregistrează webhook:')
  console.log(`    cif:      ${cif}`)
  console.log(`    topic:    ${topic}`)
  // Ascundem tokenul din URL în afișare — endpoint-ul conține cheia de acces.
  console.log(`    endpoint: ${String(endpoint).replace(/([?&]k=)[^&]+/, '$1***')}`)

  if (steag('confirm') !== true) {
    console.log('\n  OPRIT: adaugă --confirm ca să se trimită efectiv.\n')
    process.exit(0)
  }

  const r = await apel(token, 'POST', '/webhooks', { cif, topic, endpoint })
  console.log(`\n  HTTP ${r.httpStatus}`)
  console.log('  ' + mascheaza(r.text || '(gol)').replace(/\n/g, '\n  '))

  // Oblio răspunde 201 la creare (nu 200) — acceptăm orice 2xx.
  if (r.httpStatus >= 200 && r.httpStatus < 300) {
    console.log(`\n  ÎNREGISTRAT. id = ${r.json?.data?.id}\n`)
  } else {
    console.log(
      `\n  NEÎNREGISTRAT. Cauza cea mai probabilă: Oblio verifică adresa înainte de a o accepta —\n` +
      `  endpoint-ul trebuie să răspundă 200 cu valoarea base64 a headerului X-Oblio-Request-Id.\n` +
      `  Verifică întâi că funcția edge e deployată cu --no-verify-jwt.\n`
    )
  }
}

async function cmdDelete(token) {
  const id = steag('id')
  if (!id || id === true) iesiCuEroare('lipsește --id=... (îl vezi cu `list`)')

  console.log(`\n  Se ȘTERGE webhook-ul cu id = ${id}`)
  if (steag('confirm') !== true) {
    console.log('\n  OPRIT: adaugă --confirm ca să se trimită efectiv.\n')
    process.exit(0)
  }

  const r = await apel(token, 'DELETE', `/webhooks/${encodeURIComponent(id)}`)
  console.log(`\n  HTTP ${r.httpStatus}`)
  console.log('  ' + (r.text || '(gol)').replace(/\n/g, '\n  ') + '\n')
}

// --------------------------------------------------------------------- main

const COMENZI = ['list', 'register', 'delete']

if (!COMENZI.includes(comanda)) {
  console.log(`
  Administrare webhook-uri Oblio.

    node oblio-webhooks.mjs list
    node oblio-webhooks.mjs register --topic=Collect/Inserted --endpoint=https://... --confirm
    node oblio-webhooks.mjs delete --id=123 --confirm

  Cere OBLIO_API_EMAIL, OBLIO_API_SECRET, OBLIO_CIF ca variabile de mediu.
`)
  process.exit(comanda ? 1 : 0)
}

const mediu = citesteMediu()
const token = await iaToken(mediu)

if (comanda === 'list') await cmdList(token, mediu.cif)
if (comanda === 'register') await cmdRegister(token, mediu.cif)
if (comanda === 'delete') await cmdDelete(token)

// Edge Function: publica-articol
// ═══════════════════════════════════════════════════════════════════════════
//
// CE FACE
// Creează sau modifică UN articol din `articles` (căutat după slug) și, dacă
// primește o imagine, o urcă în bucketul `articles`. Atât. Nu șterge nimic,
// nu citește alte tabele, nu atinge utilizatori, grupuri sau plăți.
//
// O folosește scriptul local `scripts/articole/publica-articol.js`, ca Lucian
// să nu mai copieze de mână articolele în admin. Adminul merge exact ca înainte.
//
// POARTA DE INTRARE
// Funcția se deployează cu `--no-verify-jwt`, deci adresa ei e publică. Singura
// poartă e antetul `x-articole-secret`, comparat cu variabila ARTICOLE_SECRET.
// Secret SEPARAT de CRON_SECRET: dacă scapă unul, celălalt rămâne valabil.
// Verificarea eșuează ÎNCHIS: fără secret configurat pe server, refuză tot.
//
// DIFERENȚE FAȚĂ DE ADMIN (intenționate)
// - Slug-ul se dă explicit și nu se schimbă niciodată la corectură (în admin,
//   titlul editat regenerează slug-ul și rupe linkurile).
// - `published_at` se pune O SINGURĂ DATĂ, la prima publicare. O corectură nu
//   mai aduce articolul în capul listei (în admin se rescrie la fiecare salvare).
// - Un articol deja publicat NU poate fi trecut înapoi în ciornă de aici
//   (ar dispărea de pe site dintr-o greșeală de comandă). Se retrage din admin.
// - O imagine nouă se urcă doar la articol nou, la articol fără imagine, sau
//   cu `inlocuieste_imaginea: true`; altfel fiecare corectură ar lăsa în
//   bucket câte o copie orfană.
//
// DEPLOY
//   npx supabase secrets set ARTICOLE_SECRET=<secretul>
//   npx supabase functions deploy publica-articol --no-verify-jwt
//
// CERERE (POST, JSON)
//   {
//     "slug": "ausbauhaus-neukolln-berlin",          // obligatoriu
//     "title": "...", "summary": "...", "content": "<p>...</p>",
//     "category": "exemple",
//     "status": "draft" | "published",
//     "image": { "base64": "...", "tip": "image/jpeg" },   // opțional
//     "inlocuieste_imaginea": false                         // opțional
//   }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-articole-secret',
}

// ── Reglaje ────────────────────────────────────────────────────────────────

// Autorul tuturor articolelor de până acum (verificat 30 oct. 2026).
const AUTOR_IMPLICIT = '5d0d6e30-26d7-4f1e-a959-04bb54d58959'

// ⚠️ Dacă `articles.category` are un CHECK în baza de date, lista de acolo
// decide în ultimă instanță; asta doar oprește greșelile de tastare mai devreme.
const CATEGORII = ['prototip', 'ghiduri', 'exemple', 'primarii', 'legal', 'analize', 'noutati']

const TIPURI_IMAGINE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const IMAGINE_MAX_OCTETI = 5 * 1024 * 1024

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ── Ajutoare ───────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Comparație care nu se oprește la primul caracter diferit, ca timpul de
// răspuns să nu dezvăluie cât din secret a fost ghicit.
function egaleSigur(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

function text(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'doar POST' }, 405)
  }

  // ── 1. Poarta ────────────────────────────────────────────────────────────
  const secretAsteptat = Deno.env.get('ARTICOLE_SECRET')
  if (!secretAsteptat) {
    console.error('ARTICOLE_SECRET nu e configurat — funcția refuză tot.')
    return json({ error: 'ARTICOLE_SECRET neconfigurat pe server' }, 500)
  }
  if (!egaleSigur(req.headers.get('x-articole-secret') || '', secretAsteptat)) {
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
  }

  // ── 2. Cererea ───────────────────────────────────────────────────────────
  let corp: any
  try {
    corp = await req.json()
  } catch {
    return json({ error: 'corpul cererii nu e JSON valid' }, 400)
  }

  const slug = text(corp.slug)
  if (!slug || !SLUG_RE.test(slug) || slug.length > 120) {
    return json({ error: 'slug lipsă sau invalid (doar a-z, 0-9 și cratimă)' }, 400)
  }
  const status = text(corp.status)
  if (status !== 'draft' && status !== 'published') {
    return json({ error: 'status trebuie să fie „draft” sau „published”' }, 400)
  }
  const category = text(corp.category)
  if (category !== null && !CATEGORII.includes(category)) {
    return json({ error: `categorie necunoscută: ${category}` }, 400)
  }

  try {
    // ── 3. Există deja? ────────────────────────────────────────────────────
    const resGasit = await fetch(
      `${supabaseUrl}/rest/v1/articles?select=id,status,image_url,published_at&slug=eq.${encodeURIComponent(slug)}`,
      { headers: antete },
    )
    if (!resGasit.ok) throw new Error(`citirea articolului: ${resGasit.status} ${await resGasit.text()}`)
    const gasite = await resGasit.json()
    const existent = gasite[0] || null

    if (existent && existent.status === 'published' && status === 'draft') {
      return json({
        error: 'articolul e deja publicat; de aici nu se retrage în ciornă. Pentru corecturi folosește --publica, pentru retragere adminul.',
      }, 409)
    }

    // ── 4. Imaginea (opțional) ─────────────────────────────────────────────
    let imageUrl: string | null = null
    let notaImagine = 'fără imagine nouă'
    if (corp.image && corp.image.base64) {
      const ext = TIPURI_IMAGINE[corp.image.tip]
      if (!ext) return json({ error: 'imaginea trebuie să fie jpeg, png sau webp' }, 400)

      if (existent && existent.image_url && corp.inlocuieste_imaginea !== true) {
        notaImagine = 'imagine păstrată (articolul are deja una; trimite inlocuieste_imaginea ca s-o schimbi)'
      } else {
        const octeti = Uint8Array.from(atob(corp.image.base64), (c) => c.charCodeAt(0))
        if (octeti.length > IMAGINE_MAX_OCTETI) {
          return json({ error: 'imaginea depășește 5 MB' }, 400)
        }
        const cale = `${slug}-${Date.now()}.${ext}`
        const resUp = await fetch(`${supabaseUrl}/storage/v1/object/articles/${cale}`, {
          method: 'POST',
          headers: { ...antete, 'Content-Type': corp.image.tip, 'Cache-Control': '3600', 'x-upsert': 'false' },
          body: octeti,
        })
        if (!resUp.ok) throw new Error(`urcarea imaginii: ${resUp.status} ${await resUp.text()}`)
        imageUrl = `${supabaseUrl}/storage/v1/object/public/articles/${cale}`
        notaImagine = 'imagine urcată'
      }
    }

    // ── 5. Rândul din `articles` ───────────────────────────────────────────
    // Se trimit doar câmpurile primite: o corectură doar de text nu golește
    // rezumatul sau imaginea.
    const date: Record<string, unknown> = { status }
    for (const camp of ['title', 'summary', 'content']) {
      if (corp[camp] !== undefined) date[camp] = text(corp[camp])
    }
    if (category !== null) date.category = category
    if (imageUrl) date.image_url = imageUrl
    if (status === 'published' && !(existent && existent.published_at)) {
      date.published_at = new Date().toISOString()
    }

    let res: Response
    if (existent) {
      res = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${existent.id}`, {
        method: 'PATCH',
        headers: { ...antete, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(date),
      })
    } else {
      if (!date.title || !date.content || !date.category) {
        return json({ error: 'la un articol nou sunt obligatorii title, content și category' }, 400)
      }
      res = await fetch(`${supabaseUrl}/rest/v1/articles`, {
        method: 'POST',
        headers: { ...antete, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ ...date, slug, author_id: AUTOR_IMPLICIT }),
      })
    }
    if (!res.ok) throw new Error(`salvarea articolului: ${res.status} ${await res.text()}`)
    const [salvat] = await res.json()

    return json({
      ok: true,
      actiune: existent ? 'modificat' : 'creat',
      slug: salvat.slug,
      status: salvat.status,
      published_at: salvat.published_at,
      image_url: salvat.image_url,
      imagine: notaImagine,
      adresa: `https://apartamentual.ro/news.html#${salvat.slug}`,
    })
  } catch (e) {
    console.error('publica-articol:', e)
    return json({ error: String((e as Error).message || e) }, 500)
  }
})

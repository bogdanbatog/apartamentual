#!/usr/bin/env node
/**
 * =============================================================================
 * PAGINI DE DISTRIBUIRE pentru articole (previzualizarea pe Facebook/WhatsApp)
 * =============================================================================
 *
 * Problema: articolele stau la `news.html#slug`. Facebook si WhatsApp nu ruleaza
 * JS si ignora tot ce e dupa `#`, deci orice articol distribuit arata
 * previzualizarea statica din `news.html` (aceeasi poza, acelasi titlu).
 *
 * Solutia: cate o pagina mica per articol, `frontend/a/<slug>.html`, cu
 * og:title / og:description / og:image proprii. Omul care da click e trimis
 * imediat (JS `location.replace`) la `news.html#<slug>`. Linkul de distribuit
 * devine: https://apartamentual.ro/a/<slug>.html
 *
 * Cum se ruleaza (doar CITESTE din Supabase, cu cheia publica; nu scrie nimic acolo):
 *
 *   node scripts/articole/pagini-distribuire.js
 *
 * Scrie/actualizeaza cate un fisier pentru fiecare articol publicat. Apoi:
 * commit + push + cPanel (Update from Remote, Deploy HEAD Commit), apoi
 * Facebook Sharing Debugger pe adresa /a/<slug>.html („Scrape Again”).
 *
 * De ce NU `<meta http-equiv="refresh">`: crawler-ul Facebook urmeaza
 * redirectul din meta refresh si ar lua din nou previzualizarea din news.html.
 * De aceea redirectul e doar JS (pe care crawlerele nu-l ruleaza).
 * Tot de aceea og:url arata spre pagina /a/ insasi, nu spre news.html.
 *
 * Paginile vechi nu se sterg niciodata: un link distribuit trebuie sa mearga
 * si daca articolul e retras (news.html se descurca singur cu un slug lipsa).
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const RADACINA = path.join(__dirname, '..', '..');
const DIR_PAGINI = path.join(RADACINA, 'frontend', 'a');
const SITE = 'https://apartamentual.ro';
const IMAGINE_IMPLICITA = SITE + '/assets/images/judetul-housing/randari/15-randare-fatada-curte.jpg';

// Cheia publica (aceeasi pe care o foloseste site-ul), citita din config, nu copiata aici.
const cfg = fs.readFileSync(path.join(RADACINA, 'frontend', 'js', 'supabase-config.js'), 'utf8');
const SUPABASE_URL = /SUPABASE_URL\s*=\s*['"]([^'"]+)/.exec(cfg)[1];
const ANON = /SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/.exec(cfg)[1];

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Latimea si inaltimea unei imagini JPEG/PNG, din primii octeti.
// Cu ele, Facebook arata poza mare chiar de la prima distribuire.
function dimensiuni(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const lung = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + lung;
    }
  }
  return null;
}

function pagina(a, img) {
  const url = `${SITE}/a/${a.slug}.html`;
  const tinta = `/news.html#${a.slug}`;
  const titlu = a.title;
  const descriere = a.summary || 'Un articol despre construcția în grup, pe ApartamenTUal.';
  const imagine = a.image_url || IMAGINE_IMPLICITA;
  const dim = img ? `
    <meta property="og:image:width" content="${img.w}">
    <meta property="og:image:height" content="${img.h}">` : '';
  return `<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Pagina de distribuire, generata de scripts/articole/pagini-distribuire.js. Nu se editeaza de mana. -->
    <title>${esc(titlu)} - ApartamenTUal</title>
    <meta name="description" content="${esc(descriere)}">
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="ApartamenTUal">
    <meta property="og:locale" content="ro_RO">
    <meta property="og:title" content="${esc(titlu)}">
    <meta property="og:description" content="${esc(descriere)}">
    <meta property="og:image" content="${esc(imagine)}">${dim}
    <meta property="og:url" content="${url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(titlu)}">
    <meta name="twitter:description" content="${esc(descriere)}">
    <meta name="twitter:image" content="${esc(imagine)}">
    <script>location.replace(${JSON.stringify(tinta)});</script>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
        img { width: 100%; border-radius: 4px; }
        a { color: #1a1a1a; }
    </style>
</head>
<body>
    <p><a href="${tinta}">${esc(titlu)}</a></p>
    <img src="${esc(imagine)}" alt="">
    <p>${esc(descriere)}</p>
    <p><a href="${tinta}">Citește articolul pe ApartamenTUal</a></p>
</body>
</html>
`;
}

(async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/articles?status=eq.published&select=slug,title,summary,image_url&order=published_at.desc`,
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if (!r.ok) throw new Error(`Supabase a raspuns ${r.status}: ${await r.text()}`);
  const articole = await r.json();
  fs.mkdirSync(DIR_PAGINI, { recursive: true });

  let noi = 0, schimbate = 0, la_fel = 0;
  for (const a of articole) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug || '')) { console.log(`  ⛔ sar peste slug invalid: „${a.slug}”`); continue; }
    let img = null;
    try {
      const ri = await fetch(a.image_url || IMAGINE_IMPLICITA);
      if (ri.ok) img = dimensiuni(Buffer.from(await ri.arrayBuffer()));
    } catch { /* fara dimensiuni: Facebook le afla singur, doar ca mai incet */ }

    const avertismente = [];
    if (!a.image_url) avertismente.push('fara imagine: se foloseste randarea Judetului');
    if (!a.summary) avertismente.push('fara rezumat');
    if (img && (img.w < 600 || img.h < 315)) avertismente.push(`imagine mica (${img.w}×${img.h}): Facebook o poate arata ca miniatura`);
    if (/—/.test(`${a.title} ${a.summary || ''}`)) avertismente.push('liniuta lunga in titlu/rezumat');

    const fisier = path.join(DIR_PAGINI, `${a.slug}.html`);
    const continut = pagina(a, img);
    const vechi = fs.existsSync(fisier) ? fs.readFileSync(fisier, 'utf8') : null;
    if (vechi === continut) la_fel++;
    else { fs.writeFileSync(fisier, continut); vechi === null ? noi++ : schimbate++; }

    console.log(`${vechi === null ? '+' : vechi === continut ? ' ' : '~'} ${SITE}/a/${a.slug}.html${img ? `  (${img.w}×${img.h})` : ''}`);
    avertismente.forEach(t => console.log('    ⚠️  ' + t));
  }
  console.log(`\n${articole.length} articole publicate · ${noi} pagini noi · ${schimbate} schimbate · ${la_fel} neschimbate`);
  console.log(`Fisierele: ${DIR_PAGINI}`);
})().catch(e => { console.error('⛔ ' + e.message); process.exitCode = 1; });

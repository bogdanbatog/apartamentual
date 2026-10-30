#!/usr/bin/env node
/**
 * =============================================================================
 * PUBLICARE ARTICOLE pe apartamentual.ro (fără admin)
 * =============================================================================
 *
 * Citeste un fisier-articol (format mai jos) si il trimite edge function-ului
 * `publica-articol`, care il creeaza sau il modifica in tabela `articles`.
 * Nu atinge nimic altceva: nici utilizatori, nici grupuri, nici plati.
 *
 * TREI TREPTE (in ordinea asta, mereu):
 *
 *   1. PROBA — nu trimite nimic. Verifica textul (liniuta lunga, sedile,
 *      „cohousing”, procente de economie) si scrie o previzualizare HTML in
 *      `scripts/articole/local/`, de deschis in browser:
 *
 *        node scripts/articole/publica-articol.js "cale/catre/articol.md"
 *
 *   2. CIORNA — urca articolul ca ciorna (invizibil pe site, se vede in admin):
 *
 *        $env:ARTICOLE_SECRET="..."; node scripts/articole/publica-articol.js "cale/articol.md" --ciorna
 *
 *   3. PUBLICARE — il face public. Tot asa se trimit si corecturile unui
 *      articol deja publicat (data publicarii NU se schimba la corectura):
 *
 *        $env:ARTICOLE_SECRET="..."; node scripts/articole/publica-articol.js "cale/articol.md" --publica
 *
 *   Optional: `--imagine-noua` inlocuieste imaginea unui articol care are deja
 *   una (altfel imaginea existenta ramane si nu se mai urca o copie).
 *
 * Secretul se ia DOAR din `$env:ARTICOLE_SECRET`, niciodata dintr-un fisier.
 * In cmd (nu PowerShell): `set ARTICOLE_SECRET=...` fara ghilimele.
 *
 * FORMATUL FISIERULUI-ARTICOL
 *
 *   ---
 *   slug: ausbauhaus-neukolln-berlin
 *   titlu: Ausbauhaus Neukölln, Berlin: 24 de apartamente și niciunul la fel
 *   rezumat: Cum un grup de familii din Berlin...
 *   categorie: exemple
 *   imagine: card-site-neukolln.jpg
 *   ---
 *   <p>Conținutul, în HTML, exact cum s-ar lipi în admin.</p>
 *
 *   - `slug` = adresa articolului (news.html#slug). Se alege o data si nu se
 *     mai schimba: linkurile din postari duc acolo.
 *   - `categorie`: prototip (serialul) / ghiduri / exemple / primarii.
 *   - `imagine` e optionala; calea e relativa la fisierul-articol.
 *   - Notele de lucru se scriu ca comentariu HTML, <!-- ... -->: nu se trimit.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const URL_FUNCTIE = 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/publica-articol';
const CATEGORII = ['prototip', 'ghiduri', 'exemple', 'primarii'];
const TIPURI = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const DIR_LOCAL = path.join(__dirname, 'local');

// ── Argumente ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const fisier = args.find(a => !a.startsWith('--'));
const mod = args.includes('--publica') ? 'publica' : args.includes('--ciorna') ? 'ciorna' : 'proba';
const imagineNoua = args.includes('--imagine-noua');

if (!fisier) {
  console.error('Lipseste fisierul-articol. Exemplu: node scripts/articole/publica-articol.js "articol.md"');
  process.exit(1);
}
if (args.includes('--publica') && args.includes('--ciorna')) {
  console.error('Alege una: --ciorna SAU --publica.');
  process.exit(1);
}

// ── Citirea fisierului ──────────────────────────────────────────────────────

const brut = fs.readFileSync(fisier, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(brut);
if (!m) {
  console.error('Fisierul trebuie sa inceapa cu antetul intre doua randuri `---` (vezi formatul in capul scriptului).');
  process.exit(1);
}
const antet = {};
m[1].split('\n').forEach(linie => {
  const i = linie.indexOf(':');
  if (i > 0) antet[linie.slice(0, i).trim()] = linie.slice(i + 1).trim();
});
const articol = {
  slug: antet.slug,
  title: antet.titlu,
  summary: antet.rezumat || null,
  category: antet.categorie,
  // Comentariile HTML (<!-- ... -->) sunt note de lucru: nu se trimit.
  content: m[2].replace(/<!--[\s\S]*?-->/g, '').trim(),
};

// ── Verificari ──────────────────────────────────────────────────────────────
// Blocheaza = nu se trimite nimic. Atentie = se afiseaza, decizia e a ta.

const blocheaza = [];
const atentie = [];

if (!articol.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(articol.slug)) blocheaza.push('slug lipsa sau invalid (doar a-z, 0-9 si cratima, fara diacritice)');
if (!articol.title) blocheaza.push('lipseste `titlu`');
if (!articol.content) blocheaza.push('lipseste continutul de sub antet');
if (!CATEGORII.includes(articol.category)) blocheaza.push(`categorie necunoscuta: „${articol.category}” (alege: ${CATEGORII.join(', ')})`);
if (!articol.summary) atentie.push('lipseste `rezumat`: cardul de pe homepage ramane fara text');

// Textul vazut de cititor, fara etichete HTML.
const textCitit = [articol.title, articol.summary, articol.content.replace(/<[^>]+>/g, ' ')].join('\n');

function arataUnde(re, eticheta, lista) {
  let g; const r = new RegExp(re.source, 'g' + (re.flags.includes('i') ? 'i' : ''));
  while ((g = r.exec(textCitit))) {
    const ctx = textCitit.slice(Math.max(0, g.index - 40), g.index + 40).replace(/\s+/g, ' ');
    lista.push(`${eticheta}: „…${ctx}…”`);
  }
}
// Regula din 13 august: fara liniuta lunga in textul citit de oameni.
arataUnde(/—/, 'liniuta lunga', blocheaza);
// Tastatura veche scrie ş/ţ cu sedila (U+015F/U+0163) in loc de virgula.
arataUnde(/[ŞşŢţ]/, 'diacritic cu sedila (ş/ţ in loc de ș/ț)', blocheaza);
// „Co-housing” doar in sectiunile educative din ce-este/.
arataUnde(/co-?housing/i, '„cohousing”', atentie);
// Niciodata procente de economie.
arataUnde(/\d+\s*%[^.]{0,60}(econom|mai ieftin|reduc)|(econom|mai ieftin|reduc)[^.]{0,60}\d+\s*%/i, 'procent de economie?', atentie);

let imagine = null;
if (antet.imagine) {
  const cale = path.resolve(path.dirname(fisier), antet.imagine);
  const tip = TIPURI[path.extname(cale).toLowerCase()];
  if (!fs.existsSync(cale)) blocheaza.push(`imaginea nu exista: ${cale}`);
  else if (!tip) blocheaza.push('imaginea trebuie sa fie .jpg, .png sau .webp');
  else {
    const octeti = fs.readFileSync(cale);
    if (octeti.length > 5 * 1024 * 1024) blocheaza.push('imaginea depaseste 5 MB');
    imagine = { cale, tip, base64: octeti.toString('base64'), marime: octeti.length };
  }
}

// ── Raport ──────────────────────────────────────────────────────────────────

const cuvinte = articol.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log('');
console.log(`Articol:   ${articol.title}`);
console.log(`Adresa:    https://apartamentual.ro/news.html#${articol.slug}`);
console.log(`Categorie: ${articol.category}   ·   ${cuvinte} cuvinte`);
console.log(`Imagine:   ${imagine ? path.basename(imagine.cale) + ' (' + Math.round(imagine.marime / 1024) + ' KB)' : '—'}`);
console.log(`Mod:       ${mod.toUpperCase()}`);
console.log('');
atentie.forEach(a => console.log('  ⚠️  ' + a));
blocheaza.forEach(b => console.log('  ⛔ ' + b));
if (blocheaza.length) {
  console.log('\nNu trimit nimic pana nu se repara ce e marcat cu ⛔.');
  process.exit(1);
}

// Previzualizare locala, la fiecare rulare.
fs.mkdirSync(DIR_LOCAL, { recursive: true });
const prev = path.join(DIR_LOCAL, `previzualizare-${articol.slug}.html`);
fs.writeFileSync(prev, `<!doctype html><meta charset="utf-8"><title>${articol.title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 16px;line-height:1.7;color:#222}
img{width:100%;border-radius:4px}.rez{color:#666;font-size:1.05rem}</style>
${imagine ? `<img src="file:///${imagine.cale.replace(/\\/g, '/')}">` : ''}
<h1>${articol.title}</h1><p class="rez">${articol.summary || ''}</p>${articol.content}`);
console.log(`Previzualizare: ${prev}`);

if (mod === 'proba') {
  console.log('\nPROBA: nimic trimis. Urmatorul pas: --ciorna.');
  process.exit(0);
}

// ── Trimiterea ──────────────────────────────────────────────────────────────

const secret = process.env.ARTICOLE_SECRET;
if (!secret) {
  console.error('\nLipseste $env:ARTICOLE_SECRET.');
  process.exit(1);
}

(async () => {
  const res = await fetch(URL_FUNCTIE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-articole-secret': secret },
    body: JSON.stringify({
      ...articol,
      status: mod === 'publica' ? 'published' : 'draft',
      image: imagine ? { base64: imagine.base64, tip: imagine.tip } : undefined,
      inlocuieste_imaginea: imagineNoua,
    }),
  });
  const raspuns = await res.text();
  let date; try { date = JSON.parse(raspuns); } catch { date = { raspuns }; }
  if (!res.ok) {
    console.error(`\n⛔ HTTP ${res.status}: ${date.error || raspuns}`);
    // exitCode, nu exit(): pe Windows, exit() cu cererea abia inchisa da „Assertion failed”.
    process.exitCode = 1;
    return;
  }
  console.log(`\n✅ ${date.actiune} · ${date.status} · ${date.imagine}`);
  if (date.status === 'published') console.log(`   ${date.adresa}`);
  else console.log('   Ciorna: o vezi in admin. Cand e buna, ruleaza din nou cu --publica.');
})().catch(e => { console.error('\n⛔ ' + e.message); process.exitCode = 1; });

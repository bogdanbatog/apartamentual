#!/usr/bin/env node
/**
 * =============================================================================
 * PAGINILE ARTICOLELOR: /a/<slug>.html (citite de Google, distribuite pe FB/WA)
 * =============================================================================
 *
 * Fiecare articol publicat primește o pagină reală, `frontend/a/<slug>.html`,
 * cu tot textul scris direct în HTML. Așa:
 *   - Google o poate citi și indexa (textul nu mai vine prin JavaScript);
 *   - Facebook și WhatsApp arată poza, titlul și rezumatul articolului;
 *   - fiecare articol are adresa lui: https://apartamentual.ro/a/<slug>.html
 *
 * Istoric: până pe 13 nov. 2026 paginile astea erau doar „ușițe” pentru
 * Facebook (noindex + redirect JS spre news.html#slug). Acum sunt pagina
 * articolului, iar news.html#slug trimite aici (vezi news.html).
 *
 * Cum se ruleaza (doar CITESTE din Supabase, cu cheia publica; nu scrie nimic acolo):
 *
 *   node scripts/articole/pagini-distribuire.js
 *
 * ⚠️ Se rulează după FIECARE articol nou și după FIECARE corectură la un articol
 * publicat: altfel pagina rămâne cu textul vechi. Apoi: commit + push + cPanel,
 * apoi Facebook Sharing Debugger pe adresa /a/<slug>.html („Scrape Again”).
 *
 * Scrie și lista articolelor în frontend/sitemap.xml (între marcajele ARTICOLE).
 *
 * Pagini pentru articole care nu mai sunt publicate (retrase sau cu slug
 * schimbat): nu se șterg, se înlocuiesc cu o pagină mică cu noindex care trimite
 * la lista de articole. Un link vechi distribuit merge în continuare undeva.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');

const RADACINA = path.join(__dirname, '..', '..');
const DIR_PAGINI = path.join(RADACINA, 'frontend', 'a');
const SITEMAP = path.join(RADACINA, 'frontend', 'sitemap.xml');
const SITE = 'https://apartamentual.ro';
const IMAGINE_IMPLICITA = SITE + '/assets/images/judetul-housing/randari/15-randare-fatada-curte.jpg';

// Etichetele rafturilor: la fel ca în news.html (categoryLabels) și pe homepage (RAFTURI).
const RAFTURI = {
  prototip: 'Serialul Județului Housing',
  ghiduri: 'Ghiduri',
  exemple: 'Exemple din Europa',
  primarii: 'Cum ajută primăriile',
  legal: 'Legal',
  analize: 'Analize',
  noutati: 'Noutăți'
};

// Cheia publica (aceeasi pe care o foloseste site-ul), citita din config, nu copiata aici.
const cfg = fs.readFileSync(path.join(RADACINA, 'frontend', 'js', 'supabase-config.js'), 'utf8');
const SUPABASE_URL = /SUPABASE_URL\s*=\s*['"]([^'"]+)/.exec(cfg)[1];
const ANON = /SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)/.exec(cfg)[1];

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const dataRo = iso => iso
  ? new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' })
  : '';

const episod = slug => {
  const m = /^judetului-housing-episodul-(\d+)/.exec(slug || '');
  return m ? +m[1] : null;
};

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

// Navigarea de serial: episodul anterior / următor, dacă sunt publicate.
function navigareEpisoade(a, toate) {
  const cur = episod(a.slug);
  if (cur === null) return '';
  const dupaNr = {};
  toate.forEach(x => { const n = episod(x.slug); if (n !== null) dupaNr[n] = x; });
  const prev = dupaNr[cur - 1], next = dupaNr[cur + 1];
  let h = '';
  if (prev) h += `
            <a class="episode-nav__prev" href="/a/${prev.slug}.html"><span class="episode-nav__label">← Episodul ${cur - 1}</span><span class="episode-nav__title">${esc(prev.title)}</span></a>`;
  if (next) h += `
            <a class="episode-nav__next" href="/a/${next.slug}.html"><span class="episode-nav__label">Episodul ${cur + 1} →</span><span class="episode-nav__title">${esc(next.title)}</span></a>`;
  return h ? `
        <nav class="episode-nav" aria-label="Episoadele serialului">${h}
        </nav>` : '';
}

// Final de episod: newsletter + linkuri mai departe (doar pentru episoadele serialului).
// Formularul îl face să meargă js/newsletter.js, încărcat de footer.js.
function finalEpisod(a) {
  if (episod(a.slug) === null) return '';
  return `
        <div class="episode-outro">
            <p class="episode-outro__lead">Primește episoadele direct pe email:</p>
            <form class="js-newsletter-form episode-outro__form" data-source="news_episod" data-plausible-goal="Newsletter Episod" data-success-msg="Aproape gata: verifică-ți emailul și confirmă abonarea." novalidate>
                <div class="eo-row">
                    <input type="email" placeholder="adresa ta de email" aria-label="Adresa ta de email" required>
                    <button type="submit">Abonează-mă</button>
                </div>
                <p class="episode-outro__micro">Un email pe săptămână, doar când avem ceva de spus. Fără spam.</p>
                <label class="episode-outro__consent">
                    <input type="checkbox" required>
                    <span>Sunt de acord să primesc newsletterul ApartamenTUal și am citit <a href="/gdpr.html">politica de confidențialitate</a>.</span>
                </label>
                <p class="js-newsletter-msg" style="display:none;"></p>
            </form>
            <p class="episode-outro__story">Nu ne cunoști încă? <a href="/povestea-noastra.html">Povestea noastră, de la o pagină de Facebook la un bloc construit împreună →</a></p>
            <p class="episode-outro__story">Vrei să vezi ce se întâmplă acum? <a href="/grupuri.html">Grupurile de construcție care se formează</a> și <a href="/terenuri.html">terenurile căutate pentru ele</a> →</p>
        </div>`;
}

function pagina(a, img, toate) {
  const url = `${SITE}/a/${a.slug}.html`;
  const titlu = a.title;
  const descriere = a.summary || 'Un articol despre construcția în grup, pe ApartamenTUal.';
  const imagine = a.image_url || IMAGINE_IMPLICITA;
  const raft = RAFTURI[a.category] || a.category || '';
  const dim = img ? `
    <meta property="og:image:width" content="${img.w}">
    <meta property="og:image:height" content="${img.h}">` : '';

  // Date structurate (schema.org Article): Google le folosește la afișarea în căutări.
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titlu,
    description: descriere,
    image: [imagine],
    datePublished: a.published_at || undefined,
    dateModified: a.updated_at || a.published_at || undefined,
    inLanguage: 'ro',
    mainEntityOfPage: url,
    author: { '@type': 'Organization', name: 'ApartamenTUal', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'ApartamenTUal', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/apple-touch-icon.png' } }
  }, null, 2).replace(/</g, '\\u003c');

  let sursa = '';
  if (a.source_url) {
    let gazda = a.source_url;
    try { gazda = new URL(a.source_url).hostname.replace(/^www\./, ''); } catch { /* rămâne adresa întreagă */ }
    sursa = `
        <div class="article-source"><i class="fas fa-external-link-alt"></i> Preluat de pe: <a href="${esc(a.source_url)}" target="_blank" rel="noopener">${esc(gazda)}</a></div>`;
  }

  const pozaPrincipala = a.image_url ? `
        <img class="article-full-image" src="${esc(a.image_url)}" alt="${esc(titlu)}">` : '';

  const extra = (a.extra_images || []).filter(Boolean);
  const pozeExtra = extra.length ? `
        <div class="article-extra-images">
${extra.map(u => `            <img src="${esc(u)}" alt="" loading="lazy" onerror="this.style.display='none'">`).join('\n')}
        </div>` : '';

  const textDistribuire = `${titlu} · ApartamenTUal`;

  return `<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Pagina articolului, generată de scripts/articole/pagini-distribuire.js. Nu se editează de mână:
         textul vine din Supabase (tabela articles), se rulează scriptul din nou. -->
    <title>${esc(titlu)} - ApartamenTUal</title>
    <meta name="description" content="${esc(descriere)}">
    <link rel="canonical" href="${url}">
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-DV5BzzPUWOAnlwlSZU8LW.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>
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
    <script type="application/ld+json">
${ld}
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/css/apartamentual-v9.css">
    <link rel="stylesheet" href="/css/articol.css">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="manifest" href="/site.webmanifest">
    <meta name="theme-color" content="#0f172a">
</head>
<body>
    <div id="navigation"></div>

    <article class="article-full">
        <a href="/news.html" class="article-full-back"><i class="fas fa-arrow-left"></i> Înapoi la articole</a>
        <h1>${esc(titlu)}</h1>
        <div class="article-full-meta">
            <a class="article-category-badge" href="/news.html?cat=${esc(a.category || '')}">${esc(raft)}</a>
            <time datetime="${esc(a.published_at || '')}">${dataRo(a.published_at)}</time>
        </div>${sursa}${pozaPrincipala}
        <div class="article-full-content" id="articleContent">
${a.content || ''}
        </div>${pozeExtra}${navigareEpisoade(a, toate)}${finalEpisod(a)}

        <div class="article-share">
            <span class="article-share__label">Distribuie articolul</span>
            <div class="article-share__btns">
                <button type="button" id="shareCopy" class="article-share__btn"><i class="fas fa-link"></i> Copiază link</button>
                <a class="article-share__btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(textDistribuire + ' ' + url)}"><i class="fab fa-whatsapp"></i> WhatsApp</a>
                <a class="article-share__btn" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}"><i class="fab fa-facebook-f"></i> Facebook</a>
            </div>
        </div>

        <div class="article-end-back">
            <a href="/news.html"><i class="fas fa-arrow-left"></i> Vezi toate articolele</a>
        </div>
    </article>

    <div id="footer"></div>

    <script src="/js/supabase-config.js"></script>
    <script src="/js/nav.js"></script>
    <script src="/js/footer.js"></script>
    <script src="/js/login-modal.js"></script>
    <script>
    // Butonul „Copiază link”
    (function () {
        var btn = document.getElementById('shareCopy');
        if (!btn) return;
        btn.onclick = function () {
            navigator.clipboard.writeText(${JSON.stringify(url)}).then(function () {
                var orig = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Link copiat';
                setTimeout(function () { btn.innerHTML = orig; }, 2000);
            });
        };
    })();

    // CTA discret după ~40% din articol, spre /grupuri.html și /terenuri.html
    // (același ca în news.html, insertMidArticleCta). Doar pe articolele cu cel
    // puțin 8 paragrafe: pe cele scurte ar fi mai lung decât textul din jur.
    (function () {
        var c = document.getElementById('articleContent');
        if (!c) return;
        var paras = Array.prototype.filter.call(c.children, function (el) { return el.tagName === 'P'; });
        if (paras.length < 8) return;
        var anchor = paras[Math.floor(paras.length * 0.4)];
        if (!anchor) return;
        var cta = document.createElement('aside');
        cta.className = 'article-midcta';
        cta.innerHTML =
            '<p class="article-midcta__text">Povestea asta e despre un grup care s-a format acum câțiva ani. ' +
            'Între timp se formează altele, și se caută terenuri pentru ele.</p>' +
            '<div class="article-midcta__links">' +
                '<a href="/grupuri.html">Vezi grupurile de construcție</a>' +
                '<a href="/terenuri.html">Vezi terenurile</a>' +
            '</div>';
        anchor.insertAdjacentElement('afterend', cta);
    })();
    </script>
</body>
</html>
`;
}

// Pagina pentru un articol care nu mai e publicat: nu apare în Google și trimite la listă.
function paginaRetrasa(slug) {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Articol care nu mai e publicat. Generată de scripts/articole/pagini-distribuire.js. -->
    <title>Articole - ApartamenTUal</title>
    <meta name="robots" content="noindex, follow">
    <script>location.replace('/news.html');</script>
    <style>body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; } a { color: #1a1a1a; }</style>
</head>
<body>
    <p>Articolul nu mai e disponibil. <a href="/news.html">Vezi toate articolele ApartamenTUal</a></p>
</body>
</html>
`;
}

// Lista articolelor în sitemap.xml, între marcaje. Restul fișierului nu se atinge.
function actualizeazaSitemap(articole) {
  const START = '  <!-- ARTICOLE: generat de scripts/articole/pagini-distribuire.js, nu se editează de mână -->';
  const END = '  <!-- /ARTICOLE -->';
  let xml = fs.readFileSync(SITEMAP, 'utf8');
  const eol = xml.includes('\r\n') ? '\r\n' : '\n';
  const linii = articole.map(a => {
    const zi = (a.updated_at || a.published_at || '').slice(0, 10);
    return `  <url><loc>${SITE}/a/${a.slug}.html</loc>${zi ? `<lastmod>${zi}</lastmod>` : ''}</url>`;
  });
  const bloc = [START, ...linii, END].join(eol);
  const i = xml.indexOf(START.trim()), j = xml.indexOf(END.trim());
  if (i !== -1 && j !== -1) {
    const inceput = xml.lastIndexOf(eol, i) + eol.length;
    xml = xml.slice(0, inceput) + bloc + xml.slice(j + END.trim().length);
  } else {
    xml = xml.replace('</urlset>', bloc + eol + '</urlset>');
  }
  fs.writeFileSync(SITEMAP, xml);
}

(async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/articles?status=eq.published&select=slug,title,summary,content,image_url,extra_images,source_url,category,published_at,updated_at&order=published_at.desc`,
    { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  if (!r.ok) throw new Error(`Supabase a raspuns ${r.status}: ${await r.text()}`);
  const articole = (await r.json()).filter(a => {
    const ok = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(a.slug || '');
    if (!ok) console.log(`  ⛔ sar peste slug invalid: „${a.slug}”`);
    return ok;
  });
  fs.mkdirSync(DIR_PAGINI, { recursive: true });

  let noi = 0, schimbate = 0, la_fel = 0;
  const scrie = (fisier, continut) => {
    const vechi = fs.existsSync(fisier) ? fs.readFileSync(fisier, 'utf8') : null;
    if (vechi === continut) { la_fel++; return ' '; }
    fs.writeFileSync(fisier, continut);
    if (vechi === null) { noi++; return '+'; }
    schimbate++; return '~';
  };

  for (const a of articole) {
    let img = null;
    try {
      const ri = await fetch(a.image_url || IMAGINE_IMPLICITA);
      if (ri.ok) img = dimensiuni(Buffer.from(await ri.arrayBuffer()));
    } catch { /* fara dimensiuni: Facebook le afla singur, doar ca mai incet */ }

    const avertismente = [];
    if (!a.image_url) avertismente.push('fara imagine: se foloseste randarea Judetului');
    if (!a.summary) avertismente.push('fara rezumat (Google va alege singur un fragment)');
    if (img && (img.w < 600 || img.h < 315)) avertismente.push(`imagine mica (${img.w}×${img.h}): Facebook o poate arata ca miniatura`);
    if (/—/.test(`${a.title} ${a.summary || ''} ${a.content || ''}`)) avertismente.push('liniuta lunga „—” in titlu, rezumat sau text');
    if (/ţ|ş|Ţ|Ş/.test(`${a.title} ${a.summary || ''} ${a.content || ''}`)) avertismente.push('diacritice cu sedila (ţ/ş) in loc de virgula (ț/ș)');

    const semn = scrie(path.join(DIR_PAGINI, `${a.slug}.html`), pagina(a, img, articole));
    console.log(`${semn} ${SITE}/a/${a.slug}.html${img ? `  (${img.w}×${img.h})` : ''}`);
    avertismente.forEach(t => console.log('    ⚠️  ' + t));
  }

  // Pagini rămase de la articole care nu mai sunt publicate
  const publicate = new Set(articole.map(a => a.slug));
  for (const f of fs.readdirSync(DIR_PAGINI).filter(f => f.endsWith('.html'))) {
    const slug = f.slice(0, -5);
    if (publicate.has(slug)) continue;
    const semn = scrie(path.join(DIR_PAGINI, f), paginaRetrasa(slug));
    console.log(`${semn} ${SITE}/a/${f}  (nu mai e publicat: trimite la lista de articole, noindex)`);
  }

  actualizeazaSitemap(articole);
  console.log(`\n${articole.length} articole publicate · ${noi} pagini noi · ${schimbate} schimbate · ${la_fel} neschimbate`);
  console.log(`Fisierele: ${DIR_PAGINI}`);
  console.log(`Sitemap actualizat: ${SITEMAP}`);
})().catch(e => { console.error('⛔ ' + e.message); process.exitCode = 1; });

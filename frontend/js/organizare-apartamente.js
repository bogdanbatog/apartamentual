/* ═══════════════════════════════════════════════════════════════════════════
   ÎMPĂRȚIREA APARTAMENTELOR
   organizare-apartamente.html?grup=<uuid>&teren=<uuid>
   ═══════════════════════════════════════════════════════════════════════════

   CE FACE: arată variantele de împărțire dintr-o analiză urbanistică și lasă
   membrii grupului să își aleagă suprafețele și să spună pe ce apartament pun
   ochii.

   DE UNDE VINE FORMA: macheta lucrată cu Lucian în august 2026,
   `handoff/organizare-pagina-proprie-macheta.html`. Acolo datele sunt scrise de
   mână, deci se poate umbla la formă fără bază de date și fără cont. Orice
   schimbare de aspect se încearcă întâi acolo.

   DE UNDE VIN DATELE: `db_schema/organizare-apartamente/1-tabele-analiza-si-interes.sql`.

   ⚠️ NIMIC DIN ANALIZĂ NU SE SCRIE DIN PAGINA ASTA. `analiza_teren`,
   `analiza_varianta`, `analiza_nivel` și `analiza_apartament` au doar SELECT
   pentru `authenticated`, iar datele intră prin SQL Editor. Pagina scrie în
   exact trei tabele, niciuna cu vreun cost în ea:
     · `apartament_suprafata`   cât are fiecare apartament, hotărât de grup
     · `apartament_interes`     cine s-a înscris pe ce
     · `grup_membru_preferinte` ce își dorește fiecare

   ⚠️ JURNALUL cere cele două coloane adăugate de
   `db_schema/organizare-apartamente/4-jurnalul-terenului.sql` pe tabela
   `grup_teren_comments`, care exista dinainte. Fără ele, citirea lui pică și
   secțiunea rămâne goală, fără să strice restul paginii.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
'use strict';

/* ── TIPOLOGIILE ────────────────────────────────────────────────────────────
   Aceleași ca în Urban Analyzer (APT_TYPES). Intervalele NU se citesc de aici,
   ci de pe fiecare apartament (`mpu_min`/`mpu_max`): sunt editabile în UA din
   v263_38c, deci pot diferi de la o analiză la alta. Ce se ia de aici e doar
   eticheta scurtă, pentru casetele înguste de pe telefon. */
const TIPURI = {
  gars:   { scurt: 'Gars.'   },
  studio: { scurt: 'Studio'  },
  cam2:   { scurt: '2 cam'   },
  cam3:   { scurt: '3 cam'   },
  cam34:  { scurt: '3-4 cam' }
};

/* Listă închisă, scrisă la fel în `grup_membru_preferinte.etaj`. Text liber ar
   fi arătat bine și nu s-ar fi putut număra: „câți acceptă parterul" e
   întrebarea care hotărăște dacă parterul se face locuință sau parcare. */
const ETAJE = {
  'orice':            'orice etaj',
  'parter':           'parter',
  'etaj-1-2':         'etaj 1 sau 2',
  'superior':         'etaj superior',
  'ultim':            'ultimul etaj',
  'parter-sau-ultim': 'parter sau ultimul etaj'
};

const COEF_UTIL_IMPLICIT = 0.70;   // Su / Sd, ca în Urban Analyzer
const FACTOR_SUBSOL_IMPLICIT = 0.70;

/* Sub cât nu merită spus că rămâne spațiu neîmpărțit.
   Avertismentul a fost scris pentru golurile mari, unde chiar se mișcă ceva: la
   Galvani, varianta cu 80 mp liberi la parter arată o scumpire de 3,6%. Pornea
   însă la orice gol, iar pe unul de 4 mp ieșea o frază care nu spune nimic:
   „ponderea lui urcă de la 34% la 34% […] cu 0,2% mai mare". Un gol de câțiva
   metri nu e o decizie a grupului, e rotunjirea suprafețelor din analiză.
   Pragul stă pe scumpire, nu pe metri, fiindcă despre scumpire e fraza. */
const PRAG_SCUMPIRE = 0.005;   // 0,5%

const MEMBRI_VIZIBILI = (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) ? 3 : 8;

/* ── STARE ──────────────────────────────────────────────────────────────── */
let grupId = null, terenId = null;
let eu = null;                 // user_id-ul celui logat
let analiza = null;            // rândul din analiza_teren
let variante = [];             // cu niveluri și apartamente înăuntru
let membri = [];               // membrii activi, cu profil și preferințe
let interese = {};             // apartament_id -> [user_id]
let variantaActiva = null;
let deschisMobil = null;       // apartamentul desfășurat pe telefon
let membriToti = false;
let altePagini = [];           // celelalte terenuri ale grupului cu analiză
let alteAlegeri = {};          // user_id -> [titluri de terenuri]
let suntAdmin = false;         // fondatorul: șterge notele, documentele și jurnalul oricui
/* Superadminul vede pagina oricărui grup, dar NU primește butoanele
   fondatorului: `suntAdmin` rămâne strict al fondatorului. Un buton de
   ștergere afișat fără politică în spate eșuează tăcut, exact ca butonul de
   ștergere a anunțurilor, care i se arată superadminului din 13 august și nu
   face nimic când îl apeși. */
let suntSuperAdmin = false;

/* Simularea de prețuri. `null` înseamnă „cifra din analiză”, nu „zero”: așa se
   deosebește un cursor neatins de unul tras exact pe valoarea de pornire, și tot
   așa se șterge simularea, punând `null` la loc. Nu se salvează nicăieri și nu
   pleacă nimic către bază: e o întrebare pe care și-o pune un singur om. */
const simulare = { teren: null, mp: null };
/* Marginile cursoarelor, socotite din cifrele analizei. Terenul se mișcă la fel
   în amândouă direcțiile, fiindcă se negociază în amândouă. Construcția are mai
   mult loc în sus decât în jos, fiindcă acolo e riscul adevărat: la Județului
   Housing costurile au depășit estimările, nu au scăzut sub ele. */
const SIM_TEREN = { jos: 0.75, sus: 1.25, pas: 10000 };
const SIM_MP    = { jos: 0.85, sus: 1.40, pas: 25 };
let simBaza = null;            // cifrele pe care s-au construit cursoarele

const eTelefon = () => window.matchMedia('(max-width: 720px)').matches;
const fmt = n => Math.round(n).toLocaleString('ro-RO');
const mii = n => Math.round(n / 1000);
/* `toFixed` scrie cu punct, iar restul cifrelor din pagină ies prin `fmt`, care
   e pe `ro-RO` și scrie cu virgulă. Fără asta, „0.2%" stătea la doi pași de
   „2.613 €" în aceeași frază. */
const pct = n => n.toFixed(1).replace('.', ',') + '%';
function esc(t){ const d = document.createElement('div'); d.textContent = (t == null ? '' : t); return d.innerHTML; }
function numeMic(id){ const m = membri.find(x => x.id === id); return m ? esc(m.nume.split(' ')[0]) : 'cineva'; }

/* ── STĂRILE PAGINII ────────────────────────────────────────────────────── */
function arataStarea(titlu, text, link){
  const el = document.getElementById('oaStare');
  el.innerHTML = (titlu ? '<p class="oa-stare-titlu">' + esc(titlu) + '</p>' : '') +
                 '<p class="oa-stare-text">' + text + '</p>' +
                 (link ? '<p class="oa-stare-text" style="margin-top:12px">' + link + '</p>' : '');
  el.hidden = false;
  document.getElementById('oaCorp').hidden = true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BANII

   Singura sumă fixă e terenul. Construcția se calculează din suprafața pe care
   grupul a împărțit-o chiar acum, deci scade odată cu apartamentele. Când rămân
   goluri, investiția scade, dar terenul se împarte la mai puțini metri: ponderea
   lui crește, și de aceea golurile sunt neeficiente.

   ⚠️ Spațiul comun al unui nivel (`su_comun_mp`) se construiește, deci intră în
   cost, dar NU se împarte, deci nu intră în cote. Asta face varianta cu parter
   comun mai scumpă pe metru de locuință, și e corect. Se scade din plafon
   înainte de calculul scumpirii, altfel un parter comun de 48 mp apare ca gol
   lăsat de grup.
   ═══════════════════════════════════════════════════════════════════════════ */
/* Cele două prețuri se citesc PRIN funcțiile astea, niciodată direct din
   variantă: când cineva mișcă un cursor de simulare, aici se întoarce cifra lui,
   și tot ce se calculează mai jos o urmează, până la cota fiecărui apartament.
   Simularea stă doar în fila lui și piere la reîncărcare: nu se salvează nimic
   și nimeni din grup nu vede ce a încercat el. Vezi `renderSimulare`. */
function pretTeren(v){ return simulare.teren != null ? simulare.teren : v.costTeren; }
function pretMp(v){ return simulare.mp != null ? simulare.mp : v.costMpSd; }
function simulareActiva(){ return simulare.teren != null || simulare.mp != null; }

function suTeoretic(v){ return v.niveluri.reduce((s, n) => s + n.su, 0); }
function suComun(v){ return v.niveluri.reduce((s, n) => s + (n.suComun || 0), 0); }
function suAlocat(v){ return v.ap.reduce((s, a) => s + a.mpu, 0); }
function suImpartibil(v){ return suTeoretic(v) - suComun(v); }

function costConstructie(v, suUtil){
  const suprateran = (suUtil + suComun(v)) / v.coefUtil * pretMp(v);
  const subsol = (v.subsolSd || 0) * pretMp(v) * v.factorSubsol;
  return suprateran + subsol;
}
function costTotal(v){ return pretTeren(v) + costConstructie(v, suAlocat(v)); }
function cotaTeren(v){ return pretTeren(v) / costTotal(v); }
function eurPeMp(v){ return costTotal(v) / suAlocat(v); }
function eurPeMpPlin(v){
  const su = suImpartibil(v);
  return (pretTeren(v) + costConstructie(v, su)) / su;
}
function bani(v, a){
  const tot = a.mpu * eurPeMp(v), c = cotaTeren(v);
  return { tot: tot, teren: tot * c, constr: tot * (1 - c) };
}

function liberPeNivel(v, nivId){
  const niv = v.niveluri.find(n => n.id === nivId);
  if (!niv) return 0;
  const luat = v.ap.filter(a => a.nivId === nivId).reduce((s, a) => s + a.mpu, 0) + (niv.suComun || 0);
  return Math.max(0, niv.su - luat);
}

/* Cât se poate întinde un apartament: până la maximul tipologiei, dar nu mai
   mult decât lasă nivelul. Plafonul se calculează din CEILALȚI de pe nivel, nu
   din golul curent: în timpul tragerii suprafața celui tras se schimbă la
   fiecare pixel, iar un plafon socotit din ea ar fugi odată cu degetul. */
function plafonPentru(v, a){
  const niv = v.niveluri.find(n => n.id === a.nivId);
  const ceilalti = v.ap.filter(x => x.nivId === a.nivId && x !== a).reduce((s, x) => s + x.mpu, 0)
                 + (niv.suComun || 0);
  return Math.min(a.mpuMax, niv.su - ceilalti);
}

function scorVarianta(v){
  let unul = 0;
  v.ap.forEach(a => { if ((interese[a.id] || []).length === 1) unul++; });
  return { unul: unul, total: v.ap.length, scor: v.ap.length ? unul / v.ap.length : 0 };
}
function culoareFila(scor){
  const h = 35 + (11 - 35) * scor, s = 12 + (58 - 12) * scor, l = 93 + (52 - 93) * scor;
  return { fundal: 'hsl(' + h.toFixed(0) + ',' + s.toFixed(0) + '%,' + l.toFixed(0) + '%)',
           text: l < 66 ? '#F7F4EE' : '#1A1815' };
}

/* Ce vrea omul: profilul e baza, preferința de grup e deasupra. NULL în
   preferință înseamnă „ca în profil", iar întrebarea se pune de fiecare dată,
   ca să nu rămână o copie veche după ce omul își schimbă profilul. */
function camere(m){ return m.pref.camere != null ? m.pref.camere : m.profil.camere; }
function mpDorit(m){ return m.pref.mp != null ? m.pref.mp : m.profil.mp; }
function dinProfil(m){ return m.pref.camere == null && m.pref.mp == null; }

/* ═══════════════════════════════════════════════════════════════════════════
   SCRIERILE

   ⚠️ Suprafața se salvează la ELIBERAREA mânerului, nu la fiecare pixel. O
   tragere de 40 de pixeli înseamnă zeci de schimbări de un metru, iar fiecare
   ar fi un upsert văzut de tot grupul.

   ⚠️ Doi oameni care trag în același timp de apartamente de pe același etaj pot
   depăși împreună plafonul, fiindcă fiecare vede plafonul socotit din ce știe
   el. Nu se pierde nimic: ultimul scris câștigă, iar verificarea (f) din
   migrație prinde depășirea. O blocare pe rând ar fi o unealtă mai complicată
   decât problema.
   ═══════════════════════════════════════════════════════════════════════════ */
async function salveazaSuprafata(a){
  try {
    const { error } = await sb.from('apartament_suprafata').upsert({
      apartament_id: a.id, grup_id: grupId, mpu: a.mpu,
      updated_by: eu, updated_at: new Date().toISOString()
    }, { onConflict: 'apartament_id' });
    if (error) throw error;
  } catch (e) {
    console.warn('nu s-a salvat suprafața:', e);
  }
}

async function comutaInteres(a){
  const arr = interese[a.id] || (interese[a.id] = []);
  const i = arr.indexOf(eu);
  const maInscriu = (i < 0);
  if (maInscriu) arr.push(eu); else arr.splice(i, 1);
  render();
  try {
    if (maInscriu) {
      const { error } = await sb.from('apartament_interes')
        .insert({ apartament_id: a.id, user_id: eu, grup_id: grupId });
      if (error) throw error;
    } else {
      const { error } = await sb.from('apartament_interes')
        .delete().eq('apartament_id', a.id).eq('user_id', eu);
      if (error) throw error;
    }
  } catch (e) {
    /* Punem la loc ce am schimbat în pagină: altfel omul rămâne convins că e
       înscris pe un apartament pe care nimeni altcineva nu îl vede al lui. */
    console.warn('nu s-a salvat interesul:', e);
    const a2 = interese[a.id] || [];
    const j = a2.indexOf(eu);
    if (maInscriu && j >= 0) a2.splice(j, 1); else if (!maInscriu) a2.push(eu);
    render();
    alert('Nu am putut salva. Încearcă din nou.');
  }
}

/* ── RANDAREA ───────────────────────────────────────────────────────────── */
function renderFile(){
  document.getElementById('file').innerHTML = variante.map(function (v) {
    const s = scorVarianta(v), c = culoareFila(s.scor);
    return '<button class="fila' + (v.id === variantaActiva ? ' activ' : '') + '" data-v="' + v.id + '"' +
      ' style="background:' + c.fundal + ';color:' + c.text + '"' +
      ' title="' + esc(v.nume) + ': ' + s.unul + ' din ' + s.total + ' apartamente au un singur doritor">' +
      '<b>' + esc(v.nume) + '</b>' +
      '<small>' + v.ap.length + ' apartamente · ' + fmt(eurPeMp(v)) + ' €/mp</small>' +
      '</button>';
  }).join('');
  document.querySelectorAll('.fila').forEach(function (b) {
    b.onclick = function () { variantaActiva = b.dataset.v; deschisMobil = null; render(); };
  });
}

/* Numele setului, luat din numele variantei. Convenția „P+5 · V1” o pune
   scriptul de import (`scripts/import-analiza/genereaza-sql.js`), fiindcă două
   exporturi din Urban Analyzer își numesc amândouă variantele V1, V2, V3. O
   analiză cu un singur set n-are prefix, și atunci nu se scrie niciun set. */
function numeSet(v){
  const i = v.nume.indexOf(' · ');
  return i > 0 ? v.nume.slice(0, i) : '';
}

/* Deschiderea unui fișier din bucketul privat `analize-fise`. Nu există adresă
   publică de pus în pagină: se cere una semnată, la clic. */
async function deschideDocument(cale, nume, felul){
  /* ⚠️ Fereastra se deschide ÎNAINTE de `await`. Un `window.open` chemat după
     ce s-a întors o promisiune nu mai e legat de clicul omului, iar blocatorul
     de ferestre îl oprește fără să spună nimic. */
  const fereastra = (felul === 'pdf') ? window.open('', '_blank', 'noopener') : null;
  try {
    if (felul === 'pdf') {
      /* Adresă semnată, deschisă în filă: Supabase servește PDF-ul `inline`,
         deci se vede pe loc și nu ajunge în Downloads. */
      const { data, error } = await sb.storage.from('analize-fise')
        .createSignedUrl(cale, 3600);
      if (error) throw error;
      if (fereastra) fereastra.location = data.signedUrl;
      else window.location.href = data.signedUrl;
      return;
    }

    /* KML-ul se ia ca blob, nu ca adresă semnată cu `?download=`.
       ⚠️ Nu din economie, ci fiindcă altfel nu putem ști ce se întâmplă:
       `Content-Disposition` nu e un antet expus de CORS, deci din pagină nu se
       poate verifica nici măcar cu `fetch` dacă adresa chiar descarcă. Dacă
       n-ar descărca, clicul ar duce pagina la un document XML și omul și-ar
       pierde locul din analiză. Un blob de aceeași origine ascultă sigur de
       atributul `download`, iar fișierele astea au 4 KB. */
    const { data, error } = await sb.storage.from('analize-fise').download(cale);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nume || 'volum.kml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* Adresa se eliberează târziu, nu imediat după clic: descărcarea abia a
       pornit, iar o eliberare pe loc o poate reteza. */
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err) {
    if (fereastra) fereastra.close();
    console.warn('document analiză:', err);
    alert('Nu am putut deschide fișierul.');
  }
}

/* Fișa PDF și volumul KML, pe seturi, TOATE odată.
   ⚠️ Prima formă arăta doar documentele setului deschis, iar eticheta purta
   numele lui („Fișa P+5") ca să se vadă că se schimbă odată cu fila. Nu se
   vede: linkurile stau DEASUPRA filelor, deci apeși jos și se schimbă ceva sus,
   în afara privirii. Un rând fix pe set nu cere nimănui să bage de seamă. */
function renderDocumenteleAnalizei(){
  const el = document.getElementById('oaFisa');

  const seturi = [];
  variante.forEach(function (v) {
    if (!v.pdfPath && !v.kmlPath) return;
    const cheie = numeSet(v);
    let s = seturi.find(x => x.cheie === cheie);
    if (!s) { s = { cheie: cheie, pdf: null, kml: null }; seturi.push(s); }
    /* Toate variantele unui set poartă aceleași căi, deci prima le dă pe ale
       tuturor. Vezi migrația 12. */
    if (!s.pdf && v.pdfPath) s.pdf = { cale: v.pdfPath, nume: v.pdfNume };
    if (!s.kml && v.kmlPath) s.kml = { cale: v.kmlPath, nume: v.kmlNume };
  });

  /* O analiză cu un singur set își ține fișa pe ea, ca până acum. */
  if (!seturi.length && analiza && analiza.pdf_path) {
    seturi.push({ cheie: '', kml: null,
                  pdf: { cale: analiza.pdf_path, nume: analiza.pdf_nume } });
  }

  if (!seturi.length) { el.innerHTML = ''; el.hidden = true; return; }

  el.innerHTML = seturi.map(function (s, i) {
    const legaturi = [];
    if (s.pdf) legaturi.push('<a href="#" data-doc="pdf" data-set="' + i + '">' +
      '<i class="fas fa-file-pdf"></i> Fișa (PDF)</a>');
    if (s.kml) legaturi.push('<a href="#" data-doc="kml" data-set="' + i + '">' +
      '<i class="fas fa-globe"></i> Volumul (KML)</a>');
    return '<span class="oa-doc-rand">' +
      (s.cheie ? '<b class="oa-doc-set">' + esc(s.cheie) + '</b>' : '') +
      legaturi.join(' · ') + '</span>';
  }).join('') +
  (seturi.some(s => s.kml)
    ? '<span class="oa-doc-nota">Volumul se descarcă drept fișier KML și se deschide în ' +
      'Google Earth: dublu clic, dacă îl ai instalat, sau „Import KML” pe earth.google.com. ' +
      'Arată forma clădirii pe teren, nu împărțirea apartamentelor.</span>'
    : '');
  el.hidden = false;

  el.querySelectorAll('a[data-doc]').forEach(function (a) {
    a.onclick = function (e) {
      e.preventDefault();
      const s = seturi[Number(a.dataset.set)];
      const d = (a.dataset.doc === 'pdf') ? s.pdf : s.kml;
      deschideDocument(d.cale, d.nume, a.dataset.doc);
    };
  });
}

/* Locul în care va sta clădirea, cât timp analiza nu există. Casetele sunt
   goale dinadins: o schiță cu cifre inventate ar fi arătat ca niște date
   ascunse sub blur, iar cineva ar fi încercat să le citească. */
function renderSchita(){
  const cont = document.getElementById('variantaCorp');
  const randuri = [[2.6], [1.5, 1.95], [1.5, 1.95], [1.0]];
  cont.innerHTML =
    '<div class="oa-schita" aria-hidden="true">' +
      randuri.map(function (r) {
        const total = r.reduce((s, x) => s + x, 0);
        return '<div class="nivel"><div class="nivel-nume"></div><div class="nivel-ap">' +
          r.map(w => '<div class="ap" style="flex:0 0 calc(' + (w / 2.6 * 34).toFixed(1) + '% - 8px)"></div>').join('') +
          '</div></div>';
      }).join('') +
    '</div>' +
    '<div class="oa-schita-mesaj">' +
      '<p class="oa-schita-titlu">Aici va fi împărțirea pe apartamente</p>' +
      '<p>După analiza preliminară a terenului: variantele de împărțire, suprafețele și ' +
      'costul fiecărui apartament. Până atunci, folosiți pagina ca să scrieți ce își dorește ' +
      'fiecare.</p>' +
      '<p class="oa-schita-cta"><a href="analize.html?teren_id=' + encodeURIComponent(terenId) + '">' +
      'Cere o analiză pentru terenul acesta →</a></p>' +
    '</div>';
}

function renderVarianta(){
  const v = variante.find(x => x.id === variantaActiva);
  const cont = document.getElementById('variantaCorp');
  if (!v) { renderSchita(); return; }

  const alocat = suAlocat(v), impartibil = suImpartibil(v);
  const nedistribuit = impartibil - alocat;
  const scumpire = eurPeMp(v) / eurPeMpPlin(v) - 1;
  const constr = costConstructie(v, alocat);
  const pondere = cotaTeren(v) * 100;
  const pondereaPlin = pretTeren(v) / (pretTeren(v) + costConstructie(v, impartibil)) * 100;
  const comun = suComun(v);

  cont.innerHTML = '<div class="varianta-cap">' +
      '<h3>' + esc(v.nume) + '</h3>' +
      '<div class="desc">' + esc(v.desc || '') + ((v.subsolSd > 0) ? ' · are subsol' : '') + '</div>' +
      '<div class="cifra"><b>' + fmt(eurPeMp(v)) + ' €</b>/mp util</div>' +
      '<div class="cifra"><b>' + fmt(alocat) + ' mp</b> împărțiți din ' + fmt(impartibil) +
        (comun ? ' <span style="font-size:12px">(plus ' + fmt(comun) + ' comuni)</span>' : '') + '</div>' +
      '<div class="cifra">teren <b>' + mii(pretTeren(v)) + ' mii €</b> + construcție <b>' +
        mii(constr) + ' mii €</b> = <b>' + mii(costTotal(v)) + ' mii €</b>' +
        (simulareActiva() ? ' <span class="oa-sim-marca">simulare</span>' : '') + '</div>' +
      (scumpire >= PRAG_SCUMPIRE ? '<div class="avertisment">' +
        '<b>' + fmt(nedistribuit) + ' mp</b> nu sunt încă dați nimănui. Construcția lor nu se mai face, ' +
        'deci investiția scade, dar terenul costă la fel și se împarte la mai puțini metri: ' +
        (pondereaPlin.toFixed(0) !== pondere.toFixed(0)
          ? 'ponderea lui urcă de la <b>' + pondereaPlin.toFixed(0) + '%</b> la <b>' +
            pondere.toFixed(0) + '%</b> din investiție, iar prețul'
          : 'prețul') +
        ' pe metru util e cu <b>' + pct(scumpire * 100) +
        '</b> mai mare decât dacă s-ar împărți tot (' + fmt(eurPeMpPlin(v)) + ' €/mp).' +
      '</div>' : '') +
    '</div>';

  /* Grila comună a variantei: nivelul cel mai încărcat umple rândul, restul se
     raportează la el. Așa o garsonieră arată la fel de îngustă pe orice nivel
     s-ar afla, iar restul rândului rămâne gol. */
  const grila = Math.max.apply(null, v.niveluri.map(n => n.su));
  const lat = mp => '0 0 calc(' + (mp / grila * 100).toFixed(2) + '% - 8px)';
  const niveluri = v.niveluri.slice().sort((a, b) => b.ord - a.ord);

  niveluri.forEach(function (niv) {
    const us = v.ap.filter(a => a.nivId === niv.id).sort((a, b) => a.ord - b.ord);
    const liber = liberPeNivel(v, niv.id);

    const rand = document.createElement('div');
    rand.className = 'nivel';
    rand.innerHTML = '<div class="nivel-nume">' + esc(niv.nume) +
                     '<small>' + fmt(niv.su) + ' mp utili</small></div>';
    const zona = document.createElement('div');
    zona.className = 'nivel-ap';

    us.forEach(function (a) {
      const b_ = bani(v, a);
      const cine = interese[a.id] || [];
      const plafon = plafonPentru(v, a);
      const blocat = (a.mpu <= a.mpuMin && a.mpu >= plafon);
      const scurt = (TIPURI[a.tip] && TIPURI[a.tip].scurt) || a.tipEticheta;

      const el = document.createElement('div');
      el.className = 'ap' + (cine.length > 1 ? ' multi' : cine.length === 1 ? ' unul' : '') +
                     (cine.indexOf(eu) >= 0 ? ' al-meu' : '') +
                     (deschisMobil === a.id ? ' deschis' : '');
      el.style.flex = lat(a.mpu);
      el.dataset.ap = a.id;
      el.innerHTML =
        '<div class="ap-titlu">' +
          '<span class="tip"><span class="tip-lung">' + esc(a.tipEticheta) + '</span>' +
            '<span class="tip-scurt">' + esc(scurt) + '</span></span>' +
          '<span class="mp">' + fmt(a.mpu) + '<span class="mp-unitate"> mp</span></span>' +
          '<span class="ap-jos-sageata" aria-hidden="true">' + (deschisMobil === a.id ? '▴' : '▾') + '</span>' +
        '</div>' +
        '<div class="ap-jos">' +
          '<div class="ap-bani">teren <b>' + mii(b_.teren) + ' mii €</b> + constr. <b>' +
            mii(b_.constr) + ' mii €</b> = <b class="tot">' + fmt(b_.tot) + ' €</b></div>' +
          '<div class="cine">' +
            (cine.indexOf(eu) >= 0 ? '<span class="ap-eu">te interesează</span>' : '') +
            cine.map(id => '<span class="punct">' + numeMic(id) + '</span>').join('') +
          '</div>' +
        '</div>' +
        '<div class="ap-limite"><span>min ' + fmt(a.mpuMin) + '</span><span>max ' + fmt(plafon) + '</span></div>';

      const maner = document.createElement('div');
      maner.className = 'ap-maner' + (blocat ? ' blocat' : '');
      maner.title = 'Trage ca să schimbi suprafața';
      maner.onclick = e => e.stopPropagation();
      maner.onpointerdown = e => incepeTragerea(e, v, a, el);
      el.appendChild(maner);

      el.tabIndex = 0;
      el.onkeydown = function (e) {
        const pas = (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) * (e.shiftKey ? 5 : 1);
        if (!pas) return;
        e.preventDefault();
        if (schimbaSuprafata(v, a, a.mpu + pas)) salveazaSuprafata(a);
      };

      /* Apăsarea face lucruri diferite după lățime, dinadins. Pe ecran lat
         înscrie direct: informația e deja toată sub ochi. Pe telefon deschide
         panoul, fiindcă în casetă nu scrie nici prețul, nici cine mai e pe el,
         iar nimeni n-ar trebui să se înscrie pe ceva ce nu vede. */
      el.onclick = function () {
        if (eTelefon()) {
          deschisMobil = (deschisMobil === a.id) ? null : a.id;
          render();
          return;
        }
        comutaInteres(a);
      };
      zona.appendChild(el);
    });

    if (niv.suComun > 0) {
      const c = document.createElement('div');
      c.className = 'ap comun';
      c.style.flex = lat(niv.suComun);
      c.innerHTML = '<div class="ap-titlu"><span class="tip">Spațiu comun</span>' +
                    '<span class="mp">' + fmt(niv.suComun) + '<span class="mp-unitate"> mp</span></span></div>' +
                    '<div class="ap-jos"><div class="ap-bani">plătit de toți</div></div>';
      zona.appendChild(c);
    }

    if (liber > 0) {
      const g = document.createElement('div');
      g.className = 'gol-nivel';
      g.style.flex = lat(liber);
      g.innerHTML = fmt(liber) + ' mp<br>neîmpărțiți';
      g.title = 'Trage de marginea unui apartament de pe nivelul acesta ca să îi dai suprafața asta';
      zona.appendChild(g);
    }

    rand.appendChild(zona);
    cont.appendChild(rand);

    /* Panoul apartamentului deschis, sub nivelul lui. Doar pe telefon: pe ecran
       lat clasa e ascunsă din CSS, iar `deschisMobil` rămâne gol. */
    const aDeschis = us.find(a => a.id === deschisMobil);
    if (aDeschis) {
      const b_ = bani(v, aDeschis);
      const cine = interese[aDeschis.id] || [];
      const eSum = cine.indexOf(eu) >= 0;
      const plafon = plafonPentru(v, aDeschis);

      const pd = document.createElement('div');
      pd.className = 'ap-detaliu';
      pd.innerHTML =
        '<div class="apd-cap">' + esc(aDeschis.tipEticheta) + ' · ' + esc(niv.nume) +
          ' · <b>' + fmt(aDeschis.mpu) + ' mp utili</b></div>' +
        '<div class="apd-bani">' +
          '<div>cost teren <b>' + fmt(b_.teren) + ' €</b></div>' +
          '<div>cost construcție <b>' + fmt(b_.constr) + ' €</b></div>' +
          '<div class="tot">cost total <b>' + fmt(b_.tot) + ' €</b></div>' +
        '</div>' +
        '<div class="apd-marime"><span>Suprafață</span>' +
          '<button class="apd-pas" data-pas="-1"' + (aDeschis.mpu <= aDeschis.mpuMin ? ' disabled' : '') + '>−</button>' +
          '<b>' + fmt(aDeschis.mpu) + ' mp</b>' +
          '<button class="apd-pas" data-pas="1"' + (aDeschis.mpu >= plafon ? ' disabled' : '') + '>+</button>' +
          '<small>între ' + fmt(aDeschis.mpuMin) + ' și ' + fmt(plafon) + '</small>' +
        '</div>' +
        (cine.length ? '<div class="apd-cine">Interesați: <b>' + cine.map(numeMic).join(', ') + '</b></div>' : '') +
        '<button class="apd-buton' + (eSum ? ' retrage' : '') + '">' +
          (eSum ? 'Retrage-mă de pe apartament' : 'Mă interesează apartamentul') + '</button>';

      pd.querySelectorAll('.apd-pas').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          if (schimbaSuprafata(v, aDeschis, aDeschis.mpu + Number(b.dataset.pas))) salveazaSuprafata(aDeschis);
        };
      });
      pd.querySelector('.apd-buton').onclick = function (e) {
        e.stopPropagation();
        comutaInteres(aDeschis);
      };
      cont.appendChild(pd);
    }
  });
}

function schimbaSuprafata(v, a, cerut){
  const nou = Math.max(a.mpuMin, Math.min(plafonPentru(v, a), Math.round(cerut)));
  if (nou === a.mpu) return false;
  a.mpu = nou;
  render();
  return true;
}

/* ── TRAGEREA DE MARGINEA CASETEI ───────────────────────────────────────── */
let tragere = null;

function incepeTragerea(e, v, a, el){
  e.preventDefault();
  e.stopPropagation();
  /* Scara se ia din caseta însăși: câți pixeli are acum pentru câți metri are
     acum. Mai exact decât o socoteală pe lățimea rândului, fiindcă spațiile
     dintre casete nu intră în ea. */
  tragere = { v: v, a: a, x0: e.clientX, mpu0: a.mpu, pxPerMp: el.offsetWidth / a.mpu, id: a.id };
  el.classList.add('trage');
  document.body.classList.add('se-trage');
  window.addEventListener('pointermove', inTimpulTragerii);
  window.addEventListener('pointerup', terminaTragerea, { once: true });
  window.addEventListener('pointercancel', terminaTragerea, { once: true });
}

function inTimpulTragerii(e){
  if (!tragere) return;
  const dx = e.clientX - tragere.x0;
  schimbaSuprafata(tragere.v, tragere.a, tragere.mpu0 + dx / tragere.pxPerMp);
  /* `render()` reface casetele, deci clasa de „se trage acum" trebuie pusă din
     nou pe cea nouă. Ascultătorii stau pe `window`, nu pe casetă, tocmai ca
     tragerea să nu se rupă când elementul de sub deget e înlocuit. */
  const el = document.querySelector('[data-ap="' + tragere.id + '"]');
  if (el) el.classList.add('trage');
}

function terminaTragerea(){
  window.removeEventListener('pointermove', inTimpulTragerii);
  document.body.classList.remove('se-trage');
  document.querySelectorAll('.ap.trage').forEach(el => el.classList.remove('trage'));
  /* Abia acum se scrie în bază: o tragere înseamnă zeci de schimbări de un
     metru, iar fiecare ar fi un upsert văzut de tot grupul. */
  if (tragere && tragere.a.mpu !== tragere.mpu0) salveazaSuprafata(tragere.a);
  tragere = null;
}

/* ════════════════════════════════════════════════════════════════════════════
   CURSOARELE DE PREȚ

   Două întrebări de tipul „ce-ar fi dacă”: cât se schimbă prețul pe metru util
   dacă terenul se negociază altfel, sau dacă constructorul cere mai mult pe metru.

   ⚠️ NU se salvează și NU se împarte cu grupul, spre deosebire de cursoarele de
   suprafață de mai sus. Suprafețele sunt o decizie a grupului, deci se scriu în
   `apartament_suprafata` și le vede toată lumea. Prețurile nu se hotărăsc, se
   află: din negocierea cu vânzătorul, din oferta constructorului. Dacă fiecare
   și-ar putea fixa prețul pentru toți, cinci familii s-ar uita la cinci totaluri
   diferite fără să vadă de ce, exact în pagina făcută ca să se uite la aceleași
   cifre. Când un preț devine real, se schimbă în analiză, o dată pentru toți.

   ⚠️ Cursorul e unul singur pentru toate variantele, dinadins: dacă fiecare
   variantă ar avea prețul ei simulat, comparația dintre file n-ar mai însemna
   nimic. Marginile se socotesc din varianta deschisă și se refac dacă alta vine
   cu alte cifre de pornire (se poate: `analiza_varianta.cost_teren` există, deși
   la importurile de până acum e mereu NULL).
   ═══════════════════════════════════════════════════════════════════════════ */

/* Marginile unui cursor, rotunjite la pas ca omul să nu vadă cifre ca 449.997. */
function marginiSim(baza, cfg){
  const jos = Math.floor(baza * cfg.jos / cfg.pas) * cfg.pas;
  const sus = Math.ceil(baza * cfg.sus / cfg.pas) * cfg.pas;
  return { jos: jos, sus: sus, pas: cfg.pas };
}

function renderSimulare(){
  const panou = document.getElementById('oaSim');
  if (!panou) return;
  const v = variante.find(x => x.id === variantaActiva);
  panou.hidden = !v;
  if (!v) return;

  const cTeren = document.getElementById('oaSimTeren');
  const cMp    = document.getElementById('oaSimMp');

  /* Cursoarele se refac doar când se schimbă cifrele de pornire, nu la fiecare
     desenare: altfel scrierea lui `value` în timpul tragerii s-ar bate cu degetul
     omului. În restul timpului se împrospătează doar etichetele. */
  const baza = { teren: v.costTeren, mp: v.costMpSd };
  if (!simBaza || simBaza.teren !== baza.teren || simBaza.mp !== baza.mp) {
    simBaza = baza;
    const mT = marginiSim(baza.teren, SIM_TEREN), mM = marginiSim(baza.mp, SIM_MP);
    cTeren.min = mT.jos; cTeren.max = mT.sus; cTeren.step = mT.pas;
    cMp.min    = mM.jos; cMp.max    = mM.sus; cMp.step    = mM.pas;
    /* O simulare pornită pe altă variantă poate cădea în afara noilor margini. */
    if (simulare.teren != null) simulare.teren = Math.min(mT.sus, Math.max(mT.jos, simulare.teren));
    if (simulare.mp != null)    simulare.mp    = Math.min(mM.sus, Math.max(mM.jos, simulare.mp));
    cTeren.value = pretTeren(v);
    cMp.value    = pretMp(v);
  }

  const activa = simulareActiva();
  panou.classList.toggle('activa', activa);
  document.getElementById('oaSimRevino').hidden = !activa;
  document.getElementById('oaSimTerenVal').textContent = fmt(pretTeren(v)) + ' €';
  document.getElementById('oaSimMpVal').textContent    = fmt(pretMp(v)) + ' €/mp';
  document.getElementById('oaSimSursa').innerHTML = activa
    ? '<span class="oa-sim-marca">Simulare.</span> Analiza spune <b>' + fmt(v.costTeren) +
      ' €</b> terenul și <b>' + fmt(v.costMpSd) + ' €/mp</b> construcția. ' +
      'Cifrele de mai jos sunt doar ale tale: nu se schimbă pentru nimeni altcineva din grup. ' +
      'Dacă reîncarci pagina, revin la cele ale analizei. Simularea e a fiecărui tab în parte, ' +
      'deci poți deschide încă unul, cu alt preț, și să le compari alături.'
    : 'Cifrele analizei. Mută un cursor ca să vezi cât se schimbă prețul pe metru util. ' +
      'Ce încerci aici rămâne la tine: ceilalți din grup văd mai departe cifrele analizei, ' +
      'iar dacă reîncarci pagina revii și tu la ele. Ca să compari două ipoteze una lângă alta, ' +
      'deschide pagina în două taburi și pune alt preț în fiecare.';
}

/* Se leagă o singură dată, la pornire. `input`, nu `change`: cifrele se mișcă în
   timp ce tragi, altfel cursorul pare stricat până când îl lași. */
function legSimulare(){
  const cTeren = document.getElementById('oaSimTeren');
  const cMp    = document.getElementById('oaSimMp');
  const revino = document.getElementById('oaSimRevino');
  if (!cTeren || !cMp || !revino) return;

  /* Tras înapoi FIX pe cifra analizei înseamnă că nu mai simulezi nimic, deci se
     scrie `null`, nu valoarea: altfel panoul ar rămâne îmbrăcat în teracotă și ar
     striga „simulare” peste niște cifre care sunt chiar ale analizei. */
  cTeren.addEventListener('input', function(){
    const v = variante.find(x => x.id === variantaActiva);
    const n = Number(cTeren.value);
    simulare.teren = (v && n === v.costTeren) ? null : n;
    render();
  });
  cMp.addEventListener('input', function(){
    const v = variante.find(x => x.id === variantaActiva);
    const n = Number(cMp.value);
    simulare.mp = (v && n === v.costMpSd) ? null : n;
    render();
  });
  revino.addEventListener('click', function(){
    simulare.teren = null; simulare.mp = null;
    simBaza = null;              // forțează rescrierea lui `value` pe cursoare
    render();
  });
}

function renderCosturi(){
  const v = variante.find(x => x.id === variantaActiva);
  if (!v) return;
  const alocat = suAlocat(v);
  document.getElementById('costuri').innerHTML =
  (simulareActiva()
    ? '<p class="oa-sim-banda">Simulare: terenul la ' + fmt(pretTeren(v)) + ' € și construcția la ' +
      fmt(pretMp(v)) + ' €/mp. Nu sunt cifrele analizei.</p>'
    : '') +
  '<table><tr><th>Apartament</th><th>mp utili</th><th>Cost teren</th><th>Cost construcție</th><th>Cost total</th></tr>' +
    v.ap.map(function (a) {
      const b_ = bani(v, a);
      const niv = v.niveluri.find(n => n.id === a.nivId);
      return '<tr><td>' + esc(niv ? niv.nume : '') + ' · ' + esc(a.tipEticheta) + '</td>' +
        '<td>' + fmt(a.mpu) + '</td><td>' + fmt(b_.teren) + ' €</td>' +
        '<td>' + fmt(b_.constr) + ' €</td><td>' + fmt(b_.tot) + ' €</td></tr>';
    }).join('') +
    '<tr class="total-rand"><td>Total împărțit</td><td>' + fmt(alocat) + '</td>' +
      '<td>' + fmt(pretTeren(v)) + ' €</td><td>' + fmt(costConstructie(v, alocat)) + ' €</td>' +
      '<td>' + fmt(costTotal(v)) + ' €</td></tr></table>' +
  '<p class="explica" style="margin-top:10px">Terenul costă ' + fmt(pretTeren(v)) +
    ' € oricât s-ar construi pe el. Construcția se calculează la ' + fmt(pretMp(v)) +
    ' €/mp desfășurat' + (v.subsolSd > 0 ? ', plus subsolul (' + fmt(v.subsolSd) + ' mp, la ' +
      Math.round(v.factorSubsol * 100) + '% din prețul unui metru obișnuit)' : '') +
    ', deci scade dacă apartamentele scad. Fiecare apartament plătește cât la sută din suprafața ' +
    'utilă împărțită reprezintă.</p>';
}

function renderMembri(){
  /* Eu sunt mereu primul: cardul meu are butonul „Modifică", iar dacă ar cădea
     sub tăietură ar trebui să desfac lista ca să îmi completez preferințele. */
  const ordonati = membri.slice().sort((a, b) => (a.id === eu ? -1 : b.id === eu ? 1 : 0));
  const vizibili = membriToti ? ordonati : ordonati.slice(0, MEMBRI_VIZIBILI);
  const ascunsi = ordonati.length - MEMBRI_VIZIBILI;

  document.getElementById('membri').innerHTML = vizibili.map(function (m) {
    const alese = [];
    variante.forEach(v => v.ap.forEach(function (a) {
      if ((interese[a.id] || []).indexOf(m.id) >= 0) {
        const niv = v.niveluri.find(n => n.id === a.nivId);
        alese.push(esc(v.nume) + ' · ' + esc(niv ? niv.nume : '') + ' · ' + esc(a.tipEticheta));
      }
    }));
    const b_ = [];
    /* „Aport propriu", nu „cash": coloana din bază se cheamă `buget_teren_cash`,
       dar cuvântul pe care îl citește omul e cel din discuțiile lui cu banca. */
    if (m.pref.cash)  b_.push('aport propriu <b>' + mii(m.pref.cash) + ' mii €</b>');
    if (m.pref.total) b_.push('total <b>' + mii(m.pref.total) + ' mii €</b>');
    const altele = alteAlegeri[m.id] || [];
    const extra = [];
    if (m.pref.parcare) extra.push(m.pref.parcare + (m.pref.parcare === 1 ? ' parcare' : ' parcări'));
    if (m.pref.boxa) extra.push('boxă');

    return '<div class="membru' + (m.id === eu ? ' eu' : '') + '">' +
      '<div class="membru-cap"><b>' + esc(m.nume) + '</b>' +
        (m.id === eu ? '<button class="btn-mic" onclick="deschidePreferinte()">Modifică</button>' : '') +
      '</div>' +
      '<div class="cere">' + fmt(mpDorit(m)) + ' mp · ' + camere(m) + ' camere ' +
        (dinProfil(m) ? '<span class="sursa">din profil</span>'
                      : '<span class="sursa alt">ajustat aici</span>') + '</div>' +
      '<div class="cere">' + (ETAJE[m.pref.etaj] || 'etaj nespecificat') +
        (extra.length ? ' · ' + extra.join(' · ') : '') + '</div>' +
      (b_.length ? '<div class="bani">' + b_.join(' · ') + '</div>'
                 : '<div class="bani gol">buget necompletat</div>') +
      (m.pref.note ? '<div class="nota">' + esc(m.pref.note) + '</div>' : '') +
      '<div class="ales' + (altele.length ? '' : ' ales--doar-aici') + '">' +
        '<span class="ales-aici">' + (alese.length ? 'Aici: <em>' + alese.join(', ') + '</em>'
          : '<span class="gol">nicio alegere pe terenul acesta</span>') + '</span>' +
        (altele.length ? '<span class="ales-altele">Și pe ' + altele.map(esc).join(', ') + '</span>' : '') +
      '</div></div>';
  }).join('');

  const btn = document.getElementById('membriMai');
  if (ascunsi > 0) {
    btn.style.display = 'block';
    btn.textContent = membriToti ? 'Arată mai puțini ↑'
      : (ascunsi === 1 ? 'Încă un membru ↓' : 'Încă ' + ascunsi + ' membri ↓');
  } else { btn.style.display = 'none'; }

  const t = {
    mp: membri.reduce((s, m) => s + (mpDorit(m) || 0), 0),
    cam: membri.reduce((s, m) => s + (camere(m) || 0), 0),
    parc: membri.reduce((s, m) => s + (m.pref.parcare || 0), 0),
    boxe: membri.filter(m => m.pref.boxa).length,
    cash: membri.reduce((s, m) => s + (m.pref.cash || 0), 0),
    fara: membri.filter(m => !m.pref.cash).length
  };
  document.getElementById('totaluri').innerHTML =
  '<table><tr><th>Ce cere grupul</th><th>Familii</th><th>mp utili</th><th>Camere</th>' +
    '<th>Parcări</th><th>Boxe</th><th>Aport propriu pentru teren</th></tr>' +
  '<tr class="total-rand"><td>Total</td><td>' + membri.length + '</td><td>' + fmt(t.mp) + '</td>' +
    '<td>' + t.cam + '</td><td>' + t.parc + '</td><td>' + t.boxe + '</td>' +
    '<td>' + fmt(t.cash) + ' €' + (t.fara ? ' <span style="font-weight:400;color:var(--gri)">(' +
      t.fara + ' necompletate)</span>' : '') + '</td></tr></table>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERIFICĂRILE TERENULUI

   Cei șapte pași din `PASI_TEREN` (`js/pasi-din-ghid.js`), cu bifele și notele
   lor. Au stat până pe 30 august 2026 pe cardul terenului din pagina grupului;
   s-au mutat aici fiindcă altfel omul sărea între card și pagină pentru lucruri
   care se fac în același loc.

   ⚠️ ATAȘAMENTELE PE PAS AU IEȘIT DE TOT. Erau butonul „atașează" de lângă
   „+ notă", iar fișierele ajungeau în `grup_checklist_files` cu cheie compusă.
   Acum documentele stau într-un singur loc, în secțiunea „Documentele
   terenului": agățate de câte un pas, nu le găsea nimeni fără să deschidă toate
   cele șapte casete. Codul de urcare, descărcare și ștergere a rămas în pagina
   grupului doar pentru pașii de GRUP, care sunt altă listă.

   ⚠️ BIFELE stau în `grup_teren_checklist`, pe tripleta (grup, teren, pas), și
   se scriu prin `upsert` cu `onConflict` explicit: PostgREST nu ghicește o
   cheie primară compusă.

   ⚠️ NOTELE stau în `grup_checklist_notes`, tabela pașilor de grup, cu o cheie
   compusă de forma `t-<teren_id>-<pas>`. Așa moștenesc politicile care le
   închid deja pe membrii grupului. Nu au tabelă proprie și nici nu le trebuie.
   ═══════════════════════════════════════════════════════════════════════════ */
let bifePasi = {};        // step_key -> rândul din bază
let notePasi = {};        // step_key -> [note]
let pasDeschis = null;
const numeMembri = {};    // user_id -> pseudonim, pentru autorii notelor

function cheiaPas(pas){ return 't-' + terenId + '-' + pas; }

async function incarcaVerificari(){
  try {
    const [bife, note] = await Promise.all([
      sb.from('grup_teren_checklist').select('step_key, checked')
        .eq('grup_id', grupId).eq('teren_id', terenId),
      sb.from('grup_checklist_notes').select('id, step_key, content, created_at, user_id')
        .eq('grup_id', grupId).like('step_key', 't-' + terenId + '-%')
        .order('created_at', { ascending: true })
    ]);
    bifePasi = {};
    (bife.data || []).forEach(function (b) { bifePasi[b.step_key] = b; });
    notePasi = {};
    (note.data || []).forEach(function (n) {
      (notePasi[n.step_key] || (notePasi[n.step_key] = [])).push(n);
    });
    /* Numele autorilor: cei mai mulți sunt deja în `membri`, dar o notă poate
       fi scrisă de cineva care a ieșit din grup între timp. */
    const lipsa = [...new Set((note.data || []).map(n => n.user_id))]
      .filter(id => !membri.find(m => m.id === id));
    if (lipsa.length) {
      const { data: p } = await sb.from('profiles_visible')
        .select('user_id, pseudonym').in('user_id', lipsa);
      (p || []).forEach(x => { numeMembri[x.user_id] = x.pseudonym || 'Membru'; });
    }
  } catch (e) {
    console.warn('verificările terenului:', e);
    bifePasi = {}; notePasi = {};
  }
}

function numeAutor(id){
  const m = membri.find(x => x.id === id);
  return m ? m.nume : (numeMembri[id] || 'Membru');
}

window.toggleDetaliiPas = function (cheie){
  pasDeschis = (pasDeschis === cheie) ? null : cheie;
  renderVerificari();
};

window.comutaBifa = async function (pasKey){
  const acum = bifePasi[pasKey];
  const nou = !(acum && acum.checked);
  bifePasi[pasKey] = { step_key: pasKey, checked: nou };
  renderVerificari();
  try {
    /* ⚠️ `onConflict` e obligatoriu și trebuie să numească toate trei coloanele:
       cheia primară e compusă, iar PostgREST nu o ghicește. Fără el, upsert-ul
       e refuzat. */
    const { error } = await sb.from('grup_teren_checklist').upsert({
      grup_id: grupId, teren_id: terenId, step_key: pasKey,
      checked: nou,
      checked_at: nou ? new Date().toISOString() : null,
      checked_by: nou ? eu : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'grup_id,teren_id,step_key' });
    if (error) throw error;
  } catch (e) {
    console.warn('nu s-a salvat bifa:', e);
    bifePasi[pasKey] = acum;
    renderVerificari();
    alert('Nu am putut salva bifa. Încearcă din nou.');
  }
};

window.deschideNota = function (cheie){
  const el = document.getElementById('nota-camp-' + cheie);
  if (!el) return;
  el.style.display = (el.style.display === 'none' || !el.style.display) ? 'flex' : 'none';
  if (el.style.display === 'flex') document.getElementById('nota-val-' + cheie).focus();
};

window.adaugaNota = async function (cheie){
  const camp = document.getElementById('nota-val-' + cheie);
  const text = camp.value.trim();
  if (!text) return;
  camp.disabled = true;
  try {
    const { data, error } = await sb.from('grup_checklist_notes').insert({
      grup_id: grupId, step_key: cheie, user_id: eu, content: text
    }).select().single();
    if (error) throw error;
    (notePasi[cheie] || (notePasi[cheie] = [])).push(data);
    camp.value = '';
    renderVerificari();
  } catch (e) {
    console.warn('nu s-a salvat nota:', e);
    alert('Nu am putut salva nota.');
  } finally {
    camp.disabled = false;
  }
};

window.stergeNota = async function (id, cheie){
  if (!confirm('Ștergi nota?')) return;
  try {
    const { error } = await sb.from('grup_checklist_notes').delete().eq('id', id);
    if (error) throw error;
    notePasi[cheie] = (notePasi[cheie] || []).filter(n => n.id !== id);
    renderVerificari();
  } catch (e) {
    console.warn('ștergere notă:', e);
    alert('Nu am putut șterge nota.');
  }
};

function renderVerificari(){
  const cont = document.getElementById('verificari');
  if (!cont || typeof PASI_TEREN === 'undefined') return;

  const facute = PASI_TEREN.filter(p => bifePasi[p.key] && bifePasi[p.key].checked).length;
  document.getElementById('verificariNr').textContent = facute + ' din ' + PASI_TEREN.length;

  cont.innerHTML = PASI_TEREN.map(function (pas) {
    const bifat = !!(bifePasi[pas.key] && bifePasi[pas.key].checked);
    const cheie = cheiaPas(pas.key);
    const note = notePasi[cheie] || [];
    const deschis = (pasDeschis === cheie);

    /* Primul pas e singurul cu acțiune proprie: fără analiză, butonul care o
       cere. CU analiză nu mai duce nicăieri, fiindcă analiza e chiar pagina
       asta: ar fi fost un link către locul în care omul se află deja. */
    let actiune = '';
    if (pas.cereAnaliza && !analiza) {
      actiune = '<a class="vf-actiune" href="analize.html?teren_id=' +
        encodeURIComponent(terenId) + '">Cere o analiză →</a>';
    }

    return '<div class="vf-pas' + (bifat ? ' bifat' : '') + '">' +
        '<div class="vf-bifa' + (bifat ? ' bifata' : '') + '" role="checkbox" tabindex="0"' +
          ' aria-checked="' + bifat + '" onclick="comutaBifa(\'' + pas.key + '\')"' +
          ' onkeydown="if(event.key===\' \'||event.key===\'Enter\'){event.preventDefault();comutaBifa(\'' + pas.key + '\')}"></div>' +
        '<div class="vf-text" onclick="toggleDetaliiPas(\'' + cheie + '\')">' +
          '<span class="vf-titlu">' + esc(pas.titlu) + '</span>' +
          '<span class="vf-sub">' + esc(pas.sub) + '</span>' +
        '</div>' +
        actiune +
        '<button class="vf-buton" onclick="toggleDetaliiPas(\'' + cheie + '\')">' +
          (note.length ? '<span class="vf-nr">' + note.length + '</span>' : '') +
          '<span class="vf-eticheta">note</span>' +
          '<i class="fas fa-chevron-' + (deschis ? 'up' : 'down') + '"></i>' +
        '</button>' +
      '</div>' +
      (deschis ? '<div class="vf-corp">' + randeazaNote(cheie, note) + '</div>' : '');
  }).join('');
}

function randeazaNote(cheie, note){
  const lista = note.map(function (n) {
    /* Ștergerea: cine a scris nota, plus fondatorul grupului. Un membru care
       vede o notă veche și greșită a altcuiva n-o poate șterge, dar fondatorul
       poate face curat. */
    const potSterge = (n.user_id === eu) || suntAdmin;
    return '<div class="vf-nota">' +
        '<div class="vf-nota-cap">' +
          '<span class="vf-nota-autor">' + esc(numeAutor(n.user_id)) + '</span>' +
          '<span class="vf-nota-cand">' + formatData(n.created_at) + '</span>' +
          (potSterge ? '<button class="vf-nota-sterge" onclick="stergeNota(\'' + n.id +
            '\', \'' + cheie + '\')" title="Șterge nota">×</button>' : '') +
        '</div>' +
        '<div class="vf-nota-text">' + esc(n.content) + '</div>' +
      '</div>';
  }).join('');

  return (lista || '<p class="vf-fara-note">Nicio notă încă.</p>') +
    '<div class="vf-nota-nou">' +
      '<input type="text" id="nota-val-' + cheie + '" maxlength="500"' +
        ' placeholder="Scrie o notă pentru grup..."' +
        ' onkeydown="if(event.key===\'Enter\')adaugaNota(\'' + cheie + '\')">' +
      '<button onclick="adaugaNota(\'' + cheie + '\')">Adaugă</button>' +
    '</div>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   JURNALUL TERENULUI

   Aceleași rânduri din `grup_teren_comments` pe care le arată și pagina
   grupului ca fir de comentarii, dar citite ca jurnal: cu felul intrării și cu
   ZIUA FAPTULUI, nu doar cu ziua scrierii.

   ⚠️ Cele două date sunt lucruri diferite. `created_at` e când s-a scris nota,
   `data_faptului` e când s-a întâmplat lucrul. Vorbești cu agentul marți și
   apuci să notezi joi; peste trei luni cineva caută ziua discuției. Ordinea
   listei merge după data faptului.

   ⚠️ Comentariile scrise înainte de 30 august 2026 n-au niciuna dintre cele
   două coloane noi. Nu se completează retroactiv: `fel` gol se citește ca
   observație, `data_faptului` gol se citește ca ziua scrierii. De aceea peste
   tot mai jos e `|| ` și nu se presupune că vin completate.
   ═══════════════════════════════════════════════════════════════════════════ */
const FELURI = { discutie: 'Discuție', vizita: 'Vizită',
                 document: 'Document', observatie: 'Observație' };
const JURNAL_VIZIBILE = (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) ? 4 : 8;
const LUNI_SCURT = ['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','noi','dec'];
let jurnal = [];
let jurnalTot = false;
let jurnalEdit = null;         // id-ul intrării care se editează acum, sau null

window.toggleJurnal = function (){ jurnalTot = !jurnalTot; renderJurnal(); };

function dataScurta(iso){
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return String(iso);
  return Number(p[2]) + ' ' + LUNI_SCURT[Number(p[1]) - 1];
}
function ziuaFaptului(i){ return i.data_faptului || String(i.created_at).slice(0, 10); }

/* „Modificată" nu se citește dintr-o coloană anume, ci din faptul că
   `updated_at` a rămas în urma lui `created_at`. Amândouă au `default now()`,
   deci la scriere sunt egale; pragul de câteva secunde e pentru cazul în care
   baza le-ar despărți cu o fracțiune, ca să nu apară „modificat" pe o intrare
   pe care n-a atins-o nimeni. */
function eModificata(i){
  if (!i.updated_at || !i.created_at) return false;
  return (Date.parse(i.updated_at) - Date.parse(i.created_at)) > 5000;
}

async function incarcaJurnal(){
  try {
    const { data, error } = await sb.from('grup_teren_comments')
      .select('id, content, created_at, updated_at, user_id, fel, data_faptului')
      .eq('grup_id', grupId).eq('teren_id', terenId)
      .order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    jurnal = data || [];
  } catch (e) {
    console.warn('jurnalul terenului:', e);
    jurnal = [];
  }
}

function renderJurnal(){
  const el = document.getElementById('jurnal');
  if (!el) return;
  if (!jurnal.length) {
    el.innerHTML = '<p class="jurnal-gol">Nicio intrare încă. Scrie ce ai aflat despre teren.</p>';
    document.getElementById('jurnalMai').style.display = 'none';
    return;
  }
  const sortat = jurnal.slice().sort(function (a, b) {
    return String(ziuaFaptului(b)).localeCompare(String(ziuaFaptului(a)));
  });
  const vizibile = jurnalTot ? sortat : sortat.slice(0, JURNAL_VIZIBILE);
  const ascunse = sortat.length - JURNAL_VIZIBILE;

  el.innerHTML = '<table class="jurnal-tabel">' +
    '<tr><th>Când</th><th>Fel</th><th>Cine</th><th>Ce s-a întâmplat</th><th></th></tr>' +
    vizibile.map(function (i) {
      const m = membri.find(x => x.id === i.user_id);
      const fel = i.fel || 'observatie';
      const cand = ziuaFaptului(i);
      const scris = String(i.created_at).slice(0, 10);
      /* ⚠️ Două drepturi diferite, dinadins, și amândouă trebuie să spună exact
         ce spun politicile din bază, altfel butonul apare și apăsarea eșuează:
           • ȘTERGEREA: autorul SAU fondatorul (`delete_own_comments`, lărgită
             în `9-stergerea-din-jurnal.sql`), ca la note și la documente.
           • EDITAREA: DOAR autorul (`update_own_comments`, din
             `10-editarea-din-jurnal.sql`). Fondatorul poate șterge ceva greșit,
             dar nu poate rescrie vorbele altcuiva. */
      const potSterge = (i.user_id === eu) || suntAdmin;
      const potEdita  = (i.user_id === eu);
      return '<tr' + (jurnalEdit === i.id ? ' class="se-editeaza"' : '') + '>' +
        '<td class="j-cand">' + dataScurta(cand) +
          (cand === scris ? '' : '<small>notat ' + dataScurta(scris) + '</small>') + '</td>' +
        '<td class="j-fel"><span class="' + fel + '">' + (FELURI[fel] || 'Observație') + '</span></td>' +
        '<td class="j-cine">' + (m ? esc(m.nume) : 'cineva') + '</td>' +
        '<td class="j-text">' + esc(i.content) +
          (eModificata(i) ? '<span class="j-editat">modificat ' + dataScurta(i.updated_at) + '</span>' : '') +
        '</td>' +
        '<td class="j-sterge">' +
          (potEdita ? '<button onclick="editeazaInJurnal(\'' + i.id +
            '\')" title="Modifică intrarea" aria-label="Modifică intrarea">✎</button>' : '') +
          (potSterge ? '<button onclick="stergeDinJurnal(\'' + i.id +
            '\')" title="Șterge intrarea" aria-label="Șterge intrarea">×</button>' : '') + '</td>' +
      '</tr>';
    }).join('') + '</table>';

  const btn = document.getElementById('jurnalMai');
  if (ascunse > 0) {
    btn.style.display = 'block';
    btn.textContent = jurnalTot ? 'Arată mai puține ↑'
      : (ascunse === 1 ? 'Încă o intrare ↓' : 'Încă ' + ascunse + ' intrări ↓');
  } else { btn.style.display = 'none'; }
}

/* Formularul de sus e și de scris, și de corectat. `jurnalEdit` spune în care
   dintre cele două stări se află; `golesteFormularulDeJurnal` le face pe
   amândouă să se termine la fel, cu formularul curat. */
function golesteFormularulDeJurnal(){
  const azi = new Date().toISOString().slice(0, 10);
  jurnalEdit = null;
  document.getElementById('jText').value = '';
  document.getElementById('jCand').value = azi;
  document.getElementById('jFel').value = 'discutie';
  document.getElementById('jAdauga').textContent = 'Adaugă în jurnal';
  document.getElementById('jRenunta').hidden = true;
}

window.editeazaInJurnal = function (id){
  const i = jurnal.find(x => x.id === id);
  /* Paza asta nu e de prisos: dreptul de UPDATE din bază e doar al autorului,
     deci un creion apăsat pe rândul altcuiva ar duce la o salvare respinsă,
     după ce omul a scris textul. */
  if (!i || i.user_id !== eu) return;
  jurnalEdit = id;
  document.getElementById('jFel').value = i.fel || 'observatie';
  document.getElementById('jCand').value = ziuaFaptului(i);
  document.getElementById('jText').value = i.content;
  document.getElementById('jAdauga').textContent = 'Salvează modificarea';
  document.getElementById('jRenunta').hidden = false;
  renderJurnal();
  document.querySelector('#oaJurnal .jurnal-nou').scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('jText').focus();
};

window.renuntaLaEditare = function (){
  golesteFormularulDeJurnal();
  renderJurnal();
};

async function adaugaInJurnal(){
  const camp = document.getElementById('jText');
  const text = camp.value.trim();
  if (!text) return;
  const buton = document.getElementById('jAdauga');
  const azi = new Date().toISOString().slice(0, 10);
  const fel = document.getElementById('jFel').value;
  const cand = document.getElementById('jCand').value || azi;
  buton.disabled = true;
  try {
    if (jurnalEdit) {
      /* ⚠️ Se scriu DOAR cele patru coloane pentru care există grant
         (`10-editarea-din-jurnal.sql`). O a cincea, chiar și trimisă cu aceeași
         valoare, ar fi refuzată de bază, nu ignorată.
         `updated_at` se scrie de aici, nu de un declanșator: tabela n-are
         niciunul pe UPDATE, iar din ea se citește apoi „modificat". */
      const { data, error } = await sb.from('grup_teren_comments').update({
        content: text, fel: fel, data_faptului: cand,
        updated_at: new Date().toISOString()
      }).eq('id', jurnalEdit).select().single();
      if (error) throw error;
      jurnal = jurnal.map(x => (x.id === jurnalEdit ? data : x));
    } else {
      const { data, error } = await sb.from('grup_teren_comments').insert({
        grup_id: grupId, teren_id: terenId, user_id: eu, content: text,
        fel: fel, data_faptului: cand
      }).select().single();
      if (error) throw error;
      jurnal.unshift(data);
    }
    golesteFormularulDeJurnal();
    renderJurnal();
  } catch (e) {
    console.warn(jurnalEdit ? 'modificare în jurnal:' : 'adăugare în jurnal:', e);
    alert('Nu am putut salva intrarea. Încearcă din nou.');
  } finally {
    buton.disabled = false;
  }
}

window.stergeDinJurnal = async function (id){
  const i = jurnal.find(x => x.id === id);
  if (!i) return;
  if (!confirm('Ștergi intrarea din jurnal? Nu se mai poate recupera.')) return;
  try {
    const { error } = await sb.from('grup_teren_comments').delete().eq('id', id);
    if (error) throw error;
    jurnal = jurnal.filter(x => x.id !== id);
    /* Dacă tocmai ea era în formular, formularul rămânea în starea de editare,
       arătând „Salvează modificarea" pentru un rând care nu mai există. */
    if (jurnalEdit === id) golesteFormularulDeJurnal();
    renderJurnal();
  } catch (e) {
    console.warn('ștergere din jurnal:', e);
    alert('Nu am putut șterge intrarea.');
  }
};

function legJurnal(){
  /* Data faptului se completează singură cu ziua de azi, dar se poate da
     înapoi: discuția de marți se notează adesea joi. Înainte nu se poate
     merge: o notă despre ceva ce nu s-a întâmplat încă e altceva decât un
     jurnal, iar pentru asta va fi nevoie de altă unealtă. */
  const azi = new Date().toISOString().slice(0, 10);
  const cand = document.getElementById('jCand');
  cand.value = azi;
  cand.max = azi;
  document.getElementById('jAdauga').onclick = adaugaInJurnal;
  document.getElementById('jRenunta').onclick = renuntaLaEditare;
  document.getElementById('jText').onkeydown = function (e) {
    if (e.key === 'Enter') adaugaInJurnal();
    /* Escape iese din editare fără să salveze, ca peste tot. Fără el, singura
       ieșire ar fi butonul „Renunță", iar reflexul e tasta. */
    if (e.key === 'Escape' && jurnalEdit) renuntaLaEditare();
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUMENTELE TERENULUI

   Un rând e ori un fișier urcat în bucketul privat `teren-documente`, ori un
   link către altundeva. Al doilea nu e o soluție de mâna a doua: grupurile
   lucrează deja pe Drive, iar ce le lipsea era LISTA, nu locul de stocare.

   ⚠️ Bucketul e privat, deci descărcarea se face prin `.download()`, nu printr-o
   adresă publică pusă în pagină. Un link extern se deschide în filă nouă și
   poartă `rel="noopener noreferrer"`: adresa o scrie un membru, nu noi.
   ═══════════════════════════════════════════════════════════════════════════ */
const DOC_MAX_BYTES = 25 * 1024 * 1024;
const DOC_VIZIBILE = (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) ? 4 : 10;
const DOC_CATEGORII = { acte: 'Acte', urbanism: 'Urbanism', masuratori: 'Măsurători',
                        oferte: 'Oferte', poze: 'Poze', altele: 'Altele' };
let documente = [];
let docToate = false;
let docMod = 'fisier';

window.toggleDocumente = function (){ docToate = !docToate; renderDocumente(); };

async function incarcaDocumente(){
  try {
    const { data, error } = await sb.from('teren_atasamente')
      .select('*').eq('grup_id', grupId).eq('teren_id', terenId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    documente = data || [];
  } catch (e) {
    console.warn('documentele terenului:', e);
    documente = [];
  }
}

function marimeCitibila(b){
  if (!b) return '';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

function renderDocumente(){
  const lista = document.getElementById('docLista');
  if (!lista) return;
  if (!documente.length) {
    lista.innerHTML = '<p class="doc-gol">Niciun document încă. Urcă primul fișier sau pune un link.</p>';
    document.getElementById('docMai').style.display = 'none';
    return;
  }
  const vizibile = docToate ? documente : documente.slice(0, DOC_VIZIBILE);
  const ascunse = documente.length - DOC_VIZIBILE;

  lista.innerHTML = vizibile.map(function (d) {
    const eLink = (d.fel === 'link');
    /* Autorul plus fondatorul, ca la note și la jurnal. Dreptul exista deja în
       bază de la `3-atasamente-teren.sql` (și pe tabelă, și pe bucket), dar
       pagina arăta butonul doar autorului: fondatorul avea voie și nu avea pe
       ce apăsa. Cele două se scriu la fel peste tot, tocmai ca să nu se
       despartă din nou. */
    const potSterge = (d.adaugat_de === eu) || suntAdmin;
    const cine = membri.find(m => m.id === d.adaugat_de);
    const meta = [];
    if (d.categorie && DOC_CATEGORII[d.categorie]) {
      meta.push('<span class="doc-eticheta">' + DOC_CATEGORII[d.categorie] + '</span>');
    }
    meta.push(cine ? esc(cine.nume) : 'cineva');
    if (d.created_at) meta.push(formatData(d.created_at));
    if (eLink) meta.push('link în altă parte');
    else if (d.marime_bytes) meta.push(marimeCitibila(d.marime_bytes));

    const titlu = eLink
      ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener noreferrer">' + esc(d.titlu) + ' ↗</a>'
      : '<a href="#" data-descarca="' + d.id + '">' + esc(d.titlu) + '</a>';

    return '<div class="doc-rand' + (eLink ? ' link' : '') + '">' +
      '<span class="doc-semn"><i class="fas fa-' + (eLink ? 'link' : 'file-lines') + '"></i></span>' +
      '<div class="doc-corp">' +
        '<div class="doc-titlu">' + titlu + '</div>' +
        '<div class="doc-meta">' + meta.join(' · ') + '</div>' +
        (d.note ? '<div class="doc-nota">' + esc(d.note) + '</div>' : '') +
      '</div>' +
      (potSterge ? '<button class="doc-sterge" data-sterge="' + d.id + '">Șterge</button>' : '') +
    '</div>';
  }).join('');

  lista.querySelectorAll('[data-descarca]').forEach(function (a) {
    a.onclick = function (e) { e.preventDefault(); descarcaDocument(a.dataset.descarca); };
  });
  lista.querySelectorAll('[data-sterge]').forEach(function (b) {
    b.onclick = function () { stergeDocument(b.dataset.sterge); };
  });

  const btn = document.getElementById('docMai');
  if (ascunse > 0) {
    btn.style.display = 'block';
    btn.textContent = docToate ? 'Arată mai puține ↑'
      : (ascunse === 1 ? 'Încă un document ↓' : 'Încă ' + ascunse + ' documente ↓');
  } else { btn.style.display = 'none'; }
}

async function descarcaDocument(id){
  const d = documente.find(x => x.id === id);
  if (!d || !d.storage_path) return;
  try {
    const { data, error } = await sb.storage.from('teren-documente').download(d.storage_path);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = d.nume_fisier || d.titlu;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.warn('descărcare:', e);
    alert('Nu am putut descărca documentul.');
  }
}

async function stergeDocument(id){
  const d = documente.find(x => x.id === id);
  if (!d) return;
  if (!confirm('Ștergi documentul „' + d.titlu + '"? Nu se mai poate recupera.')) return;
  try {
    /* Întâi rândul, apoi fișierul: politica de ștergere din storage se sprijină
       pe rândul din tabelă (`t.storage_path = objects.name`), deci în ordine
       inversă n-ar mai avea pe ce să se sprijine, iar fișierul ar rămâne pe
       disc fără să mai știe nimeni de el. */
    const { error } = await sb.from('teren_atasamente').delete().eq('id', id);
    if (error) throw error;
    if (d.storage_path) await sb.storage.from('teren-documente').remove([d.storage_path]);
    documente = documente.filter(x => x.id !== id);
    renderDocumente();
  } catch (e) {
    console.warn('ștergere document:', e);
    alert('Nu am putut șterge documentul.');
  }
}

function docSpune(text, rau){
  const el = document.getElementById('docMesaj');
  if (!el) return;
  el.textContent = text || '';
  el.className = 'doc-mesaj' + (rau ? ' rau' : '');
}

async function adaugaDocument(){
  const titlu = document.getElementById('docTitlu').value.trim();
  const categorie = document.getElementById('docCategorie').value || null;
  const buton = document.getElementById('docAdauga');
  if (!titlu) { docSpune('Scrie întâi ce e documentul.', true); return; }

  buton.disabled = true;
  try {
    if (docMod === 'link') {
      const url = document.getElementById('docUrl').value.trim();
      if (!url) { docSpune('Pune adresa linkului.', true); return; }
      if (!/^https?:\/\//i.test(url)) {
        docSpune('Adresa trebuie să înceapă cu http:// sau https://', true); return;
      }
      docSpune('Se salvează…');
      const { data, error } = await sb.from('teren_atasamente').insert({
        grup_id: grupId, teren_id: terenId, fel: 'link',
        titlu: titlu, categorie: categorie, url: url, adaugat_de: eu
      }).select().single();
      if (error) throw error;
      documente.unshift(data);
    } else {
      const input = document.getElementById('docFisier');
      const fisier = input.files && input.files[0];
      if (!fisier) { docSpune('Alege un fișier.', true); return; }
      if (fisier.size > DOC_MAX_BYTES) {
        docSpune('Fișierul are ' + marimeCitibila(fisier.size) + ', iar limita e 25 MB. ' +
                 'Pune-l în Drive și adaugă aici linkul.', true);
        return;
      }
      docSpune('Se urcă…');
      /* Calea începe cu `grup_id`, ca politica de citire din storage să fie o
         singură comparație, la fel ca la checklist-files. Numele se curăță de
         diacritice și de orice altceva decât litere, cifre, punct și liniuță. */
      const numeCurat = fisier.name.normalize('NFD').replace(/[̀-ͯ]/g, '')
                          .replace(/[^a-zA-Z0-9._-]/g, '_');
      const cale = grupId + '/' + terenId + '/' + Date.now() + '_' + numeCurat;
      const { error: errUp } = await sb.storage.from('teren-documente').upload(cale, fisier);
      if (errUp) throw errUp;

      const { data, error } = await sb.from('teren_atasamente').insert({
        grup_id: grupId, teren_id: terenId, fel: 'fisier',
        titlu: titlu, categorie: categorie, storage_path: cale,
        nume_fisier: fisier.name, marime_bytes: fisier.size,
        tip_mime: fisier.type || null, adaugat_de: eu
      }).select().single();
      if (error) {
        /* Rândul n-a intrat, deci fișierul ar rămâne pe disc fără nimeni care
           să știe de el. Îl scoatem. */
        await sb.storage.from('teren-documente').remove([cale]);
        throw error;
      }
      documente.unshift(data);
      input.value = '';
    }

    document.getElementById('docTitlu').value = '';
    document.getElementById('docUrl').value = '';
    document.getElementById('docCategorie').value = '';
    docSpune('Adăugat.');
    renderDocumente();
    setTimeout(function () { docSpune(''); }, 2500);
  } catch (e) {
    console.warn('adăugare document:', e);
    docSpune('Nu am putut adăuga. Încearcă din nou.', true);
  } finally {
    buton.disabled = false;
  }
}

function legDocumente(){
  document.querySelectorAll('.doc-mod-buton').forEach(function (b) {
    b.onclick = function () {
      docMod = b.dataset.mod;
      document.querySelectorAll('.doc-mod-buton').forEach(function (x) {
        x.classList.toggle('activ', x === b);
      });
      document.getElementById('docCampFisier').hidden = (docMod !== 'fisier');
      document.getElementById('docCampLink').hidden = (docMod !== 'link');
      docSpune('');
    };
  });
  document.getElementById('docAdauga').onclick = adaugaDocument;
}

/* ── FORMULARUL DE PREFERINȚE ───────────────────────────────────────────── */
window.deschidePreferinte = function (){
  const m = membri.find(x => x.id === eu);
  if (!m) return;
  const f = document.getElementById('formPref');
  const optCamere = [1,2,3,4,5].map(n =>
    '<option value="' + n + '"' + (m.pref.camere === n ? ' selected' : '') + '>' + n + ' camere</option>').join('');
  const optEtaj = Object.keys(ETAJE).map(k =>
    '<option value="' + k + '"' + (m.pref.etaj === k ? ' selected' : '') + '>' + ETAJE[k] + '</option>').join('');
  const optParcare = [0,1,2].map(n =>
    '<option value="' + n + '"' + (m.pref.parcare === n ? ' selected' : '') + '>' +
    (n === 0 ? 'niciunul' : n === 1 ? 'un loc' : 'două locuri') + '</option>').join('');

  f.innerHTML =
    '<div class="pref-cap"><h3>Ce îmi doresc, în grupul acesta</h3>' +
      '<button class="btn-mic" onclick="inchidePreferinte()">Închide</button></div>' +
    '<div class="pref-corp">' +
      '<div class="pref-din-profil">Din profilul tău: <b>' + (m.profil.camere || '?') + ' camere</b>, <b>' +
        (m.profil.mp || '?') + ' mp utili</b>. Se folosesc pe toate terenurile și în toate grupurile. ' +
        'Le schimbi din <a href="profile-edit-new.html">profil</a>, ca să nu le rescrii de fiecare dată. ' +
        'Mai jos le poți ajusta doar pentru grupul acesta.</div>' +

      '<div class="pref-sectiune"><div class="pref-titlu">Apartamentul</div><div class="pref-rand trei">' +
        '<label class="pref-camp"><span>Camere</span><select id="pCamere">' +
          '<option value="">ca în profil (' + (m.profil.camere || '?') + ')</option>' + optCamere + '</select></label>' +
        '<label class="pref-camp"><span>Suprafață utilă</span><span class="camp-cu-unitate">' +
          '<input type="number" id="pMp" min="20" max="500" step="1" placeholder="ca în profil (' +
          (m.profil.mp || '?') + ')" value="' + (m.pref.mp != null ? m.pref.mp : '') + '">' +
          '<span class="unitate">mp</span></span></label>' +
        '<label class="pref-camp"><span>Etaj</span><select id="pEtaj">' + optEtaj + '</select></label>' +
      '</div></div>' +

      '<div class="pref-sectiune"><div class="pref-titlu">Pe lângă apartament</div><div class="pref-rand doua">' +
        '<label class="pref-camp"><span>Locuri de parcare</span><select id="pParcare">' + optParcare + '</select></label>' +
        '<label class="pref-camp"><span>Boxă</span><select id="pBoxa">' +
          '<option value="nu"' + (!m.pref.boxa ? ' selected' : '') + '>nu</option>' +
          '<option value="da"' + (m.pref.boxa ? ' selected' : '') + '>da</option></select></label>' +
      '</div></div>' +

      '<div class="pref-sectiune"><div class="pref-titlu">Bugetul</div><div class="pref-rand doua">' +
        '<label class="pref-camp"><span>Pentru teren, aport propriu</span><span class="camp-cu-unitate">' +
          '<input type="number" id="pCash" min="0" step="1000" placeholder="necompletat" value="' +
          (m.pref.cash != null ? m.pref.cash : '') + '"><span class="unitate">€</span></span>' +
          '<small>Terenul se cumpără din aport propriu, înainte de orice credit.</small></label>' +
        '<label class="pref-camp"><span>Total, cu credit cu tot</span><span class="camp-cu-unitate">' +
          '<input type="number" id="pTotal" min="0" step="1000" placeholder="necompletat" value="' +
          (m.pref.total != null ? m.pref.total : '') + '"><span class="unitate">€</span></span>' +
          '<small>Cât poți duce în total pentru apartament.</small></label>' +
      '</div></div>' +

      '<div class="pref-sectiune"><div class="pref-titlu">Alte lucruri de știut</div>' +
        '<label class="pref-camp"><input type="text" id="pNote" maxlength="200" value="' +
        esc(m.pref.note || '').replace(/"/g, '&quot;') +
        '" placeholder="ex. preferabil garaj subteran, dispus să stau la parter"></label></div>' +
    '</div>' +
    '<div class="pref-butoane">' +
      '<button class="btn-sters" onclick="inchidePreferinte()">Renunță</button>' +
      '<button class="btn-principal" onclick="salveazaPreferinte()">Salvează</button></div>';
  f.style.display = 'block';
  f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.inchidePreferinte = function (){ document.getElementById('formPref').style.display = 'none'; };

window.salveazaPreferinte = async function (){
  const m = membri.find(x => x.id === eu);
  if (!m) return;
  const nr = function (id) {
    const v = document.getElementById(id).value.trim();
    return v === '' ? null : Number(v);
  };
  const nou = {
    camere:  nr('pCamere'),
    mp:      nr('pMp'),
    etaj:    document.getElementById('pEtaj').value,
    parcare: Number(document.getElementById('pParcare').value),
    boxa:    document.getElementById('pBoxa').value === 'da',
    cash:    nr('pCash'),
    total:   nr('pTotal'),
    note:    document.getElementById('pNote').value.trim()
  };
  const vechi = m.pref;
  m.pref = nou;
  inchidePreferinte();
  render();
  try {
    const { error } = await sb.from('grup_membru_preferinte').upsert({
      grup_id: grupId, user_id: eu,
      nr_camere: nou.camere, mpu_dorit: nou.mp, etaj: nou.etaj,
      locuri_parcare: nou.parcare, boxa: nou.boxa,
      buget_teren_cash: nou.cash, buget_total: nou.total,
      note: nou.note || null, updated_at: new Date().toISOString()
    }, { onConflict: 'grup_id,user_id' });
    if (error) throw error;
  } catch (e) {
    console.warn('nu s-au salvat preferințele:', e);
    m.pref = vechi;
    render();
    alert('Nu am putut salva preferințele. Încearcă din nou.');
  }
};

window.toggleMembri = function (){ membriToti = !membriToti; renderMembri(); };

function render(){
  const areAnaliza = variante.length > 0;
  document.getElementById('file').hidden = !areAnaliza;
  document.querySelector('.stare-legenda').hidden = !areAnaliza;
  document.querySelector('#oaVariante details').hidden = !areAnaliza;
  document.getElementById('oaExplicaVariante').hidden = !areAnaliza;
  document.getElementById('variantaCorp').classList.toggle('oa-fara-analiza', !areAnaliza);
  renderFile();
  renderDocumenteleAnalizei();
  renderVarianta();
  renderSimulare();
  if (areAnaliza) renderCosturi();
  renderMembri();
  renderDocumente();
  renderJurnal();
  renderVerificari();
}

/* ═══════════════════════════════════════════════════════════════════════════
   ÎNCĂRCAREA
   ═══════════════════════════════════════════════════════════════════════════ */
async function oaPorneste(){
  const p = new URLSearchParams(window.location.search);
  grupId = p.get('grup');
  terenId = p.get('teren');
  if (!grupId || !terenId) {
    arataStarea('Link incomplet', 'Adresa nu spune despre ce grup și ce teren e vorba.',
      '<a href="grupuri.html">Mergi la grupurile tale</a>');
    return;
  }

  const { data: sesiune } = await sb.auth.getUser();
  if (!sesiune || !sesiune.user) {
    /* Nu există pagină de login: intrarea în cont se face din modalul deschis
       de `js/login-modal.js`, la fel ca peste tot în platformă. */
    arataStarea('Trebuie să fii autentificat',
      'Împărțirea apartamentelor se vede doar de membrii grupului.',
      '<a href="#" onclick="openLoginModal();return false;">Intră în cont</a>');
    return;
  }
  eu = sesiune.user.id;

  /* ⚠️ Nu ne bazăm pe RLS ca să AFIȘĂM mesajul potrivit: politicile ar întoarce
     pur și simplu liste goale, iar omul ar vedea „nu există analiză" și când e
     vorba de fapt că nu e membru. RLS rămâne bariera adevărată; întrebarea de
     aici e doar ca să știm ce să scriem pe ecran. */
  /* ⚠️ Superadminul se află întrebând FUNCȚIA `is_super_admin()`, nu citind
     coloana din profil. Politicile RLS o cheamă pe ea, deci așa nu pot ajunge
     interfața și baza să spună lucruri diferite: fie te lasă amândouă, fie
     niciuna. Tiparul invers, buton fără drept sau drept fără buton, s-a
     întâmplat de trei ori (`grup_checklist_files`, `grup_anunturi`, ștergerea
     anunțurilor). Dacă apelul crapă, `data` e null și rămânem pe `false`, deci
     greșeala cade în partea închisă. */
  const [{ data: membru }, { data: grup }, raspunsSuper] = await Promise.all([
    sb.from('grup_membri').select('status').eq('grup_id', grupId).eq('user_id', eu).maybeSingle(),
    sb.from('grupuri').select('id, nume, admin_id').eq('id', grupId).maybeSingle(),
    sb.rpc('is_super_admin')
  ]);
  if (raspunsSuper && raspunsSuper.error) {
    /* Funcția nu răspunde prin PostgREST. Se întâmplă dacă n-are drept de
       execuție pentru `authenticated`, dacă cere un argument, sau dacă nu e
       expusă deloc: nicio pagină din platformă n-o chema până acum prin RPC,
       toate citesc coloana din profil. Atunci se cade pe coloană, cum face
       restul platformei (`teren-details.js`, `grup-terenuri-edit.js`).
       Interogarea în plus se face DOAR pe eroare, nu și când funcția a răspuns
       cinstit „nu”: altfel fiecare membru obișnuit ar plăti o rundă degeaba. */
    console.warn('is_super_admin() prin RPC nu a răspuns:', raspunsSuper.error.message);
    const { data: profilEu } = await sb.from('profiles_visible')
      .select('is_super_admin').eq('user_id', eu).maybeSingle();
    suntSuperAdmin = !!(profilEu && profilEu.is_super_admin);
  } else {
    suntSuperAdmin = raspunsSuper && raspunsSuper.data === true;
  }
  const eMembru = (membru && String(membru.status) === 'activ') ||
                  (grup && grup.admin_id === eu) || suntSuperAdmin;
  suntAdmin = !!(grup && grup.admin_id === eu);
  if (!grup) {
    arataStarea('Grupul nu există', 'Poate a fost șters, sau linkul e greșit.',
      '<a href="grupuri.html">Mergi la grupurile tale</a>');
    return;
  }
  if (!eMembru) {
    arataStarea('Doar pentru membrii grupului',
      'Analiza unui teren se vede numai de membrii grupului care a plătit-o.',
      '<a href="grup-details.html?id=' + encodeURIComponent(grupId) + '">Vezi grupul</a>');
    return;
  }

  document.getElementById('oaInapoi').href = 'grup-details.html?id=' + encodeURIComponent(grupId);

  /* Fără analiză, singurul lucru care leagă grupul de terenul din adresă e
     lista lui de favorite. Fără verificarea asta, oricine ar putea deschide
     pagina grupului său pe un teren pe care nimeni de acolo nu l-a privit. */
  const { data: favorit } = await sb.from('terenuri_likes_grupuri')
    .select('teren_id').eq('grup_id', grupId).eq('teren_id', terenId).maybeSingle();

  const { data: analize, error: errA } = await sb.from('analiza_teren')
    .select('*').eq('grup_id', grupId).eq('teren_id', terenId)
    .order('data_analizei', { ascending: false }).limit(1);
  if (errA) {
    console.warn('analiza_teren:', errA);
    arataStarea('Nu am putut citi analiza', 'Încearcă să reîncarci pagina.', '');
    return;
  }
  /* ⚠️ ANALIZA E OPȚIONALĂ (decizia lui Lucian, 30 august). Pagina a refuzat
     la început să se deschidă fără ea, dar Excelul grupului Parcul Circului
     arată exact invers: oamenii își scriu ce vor și ce au aflat despre teren cu
     luni înainte să existe vreo analiză. Aceea e chiar munca de dinaintea
     analizei, iar dacă pagina o refuză, grupul se întoarce în Google Sheets.
     Fără analiză se deschid preferințele; în locul variantelor rămâne o schiță
     estompată, care spune ce va apărea acolo. */
  analiza = (analize && analize.length) ? analize[0] : null;

  /* Superadminul trece și de poarta asta. Ea există ca să nu poată cineva
     deschide pagina grupului său pe un teren la care nimeni de acolo nu s-a
     uitat; pentru superadmin, care se uită tocmai ca să răspundă unei
     întrebări, ar fi ajuns invers: perechea cea mai probabil de verificat e
     exact cea care încă n-are nimic. */
  if (!analiza && !favorit && !suntSuperAdmin) {
    arataStarea('Terenul nu e la favoritele grupului',
      'Adaugă-l întâi din pagina grupului, apoi puteți scrie aici ce vă doriți și ce ați aflat despre el.',
      '<a href="grup-details.html?id=' + encodeURIComponent(grupId) + '">Înapoi la grup</a>');
    return;
  }

  const gol = Promise.resolve({ data: [] });
  const [teren, vars, nivs, aps, sups, ints, prefs, membriBruti] = await Promise.all([
    sb.from('terenuri').select('id, titlu, suprafata').eq('id', terenId).maybeSingle(),
    analiza ? sb.from('analiza_varianta').select('*').eq('analiza_id', analiza.id).order('ordine') : gol,
    analiza ? sb.from('analiza_nivel').select('*').eq('grup_id', grupId).order('ordine') : gol,
    analiza ? sb.from('analiza_apartament').select('*').eq('grup_id', grupId).order('ordine') : gol,
    analiza ? sb.from('apartament_suprafata').select('apartament_id, mpu').eq('grup_id', grupId) : gol,
    analiza ? sb.from('apartament_interes').select('apartament_id, user_id').eq('grup_id', grupId) : gol,
    sb.from('grup_membru_preferinte').select('*').eq('grup_id', grupId),
    sb.from('grup_membri').select('user_id').eq('grup_id', grupId).eq('status', 'activ')
  ]);

  const variantIds = (vars.data || []).map(v => v.id);
  const suprafete = {};
  (sups.data || []).forEach(s => { suprafete[s.apartament_id] = Number(s.mpu); });

  variante = (vars.data || []).map(function (v) {
    const niveluri = (nivs.data || []).filter(n => n.varianta_id === v.id).map(n => ({
      id: n.id, nume: n.nume, ord: n.ordine, su: Number(n.su_mp),
      suComun: n.su_comun_mp ? Number(n.su_comun_mp) : 0
    }));
    const nivIds = niveluri.map(n => n.id);
    const ap = (aps.data || []).filter(a => nivIds.indexOf(a.nivel_id) >= 0).map(function (a) {
      const propus = Number(a.mpu_propus);
      return {
        id: a.id, nivId: a.nivel_id, ord: a.ordine,
        tip: a.tip_key, tipEticheta: a.tip_eticheta,
        mpuMin: Number(a.mpu_min), mpuMax: Number(a.mpu_max), mpuPropus: propus,
        /* Un rând lipsă în `apartament_suprafata` înseamnă că nimeni n-a mișcat
           nimic, deci se folosește propunerea arhitectului. */
        mpu: suprafete[a.id] != null ? suprafete[a.id] : propus
      };
    });
    return {
      id: v.id, nume: v.nume, desc: v.descriere,
      niveluri: niveluri, ap: ap,
      /* Fișa și volumul sunt ale SETULUI (P+4 față de P+5), nu ale variantei:
         KML-ul e volumul construibil al ipotezei, deci toate variantele
         aceluiași set arată la fel în Google Earth. De aceea aceeași cale e
         scrisă pe trei-patru rânduri, dinadins. Vezi migrația 12. */
      pdfPath: v.pdf_path || null, pdfNume: v.pdf_nume || null,
      kmlPath: v.kml_path || null, kmlNume: v.kml_nume || null,
      costTeren: Number(v.cost_teren || analiza.cost_teren || 0),
      costMpSd: Number(analiza.cost_constructie_mp || 0),
      coefUtil: Number(v.coef_su_sd || COEF_UTIL_IMPLICIT),
      subsolSd: Number(v.subsol_sd_mp || 0),
      factorSubsol: analiza.cost_subsol_pct ? Number(analiza.cost_subsol_pct) / 100 : FACTOR_SUBSOL_IMPLICIT
    };
  }).filter(v => v.ap.length > 0);

  variantaActiva = variante.length ? variante[0].id : null;

  interese = {};
  (ints.data || []).forEach(function (i) {
    (interese[i.apartament_id] || (interese[i.apartament_id] = [])).push(i.user_id);
  });

  /* ⚠️ Numele și datele de profil se cer din `profiles_visible`, cu coloane
     scrise pe litere. View-ul e înghețat la 31 de coloane (o coloană adăugată
     după 31 iulie 2026 nu iese dintr-un `select('*')`), deci dacă vreodată
     `preferred_rooms` sau `preferred_area_sqm` lipsesc de aici, se vede imediat:
     cardurile scriu „? camere". */
  const userIds = (membriBruti.data || []).map(m => m.user_id);
  if (grup.admin_id && userIds.indexOf(grup.admin_id) < 0) userIds.push(grup.admin_id);
  const { data: profile } = await sb.from('profiles_visible')
    .select('user_id, pseudonym, preferred_rooms, preferred_area_sqm').in('user_id', userIds);

  const prefPeOm = {};
  (prefs.data || []).forEach(p => { prefPeOm[p.user_id] = p; });

  membri = (profile || []).map(function (p) {
    const pr = prefPeOm[p.user_id] || {};
    return {
      id: p.user_id,
      nume: p.pseudonym || 'Membru',
      profil: {
        camere: p.preferred_rooms != null ? parseInt(p.preferred_rooms, 10) : null,
        mp: p.preferred_area_sqm != null ? Number(p.preferred_area_sqm) : null
      },
      pref: {
        camere: pr.nr_camere != null ? Number(pr.nr_camere) : null,
        mp: pr.mpu_dorit != null ? Number(pr.mpu_dorit) : null,
        etaj: pr.etaj || 'orice',
        parcare: pr.locuri_parcare != null ? Number(pr.locuri_parcare) : 0,
        boxa: pr.boxa === true,
        cash: pr.buget_teren_cash != null ? Number(pr.buget_teren_cash) : null,
        total: pr.buget_total != null ? Number(pr.buget_total) : null,
        note: pr.note || ''
      }
    };
  });

  /* Celelalte terenuri ale grupului cu analiză, plus cine s-a înscris pe ele.
     Fără rândul „Și pe Busolei 16", cineva care s-a așezat deja pe alt teren
     arată exact ca unul nehotărât. */
  await incarcaAlteTerenuri(variantIds);
  await incarcaDocumente();
  await incarcaJurnal();
  await incarcaVerificari();

  scrieCapulPaginii(teren.data);
  document.getElementById('oaStare').hidden = true;
  document.getElementById('oaCorp').hidden = false;
  document.body.classList.add('oa-fundal');
  legDocumente();
  legJurnal();
  legSimulare();
  render();
}

async function incarcaAlteTerenuri(variantIdsDeAici){
  try {
    const { data: alte } = await sb.from('analiza_teren')
      .select('id, teren_id, terenuri(id, titlu)').eq('grup_id', grupId);
    altePagini = (alte || []).filter(a => a.teren_id !== terenId && a.terenuri)
      .map(a => ({ id: a.teren_id, titlu: a.terenuri.titlu }));

    /* Alegerile de pe celelalte terenuri: se cer toate interesele grupului și
       se scot cele de pe pagina asta. O a doua interogare pe apartamente ar fi
       cerut încă o rundă, iar tabela e mică. */
    const { data: toate } = await sb.from('apartament_interes')
      .select('apartament_id, user_id, analiza_apartament(varianta_id)').eq('grup_id', grupId);
    const titluri = {};
    altePagini.forEach(t => { titluri[t.id] = t.titlu; });
    const { data: varsAlte } = await sb.from('analiza_varianta')
      .select('id, analiza_id, analiza_teren(teren_id)').eq('grup_id', grupId);
    const terenAlVariantei = {};
    (varsAlte || []).forEach(v => {
      if (v.analiza_teren) terenAlVariantei[v.id] = v.analiza_teren.teren_id;
    });
    alteAlegeri = {};
    (toate || []).forEach(function (i) {
      const vid = i.analiza_apartament && i.analiza_apartament.varianta_id;
      const tid = terenAlVariantei[vid];
      if (!tid || tid === terenId || !titluri[tid]) return;
      const lista = alteAlegeri[i.user_id] || (alteAlegeri[i.user_id] = []);
      if (lista.indexOf(titluri[tid]) < 0) lista.push(titluri[tid]);
    });
  } catch (e) {
    console.warn('celelalte terenuri:', e);
    altePagini = []; alteAlegeri = {};
  }
}

function scrieCapulPaginii(teren){
  const numeGrup = document.getElementById('oaEticheta');
  /* Scris pe pagină, nu doar știut: altfel superadminul citește datele altui
     grup fără niciun semn că nu e la el acasă, iar o captură de ecran luată de
     aici ajunge mai târziu să pară a fi de la un membru. */
  numeGrup.textContent = suntSuperAdmin && !suntAdmin
    ? 'Împărțirea apartamentelor · vezi ca superadmin'
    : 'Împărțirea apartamentelor';

  document.getElementById('oaTitlu').textContent = teren ? teren.titlu : 'Teren';
  const bucati = [];
  if (teren && teren.suprafata) bucati.push(fmt(teren.suprafata) + ' mp');
  if (variante.length) {
    bucati.push(variante.length === 1 ? 'o variantă de împărțire'
                                      : variante.length + ' variante de împărțire');
  }
  /* ⚠️ `analiza` poate fi NULL: pagina se deschide și fără ea (decizia din 30
     august). Tot ce se citește din ea, de aici în jos, trece printr-o
     verificare. Prima formă n-o avea, iar pagina crăpa cu „Ceva n-a mers" pe
     exact cazul pentru care fusese deschisă: un teren fără analiză. */
  if (analiza) {
    bucati.push('din ' + (analiza.tip === 'detaliata' ? 'analiza detaliată' : 'analiza preliminară'));
  } else {
    bucati.push('încă fără analiză');
  }
  document.getElementById('oaSub').textContent = bucati.join(' · ');

  const ins = document.getElementById('oaInsigna');
  if (analiza) {
    ins.textContent = (analiza.titlu || 'Analiză ApartamenTUal') +
      (analiza.data_analizei ? ' · ' + formatData(analiza.data_analizei) : '');
  } else {
    ins.hidden = true;
  }

  /* Premisa de cost, scrisă sus, o dată. Toate cifrele din pagină, totalul și
     euro pe mp util, atârnă de ea; fără ea omul citește un preț ca pe o
     promisiune, nu ca pe rezultatul unei ipoteze. Se ia din analiză, deci e
     corectă și când altă analiză are alt cost pe metru. */
  const prem = document.getElementById('oaPremise');
  if (analiza && Number(analiza.cost_constructie_mp) > 0) {
    prem.innerHTML = 'Toate costurile din pagină sunt calculate la <strong>' +
      fmt(analiza.cost_constructie_mp) + ' € pe metru pătrat construit</strong>, ' +
      'un cost de referință din experiența recentă a construcției colaborative. ' +
      'Costul real se stabilește la ofertarea constructorului și poate să difere.';
    prem.hidden = false;
  }

  if (altePagini.length) {
    const ctx = document.getElementById('oaContext');
    ctx.innerHTML = 'Grupul are analize pe ' + (altePagini.length + 1) + ' terenuri. Vezi și ' +
      altePagini.map(t => '<a href="organizare-apartamente.html?grup=' + encodeURIComponent(grupId) +
        '&teren=' + encodeURIComponent(t.id) + '">' + esc(t.titlu) + '</a>').join(' · ') +
      '. Poți fi interesat de apartamente pe oricare dintre ele.';
    ctx.hidden = false;
  }

}

const LUNI = ['ianuarie','februarie','martie','aprilie','mai','iunie',
              'iulie','august','septembrie','octombrie','noiembrie','decembrie'];
function formatData(iso){
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return Number(p[2]) + ' ' + LUNI[Number(p[1]) - 1] + ' ' + p[0];
}

document.addEventListener('DOMContentLoaded', function () {
  oaPorneste().catch(function (e) {
    console.error('împărțirea apartamentelor:', e);
    arataStarea('Ceva n-a mers', 'Încearcă să reîncarci pagina.', '');
  });
});

})();

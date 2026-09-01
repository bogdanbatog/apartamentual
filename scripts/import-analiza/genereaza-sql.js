/* ═══════════════════════════════════════════════════════════════════════════
   IMPORT ANALIZĂ URBAN ANALYZER → SQL pentru „Împărțirea apartamentelor”
   1 septembrie 2026
   ═══════════════════════════════════════════════════════════════════════════

   CE FACE: citește unul sau mai multe exporturi CSV din Urban Analyzer și
   scrie un script SQL complet, comentat, gata de rulat manual în Supabase SQL
   Editor. NU atinge baza de date. NU trimite nimic nicăieri.

   Formatul CSV e cel din `apartamentual-strategie/produs/urban-analyzer/
   format-csv-export.md`, scris de Liviu pe 31 august 2026: o linie = un TIP de
   apartament, pe un nivel, într-o variantă. Deci se citesc counts, nu
   apartamente; expandarea în apartamente individuale se face aici.

   RULARE:
     node scripts/import-analiza/genereaza-sql.js config.json > iesire.sql

   Configurația (JSON) spune ce grup, ce teren și ce fișiere se importă.
   Un exemplu complet: `scripts/import-analiza/galvani-57.json`.

   ─────────────────────────────────────────────────────────────────────────
   CE NU SE IA DIN CSV, DEȘI EXISTĂ ACOLO
   ─────────────────────────────────────────────────────────────────────────

   `var_descriere` („8 apartamente · spatiu disponibil la parter”) NU se
   copiază. La Galvani, în setul de 10-11 apartamente, eticheta lui V1 spunea
   „11 apartamente” pe o variantă care are 10, iar a lui V2 spunea „10” pe una
   care are 11: sunt inversate față de `var_apartamente_total` și față de
   numărătoarea pe niveluri. Descrierea se scrie aici, din counts.

   `niv_su_mp` NU e bugetul de împărțit; `niv_su_locuinte_mp` e (spec-ul lui
   Liviu o spune explicit). Diferă la parter, unde poate sta comercial.

   SUBSOLUL nu devine nivel. Ar intra în desen ca cel mai lat rând (365 mp
   utili, față de 194 pe un etaj), iar `grila` din pagină se ia după nivelul
   cel mai mare, deci toate apartamentele s-ar strânge la jumătate de lățime
   pentru un rând gol. Sd-ul lui merge în `analiza_varianta.subsol_sd_mp`,
   exact rubrica pentru care a fost făcută.

   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';
const fs = require('fs');
const path = require('path');

/* ── CITIREA CSV-ULUI ────────────────────────────────────────────────────── */

function citesteCsv(caleFisier) {
  let text = fs.readFileSync(caleFisier, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);   // BOM-ul din spec
  const linii = text.split(/\r?\n/).filter(l => l.trim() !== '');
  const cap = linii[0].split(';');
  return linii.slice(1).map(function (linie) {
    const parti = linie.split(';');
    const o = {};
    cap.forEach((nume, i) => { o[nume] = (parti[i] || '').trim(); });
    return o;
  });
}

const nr = v => (v === '' || v == null) ? null : Number(v);

/* ── DIN LINII PLATE ÎN VARIANTE ─────────────────────────────────────────── */

function grupeazaVariante(randuri) {
  const variante = new Map();

  randuri.forEach(function (r) {
    let v = variante.get(r.var_cod);
    if (!v) {
      v = {
        cod: r.var_cod,
        regim: r.var_regim,
        areSubsol: r.var_are_subsol === 'da',
        sdTotal: nr(r.var_sd_total_mp),
        suTotal: nr(r.var_su_total_mp),
        suLocuinte: nr(r.var_su_locuinte_mp),
        suComercial: nr(r.var_su_comercial_mp),
        potObtinut: nr(r.var_pot_obtinut_pct),
        cutObtinut: nr(r.var_cut_obtinut),
        apTotalDinCsv: nr(r.var_apartamente_total),
        parcajeNecesare: nr(r.var_parcaje_necesare),
        parcajeSubsol: nr(r.var_parcaje_subsol),
        subsolSd: 0,
        niveluri: new Map()
      };
      variante.set(r.var_cod, v);
    }

    const idx = nr(r.niv_idx);

    /* Subsolul: nu devine nivel, dar Sd-ul lui se reține pe variantă. */
    if (r.niv_tip === 'subsol') { v.subsolSd = nr(r.niv_sd_mp) || 0; return; }

    let n = v.niveluri.get(idx);
    if (!n) {
      n = {
        idx: idx,
        nume: r.niv_nume,
        esteParter: r.niv_tip === 'parter',
        sd: nr(r.niv_sd_mp),
        /* ⚠️ `niv_su_locuinte_mp`, nu `niv_su_mp`: bugetul de dozare, adică
           ce rămâne după ce se scade comercialul de la parter. */
        su: nr(r.niv_su_locuinte_mp),
        suComercial: nr(r.niv_su_comercial_mp) || 0,
        apartamente: []
      };
      v.niveluri.set(idx, n);
    }

    const cate = nr(r.apt_nr) || 0;
    for (let i = 0; i < cate; i++) {
      n.apartamente.push({
        tip: r.apt_tip,
        eticheta: r.apt_denumire,
        min: nr(r.apt_su_min_mp),
        max: nr(r.apt_su_max_mp)
      });
    }
  });

  variante.forEach(function (v) {
    v.niveluriSortate = Array.from(v.niveluri.values()).sort((a, b) => a.idx - b.idx);
    v.apTotal = v.niveluriSortate.reduce((s, n) => s + n.apartamente.length, 0);
  });
  return Array.from(variante.values());
}

/* ── SUPRAFAȚA DE PORNIRE A FIECĂRUI APARTAMENT ──────────────────────────────

   Urban Analyzer nu dă suprafața fiecărui apartament, și nici nu trebuie: la
   faza preliminară ea nu există, se negociază pe nivel. Ce dă e Su-ul
   nivelului și câte apartamente de fiecare tip stau pe el.

   `mpu_propus` e propunerea arhitectului, de unde pornește cursorul: Su-ul
   nivelului împărțit proporțional cu mijlocul intervalelor din normativ. Un
   3 camere (66-87) primește mai mult decât un 2 camere (52-65) de pe același
   nivel, în raportul 76,5 la 58,5.

   Împărțirea proporțională poate scoate un apartament în afara intervalului
   lui. Atunci se fixează la capătul depășit și restul se reîmparte între cei
   rămași liberi, până nu mai iese nimeni. Fără pasul ăsta, un nivel cu o
   garsonieră și un patru camere ar da garsonierei 60 mp.                     */

function suprafeteDePornire(nivel) {
  const aps = nivel.apartamente;
  if (!aps.length) return [];

  const buget = nivel.su;
  const mij = aps.map(a => (a.min + a.max) / 2);
  const val = aps.map(() => null);          // fixate la capăt
  const avertismente = [];

  /* Cazul în care nici măcar minimele nu încap: dozarea din UA a pus pe nivel
     mai mult decât permite propriul lui buget. Nu se poate repara aici fără
     să mințim una din cifre, deci se dau minimele și se strigă. */
  const sumaMinime = aps.reduce((s, a) => s + a.min, 0);
  if (sumaMinime > buget + 0.005) {
    avertismente.push(
      'minimele însumează ' + sumaMinime.toFixed(2) + ' mp, dar nivelul are ' +
      buget.toFixed(2) + ' mp utili (lipsă ' + (sumaMinime - buget).toFixed(2) + ' mp)');
    return { valori: aps.map(a => a.min), avertismente: avertismente };
  }

  for (let tura = 0; tura < aps.length + 1; tura++) {
    const liberi = [];
    let ramas = buget;
    aps.forEach(function (a, i) {
      if (val[i] != null) ramas -= val[i]; else liberi.push(i);
    });
    if (!liberi.length) break;

    const sumaMij = liberi.reduce((s, i) => s + mij[i], 0);
    let iesit = false;
    liberi.forEach(function (i) {
      const brut = ramas * mij[i] / sumaMij;
      if (brut < aps[i].min - 1e-9) { val[i] = aps[i].min; iesit = true; }
      else if (brut > aps[i].max + 1e-9) { val[i] = aps[i].max; iesit = true; }
    });
    if (!iesit) { liberi.forEach(i => { val[i] = ramas * mij[i] / sumaMij; }); break; }
  }

  /* Rotunjirea la doi zecimali poate împinge suma peste bugetul nivelului cu
     câțiva bani de metru. Diferența se scade din cel mai mare apartament care
     mai are loc până la minimul lui. */
  const valori = val.map(x => Math.round(x * 100) / 100);
  let drift = Math.round((valori.reduce((s, x) => s + x, 0) - buget) * 100) / 100;
  if (drift > 0) {
    const ordine = valori.map((x, i) => i).sort((a, b) => valori[b] - valori[a]);
    for (const i of ordine) {
      if (drift <= 0) break;
      const poate = Math.round((valori[i] - aps[i].min) * 100) / 100;
      const scade = Math.min(poate, drift);
      valori[i] = Math.round((valori[i] - scade) * 100) / 100;
      drift = Math.round((drift - scade) * 100) / 100;
    }
  }
  return { valori: valori, avertismente: avertismente };
}

/* ── DESCRIEREA VARIANTEI ────────────────────────────────────────────────────

   Se scrie din counts, nu se copiază din `var_descriere`: vezi capul
   fișierului. Pagina adaugă singură „· are subsol”, deci nu se repetă aici.  */

function descriereVarianta(v, liberPeNivel) {
  const parti = [v.apTotal + (v.apTotal === 1 ? ' apartament' : ' apartamente')];

  /* Amestecul de tipologii. Fila din pagină arată deja numărul total și prețul
     pe metru, deci ce lipsește ca să deosebești două variante e din ce sunt
     făcute. Ordinea e cea din normativ, de la mic la mare. */
  const ordineTipuri = ['gars', 'studio', 'cam2', 'cam3', 'cam34'];
  const numarate = new Map();
  v.niveluriSortate.forEach(n => n.apartamente.forEach(function (a) {
    if (!numarate.has(a.tip)) numarate.set(a.tip, { eticheta: a.eticheta, cate: 0 });
    numarate.get(a.tip).cate++;
  }));
  const amestec = ordineTipuri.filter(t => numarate.has(t)).map(function (t) {
    const x = numarate.get(t);
    /* „3 cam” și „3-4 cam” sunt prescurtările din Urban Analyzer; într-o frază
       citită de oameni se scriu întregi. */
    const nume = x.eticheta.replace(/\bcam\b\.?/i, 'camere').replace(/^Gars\.$/, 'garsoniere');
    return x.cate + ' × ' + nume.toLowerCase();
  });
  if (amestec.length) parti.push(amestec.join(', '));

  const parter = v.niveluriSortate.find(n => n.esteParter);
  if (parter) {
    const liber = liberPeNivel.get(parter.idx) || 0;
    if (parter.apartamente.length === 0 && liber >= 20) {
      parti.push(Math.round(liber) + ' mp liberi la parter');
    } else if (parter.apartamente.length === 0 && liber < 20) {
      parti.push('tot parterul intră în parcaje');
    } else if (parter.apartamente.length === 1) {
      parti.push('unul la parter');
    } else {
      parti.push(parter.apartamente.length + ' la parter');
    }
  }
  return parti.join(' · ');
}

/* ── SCRIEREA SQL-ULUI ───────────────────────────────────────────────────── */

const sqlText = s => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
/* ⚠️ `null` gol, nu `null::numeric`, într-un `values` cu mai multe rânduri:
   dacă TOATE rândurile au NULL pe o coloană, Postgres o tipizează `text` și
   refuză inserarea într-o coloană numerică („column ... is of type numeric but
   expression is of type text"). Se întâmplă exact la coloanele care descriu
   excepții (spațiu comercial, spațiu comun): sunt goale tocmai când analiza nu
   are așa ceva, adică în cazul obișnuit. */
const sqlNum = n => (n == null || Number.isNaN(n)) ? 'null::numeric' : String(n);

function main() {
  const caleConfig = process.argv[2];
  if (!caleConfig) {
    process.stderr.write('Folosire: node genereaza-sql.js config.json > iesire.sql\n');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(caleConfig, 'utf8'));
  const radacina = path.dirname(path.resolve(caleConfig));

  /* Fiecare set = un fișier CSV = o ipoteză de volum (P+4, P+5...). Variantele
     din seturi diferite se ciocnesc la nume (toate încep cu V1), de aceea
     fiecare set are un prefix scris în configurație. */
  const variante = [];
  cfg.seturi.forEach(function (set) {
    const randuri = citesteCsv(path.resolve(radacina, set.csv));
    grupeazaVariante(randuri).forEach(function (v) {
      v.set = set;
      v.nume = set.prefix + ' · ' + v.cod;
      variante.push(v);
    });
  });

  const avertismente = [];

  /* Suprafețele de pornire, pentru toate nivelurile din toate variantele. */
  variante.forEach(function (v) {
    v.liber = new Map();
    v.niveluriSortate.forEach(function (n) {
      const rez = suprafeteDePornire(n);
      n.propuse = rez.valori || [];
      (rez.avertismente || []).forEach(function (a) {
        avertismente.push(v.nume + ' · ' + n.nume + ': ' + a);
      });
      const dat = n.propuse.reduce((s, x) => s + x, 0);
      v.liber.set(n.idx, Math.max(0, Math.round((n.su - n.suComercial - dat) * 100) / 100));
    });
    v.descriere = descriereVarianta(v, v.liber);
    if (v.apTotalDinCsv != null && v.apTotalDinCsv !== v.apTotal) {
      avertismente.push(v.nume + ': CSV-ul spune ' + v.apTotalDinCsv +
        ' apartamente, dar numărătoarea pe niveluri dă ' + v.apTotal);
    }
  });

  /* Două variante pot ieși cu aceeași descriere fiindcă chiar au același
     amestec și același parter, și diferă doar prin cum stau apartamentele pe
     etaje (la Galvani: P+4 V1 și V4). Filele din pagină ar arăta identic, iar
     omul n-ar ști pe care a apăsat. */
  const vazute = new Map();
  variante.forEach(function (v) {
    const cheie = v.set.prefix + '|' + v.descriere;
    if (vazute.has(cheie)) {
      v.descriere += ' · aceleași apartamente ca la ' + vazute.get(cheie) + ', altfel așezate pe etaje';
    } else {
      vazute.set(cheie, v.cod);
    }
  });

  const o = [];
  const p = s => o.push(s);
  const linie = '-- ═══════════════════════════════════════════════════════════════════════════';

  p(linie);
  p('-- IMPORT ANALIZĂ: ' + cfg.titlu);
  p('-- Generat de scripts/import-analiza/genereaza-sql.js pe ' + new Date().toISOString().slice(0, 10));
  p('--');
  p('-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot');
  p('--    tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă” anulează');
  p('--    tăcut și inserările de deasupra lui.');
  p('--');
  p('-- ⚠️ RULEAZĂ BLOCURILE PE RÂND, în ordinea 0 → 1 → 2 → 3 → 4 → 5.');
  p('--    BLOC 0 nu schimbă nimic. Rulează-l și citește-l înainte de restul.');
  p(linie);
  p('');

  /* ── BLOC 0 ──────────────────────────────────────────────────────────── */
  p(linie);
  p('-- BLOC 0 · VERIFICARE. Nu schimbă nimic.');
  p('--');
  p('-- Cele cinci secțiuni ies într-un singur tabel, prin UNION ALL: editorul');
  p('-- SQL din Supabase arată doar rezultatul ULTIMEI interogări dintr-un tab,');
  p('-- deci cinci SELECT-uri separate ar da o singură tabelă și patru necitite.');
  p(linie);
  p('');
  p('select * from (');
  p("  select 1 as ord, 'grup' as sectiune, g.id::text as id,");
  p('         g.nume as detaliu, null as extra');
  p('    from public.grupuri g');
  p('   where g.nume ilike ' + sqlText('%' + cfg.grup_cauta + '%'));
  p('  union all');
  p("  select 2, 'teren', t.id::text, t.titlu, t.suprafata::text");
  p('    from public.terenuri t');
  p('   where t.titlu ilike ' + sqlText('%' + cfg.teren_cauta + '%'));
  p('  union all');
  p("  select 3, 'membru activ', m.user_id::text,");
  p("         coalesce(pr.pseudonym, '(fără pseudonim)'), m.status");
  p('    from public.grup_membri m');
  p('    left join public.profiles pr on pr.user_id = m.user_id');
  p('   where m.grup_id in (select id from public.grupuri');
  p('                        where nume ilike ' + sqlText('%' + cfg.grup_cauta + '%') + ')');
  p("     and m.status = 'activ'");
  p('  union all');
  p("  select 4, 'teren la favorite', l.teren_id::text, 'da', null");
  p('    from public.terenuri_likes_grupuri l');
  p('   where l.grup_id in (select id from public.grupuri');
  p('                        where nume ilike ' + sqlText('%' + cfg.grup_cauta + '%') + ')');
  p('     and l.teren_id in (select id from public.terenuri');
  p('                         where titlu ilike ' + sqlText('%' + cfg.teren_cauta + '%') + ')');
  p('  union all');
  p("  select 5, 'analiză deja existentă', a.id::text, a.titlu, a.data_analizei::text");
  p('    from public.analiza_teren a');
  p('   where a.grup_id in (select id from public.grupuri');
  p('                        where nume ilike ' + sqlText('%' + cfg.grup_cauta + '%') + ')');
  p(') x order by ord, detaliu;');
  p('');
  p('-- CE TREBUIE SĂ VEZI:');
  p('--   • exact UN rând „grup” și exact UN rând „teren”. Dacă ies două,');
  p('--     restrânge textul căutat în configurație; blocurile de mai jos');
  p('--     crapă la „more than one row returned by a subquery”.');
  p('--   • „teren la favorite” poate lipsi: pagina se deschide oricum, fiindcă');
  p('--     de acum există o analiză. Fără analiză ȘI fără favorit, ar refuza.');
  p('--   • „analiză deja existentă” trebuie să lipsească. Dacă apare una pe');
  p('--     ACELAȘI teren, pagina o arată pe cea mai nouă și cealaltă rămâne');
  p('--     ascunsă, nu ștearsă. Șterge-o întâi cu BLOC 6.');
  p('');

  /* ── BLOC 1 ──────────────────────────────────────────────────────────── */
  const primaVarianta = variante[0];
  p(linie);
  p('-- BLOC 1 · ANALIZA');
  p('--');
  p('-- Cifrele de cost sunt cele tastate în Urban Analyzer, nu derivate:');
  p('--   • ' + cfg.cost_constructie_mp + ' €/mp Sd');
  p('--   • ' + cfg.cost_teren + ' € terenul');
  p('--   • subsolul la ' + cfg.cost_subsol_pct + '% din prețul pe metru');
  p('-- Verificate înapoi prin formula din UA (costConstr = sdFull×costMp +');
  p('-- sParcParter×costMp×0,2 + sdSubsol×costMp×factor) pe toate variantele.');
  p('--');
  p('-- Bilanțul de pe analiză e al variantei cu volumul cel mai mare; fiecare');
  p('-- variantă îl are pe al ei în `analiza_varianta`.');
  p(linie);
  p('');
  p('insert into public.analiza_teren (');
  p('  grup_id, teren_id, tip, titlu, data_analizei,');
  p('  cost_teren, cost_constructie_mp, cost_subsol_pct,');
  p('  suprafata_teren_mp, sd_total_mp, su_total_mp, pot_obtinut, cut_obtinut, note');
  p(') values (');
  p('  (select id from public.grupuri  where nume  ilike ' + sqlText('%' + cfg.grup_cauta + '%') + '),');
  p('  (select id from public.terenuri where titlu ilike ' + sqlText('%' + cfg.teren_cauta + '%') + '),');
  p("  'preliminara',");
  p('  ' + sqlText(cfg.titlu) + ',');
  p('  date ' + sqlText(cfg.data_analizei) + ',');
  p('  ' + sqlNum(cfg.cost_teren) + ', ' + sqlNum(cfg.cost_constructie_mp) + ', ' + sqlNum(cfg.cost_subsol_pct) + ',');
  /* Bilanțul de pe analiză e al variantei celei mai pline: Sd-ul cel mai mare,
     iar dintre cele care îl au (P+5 le are pe toate trei), Su-ul cel mai mare.
     Fără a doua condiție ar fi ieșit varianta fără subsol, cu 927 mp în loc de
     1.014, adică un bilanț mai mic decât ce poate face terenul. */
  const maxSd = Math.max.apply(null, variante.map(v => v.sdTotal));
  const cuMaxSd = variante.filter(v => v.sdTotal === maxSd)
                          .sort((a, b) => b.suTotal - a.suTotal)[0];
  p('  ' + sqlNum(cuMaxSd.set.suprafata_teren_mp != null ? cuMaxSd.set.suprafata_teren_mp : cfg.suprafata_teren_mp) +
    ', ' + sqlNum(cuMaxSd.sdTotal) + ', ' + sqlNum(cuMaxSd.suTotal) + ', ' +
    sqlNum(cuMaxSd.potObtinut) + ', ' + sqlNum(cuMaxSd.cutObtinut) + ',');
  p('  ' + sqlText(cfg.note) );
  p(');');
  p('');
  p('-- Trebuie să scrie „INSERT 0 1”. „INSERT 0 0” nu se poate întâmpla aici');
  p('-- (grup_id e NOT NULL, deci o căutare fără rezultat oprește inserarea cu');
  p('-- eroare), dar citește oricum linia de răspuns.');
  p('');
  /* Fișierele setului: fișa PDF și volumul KML. Sunt ale SETULUI, nu ale
     variantei (KML-ul e volumul ipotezei de volum, deci toate variantele
     aceluiași set arată la fel în Google Earth), de aceea blocul scrie aceeași
     cale pe toate variantele cu același prefix. Vezi migrația 12. */
  const cuFisiere = cfg.seturi.filter(s => s.pdf_nume || s.kml_nume);

  if (!cuFisiere.length) {
    p(linie);
    p('-- BLOC 1b · FIȘA PDF. Neobligatoriu, și se rulează abia DUPĂ ce urci fișierul.');
    p('--');
    p('-- Bucketul `analize-fise` e privat și primește încărcări doar de la');
    p('-- superadmin, deci fișa se urcă de mână din Storage, în dashboard.');
    p('-- Drumul trebuie să înceapă cu id-ul GRUPULUI: politica de citire se uită');
    p('-- la primul folder din nume ca să știe cine are voie să descarce. Un');
    p('-- fișier pus în rădăcină nu se vede de nimeni, fără nicio eroare.');
    p('--');
    p('--   analize-fise/<id-ul grupului din BLOC 0>/' + (cfg.pdf_nume || 'fisa.pdf'));
    p(linie);
    p('');
    p('-- update public.analiza_teren');
    p("--    set pdf_path = (select id::text from public.grupuri");
    p('--                    where nume ilike ' + sqlText('%' + cfg.grup_cauta + '%') + ")");
    p("--                  || '/' || " + sqlText(cfg.pdf_nume || 'fisa.pdf') + ',');
    p('--        pdf_nume = ' + sqlText(cfg.pdf_nume || 'fisa.pdf'));
    p('--  where titlu = ' + sqlText(cfg.titlu) + ';');
    p('');
  }

  /* ── BLOC 2 ──────────────────────────────────────────────────────────── */
  p(linie);
  p('-- BLOC 2 · VARIANTELE (' + variante.length + ')');
  p('--');
  cfg.seturi.forEach(function (s) {
    const ale = variante.filter(v => v.set === s);
    p('--   ' + s.prefix + ': ' + ale.length + ' variante, din ' + path.basename(s.csv));
  });
  p('--');
  p('-- Numele poartă prefixul setului fiindcă amândouă exporturile își numesc');
  p('-- variantele V1, V2, V3: fără prefix, filele din pagină s-ar ciocni.');
  p('--');
  p('-- `cost_teren` rămâne NULL pe variante dinadins: pagina cade pe cel de pe');
  p('-- analiză, deci suma stă scrisă într-un singur loc.');
  p('--');
  p('-- `descriere` NU e copiată din `var_descriere` (eticheta auto din UA): la');
  p('-- Galvani, în setul P+5, eticheta lui V1 spunea „11 apartamente” pe o');
  p('-- variantă cu 10, iar a lui V2 „10” pe una cu 11. Se scrie din counts.');
  p(linie);
  p('');
  p('insert into public.analiza_varianta (');
  p('  analiza_id, grup_id, nume, descriere, su_total_mp, sd_total_mp,');
  p('  coef_su_sd, subsol_sd_mp, are_subsol, su_comercial_mp, locuri_parcare, ordine');
  p(')');
  p('select a.id, a.grup_id, v.nume, v.descriere, v.su_total, v.sd_total,');
  p('       v.coef, v.subsol_sd, v.are_subsol, v.su_com, v.parcaje, v.ordine');
  p('  from public.analiza_teren a,');
  p('       (values');
  variante.forEach(function (v, i) {
    p('         (' + [
      sqlText(v.nume),
      sqlText(v.descriere),
      sqlNum(v.suLocuinte),
      sqlNum(v.sdTotal),
      sqlNum(cfg.coef_su_sd),
      sqlNum(v.subsolSd),
      v.areSubsol ? 'true' : 'false',
      sqlNum(v.suComercial || null),
      sqlNum(v.parcajeNecesare),
      String(i + 1)
    ].join(', ') + ')' + (i === variante.length - 1 ? '' : ',') +
      '   -- ' + v.regim + ', ' + v.apTotal + ' ap.');
  });
  p('       ) as v(nume, descriere, su_total, sd_total, coef, subsol_sd,');
  p('              are_subsol, su_com, parcaje, ordine)');
  p(' where a.titlu = ' + sqlText(cfg.titlu) + ';');
  p('');
  p('-- Trebuie să scrie „INSERT 0 ' + variante.length + '”.');
  p('');

  /* ── BLOC 3 ──────────────────────────────────────────────────────────── */
  const totalNiveluri = variante.reduce((s, v) => s + v.niveluriSortate.length, 0);
  p(linie);
  p('-- BLOC 3 · NIVELURILE (' + totalNiveluri + ')');
  p('--');
  p('-- `su_mp` e `niv_su_locuinte_mp` din CSV, nu `niv_su_mp`: bugetul de');
  p('-- împărțit, adică ce rămâne după ce se scade comercialul de la parter.');
  p('--');
  p('-- SUBSOLUL NU E AICI. Ar intra în desen ca cel mai lat rând (365 mp utili,');
  p('-- față de 194 pe un etaj), iar lățimile din pagină se raportează la');
  p('-- nivelul cel mai mare: toate apartamentele s-ar strânge la jumătate');
  p('-- pentru un rând gol. Sd-ul lui e pe variantă, în `subsol_sd_mp`.');
  p(linie);
  p('');
  p('insert into public.analiza_nivel (varianta_id, grup_id, nume, ordine, su_mp, este_parter, su_comun_mp)');
  p('select va.id, va.grup_id, n.nume, n.ordine, n.su, n.parter, n.comun');
  p('  from public.analiza_varianta va');
  p('  join public.analiza_teren a on a.id = va.analiza_id');
  p('  join (values');
  const randuriNivel = [];
  variante.forEach(function (v) {
    v.niveluriSortate.forEach(function (n) {
      randuriNivel.push({
        v: v, n: n,
        sql: '(' + [
          sqlText(v.nume), sqlText(n.nume), String(n.idx),
          sqlNum(Math.round((n.su - n.suComercial) * 100) / 100),
          n.esteParter ? 'true' : 'false',
          sqlNum(n.suComercial || null)
        ].join(', ') + ')'
      });
    });
  });
  randuriNivel.forEach(function (r, i) {
    p('         ' + r.sql + (i === randuriNivel.length - 1 ? '' : ',') +
      '   -- ' + r.n.apartamente.length + ' ap.');
  });
  p('       ) as n(varianta, nume, ordine, su, parter, comun)');
  p('    on n.varianta = va.nume');
  p(' where a.titlu = ' + sqlText(cfg.titlu) + ';');
  p('');
  p('-- Trebuie să scrie „INSERT 0 ' + totalNiveluri + '”.');
  p('');

  /* ── BLOC 4 ──────────────────────────────────────────────────────────── */
  const randuriAp = [];
  variante.forEach(function (v) {
    v.niveluriSortate.forEach(function (n) {
      n.apartamente.forEach(function (a, i) {
        randuriAp.push({
          v: v, n: n, a: a,
          sql: '(' + [
            sqlText(v.nume), sqlText(n.nume), String(i + 1),
            sqlText(a.tip), sqlText(a.eticheta),
            sqlNum(a.min), sqlNum(a.max), sqlNum(n.propuse[i])
          ].join(', ') + ')'
        });
      });
    });
  });
  p(linie);
  p('-- BLOC 4 · APARTAMENTELE (' + randuriAp.length + ')');
  p('--');
  p('-- Urban Analyzer nu dă suprafața fiecărui apartament, și nici nu trebuie:');
  p('-- la faza preliminară ea nu există, se negociază pe nivel, la proiectare.');
  p('-- Ce dă e Su-ul nivelului și câte apartamente de fiecare tip stau pe el.');
  p('--');
  p('-- `mpu_propus` e propunerea arhitectului, de unde pornește cursorul:');
  p('-- Su-ul nivelului împărțit proporțional cu mijlocul intervalelor din');
  p('-- normativ, apoi corectat pentru cine ieșea din interval. Rămâne scris,');
  p('-- deci există mereu drum înapoi: se șterge rândul din');
  p('-- `apartament_suprafata` și revine propunerea.');
  p(linie);
  p('');
  p('insert into public.analiza_apartament (');
  p('  nivel_id, varianta_id, grup_id, tip_key, tip_eticheta,');
  p('  mpu_min, mpu_max, mpu_propus, ordine');
  p(')');
  p('select ni.id, ni.varianta_id, ni.grup_id, x.tip, x.eticheta,');
  p('       x.mpu_min, x.mpu_max, x.mpu_propus, x.ordine');
  p('  from public.analiza_nivel ni');
  p('  join public.analiza_varianta va on va.id = ni.varianta_id');
  p('  join public.analiza_teren a on a.id = va.analiza_id');
  p('  join (values');
  randuriAp.forEach(function (r, i) {
    p('         ' + r.sql + (i === randuriAp.length - 1 ? '' : ','));
  });
  p('       ) as x(varianta, nivel, ordine, tip, eticheta, mpu_min, mpu_max, mpu_propus)');
  p('    on x.varianta = va.nume and x.nivel = ni.nume');
  p(' where a.titlu = ' + sqlText(cfg.titlu) + ';');
  p('');
  p('-- Trebuie să scrie „INSERT 0 ' + randuriAp.length + '”.');
  p('');

  /* ── BLOC 5 ──────────────────────────────────────────────────────────── */
  p(linie);
  p('-- BLOC 5 · VERIFICĂRILE. Nu schimbă nimic.');
  p(linie);
  p('');
  p('select * from (');
  p("  select 1 as ord, 'variantă' as sectiune, va.nume as detaliu,");
  p('         count(distinct ni.id)::text as niveluri,');
  p('         count(ap.id)::text as apartamente,');
  p('         round(sum(ap.mpu_propus), 2)::text as mp_dati,');
  p('         round(va.su_total_mp, 2)::text as mp_de_dat');
  p('    from public.analiza_varianta va');
  p('    join public.analiza_teren a on a.id = va.analiza_id');
  p('    left join public.analiza_nivel ni on ni.varianta_id = va.id');
  p('    left join public.analiza_apartament ap on ap.nivel_id = ni.id');
  p('   where a.titlu = ' + sqlText(cfg.titlu));
  p('   group by va.nume, va.ordine, va.su_total_mp');
  p('  union all');
  p('  -- (b) niciun apartament nu trebuie să iasă din intervalul lui');
  p("  select 2, 'ÎN AFARA INTERVALULUI', va.nume || ' · ' || ni.nume || ' · ' || ap.tip_eticheta,");
  p('         ap.mpu_propus::text, ap.mpu_min::text, ap.mpu_max::text, null');
  p('    from public.analiza_apartament ap');
  p('    join public.analiza_nivel ni on ni.id = ap.nivel_id');
  p('    join public.analiza_varianta va on va.id = ap.varianta_id');
  p('    join public.analiza_teren a on a.id = va.analiza_id');
  p('   where a.titlu = ' + sqlText(cfg.titlu));
  p('     and (ap.mpu_propus < ap.mpu_min or ap.mpu_propus > ap.mpu_max)');
  p('  union all');
  p('  -- (c) niciun nivel nu trebuie să fie umplut peste Su-ul lui');
  p("  select 3, 'NIVEL DEPĂȘIT', va.nume || ' · ' || ni.nume,");
  p('         round(sum(ap.mpu_propus), 2)::text, round(ni.su_mp, 2)::text, null, null');
  p('    from public.analiza_apartament ap');
  p('    join public.analiza_nivel ni on ni.id = ap.nivel_id');
  p('    join public.analiza_varianta va on va.id = ap.varianta_id');
  p('    join public.analiza_teren a on a.id = va.analiza_id');
  p('   where a.titlu = ' + sqlText(cfg.titlu));
  p('   group by va.nume, ni.nume, ni.su_mp');
  p('  having sum(ap.mpu_propus) > ni.su_mp + 0.01');
  p('  union all');
  p('  -- (d) grup_id-ul copiat trebuie să fie același peste tot: o variantă');
  p('  --     scrisă pe alt grup e invizibilă în pagină, fără nicio eroare');
  p("  select 4, 'GRUP GREȘIT', va.nume, va.grup_id::text, a.grup_id::text, null, null");
  p('    from public.analiza_varianta va');
  p('    join public.analiza_teren a on a.id = va.analiza_id');
  p('   where a.titlu = ' + sqlText(cfg.titlu) + ' and va.grup_id <> a.grup_id');
  p(') x order by ord, detaliu;');
  p('');
  p('-- CE TREBUIE SĂ VEZI: doar rânduri „variantă”, câte unul de fiecare.');
  p('-- Orice rând scris cu majuscule e o problemă și oprește proba.');
  p('');

  /* ── BLOC 7 ──────────────────────────────────────────────────────────── */
  if (cuFisiere.length) {
    p(linie);
    p('-- BLOC 7 · FIȘA ȘI VOLUMUL. Se rulează ULTIMUL, și numai după două lucruri:');
    p('--');
    p('--   1. migrația `12-fisa-si-volum-pe-varianta.sql`, care face coloanele');
    p('--      și lasă bucketul să primească și KML;');
    p('--   2. urcarea fișierelor de mână în Storage, în bucketul `analize-fise`.');
    p('--');
    p('-- ⚠️ Drumul trebuie să înceapă cu id-ul GRUPULUI. Politica de citire se');
    p('--    uită la primul folder din nume ca să știe cine are voie să descarce,');
    p('--    deci un fișier pus în rădăcină nu se vede de nimeni, fără nicio');
    p('--    eroare și fără niciun semn că ar fi ceva în neregulă.');
    p('--');
    p('-- Fișierele de urcat, cu numele exact scris aici:');
    cuFisiere.forEach(function (set) {
      if (set.pdf_nume) p('--   analize-fise/<id-ul grupului>/' + set.pdf_nume);
      if (set.kml_nume) p('--   analize-fise/<id-ul grupului>/' + set.kml_nume);
    });
    p('--');
    p('-- Aceeași cale se scrie pe toate variantele setului: fișa și volumul');
    p('-- descriu ipoteza de volum, nu varianta. Toate cele ' + variante.filter(v => v.set === cuFisiere[0]).length);
    p('-- variante ' + cuFisiere[0].prefix + ' arată la fel în Google Earth.');
    p(linie);
    p('');
    cuFisiere.forEach(function (set, i) {
      const ale = variante.filter(v => v.set === set);
      const grupSub = '(select id::text from public.grupuri where nume ilike ' +
        sqlText('%' + cfg.grup_cauta + '%') + ')';
      p('-- ' + set.prefix + ': ' + ale.length + ' variante (' +
        ale.map(v => v.cod).join(', ') + ')');
      p('update public.analiza_varianta va');
      const seteaza = [];
      if (set.pdf_nume) {
        seteaza.push("   set pdf_path = " + grupSub + " || '/' || " + sqlText(set.pdf_nume));
        seteaza.push('       pdf_nume = ' + sqlText(set.pdf_nume));
      }
      if (set.kml_nume) {
        seteaza.push('       kml_path = ' + grupSub + " || '/' || " + sqlText(set.kml_nume));
        seteaza.push('       kml_nume = ' + sqlText(set.kml_nume));
      }
      seteaza[0] = seteaza[0].replace(/^   set /, '   set ');
      seteaza.forEach((linieSet, k) => p(linieSet + (k === seteaza.length - 1 ? '' : ',')));
      p('  from public.analiza_teren a');
      p(' where a.id = va.analiza_id');
      p('   and a.titlu = ' + sqlText(cfg.titlu));
      p('   and va.nume like ' + sqlText(set.prefix + ' · %') + ';');
      p('');
      p('-- Trebuie să scrie „UPDATE ' + ale.length + '”.');
      p('');
    });
    p('-- Verificare: fiecare variantă trebuie să aibă o cale care începe cu');
    p('-- id-ul grupului ei. Un `false` la `incepe_cu_grupul` înseamnă fișier');
    p('-- invizibil, oricât de corect ar arăta restul.');
    p('');
    p('select va.nume, va.pdf_nume, va.kml_nume,');
    p("       (va.pdf_path like a.grup_id::text || '/%') as incepe_cu_grupul");
    p('  from public.analiza_varianta va');
    p('  join public.analiza_teren a on a.id = va.analiza_id');
    p(' where a.titlu = ' + sqlText(cfg.titlu));
    p(' order by va.ordine;');
    p('');
  }

  /* ── BLOC 6 ──────────────────────────────────────────────────────────── */
  p(linie);
  p('-- BLOC 6 · ȘTERGEREA. NU se rulează la import.');
  p('--');
  p('-- E aici ca proba să se poată da înapoi într-o singură comandă. Șterge');
  p('-- analiza cu tot ce atârnă de ea, INCLUSIV suprafețele mișcate de oameni');
  p('-- și înscrierile pe apartamente. Nu atinge preferințele membrilor,');
  p('-- jurnalul terenului, documentele sau notele: acelea nu depind de analiză.');
  p(linie);
  p('');
  p('-- delete from public.analiza_teren where titlu = ' + sqlText(cfg.titlu) + ';');
  p('');

  process.stdout.write(o.join('\n') + '\n');

  /* Avertismentele merg pe stderr, ca să nu ajungă în fișierul SQL. */
  if (avertismente.length) {
    process.stderr.write('\n⚠️  ' + avertismente.length + ' lucruri de citit înainte de rulare:\n');
    avertismente.forEach(a => process.stderr.write('   • ' + a + '\n'));
    process.stderr.write('\n');
  }
  process.stderr.write('Scris: ' + variante.length + ' variante, ' + totalNiveluri +
    ' niveluri, ' + randuriAp.length + ' apartamente.\n');
}

main();

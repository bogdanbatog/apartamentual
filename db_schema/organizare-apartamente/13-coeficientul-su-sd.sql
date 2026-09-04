-- ═══════════════════════════════════════════════════════════════════════════
-- COEFICIENTUL Su/Sd, CORECTAT PE ANALIZELE DEJA IMPORTATE
-- 4 septembrie 2026
--
-- CE FACE. Schimbă o singură coloană, `analiza_varianta.coef_su_sd`, pe cele
-- 16 variante importate până acum. Nu atinge nicio altă coloană, nicio
-- politică, nicio suprafață aleasă de oameni și nicio înscriere pe apartament.
--
-- ⚠️ SE VĂD BANI. Cifrele din pagina de împărțire se schimbă pentru 21 de
--    oameni la „Parcul Circului" și pentru membrii de la „Eco pentru medici".
--    Costurile CRESC. Nu e o scumpire, e o subestimare reparată.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE
--
-- `coef_su_sd` e cifra prin care pagina află câți metri desfășurați se
-- construiesc pentru metrii utili împărțiți:
--
--     cost = (Su împărțit + Su comun) / coef × cost_constructie_mp
--            + subsol_sd_mp × cost_constructie_mp × cost_subsol_pct
--
-- Până acum era 0,700 peste tot, scrisă de mână în configurația importului,
-- pe ideea că e raportul Su/Sd din Urban Analyzer. NU e asta.
--
-- Urban Analyzer taxează amprenta parcajelor de la parter la 20%, nu la 100%.
-- Pagina n-are niciun concept de parcaj, deci singura pârghie prin care poate
-- intra reducerea aceea e chiar coeficientul. Cu 0,700 pagina arăta un cost de
-- construcție cu 4,4% mai mic decât fișa PDF pe care o descarcă grupul:
--
--     Galvani, fiecare variantă:  între 56.000 și 68.000 € în minus
--     Bosianu 32, V1:             42.783 € în minus
--
-- Adică vreo 7.000-8.500 € pe familie, în minus, pe o pagină al cărei rost e
-- să arate oamenilor cât plătesc.
--
-- ⚠️ E PER VARIANTĂ, nu pe analiză. Două variante ale aceleiași clădiri au
--    coeficienți diferiți dacă au număr diferit de parcaje la parter. La
--    Galvani ies între 0,668 și 0,678. O singură cifră ar lăsa 1,4% eroare.
--
-- Cifrele de mai jos sunt calculate înapoi din costul pe care UA îl scrie în
-- CSV, scăzând întâi partea de subsol, fiindcă pagina o ține separat:
--
--     coef = Su × costMp / (cost_constructie − Sd_subsol × costMp × factor)
--
-- Coloana e `numeric(4,3)`, deci trei zecimale. Rotunjirea lasă o eroare de
-- cel mult 0,07%, adică vreo mie de euro pe un milion și jumătate.
--
-- Bosianu 32 a fost importat pe 4 septembrie cu 0,657 pe amândouă variantele,
-- ceea ce era corect pentru V1 și cu 2.467 € prea puțin pentru V2. Aici se
-- îndreaptă și el. Generatorul calculează de acum coeficientul singur, din
-- CSV, per variantă, deci importurile următoare intră corect din prima.
--
-- ⚠️ NU pune begin / rollback în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un rollback „de probă" anulează tăcut
--    și UPDATE-ul de mai jos.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND: 0 → 1 → 2. BLOC 0 nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0 · CE E ACUM ÎN BAZĂ. Nu schimbă nimic.
--
-- Arată fiecare variantă cu coeficientul ei de azi, cifra care ar trebui să
-- fie, costul pe care îl arată pagina acum și cel din fișă. Citește-l înainte
-- de BLOC 1: dacă „acum" nu e 0,700 peste tot, altcineva a umblat deja aici
-- și trebuie discutat, nu rulat.
-- ═══════════════════════════════════════════════════════════════════════════

select g.nume                                as grup,
       va.nume                               as varianta,
       va.coef_su_sd                         as acum,
       nou.coef                              as ar_trebui,
       round( (va.su_total_mp + coalesce(va.su_comercial_mp, 0)) / va.coef_su_sd
              * a.cost_constructie_mp
              + va.subsol_sd_mp * a.cost_constructie_mp * a.cost_subsol_pct / 100
            )                                as cost_aratat_acum,
       nou.cost_fisa                         as cost_in_fisa,
       round( (va.su_total_mp + coalesce(va.su_comercial_mp, 0)) / va.coef_su_sd
              * a.cost_constructie_mp
              + va.subsol_sd_mp * a.cost_constructie_mp * a.cost_subsol_pct / 100
            ) - nou.cost_fisa                as diferenta
  from public.analiza_varianta va
  join public.analiza_teren a on a.id = va.analiza_id
  join public.grupuri g       on g.id = a.grup_id
  join (values
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V1', 0.672, 1656016),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V2', 0.677, 2185776),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V3', 0.678, 2203056),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V1', 0.669, 1526174),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V2', 0.668, 1511774),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V3', 0.670, 1540574),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V4', 0.669, 1526174),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V1', 0.657,  694846),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V2', 0.659,  713566)
       ) as nou(titlu, varianta, coef, cost_fisa)
    on nou.titlu = a.titlu and nou.varianta = va.nume
 order by g.nume, va.nume;

-- CE TREBUIE SĂ VEZI: 16 rânduri.
--   • 7 pentru „Eco pentru medici" și 7 pentru „Parcul Circului" (Galvani),
--     toate cu `acum = 0.700` și o `diferenta` negativă de zeci de mii de euro;
--   • 2 pentru „Constantin Bosianu nr. 32", cu `acum = 0.657`; acolo V1 e deja
--     bun (diferență sub 200 €) și doar V2 are de câștigat.
-- Dacă ies mai puține rânduri, o analiză lipsește sau o variantă e denumită
-- altfel; oprește-te și spune, nu rula BLOC 1.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · CORECTAREA.
--
-- Se leagă pe titlul analizei ȘI numele variantei, deci prinde amândouă
-- grupurile care au analiza Galvani, fără să le enumere. E ce vrem: e aceeași
-- analiză, aceeași clădire, aceleași cifre.
-- ═══════════════════════════════════════════════════════════════════════════

update public.analiza_varianta va
   set coef_su_sd = nou.coef
  from public.analiza_teren a,
       (values
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V1', 0.672),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V2', 0.677),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V3', 0.678),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V1', 0.669),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V2', 0.668),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V3', 0.670),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V4', 0.669),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V1', 0.657),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V2', 0.659)
       ) as nou(titlu, varianta, coef)
 where a.id = va.analiza_id
   and nou.titlu = a.titlu
   and nou.varianta = va.nume;

-- Trebuie să scrie „UPDATE 16".
-- Un număr mai mic înseamnă că BLOC 0 a arătat mai puține rânduri și n-ai
-- citit avertismentul de acolo.


-- Comentariul coloanei spunea „0,70 în Urban Analyzer", ceea ce e chiar
-- capcana în care am căzut. Se rescrie, ca următorul om să nu repete.

comment on column public.analiza_varianta.coef_su_sd is
    'Cifra prin care se află câți metri desfășurați se construiesc pentru metrii utili împărțiți, și de acolo costul construcției. NU e raportul Su/Sd, deși așa se numește: Urban Analyzer taxează amprenta parcajelor de la parter la 20%, iar pagina n-are niciun concept de parcaj, deci reducerea aceea intră tot prin coeficient. Se calculează înapoi din costul scris de UA în CSV, per variantă, ca Su × costMp / (cost_constructie − Sd_subsol × costMp × factor_subsol). Iese între 0,66 și 0,68 pe analizele de până acum. 0,700 e vechea valoare implicită și subestimează costul cu vreo 4,4%.';


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VERIFICAREA. Nu schimbă nimic.
--
-- Aceeași socoteală ca în BLOC 0, refăcută. Acum `diferenta` trebuie să fie
-- mică pe toate rândurile: rotunjirea la trei zecimale, nimic mai mult.
-- ═══════════════════════════════════════════════════════════════════════════

select g.nume                                as grup,
       va.nume                               as varianta,
       va.coef_su_sd                         as coeficient,
       round( (va.su_total_mp + coalesce(va.su_comercial_mp, 0)) / va.coef_su_sd
              * a.cost_constructie_mp
              + va.subsol_sd_mp * a.cost_constructie_mp * a.cost_subsol_pct / 100
            )                                as cost_aratat_de_pagina,
       nou.cost_fisa                         as cost_in_fisa,
       round( (va.su_total_mp + coalesce(va.su_comercial_mp, 0)) / va.coef_su_sd
              * a.cost_constructie_mp
              + va.subsol_sd_mp * a.cost_constructie_mp * a.cost_subsol_pct / 100
            ) - nou.cost_fisa                as diferenta
  from public.analiza_varianta va
  join public.analiza_teren a on a.id = va.analiza_id
  join public.grupuri g       on g.id = a.grup_id
  join (values
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V1', 1656016),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V2', 2185776),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V3', 2203056),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V1', 1526174),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V2', 1511774),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V3', 1540574),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V4', 1526174),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V1',  694846),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V2',  713566)
       ) as nou(titlu, varianta, cost_fisa)
    on nou.titlu = a.titlu and nou.varianta = va.nume
 order by abs( round( (va.su_total_mp + coalesce(va.su_comercial_mp, 0)) / va.coef_su_sd
                      * a.cost_constructie_mp
                      + va.subsol_sd_mp * a.cost_constructie_mp * a.cost_subsol_pct / 100
                    ) - nou.cost_fisa ) desc;

-- CE TREBUIE SĂ VEZI: 16 rânduri, toate cu `diferenta` sub 1.100 € în valoare
-- absolută (primul rând e cel mai prost, fiindcă sortarea e după diferență).
-- Orice rând cu zeci de mii înseamnă că UPDATE-ul nu l-a prins.
--
-- ⚠️ PROBA ADEVĂRATĂ E ÎN PAGINĂ, nu aici: deschide împărțirea apartamentelor
--    la „Parcul Circului" și compară €/mp util cu fișa PDF descărcată de
--    acolo. Aici rulezi ca `postgres` și vezi datele, nu ce vede omul.


-- ═══════════════════════════════════════════════════════════════════════════
-- CUM SE DĂ ÎNAPOI, dacă e nevoie
--
-- update public.analiza_varianta va
--    set coef_su_sd = 0.700
--   from public.analiza_teren a
--  where a.id = va.analiza_id
--    and a.titlu in ('Analiză preliminară Luigi Galvani 57',
--                    'Analiză preliminară Constantin Bosianu 32');
--
-- Dar întoarcerea la 0,700 înseamnă întoarcerea la cifre mai mici decât cele
-- din fișă, deci nu e o reparație, e o revenire la problemă.
-- ═══════════════════════════════════════════════════════════════════════════

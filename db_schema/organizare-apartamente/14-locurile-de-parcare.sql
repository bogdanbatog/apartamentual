-- ═══════════════════════════════════════════════════════════════════════════
-- CÂTE LOCURI DE PARCARE STAU UNDE
-- 4 septembrie 2026
--
-- CE FACE. Adaugă trei coloane pe `analiza_varianta` și le umple pe cele 16
-- variante importate până acum. Nu schimbă nicio coloană existentă, nicio
-- politică, nicio suprafață aleasă de oameni.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE
--
-- În pagina de împărțire, rândul parterului arată mai scurt decât etajele și
-- restul lui rămâne pur și simplu gol, fără nicio explicație. Motivul e că
-- `analiza_nivel.su_mp` e suprafața utilă rămasă DUPĂ ce parcajele și-au luat
-- locul: la Galvani, P+5 V1, parterul are 4,24 mp utili dintr-un rând care la
-- etaj înseamnă 193,95. Omul vede un rând aproape gol și nu are de unde ști că
-- acolo stau 15 mașini.
--
-- Ca să putem scrie asta în pagină, trebuie să știm câte locuri stau la parter.
--
-- ⚠️ `locuri_parcare`, coloana care există deja, e NECESARUL, nu ce stă la
--    parter. La variantele cu subsol cele două chiar diferă:
--
--      Galvani P+5 V2:  16 necesare  =  8 la parter  +  8 la subsol
--      Galvani P+5 V3:  15 necesare  =  7 la parter  +  8 la subsol
--      Bosianu  P+3 V1:  8 necesare  =  8 la parter  +  1 pe teren   (9 puse)
--
--    Deci nu se poate deduce, trebuie ținut. De aici cele trei coloane.
--
-- ⚠️ NU pune begin / rollback în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un rollback „de probă" anulează tăcut
--    și coloanele de mai sus.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND: 1 → 2 → 3.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · COLOANELE.
--
-- `not null default 0` dinadins: o variantă fără cifre scrise arată zero
-- locuri, adică pagina nu desenează nicio casetă. Mai bine tace decât să
-- inventeze un număr.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.analiza_varianta
  add column if not exists locuri_parcare_parter integer not null default 0,
  add column if not exists locuri_parcare_subsol integer not null default 0,
  add column if not exists locuri_parcare_teren  integer not null default 0;

comment on column public.analiza_varianta.locuri_parcare_parter is
    'Câte locuri de parcare stau la parter. Din ele iese caseta „parcare" din rândul parterului, în pagina de împărțire: fără ea, restul rândului arată gol și nimeni nu știe de ce. NU e același lucru cu `locuri_parcare`, care e necesarul: la variantele cu subsol o parte din locuri coboară acolo.';

comment on column public.analiza_varianta.locuri_parcare_subsol is
    'Câte locuri de parcare stau în subsol. Subsolul nu se desenează ca nivel (ar fi cel mai lat rând, pentru un rând gol), deci cifra asta apare ca al doilea rând din caseta parterului: „plus 8 la subsol".';

comment on column public.analiza_varianta.locuri_parcare_teren is
    'Câte locuri de parcare stau pe teren, în afara clădirii. De obicei 0 sau 1.';


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · CIFRELE PENTRU ANALIZELE DEJA IMPORTATE.
--
-- Se leagă pe titlul analizei ȘI numele variantei, deci prinde amândouă
-- grupurile care au analiza Galvani. Cifrele vin din exporturile CSV.
-- ═══════════════════════════════════════════════════════════════════════════

update public.analiza_varianta va
   set locuri_parcare_parter = p.parter,
       locuri_parcare_subsol = p.subsol,
       locuri_parcare_teren  = p.teren
  from public.analiza_teren a,
       (values
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V1', 15, 0, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V2',  8, 8, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+5 · V3',  7, 8, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V1', 13, 0, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V2', 14, 0, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V3', 13, 0, 0),
         ('Analiză preliminară Luigi Galvani 57',        'P+4 · V4', 13, 0, 0),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V1',  8, 0, 1),
         ('Analiză preliminară Constantin Bosianu 32',   'P+3 · V2',  7, 0, 1)
       ) as p(titlu, varianta, parter, subsol, teren)
 where a.id = va.analiza_id
   and p.titlu = a.titlu
   and p.varianta = va.nume;

-- Trebuie să scrie „UPDATE 16": 7 variante × 2 grupuri Galvani, plus 2 Bosianu.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 3 · VERIFICAREA. Nu schimbă nimic.
--
-- Pe lângă cifre, arată și cât de gol arată rândul parterului fără casetă:
-- `su_mp` al parterului față de nivelul cel mai lat al variantei. Acolo unde
-- „gol_din_rand" e mare, caseta chiar era necesară.
-- ═══════════════════════════════════════════════════════════════════════════

select g.nume                                     as grup,
       va.nume                                    as varianta,
       va.locuri_parcare                          as necesare,
       va.locuri_parcare_parter                   as la_parter,
       va.locuri_parcare_subsol                   as la_subsol,
       va.locuri_parcare_teren                    as pe_teren,
       round(parter.su_mp, 2)                     as su_parter,
       round(cel_mai_lat.su_mp, 2)                as cel_mai_lat_nivel,
       round((1 - parter.su_mp / nullif(cel_mai_lat.su_mp, 0)) * 100)
                                                  as gol_din_rand_pct
  from public.analiza_varianta va
  join public.analiza_teren a on a.id = va.analiza_id
  join public.grupuri g       on g.id = a.grup_id
  left join lateral (select ni.su_mp from public.analiza_nivel ni
                      where ni.varianta_id = va.id and ni.este_parter
                      limit 1) as parter on true
  left join lateral (select ni.su_mp from public.analiza_nivel ni
                      where ni.varianta_id = va.id
                      order by ni.su_mp desc limit 1) as cel_mai_lat on true
 where a.titlu in ('Analiză preliminară Luigi Galvani 57',
                   'Analiză preliminară Constantin Bosianu 32')
 order by g.nume, va.nume;

-- CE TREBUIE SĂ VEZI: 16 rânduri, niciunul cu `la_parter = 0`.
--
-- Cele mai proaste rânduri sunt Galvani P+5 · V1 (parter 4,24 mp dintr-un rând
-- de 193,95, adică 98% gol) și Bosianu P+3 · V1 (18,69 din 131, 86% gol).
-- Exact alea arătau ca o greșeală de afișare și nu erau.
--
-- ⚠️ Coloanele intră în pagină abia după deploy-ul din cPanel al frontendului.
--    Până atunci scrisul în bază nu schimbă nimic pe ecran.

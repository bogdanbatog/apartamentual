-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORT ANALIZĂ: Analiză preliminară Radovici 4
-- Generat de scripts/import-analiza/genereaza-sql.js pe 2026-09-17
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă” anulează
--    tăcut și inserările de deasupra lui.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND, în ordinea 0 → 1 → 2 → 3 → 4 → 5.
--    BLOC 0 nu schimbă nimic. Rulează-l și citește-l înainte de restul.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0 · VERIFICARE. Nu schimbă nimic.
--
-- Cele cinci secțiuni ies într-un singur tabel, prin UNION ALL: editorul
-- SQL din Supabase arată doar rezultatul ULTIMEI interogări dintr-un tab,
-- deci cinci SELECT-uri separate ar da o singură tabelă și patru necitite.
-- ═══════════════════════════════════════════════════════════════════════════

select * from (
  select 1 as ord, 'grup' as sectiune, g.id::text as id,
         g.nume as detaliu, null as extra
    from public.grupuri g
   where g.nume ilike '%Parcul Circului%'
  union all
  select 2, 'teren', t.id::text, t.titlu, t.suprafata::text
    from public.terenuri t
   where t.id in ('eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid)
  union all
  select 3, 'membru activ', m.user_id::text,
         coalesce(pr.pseudonym, '(fără pseudonim)'), m.status
    from public.grup_membri m
    left join public.profiles pr on pr.user_id = m.user_id
   where m.grup_id in (select id from public.grupuri
                        where nume ilike '%Parcul Circului%')
     and m.status = 'activ'
  union all
  select 4, 'favorit (terenuri_likes_grupuri)', l.teren_id::text,
         coalesce(t.titlu, '⚠️ teren inexistent'), t.suprafata::text
    from public.terenuri_likes_grupuri l
    left join public.terenuri t on t.id = l.teren_id
   where l.grup_id in (select id from public.grupuri where nume ilike '%Parcul Circului%')
  union all
  select 5, 'analiză deja existentă', a.id::text, a.titlu,
         case when a.teren_id in ('eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid)
              then '⚠️ PE ACELAȘI TEREN · ' || a.data_analizei::text
              else 'pe alt teren · ' || a.data_analizei::text end
    from public.analiza_teren a
   where a.grup_id in (select id from public.grupuri where nume ilike '%Parcul Circului%')
  union all
  select 6, 'legat vechi (grup_terenuri)', gt.teren_id::text,
         coalesce(t.titlu, '⚠️ teren inexistent'),
         case when gt.removed_at is null then 'activ'
              else 'SCOS ' || gt.removed_at::date::text end
    from public.grup_terenuri gt
    left join public.terenuri t on t.id = gt.teren_id
   where gt.grup_id in (select id from public.grupuri where nume ilike '%Parcul Circului%')
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • exact UN rând „grup” și exact UN rând „teren”. Dacă ies două,
--     restrânge textul căutat în configurație; blocurile de mai jos
--     crapă la „more than one row returned by a subquery”.
--   • rândurile „favorit” și „legat vechi” arată TOT ce atârnă de grup,
--     din amândouă tabelele de legătură, nefiltrate. Cea vie e
--     `terenuri_likes_grupuri`: pe ea o scrie butonul de pe pagina
--     terenului și pe ea o citesc spațiul de lucru și pagina de
--     împărțire. `grup_terenuri` e de obicei goală. Dacă terenul apare
--     DOAR la „legat vechi”, pagina nu-l va găsi: se pune la favorite
--     din pagina terenului, cu butonul de salvare la grup.
--   • „analiză deja existentă” poate să apară, atâta timp cât scrie „pe
--     alt teren”: analiza e a perechii (grup, teren), deci un grup are
--     câte una de fiecare teren al lui și stau toate.
--     Ce oprește importul e „⚠️ PE ACELAȘI TEREN”: atunci pagina o
--     arată pe cea mai nouă și cealaltă rămâne ascunsă, nu ștearsă.
--     Șterge-o întâi cu BLOC 6.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · ANALIZA
--
-- Cifrele de cost vin din configurație, nu din CSV:
--   • 1200 €/mp Sd
--   • 450000 € terenul
--   • subsolul la 70% din prețul pe metru
-- Prețul pe mp e verificat înapoi prin formula din UA (costConstr =
-- sdFull×costMp + sParcParter×costMp×0,2 + sdSubsol×costMp×factor).
--
-- Bilanțul de pe analiză e al variantei cu volumul cel mai mare; fiecare
-- variantă îl are pe al ei în `analiza_varianta`.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.analiza_teren (
  grup_id, teren_id, tip, titlu, data_analizei,
  cost_teren, cost_constructie_mp, cost_subsol_pct,
  suprafata_teren_mp, sd_total_mp, su_total_mp, pot_obtinut, cut_obtinut, note
)
select
  (select id from public.grupuri where nume ilike '%Parcul Circului%'),
  ('eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid),
  'preliminara',
  'Analiză preliminară Radovici 4',
  date '2026-09-17',
  450000, 1200, 70,
  632.31, 960.55, 581.05, 44.81, 1.519,
  'Analiză preliminară Urban Analyzer, 17 septembrie 2026. Teren 632,31 mp, front 28,73 ml, UTR L1a (Sector 2), reglementare din PUZ: POT max 45%, CUT max 1,60, regim max P+3, spațiu verde min 30%. O singură ipoteză de volum, P+3, cu 960,55 mp construiți, POT obținut 44,81% și CUT obținut 1,519, deci sub plafonul de 1,60. Trei variante, fiecare cu 6 apartamente, fără subsol. Parcarea stă o parte la parter și restul pe teren. V1 și V2 au aceeași suprafață utilă și diferă prin felul în care sunt împărțite etajele; V3 pune un singur apartament mai mare la parter și lasă mai multe locuri de parcare acolo. Costuri de intrare: 1.200 euro pe mp Sd și 450.000 euro terenul. Suprafețele apartamentelor sunt propuneri de pornire, nu suprafețe proiectate: se negociază pe nivel, la proiectare.'
where not exists (select 1 from public.analiza_teren
                   where grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
                     and teren_id in ('eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid));

-- Trebuie să scrie „INSERT 0 1”.
--
-- „INSERT 0 0” înseamnă că analiza EXISTĂ DEJA, adică blocul a mai fost
-- rulat o dată. Nu e o pagubă, dar oprește-te: dacă ai rulat deja și
-- blocurile 2, 3, 4, sunt și ele duble, iar asta chiar se vede în pagină.
-- Se curăță cu BLOC 6 și se ia totul de la capăt.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VARIANTELE (3)
--
--   P+3: 3 variante, din analiza-urbanistica (24).csv
--
-- Numele poartă prefixul setului fiindcă amândouă exporturile își numesc
-- variantele V1, V2, V3: fără prefix, filele din pagină s-ar ciocni.
--
-- `cost_teren` rămâne NULL pe variante dinadins: pagina cade pe cel de pe
-- analiză, deci suma stă scrisă într-un singur loc.
--
-- `descriere` NU e copiată din `var_descriere` (eticheta auto din UA): la
-- Galvani, în setul P+5, eticheta lui V1 spunea „11 apartamente” pe o
-- variantă cu 10, iar a lui V2 „10” pe una cu 11. Se scrie din counts.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.analiza_varianta (
  analiza_id, grup_id, nume, descriere, su_total_mp, sd_total_mp,
  coef_su_sd, subsol_sd_mp, are_subsol, su_comercial_mp, locuri_parcare,
  locuri_parcare_parter, locuri_parcare_subsol, locuri_parcare_teren, ordine
)
select a.id, a.grup_id, v.nume, v.descriere, v.su_total, v.sd_total,
       v.coef, v.subsol_sd, v.are_subsol, v.su_com, v.parcaje,
       v.parc_parter, v.parc_subsol, v.parc_teren, v.ordine
  from public.analiza_teren a,
       (values
         ('P+3 · V1', '6 apartamente · 2 × 3 camere, 2 × 3-4 camere, 2 × duplex · 2 la parter', 581.05, 960.55, 0.645, 0, false, null::numeric, 10, 5, 0, 5, 1),   -- P+3, 6 ap.
         ('P+3 · V2', '6 apartamente · 1 × 3 camere, 3 × 3-4 camere, 2 × duplex · 2 la parter', 581.05, 960.55, 0.645, 0, false, null::numeric, 11, 5, 0, 6, 2),   -- P+3, 6 ap.
         ('P+3 · V3', '6 apartamente · 3 × 3 camere, 3 × 3-4 camere · unul la parter', 542.05, 960.55, 0.657, 0, false, null::numeric, 9, 6, 0, 3, 3)   -- P+3, 6 ap.
       ) as v(nume, descriere, su_total, sd_total, coef, subsol_sd,
              are_subsol, su_com, parcaje,
              parc_parter, parc_subsol, parc_teren, ordine)
 where a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   and not exists (select 1 from public.analiza_varianta va2
                    where va2.analiza_id = a.id and va2.nume = v.nume);

-- Trebuie să scrie „INSERT 0 3”.
-- „INSERT 0 0” înseamnă că blocul a mai fost rulat. Oprește-te și
-- verifică cu BLOC 5 înainte să mergi mai departe.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 3 · NIVELURILE (12)
--
-- `su_mp` e Su-ul ÎNTREG al nivelului, locuințe plus comercial, iar
-- comercialul se scrie SEPARAT în `su_comun_mp`. Așa îl citește pagina:
-- `suImpartibil` scade `su_comun_mp` din `su_mp` ca să afle cât se
-- împarte (organizare-apartamente.js:130), iar costul îl adună la loc,
-- fiindcă spațiul comercial se construiește chiar dacă nu se împarte.
--
-- ⚠️ Până la 4 septembrie 2026 aici se scria `niv_su_locuinte_mp` MINUS
-- comercialul, adică scădere de două ori: coloana din CSV e deja fără
-- comercial. La Bosianu 32, V2, parterul ieșea `su_mp = -29,61`.
-- N-a lovit nimic până atunci fiindcă nicio analiză importată n-avea
-- comercial, iar zero minus zero e tot zero.
--
-- SUBSOLUL NU E AICI. Ar intra în desen ca cel mai lat rând (365 mp utili,
-- față de 194 pe un etaj), iar lățimile din pagină se raportează la
-- nivelul cel mai mare: toate apartamentele s-ar strânge la jumătate
-- pentru un rând gol. Sd-ul lui e pe variantă, în `subsol_sd_mp`.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.analiza_nivel (varianta_id, grup_id, nume, ordine, su_mp, este_parter, su_comun_mp)
select va.id, va.grup_id, n.nume, n.ordine, n.su, n.parter, n.comun
  from public.analiza_varianta va
  join public.analiza_teren a on a.id = va.analiza_id
  join (values
         ('P+3 · V1', 'Parter', 0, 107.02, true, null::numeric),   -- 2 ap.
         ('P+3 · V1', 'Etaj 1', 1, 198.36, false, null::numeric),   -- 3 ap.
         ('P+3 · V1', 'Etaj 2', 2, 162.42, false, null::numeric),   -- 2 ap.
         ('P+3 · V1', 'Etaj 3', 3, 113.26, false, null::numeric),   -- 1 ap.
         ('P+3 · V2', 'Parter', 0, 107.02, true, null::numeric),   -- 2 ap.
         ('P+3 · V2', 'Etaj 1', 1, 198.36, false, null::numeric),   -- 3 ap.
         ('P+3 · V2', 'Etaj 2', 2, 162.42, false, null::numeric),   -- 2 ap.
         ('P+3 · V2', 'Etaj 3', 3, 113.26, false, null::numeric),   -- 1 ap.
         ('P+3 · V3', 'Parter', 0, 68.02, true, null::numeric),   -- 1 ap.
         ('P+3 · V3', 'Etaj 1', 1, 198.36, false, null::numeric),   -- 2 ap.
         ('P+3 · V3', 'Etaj 2', 2, 162.42, false, null::numeric),   -- 2 ap.
         ('P+3 · V3', 'Etaj 3', 3, 113.26, false, null::numeric)   -- 1 ap.
       ) as n(varianta, nume, ordine, su, parter, comun)
    on n.varianta = va.nume
 where a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   and not exists (select 1 from public.analiza_nivel ni2
                    where ni2.varianta_id = va.id and ni2.nume = n.nume);

-- Trebuie să scrie „INSERT 0 12”.
-- „INSERT 0 0” înseamnă că blocul a mai fost rulat. Oprește-te.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 4 · APARTAMENTELE (22 rânduri, adică 18 locuințe, dintre care 4 duplexuri)
--
-- ⚠️ CERE MIGRAȚIA `15-duplexuri.sql` RULATĂ ÎNAINTE. Fără ea blocul crapă
--    cu „column duplex_nr does not exist”.
--
-- Fiecare jumătate de duplex e un rând al ei, pe nivelul ei, și ia din
-- bugetul nivelului ei. Jumătățile aceleiași locuințe au același
-- `duplex_nr`, unic doar în variantă. Pagina le adună la preț și la
-- înscriere.
--   P+3 · V1 · duplex 2: Parter Studio + Etaj 1 3 cam
--   P+3 · V1 · duplex 1: Parter 2 cam + Etaj 1 Gars.
--   P+3 · V2 · duplex 1: Parter Studio + Etaj 1 Gars.
--   P+3 · V2 · duplex 2: Parter 2 cam + Etaj 1 Gars.
--
-- Urban Analyzer nu dă suprafața fiecărui apartament, și nici nu trebuie:
-- la faza preliminară ea nu există, se negociază pe nivel, la proiectare.
-- Ce dă e Su-ul nivelului și câte apartamente de fiecare tip stau pe el.
--
-- `mpu_propus` e propunerea arhitectului, de unde pornește cursorul:
-- Su-ul nivelului împărțit proporțional cu mijlocul intervalelor din
-- normativ, apoi corectat pentru cine ieșea din interval. Rămâne scris,
-- deci există mereu drum înapoi: se șterge rândul din
-- `apartament_suprafata` și revine propunerea.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.analiza_apartament (
  nivel_id, varianta_id, grup_id, tip_key, tip_eticheta,
  mpu_min, mpu_max, mpu_propus, ordine, duplex_nr
)
select ni.id, ni.varianta_id, ni.grup_id, x.tip, x.eticheta,
       x.mpu_min, x.mpu_max, x.mpu_propus, x.ordine, x.duplex_nr
  from public.analiza_nivel ni
  join public.analiza_varianta va on va.id = ni.varianta_id
  join public.analiza_teren a on a.id = va.analiza_id
  join (values
         ('P+3 · V1', 'Parter', 1, 'studio', 'Studio', 42, 52, 47.68, 2),
         ('P+3 · V1', 'Parter', 2, 'cam2', '2 cam', 52, 65, 59.34, 1),
         ('P+3 · V1', 'Etaj 1', 1, 'cam3', '3 cam', 66, 87, 80.29, null::smallint),
         ('P+3 · V1', 'Etaj 1', 2, 'cam3', '3 cam', 66, 87, 80.29, 2),
         ('P+3 · V1', 'Etaj 1', 3, 'gars', 'Gars.', 30, 42, 37.78, 1),
         ('P+3 · V1', 'Etaj 2', 1, 'cam3', '3 cam', 66, 87, 69.03, null::smallint),
         ('P+3 · V1', 'Etaj 2', 2, 'cam34', '3-4 cam', 87, 120, 93.39, null::smallint),
         ('P+3 · V1', 'Etaj 3', 1, 'cam34', '3-4 cam', 87, 120, 113.26, null::smallint),
         ('P+3 · V2', 'Parter', 1, 'studio', 'Studio', 42, 52, 47.68, 1),
         ('P+3 · V2', 'Parter', 2, 'cam2', '2 cam', 52, 65, 59.34, 2),
         ('P+3 · V2', 'Etaj 1', 1, 'cam34', '3-4 cam', 87, 120, 116.98, null::smallint),
         ('P+3 · V2', 'Etaj 1', 2, 'gars', 'Gars.', 30, 42, 40.69, 1),
         ('P+3 · V2', 'Etaj 1', 3, 'gars', 'Gars.', 30, 42, 40.69, 2),
         ('P+3 · V2', 'Etaj 2', 1, 'cam3', '3 cam', 66, 87, 69.03, null::smallint),
         ('P+3 · V2', 'Etaj 2', 2, 'cam34', '3-4 cam', 87, 120, 93.39, null::smallint),
         ('P+3 · V2', 'Etaj 3', 1, 'cam34', '3-4 cam', 87, 120, 113.26, null::smallint),
         ('P+3 · V3', 'Parter', 1, 'cam3', '3 cam', 66, 87, 68.02, null::smallint),
         ('P+3 · V3', 'Etaj 1', 1, 'cam3', '3 cam', 66, 87, 84.3, null::smallint),
         ('P+3 · V3', 'Etaj 1', 2, 'cam34', '3-4 cam', 87, 120, 114.06, null::smallint),
         ('P+3 · V3', 'Etaj 2', 1, 'cam3', '3 cam', 66, 87, 69.03, null::smallint),
         ('P+3 · V3', 'Etaj 2', 2, 'cam34', '3-4 cam', 87, 120, 93.39, null::smallint),
         ('P+3 · V3', 'Etaj 3', 1, 'cam34', '3-4 cam', 87, 120, 113.26, null::smallint)
       ) as x(varianta, nivel, ordine, tip, eticheta, mpu_min, mpu_max, mpu_propus, duplex_nr)
    on x.varianta = va.nume and x.nivel = ni.nume
 where a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   and not exists (select 1 from public.analiza_apartament ap2
                    where ap2.nivel_id = ni.id and ap2.ordine = x.ordine);

-- Trebuie să scrie „INSERT 0 22”.
-- „INSERT 0 0” înseamnă că blocul a mai fost rulat. Oprește-te.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 5 · VERIFICĂRILE. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════

select * from (
  select 1 as ord, 'variantă' as sectiune, va.nume as detaliu,
         count(distinct ni.id)::text as niveluri,
         (count(ap.id) filter (where ap.duplex_nr is null) + count(distinct ap.duplex_nr))::text as locuinte,
         round(sum(ap.mpu_propus), 2)::text as mp_dati,
         (select round(sum(ni2.su_mp - coalesce(ni2.su_comun_mp, 0)), 2)
            from public.analiza_nivel ni2
           where ni2.varianta_id = va.id)::text as mp_de_dat
    from public.analiza_varianta va
    join public.analiza_teren a on a.id = va.analiza_id
    left join public.analiza_nivel ni on ni.varianta_id = va.id
    left join public.analiza_apartament ap on ap.nivel_id = ni.id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   group by va.id, va.nume, va.ordine
  union all
  -- (a2) analiza nu trebuie să existe decât o dată. Se verifică separat
  --      fiindcă la o dublură rândurile de mai sus arată numai cifre
  --      duble, fără să spună de ce.
  select 0, 'ANALIZĂ DUBLĂ', 'sunt ' || count(*)::text || ' analize cu acest titlu',
         string_agg(a.id::text, ', ' order by a.created_at), null, null, null
    from public.analiza_teren a
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
  having count(*) > 1
  union all
  -- (b) niciun apartament nu trebuie să iasă din intervalul lui
  select 2, 'ÎN AFARA INTERVALULUI', va.nume || ' · ' || ni.nume || ' · ' || ap.tip_eticheta,
         ap.mpu_propus::text, ap.mpu_min::text, ap.mpu_max::text, null
    from public.analiza_apartament ap
    join public.analiza_nivel ni on ni.id = ap.nivel_id
    join public.analiza_varianta va on va.id = ap.varianta_id
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
     and (ap.mpu_propus < ap.mpu_min or ap.mpu_propus > ap.mpu_max)
  union all
  -- (c) niciun nivel nu trebuie să fie umplut peste Su-ul lui
  select 3, 'NIVEL DEPĂȘIT', va.nume || ' · ' || ni.nume,
         round(sum(ap.mpu_propus), 2)::text,
         round(ni.su_mp - coalesce(ni.su_comun_mp, 0), 2)::text, null, null
    from public.analiza_apartament ap
    join public.analiza_nivel ni on ni.id = ap.nivel_id
    join public.analiza_varianta va on va.id = ap.varianta_id
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   group by va.nume, ni.nume, ni.su_mp, ni.su_comun_mp
  having sum(ap.mpu_propus) > ni.su_mp - coalesce(ni.su_comun_mp, 0) + 0.01
  union all
  -- (c2) suma nivelurilor trebuie să dea Su-ul de locuințe al variantei.
  --      Verificarea asta a lipsit până pe 4 septembrie 2026 și de aceea a
  --      trecut nevăzut un generator care scădea comercialul de două ori:
  --      rezultatul era un nivel cu su_mp negativ, perfect legal în schemă.
  --      Toleranța de 0,05 e rotunjirea la doi zecimali din exportul UA.
  select 5, 'SU NEPOTRIVITĂ', va.nume,
         (select round(sum(ni2.su_mp - coalesce(ni2.su_comun_mp, 0)), 2)
            from public.analiza_nivel ni2
           where ni2.varianta_id = va.id)::text,
         round(va.su_total_mp, 2)::text, null, null
    from public.analiza_varianta va
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
     and abs(coalesce((select sum(ni2.su_mp - coalesce(ni2.su_comun_mp, 0))
                        from public.analiza_nivel ni2
                       where ni2.varianta_id = va.id), 0)
             - va.su_total_mp) > 0.05
  union all
  -- (c3) niciun nivel nu poate rămâne cu suprafață negativă de împărțit.
  --      Schema o acceptă fără să se plângă, pagina o desenează ca pe un
  --      rând fără lățime. Zero NU e semnalat: un parter numai comercial
  --      e o variantă legitimă.
  select 6, 'NIVEL CU SUPRAFAȚĂ NEGATIVĂ', va.nume || ' · ' || ni.nume,
         ni.su_mp::text, coalesce(ni.su_comun_mp, 0)::text, null, null
    from public.analiza_nivel ni
    join public.analiza_varianta va on va.id = ni.varianta_id
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
     and ni.su_mp - coalesce(ni.su_comun_mp, 0) < 0
  union all
  -- (d) grup_id-ul copiat trebuie să fie același peste tot: o variantă
  --     scrisă pe alt grup e invizibilă în pagină, fără nicio eroare
  select 4, 'GRUP GREȘIT', va.nume, va.grup_id::text, a.grup_id::text, null, null
    from public.analiza_varianta va
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
     and va.grup_id <> a.grup_id
  union all
  -- (e) un duplex are cel puțin două jumătăți, fiecare pe alt nivel. Altfel
  --     pagina ar arăta o locuință „pe două niveluri” care stă pe unul.
  select 7, 'DUPLEX STRICAT', va.nume || ' · duplex ' || ap.duplex_nr::text,
         count(*)::text, count(distinct ap.nivel_id)::text, null, null
    from public.analiza_apartament ap
    join public.analiza_varianta va on va.id = ap.varianta_id
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
     and ap.duplex_nr is not null
   group by va.nume, ap.duplex_nr
  having count(*) < 2 or count(distinct ap.nivel_id) < count(*)
) x order by ord, detaliu;

-- Coloana a cincea e „locuinte”: un duplex se numără o dată. Cifrele
-- așteptate, din CSV: P+3 · V1 = 6, P+3 · V2 = 6, P+3 · V3 = 6.
-- CE TREBUIE SĂ VEZI: doar rânduri „variantă”, câte unul de fiecare.
-- Orice rând scris cu majuscule e o problemă și oprește proba.

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 7 · FIȘA ȘI VOLUMUL. Se rulează ULTIMUL, și numai după două lucruri:
--
--   1. migrația `12-fisa-si-volum-pe-varianta.sql`, care face coloanele
--      și lasă bucketul să primească și KML, plus `16-link-google-earth.sql`,
--      care face coloana `earth_url` (fără ea, blocul crapă);
--   2. urcarea fișierelor de mână în Storage, în bucketul `analize-fise`.
--
-- ⚠️ Drumul trebuie să înceapă cu id-ul GRUPULUI. Politica de citire se
--    uită la primul folder din nume ca să știe cine are voie să descarce,
--    deci un fișier pus în rădăcină nu se vede de nimeni, fără nicio
--    eroare și fără niciun semn că ar fi ceva în neregulă.
--
-- Fișierele de urcat, cu numele exact scris aici:
--   analize-fise/<id-ul grupului>/radovici-4-fisa.pdf
--   analize-fise/<id-ul grupului>/radovici-4-volum.kml
--
-- Aceeași cale se scrie pe toate variantele setului: fișa și volumul
-- descriu ipoteza de volum, nu varianta. Toate cele 3
-- variante P+3 arată la fel în Google Earth.
-- ═══════════════════════════════════════════════════════════════════════════

-- P+3: 3 variante (V1, V2, V3)
update public.analiza_varianta va
   set pdf_path = (select id::text from public.grupuri where nume ilike '%Parcul Circului%') || '/' || 'radovici-4-fisa.pdf',
       pdf_nume = 'radovici-4-fisa.pdf',
       kml_path = (select id::text from public.grupuri where nume ilike '%Parcul Circului%') || '/' || 'radovici-4-volum.kml',
       kml_nume = 'radovici-4-volum.kml',
       earth_url = 'https://earth.google.com/earth/d/1yUOeFqNMxnHVnO3f4AZDGV15YI94XQYj?usp=sharing'
  from public.analiza_teren a
 where a.id = va.analiza_id
   and a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   and va.nume like 'P+3 · %';

-- Trebuie să scrie „UPDATE 3”.

-- Verificare: fiecare variantă trebuie să aibă o cale care începe cu
-- id-ul grupului ei. Un `false` la `incepe_cu_grupul` înseamnă fișier
-- invizibil, oricât de corect ar arăta restul.

select va.nume, va.pdf_nume, va.kml_nume,
       (va.pdf_path like a.grup_id::text || '/%') as incepe_cu_grupul
  from public.analiza_varianta va
  join public.analiza_teren a on a.id = va.analiza_id
 where a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
 order by va.ordine;

-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 6 · ȘTERGEREA. NU se rulează la import.
--
-- E aici ca proba să se poată da înapoi într-o singură comandă. Șterge
-- analiza cu tot ce atârnă de ea, INCLUSIV suprafețele mișcate de oameni
-- și înscrierile pe apartamente. Nu atinge preferințele membrilor,
-- jurnalul terenului, documentele sau notele: acelea nu depind de analiză.
-- ═══════════════════════════════════════════════════════════════════════════

-- delete from public.analiza_teren
--  where titlu = 'Analiză preliminară Radovici 4'
--    and grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%');
--
-- ⚠️ Și grupul, nu doar titlul: același teren analizat pentru două grupuri
--    dă două analize cu același titlu, iar ștergerea pe titlu le-ar lua pe
--    amândouă, inclusiv pe a celuilalt grup.


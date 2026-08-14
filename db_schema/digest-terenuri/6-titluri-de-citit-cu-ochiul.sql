-- =====================================================================
-- 6-titluri-de-citit-cu-ochiul.sql
--
-- LA CE FOLOSEȘTE
-- Titlurile terenurilor ajung LITERAL în emailul săptămânal, pe carduri și
-- pe liniile scurte. Sunt scrise de mână de cine a adăugat terenul, deci
-- nu le validează nimeni. Fișierul ăsta le pune pe toate în față, cu
-- linkul de editare gata format, ca să fie citite cu ochiul înainte de
-- prima trimitere.
--
-- ⚠️ STRICT SELECT. Nu schimbă nimic. Reparațiile se fac din site.
--
-- ⚠️ SE REPARĂ DOAR CÂMPUL „Titlu", din `/terenuri-propune.html?edit=<id>`.
--    NU se atinge cartierul: potrivirea teren↔zonă se face pe TEXT, fără
--    cheie străină, deci un diacritic schimbat acolo rupe legătura în
--    tăcere și terenul nu mai ajunge la nimeni. La titlu nu se leagă nimic.
--
-- CE SE CAUTĂ CU OCHIUL
--   • prețul scris în titlu — cardul din email arată oricum prețul separat,
--     deci ar apărea de două ori, în două formate
--   • diacriticele lipsă: „Aviatiei", „Dorobanti", „rezidentiala"
--   • suprafața scrisă de două ori, sau lipită de text („320mp")
--   • titluri foarte lungi, care se rup urât pe telefon
--
-- Coloana `iese_in_email` îți spune care intră în trimiterea de luni
-- (adăugate în ultimele 14 zile). Restul le repari când ai timp.
-- =====================================================================

select
    t.titlu,
    case when t.created_at >= now() - interval '14 days'
         then 'DA — iese luni'
         else '' end                                   as iese_in_email,
    t.cartier                                          as cartier_NU_ATINGE,
    t.created_at::date                                 as adaugat,
    'https://apartamentual.ro/terenuri-propune.html?edit=' || t.id  as link_editare
from public.terenuri t
where t.status = 'approved'
order by
    (t.created_at >= now() - interval '14 days') desc,
    t.created_at desc;

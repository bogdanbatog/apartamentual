-- ═══════════════════════════════════════════════════════════════════════════
-- REPARARE: BLOC 2 A INTRAT DE DOUĂ ORI LA IMPORTUL BOSIANU 32
-- 1 septembrie 2026
--
-- CE S-A ÎNTÂMPLAT, măsurat, nu presupus. BLOC 5 a dat totul dublu: 8 niveluri
-- pe variantă în loc de 4, 12 apartamente în loc de 6, suma suprafețelor
-- 839,94 mp, adică fix 2 × 419,97. Numărătoarea pe analiză a arătat de ce:
--
--   analiza_id 598185cd-ceff-469f-969f-d9a5ed772c38, 1 sept. 20:20 UTC
--   4 variante · 16 niveluri · 24 apartamente
--
-- Deci ANALIZA e una singură (BLOC 1 a intrat o dată), dar BLOC 2 a fost rulat
-- de două ori și a scris 4 variante în loc de 2, două purtând numele
-- „P+3 · V1” și două „P+3 · V2”. Blocurile 3 și 4 au rulat apoi O SINGURĂ
-- DATĂ, dar se leagă de variante PE NUME, deci fiecare rând al lor a nimerit
-- două variante: 8 niveluri × 2 = 16, iar apartamentele 6 × 4 variante = 24.
--
-- DE CE N-A SĂRIT NIMIC ÎN AER. Nimic nu era invalid: patru variante cu nume
-- duplicate sunt perfect legale în schemă. Iar BLOC 5 grupa pe `va.nume`, deci
-- lipea perechile la un loc și arăta două rânduri cu cifre duble, în loc de
-- patru rânduri. Ambele lucruri sunt reparate acum în generator.
--
-- ⚠️ NU pune begin / rollback în tab: editorul rulează tot tabul ca o singură
--    tranzacție, iar un rollback „de probă” anulează tăcut și ștergerea.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- PASUL 1 · ȘTERGEREA. Cascada duce mai departe cele 4 variante, 16 niveluri
-- și 24 de apartamente, plus suprafețele mutate de oameni și înscrierile pe
-- apartamente. Nimeni n-a apucat să miște nimic: analiza a intrat la 20:20.
--
-- NU se atinge: preferințele membrilor, jurnalul terenului, documentele și
-- notele. Acelea atârnă de grup și de teren, nu de analiză.
--
-- Se șterge tot și se reia importul, în loc să scoatem doar cele două variante
-- în plus: reimportul durează un minut, iar alegerea „care copie e cea bună”
-- e exact felul de decizie pe care nu vrei s-o iei cu ochiul, pe patru rânduri
-- cu același nume.
-- ═══════════════════════════════════════════════════════════════════════════

delete from public.analiza_teren
 where id = '598185cd-ceff-469f-969f-d9a5ed772c38';

-- Trebuie să scrie „DELETE 1”.
--
-- Se șterge după id, nu după titlu: id-ul e cel citit la pasul de numărare de
-- mai sus, deci nu poate lua din greșeală altceva.


-- ═══════════════════════════════════════════════════════════════════════════
-- PASUL 2 · CONFIRMAREA CĂ E CURAT. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════

select
  (select count(*) from public.analiza_teren
    where grup_id = '597d71bd-2289-468a-8988-d510e1ac55a6')  as analize,
  (select count(*) from public.analiza_varianta
    where grup_id = '597d71bd-2289-468a-8988-d510e1ac55a6')  as variante,
  (select count(*) from public.analiza_nivel
    where grup_id = '597d71bd-2289-468a-8988-d510e1ac55a6')  as niveluri,
  (select count(*) from public.analiza_apartament
    where grup_id = '597d71bd-2289-468a-8988-d510e1ac55a6')  as apartamente;

-- Toate patru trebuie să fie 0. Se numără pe `grup_id`, nu pe analiză: dacă
-- ar fi rămas variante orfane, pe analiză n-ar mai avea de ce să atârne și
-- n-ar apărea nicăieri.
--
-- DUPĂ ASTA: înapoi în `import-bosianu-32.sql`, REGENERAT, și rulează BLOC 1,
-- 2, 3, 4, fiecare o singură dată. De acum toate patru au plasă: rulate a
-- doua oară scriu „INSERT 0 0” în loc să scrie încă un rând.

-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST TERENURI — „Slack zice 28 trimise, Resend nu arată nimic"
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Se rulează ÎNTREG, dintr-o dată, în Supabase SQL Editor. Nu modifică nimic.
-- Scris pe 31 august 2026.
--
-- ⚠️ DE CE E NEVOIE DE INTEROGAREA ASTA (citește, e important)
--
-- Mesajul de pe Slack, „28 emailuri trimise", NU e o dovadă că au plecat 28 de
-- emailuri. `digest-terenuri-zone` numără câte apeluri către `notify-admins`
-- au întors HTTP 200, și atât — nu citește niciodată corpul răspunsului
-- (`index.ts`, pasul 6b: se uită doar la `res.ok`).
--
-- Iar `notify-admins` întoarce 200 în TOATE cele trei cazuri:
--
--   1. Resend a acceptat emailul                    → 200 {success:true, results:{email:true}}
--   2. Resend a refuzat (cheie greșită, domeniu,
--      429 după 4 încercări)                        → 200 {success:true, message:'No notification methods configured'}
--   3. `RESEND_API_KEY` lipsește din proiect, deci
--      blocul de email nici nu se execută           → 200, același răspuns ca la 2
--
-- Cazurile 2 și 3 nimeresc amândouă ramura `else` de la finalul funcției,
-- fiindcă `terenuri_noi_zone` e în `SKIP_SLACK` (dinadins: altfel canalul ar
-- primi 28 de mesaje identice), deci `results.slack` e mereu fals, iar când și
-- `results.email` e fals nu mai rămâne nimic adevărat de raportat. Răspunsul
-- rămâne totuși 200 cu `success: true`.
--
-- ⚠️ CONSECINȚA GRAVĂ: digestul scrie rândul în `terenuri_digest_log` imediat
-- după ce vede 200. Rândul acela închide fereastra omului. Deci dacă emailul
-- n-a plecat, terenurile NU reintră în digestul de săptămâna viitoare — se
-- pierd definitiv pentru omul acela. Plasa de siguranță descrisă în cod
-- („fără rând de jurnal, terenurile intră în digestul viitor") se bazează pe
-- un răspuns non-2xx care nu vine niciodată.
--
-- SINGURA sursă de adevăr despre ce a spus Resend e `notification_log`, scris
-- de `notify-admins` cu un rând per trimitere, cu status și text de eroare.
-- Asta citim mai jos.


with

-- Fereastra: ultimele 18 ore. ⚠️ Dinadins NU `created_at >= current_date`:
-- filtrarea pe dată se face în UTC, iar „azi" în UTC începe la 3 dimineața
-- ora Bucureștiului, deci un filtru pe dată poate tăia tăcut rânduri.
-- 18 ore acoperă sigur rularea de luni 10:07, oricare ar fi ora curentă.
fereastra as (
  select now() - interval '18 hours' as de_la
),

randuri as (
  select n.*
  from public.notification_log n, fereastra
  where n.event_type = 'terenuri_noi_zone'
    and n.created_at >= fereastra.de_la
),

-- ───────────────────────────────────────────────────────────────────────────
-- A. Câte rânduri, pe fiecare status.
--    Comparat cu cele 28 anunțate pe Slack, îți spune imediat unde s-a rupt.
-- ───────────────────────────────────────────────────────────────────────────
rezumat as (
  select 1 as ord,
         'A. rezumat notification_log'::text as sectiune,
         ('status: ' || coalesce(r.status, 'NULL'))::text as camp_1,
         (count(*)::text || ' randuri')::text as camp_2,
         ''::text as camp_3
  from randuri r
  group by r.status
),

-- ───────────────────────────────────────────────────────────────────────────
-- B. Rândurile în detaliu. Când statusul e 'error', coloana a treia conține
--    textul exact întors de Resend: acolo scrie dacă e cheia, domeniul,
--    adresa sau limita de rată.
-- ───────────────────────────────────────────────────────────────────────────
detalii as (
  select 2,
         'B. detalii'::text,
         to_char(r.created_at at time zone 'Europe/Bucharest', 'DD.MM HH24:MI')::text,
         coalesce(left(r.recipient, 45), '(fara destinatar)')::text,
         coalesce(left(r.error, 220), r.status)::text
  from randuri r
  order by r.created_at desc
  limit 20
),

-- ───────────────────────────────────────────────────────────────────────────
-- C. Cele 28 din jurnalul digestului, pentru comparație.
--    Rândurile astea sunt cele care au ÎNCHIS fereastra fiecărui om.
-- ───────────────────────────────────────────────────────────────────────────
jurnal_digest as (
  select 3,
         'C. terenuri_digest_log'::text,
         to_char(min(l.trimis_la) at time zone 'Europe/Bucharest', 'DD.MM HH24:MI')::text,
         (count(*)::text || ' oameni marcati ca serviti')::text,
         (sum(l.nr_terenuri)::text || ' potriviri teren x om')::text
  from public.terenuri_digest_log l, fereastra
  where l.trimis_la >= fereastra.de_la
),

-- ───────────────────────────────────────────────────────────────────────────
-- Z. Verdictul, scris în cuvinte, ca să nu trebuiască să-l deduci.
-- ───────────────────────────────────────────────────────────────────────────
cifre as (
  select
    (select count(*) from randuri)                              as total,
    (select count(*) from randuri where status = 'sent')         as trimise,
    (select count(*) from randuri where status <> 'sent')        as esuate,
    (select count(*) from public.terenuri_digest_log l, fereastra
      where l.trimis_la >= fereastra.de_la)                      as in_jurnal
),

verdict as (
  select 9,
         'Z. VERDICT'::text,
         (c.in_jurnal::text || ' in jurnal / ' || c.total::text || ' in notification_log')::text,
         (case
            when c.total = 0
              then 'ZERO randuri de email. Blocul de trimitere NU s-a executat.'
            when c.esuate > 0 and c.trimise = 0
              then 'Resend a REFUZAT tot. Motivul exact e la sectiunea B.'
            when c.trimise > 0 and c.esuate > 0
              then 'Amestecat: unele acceptate, altele refuzate. Vezi B.'
            else 'Resend a ACCEPTAT toate emailurile.'
          end)::text,
         (case
            when c.total = 0
              then 'Cauza cea mai probabila: RESEND_API_KEY lipseste din variabilele proiectului Supabase, deci notify-admins a sarit peste tot blocul de email si a intors oricum 200.'
            when c.esuate > 0 and c.trimise = 0
              then 'Cheie invalida, domeniu neverificat sau limita de rata. Textul din B spune care.'
            when c.trimise > 0 and c.esuate > 0
              then 'Cei cu eroare au ramas cu rand in jurnal, deci NU reintra saptamana viitoare. Trebuie recuperati manual.'
            else 'Emailurile au plecat. Problema e la ce te uiti in Resend: alt cont sau alta echipa, filtru pe domeniu, sau retentia logurilor din planul curent.'
          end)::text
  from cifre c
)

select sectiune, camp_1, camp_2, camp_3
from (
  select * from rezumat
  union all select * from detalii
  union all select * from jurnal_digest
  union all select * from verdict
) tot
order by ord, camp_1 desc;

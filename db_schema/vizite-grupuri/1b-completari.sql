-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETARE la `1-tabela-vizite.sql` — ușile care n-au fost închise
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE UNDE VINE FIȘIERUL ĂSTA: BLOC 6 a ieșit curat la coloane, cheie primară,
-- politici, RLS și trigger. Un singur lucru a ieșit strâmb, secțiunea (d):
--
--   `authenticated` are pe tabelă și DELETE, TRUNCATE, REFERENCES, TRIGGER.
--
-- Nu i le-am dat noi. Sunt drepturile implicite pe care Supabase le pune pe
-- ORICE tabelă nouă, iar `grant select, insert, update` n-avea ce să mai adauge
-- peste ele: un GRANT nu restrânge nimic, doar un REVOKE o face. Din
-- `1-tabela-vizite.sql` s-a revocat de la `anon` și de la `public` — și acolo
-- chiar a funcționat, `anon` nu mai apare deloc în rezultat — dar `authenticated`
-- e un rol separat, care n-a fost atins.
--
-- ⚠️ E A DOUA OARĂ: exact aceeași scăpare a fost și la `user_notes`, pe 17
--    august, reparată tot printr-un fișier `1b`. Din 18 august BLOC 5 din
--    `1-tabela-vizite.sql` e corectat, ca a treia oară să nu mai fie.
--
-- ⚠️ RULEAZĂ TOT FIȘIERUL DINTR-UN FOC („Run"), nu pe bucăți selectate cu
--    mouse-ul. N-are BEGIN/ROLLBACK și e scris să poată fi rulat de mai multe
--    ori fără efect.
--
-- ⚠️ ZERO atingeri în afara tabelei `grup_vizite`.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC A — Ușile care nu folosesc nimănui
-- ───────────────────────────────────────────────────────────────────────────
-- De ce merită scoase, deși azi nu e nimic stricat:
--
--   • DELETE  e oprit oricum de RLS (nu există politică de ștergere), deci
--     revocarea e a doua poartă, nu prima. Rândul de vizită nu se șterge
--     niciodată, se rescrie.
--   • TRUNCATE ⚠️ NU E ATINS DE RLS. Politicile lucrează pe rânduri, TRUNCATE
--     lucrează pe toată tabela dintr-o dată și trece pe deasupra lor. Prin
--     PostgREST nu se poate cere (nu există verb pentru asta), deci azi nu e o
--     gaură deschisă. Dar e singurul drept de aici care, dacă ar ajunge vreodată
--     la îndemână, ar șterge socoteala TUTUROR: toți oamenii ar vedea a doua zi
--     „membri noi" pe care îi știau demult, în toate grupurile.
--   • REFERENCES și TRIGGER n-au ce căuta la un utilizator logat.
--
-- `revoke` pe drepturi pe care oricum nu le folosește nimeni nu poate rupe
-- nimic în pagini — spre deosebire de revocările de pe `profiles` din august,
-- unde politicile RLS citeau chiar coloanele revocate.

revoke delete, truncate, references, trigger on public.grup_vizite from authenticated;

-- Repetate din `1-tabela-vizite.sql`, ca fișierul să poată fi rulat și singur.
revoke all on public.grup_vizite from anon;
revoke all on public.grup_vizite from public;

grant select, insert, update on public.grup_vizite to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC B — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────

select grantee::text                as cine,
       privilege_type::text         as drept
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_vizite'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')
order by cine, drept;

-- AȘTEPTAT:
--   • `authenticated` cu EXACT trei rânduri: INSERT, SELECT, UPDATE.
--   • `anon` și `public` să NU apară deloc.
--   • `service_role` cu tot ce vrea — e rolul serverului, nu ajunge în browser.
--
-- Dacă `authenticated` mai are DELETE sau TRUNCATE, revocarea n-a intrat:
-- oprește-te și spune-mi, nu publica frontendul.

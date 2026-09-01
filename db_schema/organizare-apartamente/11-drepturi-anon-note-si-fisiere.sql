-- ═══════════════════════════════════════════════════════════════════════════
-- DREPTURILE LUI `anon` PE NOTELE ȘI FIȘIERELE PAȘILOR
-- 1 septembrie 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⛔ DEOCAMDATĂ NUMAI BLOC 0. Restul scriptului se scrie DUPĂ ce se citește ce
--    iese, din motivul explicat mai jos. Nu presupune nimic.
--
-- CE S-A GĂSIT. Proba cu cheia anonimă, dată pe toate cele unsprezece tabele
-- atinse de pachetul „împărțirea apartamentelor", pe 1 septembrie:
--
--   analiza_teren, analiza_varianta, analiza_nivel, analiza_apartament,
--   apartament_suprafata, apartament_interes, grup_membru_preferinte,
--   teren_atasamente, grup_teren_comments, grup_teren_checklist
--       → HTTP 401, „permission denied for table". Ușa e închisă din drepturi,
--         înainte de orice RLS. Asta e starea bună.
--
--   grup_checklist_notes  → HTTP 200, []
--   grup_checklist_files  → HTTP 200, []
--       → `anon` ARE drept de citire; singurul lucru care îl oprește e RLS-ul.
--
-- DE CE CONTEAZĂ, deși nu se scurge nimic: lista goală vine din politici, nu
-- din drepturi, deci tot ce ține ușa închisă e o singură frază de RLS. Iar
-- TRUNCATE, dacă e printre drepturile date, NU e atins de RLS deloc: lucrează
-- pe toată tabela, nu pe rânduri. E tiparul deja consemnat, al tabelelor
-- create înainte de pachet: Supabase le dă `ALL` automat, iar migrația 6 le-a
-- atins politica, nu granturile.
--
-- VERIFICAT ÎNAINTE, ca revocarea să nu rupă nimic: cele două tabele se citesc
-- din `grup-details.html` și din `js/organizare-apartamente.js`, amândouă în
-- spatele contului. Nicio pagină publică nu le atinge.
--
-- ⚠️ DE CE NU E SCRISĂ DIRECT REVOCAREA. Sunt trei feluri în care dreptul poate
--    ajunge la `anon`, și cer trei reparații diferite:
--      (a) grant direct către `anon`        → `revoke ... from anon` rezolvă;
--      (b) grant către rolul `public`       → revocarea de la `anon` NU schimbă
--          NIMIC (se execută curat și pare că a mers), trebuie `from public`;
--      (c) grant către `public` de care se sprijină ȘI `authenticated` → o
--          revocare de la `public` ar închide tăcut paginile pentru TOȚI
--          utilizatorii logați, nu doar pentru anonimi.
--    În cazul (c) ordinea e obligatorie: întâi grant explicit către
--    `authenticated`, abia apoi revocarea de la `public`.
--
-- ⚠️ NU pune BEGIN / ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — DE UNDE VINE DREPTUL (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Se întreabă `role_table_grants`, NU `column_privileges`: a doua nu
--    deosebește un grant pe tabelă de unul pe coloane, le desfășoară pe
--    amândouă la fel.
--
-- `PUBLIC` e trecut anume în listă: e rolul care nu se vede dacă nu-l ceri, și
-- e exact cel care face revocările să pară că n-au niciun efect.
--
-- (b) răspunde, în treacăt, și la întrebarea lăsată deschisă pentru sesiunea
-- următoare: notele din verificări au deja politica „Users can update own
-- checklist notes", dar o politică fără grant sub ea nu face nimic. Dacă UPDATE
-- apare aici pentru `authenticated`, editarea notelor e numai frontend.

select 'a. cine are ce' as sectiune,
       (table_name || ' / ' || grantee)::text as nume,
       privilege_type::text as detaliu
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('grup_checklist_notes', 'grup_checklist_files')
  and grantee in ('anon', 'authenticated', 'PUBLIC')

union all

select 'b. are authenticated UPDATE pe note?',
       coalesce(max(grantee), 'NU — nimeni')::text,
       coalesce(max(privilege_type), '(niciun rand)')::text
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_checklist_notes'
  and privilege_type = 'UPDATE' and grantee in ('authenticated', 'PUBLIC')

union all

select 'c. politici',
       (tablename || ' / ' || policyname)::text,
       (cmd || ' / ' || array_to_string(roles, ','))::text
from pg_policies
where schemaname = 'public'
  and tablename in ('grup_checklist_notes', 'grup_checklist_files')

order by sectiune, nume;

-- Cum se citește:
--   (a) pentru fiecare tabelă, cine are drepturi și care. Dacă apare `PUBLIC`,
--       reparația e alta decât dacă apare `anon`. Dacă apare TRUNCATE
--       oriunde, aceea e singura linie pe care RLS n-o acoperă.
--   (b) răspunsul la întrebarea despre editarea notelor.
--   (c) politicile, ca să se vadă ce rămâne să țină ușa după revocare.


-- ───────────────────────────────────────────────────────────────────────────
-- CE A IEȘIT LA BLOC 0, rulat pe 1 septembrie 2026
-- ───────────────────────────────────────────────────────────────────────────
-- (a) NICIUN rând pe `PUBLIC`. Granturile sunt directe, deci cazul (b) și (c)
--     din antet nu se aplică: revocarea de la `anon` chiar închide ușa, iar
--     `authenticated` nu se sprijină pe nimic care să se rupă.
--
--     DAR: amândouă tabelele au TOATE cele șapte drepturi, la AMÂNDOUĂ
--     rolurile: INSERT, SELECT, UPDATE, DELETE, **TRUNCATE**, REFERENCES,
--     TRIGGER. Tiparul Supabase în forma lui completă: tabelele astea n-au fost
--     strânse niciodată, nici măcar pentru utilizatorii logați.
--
-- (b) `authenticated` are deja UPDATE pe `grup_checklist_notes`. Deci editarea
--     notelor din verificări, cerută pentru sesiunea următoare, e NUMAI
--     frontend: politica există, dreptul există.
--
-- (c) Politicile rămân toate cum sunt, neatinse. Câteva sunt scrise pe rolul
--     `public` în loc de `authenticated` (`checklist_files_select`,
--     `Members can insert checklist notes`, `Users can update own checklist
--     notes` și altele). Nu se rescriu aici: după ce `anon` nu mai are niciun
--     drept, e oprit ÎNAINTE de RLS și rolul politicii nu mai schimbă nimic
--     pentru el. Iar o politică nu se rescrie fără să i se citească întâi
--     condiția întreagă, care nu se vede în inventarul de mai sus.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — REPARAȚIA
-- ───────────────────────────────────────────────────────────────────────────
-- Aceeași formă ca migrația 5 pe `grup_teren_comments`: se ia tot, apoi se dă
-- înapoi doar ce folosesc paginile.
--
-- ⚠️ ORDINEA CONTEAZĂ: revoke întâi, grant după. Invers, grantul ar fi șters de
--    revocarea de deasupra lui și tabela ar rămâne închisă pentru toată lumea,
--    fără nicio eroare la rulare.
--
-- ⚠️ `revoke ... from public` e pus deși inventarul n-a arătat niciun rând pe
--    `PUBLIC`: e ieftin, nu atinge granturile directe ale lui `authenticated`
--    (roluri separate) și acoperă cazul în care cineva ar fi dat între timp un
--    drept pe acolo.

-- ── Notele ────────────────────────────────────────────────────────────────
revoke all on public.grup_checklist_notes from anon, public, authenticated;

-- SELECT, INSERT, DELETE și UPDATE: toate patru au politică și sunt folosite
-- din pagini. UPDATE nu e încă folosit de nicio pagină, dar politica lui există
-- din start și pe el se sprijină editarea notelor, care urmează.
grant select, insert, update, delete on public.grup_checklist_notes to authenticated;

-- ── Fișierele ─────────────────────────────────────────────────────────────
revoke all on public.grup_checklist_files from anon, public, authenticated;

-- Fără UPDATE: tabela n-are nicio politică de UPDATE, deci un drept dat aici
-- n-ar fi folosit de nimeni. Un fișier nu se corectează, se șterge și se urcă
-- din nou.
grant select, insert, delete on public.grup_checklist_files to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────

select (table_name || ' / ' || grantee)::text as nume,
       privilege_type::text                   as drept
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('grup_checklist_notes', 'grup_checklist_files')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by nume, drept;

-- Cum se citește: ȘAPTE rânduri, toate pe `authenticated`.
--   grup_checklist_files / authenticated: DELETE, INSERT, SELECT
--   grup_checklist_notes / authenticated: DELETE, INSERT, SELECT, UPDATE
-- Niciun rând pe `anon`, niciunul pe `PUBLIC`, niciun TRUNCATE nicăieri.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — PROBELE DE DUPĂ, care nu se dau din SQL Editor
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Inventarul de mai sus arată forma. Că ușa e închisă se vede doar din
--    afară, iar că nu s-a închis peste ai casei se vede doar din pagină.
--
--   1. Cu cheia anonimă, din afară: cele două tabele trebuie să întoarcă acum
--      401 „permission denied for table", nu 200 cu listă goală.
--   2. Cu contul, în pagina de grup ȘI în cea de împărțire a apartamentelor:
--      notele pașilor se citesc, se scriu și se șterg mai departe; fișierele
--      urcate pe pașii de GRUP (`grup-details.html`) se văd și se descarcă.
--      A doua probă e cea care contează: prima nu poate deosebi „închis pentru
--      anonimi" de „închis pentru toți".

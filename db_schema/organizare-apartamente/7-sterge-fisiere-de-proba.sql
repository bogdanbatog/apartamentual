-- ═══════════════════════════════════════════════════════════════════════════
-- ȘTERGEREA CELOR TREI FIȘIERE DE PROBĂ
-- 31 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: se șterg trei fișiere urcate pe 22 martie 2026 în grupul „Investiție
-- Inteligentă – Bloc Boutique Central", pe casetele de pași `c2` și `c3`.
-- Lucian a confirmat că erau de probă.
--
-- ⚠️ NU SUNT FIȘIERE ORFANE. Am crezut la început că rămăseseră fără pagină
--    după ce verificările terenului s-au mutat, dar cheile lor sunt `c2` și
--    `c3`, adică pașii de GRUP, nu pașii de TEREN (care ar avea chei de forma
--    `t-<teren_id>-<pas>`). Casetele de grup sunt neatinse, deci fișierele se
--    vedeau în continuare. Se șterg fiindcă erau de probă, atât.
--
-- ⭐ SE ȘTERG DIN DOUĂ LOCURI, în ordinea asta:
--      1. obiectul din `storage.objects` (fișierul propriu-zis)
--      2. rândul din `grup_checklist_files` (evidența)
--    Invers, ar rămâne fișierul pe disc fără nimic care să spună că există. Nu
--    l-ar mai găsi nimeni și n-ar mai fi șters niciodată.
--
-- ⚠️ ȘTERGEREA NU SE POATE DA ÎNAPOI. De aceea BLOC 0 arată exact ce va
--    dispărea, iar BLOC 1 și 2 se rulează abia după ce te uiți la listă.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CE SE VA ȘTERGE (nu schimbă nimic; UITĂ-TE la listă)
-- ───────────────────────────────────────────────────────────────────────────
-- Trebuie să iasă EXACT trei rânduri, toate din grupul „Investiție
-- Inteligentă", cu chei `c2` sau `c3` și data 22 martie 2026. Dacă apare
-- altceva, OPREȘTE-TE.

select f.id::text                    as id_rand,
       f.file_name                   as fisier,
       f.step_key                    as cheia,
       g.nume                        as grup,
       f.created_at::date::text      as adaugat,
       f.storage_path                as cale_in_storage,
       case when o.id is null then 'LIPSESTE DIN STORAGE' else 'exista' end as fisierul
from public.grup_checklist_files f
left join public.grupuri g on g.id = f.grup_id
left join storage.objects o on o.bucket_id = 'checklist-files' and o.name = f.storage_path
where f.step_key in ('c2', 'c3')
  and f.created_at::date = date '2026-03-22'
order by f.created_at;

-- Cum se citește:
--   • trei rânduri, cu numele din discuția de pe 31 august:
--     20260321_220934.jpg (de două ori, pe c2 și c3) și
--     Screenshot 2026-03-21 065922.png (pe c2);
--   • coloana `fisierul` spune dacă obiectul chiar e în storage. Dacă scrie
--     „LIPSESTE DIN STORAGE", rândul e deja o evidență goală și BLOC 1 nu are
--     ce șterge pentru el — nu e o problemă, doar treci la BLOC 2.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Fișierele din storage: NU DIN SQL
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ ÎNCERCAT PE 31 AUGUST 2026 ȘI REFUZAT DE SUPABASE:
--
--     delete from storage.objects where bucket_id = 'checklist-files' ...
--     ERROR 42501: Direct deletion from storage tables is not allowed.
--                  Use the Storage API instead.
--     HINT: This prevents accidental data loss from orphaned objects.
--
--    E un declanșator (`storage.protect_delete`) pus dinadins de platformă, și
--    are dreptate: dintr-un `delete` în SQL Editor s-ar putea șterge rândul
--    fără fișier sau fișierul fără rând, iar niciuna dintre cele două jumătăți
--    nu se mai găsește pe urmă.
--
-- ⭐ CUM SE ȘTERG, DE FAPT: din pagina grupului, cu butonul care există deja.
--    `deleteStepFile` (în `grup-details.html`) cheamă Storage API și face
--    amândouă ștergerile, în ordinea bună: întâi obiectul, apoi rândul.
--
--      1. intri în grupul „Investiție Inteligentă – Bloc Boutique Central";
--      2. deschizi casetele de pași `c2` (Analiza generală) și `c3` (Extras CF);
--      3. apeși coșul de gunoi de lângă fiecare fișier.
--
--    Trei apăsări, și BLOC 2 de mai jos nu mai are ce șterge: rândurile pleacă
--    odată cu fișierele.
--
-- ALTERNATIVA, dacă butonul nu e la îndemână: dashboard-ul Supabase, Storage →
-- checklist-files → folderul grupului. Dar atunci fișierele pleacă și rândurile
-- rămân, deci BLOC 2 TREBUIE rulat după.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Rândurile din evidență
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ SE RULEAZĂ DOAR dacă fișierele au fost șterse din dashboard, nu din
--    pagină. Ștergerea din pagină duce deja și rândurile; rulat degeaba, blocul
--    ăsta nu strică nimic, dar nici nu găsește ce să șteargă.

delete from public.grup_checklist_files
where step_key in ('c2', 'c3')
  and created_at::date = date '2026-03-22';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────

select 'a. randuri ramase'  as sectiune,
       count(*)::text       as nume,
       'in grup_checklist_files, in total' as detaliu
from public.grup_checklist_files

union all

select 'b. obiecte ramase'  as sectiune,
       count(*)::text       as nume,
       'in bucketul checklist-files'       as detaliu
from storage.objects
where bucket_id = 'checklist-files'

union all

-- Fișiere din storage care nu mai au rând în evidență: dacă apare ceva aici,
-- s-a șters în ordine greșită cândva și cineva trebuie să facă curat de mână.
select 'c. fisiere fara evidenta' as sectiune,
       o.name::text               as nume,
       'obiect fara rand in tabela' as detaliu
from storage.objects o
where o.bucket_id = 'checklist-files'
  and not exists (select 1 from public.grup_checklist_files f
                   where f.storage_path = o.name)

order by sectiune, nume;

-- Cum se citește:
--   • (a) și (b): amândouă trebuie să scadă cu 3 față de cât erau (erau 3 în
--     tabelă pe 30 august, deci acum 0);
--   • (c): ZERO rânduri. Dacă apare ceva aici, un fișier a fost șters din
--     dashboard fără să se șteargă și rândul, sau invers.

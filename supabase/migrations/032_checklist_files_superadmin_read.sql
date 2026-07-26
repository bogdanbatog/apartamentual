-- ============================================================================
-- 032_checklist_files_superadmin_read.sql
--
-- SCOP: Superadminul să vadă ATAȘAMENTELE din „Progresul Grupului" pe orice grup.
--
-- PROBLEMA: Pe pagina de grup (grup-details.html:1612), secțiunea de progres se
-- afișează pentru `isMember || isSuperAdmin`, iar `loadStepFiles()`
-- (grup-details.html:4244) citește tabela `grup_checklist_files`. Dar acea tabelă
-- are două politici de SELECT și NICIUNA nu-l include pe superadmin:
--   • checklist_files_select         → adminul grupului, sau membru în grup
--                                      „cu aprobare"
--   • checklist_files_select_members → membru cu status 'activ', sau is_admin()
-- `is_admin()` verifică flag-ul `profiles.is_admin`, care e ALT câmp decât
-- `profiles.is_super_admin`. Superadminul pică ambele condiții, RLS întoarce
-- zero rânduri FĂRĂ eroare, iar în pagină apar doar titlurile pașilor — fără
-- atașamente și fără vreun mesaj care să explice de ce.
--
-- Pentru comparație, celelalte două tabele ale jurnalului de progres au deja
-- politici de superadmin (`Super admin full access checklist` /
-- `... checklist notes`, ambele ALL). Pe tabela de fișiere s-a uitat.
--
-- SOLUȚIA: O politică nouă de SELECT pentru superadmin. Politicile permisive se
-- adună cu OR, deci membrii și adminii de grup NU sunt afectați în niciun fel —
-- nimic din ce funcționa până acum nu se schimbă. Nu se atinge nicio politică
-- existentă și nu se modifică nicio schemă sau date.
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script idempotent: poate fi rulat de mai multe ori fără efecte secundare.
-- ============================================================================

-- ── 1. Politica de SELECT pentru superadmin ─────────────────────────────────
-- `is_super_admin()` este funcția care există deja în proiect și e SECURITY
-- DEFINER (verificat în pg_proc: prosecdef = true). Fiind SECURITY DEFINER,
-- rulează cu drepturile creatorului, deci nu depinde de politicile RLS de pe
-- `profiles` și nu poate intra în recursivitate.
--
-- Doar CITIRE (`for select`): superadminul vede atașamentele pentru suport și
-- moderare, dar nu poate șterge fișierele altora — ștergerea rămâne pe politica
-- existentă `checklist_files_delete` (auth.uid() = uploaded_by), la fel ca în
-- interfață, unde butonul de ștergere apare doar celui care a urcat fișierul
-- (grup-details.html:4264).
--
-- DACĂ vrei ca superadminul să poată și șterge un atașament abuziv, schimbă
-- `for select` în `for all` — asta l-ar alinia cu notele și bifele, care îi dau
-- deja acces ALL.

drop policy if exists "Super admin read checklist files" on public.grup_checklist_files;

create policy "Super admin read checklist files"
on public.grup_checklist_files
for select
to authenticated
using ( public.is_super_admin() );

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- Ar trebui să apară acum trei politici de SELECT pe tabelă, inclusiv cea nouă:
--
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'grup_checklist_files'
-- order by cmd, policyname;

-- ── Test funcțional după rulare ─────────────────────────────────────────────
-- Logat ca superadmin, deschide grupul-exemplu „Investiție Inteligentă – Bloc
-- Boutique Central":
--   https://apartamentual.ro/grup-details.html?id=d6ab0a78-6935-4a95-8967-794708c208e5
-- Extinde faza 2 („Căutarea și Achiziția Terenului") — atașamentele se încarcă
-- doar pentru fazele deschise (grup-details.html:1965). La pașii „Extras carte
-- funciară obținut" și „Analiză generală cerută pe platformă" există fișiere
-- urcate în storage (bucket `checklist-files`), care înainte de această migrație
-- nu apăreau.

-- ── NU rezolvat aici (probleme separate, de tratat pe rând) ──────────────────
-- 1. `grup_checklist` și `grup_checklist_notes` au politici `Public read ...`
--    cu condiția `true`: progresul și notele TUTUROR grupurilor, inclusiv cele
--    reale, sunt citibile de oricine, chiar nelogat, prin API cu cheia anon.
-- 2. Politica de storage `Users can delete own checklist files` are condiția
--    doar `bucket_id = 'checklist-files'`, fără verificare de proprietar — orice
--    utilizator poate șterge orice atașament din bucket. Cea mai urgentă:
--    e pierdere de date, nu doar expunere.
-- 3. Politica de storage `Anyone can read checklist files` permite descărcarea
--    oricărui atașament de către cine îi știe calea, fără să fie membru.

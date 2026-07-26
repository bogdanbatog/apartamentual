-- ============================================================================
-- 033_checklist_files_storage_delete_owner.sql
--
-- SCOP: Nimeni să nu mai poată șterge atașamentele altora din jurnalul de
-- progres al grupurilor.
--
-- PROBLEMA (pierdere de date, nu doar expunere): politica de storage
-- „Users can delete own checklist files" are condiția DOAR:
--     (bucket_id = 'checklist-files')
-- Se numește „own", dar nu verifică nicăieri cine a urcat fișierul. Practic
-- orice utilizator logat poate șterge ORICE atașament din bucket — inclusiv
-- documente reale ale grupurilor (extras carte funciară, analize, studii).
-- În interfață butonul de ștergere apare doar celui care a urcat fișierul
-- (grup-details.html:4264), dar interfața nu e o barieră de securitate:
-- apelul se poate face direct spre API cu cheia publică din site.
--
-- SOLUȚIA: Legăm dreptul de ștergere din storage de coloana `uploaded_by` din
-- tabela noastră `grup_checklist_files`, potrivind calea fișierului
-- (`storage_path`) cu numele obiectului din storage. Astfel politica de storage
-- ajunge identică cu politica de ștergere care există deja pe tabelă
-- (`checklist_files_delete`: auth.uid() = uploaded_by) și cu ce arată interfața.
--
-- DE CE FUNCȚIONEAZĂ CU CODUL EXISTENT: `deleteStepFile()`
-- (grup-details.html:4310) șterge ÎNTÂI fișierul din storage și abia apoi rândul
-- din tabelă. La momentul ștergerii din storage rândul de metadate încă există,
-- deci subinterogarea îl găsește. Dacă vreodată se schimbă ordinea în cod
-- (întâi DB, apoi storage), ștergerea din storage va începe să eșueze — de reținut.
--
-- CE NU SE SCHIMBĂ: încărcarea fișierelor, descărcarea lor, citirea listei de
-- atașamente și politica de ștergere de pe tabelă rămân neatinse.
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script idempotent: poate fi rulat de mai multe ori fără efecte secundare.
--
-- ⚠️ DACĂ SQL Editor dă eroarea „must be owner of table objects", fă aceeași
-- modificare din Dashboard → Storage → Policies → bucket `checklist-files` →
-- editezi politica de DELETE și pui condiția din blocul 1 de mai jos.
-- ============================================================================

-- ── 1. Înlocuim politica de DELETE pe storage.objects ───────────────────────
-- Numele politicii se păstrează, ca să rămână recognoscibilă în Dashboard.
-- `storage.objects.name` este calea completă a fișierului în bucket, exact
-- valoarea salvată în `grup_checklist_files.storage_path` la upload
-- (grup-details.html:4205: `${grupId}/${stepKey}/${timestamp}_${safeName}`).

drop policy if exists "Users can delete own checklist files" on storage.objects;

create policy "Users can delete own checklist files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'checklist-files'
  and exists (
    select 1
    from public.grup_checklist_files f
    where f.storage_path = storage.objects.name
      and f.uploaded_by = auth.uid()
  )
);

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- select policyname, cmd, qual
-- from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and policyname = 'Users can delete own checklist files';

-- ── Test funcțional după rulare ─────────────────────────────────────────────
-- 1. Ca membru care a urcat un fișier: butonul „×" de pe atașament trebuie să
--    funcționeze ca înainte (fișierul dispare din listă și din storage).
-- 2. Ca alt utilizator: nu există buton în interfață, iar un apel direct la API
--    nu mai șterge nimic. Atenție: `deleteStepFile()` doar face `console.warn`
--    la eroarea de storage și continuă (grup-details.html:4318) — deci un
--    utilizator neautorizat poate în continuare șterge RÂNDUL din tabelă dacă
--    trece politica de pe tabelă. Politica `checklist_files_delete` de pe
--    tabelă cere deja `auth.uid() = uploaded_by`, deci e acoperit.

-- ── EFECT SECUNDAR de știut: fișiere orfane ─────────────────────────────────
-- Fișierele din storage care NU mai au rând corespondent în
-- `grup_checklist_files` (ex: rămase de la grupuri șterse) nu vor mai putea fi
-- șterse de nimeni prin API — subinterogarea nu găsește niciun rând. Se șterg
-- din Dashboard → Storage (care rulează cu drepturi de service_role) sau cu o
-- interogare separată. În bucket există deja astfel de fișiere, sub folderul
-- unui grup care nu mai apare în tabela `grupuri`:
--   097aa33f-19ee-4d9e-8513-c98d9ffb161f/f1_regulament/
-- Curățenia lor e o operație separată, nu ține de această migrație.

-- ── OPȚIONAL, dacă vrei și moderare ─────────────────────────────────────────
-- Blocul de mai sus dă dreptul de ștergere DOAR celui care a urcat fișierul.
-- Dacă vrei ca adminul grupului și superadminul să poată șterge un atașament
-- abuziv, adaugă o politică separată (permisivă, se adună cu OR). Ar trebui
-- adăugat și un buton în interfață, altfel dreptul rămâne nefolosit:
--
-- create policy "Group admin and super admin can delete checklist files"
-- on storage.objects
-- for delete
-- to authenticated
-- using (
--   bucket_id = 'checklist-files'
--   and (
--     public.is_super_admin()
--     or exists (
--       select 1 from public.grupuri g
--       where g.id::text = (storage.foldername(storage.objects.name))[1]
--         and g.admin_id = auth.uid()
--     )
--   )
-- );

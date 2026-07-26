-- ============================================================================
-- 034_checklist_close_public_read.sql
--
-- SCOP: Jurnalul de progres al grupurilor (bife, note, atașamente) să nu mai fie
-- citibil de oricine — doar de membrii activi, adminul grupului și superadmin.
--
-- PROBLEMA:
--   • `grup_checklist`       → politica „Public read checklist"       cu qual `true`
--   • `grup_checklist_notes` → politica „Public read checklist notes" cu qual `true`
--   • storage                → politica „Anyone can read checklist files",
--                              condiția doar `bucket_id = 'checklist-files'`
-- Condiția `true` înseamnă ORICINE, inclusiv un vizitator NELOGAT: bifele și
-- notele tuturor grupurilor, inclusiv cele reale, se pot citi direct prin API cu
-- cheia anon care e publică în `frontend/js/supabase-config.js` (verificat pe
-- 25 iulie 2026 — s-au citit fără autentificare bifele grupurilor reale
-- „Parcul Circului," și „Rond Cosbuc..."). Pagina afișează secțiunea doar
-- membrilor, dar interfața nu e o barieră de securitate.
--
-- Documentele din jurnal sunt reale: extras carte funciară, analize, studii
-- geotehnice, note interne de negociere.
--
-- SOLUȚIA: Înlocuim politicile publice de SELECT cu politici bazate pe
-- apartenența la grup. Criteriul de membru e același folosit de pagină
-- (grup-details.html:1341): rând în `grup_membri` cu `status = 'activ'`.
-- Cererile `pending` NU dau acces — corect, sunt oameni care doar au cerut să
-- intre.
--
-- DE CE NU RUPE NIMIC (verificat înainte de scriere):
--   • `grup_checklist*` sunt citite DOAR în grup-details.html, pe ramura
--     `isMember || isSuperAdmin` (grup-details.html:1612) — nicio altă pagină.
--   • bucket-ul `checklist-files` e folosit DOAR în grup-details.html, prin
--     upload/download/remove autentificate; nicăieri `getPublicUrl`, deci nicio
--     pagină nu afișează fișierele prin link public.
--   • Superadminul rămâne acoperit: pe cele două tabele există deja politici
--     „Super admin full access ..." (ALL), iar `public.is_super_admin()` e pus
--     explicit și în politicile noi.
--   • Încărcarea, ștergerea și listarea atașamentelor rămân neatinse (politicile
--     de INSERT/DELETE nu se modifică aici; ștergerea a fost reparată în 033).
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script idempotent: poate fi rulat de mai multe ori fără efecte secundare.
-- Blocurile 1-2 și blocul 3 sunt independente — se pot rula separat.
--
-- ⚠️ Blocul 3 atinge storage.objects. Dacă SQL Editor dă „must be owner of table
-- objects", fă modificarea din Dashboard → Storage → Policies → bucket
-- `checklist-files` → politica de SELECT, cu condiția din bloc.
-- ============================================================================

-- ── 1. Bifele: `grup_checklist` ─────────────────────────────────────────────

drop policy if exists "Public read checklist" on public.grup_checklist;
drop policy if exists "Members read checklist" on public.grup_checklist;

create policy "Members read checklist"
on public.grup_checklist
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.grupuri g
    where g.id = grup_checklist.grup_id
      and g.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.grup_membri m
    where m.grup_id = grup_checklist.grup_id
      and m.user_id = auth.uid()
      and m.status = 'activ'
  )
);

-- ── 2. Notele: `grup_checklist_notes` ───────────────────────────────────────
-- Aceeași logică, aceleași trei categorii.

drop policy if exists "Public read checklist notes" on public.grup_checklist_notes;
drop policy if exists "Members read checklist notes" on public.grup_checklist_notes;

create policy "Members read checklist notes"
on public.grup_checklist_notes
for select
to authenticated
using (
  public.is_super_admin()
  or exists (
    select 1 from public.grupuri g
    where g.id = grup_checklist_notes.grup_id
      and g.admin_id = auth.uid()
  )
  or exists (
    select 1 from public.grup_membri m
    where m.grup_id = grup_checklist_notes.grup_id
      and m.user_id = auth.uid()
      and m.status = 'activ'
  )
);

-- ── 3. Atașamentele din storage ─────────────────────────────────────────────
-- Aici nu avem coloană `grup_id`, dar avem calea fișierului: primul folder din
-- cale ESTE id-ul grupului (grup-details.html:4205 —
-- `${grupId}/${stepKey}/${timestamp}_${safeName}`). `storage.foldername(name)[1]`
-- extrage acel prim segment. Îl comparăm ca text, fiindcă `name` e text și
-- `grupuri.id` e uuid.

drop policy if exists "Anyone can read checklist files" on storage.objects;
drop policy if exists "Members can read checklist files" on storage.objects;

create policy "Members can read checklist files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'checklist-files'
  and (
    public.is_super_admin()
    or exists (
      select 1 from public.grupuri g
      where g.id::text = (storage.foldername(storage.objects.name))[1]
        and g.admin_id = auth.uid()
    )
    or exists (
      select 1 from public.grup_membri m
      where m.grup_id::text = (storage.foldername(storage.objects.name))[1]
        and m.user_id = auth.uid()
        and m.status = 'activ'
    )
  )
);

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- Nu trebuie să mai apară nicio politică de SELECT cu qual `true`:
--
-- select tablename, policyname, cmd, roles, qual
-- from pg_policies
-- where (schemaname = 'public'
--        and tablename in ('grup_checklist', 'grup_checklist_notes', 'grup_checklist_files'))
--    or (schemaname = 'storage' and tablename = 'objects'
--        and qual like '%checklist-files%')
-- order by tablename, cmd, policyname;

-- ── Test funcțional după rulare (important, în ordinea asta) ─────────────────
-- 1. Ca MEMBRU al unui grup: bifele, notele și atașamentele apar ca înainte;
--    bifarea unui pas, adăugarea unei note și urcarea unui fișier funcționează.
-- 2. Ca SUPERADMIN pe un grup din care nu faci parte: vezi tot (bife, note,
--    atașamente) — inclusiv pe grupul-exemplu
--    d6ab0a78-6935-4a95-8967-794708c208e5, faza 2 extinsă.
-- 3. Ca utilizator logat care NU e membru: secțiunea de progres nu se încarcă
--    deloc (pagina o ascunde oricum) — dar acum nici baza nu mai servește datele.
-- 4. NELOGAT: interogarea directă a tabelelor cu cheia anon trebuie să întoarcă
--    listă goală. Înainte întorcea bifele grupurilor reale.

-- ── OBSERVAT, dar NEATINS aici ──────────────────────────────────────────────
-- `grup_membri` este și el citibil fără autentificare (s-au citit rânduri cu
-- cheia anon). Expunerea e mai mică — pagina de grup afișează oricum membrii cu
-- pseudonim — dar e o decizie separată, de discutat: ce anume dintr-un grup
-- trebuie să fie vizibil public și ce nu. NU se schimbă în această migrație,
-- pentru că politicile de mai sus se sprijină pe citirea din `grup_membri`, iar
-- o restrângere acolo trebuie gândită împreună cu ele.

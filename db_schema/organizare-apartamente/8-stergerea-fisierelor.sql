-- ═══════════════════════════════════════════════════════════════════════════
-- ȘTERGEREA FIȘIERELOR: și de fondatorul grupului, nu doar de cine le-a urcat
-- 31 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: aceeași lărgire ca la note (`6-stergerea-notelor.sql`), dar pentru
-- fișierele agățate de pașii de grup.
--
-- DE CE: butonul „×" din pagină apare doar la propriile fișiere
-- (`f.uploaded_by === currentUser?.id` în `loadStepFiles`), iar politica din
-- bază spune același lucru. Descoperit pe 31 august, când Lucian a vrut să
-- șteargă trei fișiere de probă din propriul grup și n-a avut cu ce: cine face
-- curat în grup nu poate face curat.
--
-- ⚠️ SE SCHIMBĂ DOUĂ LUCRURI, unul aici și unul în pagină:
--      · politica de DELETE de pe `grup_checklist_files` (mai jos);
--      · condiția din `loadStepFiles`, în `grup-details.html`.
--    Fără a doua, butonul tot nu apare, oricât de permisivă ar fi politica.
--
-- ⚠️ Fișierul propriu-zis se șterge prin Storage API, nu din SQL: platforma
--    refuză `delete from storage.objects` cu 42501, ca să nu rămână jumătăți.
--    Politica de mai jos deschide DOAR rândul din evidență; obiectul din
--    storage are politica lui, verificată la BLOC 0.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CUM E ACUM (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Se citesc amândouă porțile: tabela de evidență ȘI bucketul. Dacă a doua nu
-- lasă fondatorul să șteargă obiectul, prima singură nu ajunge: rândul ar
-- pleca, fișierul ar rămâne.

select 'a. politici tabela'  as sectiune,
       policyname::text      as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       coalesce(qual, '(fara)')::text as conditie
from pg_policies
where schemaname = 'public' and tablename = 'grup_checklist_files'

union all

select 'b. politici storage' as sectiune,
       policyname::text      as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       coalesce(qual, with_check, '(fara)')::text as conditie
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and coalesce(qual, with_check, '') like '%checklist-files%'

order by sectiune, nume;

-- Cum se citește: caută politica de DELETE pe fiecare. Dacă vreuna cere doar
-- `uploaded_by = auth.uid()` sau doar autorul, fondatorul e blocat acolo.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Rândul din evidență
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ NUMELE CITIT DIN BLOC 0 PE 31 AUGUST: politica de pe TABELĂ se cheamă
--    `checklist_files_delete`, nu „Users can delete own checklist files" cum
--    presupusesem. Numele acela există, dar pe STORAGE (vezi BLOC 2). Dacă s-ar
--    fi rulat pe ghicite, s-ar fi creat o politică NOUĂ lângă cea veche, iar
--    politicile permisive se combină cu OR: ar fi mers, dar tabela ar fi rămas
--    cu două reguli de ștergere, dintre care una fără rost.
--
-- ⚠️ Rolul trece de la `public` la `authenticated`. Condiția cerea oricum
--    `auth.uid()`, deci un nelogat nu trecea.
--
-- Nu se lărgește și UPDATE: fondatorul poate scoate un fișier greșit, dar n-are
-- ce să rescrie într-un rând de fișier.

drop policy if exists checklist_files_delete on public.grup_checklist_files;
create policy checklist_files_delete
    on public.grup_checklist_files for delete to authenticated
    using (
        uploaded_by = auth.uid()
        or exists (select 1 from public.grupuri g
                    where g.id = grup_checklist_files.grup_id
                      and g.admin_id = auth.uid())
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Obiectul din storage
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ AICI numele se potrivește: politica de pe storage chiar se cheamă „Users
--    can delete own checklist files" (confirmat în BLOC 0 pe 31 august), și
--    cere `f.uploaded_by = auth.uid()`, deci fondatorul e blocat. Se rescrie.
--
-- Politica se sprijină pe rândul din evidență, ca la `teren-documente`: cine
-- are voie să șteargă rândul are voie să șteargă și fișierul.

drop policy if exists "Users can delete own checklist files" on storage.objects;
create policy "Users can delete own checklist files"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'checklist-files'
        and exists (
            select 1 from public.grup_checklist_files f
            where f.storage_path = storage.objects.name
              and (f.uploaded_by = auth.uid()
                   or exists (select 1 from public.grupuri g
                               where g.id = f.grup_id and g.admin_id = auth.uid()))
        )
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Proba adevărată e din pagină, cu contul de fondator, pe un fișier urcat de
--    altcineva: butonul „×" trebuie să apară ȘI fișierul să dispară de tot,
--    nu doar din listă. Reîncarcă pagina după ștergere: dacă reapare, a plecat
--    doar obiectul, nu și rândul, sau invers.

select 'a. tabela'   as sectiune, policyname::text as nume,
       (array_to_string(roles, ',') || ' · ' ||
        case when coalesce(qual,'') like '%admin_id%' then 'include fondatorul'
             else 'NU include fondatorul' end)::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_checklist_files' and cmd = 'DELETE'

union all

select 'b. storage'  as sectiune, policyname::text as nume,
       (array_to_string(roles, ',') || ' · ' ||
        case when coalesce(qual,'') like '%admin_id%' then 'include fondatorul'
             else 'NU include fondatorul' end)::text as detaliu
from pg_policies
where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
  and coalesce(qual,'') like '%checklist-files%'

order by sectiune, nume;

-- Cum se citește: amândouă pe `authenticated` și amândouă cu
-- „include fondatorul". Un singur rând la fiecare secțiune: dacă apar două
-- politici de DELETE pe tabelă, una a rămas de la o rulare pe nume greșit.

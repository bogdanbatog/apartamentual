-- ═══════════════════════════════════════════════════════════════════════════
-- ȘTERGEREA NOTELOR: și de fondatorul grupului, nu doar de autor
-- 31 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: politica de DELETE de pe `grup_checklist_notes` se lărgește cu o a doua
-- cale: fondatorul grupului.
--
-- DE CE: azi butonul „șterge" apare doar la propriile note (`isOwn` în pagină),
-- iar politica din bază spune același lucru: `auth.uid() = user_id`. Un membru
-- care vede o notă veche și greșită a altcuiva nu are ce să facă cu ea, iar
-- fondatorul nu poate face curat în propriul grup. Superadminul putea deja,
-- prin politica „Super admin full access checklist notes".
--
-- ⚠️ NU se lărgește și `UPDATE`. Fondatorul poate ȘTERGE o notă greșită, dar nu
--    poate REscrie ce a spus altcineva. Sunt două lucruri foarte diferite
--    într-un grup unde oamenii negociază între ei, iar al doilea n-a fost cerut.
--
-- CE ATINGE SCRIPTUL: o singură politică, pe o singură tabelă. Nu se ating
-- SELECT, INSERT sau UPDATE, nici politica de superadmin.
--
-- ⚠️ NU pune BEGIN / ROLLBACK.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CUM E ACUM (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Verificat pe 30 august 2026, ca să fie scris undeva:
--
--   Super admin full access checklist notes   ALL     public   is_super_admin()
--   Users can delete own checklist notes      DELETE  public   auth.uid() = user_id
--   Members can insert checklist notes        INSERT  public   (with_check)
--   Members read checklist notes              SELECT  authenticated  membru activ
--   Users can update own checklist notes      UPDATE  public   auth.uid() = user_id
--
-- Se schimbă DOAR a doua.

select policyname::text                     as politica,
       cmd::text                            as operatie,
       array_to_string(roles, ',')::text    as rol,
       coalesce(qual, '(fara)')::text       as conditie
from pg_policies
where schemaname = 'public' and tablename = 'grup_checklist_notes'
order by cmd, policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Politica
-- ───────────────────────────────────────────────────────────────────────────
-- Se păstrează numele, ca istoricul să rămână citibil, deși acum spune mai
-- puțin decât face: „own" era adevărat până azi.
--
-- ⚠️ Rolul trece de la `public` la `authenticated`. Condiția cerea oricum
--    `auth.uid()`, deci un nelogat nu trecea; rolul strâmt spune limpede cui i
--    se adresează regula, ca la politicile scrise în august pe
--    `grup_teren_checklist`.
--
-- Fondatorul se citește din `grupuri.admin_id`, nu din `grup_membri`: el poate
-- să nu aibă rând acolo, iar administrarea se poate transfera.

drop policy if exists "Users can delete own checklist notes" on public.grup_checklist_notes;
create policy "Users can delete own checklist notes"
    on public.grup_checklist_notes for delete to authenticated
    using (
        auth.uid() = user_id
        or exists (select 1 from public.grupuri g
                    where g.id = grup_checklist_notes.grup_id
                      and g.admin_id = auth.uid())
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Proba adevărată se dă din pagină: cu contul de fondator, pe o notă scrisă
--    de altcineva, butonul „×" trebuie să apară ȘI să funcționeze. În SQL
--    Editor ești `postgres` și politicile nici nu te ating.

select policyname::text                     as politica,
       cmd::text                            as operatie,
       array_to_string(roles, ',')::text    as rol,
       case when coalesce(qual, '') like '%admin_id%' then 'DA' else 'NU' end as include_fondatorul
from pg_policies
where schemaname = 'public' and tablename = 'grup_checklist_notes'
  and cmd = 'DELETE'
order by policyname;

-- Cum se citește: un rând, pe `authenticated`, cu `include_fondatorul = DA`.

-- ═══════════════════════════════════════════════════════════════════════════
-- ȘTERGEREA DIN JURNALUL TERENULUI: și de fondatorul grupului, nu doar de autor
-- 1 septembrie 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: politica de DELETE de pe `grup_teren_comments` se lărgește cu o a doua
-- cale: fondatorul grupului. Exact ce s-a făcut pe 31 august la note, în
-- `6-stergerea-notelor.sql`, cu aceeași frază.
--
-- DE CE: jurnalul terenului nu avea deloc buton de ștergere în pagină, deși
-- politica îngăduia autorului. Butonul s-a adăugat azi; odată cu el, întrebarea
-- firească: fondatorul poate face curat în jurnalul propriului grup? La note și
-- la documente poate deja, deci altfel jurnalul ar fi fost singurul loc din
-- pagină cu altă regulă, fără niciun motiv.
--
-- ⚠️ NU se dă `UPDATE`. Pe jurnal nu există drept de update DELOC, pentru
--    nimeni: migrația 5 a dat `select, insert, delete`, atât. O intrare greșită
--    se șterge și se scrie din nou. Fondatorul poate ȘTERGE ce a scris altcineva,
--    dar nu poate REscrie, iar asta rămâne așa.
--
-- CE ATINGE SCRIPTUL: o singură politică, pe o singură tabelă. Nu se ating
-- SELECT, INSERT, granturile, nici politicile de superadmin.
--
-- ⚠️ NU pune BEGIN / ROLLBACK. Tot scriptul e o singură tranzacție în editorul
--    Supabase, iar un ROLLBACK pus „de probă" anulează tăcut și ce e deasupra.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CUM E ACUM (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Se rulează ÎNTÂI și se citește cu ochiul, nu se presupune. Scriptul 8 din
--    pachetul ăsta a presupus un nume de politică și a nimerit alături: numele
--    ghicit exista, dar pe altă tabelă. Aici se așteaptă, de la migrația 5:
--
--      select_comments        SELECT  authenticated  membru activ sau fondator
--      insert_comments        INSERT  authenticated  (with_check)
--      delete_own_comments    DELETE  authenticated  user_id = auth.uid()
--
-- Se schimbă DOAR ultima. Dacă lista arată altfel, opreșteșe și întreabă.

select policyname::text                     as politica,
       cmd::text                            as operatie,
       array_to_string(roles, ',')::text    as rol,
       coalesce(qual, '(fara)')::text       as conditie
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'
order by cmd, policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Politica
-- ───────────────────────────────────────────────────────────────────────────
-- Numele rămâne `delete_own_comments`, ca istoricul să fie citibil, deși de azi
-- spune mai puțin decât face. Aceeași alegere ca la note.
--
-- Fondatorul se citește din `grupuri.admin_id`, nu din `grup_membri`: el poate
-- să nu aibă rând acolo, iar administrarea se poate transfera. E fraza deja
-- folosită în `select_comments` și `insert_comments`, deci nimic nou de învățat
-- pentru cine citește tabela peste un an.

drop policy if exists delete_own_comments on public.grup_teren_comments;
create policy delete_own_comments
    on public.grup_teren_comments for delete to authenticated
    using (
        user_id = auth.uid()
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_comments.grup_id
                      and g.admin_id = auth.uid())
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Arată forma, nu comportamentul: în SQL Editor ești `postgres`, `auth.uid()`
--    e NULL și politicile nici nu te ating.
--
--    PROBA ADEVĂRATĂ, din pagina de împărțire a apartamentelor: cu contul de
--    fondator, pe o intrare de jurnal scrisă de ALTCINEVA, butonul „×" trebuie
--    să apară ȘI să funcționeze. Iar cu un cont de membru simplu, pe intrarea
--    altcuiva, butonul NU trebuie să apară deloc.

select policyname::text                     as politica,
       cmd::text                            as operatie,
       array_to_string(roles, ',')::text    as rol,
       case when coalesce(qual, '') like '%admin_id%' then 'DA' else 'NU' end as include_fondatorul
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'
  and cmd = 'DELETE'
order by policyname;

-- Cum se citește: un singur rând, `delete_own_comments`, pe `authenticated`,
-- cu `include_fondatorul = DA`.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Drepturile pe tabelă (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- O politică nu servește la nimic fără dreptul de sub ea. Migrația 5 a dat
-- `select, insert, delete` lui `authenticated` și a luat tot de la `anon`
-- (inclusiv TRUNCATE, care nu e atins de RLS). Aici doar se confirmă că a rămas
-- așa și că UPDATE tot nu e dat nimănui.

select grantee::text     as rol,
       privilege_type::text as drept
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type;

-- Cum se citește: pentru `authenticated` exact trei rânduri (DELETE, INSERT,
-- SELECT), fără UPDATE. Pentru `anon`, niciun rând.

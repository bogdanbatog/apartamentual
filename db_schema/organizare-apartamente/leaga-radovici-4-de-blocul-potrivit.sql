-- ═══════════════════════════════════════════════════════════════════════════
-- LEGAREA TERENULUI „Radovici 4” DE GRUPUL „Blocul potrivit”
-- 29 septembrie 2026
--
-- DE CE. Robert, membru în Parcul Circului, a fondat grupul „Blocul potrivit”
-- și vrea analiza Radovici 4 și acolo. Pe Parcul Circului rămâne neatinsă.
-- Tiparul e `leaga-radovici-4-de-parcul-circului.sql`, 17 septembrie.
--
-- DE CE MANUAL. Butonul „Adaugă” de pe pagina terenului se arată numai
-- membrilor activi ai grupului (`teren-details.js:187-198`). Lucian nu e membru.
--
-- DIFERENȚA FAȚĂ DE TIPAR: id-ul grupului nu e scris de mână (nu-l avem încă),
-- se caută după nume. Dacă două grupuri se potrivesc, BLOC 1 se oprește singur
-- cu „more than one row returned by a subquery” și nu scrie nimic.
--
-- CE ATINGE. O singură tabelă, `terenuri_likes_grupuri`, un singur rând.
-- Nu atinge analiza, grupul, terenul sau drepturile.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab: editorul rulează tot tabul ca o singură
--    tranzacție, iar un ROLLBACK „de probă” anulează tăcut și inserarea.
--
-- ⚠️ RULEAZĂ BLOC 0 ÎNTÂI ȘI CITEȘTE-L. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 0 · VERIFICARE. Nu schimbă nimic.
-- Un singur tabel prin UNION ALL: editorul arată doar ultimul rezultat.
-- ═══════════════════════════════════════════════════════════════════════════

select * from (
  select 1 as ord, 'teren' as sectiune,
         t.id::text as id,
         t.titlu as detaliu,
         coalesce(t.suprafata::text, '?') || ' mp · status ' || coalesce(t.status::text, '?') as extra
    from public.terenuri t
   where t.id = 'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid

  union all

  -- Toate grupurile care se potrivesc. Trebuie să fie EXACT unul.
  select 2, 'grup', g.id::text, g.nume, 'creat ' || g.created_at::date::text
    from public.grupuri g
   where g.nume ilike '%Blocul potrivit%'

  union all

  select 3, 'va fi added_by', p.user_id::text,
         coalesce(p.pseudonym, '(fără pseudonim)'), 'superadmin'
    from public.profiles p
   where p.user_id = '5d0d6e30-26d7-4f1e-a959-04bb54d58959'::uuid

  union all

  -- Membrii activi ai grupului nou, ca să se vadă că e grupul lui Robert.
  select 4, 'membru', m.user_id::text,
         coalesce(p.pseudonym, '(fără pseudonim)'),
         case when m.user_id = g.admin_id then 'fondator · ' else '' end
           || coalesce(m.status::text, '')
    from public.grup_membri m
    join public.grupuri g on g.id = m.grup_id
    left join public.profiles p on p.user_id = m.user_id
   where g.nume ilike '%Blocul potrivit%'

  union all

  -- Ce are grupul deja la favorite.
  select 5, 'favorit deja existent', l.teren_id::text,
         coalesce(t.titlu, '⚠️ teren inexistent'),
         case when l.teren_id = 'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid
              then '⚠️ RADOVICI 4 E DEJA LEGAT · ' || l.created_at::date::text
              else coalesce(t.suprafata::text, '?') || ' mp · ' || l.created_at::date::text end
    from public.terenuri_likes_grupuri l
    left join public.terenuri t on t.id = l.teren_id
   where l.grup_id in (select id from public.grupuri where nume ilike '%Blocul potrivit%')
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • exact UN rând „teren”: Radovici 4, vreo 632 mp, status `approved`.
--   • exact UN rând „grup”: Blocul potrivit. Dacă sunt două, oprește-te.
--   • la „va fi added_by”: contul apartamenTUal.
--   • la „membru”: Robert, printre ei.
--   • dacă apare „⚠️ RADOVICI 4 E DEJA LEGAT” (Robert l-a pus singur la
--     favorite), nu mai rula BLOC 1, treci direct la import.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · LEGAREA. Scrie un rând.
-- `where not exists` îl face rulabil de două ori fără dublură.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.terenuri_likes_grupuri (teren_id, grup_id, added_by)
select
  'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid,
  (select id from public.grupuri where nume ilike '%Blocul potrivit%'),
  '5d0d6e30-26d7-4f1e-a959-04bb54d58959'::uuid
where not exists (
  select 1 from public.terenuri_likes_grupuri
   where teren_id = 'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid
     and grup_id  = (select id from public.grupuri where nume ilike '%Blocul potrivit%')
);

-- Trebuie să scrie „INSERT 0 1”. „INSERT 0 0” = legătura exista deja.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VERIFICARE FINALĂ. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════

select t.titlu       as teren,
       g.nume        as grup,
       coalesce(p.pseudonym, '(fără pseudonim)') as adaugat_de,
       l.created_at
  from public.terenuri_likes_grupuri l
  join public.terenuri t on t.id = l.teren_id
  join public.grupuri  g on g.id = l.grup_id
  left join public.profiles p on p.user_id = l.added_by
 where l.grup_id in (select id from public.grupuri where nume ilike '%Blocul potrivit%')
 order by l.created_at;

-- Ultimul rând: Radovici 4, cu data de azi.
-- ⚠️ Terenul apare de acum în pagina grupului FĂRĂ analiză, cu „Cere o analiză”.
--    Rulează importul imediat după: `import-radovici-4-blocul-potrivit.sql`.

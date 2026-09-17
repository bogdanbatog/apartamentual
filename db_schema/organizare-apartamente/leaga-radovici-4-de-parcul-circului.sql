-- ═══════════════════════════════════════════════════════════════════════════
-- LEGAREA TERENULUI „Radovici 4” DE GRUPUL „Parcul Circului”
-- 17 septembrie 2026
--
-- DE CE MANUAL. Butonul „Adaugă” de pe pagina terenului se arată numai
-- membrilor activi ai grupului (`teren-details.js:187-198`). Lucian nu e membru,
-- iar steagul de superadmin nu deschide butonul acela. Același drum ca la
-- `leaga-despot-voda-de-parcul-circului.sql`, 7 septembrie.
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

  select 2, 'grup', g.id::text, g.nume, ''
    from public.grupuri g
   where g.id = '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid

  union all

  select 3, 'va fi added_by', p.user_id::text,
         coalesce(p.pseudonym, '(fără pseudonim)'), 'superadmin'
    from public.profiles p
   where p.user_id = '5d0d6e30-26d7-4f1e-a959-04bb54d58959'::uuid

  union all

  -- Ce are grupul deja la favorite. Suprafața e acolo ca să se vadă cu ochiul
  -- dacă vreun teren mai vechi e aceeași parcelă sub alt nume (632 mp), cum
  -- s-a întâmplat la Despot Vodă cu un anunț relistat.
  select 4, 'favorit deja existent', l.teren_id::text,
         coalesce(t.titlu, '⚠️ teren inexistent'),
         case when l.teren_id = 'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid
              then '⚠️ RADOVICI 4 E DEJA LEGAT · ' || l.created_at::date::text
              else coalesce(t.suprafata::text, '?') || ' mp · ' || l.created_at::date::text end
    from public.terenuri_likes_grupuri l
    left join public.terenuri t on t.id = l.teren_id
   where l.grup_id = '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • exact UN rând „teren”, cu titlul Radovici 4 și în jur de 632 mp.
--     Status-ul trebuie să fie `approved`; altfel terenul nu se vede pe site
--     și linkul din pagina grupului ar duce la o pagină goală.
--   • exact UN rând „grup”: Parcul Circului.
--   • la „va fi added_by”: contul apartamenTUal.
--   • la „favorit deja existent”: Galvani 57, Despot Vodă 30 și celelalte
--     terenuri ale grupului. Dacă vreunul are tot vreo 632 mp, spune-mi înainte
--     de BLOC 1. Dacă apare „⚠️ RADOVICI 4 E DEJA LEGAT”, nu mai rula BLOC 1.


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · LEGAREA. Scrie un rând.
-- `where not exists` îl face rulabil de două ori fără dublură.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.terenuri_likes_grupuri (teren_id, grup_id, added_by)
select
  'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid,
  '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid,
  '5d0d6e30-26d7-4f1e-a959-04bb54d58959'::uuid
where not exists (
  select 1 from public.terenuri_likes_grupuri
   where teren_id = 'eed27d0f-fbaa-4561-8d3d-439db03f2441'::uuid
     and grup_id  = '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid
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
 where l.grup_id = '75a1c2cf-6683-4802-8ff8-1a236661f82f'::uuid
 order by l.created_at;

-- Ultimul rând: Radovici 4, cu data de azi și „apartamenTUal”.
-- ⚠️ Terenul apare de acum în pagina grupului, dar FĂRĂ analiză: importul
--    așteaptă suportul pentru duplexuri (vezi `scripts/import-analiza/radovici-4.json`).

-- ============================================================
-- INVENTAR — SECURITATE GRUPURI (Pasul 0)
-- ============================================================
-- Ce face: NIMIC. Doar citește și raportează.
-- Nu modifică nicio politică, nicio tabelă, niciun drept.
-- E sigur de rulat oricând, de câte ori vrei.
--
-- De ce există: pe 1 august, 12 politici RLS care citeau `profiles`
-- de mână au golit paginile de terenuri și parteneri, pentru că
-- nimeni nu se uitase la ele ÎNAINTE de revocare. Scriptul ăsta e
-- exact pasul care a lipsit atunci.
--
-- Rulează-l în Supabase SQL Editor și trimite-mi rezultatul
-- fiecăreia dintre cele 5 interogări.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Ce politici există azi pe tabelele de grupuri?
--    Coloana `roles` spune CINE intră sub politică.
--    Atenție la rolul `public` — înseamnă "toată lumea",
--    inclusiv vizitatorii fără cont. Ăsta e tiparul care ne-a
--    scăpat la `profiles` (politica `profiles_select_all`).
-- ------------------------------------------------------------
SELECT
    tablename,
    policyname,
    cmd            AS operatie,      -- SELECT / INSERT / UPDATE / DELETE / ALL
    roles          AS pentru_cine,
    qual           AS conditie_citire,
    with_check     AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'grup%'
ORDER BY tablename, cmd, policyname;


-- ------------------------------------------------------------
-- 2. Care dintre politicile de mai sus citesc direct din `profiles`?
--    ⚠️ ASTA E CAPCANA DIN 1 AUGUST. O politică ce citește o
--    coloană la care rolul nu mai are drept NU întoarce "fals" —
--    crapă toată interogarea. Dacă apare ceva aici, trebuie
--    rezolvat ÎNAINTE de orice modificare.
-- ------------------------------------------------------------
SELECT
    tablename,
    policyname,
    cmd AS operatie,
    qual AS conditie_care_citeste_profiles
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%')
ORDER BY tablename, policyname;


-- ------------------------------------------------------------
-- 3. Are RLS-ul pornit pe fiecare tabelă de grupuri?
--    Dacă `rls_pornit` e false, politicile sunt decor:
--    tabela e deschisă indiferent ce scrie în ele.
-- ------------------------------------------------------------
SELECT
    c.relname                AS tabela,
    c.relrowsecurity         AS rls_pornit,
    c.relforcerowsecurity    AS rls_fortat,
    (SELECT count(*) FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS nr_politici
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'grup%'
ORDER BY c.relname;


-- ------------------------------------------------------------
-- 4. Ce drepturi la nivel de TABELĂ au rolurile `anon` și
--    `authenticated`? RLS filtrează RÂNDURI, dar dreptul de
--    SELECT pe tabelă e o poartă separată, dinaintea lui.
--    (La `profiles` exact asta am folosit ca să închidem: REVOKE
--    pe coloane, nu politică.)
-- ------------------------------------------------------------
SELECT
    table_name  AS tabela,
    grantee     AS rol,
    privilege_type AS drept
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name LIKE 'grup%'
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;


-- ------------------------------------------------------------
-- 5. Tabelele care au întors 0 rânduri la citirea anonimă:
--    sunt GOALE, sau le blochează RLS-ul?
--    Măsurătoarea din browser nu poate face diferența — de aici
--    se vede sigur. Contează mai ales pentru jurnalul de progres
--    (`grup_checklist*`), semnalat ca public în notițe.
-- ------------------------------------------------------------
SELECT 'grup_checklist'        AS tabela, count(*) AS randuri_reale FROM public.grup_checklist
UNION ALL SELECT 'grup_checklist_notes',  count(*) FROM public.grup_checklist_notes
UNION ALL SELECT 'grup_checklist_files',  count(*) FROM public.grup_checklist_files
UNION ALL SELECT 'grup_anunturi',         count(*) FROM public.grup_anunturi
UNION ALL SELECT 'grup_teren_comments',   count(*) FROM public.grup_teren_comments
UNION ALL SELECT 'grup_kick_ballots',     count(*) FROM public.grup_kick_ballots
UNION ALL SELECT 'grup_kick_votes',       count(*) FROM public.grup_kick_votes
UNION ALL SELECT 'grup_invitations',      count(*) FROM public.grup_invitations
UNION ALL SELECT 'grup_membri',           count(*) FROM public.grup_membri
ORDER BY tabela;

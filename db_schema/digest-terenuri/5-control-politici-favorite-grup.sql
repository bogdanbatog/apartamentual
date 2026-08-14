-- =====================================================================
-- 5-control-politici-favorite-grup.sql
--
-- LA CE FOLOSEȘTE
-- Piesa 5 (butonul „Fă un grup pe acest teren") se termină cu o scriere
-- în `terenuri_likes_grupuri` — terenul intră la favoritele grupului nou.
-- Handoff-ul din 14 august a lăsat o necunoscută: politica de INSERT pe
-- tabela asta nu e nicăieri în `db_schema/` (există doar cea de ștergere
-- pentru superadmini, în `securitate-profiles/7-...sql:156`).
--
-- Fișierul ăsta răspunde la întrebarea "va trece inserarea?" fără să
-- creeze niciun grup real. Înlocuiește proba 1 din browser, sau, dacă
-- proba tot se face, îi spune dinainte răspunsul.
--
-- ⚠️ STRICT SELECT. Nu scrie nimic, nu schimbă nimic, rulabil oricând.
--
-- ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN SINGUR "Run" (Ctrl+A, apoi Run).
-- E scris ca O SINGURĂ interogare cu UNION ALL, fiindcă editorul SQL din
-- Supabase arată doar rezultatul ultimei instrucțiuni dintr-un script.
-- Coloana `sectiune` îți spune ce citești.
--
-- CUM SE CITEȘTE REZULTATUL
--   A — e pornit RLS pe tabelă?
--   B — ce politici există și ce cer ele
--   C — ce drepturi are `authenticated` pe tabelă
--   D — verdictul, calculat din A și B
--   E — dovada empirică: a scris cineva REAL vreodată în tabela asta?
--       Dacă da, calea funcționează deja azi și proba 1 e o formalitate.
--   F — coloanele tabelei, ca să excludem o inserare picată dintr-o coloană
--       `not null` pe care frontendul n-o trimite (arată la fel ca RLS)
-- =====================================================================

select sectiune, rand, detaliu_1, detaliu_2
from (

    -- ─────────────────────────────────────────────────────────────────
    -- A. E pornit RLS? (și pe tabela vecină, `grup_membri`, ca reper)
    -- ─────────────────────────────────────────────────────────────────
    select
        'A. RLS pe tabelă'::text                                as sectiune,
        c.relname::text                                         as rand,
        case when c.relrowsecurity
             then 'RLS PORNIT'
             else 'RLS OPRIT — inserarea o decide doar grantul' end::text as detaliu_1,
        case when c.relforcerowsecurity
             then 'forțat inclusiv pentru proprietarul tabelei'
             else '' end::text                                  as detaliu_2,
        1 as ord, c.relname::text as ord2
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('terenuri_likes_grupuri', 'grup_membri')

    union all

    -- ─────────────────────────────────────────────────────────────────
    -- B. Politicile existente pe tabelă, cu tot cu condiții
    --    `qual`       = condiția de citire/ștergere (USING)
    --    `with_check` = condiția de scriere (WITH CHECK) — asta ne interesează
    -- ─────────────────────────────────────────────────────────────────
    select
        'B. Politici'::text,
        (p.cmd || ' · ' || p.policyname)::text,
        ('roluri: ' || array_to_string(p.roles, ', ')
            || case when p.permissive = 'PERMISSIVE' then ' · permisivă' else ' · RESTRICTIVĂ' end)::text,
        (coalesce('USING: ' || p.qual, '(fără USING)')
            || '   ||   '
            || coalesce('WITH CHECK: ' || p.with_check, '(fără WITH CHECK)'))::text,
        2, (p.cmd || p.policyname)::text
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename  = 'terenuri_likes_grupuri'

    union all

    -- Dacă nu e nicio politică, UNION-ul de mai sus nu întoarce niciun rând
    -- și secțiunea B ar lipsi cu totul. Rândul ăsta o face să spună asta explicit.
    select
        'B. Politici'::text,
        '(NICIO POLITICĂ pe tabelă)'::text,
        ''::text, ''::text,
        2, 'zzz'::text
    where not exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'terenuri_likes_grupuri'
    )

    union all

    -- ─────────────────────────────────────────────────────────────────
    -- C. Drepturile pe tabelă
    -- ⚠️ Capcană cunoscută (memoria `grant-pe-tabela-vs-pe-coloana`):
    --    un grant dat pe TOATĂ tabela apare aici ca și cum ar fi pe fiecare
    --    coloană. Aici citim la nivel de tabelă, deci e curat.
    -- ─────────────────────────────────────────────────────────────────
    select
        'C. Drepturi'::text,
        g.grantee::text,
        g.privilege_type::text,
        ''::text,
        3, (g.grantee || g.privilege_type)::text
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name   = 'terenuri_likes_grupuri'
      and g.grantee in ('anon', 'authenticated', 'service_role')

    union all

    -- ─────────────────────────────────────────────────────────────────
    -- D. Verdictul, calculat din A și B
    -- ─────────────────────────────────────────────────────────────────
    select
        'D. VERDICT'::text,
        case
            when not exists (
                select 1 from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public'
                  and c.relname = 'terenuri_likes_grupuri'
                  and c.relrowsecurity
            )
            then 'RLS e OPRIT ⇒ inserarea TRECE (o decide doar grantul din C)'

            when not exists (
                select 1 from pg_policies
                where schemaname = 'public'
                  and tablename  = 'terenuri_likes_grupuri'
                  and cmd in ('INSERT', 'ALL')
            )
            then 'RLS PORNIT și NICIO politică de INSERT ⇒ inserarea EȘUEAZĂ '
                 || 'pentru oricine e logat. Butonul „Adaugă la unul din grupurile '
                 || 'tale" e rupt și el, de mult. De reparat înainte de trimitere.'

            else 'RLS PORNIT și EXISTĂ politică de INSERT ⇒ citește în B ce cere '
                 || '(de obicei: să fii membru activ al grupului). Fondatorul e '
                 || 'membru activ, fiindcă rândul de membru se scrie ÎNAINTE.'
        end::text,
        ''::text, ''::text,
        4, 'a'::text

    union all

    -- ─────────────────────────────────────────────────────────────────
    -- E. Dovada empirică — cea mai tare dintre toate
    -- Dacă în tabelă există rânduri scrise de oameni care NU sunt superadmini,
    -- atunci calea funcționează azi, în producție, pentru utilizatori obișnuiți.
    -- ⚠️ Dacă iese 0 peste tot, nu înseamnă că e stricat: poate n-a folosit
    --    nimeni butonul niciodată. Atunci verdictul rămâne cel din D.
    -- ─────────────────────────────────────────────────────────────────
    select
        'E. Rânduri existente'::text,
        'total în terenuri_likes_grupuri'::text,
        count(*)::text,
        ''::text,
        5, 'a'::text
    from terenuri_likes_grupuri

    union all

    select
        'E. Rânduri existente'::text,
        'scrise de oameni care NU sunt superadmini'::text,
        count(*)::text,
        case when count(*) > 0
             then 'calea funcționează azi pentru utilizatori obișnuiți'
             else 'niciunul — verdictul rămâne cel din D' end::text,
        5, 'b'::text
    from terenuri_likes_grupuri t
    join profiles p on p.user_id = t.added_by
    where coalesce(p.is_super_admin, false) = false

    union all

    -- ─────────────────────────────────────────────────────────────────
    -- F. Coloanele tabelei
    -- Frontendul scrie exact trei: teren_id, grup_id, added_by. Dacă mai
    -- există o coloană `not null` fără valoare implicită, inserarea ar pica
    -- din motivul ăsta, nu din RLS — și mesajul de eroare ar semăna.
    -- ─────────────────────────────────────────────────────────────────
    select
        'F. Coloane'::text,
        c.column_name::text,
        c.data_type::text,
        (case when c.is_nullable = 'NO' then 'NOT NULL' else 'acceptă NULL' end
            || case when c.column_default is not null
                    then ' · implicit: ' || c.column_default
                    else ' · fără valoare implicită' end)::text,
        6, lpad(c.ordinal_position::text, 3, '0')
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name   = 'terenuri_likes_grupuri'

) x
order by ord, ord2;

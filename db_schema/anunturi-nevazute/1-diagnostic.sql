-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE NU VĂD ANUNȚURILE LUI ALIN, DEȘI SUNT SUPERADMIN?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ÎNTREBAREA. Alin (admin la „Rond Coșbuc" și „Bosianu") spune că a scris un
-- mesaj la „Anunțuri generale grup". Lucian, intrat ca superadmin pe pagina
-- oricăruia dintre grupuri, nu vede niciun mesaj.
--
-- TREI EXPLICAȚII POSIBILE, care arată IDENTIC în interfață (secțiunea spune
-- „Niciun anunț încă"), fiindcă `loadAnunturi()` din `grup-details.html`
-- tratează la fel „zero rânduri" și „mi s-au refuzat rândurile":
--
--   1. Mesajul nu există — Alin l-a scris în altă parte (WhatsApp, descrierea
--      grupului, jurnalul de progres) sau apăsarea pe „Postează" a eșuat.
--   2. Mesajul există, dar RLS nu-l lasă să ajungă la superadmin, fiindcă
--      politica de citire cere apartenența la grup, iar Lucian nu e membru.
--   3. Mesajul există și e vizibil, dar Lucian s-a uitat pe alt grup.
--
-- Interogarea asta le desparte. RULEAZĂ CA `postgres` ÎN SQL EDITOR — acolo
-- ocolești RLS, deci vezi rândurile REALE, nu ce ți-ar da aplicația.
--
-- ⚠️ NU SCHIMBĂ NIMIC — strict SELECT. Se poate rula oricând, de câte ori vrei.
--
-- ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN SINGUR „Run". E scris ca o singură interogare
--    cu `UNION ALL` fiindcă editorul SQL din Supabase arată doar rezultatul
--    ULTIMEI instrucțiuni dintr-un script; opt SELECT-uri separate ar afișa
--    o singură tabelă și ai crede că restul n-au întors nimic.
--
-- CUM SE CITEȘTE. Coloana `sectiune` te plimbă de la A la F:
--   A — grupurile găsite după nume (verifică întâi că sunt cele bune)
--   B — TOATE anunțurile din grupurile alea, cu autor și dată  ⭐
--   C — ultimele anunțuri de pe TOATĂ platforma (context: se scrie undeva?)
--   D — politicile RLS de pe `grup_anunturi` — aici se vede de ce nu vezi ⭐
--   E — ce membri au grupurile (ești tu printre ei? aproape sigur nu)
--   F — digesturile plecate pentru grupurile astea
--   G — funcțiile-ajutor existente (folositoare la reparație, dacă e RLS)
-- ═══════════════════════════════════════════════════════════════════════════

WITH

-- ── Grupurile de interes ───────────────────────────────────────────────────
-- Căutate după bucăți de nume, cu și fără diacritice (Coșbuc / Cosbuc), ca să
-- nu ratăm grupul dintr-un „ș" scris altfel. `unaccent` nu e garantat instalat,
-- deci nu ne bazăm pe el — punem ambele scrieri de mână.
tinta AS (
    SELECT g.id, g.nume, g.admin_id, g.created_at
    FROM public.grupuri g
    WHERE g.nume ILIKE '%cosbuc%'
       OR g.nume ILIKE '%coșbuc%'
       OR g.nume ILIKE '%bosianu%'
),

-- ── A. Ce grupuri am găsit ─────────────────────────────────────────────────
-- Dacă aici nu apar exact grupurile lui Alin, restul secțiunilor se uită în
-- locul greșit — oprește-te și schimbă filtrul de mai sus.
a_grupuri AS (
    SELECT
        'A. grupuri găsite'::text                                   AS sectiune,
        t.nume::text                                                AS detaliu,
        ('id: ' || t.id::text ||
         '  ·  admin: ' || COALESCE(p.pseudonym, '(fără profil)') ||
         ' <' || COALESCE(p.email, '—') || '>')::text               AS valoare,
        t.created_at                                                AS cand
    FROM tinta t
    LEFT JOIN public.profiles p ON p.user_id = t.admin_id
),

-- ── B. ⭐ ANUNȚURILE DIN GRUPURILE ASTEA ───────────────────────────────────
-- Rândul care răspunde la întrebarea principală: EXISTĂ mesajul sau nu?
-- Textul e tăiat la 120 de caractere — e destul cât să-l recunoști.
b_anunturi AS (
    SELECT
        'B. anunțuri în grupurile astea'::text                      AS sectiune,
        (t.nume || ' ← ' || COALESCE(p.pseudonym, '(autor necunoscut)'))::text
                                                                    AS detaliu,
        left(replace(a.content, E'\n', ' '), 120)::text             AS valoare,
        a.created_at                                                AS cand
    FROM public.grup_anunturi a
    JOIN tinta t ON t.id = a.grup_id
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
),

-- ── C. Ultimele anunțuri de oriunde ────────────────────────────────────────
-- Context, în caz că B iese gol: se scrie ceva pe platformă, în general?
-- Dacă și asta e goală, funcția de postare e stricată pentru toată lumea, nu
-- doar pentru Alin.
c_anunturi_recente AS (
    SELECT
        'C. ultimele anunțuri (toată platforma)'::text              AS sectiune,
        (COALESCE(g.nume, '(grup șters)') || ' ← ' ||
         COALESCE(p.pseudonym, '(autor necunoscut)'))::text         AS detaliu,
        left(replace(a.content, E'\n', ' '), 120)::text             AS valoare,
        a.created_at                                                AS cand
    FROM public.grup_anunturi a
    LEFT JOIN public.grupuri g ON g.id = a.grup_id
    LEFT JOIN public.profiles p ON p.user_id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT 15
),

-- ── D. ⭐ POLITICILE RLS DE PE `grup_anunturi` ─────────────────────────────
-- Aici se vede DE CE nu vezi. Uită-te în `valoare` la condiția de SELECT:
--   • dacă apare `grup_membri` fără nicio ramură `is_super_admin`, atunci
--     superadminul nu e prevăzut nicăieri și primește zero rânduri — tăcut,
--     fără eroare (vezi memoria `rls-superadmin-doua-flaguri`);
--   • dacă nu apare NICIO politică de SELECT, tabela e complet închisă pentru
--     `authenticated`, deci n-o vede nici măcar autorul.
d_politici AS (
    SELECT
        'D. politici RLS pe grup_anunturi'::text                    AS sectiune,
        (pol.cmd || ' · ' || pol.policyname ||
         '  ·  roluri: ' || pol.roles::text)::text                  AS detaliu,
        left(COALESCE(pol.qual, '(fără USING)') ||
             '   ||WITH CHECK: ' ||
             COALESCE(pol.with_check, '—'), 400)::text              AS valoare,
        NULL::timestamptz                                           AS cand
    FROM pg_policies pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename  = 'grup_anunturi'
),

-- ── E. Membrii grupurilor ──────────────────────────────────────────────────
-- Ca să confirmi ce bănuim: nu ești membru în niciunul, deci o politică
-- „doar membrii" te lasă pe dinafară deși ești superadmin.
e_membri AS (
    SELECT
        'E. membri'::text                                           AS sectiune,
        (t.nume || ' · ' || m.status)::text                         AS detaliu,
        (COALESCE(p.pseudonym, '(fără profil)') ||
         ' <' || COALESCE(p.email, '—') || '>')::text               AS valoare,
        NULL::timestamptz                                           AS cand
    FROM public.grup_membri m
    JOIN tinta t ON t.id = m.grup_id
    LEFT JOIN public.profiles p ON p.user_id = m.user_id
),

-- ── F. A plecat digestul pentru grupurile astea? ───────────────────────────
-- Un rând aici = un email de digest chiar trimis. Dacă B are anunțuri și F e
-- gol, digestul le-a ratat și asta e a doua problemă, separată de vizibilitate.
f_digest AS (
    SELECT
        'F. digesturi trimise'::text                                AS sectiune,
        t.nume::text                                                AS detaliu,
        (l.numar_anunturi::text || ' anunțuri → ' ||
         l.numar_destinatari::text || ' destinatari')::text         AS valoare,
        l.trimis_la                                                 AS cand
    FROM public.grup_anunturi_digest_log l
    JOIN tinta t ON t.id = l.grup_id
),

-- ── G. Funcțiile-ajutor existente ──────────────────────────────────────────
-- Pentru reparație, dacă se confirmă că e RLS: vrem să știm dacă există deja o
-- funcție de tip `is_super_admin()` / `is_group_member()` cu `security definer`.
-- CONTEAZĂ: o politică nouă care citește DIRECT din `profiles` e exact tiparul
-- care a golit paginile de terenuri și parteneri pe 1 august (memoria
-- `politici-rls-citesc-direct-din-profiles`). Dacă funcția există, politica o
-- cheamă pe ea și nu mai atinge `profiles`.
g_functii AS (
    SELECT
        'G. funcții-ajutor'::text                                   AS sectiune,
        (p.proname || '(' || pg_get_function_arguments(p.oid) || ')')::text
                                                                    AS detaliu,
        (CASE WHEN p.prosecdef THEN 'security definer' ELSE 'security invoker' END ||
         '  ·  întoarce: ' || pg_get_function_result(p.oid))::text   AS valoare,
        NULL::timestamptz                                           AS cand
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname ILIKE '%super%admin%'
        OR p.proname ILIKE 'is_admin%'
        OR p.proname ILIKE '%group_member%'
        OR p.proname ILIKE '%grup_membru%')
),

-- ── Verdictul, scris în cuvinte ────────────────────────────────────────────
z_verdict AS (
    SELECT
        'Z. VERDICT'::text AS sectiune,
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM tinta)
                THEN 'N-am găsit grupurile după nume — schimbă filtrul din `tinta`'
            WHEN NOT EXISTS (SELECT 1 FROM public.grup_anunturi a
                             JOIN tinta t ON t.id = a.grup_id)
                THEN 'ANUNȚURILE NU EXISTĂ în aceste grupuri'
            ELSE 'ANUNȚURILE EXISTĂ — deci e o problemă de vizibilitate, nu de scriere'
        END::text AS detaliu,
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM tinta)
                THEN 'Caută grupurile lui Alin după admin, nu după nume.'
            WHEN NOT EXISTS (SELECT 1 FROM public.grup_anunturi a
                             JOIN tinta t ON t.id = a.grup_id)
                THEN 'Alin a scris în altă parte SAU postarea a eșuat tăcut. ' ||
                     'Uită-te la secțiunea C: dacă nici acolo nu e nimic recent, ' ||
                     'e de verificat butonul „Postează", nu RLS-ul.'
            ELSE 'Citește secțiunea D: politica de SELECT nu prevede superadminul.'
        END::text AS valoare,
        NULL::timestamptz AS cand
)

SELECT * FROM a_grupuri
UNION ALL SELECT * FROM b_anunturi
UNION ALL SELECT * FROM c_anunturi_recente
UNION ALL SELECT * FROM d_politici
UNION ALL SELECT * FROM e_membri
UNION ALL SELECT * FROM f_digest
UNION ALL SELECT * FROM g_functii
UNION ALL SELECT * FROM z_verdict
ORDER BY sectiune, cand DESC NULLS LAST;

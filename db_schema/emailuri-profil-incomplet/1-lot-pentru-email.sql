-- =============================================================================
-- 1. LOTUL PENTRU EMAIL  (un rând per persoană, gata de merge)
-- =============================================================================
-- Se rulează DUPĂ `0-bilant.sql`, în ziua trimiterii. Rezultatul se exportă cu
-- „Download CSV” și se dă scriptului din `scripts/emailuri-profil-incomplet/`.
--
-- Filtrele sunt EXACT cele din bilanț (CTE-ul `lot`). Dacă schimbi ceva aici,
-- schimbă și acolo, altfel cifra pe care te-ai uitat nu mai e lotul care pleacă.
--
-- COLOANELE PENTRU MERGE
--   email                  → destinatarul
--   nume                   → pseudonimul, cu spațiile de la capete tăiate
--                            (în baza de date sunt „Iulian ”, „Mihai ”). Poate
--                            fi gol: atunci emailul începe cu „Salut,” simplu.
--   inregistrat_text       → „12 martie 2026”, scris în română (TO_CHAR ar da
--                            luna în engleză, depinde de `lc_time` al serverului)
--   nr_lipsuri             → câte din cele 6 condiții lipsesc (1..6)
--   lipseste_pentru_email  → lista gata formatată, un rând per lipsă. Conține
--                            „\n”, deci în CSV iese între ghilimele — scriptul
--                            are parser care ține cont de asta.
--   apare_in_utilizatori   → 'da' / 'nu'. ⚠️ De asta depinde o frază din email.
--   notificat_iulie        → 'da' / 'nu' (după lista incompletă din capturi)
--
-- ⚠️ FRAZA CARE NU E ADEVĂRATĂ PENTRU TOȚI
-- „Nu apari la Utilizatori” e adevărată DOAR pentru cine n-are pseudonim.
-- Filtrul paginii (`js/utilizatori.js:186-188`) cere `account_type='activ'`,
-- `pseudonym IS NOT NULL` și `account_status` null sau 'active' — deci cine are
-- pseudonim dar n-are zone sau taguri APARE în listă, chiar dacă nu se poate
-- alătura niciunui grup. Coloana `apare_in_utilizatori` există ca scriptul să
-- pună fraza doar cui i se potrivește. Nu o scoate din CSV.
--
-- Rulează în: Supabase SQL Editor. Nu modifică nimic (doar SELECT).
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din `0-bilant.sql`.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',
              'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com',
              'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com',
              'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com',
              'livia.dila@yahoo.com'
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'
       OR LOWER(p.email) LIKE '%@ltfbstudio.ro'
),

dezabonati AS (
    SELECT LOWER(email) AS email
    FROM newsletter_subscribers
    WHERE status = 'unsubscribed'
),

notificati_iulie AS (
    SELECT LOWER(e) AS email FROM unnest(ARRAY[
        'vlad.radu@gmail.com',
        'cristian_punct@yahoo.com',
        'adrianrosv@gmail.com',
        'tventarnii.artur@gmail.com',
        'carmen2000ro@yahoo.com',
        'bogdancezarsapcaliu@gmail.com',
        'mihai.mitel.31@gmail.com',
        'mariusanisiei@gmail.com'
    ]) AS e
),

lot AS (
    SELECT
        p.user_id,
        LOWER(p.email)      AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        (p.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat,

        -- Cele ȘASE condiții ale funcției `profil_complet()`, desfăcute una câte
        -- una ca să putem spune omului ce anume lipsește. Scrise exact ca în
        -- funcție (vezi `securitate-grupuri/6-functii-join-cu-aprobare.sql`).
        (COALESCE(TRIM(p.pseudonym), '') <> '')                AS are_nume,
        (COALESCE(TRIM(p.preferred_rooms::text), '') <> '')    AS are_camere,
        (p.preferred_area_sqm IS NOT NULL)                     AS are_suprafata,
        (p.preferred_city_id  IS NOT NULL)                     AS are_oras,
        EXISTS (SELECT 1 FROM user_preferred_zones z WHERE z.user_id = p.user_id) AS are_zone,
        EXISTS (SELECT 1 FROM user_tags            t WHERE t.user_id = p.user_id) AS are_taguri,

        -- Apare sau nu în pagina Utilizatori — exact filtrul paginii.
        (p.pseudonym IS NOT NULL) AS apare_in_lista
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND public.profil_complet(p.user_id) = false      -- poarta reală, nu bara de progres
      AND u.email_confirmed_at IS NOT NULL              -- poate intra în cont
      AND (p.created_at AT TIME ZONE 'Europe/Bucharest')::date
          <= (now() AT TIME ZONE 'Europe/Bucharest')::date - 2
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
)

SELECT
    l.email,
    COALESCE(l.nume, '') AS nume,

    -- Data în română. Ordinea din CASE urmează lunile, nu alfabetul.
    EXTRACT(DAY FROM l.inregistrat)::int || ' ' ||
    CASE EXTRACT(MONTH FROM l.inregistrat)::int
        WHEN  1 THEN 'ianuarie'  WHEN  2 THEN 'februarie' WHEN  3 THEN 'martie'
        WHEN  4 THEN 'aprilie'   WHEN  5 THEN 'mai'       WHEN  6 THEN 'iunie'
        WHEN  7 THEN 'iulie'     WHEN  8 THEN 'august'    WHEN  9 THEN 'septembrie'
        WHEN 10 THEN 'octombrie' WHEN 11 THEN 'noiembrie' ELSE 'decembrie'
    END || ' ' || EXTRACT(YEAR FROM l.inregistrat)::int  AS inregistrat_text,

    ((NOT l.are_nume)::int + (NOT l.are_camere)::int + (NOT l.are_suprafata)::int
     + (NOT l.are_oras)::int + (NOT l.are_zone)::int + (NOT l.are_taguri)::int) AS nr_lipsuri,

    -- Lista de lipsuri, în ordinea în care apar câmpurile în formularul de
    -- profil, ca omul să le găsească de sus în jos fără să caute.
    ARRAY_TO_STRING(ARRAY_REMOVE(ARRAY[
        CASE WHEN NOT l.are_nume      THEN 'numele afișat (poate fi și un pseudonim)' END,
        CASE WHEN NOT l.are_oras      THEN 'orașul în care cauți' END,
        CASE WHEN NOT l.are_zone      THEN 'cel puțin o zonă din oraș' END,
        CASE WHEN NOT l.are_camere    THEN 'de câte camere ai vrea apartamentul' END,
        CASE WHEN NOT l.are_suprafata THEN 'ce suprafață cauți, aproximativ' END,
        CASE WHEN NOT l.are_taguri    THEN 'cel puțin un interes bifat' END
    ], NULL), E'\n')                                    AS lipseste_pentru_email,

    CASE WHEN l.apare_in_lista THEN 'da' ELSE 'nu' END  AS apare_in_utilizatori,
    CASE WHEN n.email IS NOT NULL THEN 'da' ELSE 'nu' END AS notificat_iulie,

    l.inregistrat   -- rămâne pentru sortare / verificare, scriptul n-o folosește

FROM lot l
LEFT JOIN notificati_iulie n ON n.email = l.email

ORDER BY
    nr_lipsuri DESC,      -- întâi cei mai „goi”
    l.inregistrat ASC;    -- apoi cei mai vechi

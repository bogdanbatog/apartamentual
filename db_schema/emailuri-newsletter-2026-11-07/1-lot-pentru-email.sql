-- =============================================================================
-- LOTUL pentru newsletterul din 7 noiembrie 2026 (articolul despre asociere)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor, ÎN ZIUA TRIMITERII. Doar SELECT, nu
-- modifică nimic. Rezultatul → Download CSV → îl dai scriptului
-- `scripts/emailuri-newsletter-2026-11-07/trimite-newsletter.js` cu `--csv=`.
--
-- Cine intră: EXACT aceleași reguli ca la newsletterul din 31 octombrie
-- (`db_schema/emailuri-newsletter-2026-10-31/1-lot-pentru-email.sql`):
--   A. toate conturile personale vii (activ, nesuspendat, email confirmat,
--      nedezabonat, nu e al casei, `account_type = 'activ'`)
--   B. PLUS abonații la newsletter CONFIRMAȚI care NU au niciun cont.
--
-- SINGURA DIFERENȚĂ față de 31 oct.: se scot și adresele din tabela
-- `emailuri_stop` (creată pe 4 nov. pentru emailul de bun venit; acolo se trece
-- de acum oricine răspunde „stop”). Dacă tabela e goală, nu schimbă nimic.
--
-- Coloanele `email`, `nume` și `sursa` le cere scriptul:
--   - `nume`  = pseudonimul (abonații fără cont n-au nume → „Salut,” simplu)
--   - `sursa` = 'cont' sau 'abonat' (schimbă fraza din subsol)
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din emailuri-newsletter-2026-10-31.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
       OR COALESCE(p.cont_intern, false)    = true
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
-- Cine nu mai vrea emailuri: dezabonații de la newsletter + cei care au
-- răspuns „stop” (tabela `emailuri_stop`, adresele sunt deja cu litere mici).
nu_vor AS (
    SELECT LOWER(email) AS email FROM newsletter_subscribers WHERE status = 'unsubscribed'
    UNION
    SELECT email FROM emailuri_stop
),

-- ── A. Conturile personale vii ──────────────────────────────────────────────
conturi AS (
    SELECT
        LOWER(p.email)                                          AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '')             AS nume,
        'cont'                                                  AS sursa,
        (u.created_at AT TIME ZONE 'Europe/Bucharest')::date    AS din
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      -- ⚠️ `account_status` e NULL la conturile vechi; NULL înseamnă activ.
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND u.email_confirmed_at IS NOT NULL
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND LOWER(p.email) NOT IN (SELECT email FROM nu_vor)
),

-- ── B. Abonații confirmați fără niciun cont ─────────────────────────────────
abonati AS (
    SELECT
        LOWER(n.email)                                          AS email,
        NULL::text                                              AS nume,
        'abonat'                                                AS sursa,
        (COALESCE(n.confirmed_at, n.consent_at) AT TIME ZONE 'Europe/Bucharest')::date AS din
    FROM newsletter_subscribers n
    WHERE n.status = 'confirmed'
      AND LOWER(n.email) NOT IN (SELECT LOWER(email) FROM profiles WHERE email IS NOT NULL)
      AND LOWER(n.email) NOT IN (SELECT LOWER(email) FROM auth.users WHERE email IS NOT NULL)
      AND LOWER(n.email) NOT IN (SELECT email FROM nu_vor)
      AND LOWER(n.email) NOT LIKE '%@ltfbstudio.ro'
      AND LOWER(n.email) NOT LIKE 'luta.lucian.m+%'
)

SELECT email, nume, sursa, din FROM conturi
UNION ALL
SELECT email, nume, sursa, din FROM abonati
ORDER BY sursa, din, email;

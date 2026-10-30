-- =============================================================================
-- LOTUL pentru newsletterul din 31 octombrie 2026 (Tübingen + grupul de WhatsApp)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor, ÎN ZIUA TRIMITERII. Doar SELECT, nu
-- modifică nimic. Rezultatul → Download CSV → îl dai scriptului
-- `scripts/emailuri-newsletter-2026-10-31/trimite-newsletter.js` cu `--csv=`.
--
-- Cine intră (decizia lui Lucian, 30 octombrie 2026, „varianta 1”):
--   A. toate conturile personale vii (aceleași filtre ca la campania WhatsApp
--      din 2 octombrie: activ, nesuspendat, email confirmat, nedezabonat, nu e
--      al casei, `account_type = 'activ'`)
--   B. PLUS abonații la newsletter CONFIRMAȚI care NU au niciun cont pe
--      platformă (nici măcar unul exclus: o agenție sau un cont suspendat care
--      s-a abonat cândva rămâne pe dinafară, ca să nu-l scoatem pe ușă și să-l
--      băgăm pe fereastră).
-- Fiecare adresă o singură dată: potrivirea se face pe LOWER(email), iar UNION
-- de mai jos nu poate da dubluri pentru că B exclude tot ce are cont.
-- Scriptul verifică oricum dublurile și se oprește dacă găsește vreuna.
--
-- Cine NU intră:
--   - abonații `pending` (n-au confirmat adresa) și `unsubscribed`
--   - oamenii casei (aceeași listă ca la campaniile dinainte; ⚠️ nu prinde
--     Gmail-urile personale, lista se citește cu ochiul în previzualizare)
--
-- Coloanele `email`, `nume` și `sursa` le cere scriptul:
--   - `nume`  = pseudonimul (abonații fără cont n-au nume → „Salut,” simplu)
--   - `sursa` = 'cont' sau 'abonat' (schimbă fraza din subsol: de ce primești
--               emailul)
-- Cine a primit deja invitația în grupul de WhatsApp NU se decide aici, ci în
-- script, din jurnalele campaniilor „trezire” și „whatsapp-general”.
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din emailuri-whatsapp-general/1-lot-pentru-email.sql.
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
dezabonati AS (
    SELECT LOWER(email) AS email FROM newsletter_subscribers WHERE status = 'unsubscribed'
),

-- ── A. Conturile personale vii ──────────────────────────────────────────────
conturi AS (
    SELECT
        LOWER(p.email)                                          AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '')             AS nume,
        'cont'                                                  AS sursa,
        -- Ziua la ora României, nu UTC.
        (u.created_at AT TIME ZONE 'Europe/Bucharest')::date    AS din
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      -- ⚠️ `account_status` e NULL la conturile vechi; NULL înseamnă activ.
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND u.email_confirmed_at IS NOT NULL
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
),

-- ── B. Abonații confirmați fără niciun cont ─────────────────────────────────
abonati AS (
    SELECT
        LOWER(n.email)                                          AS email,
        NULL::text                                              AS nume,
        'abonat'                                                AS sursa,
        -- `created_at` nu e sigur că există (migrația 023 nu e în repo);
        -- `confirmed_at` și `consent_at` le scriu funcțiile de abonare.
        (COALESCE(n.confirmed_at, n.consent_at) AT TIME ZONE 'Europe/Bucharest')::date AS din
    FROM newsletter_subscribers n
    WHERE n.status = 'confirmed'
      AND LOWER(n.email) NOT IN (SELECT LOWER(email) FROM profiles WHERE email IS NOT NULL)
      AND LOWER(n.email) NOT IN (SELECT LOWER(email) FROM auth.users WHERE email IS NOT NULL)
      -- Adresele casei pe care le-am putea avea abonate din teste.
      AND LOWER(n.email) NOT LIKE '%@ltfbstudio.ro'
      AND LOWER(n.email) NOT LIKE 'luta.lucian.m+%'
)

SELECT email, nume, sursa, din FROM conturi
UNION ALL
SELECT email, nume, sursa, din FROM abonati
ORDER BY sursa, din, email;

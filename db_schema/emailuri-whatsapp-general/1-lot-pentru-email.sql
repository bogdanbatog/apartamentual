-- =============================================================================
-- LOTUL pentru emailul „grupul general de WhatsApp” (octombrie 2026)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor, ÎN ZIUA TRIMITERII. Doar SELECT, nu
-- modifică nimic. Rezultatul → Download CSV → îl dai scriptului
-- `scripts/emailuri-whatsapp-general/trimite-emailuri-whatsapp.js` cu `--csv=`.
--
-- Cine intră (decizia lui Lucian, 1 octombrie 2026): „restul de pe platformă”,
-- adică TOATE conturile vii, indiferent dacă sunt sau nu într-un grup:
--   - cont viu: activ, nesuspendat, email confirmat, nedezabonat, nu e al casei
--   - cont personal (`account_type = 'activ'`); agențiile (`profesional`) nu
--   - cu sau fără profil complet, vechi sau proaspăt (emailul nu reproșează
--     nimic, deci nu e nevoie de pragul de 30 de zile de la „trezire”)
--
-- Cei 41 care au primit deja emailul de „trezire” pe 1 octombrie (și care aveau
-- deja invitația în el) NU se scot aici, ci în script: scriptul citește
-- jurnalul `scripts/emailuri-trezire/local/trimise-*.json` și îi sare.
--
-- Coloanele `email`, `nume` și `in_grup` le cere scriptul (`in_grup` alege
-- fraza în plus pentru cei care sunt deja într-un grup). Restul sunt doar de
-- citit cu ochiul.
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din emailuri-trezire/0-analiza-adormiti.sql.
    -- ⚠️ Nu prinde oamenii casei cu Gmail personal; lista se citește cu ochiul.
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
in_grup AS (
    -- Fondatorii grupurilor nearhivate, plus membrii activi. Cererile în
    -- așteptare NU contează aici: omul nu e încă în grup, deci nu primește
    -- fraza „dacă ești deja într-un grup”.
    SELECT admin_id AS user_id FROM grupuri
    WHERE status IS DISTINCT FROM 'arhivat' AND admin_id IS NOT NULL
    UNION
    SELECT user_id FROM grup_membri WHERE status = 'activ'
)

SELECT
    LOWER(p.email)                                              AS email,
    NULLIF(TRIM(COALESCE(p.pseudonym, '')), '')                 AS nume,
    (p.user_id IN (SELECT user_id FROM in_grup))                AS in_grup,
    public.profil_complet(p.user_id)                            AS profil_complet,
    -- Ziua la ora României, nu UTC (o înscriere de noapte ar ieși cu o zi în urmă).
    (u.created_at AT TIME ZONE 'Europe/Bucharest')::date        AS cont_din,
    EXTRACT(DAY FROM NOW() - u.last_sign_in_at)::int            AS zile_de_la_logare
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.account_type = 'activ'
  -- ⚠️ `account_status` e NULL la conturile vechi; NULL înseamnă activ.
  AND (p.account_status IS NULL OR p.account_status = 'active')
  AND u.email_confirmed_at IS NOT NULL
  AND p.user_id NOT IN (SELECT user_id FROM exclusi)
  AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
ORDER BY in_grup DESC, cont_din, email;

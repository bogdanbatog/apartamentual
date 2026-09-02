-- =============================================================================
-- 1. LOTUL PENTRU EMAIL  „memento webinar, 3 septembrie 2026" (un rând per om)
-- =============================================================================
-- Se rulează DUPĂ `0-bilant.sql`, în ziua trimiterii. Rezultatul se exportă cu
-- „Download CSV" și se dă scriptului din `scripts/emailuri-webinar-septembrie/`.
--
-- Filtrele sunt EXACT cele din bilanț. Dacă schimbi ceva aici, schimbă și acolo.
--
-- COLOANELE PENTRU MERGE
--   email  → destinatarul
--   nume   → pseudonimul, cu spațiile de la capete tăiate. Poate fi gol:
--            atunci emailul începe cu „Salut," simplu.
--
-- ⚠️ DE CE ARE EMAILUL O SINGURĂ VARIANTĂ (spre deosebire de campania din 25
-- august, care avea patru): butonul duce la Luma, în afara platformei. Nu contează
-- dacă omul are profilul terminat, grup sau teren, fiindcă nu-l trimitem nicăieri
-- pe site. La webinar se intră cu un link, nu cu un cont. De aceea nu exportăm
-- `profil_complet`, `are_grup` și `are_teren`: coloane pe care scriptul nu le
-- folosește sunt doar încă un lucru care poate ieși greșit.
--
-- ⚠️ Lista de înscriși la webinar e la Luma, NU în baza noastră. Deci NU putem
-- scoate din lot pe cine s-a înscris deja. Emailul are în final o frază care
-- rezolvă asta („dacă te-ai înscris deja, ne vedem mâine").
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
    SELECT LOWER(email) AS email
    FROM newsletter_subscribers
    WHERE status = 'unsubscribed'
),

lot AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        p.created_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      -- ⚠️ `account_status` poate fi NULL pe conturile vechi. Un filtru scris
      -- strict `= 'active'` sare tăcut peste oamenii aceia.
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND u.email_confirmed_at IS NOT NULL
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
)

SELECT
    l.email,
    COALESCE(l.nume, '') AS nume,

    -- Rămâne doar pentru citit cu ochiul înainte de trimitere. Scriptul n-o
    -- folosește. Ora e mutată la București: `created_at` e în UTC, iar un cont
    -- făcut noaptea ar apărea cu ziua de dinainte.
    (l.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat

FROM lot l
ORDER BY l.created_at ASC;   -- întâi cei mai vechi

-- =============================================================================
-- 4. LOTUL pentru emailul de trezire (exportul care intră în script)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor, ÎN ZIUA TRIMITERII. Doar SELECT, nu
-- modifică nimic. Rezultatul → Download CSV → îl dai scriptului
-- `scripts/emailuri-trezire/trimite-emailuri-trezire.js` cu `--csv=`.
--
-- Cine intră (decizia lui Lucian, 1 octombrie 2026):
--   - cont viu: activ, nesuspendat, email confirmat, nedezabonat, nu e al casei
--   - profil COMPLET (emailul îi mulțumește că și l-a completat; celor cu
--     profil incomplet le scrie campania `emailuri-profil-incomplet`)
--   - în NICIUN grup: nici fondator, nici membru activ, nici cerere în așteptare
--   - cont mai vechi de 30 de zile. Cei proaspeți abia au venit; un „nu te-am
--     mai văzut de atunci” le-ar suna a reproș după câteva zile.
--
-- La analiza din septembrie lotul era 44 - 5 proaspeți = cam 39. Dacă iese
-- mult diferit, oprește-te și vezi de ce înainte de trimitere.
--
-- Coloanele `email` și `nume` le cere scriptul. `cont_din` o verifică scriptul
-- (refuză orice rând mai nou de 30 de zile). Restul sunt doar de citit cu ochiul.
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din 0-analiza-adormiti.sql.
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
    -- Fondatorii grupurilor nearhivate...
    SELECT admin_id AS user_id FROM grupuri
    WHERE status IS DISTINCT FROM 'arhivat' AND admin_id IS NOT NULL
    UNION
    -- ...plus membrii activi și cei care au cerut și așteaptă aprobarea.
    SELECT user_id FROM grup_membri WHERE status IN ('activ', 'pending')
),
likeuri AS (
    SELECT user_id, COUNT(*) AS n FROM terenuri_likes GROUP BY user_id
)

SELECT
    LOWER(p.email)                                              AS email,
    NULLIF(TRIM(COALESCE(p.pseudonym, '')), '')                 AS nume,
    -- Ziua la ora României, nu UTC (o înscriere de noapte ar ieși cu o zi în urmă).
    (u.created_at AT TIME ZONE 'Europe/Bucharest')::date        AS cont_din,
    EXTRACT(DAY FROM NOW() - u.last_sign_in_at)::int            AS zile_de_la_logare,
    COALESCE(lk.n, 0)                                           AS likeuri
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN likeuri lk ON lk.user_id = p.user_id
WHERE p.account_type = 'activ'
  -- ⚠️ `account_status` e NULL la conturile vechi; NULL înseamnă activ.
  AND (p.account_status IS NULL OR p.account_status = 'active')
  AND u.email_confirmed_at IS NOT NULL
  AND p.user_id NOT IN (SELECT user_id FROM exclusi)
  AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
  AND p.user_id NOT IN (SELECT user_id FROM in_grup)
  AND public.profil_complet(p.user_id)
  -- Cei 5 proaspeți (și oricine s-a înscris de atunci) rămân pe dinafară.
  AND u.created_at < NOW() - INTERVAL '30 days'
ORDER BY cont_din, email;

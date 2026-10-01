-- =============================================================================
-- 2. „DE CE nu fac nimic" - zonele lor, terenurile din zone, emailurile primite
-- =============================================================================
-- Se rulează în Supabase → SQL Editor. Doar SELECT, nu modifică nimic.
--
-- Întrebarea la care răspunde: cei 40+ de oameni cu profil complet, cu zone
-- alese și fără niciun grup, au avut CE să facă pe platformă?
--   - dacă în zonele lor n-avem terenuri, platforma li se pare goală, pe drept
--   - dacă n-au primit niciodată digestul de luni, n-au avut de unde ști
--   - dacă au și terenuri, și emailuri, și tot n-au apăsat nimic, atunci
--     problema e mesajul, nu oferta, și asta schimbă textul emailului
--
-- ⚠️ Potrivirea teren ↔ zonă se face pe TEXT (`terenuri.cartier` = `zones.name`,
--    lower + btrim), exact ca în funcția digestului. Un diacritic diferit rupe
--    legătura în tăcere, deci o coloană `terenuri_in_zonele_lui = 0` poate
--    însemna și „zona n-are teren", și „numele nu se potrivește".
-- =============================================================================

WITH exclusi AS (
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
fondatori AS (
    SELECT DISTINCT admin_id AS user_id FROM grupuri
    WHERE status IS DISTINCT FROM 'arhivat' AND admin_id IS NOT NULL
),
membri AS (
    SELECT DISTINCT user_id FROM grup_membri WHERE status IN ('activ', 'pending')
),

-- Oamenii din C și D: profil complet, zone alese sau like-uri, niciun grup.
tinta AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        u.last_sign_in_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND u.email_confirmed_at IS NOT NULL
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
      AND p.user_id NOT IN (SELECT user_id FROM fondatori)
      AND p.user_id NOT IN (SELECT user_id FROM membri)
      AND public.profil_complet(p.user_id)
),

-- Zonele fiecăruia, scrise una lângă alta, ca să le putem citi cu ochiul.
zonele_lui AS (
    SELECT
        upz.user_id,
        COUNT(*)                          AS nr_zone,
        STRING_AGG(z.name, ', ' ORDER BY z.name) AS zone
    FROM user_preferred_zones upz
    JOIN zones z ON z.id = upz.zone_id
    GROUP BY upz.user_id
),

-- Câte terenuri publicate cad în zonele lui, cu aceeași potrivire pe text
-- pe care o face digestul de luni.
terenuri_in_zone AS (
    SELECT
        upz.user_id,
        COUNT(DISTINCT t.id) AS nr_terenuri
    FROM user_preferred_zones upz
    JOIN zones z    ON z.id = upz.zone_id
    JOIN terenuri t ON LOWER(BTRIM(t.cartier)) = LOWER(BTRIM(z.name))
    WHERE t.status = 'approved'
    GROUP BY upz.user_id
),

-- Emailul de luni cu terenuri noi: câte i-au plecat și când a fost ultimul.
digest AS (
    SELECT
        user_id,
        COUNT(*)           AS digesturi,
        MAX(trimis_la)     AS ultimul_digest,
        SUM(nr_terenuri)   AS terenuri_anuntate
    FROM terenuri_digest_log
    GROUP BY user_id
),

-- Like-urile, ca să deosebim C (a căutat) de D (s-a oprit după profil).
likeuri AS (
    SELECT user_id, COUNT(*) AS n FROM terenuri_likes GROUP BY user_id
)

SELECT
    t.nume,
    t.email,
    COALESCE(lk.n, 0)                                       AS likeuri,
    COALESCE(zl.nr_zone, 0)                                 AS nr_zone,
    COALESCE(tz.nr_terenuri, 0)                             AS terenuri_in_zonele_lui,
    COALESCE(d.digesturi, 0)                                AS emailuri_de_luni_primite,
    COALESCE(d.terenuri_anuntate, 0)                        AS terenuri_anuntate_total,
    (d.ultimul_digest AT TIME ZONE 'Europe/Bucharest')::date AS ultimul_email_de_luni,
    EXTRACT(DAY FROM NOW() - t.last_sign_in_at)::int        AS zile_de_la_logare,
    zl.zone
FROM tinta t
LEFT JOIN zonele_lui      zl ON zl.user_id = t.user_id
LEFT JOIN terenuri_in_zone tz ON tz.user_id = t.user_id
LEFT JOIN digest          d  ON d.user_id  = t.user_id
LEFT JOIN likeuri         lk ON lk.user_id = t.user_id
ORDER BY
    COALESCE(tz.nr_terenuri, 0) ASC,   -- întâi cei cărora platforma li se pare goală
    COALESCE(d.digesturi, 0) ASC,
    t.nume NULLS LAST;

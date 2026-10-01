-- =============================================================================
-- 1. LISTA NOMINALĂ a celor fără grup (de citit cu ochiul, înainte de orice email)
-- =============================================================================
-- Se rulează DUPĂ `0-analiza-adormiti.sql`, în Supabase → SQL Editor.
-- NU modifică nimic, doar SELECT. Nu e încă lotul de trimitere: e lista pe care
-- o citim ca să vedem cine sunt oamenii, nu doar câți sunt.
--
-- La ce te uiți:
--   - adrese de-ale casei sau de mail temporar pe care filtrul nu le-a prins
--   - oameni pe care îi cunoști personal (pe ei îi suni, nu le trimiți email)
--   - `profil_ok = false`: pentru ei butonul „intră într-un grup" nu merge
--   - `zile_de_la_logare` NULL înseamnă că nu s-a logat niciodată după înscriere
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
lot AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        u.created_at,
        u.last_sign_in_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND u.email_confirmed_at IS NOT NULL
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
),
fondatori AS (
    SELECT DISTINCT admin_id AS user_id FROM grupuri
    WHERE status IS DISTINCT FROM 'arhivat' AND admin_id IS NOT NULL
),
membri_activi AS (
    SELECT DISTINCT user_id FROM grup_membri WHERE status = 'activ'
),
cereri AS (
    SELECT DISTINCT user_id FROM grup_membri WHERE status = 'pending'
),
likeuri   AS (SELECT user_id, COUNT(*) AS n FROM terenuri_likes GROUP BY user_id),
zone_alese AS (SELECT user_id, COUNT(*) AS n FROM user_preferred_zones GROUP BY user_id),
vizite    AS (SELECT user_id, MAX(vazut_la) AS ultima FROM grup_vizite GROUP BY user_id)

SELECT
    CASE
        WHEN l.user_id IN (SELECT user_id FROM cereri) THEN 'B. asteapta aprobarea'
        WHEN COALESCE(lk.n, 0) > 0                     THEN 'C. like-uri, fara grup'
        WHEN COALESCE(z.n, 0)  > 0                     THEN 'D. doar zone alese'
        ELSE                                                'E. adormit complet'
    END                                                        AS segment,
    l.nume,
    l.email,
    public.profil_complet(l.user_id)                           AS profil_ok,
    COALESCE(lk.n, 0)                                          AS likeuri,
    COALESCE(z.n, 0)                                           AS zone,
    -- Datele se arată la ora României, nu UTC (altfel o înscriere de noapte
    -- apare cu ziua de ieri).
    (l.created_at AT TIME ZONE 'Europe/Bucharest')::date        AS cont_din,
    EXTRACT(DAY FROM NOW() - l.last_sign_in_at)::int            AS zile_de_la_logare,
    (v.ultima AT TIME ZONE 'Europe/Bucharest')::date            AS ultima_pagina_de_grup
FROM lot l
LEFT JOIN likeuri    lk ON lk.user_id = l.user_id
LEFT JOIN zone_alese z  ON z.user_id  = l.user_id
LEFT JOIN vizite     v  ON v.user_id  = l.user_id
-- Îi scoatem pe cei care sunt deja într-un grup: pe ei nu-i trezim.
WHERE l.user_id NOT IN (SELECT user_id FROM fondatori)
  AND l.user_id NOT IN (SELECT user_id FROM membri_activi)
ORDER BY segment, zile_de_la_logare DESC NULLS FIRST;

-- =============================================================================
-- 5. CONTROL: cine a fost sarit si de ce  (optional, dupa fisierul 4)
-- =============================================================================
-- Selecteaza TOT fisierul si apasa Run. O singura interogare. Doar SELECT.
--
-- Iti arata cati oameni ar fi avut o potrivire dar au picat pragul de 12 zone
-- bifate, ca sa stii ce lasi pe masa si sa poti ajusta pragul in cunostinta de
-- cauza (nu ghicind).
--
-- CUM CITESTI:
--   `intra_in_lot`            — cati primesc email (= randurile din fisierul 4)
--   `sariti_prea_multe_zone`  — cati au potrivire dar au bifat peste 12 zone
--   `cel_mai_imprastiat`      — cate zone are bifate cel mai "lacom" dintre ei
--
-- Daca `sariti_prea_multe_zone` iese mare si te deranjeaza, ridica pragul in
-- fisierul 4 (blocul `parametri`) si re-ruleaza si aici, cu aceeasi valoare.
-- =============================================================================

WITH parametri AS (
    -- ⚠️ Tine valorile astea IDENTICE cu cele din fisierul 4, altfel compari
    --    doua loturi diferite si cifrele nu se leaga intre ele.
    SELECT (DATE '2026-07-30')::timestamp AT TIME ZONE 'Europe/Bucharest' AS de_la,
           12 AS prag_zone
),
useri_exclusi AS (
    SELECT p.user_id FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false) = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com', 'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com', 'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com', 'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com', 'livia.dila@yahoo.com')
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'
),
useri_reali AS (
    SELECT p.user_id, p.email FROM profiles p
    WHERE p.account_type = 'activ' AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
zone_cu_terenuri AS (
    SELECT z.id AS zone_id, COUNT(DISTINCT t.id) AS nr_terenuri
    FROM terenuri t
    CROSS JOIN parametri par
    JOIN cities c ON lower(btrim(c.name)) = lower(btrim(t.oras))
    JOIN zones  z ON lower(btrim(z.name)) = lower(btrim(t.cartier))
                 AND z.city_id = c.id
    WHERE t.created_at >= par.de_la
      AND t.deleted_at IS NULL
      AND t.status = 'approved'
    GROUP BY z.id
),
total_zone_per_user AS (
    SELECT upz.user_id, COUNT(*) AS nr_zone_bifate
    FROM user_preferred_zones upz GROUP BY upz.user_id
),
cu_potrivire AS (
    SELECT DISTINCT u.user_id, tz.nr_zone_bifate
    FROM useri_reali u
    JOIN user_preferred_zones upz ON upz.user_id = u.user_id
    JOIN zone_cu_terenuri zct     ON zct.zone_id = upz.zone_id
    JOIN total_zone_per_user tz   ON tz.user_id = u.user_id
)
SELECT
    COUNT(*) FILTER (WHERE cp.nr_zone_bifate <= par.prag_zone) AS intra_in_lot,
    COUNT(*) FILTER (WHERE cp.nr_zone_bifate >  par.prag_zone) AS sariti_prea_multe_zone,
    COUNT(*)                                                   AS total_cu_potrivire,
    MAX(cp.nr_zone_bifate)                                     AS cel_mai_imprastiat
FROM cu_potrivire cp
CROSS JOIN parametri par
GROUP BY par.prag_zone;

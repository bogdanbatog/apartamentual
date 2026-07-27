-- =============================================================================
-- 3. LISTA DE EMAILURI pe zonele-tinta  (detaliat, cu prioritizare)
-- =============================================================================
-- Scop: cine sunt oamenii din zonele fara grup, cu datele necesare pentru
--       personalizare si pentru a alege cui merita sa-i scriem "porneste tu".
--
-- ⚠️ INAINTE DE RULARE: actualizeaza lista de zone din blocul `zone_tinta`
--    cu ce a iesit la interogarea 1 (cifrele se schimba de la o saptamana la alta).
--
-- Coloane utile:
--   oameni_in_zona = cati sunt interesati de zona (numarul care intra in email)
--   zone_bifate    = cate zone are userul in total
--                    1-3 zone  = interes concentrat -> cel mai bun initiator
--                    20+ zone  = a bifat aproape tot orasul -> semnal slab
--   deja_in_grup   = e deja membru activ intr-un grup (alt mesaj, sau il sarim)
--   vechime_zile   = de cat timp are cont
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

WITH useri_exclusi AS (
    -- Echipa + prietenii cu cont de test, dupa email (vezi 1c, 27 iulie).
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false) = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',      -- Fabian (superadmin)
              'lucianluta@yahoo.com',        -- Lucian (superadmin)
              'luta.lucian.m@gmail.com',     -- Lucian LM
              'cotofana.carmen@yahoo.com',   -- Carmen (cont de test)
              'carmen2000ro@yahoo.com',      -- Carmen, al doilea cont
              'raluca.ivanov26@gmail.com',   -- Raluca (cont 'deleted')
              'tiberiu.abc.maxim@gmail.com', -- Tibs (cont de test)
              'livia.dila@yahoo.com'         -- Livia
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'  -- aliasurile +testN
),
useri_reali AS (
    SELECT p.user_id, p.email, p.pseudonym, p.first_name, p.created_at
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
zone_tinta AS (
    SELECT z.id, z.name, c.name AS oras
    FROM zones z
    LEFT JOIN cities c ON c.id = z.city_id
    WHERE c.name = 'București'
      AND z.name IN (
          -- Lista la zi: 27 iulie 2026, dupa rezultatul interogarii 1.
          -- Toate zonele fara grup cu cel putin 10 oameni interesati.
          -- Numele trebuie sa fie IDENTICE cu cele din tabelul `zones`
          -- (atentie la spatiile din jurul barei: 'Primăverii / Dorobanți').
          'Tineretului',            -- 20
          'Primăverii / Dorobanți', -- 16
          'Domenii',                -- 14
          'Aviației',               -- 12
          'Zona Centru Nord',       -- 12
          'Iancului',               -- 11
          'Uranus',                 -- 11
          'Obor'                    -- 10
          -- urmatoarele, la pragul 8: '1 Mai', 'Kiseleff', 'Politehnica'
      )
),
nr_zone_per_user AS (
    SELECT user_id, COUNT(*) AS zone_bifate
    FROM user_preferred_zones
    GROUP BY user_id
),
membri_activi AS (
    SELECT DISTINCT gm.user_id
    FROM grup_membri gm
    JOIN grupuri g ON g.id = gm.grup_id
    WHERE gm.status = 'activ'
      AND COALESCE(g.is_demo, false) = false
      AND COALESCE(g.status, '') <> 'arhivat'
),
cerere_zona AS (
    SELECT upz.zone_id, COUNT(DISTINCT upz.user_id) AS oameni_in_zona
    FROM user_preferred_zones upz
    JOIN useri_reali u ON u.user_id = upz.user_id
    GROUP BY upz.zone_id
)
SELECT
    zt.oras,
    zt.name                                     AS zona,
    cz.oameni_in_zona,
    u.pseudonym,
    u.first_name,
    u.email,
    nz.zone_bifate,
    (ma.user_id IS NOT NULL)                    AS deja_in_grup,
    DATE_PART('day', NOW() - u.created_at)::int AS vechime_zile
FROM user_preferred_zones upz
JOIN zone_tinta  zt ON zt.id = upz.zone_id
JOIN useri_reali u  ON u.user_id = upz.user_id
JOIN cerere_zona cz ON cz.zone_id = upz.zone_id
LEFT JOIN nr_zone_per_user nz ON nz.user_id = u.user_id
LEFT JOIN membri_activi   ma ON ma.user_id = u.user_id
ORDER BY cz.oameni_in_zona DESC, zt.name, nz.zone_bifate ASC, u.created_at ASC;

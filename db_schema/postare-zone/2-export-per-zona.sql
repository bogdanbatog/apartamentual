-- =============================================================================
-- 2. EXPORT: UN RAND PER ZONA  (sursa principala pentru postarea publica)
-- =============================================================================
-- Coloane: oras, zona, cati utilizatori REALI au bifat-o, daca are grup activ.
-- Ordonat descrescator dupa numarul de utilizatori.
--
-- Agregat, fara date personale -- acesta e CSV-ul din care se scriu cifrele
-- publice. Spre deosebire de analiza-zone/1-zone-fara-grup.sql, aici NU exista
-- prag minim si NU se filtreaza zonele cu grup: apar toate zonele bifate, cu o
-- coloana DA/NU pentru grup.
--
-- "grup activ" = grup real (is_demo = false) si nearhivat (status <> 'arhivat'),
-- aceeasi definitie ca in analiza precedenta.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- Export: butonul "Download CSV".
-- =============================================================================

WITH useri_exclusi AS (
    -- Identic cu 1-export-per-utilizator.sql. Vezi comentariile de acolo.
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
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'
),
useri_reali AS (
    SELECT p.user_id
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
zone_cu_grup AS (
    -- Zonele care au cel putin un grup real, nearhivat.
    SELECT DISTINCT gpz.zone_id
    FROM grup_preferred_zones gpz
    JOIN grupuri g ON g.id = gpz.grup_id
    WHERE COALESCE(g.is_demo, false) = false
      AND COALESCE(g.status, '') <> 'arhivat'
)
SELECT
    COALESCE(c.name, '(fara oras)')  AS oras,
    z.name                           AS zona,
    COUNT(DISTINCT upz.user_id)      AS utilizatori_reali,
    CASE WHEN zg.zone_id IS NOT NULL THEN 'DA' ELSE 'NU' END AS are_grup_activ
FROM zones z
-- JOIN pe useri_reali direct in ON: asa numaram DOAR bifele utilizatorilor reali.
-- Daca filtrul ar sta in WHERE, zonele bifate exclusiv de conturi de test ar
-- disparea complet in loc sa apara cu 0.
LEFT JOIN user_preferred_zones upz
       ON upz.zone_id = z.id
      AND EXISTS (SELECT 1 FROM useri_reali u WHERE u.user_id = upz.user_id)
LEFT JOIN cities c       ON c.id = z.city_id
LEFT JOIN zone_cu_grup zg ON zg.zone_id = z.id
GROUP BY c.name, z.name, zg.zone_id
-- Zonele cu 0 utilizatori reali raman in lista, intentionat: arata si ce NU se
-- cauta, util cand scrii postarea. Ca sa le scoti, decomenteaza:
-- HAVING COUNT(DISTINCT upz.user_id) > 0
ORDER BY utilizatori_reali DESC, zona;

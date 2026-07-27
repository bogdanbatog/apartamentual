-- =============================================================================
-- 2. CONTEXT: zonele care AU deja grup
-- =============================================================================
-- Scop: sa vedem ce e deja acoperit, ca sa nu trimitem "porneste un grup"
--       acolo unde exista deja unul.
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT
    c.name                             AS oras,
    z.name                             AS zona,
    COUNT(DISTINCT g.id)               AS grupuri_existente,
    STRING_AGG(DISTINCT g.nume, ' | ') AS nume_grupuri
FROM grup_preferred_zones gpz
JOIN grupuri g ON g.id = gpz.grup_id
JOIN zones  z ON z.id = gpz.zone_id
LEFT JOIN cities c ON c.id = z.city_id
WHERE COALESCE(g.is_demo, false) = false
  AND COALESCE(g.status, '') <> 'arhivat'
GROUP BY c.name, z.name
ORDER BY grupuri_existente DESC, zona;

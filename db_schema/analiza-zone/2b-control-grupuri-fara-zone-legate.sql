-- =============================================================================
-- 2b. CONTROL DE SIGURANTA  (ruleaza-l, e important)
-- =============================================================================
-- De ce exista: tabelul `grupuri` are si o coloana text `zona` (folosita doar la
-- afisare, in js/grupuri.js), pe langa tabelul de legatura `grup_preferred_zones`.
-- Daca un grup are completat DOAR textul, fara randuri in grup_preferred_zones,
-- interogarea 1 nu il "vede" si am declara gresit "zona fara grup" o zona care
-- are deja unul.
--
-- Cum se citeste rezultatul:
--   REZULTAT GOL  -> analiza 1 e curata, mergem mai departe.
--   ARE RANDURI   -> notam zonele din coloana `zona_text` si le scoatem manual
--                    din lista de trimitere (sau legam zonele corect in grup).
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT
    g.id,
    g.nume,
    g.oras,
    g.zona             AS zona_text,
    COUNT(gpz.zone_id) AS randuri_zone_legate
FROM grupuri g
LEFT JOIN grup_preferred_zones gpz ON gpz.grup_id = g.id
WHERE COALESCE(g.is_demo, false) = false
  AND COALESCE(g.status, '') <> 'arhivat'
GROUP BY g.id, g.nume, g.oras, g.zona
HAVING COUNT(gpz.zone_id) = 0
ORDER BY g.nume;

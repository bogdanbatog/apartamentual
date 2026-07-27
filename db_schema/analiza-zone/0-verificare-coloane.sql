-- =============================================================================
-- 0. VERIFICARE COLOANE  (ruleaza PRIMUL)
-- =============================================================================
-- Scop: confirmam ca numele coloanelor folosite in interogarile 1-4 exista
--       chiar asa in baza de date. Daca lipseste ceva, corectam inainte.
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'zones', 'cities', 'user_preferred_zones',
                     'grupuri', 'grup_preferred_zones', 'grup_membri')
ORDER BY table_name, ordinal_position;

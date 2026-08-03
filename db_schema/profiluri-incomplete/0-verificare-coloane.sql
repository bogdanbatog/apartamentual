-- =============================================================================
-- 0. VERIFICARE COLOANE  (ruleaza asta INTAI)
-- =============================================================================
-- De ce: interogarea 1 numara campurile completate din profil. Daca o coloana
-- se numeste altfel decat cred eu (am dedus numele din formularul de profil,
-- `js/profile-edit-new.js`, nu din baza de date), interogarea 1 crapa cu
-- "column does not exist" si nu intelegi de ce.
--
-- Ce astept sa vad, 9 randuri:
--   pseudonym, profession, phone, age, preferred_rooms, preferred_area_sqm,
--   preferred_city_id, description, email
--
-- Daca lipseste vreunul din lista, spune-mi care si corectez interogarea 1.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'profiles'
  AND column_name IN (
        'pseudonym', 'profession', 'phone', 'age',
        'preferred_rooms', 'preferred_area_sqm', 'preferred_city_id',
        'description', 'email', 'oras'
      )
ORDER BY column_name;

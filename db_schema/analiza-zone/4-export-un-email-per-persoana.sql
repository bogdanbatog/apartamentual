-- =============================================================================
-- 4. EXPORT FINAL pentru trimitere  (un singur rand per persoana)
-- =============================================================================
-- Scop: lista efectiva de trimis. Cine a bifat mai multe zone-tinta primeste UN
--       singur email, pentru zona cu cea mai mare cerere — nu trei emailuri.
--
-- Spre deosebire de interogarea 3, aici zonele NU se scriu manual: se calculeaza
-- automat toate zonele fara grup care au cel putin 8 oameni interesati.
-- Pragul se poate schimba la linia marcata mai jos.
--
-- Rezultatul se exporta din Supabase (butonul Download CSV) si se foloseste
-- ca sursa de merge pentru email (`{{prenume}}`, `{{zona}}`, `{{numar}}`).
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

WITH useri_exclusi AS (
    -- Echipa + prietenii cu cont de test, dupa email (vezi 1c, 27 iulie).
    -- Aici conteaza de doua ori: nu doar ca umfla cifra din email, dar ne-am
    -- trimite noi noua emailul "porneste un grup".
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
    SELECT p.user_id, p.email, p.pseudonym, p.first_name
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
zone_cu_grup AS (
    SELECT DISTINCT gpz.zone_id
    FROM grup_preferred_zones gpz
    JOIN grupuri g ON g.id = gpz.grup_id
    WHERE COALESCE(g.is_demo, false) = false
      AND COALESCE(g.status, '') <> 'arhivat'
),
cerere_zona AS (
    SELECT upz.zone_id, COUNT(DISTINCT upz.user_id) AS oameni_in_zona
    FROM user_preferred_zones upz
    JOIN useri_reali u ON u.user_id = upz.user_id
    WHERE NOT EXISTS (SELECT 1 FROM zone_cu_grup zg WHERE zg.zone_id = upz.zone_id)
    GROUP BY upz.zone_id
    -- ⬅️ PRAGUL. La 9, dupa rularea din 27 iulie 2026 (cifre fara echipa si fara
    --    conturile de test), intra exact 8 zone:
    --      Tineretului 20, Primăverii / Dorobanți 16, Domenii 14, Aviației 12,
    --      Uranus 11, Zona Centru Nord 11, Iancului 10, Obor 9.
    --    La 8 s-ar adauga Kiseleff si Politehnica (cate 8).
    --    Recomandare: prima runda la 9, ca sa testam mesajul pe un lot mic.
    HAVING COUNT(DISTINCT upz.user_id) >= 9
),
clasat AS (
    SELECT
        u.email, u.pseudonym, u.first_name,
        z.name AS zona, c.name AS oras, cz.oameni_in_zona,
        ROW_NUMBER() OVER (PARTITION BY u.user_id
                           ORDER BY cz.oameni_in_zona DESC, z.name) AS rn
    FROM user_preferred_zones upz
    JOIN useri_reali u  ON u.user_id = upz.user_id
    JOIN cerere_zona cz ON cz.zone_id = upz.zone_id
    JOIN zones  z ON z.id = upz.zone_id
    LEFT JOIN cities c ON c.id = z.city_id
)
SELECT email, pseudonym, first_name, oras, zona, oameni_in_zona
FROM clasat
WHERE rn = 1
ORDER BY oameni_in_zona DESC, zona, pseudonym;

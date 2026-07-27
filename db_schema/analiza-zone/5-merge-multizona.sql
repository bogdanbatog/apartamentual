-- =============================================================================
-- 5. DATELE DE MERGE PENTRU EMAIL  (un rand per persoana, cu toate zonele lui)
-- =============================================================================
-- Inlocuieste interogarea 4. Diferenta: in loc sa lipim fiecare om de o singura
-- zona (cea cu cererea maxima), ii aratam TOATE zonele lui fara grup, cu
-- numerele lor. Asa Obor si Iancului primesc si ele avocati, nu doar Tineretului.
--
-- Doua praguri, independente:
--   PRAG_ELIGIBILITATE = 9  -> cine primeste email: doar cine are cel putin o
--                             zona fara grup cu 9+ oameni (cele 8 zone-tinta).
--   PRAG_AFISARE       = 5  -> ce zone ii aratam in email: orice zona a lui
--                             fara grup cu 5+ oameni (deci si Kiseleff, Vatra
--                             Luminoasa etc., daca le are bifate).
-- Le poti schimba pe amandoua mai jos, sunt marcate.
--
-- Coloane pentru merge:
--   nume              = pseudonimul, cu spatiile de la capete taiate
--                       (in baza de date sunt "Iulian ", "Mihai ", "Adrian ")
--   zona_1..3         = zonele lui, in ordinea cererii
--   oameni_1..3       = cati oameni cauta in fiecare
--   zone_pentru_email = textul gata formatat, cu acordul corect in romana
--                       ("20 de oameni" vs "9 oameni")
--   total_zone        = cate zone fara grup are in total (daca > 3, in email
--                       spunem "si altele")
--
-- ⚠️ first_name e gol la toti utilizatorii -> NU folosi {{prenume}}, foloseste
--    coloana `nume` de aici.
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
    SELECT p.user_id, p.email, TRIM(p.pseudonym) AS nume
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
    -- cate persoane reale cauta in fiecare zona FARA grup
    SELECT upz.zone_id, COUNT(DISTINCT upz.user_id) AS oameni
    FROM user_preferred_zones upz
    JOIN useri_reali u ON u.user_id = upz.user_id
    WHERE NOT EXISTS (SELECT 1 FROM zone_cu_grup zg WHERE zg.zone_id = upz.zone_id)
    GROUP BY upz.zone_id
),
zone_user AS (
    -- zonele fiecarui om, ordonate dupa cerere
    SELECT
        u.user_id,
        u.email,
        u.nume,
        z.name    AS zona,
        cz.oameni,
        ROW_NUMBER() OVER (PARTITION BY u.user_id
                           ORDER BY cz.oameni DESC, z.name) AS rn,
        MAX(cz.oameni) OVER (PARTITION BY u.user_id)        AS cerere_max
    FROM user_preferred_zones upz
    JOIN useri_reali u  ON u.user_id = upz.user_id
    JOIN cerere_zona cz ON cz.zone_id = upz.zone_id
    JOIN zones z ON z.id = upz.zone_id
    WHERE cz.oameni >= 5            -- ⬅️ PRAG_AFISARE
)
SELECT
    zu.email,
    MAX(zu.nume) AS nume,

    MAX(CASE WHEN zu.rn = 1 THEN zu.zona   END) AS zona_1,
    MAX(CASE WHEN zu.rn = 1 THEN zu.oameni END) AS oameni_1,
    MAX(CASE WHEN zu.rn = 2 THEN zu.zona   END) AS zona_2,
    MAX(CASE WHEN zu.rn = 2 THEN zu.oameni END) AS oameni_2,
    MAX(CASE WHEN zu.rn = 3 THEN zu.zona   END) AS zona_3,
    MAX(CASE WHEN zu.rn = 3 THEN zu.oameni END) AS oameni_3,

    -- pentru subiectul emailului, cu acordul corect ("20 de oameni" / "9 oameni")
    MAX(CASE WHEN zu.rn = 1 THEN
        CASE WHEN zu.oameni >= 20
             THEN zu.oameni || ' de oameni'
             ELSE zu.oameni || ' oameni'
        END
    END) AS oameni_1_text,

    -- textul gata de lipit in email, cu acordul corect:
    -- in romana se spune "9 oameni", dar "20 DE oameni" (de la 20 in sus)
    STRING_AGG(
        zu.zona || ' — ' ||
        CASE WHEN zu.oameni >= 20
             THEN zu.oameni || ' de oameni'
             ELSE zu.oameni || ' oameni'
        END,
        E'\n' ORDER BY zu.rn
    ) FILTER (WHERE zu.rn <= 3) AS zone_pentru_email,

    COUNT(*) AS total_zone
FROM zone_user zu
WHERE zu.cerere_max >= 9            -- ⬅️ PRAG_ELIGIBILITATE
GROUP BY zu.user_id, zu.email
ORDER BY MAX(CASE WHEN zu.rn = 1 THEN zu.oameni END) DESC, MAX(zu.nume);

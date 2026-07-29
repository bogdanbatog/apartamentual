-- =============================================================================
-- 1. EXPORT: UN RAND PER UTILIZATOR REAL
-- =============================================================================
-- Coloane: user_id, email, oras, zonele preferate (concatenate), numarul de zone
--          bifate, camere preferate, suprafata preferata, data inscrierii.
--
-- ATENTIE la folosire: rezultatul contine EMAIL-uri, deci date personale. E
-- material de lucru INTERN. Pentru postarea publica foloseste 2 si 3 (agregate,
-- fara persoane). CSV-ul e acoperit de regula `*.csv` din .gitignore, deci nu
-- ajunge in repo -- dar nu-l urca in alta parte.
--
-- Definitia "utilizator real" e aceeasi cu cea din analiza-zone/ si de pe pagina
-- publica /utilizatori.html, ca cifrele sa fie comparabile intre analize:
--   account_type = 'activ' AND pseudonym completat AND is_demo = false
--   AND (account_status IS NULL OR account_status = 'active')
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- Export: butonul "Download CSV".
-- =============================================================================

WITH useri_exclusi AS (
    -- Echipa + prietenii cu cont de test. NU sunt marcati `is_demo`, deci fara
    -- blocul asta intra in numaratori si umfla cifrele.
    --
    -- Identificare dupa EMAIL, nu dupa pseudonim: pseudonimul "Lucian LM" e
    -- scris cu spatiu si scapase din lista initiala (confirmat cu 1c, 27 iulie).
    --
    -- ⚠️ Lista e cea validata pe 27 iulie 2026. Daca intre timp ti-ai facut un
    --    cont nou de test, adauga-l aici, altfel intra in export ca utilizator
    --    real. Ruleaza analiza-zone/1c-conturi-de-exclus.sql ca sa reconfirmi.
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
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'  -- toate aliasurile +testN
),
useri_reali AS (
    -- Conturi reale, active, cu profil completat.
    -- `pseudonym IS NOT NULL`      -> a trecut de pasul de completare a profilului
    -- `account_type = 'activ'`     -> exclude agentiile (cont profesional)
    -- `account_status` filtrat     -> exclude suspendate / deleted / pending
    SELECT p.user_id, p.email, p.pseudonym,
           p.preferred_city_id, p.preferred_rooms, p.preferred_area_sqm,
           p.created_at
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
)
SELECT
    u.user_id,
    u.email,
    COALESCE(c.name, '(neselectat)')            AS oras,
    -- Zonele bifate, pe un singur rand, in ordine alfabetica, separate cu " | ".
    -- Separator cu bara, nu virgula: altfel se rupe coloana in CSV.
    COALESCE(string_agg(z.name, ' | ' ORDER BY z.name), '') AS zone_preferate,
    COUNT(z.id)                                  AS nr_zone_bifate,
    u.preferred_rooms                            AS camere_preferate,
    u.preferred_area_sqm                         AS suprafata_preferata_mp,
    u.created_at                                 AS data_inscrierii
FROM useri_reali u
-- LEFT JOIN, nu JOIN: pastram si utilizatorii reali care n-au bifat nicio zona,
-- ca sa vezi numarul total de conturi reale, nu doar pe cei cu zone. Ies cu
-- nr_zone_bifate = 0. Daca vrei doar pe cei cu zone, adauga la final:
--   HAVING COUNT(z.id) > 0
LEFT JOIN user_preferred_zones upz ON upz.user_id = u.user_id
LEFT JOIN zones  z ON z.id = upz.zone_id
LEFT JOIN cities c ON c.id = u.preferred_city_id
GROUP BY u.user_id, u.email, c.name, u.preferred_rooms,
         u.preferred_area_sqm, u.created_at
ORDER BY u.created_at DESC;


-- ---------------------------------------------------------------------------
-- CONTROL: cate randuri trebuie sa iasa mai sus
-- ---------------------------------------------------------------------------
-- Ruleaza-l pe acesta SEPARAT (selecteaza doar blocul de mai jos si apasa Run)
-- si compara `useri_reali` cu numarul de randuri din exportul de sus. Daca
-- difera, ceva din GROUP BY dubleaza randuri si exportul nu e bun de folosit.
-- Iti arata si cati au fost exclusi, pe fiecare motiv, ca sa poti explica cifra.
-- Atentie: categoriile de excludere se suprapun (un cont demo poate fi si fara
-- profil), deci nu se aduna la total -- sunt numaratori independente.
--
-- WITH useri_exclusi AS (
--     SELECT p.user_id
--     FROM profiles p
--     WHERE COALESCE(p.is_super_admin, false) = true
--        OR COALESCE(p.is_admin, false) = true
--        OR LOWER(p.email) IN (
--               'liviu.fabian@gmail.com', 'lucianluta@yahoo.com',
--               'luta.lucian.m@gmail.com', 'cotofana.carmen@yahoo.com',
--               'carmen2000ro@yahoo.com', 'raluca.ivanov26@gmail.com',
--               'tiberiu.abc.maxim@gmail.com', 'livia.dila@yahoo.com'
--           )
--        OR LOWER(p.email) LIKE 'luta.lucian.m+%'
-- )
-- SELECT
--     COUNT(*) FILTER (WHERE p.account_type = 'activ'
--                        AND p.pseudonym IS NOT NULL
--                        AND COALESCE(p.is_demo, false) = false
--                        AND (p.account_status IS NULL OR p.account_status = 'active')
--                        AND NOT EXISTS (SELECT 1 FROM useri_exclusi e
--                                        WHERE e.user_id = p.user_id))     AS useri_reali,
--     COUNT(*) FILTER (WHERE COALESCE(p.is_demo, false) = true)            AS exclusi_demo,
--     COUNT(*) FILTER (WHERE p.pseudonym IS NULL)                         AS exclusi_fara_profil,
--     COUNT(*) FILTER (WHERE p.account_status IS NOT NULL
--                        AND p.account_status <> 'active')                AS exclusi_status,
--     COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM useri_exclusi e
--                                    WHERE e.user_id = p.user_id))        AS exclusi_echipa_test,
--     COUNT(*)                                                            AS total_conturi
-- FROM profiles p;

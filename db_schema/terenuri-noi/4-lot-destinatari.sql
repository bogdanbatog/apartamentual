-- =============================================================================
-- 1. LOTUL DE DESTINATARI: "au aparut terenuri noi in zonele tale"
-- =============================================================================
-- Ruleaza DUPA fisierele 1, 2 si 3 -- mai ales dupa 2, care trebuie sa iasa gol.
-- Nu modifica nimic (doar SELECT). Export: butonul "Download CSV".
--
-- Produce UN RAND PER PERSOANA, gata de folosit ca merge fields in
-- `scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js`.
--
-- CINE INTRA IN LOT (toate conditiile, simultan):
--   1. utilizator real -- aceeasi definitie ca in analiza-zone/ si postare-zone/,
--      ca cifrele sa ramana comparabile intre analize
--   2. are CEL PUTIN O zona bifata in care a aparut un teren nou
--      (daca nu are potrivire, nu produce rand -- deci nu primeste email)
--   3. are CEL MULT 12 zone bifate in total
--      -> pragul cerut de Lucian, 2 august 2026: cine a bifat jumatate de
--         Bucuresti primeste oricum o potrivire, deci "in zonele tale" ar suna
--         fals. Bucurestiul are 61 de cartiere in `orase-cartiere.js`.
--
-- ⚠️ EMAILURI = DATE PERSONALE. CSV-ul rezultat e material INTERN.
--    E acoperit de regula `*.csv` din .gitignore, deci nu ajunge in repo.
-- =============================================================================

WITH parametri AS (
    -- ⚠️ SINGURUL BLOC DE MODIFICAT ⚠️
    SELECT
        -- Ziua in care au fost adaugate cele 19 terenuri (Lucian, 2 august 2026).
        -- `AT TIME ZONE` inseamna "miezul noptii ORA ROMANIEI". Fara el, data
        -- goala ar fi citita ca miezul noptii UTC = ora 3 in Romania, si
        -- terenurile adaugate noaptea ar lipsi din numaratoare, fara niciun semn.
        (DATE '2026-07-30')::timestamp AT TIME ZONE 'Europe/Bucharest' AS de_la,
        12 AS prag_zone                   -- peste atatea zone bifate, il sarim
),

useri_exclusi AS (
    -- Echipa + prietenii cu cont de test. NU sunt marcati `is_demo`, deci fara
    -- blocul asta intra in lot si primesc emailul campaniei.
    -- Lista e cea validata pe 27 iulie 2026 (vezi analiza-zone/1c).
    -- ⚠️ Daca ti-ai facut intre timp un cont nou de test, adauga-l aici.
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
    SELECT p.user_id, p.email, p.pseudonym
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),

terenuri_noi AS (
    -- Terenurile adaugate recent, legate de zona reala din `zones`.
    -- JOIN (nu LEFT JOIN): terenurile care nu se potrivesc pe nicio zona cad
    -- aici, tacut -- exact de aceea fisierul 2 se ruleaza INAINTE.
    SELECT z.id AS zone_id, t.id AS teren_id
    FROM terenuri t
    CROSS JOIN parametri par
    JOIN cities c ON lower(btrim(c.name)) = lower(btrim(t.oras))
    JOIN zones  z ON lower(btrim(z.name)) = lower(btrim(t.cartier))
                 AND z.city_id = c.id
    WHERE t.created_at >= par.de_la
      AND t.deleted_at IS NULL
      AND t.status = 'approved'    -- doar ce e vizibil public
),

zone_cu_terenuri AS (
    -- Cate terenuri noi per zona
    SELECT zone_id, COUNT(DISTINCT teren_id) AS nr_terenuri
    FROM terenuri_noi
    GROUP BY zone_id
),

-- Cate zone are bifate fiecare om IN TOTAL (pentru pragul de 12).
-- Se numara TOATE zonele lui, nu doar cele cu terenuri noi: pragul e despre
-- cat de imprastiata e cautarea lui, nu despre cate potriviri a nimerit.
total_zone_per_user AS (
    SELECT upz.user_id, COUNT(*) AS nr_zone_bifate
    FROM user_preferred_zones upz
    GROUP BY upz.user_id
),

-- Potrivirile: om x zona bifata de el in care a aparut un teren nou
potriviri AS (
    SELECT
        u.user_id, u.email, u.pseudonym,
        z.name          AS zona,
        zct.nr_terenuri,
        tz.nr_zone_bifate,
        ROW_NUMBER() OVER (
            PARTITION BY u.user_id
            -- zona cu cele mai multe terenuri noi prima; la egalitate, alfabetic
            ORDER BY zct.nr_terenuri DESC, z.name
        ) AS pozitie
    FROM useri_reali u
    JOIN user_preferred_zones upz ON upz.user_id = u.user_id
    JOIN zone_cu_terenuri zct     ON zct.zone_id = upz.zone_id
    JOIN zones z                  ON z.id = upz.zone_id
    JOIN total_zone_per_user tz   ON tz.user_id = u.user_id
    CROSS JOIN parametri par
    WHERE tz.nr_zone_bifate <= par.prag_zone
)

SELECT
    p.email,
    btrim(p.pseudonym)  AS nume,

    -- Primele 3 zone, ca in campania din 28 iulie. Restul se rezuma in email
    -- printr-un rand de tipul "si inca N zone".
    MAX(CASE WHEN p.pozitie = 1 THEN p.zona END)        AS zona_1,
    MAX(CASE WHEN p.pozitie = 1 THEN p.nr_terenuri END) AS terenuri_1,
    MAX(CASE WHEN p.pozitie = 2 THEN p.zona END)        AS zona_2,
    MAX(CASE WHEN p.pozitie = 2 THEN p.nr_terenuri END) AS terenuri_2,
    MAX(CASE WHEN p.pozitie = 3 THEN p.zona END)        AS zona_3,
    MAX(CASE WHEN p.pozitie = 3 THEN p.nr_terenuri END) AS terenuri_3,

    -- Acordul gramatical se rezolva AICI, nu in script: "1 teren nou",
    -- "3 terenuri noi", "21 de terenuri noi".
    MAX(CASE WHEN p.pozitie = 1 THEN
        CASE
            WHEN p.nr_terenuri = 1                     THEN '1 teren nou'
            WHEN p.nr_terenuri < 20                    THEN p.nr_terenuri || ' terenuri noi'
            ELSE p.nr_terenuri || ' de terenuri noi'
        END
    END) AS terenuri_1_text,

    COUNT(*)                    AS total_zone_cu_terenuri,  -- cate zone ale lui au primit terenuri
    SUM(p.nr_terenuri)          AS total_terenuri,          -- cate terenuri noi in total, la el
    MAX(p.nr_zone_bifate)       AS nr_zone_bifate           -- control: trebuie sa fie <= 12
FROM potriviri p
GROUP BY p.email, btrim(p.pseudonym)
ORDER BY total_terenuri DESC, total_zone_cu_terenuri DESC;

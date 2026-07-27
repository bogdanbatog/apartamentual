-- =============================================================================
-- 1. CLASAMENTUL ZONELOR FARA GRUP  (lista principala)
-- =============================================================================
-- Scop: cate persoane reale au bifat fiecare zona in care NU exista niciun grup.
--       Fiecare rand = un grup care asteapta sa fie pornit.
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
--
-- Definitii (aceleasi ca pe pagina publica /utilizatori.html):
--   utilizator "real" = account_type = 'activ' AND pseudonym completat
--                       AND is_demo = false AND (account_status null sau 'active')
--   grup "real"       = is_demo = false AND status <> 'arhivat'
-- =============================================================================

WITH useri_exclusi AS (
    -- Echipa + prietenii cu cont de test. NU sunt marcati is_demo, deci fara
    -- blocul asta intra in numaratori si umfla cifra pe care o scriem in email.
    --
    -- Identificare dupa EMAIL, nu dupa pseudonim: pseudonimul "Lucian LM" e
    -- scris cu spatiu si scapase din lista initiala (confirmat cu 1c, 27 iulie).
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false) = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',      -- Fabian (superadmin)
              'lucianluta@yahoo.com',        -- Lucian (superadmin)
              'luta.lucian.m@gmail.com',     -- Lucian LM (3 zone bifate)
              'cotofana.carmen@yahoo.com',   -- Carmen (cont de test)
              'carmen2000ro@yahoo.com',      -- Carmen, al doilea cont (0 zone)
              'raluca.ivanov26@gmail.com',   -- Raluca (cont deja 'deleted')
              'tiberiu.abc.maxim@gmail.com', -- Tibs (cont de test)
              'livia.dila@yahoo.com'         -- Livia (0 zone)
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'  -- toate aliasurile +testN
),
useri_reali AS (
    -- doar conturi reale, active, cu profil completat (fara demo / exemple)
    SELECT p.user_id
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
zone_cu_grup AS (
    -- zonele care au deja cel putin un grup real (deci NU sunt oportunitati)
    SELECT DISTINCT gpz.zone_id
    FROM grup_preferred_zones gpz
    JOIN grupuri g ON g.id = gpz.grup_id
    WHERE COALESCE(g.is_demo, false) = false
      AND COALESCE(g.status, '') <> 'arhivat'
)
SELECT
    c.name                      AS oras,
    z.name                      AS zona,
    COUNT(DISTINCT upz.user_id) AS oameni_interesati
FROM user_preferred_zones upz
JOIN useri_reali u ON u.user_id = upz.user_id
JOIN zones  z ON z.id = upz.zone_id
LEFT JOIN cities c ON c.id = z.city_id
WHERE NOT EXISTS (SELECT 1 FROM zone_cu_grup zg WHERE zg.zone_id = upz.zone_id)
GROUP BY c.name, z.name
HAVING COUNT(DISTINCT upz.user_id) >= 3   -- prag: sub 3 oameni nu e inca un grup
ORDER BY oameni_interesati DESC, zona;

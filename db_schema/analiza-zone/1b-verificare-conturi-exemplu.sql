-- =============================================================================
-- 1b. VERIFICARE: conturile "Exemplu" sunt excluse din numaratori?
-- =============================================================================
-- De ce: pe 23 iulie, zona Tineretului avea 20 de utilizatori = 17 reali + 3
-- marcati "Exemplu" (is_demo). Astazi interogarea 1, care ar trebui sa EXCLUDA
-- exemplele, da tot 20. Ori au intrat exact 3 oameni reali intre timp, ori
-- filtrul `is_demo` nu prinde conturile-exemplu si toate cifrele sunt umflate.
--
-- Cum se citeste rezultatul:
--   Partea A arata cate conturi au is_demo = true, in total.
--     0 randuri -> exemplele sunt marcate ALTFEL decat prin is_demo; le cautam.
--   Partea B arata, pentru fiecare zona-tinta, cati exempla si cati reali sunt.
--     Coloana `exemple` trebuie sa fie 0 in interogarea 1 (adica cifrele din
--     clasament = coloana `reali` de aici).
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================


-- --- PARTEA A: cine sunt conturile marcate ca exemplu -----------------------
SELECT
    p.user_id,
    p.pseudonym,
    p.email,
    p.account_type,
    p.account_status,
    p.is_demo
FROM profiles p
WHERE COALESCE(p.is_demo, false) = true
ORDER BY p.pseudonym;


-- --- PARTEA B: exemple vs. reali, pe zonele-tinta ---------------------------
-- Ruleaza separat de partea A.
SELECT
    z.name AS zona,
    COUNT(DISTINCT p.user_id) FILTER (
        WHERE COALESCE(p.is_demo, false) = false
    ) AS reali,
    COUNT(DISTINCT p.user_id) FILTER (
        WHERE COALESCE(p.is_demo, false) = true
    ) AS exemple,
    COUNT(DISTINCT p.user_id) AS total_afisat_pe_site
FROM user_preferred_zones upz
JOIN profiles p ON p.user_id = upz.user_id
JOIN zones    z ON z.id = upz.zone_id
LEFT JOIN cities c ON c.id = z.city_id
WHERE p.account_type = 'activ'
  AND p.pseudonym IS NOT NULL
  AND (p.account_status IS NULL OR p.account_status = 'active')
  AND c.name = 'București'
  AND z.name IN ('Tineretului', 'Primăverii / Dorobanți', 'Domenii',
                 'Aviației', 'Zona Centru Nord', 'Iancului', 'Uranus', 'Obor')
GROUP BY z.name
ORDER BY reali DESC;

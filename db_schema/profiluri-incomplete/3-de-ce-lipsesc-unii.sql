-- =============================================================================
-- 3. DE CE LIPSESC UNII DIN LISTA  (control peste interogarea 1)
-- =============================================================================
-- De ce exista fisierul asta: in captura din panoul de admin (3 august) apare
-- `radulesc@gmail.com` ca "Fara nume", dar contul NU apare in rezultatul
-- interogarii 1. Interogarea 1 filtreaza dupa `account_type = 'activ'`,
-- `account_status = 'active'` si dupa lista de conturi excluse — oricare din
-- ele poate sa-l fi scos, in tacere.
--
-- Interogarea asta NU filtreaza nimic. Arata TOATE conturile fara pseudonim si,
-- pe fiecare rand, motivul pentru care interogarea 1 l-ar fi sarit. Asa vezi
-- dintr-o privire daca lipsa e corecta (cont de test, agentie, sters) sau daca
-- am pierdut un utilizator real.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT
    p.email,
    (p.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat,
    p.account_type,
    p.account_status,
    COALESCE(p.is_demo, false)        AS demo,
    COALESCE(p.is_admin, false)       AS admin,
    COALESCE(p.is_super_admin, false) AS super_admin,

    -- Motivul pentru care interogarea 1 l-a sarit (primul care se potriveste).
    CASE
        WHEN COALESCE(p.is_super_admin, false) THEN 'exclus: superadmin'
        WHEN COALESCE(p.is_admin, false)       THEN 'exclus: admin'
        WHEN COALESCE(p.is_demo, false)        THEN 'exclus: demo'
        WHEN LOWER(p.email) LIKE 'luta.lucian.m+%' THEN 'exclus: alias de test'
        WHEN LOWER(p.email) IN (
                 'liviu.fabian@gmail.com', 'lucianluta@yahoo.com',
                 'luta.lucian.m@gmail.com', 'cotofana.carmen@yahoo.com',
                 'carmen2000ro@yahoo.com', 'raluca.ivanov26@gmail.com',
                 'tiberiu.abc.maxim@gmail.com', 'livia.dila@yahoo.com'
             ) THEN 'exclus: cont al echipei / de test'
        WHEN p.account_type   <> 'activ'  THEN 'exclus: nu e cont personal (' || p.account_type || ')'
        WHEN p.account_status <> 'active' THEN 'exclus: cont ' || p.account_status
        ELSE 'APARE in interogarea 1'
    END AS de_ce_lipseste

FROM profiles p
WHERE p.pseudonym IS NULL OR p.pseudonym = ''
ORDER BY de_ce_lipseste, inregistrat;

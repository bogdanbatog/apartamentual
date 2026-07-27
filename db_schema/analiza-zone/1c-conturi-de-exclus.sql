-- =============================================================================
-- 1c. CONTURILE DE EXCLUS  (noi + prietenii cu cont de test)
-- =============================================================================
-- De ce: Lucian, Fabian, Carmen, Raluca, Livia, LucianLM, Tibs sunt conturi
-- ale echipei sau ale unor prieteni cu cont de test. Nu sunt marcate `is_demo`,
-- deci intra in numaratori si umfla cifrele. Daca scriem "20 de oameni cauta in
-- Tineretului" iar 4 dintre ei suntem noi, cifra din email e falsa.
--
-- Aceasta interogare NU exclude nimic. Doar arata ce conturi se potrivesc, ca
-- sa confirmam scrierea exacta a pseudonimelor inainte de a le pune in lista de
-- excludere din interogarile 1, 3 si 4.
--
-- ⚠️ Verifica rezultatul rand cu rand: daca apare cineva care e utilizator REAL
--    (de exemplu un Lucian care nu esti tu), spune-mi si restrangem tiparul.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

SELECT
    p.user_id,
    p.pseudonym,
    p.first_name,
    p.last_name,
    p.email,
    p.account_type,
    p.account_status,
    COALESCE(p.is_super_admin, false) AS super_admin,
    COALESCE(p.is_admin, false)       AS admin,
    COALESCE(p.is_demo, false)        AS demo,
    (SELECT COUNT(*) FROM user_preferred_zones u WHERE u.user_id = p.user_id) AS zone_bifate,
    -- de ce a fost prins randul asta:
    CASE
        WHEN COALESCE(p.is_super_admin, false) THEN 'superadmin'
        WHEN COALESCE(p.is_admin, false)       THEN 'admin'
        ELSE 'potrivire de nume'
    END AS motiv
FROM profiles p
WHERE COALESCE(p.is_super_admin, false) = true
   OR COALESCE(p.is_admin, false) = true
   OR p.pseudonym  ILIKE ANY (ARRAY['%fabian%', '%lucian%', '%carmen%',
                                    '%raluca%', '%livia%', '%tibs%'])
   OR p.first_name ILIKE ANY (ARRAY['%fabian%', '%lucian%', '%carmen%',
                                    '%raluca%', '%livia%', '%tibs%'])
   OR p.email      ILIKE ANY (ARRAY['%fabian%', '%lucian%', '%carmen%',
                                    '%raluca%', '%livia%', '%tibs%',
                                    '%ltfbstudio%'])
ORDER BY motiv, p.pseudonym;

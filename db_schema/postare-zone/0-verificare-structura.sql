-- =============================================================================
-- 0. VERIFICARE STRUCTURA REALA  (ruleaza PRIMUL, inainte de 1-4)
-- =============================================================================
-- De ce e obligatoriu pasul asta: migratiile din repo NU mai reflecta baza.
--   * supabase/migrations/000_init.sql defineste `grup` si `grup_membership`,
--     dar interogarile rulate cu succes pe 27 iulie folosesc `grupuri` si
--     `grup_preferred_zones`.
--   * `tags` / `user_tags` nu apar in nicio migratie (exista doar in frontend,
--     deci au fost create direct in dashboard).
-- Concluzie: numele coloanelor se confirma AICI, nu se ghicesc din repo.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0a. Ce tabele exista, de fapt
-- ---------------------------------------------------------------------------
-- Scopul: sa vedem numele REALE, mai ales pentru membrii de grup (`grup_membri`
-- vs `grup_membership` vs altceva) si pentru tabelul de criterii/tag-uri.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '%grup%'
    OR table_name LIKE '%tag%'
    OR table_name LIKE '%zone%'
    OR table_name IN ('profiles', 'cities'))
ORDER BY table_name;


-- ---------------------------------------------------------------------------
-- 0b. Coloanele tabelelor de care avem nevoie
-- ---------------------------------------------------------------------------
-- Verifica in rezultat ca exista exact coloanele folosite in 1-4:
--   profiles              -> user_id, email, pseudonym, account_type,
--                            account_status, is_demo, is_admin, is_super_admin,
--                            preferred_city_id, preferred_rooms,
--                            preferred_area_sqm, created_at
--   zones                 -> id, name, city_id
--   cities                -> id, name
--   user_preferred_zones  -> user_id, zone_id
--   grup_preferred_zones  -> grup_id, zone_id
--   grupuri               -> id, is_demo, status + coloana cu NUMELE grupului
--                            (`nume` sau `name` sau `titlu` -- confirma aici!)
--   user_tags             -> user_id, tag_id
--   tags                  -> id, name, category
--
-- Daca un nume difera, corecteaza-l in fisierele 1-4 inainte de a le rula.
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'zones', 'cities', 'user_preferred_zones',
                     'grupuri', 'grup_preferred_zones', 'grup_membri',
                     'grup_membership', 'tags', 'user_tags')
ORDER BY table_name, ordinal_position;


-- ---------------------------------------------------------------------------
-- 0c. Ce valori are `account_status` (ca sa stim ce inseamna "suspendat")
-- ---------------------------------------------------------------------------
-- Interogarile 1-4 pastreaza doar (account_status IS NULL OR 'active'), ceea ce
-- exclude automat orice alta valoare. Aici vedem ce valori exista de fapt, ca sa
-- fim siguri ca nu aruncam din greseala utilizatori reali cu un status nou.
SELECT COALESCE(account_status, '(null)') AS account_status,
       COUNT(*) AS cati
FROM profiles
GROUP BY account_status
ORDER BY cati DESC;


-- ---------------------------------------------------------------------------
-- 0d. Ce valori are `status` la grupuri (ca sa stim ce inseamna "grup activ")
-- ---------------------------------------------------------------------------
SELECT COALESCE(status, '(null)') AS status_grup,
       COUNT(*) AS cate
FROM grupuri
GROUP BY status
ORDER BY cate DESC;

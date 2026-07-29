-- =============================================================================
-- 4. CRITERIILE BIFATE IN PROFILURI  (raspuns la intrebarea despre "aproape de
--    parc", "ferestre mari", "transport public", "locuire permanenta")
-- =============================================================================
-- Da, exista -- dar NU ca niste coloane separate in `profiles`. Sunt randuri in
-- tabelul `tags`, legate de utilizatori prin `user_tags`. Asta se vede in
-- frontend (frontend/js/register.js): la inscriere se incarca `tags` grupate pe
-- `category` si se scriu bifele in `user_tags` (user_id, tag_id), maxim 15.
--
-- Cele trei categorii folosite in formular sunt:
--   'apartament'  -> "Despre Apartament"   (aici cad "ferestre mari" & co.)
--   'imobil'      -> "Despre Imobil"        (aici cad "aproape de parc",
--                                            "transport public" & co.)
--   'comunitate'  -> "Despre Comunitate"    (aici cade "locuire permanenta")
--
-- ⚠️ Textele exacte ale tag-urilor NU sunt in repo (tabelul `tags` a fost creat
--    direct in dashboard, nu printr-o migratie), deci nu pot confirma din cod ca
--    se numesc exact asa. Interogarea 4a le listeaza pe TOATE, cu numarul de
--    utilizatori -- acolo vezi denumirile reale.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4a. CLASAMENTUL COMPLET: cate persoane reale au bifat fiecare criteriu
-- ---------------------------------------------------------------------------
-- Acesta e raspunsul la "care sunt cele mai frecvente criterii bifate".
-- Exporta-l cu "Download CSV" -- e agregat, fara date personale.
WITH useri_exclusi AS (
    -- Identic cu 1 si 2. Vezi comentariile din 1-export-per-utilizator.sql.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false) = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com', 'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com', 'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com', 'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com', 'livia.dila@yahoo.com'
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'
),
useri_reali AS (
    SELECT p.user_id
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),
total AS (
    SELECT COUNT(*) AS nr FROM useri_reali
)
SELECT
    t.category                       AS categorie,
    t.name                           AS criteriu,
    COUNT(DISTINCT ut.user_id)       AS utilizatori_reali,
    -- Procentul e din TOTALUL utilizatorilor reali, nu doar din cei care au
    -- bifat ceva. Util pentru postare: "X din Y oameni au bifat ...".
    ROUND(100.0 * COUNT(DISTINCT ut.user_id) / NULLIF((SELECT nr FROM total), 0), 1)
                                     AS procent_din_useri_reali
FROM tags t
LEFT JOIN user_tags ut
       ON ut.tag_id = t.id
      AND EXISTS (SELECT 1 FROM useri_reali u WHERE u.user_id = ut.user_id)
GROUP BY t.category, t.name
ORDER BY utilizatori_reali DESC, t.category, t.name;


-- ---------------------------------------------------------------------------
-- 4b. CONTROL: cele patru criterii despre care ai intrebat
-- ---------------------------------------------------------------------------
-- Cauta pe fragment de text, ca sa le gaseasca indiferent de formularea exacta
-- si de diacritice ("locuire permanenta" vs "locuire permanentă").
-- Daca un rand lipseste din rezultat, criteriul acela nu exista in baza sub
-- numele cautat -- verifica lista completa din 4a.
--
-- SELECT t.id, t.category, t.name,
--        (SELECT COUNT(*) FROM user_tags ut WHERE ut.tag_id = t.id) AS bifat_de_oricine
-- FROM tags t
-- WHERE t.name ILIKE '%parc%'
--    OR t.name ILIKE '%ferestre%'
--    OR t.name ILIKE '%transport%'
--    OR t.name ILIKE '%permanent%'
-- ORDER BY t.category, t.name;


-- ---------------------------------------------------------------------------
-- 4c. CONTROL: exista si criterii pe coloane in `profiles`?
-- ---------------------------------------------------------------------------
-- Ca sa fim siguri ca nu exista si niste flag-uri booleene separate, pe langa
-- sistemul de tag-uri. Daca rezultatul e gol, tot ce e "criteriu" sta in `tags`.
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
--   AND (data_type = 'boolean' OR column_name ILIKE '%pref%')
-- ORDER BY ordinal_position;

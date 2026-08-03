-- =============================================================================
-- 1. CINE NU SI-A COMPLETAT PROFILUL  (si cine a primit deja email de reamintire)
-- =============================================================================
-- Intrebarea: dupa emailurile "Un pas mic care conteaza: profilul dumneavoastra
-- pe ApartamenTUal" (17 si 22 iulie 2026), cine tot n-a completat profilul?
--
-- CE INSEAMNA "PROFIL COMPLETAT"
-- Nu exista un camp `profil_completat` in baza de date. Formularul de profil
-- (`js/profile-edit-new.js`) cere, pentru conturile personale, 7 campuri in
-- tabela `profiles` plus 2 liste separate:
--     pseudonym, profession, phone, age,
--     preferred_rooms, preferred_area_sqm, preferred_city_id,
--     cel putin o zona bifata  (tabela `user_preferred_zones`)
--     cel putin un tag de interes (tabela `user_tags`)
-- `description` e optional in formular, deci il arat dar NU il socotesc lipsa.
-- Interogarea numara aceleasi 9 conditii, ca sa spuna aceeasi poveste ca bara
-- de progres pe care o vede utilizatorul in pagina lui.
--
-- ⚠️ DOUA AVERTISMENTE, ca sa nu tragi concluzii gresite:
--
-- 1. Lista de emailuri notificate de mai jos e INCOMPLETA. Am cules-o din cele
--    doua capturi de ecran (screenshots/20260803/), care sunt taiate jos — se
--    vad doar cate 4 randuri din fiecare zi. Coloana `notificat` arata deci
--    "cel putin acestia", nu "exact acestia". Completeaza blocul marcat
--    ✏️ COMPLETEAZA AICI cu restul adreselor din Trimise si re-ruleaza.
--
-- 2. Contul `carmen2000ro@yahoo.com` a primit emailul, dar e al doilea cont de
--    test al Carmenei. E in lista de excluse mai jos, deci NU va aparea in
--    rezultat. E corect asa: nu e un utilizator real de urmarit.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

WITH notificati AS (
    -- Adresele carora le-ai trimis emailul de reamintire, din capturile din
    -- 3 august. Scrise cu litere mici, ca sa se potriveasca la comparatie.
    -- ✏️ COMPLETEAZA AICI restul adreselor din folderul Trimise.
    SELECT LOWER(email) AS email, data_trimiterii
    FROM (VALUES
        ('vlad.radu@gmail.com',            DATE '2026-07-17'),
        ('cristian_punct@yahoo.com',       DATE '2026-07-17'),
        ('adrianrosv@gmail.com',           DATE '2026-07-17'),
        ('tventarnii.artur@gmail.com',     DATE '2026-07-17'),
        ('carmen2000ro@yahoo.com',         DATE '2026-07-22'),
        ('bogdancezarsapcaliu@gmail.com',  DATE '2026-07-22'),
        ('mihai.mitel.31@gmail.com',       DATE '2026-07-22'),
        ('mariusanisiei@gmail.com',        DATE '2026-07-22')
    ) AS t(email, data_trimiterii)
),

useri_exclusi AS (
    -- Echipa + prietenii cu cont de test. Aceeasi lista ca in
    -- analiza-zone/4-export-un-email-per-persoana.sql (27 iulie), ca sa nu
    -- ajungem sa ne numaram pe noi printre "cei care n-au completat".
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
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
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'   -- aliasurile +testN
),

completare AS (
    -- Pentru fiecare cont personal activ: ce are si ce-i lipseste.
    SELECT
        p.user_id,
        p.email,
        p.pseudonym,
        -- Ora din baza e UTC. Fara conversie, cine s-a inscris la 1 noaptea
        -- apare inscris cu o zi mai devreme.
        (p.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat,

        (p.pseudonym          IS NOT NULL AND p.pseudonym <> '')  AS are_pseudonim,
        (p.profession         IS NOT NULL AND p.profession <> '') AS are_profesie,
        (p.phone              IS NOT NULL AND p.phone <> '')      AS are_telefon,
        (p.age                IS NOT NULL)                        AS are_varsta,
        (p.preferred_rooms    IS NOT NULL)                        AS are_camere,
        (p.preferred_area_sqm IS NOT NULL)                        AS are_suprafata,
        (p.preferred_city_id  IS NOT NULL)                        AS are_oras,
        (p.description        IS NOT NULL AND p.description <> '') AS are_descriere, -- optional

        EXISTS (SELECT 1 FROM user_preferred_zones z WHERE z.user_id = p.user_id) AS are_zone,
        EXISTS (SELECT 1 FROM user_tags           t WHERE t.user_id = p.user_id) AS are_taguri

    FROM profiles p
    WHERE p.account_type   = 'activ'          -- conturile de agentie au alt formular
      AND p.account_status = 'active'         -- fara suspendati / stersi
      AND p.user_id NOT IN (SELECT user_id FROM useri_exclusi)
)

SELECT
    c.email,
    COALESCE(c.pseudonym, '— fara nume —')            AS pseudonim,
    c.inregistrat,

    -- Cate din cele 9 conditii obligatorii sunt bifate.
    (c.are_pseudonim::int + c.are_profesie::int + c.are_telefon::int
     + c.are_varsta::int + c.are_camere::int + c.are_suprafata::int
     + c.are_oras::int + c.are_zone::int + c.are_taguri::int)        AS campuri_completate,

    -- Cat de departe a ajuns: cine n-are nici macar pseudonim n-a deschis
    -- niciodata formularul; cine are 1-8 l-a deschis si l-a lasat pe jumatate.
    CASE
        WHEN NOT c.are_pseudonim THEN 'nu a inceput deloc'
        WHEN (c.are_pseudonim::int + c.are_profesie::int + c.are_telefon::int
              + c.are_varsta::int + c.are_camere::int + c.are_suprafata::int
              + c.are_oras::int + c.are_zone::int + c.are_taguri::int) = 9
             THEN 'complet'
        ELSE 'inceput, nefinalizat'
    END                                                              AS stadiu,

    -- Ce anume lipseste, pe scurt, ca sa stii ce sa-i ceri in email.
    NULLIF(ARRAY_TO_STRING(ARRAY[
        CASE WHEN NOT c.are_pseudonim THEN 'nume'       END,
        CASE WHEN NOT c.are_profesie  THEN 'profesie'   END,
        CASE WHEN NOT c.are_telefon   THEN 'telefon'    END,
        CASE WHEN NOT c.are_varsta    THEN 'varsta'     END,
        CASE WHEN NOT c.are_camere    THEN 'camere'     END,
        CASE WHEN NOT c.are_suprafata THEN 'suprafata'  END,
        CASE WHEN NOT c.are_oras      THEN 'oras'       END,
        CASE WHEN NOT c.are_zone      THEN 'zone'       END,
        CASE WHEN NOT c.are_taguri    THEN 'taguri'     END
    ], ', '), '')                                                    AS lipseste,

    -- A primit sau nu emailul de reamintire (dupa lista de sus, incompleta).
    CASE WHEN n.email IS NOT NULL THEN 'DA, ' || TO_CHAR(n.data_trimiterii, 'DD.MM')
         ELSE 'nu (dupa datele pe care le am)' END                   AS notificat,

    c.are_descriere                                                  AS are_descriere_optionala

FROM completare c
LEFT JOIN notificati n ON n.email = LOWER(c.email)

-- Doar cei cu profil incomplet. Scoate randul urmator daca vrei si completii.
WHERE NOT (c.are_pseudonim AND c.are_profesie AND c.are_telefon
           AND c.are_varsta AND c.are_camere AND c.are_suprafata
           AND c.are_oras AND c.are_zone AND c.are_taguri)

ORDER BY
    (n.email IS NOT NULL) DESC,   -- intai cei notificati care tot n-au completat
    campuri_completate ASC,       -- apoi cei mai "goi"
    c.inregistrat ASC;

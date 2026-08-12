-- =============================================================================
-- 0. CINE AR FI MARCAT `cont_intern` — DIAGNOSTIC
-- =============================================================================
-- Strict SELECT. Nu modifica NIMIC. Rulabil oricand, de cate ori vrei.
--
-- DE CE EXISTA FISIERUL ASTA
--   Pana acum, conturile noastre si ale prietenilor cu cont de test erau scoase
--   din campanii printr-o LISTA DE EMAILURI SCRISA DE MANA, copiata din fisier
--   in fisier (`terenuri-noi/4-lot-destinatari.sql:44-54`,
--   `emailuri-profil-incomplet/1-lot-pentru-email.sql:42-53`).
--   Intr-o campanie pornita de mana, lista aia e acceptabila: te uiti la lot
--   inainte de trimitere. Intr-o functie care ruleaza SINGURA in fiecare luni,
--   e o bomba cu ceas: contul de test facut peste trei luni nu e in lista si
--   primeste emailul, iar tu afli cand il vezi in inbox.
--
--   Fisierul asta arata pe cine ar prinde un steag pus in baza de date, si —
--   mai important — CE AR FI RATAT lista veche.
--
-- ⚠️ SE RULEAZA INTREG, DINTR-UN SINGUR "Run".
--    E scris ca o SINGURA interogare cu UNION ALL si o coloana `sectiune`,
--    fiindca editorul SQL din Supabase arata doar rezultatul ULTIMEI
--    instructiuni dintr-un script. Daca l-as fi scris ca 3 SELECT-uri, ai fi
--    vazut doar sectiunea C si ai fi crezut ca restul n-a mers.
--
-- CUM SE CITESTE REZULTATUL
--   Sectiunea A — candidatii. Uita-te la coloana `nota`: `RATAT` inseamna un
--                 cont pe care listele scrise de mana NU-l prindeau.
--                 ⚠️ Cauta anume motivul „alias de test (adresa cu +)". E
--                 singura regula care poate gresi: sunt oameni reali care se
--                 inscriu cu alias ca sa vada cine le vinde adresa. Daca vezi
--                 acolo un prospect adevarat, spune-mi inainte de fisierul 1.
--   Sectiunea B — bilantul in cifre (cati raman "reali" dupa marcare).
--   Sectiunea C — ⚠️ PARTEA CARE CONTEAZA CEL MAI MULT: toti ceilalti, adica
--                 oamenii care VOR primi emailurile. Citeste-i rand cu rand.
--                 Pe 10 august, doua adrese au fost scoase din lot cu ochiul —
--                 un colaborator tehnic fara steag de admin si o adresa de mail
--                 temporara — si NICIUN filtru din SQL nu le prinsese.
--                 Daca vezi aici pe cineva care nu e prospect real, spune-mi si
--                 il adaug in fisierul 1 INAINTE de a-l rula.
--
-- Export: butonul "Download CSV". ⚠️ Contine emailuri = date personale.
--         Acoperit de regula `*.csv` din .gitignore, nu ajunge in repo.
-- =============================================================================

WITH

-- ── Lista scrisa de mana, exact cum e azi in campanii ────────────────────────
-- O tinem aici DOAR ca sa putem raspunde la intrebarea "ce rata?".
-- Dupa ce steagul `cont_intern` e pus, blocul asta nu se mai copiaza nicaieri.
lista_veche AS (
    SELECT LOWER(e) AS email FROM unnest(ARRAY[
        'liviu.fabian@gmail.com',      -- Fabian (superadmin)
        'lucianluta@yahoo.com',        -- Lucian (superadmin)
        'luta.lucian.m@gmail.com',     -- Lucian LM
        'cotofana.carmen@yahoo.com',   -- Carmen (cont de test)
        'carmen2000ro@yahoo.com',      -- Carmen, al doilea cont
        'raluca.ivanov26@gmail.com',   -- Raluca (cont 'deleted')
        'tiberiu.abc.maxim@gmail.com', -- Tibs (cont de test)
        'livia.dila@yahoo.com'         -- Livia
    ]) AS e
),

-- ── Domenii de mail temporar ────────────────────────────────────────────────
-- Cine se inscrie cu asa ceva nu e prospect: e cineva care incearca platforma.
-- Lista nu e exhaustiva (nici n-are cum sa fie) — de asta exista sectiunea C.
domenii_temporare AS (
    SELECT d FROM unnest(ARRAY[
        'mailinator.com', 'yopmail.com', 'guerrillamail.com', 'sharklasers.com',
        '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'trashmail.com',
        'getnada.com', 'maildrop.cc', 'dispostable.com', 'throwawaymail.com',
        'moakt.com', 'emailondeck.com', 'inboxkitten.com', 'fakemail.net',
        'mailnesia.com', 'spamgourmet.com', 'mytemp.email', 'tempr.email'
    ]) AS d
),

-- ── Toate conturile, cu motivul pentru care ar fi (sau nu) marcate ──────────
evaluare AS (
    SELECT
        p.user_id,
        LOWER(btrim(p.email))                      AS email,
        btrim(COALESCE(p.pseudonym,
                       p.first_name || ' ' || p.last_name,
                       '(fara nume)'))             AS nume,
        p.account_type,
        p.account_status,
        COALESCE(p.is_demo, false)                 AS demo,
        COALESCE(p.is_admin, false)                AS admin,
        COALESCE(p.is_super_admin, false)          AS superadmin,
        p.created_at,
        (p.pseudonym IS NOT NULL)                  AS are_pseudonim,
        (SELECT COUNT(*) FROM user_preferred_zones u WHERE u.user_id = p.user_id)
                                                   AS zone_bifate,

        -- De ce ar fi marcat. Prima potrivire castiga, de la sigur spre incert.
        CASE
            WHEN COALESCE(p.is_super_admin, false) THEN 'superadmin'
            WHEN COALESCE(p.is_admin, false)       THEN 'admin'
            WHEN LOWER(btrim(p.email)) IN (SELECT email FROM lista_veche)
                                                   THEN 'echipa / prieten cu cont de test (lista veche)'
            WHEN LOWER(p.email) LIKE '%@ltfbstudio.ro'
                                                   THEN 'adresa de firma (ltfbstudio.ro)'
            -- ⚠️ Tiparul de alias, nu doar al lui Lucian: `orice+ceva@domeniu`.
            -- Asa se face un cont de test in 5 secunde, si asa a fost facut.
            WHEN LOWER(p.email) LIKE '%+%@%'       THEN 'alias de test (adresa cu +)'
            WHEN EXISTS (SELECT 1 FROM domenii_temporare d
                         WHERE LOWER(p.email) LIKE '%@' || d.d)
                                                   THEN 'adresa de mail temporar'
            ELSE NULL
        END AS motiv,

        -- Lista veche il prindea?  Reproduce EXACT conditia din campanii.
        (COALESCE(p.is_super_admin, false)
         OR COALESCE(p.is_admin, false)
         OR LOWER(btrim(p.email)) IN (SELECT email FROM lista_veche)
         OR LOWER(p.email) LIKE 'luta.lucian.m+%'
         OR LOWER(p.email) LIKE '%@ltfbstudio.ro'
        ) AS prins_de_lista_veche
    FROM profiles p
    WHERE p.email IS NOT NULL
),

-- ── Cine ramane "utilizator real" dupa marcare ──────────────────────────────
-- Aceleasi conditii ca in `terenuri-noi/4-lot-destinatari.sql:57-67`, ca sa
-- ramana comparabil cu masuratorile din 12 august (cele 70 de persoane).
raman_reali AS (
    SELECT *
    FROM evaluare e
    WHERE e.motiv IS NULL
      AND e.demo = false
      AND e.account_type = 'activ'
      AND e.are_pseudonim                          -- profil inceput, ca in campanii
      AND (e.account_status IS NULL OR e.account_status = 'active')
      -- ⚠️ `account_status IS NULL` NU e o scapare, e intentionat: platforma
      -- accepta NULL, iar interogarile care cer strict 'active' sar tacut peste
      -- oamenii aceia. Aici ii pastram, ca in `4-lot-destinatari.sql:64`.
)

-- ═════════════════════════════════════════════════════════════════════════════
--  SECTIUNEA A — candidatii pentru `cont_intern`
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
    1                                              AS ord,
    'A. CANDIDATI'                                 AS sectiune,
    e.email                                        AS email,
    e.nume                                         AS nume,
    e.motiv                                        AS motiv,
    CASE WHEN e.prins_de_lista_veche THEN 'prins de lista veche'
         ELSE '⚠️ RATAT de lista veche' END        AS nota,
    'demo=' || e.demo
        || ' | tip=' || COALESCE(e.account_type, '—')
        || ' | stare=' || COALESCE(e.account_status, 'NULL')
        || ' | zone=' || e.zone_bifate             AS detalii
FROM evaluare e
WHERE e.motiv IS NOT NULL

UNION ALL

-- ═════════════════════════════════════════════════════════════════════════════
--  SECTIUNEA B — bilantul
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 2, 'B. BILANT', NULL::text, NULL::text,
       'Conturi in baza, cu email',
       '', (SELECT COUNT(*)::text FROM evaluare)
UNION ALL
SELECT 2, 'B. BILANT', NULL::text, NULL::text,
       'Ar fi marcate `cont_intern`',
       '', (SELECT COUNT(*)::text FROM evaluare WHERE motiv IS NOT NULL)
UNION ALL
SELECT 2, 'B. BILANT', NULL::text, NULL::text,
       '  ...din care RATATE de lista veche',
       '', (SELECT COUNT(*)::text FROM evaluare
            WHERE motiv IS NOT NULL AND NOT prins_de_lista_veche)
UNION ALL
SELECT 2, 'B. BILANT', NULL::text, NULL::text,
       'Marcate deja `is_demo` (personaje inventate)',
       '', (SELECT COUNT(*)::text FROM evaluare WHERE demo)
UNION ALL
SELECT 2, 'B. BILANT', NULL::text, NULL::text,
       'RAMAN utilizatori reali (asteptat: ~70)',
       '', (SELECT COUNT(*)::text FROM raman_reali)

UNION ALL

-- ═════════════════════════════════════════════════════════════════════════════
--  SECTIUNEA C — cine RAMANE si va primi emailurile.  ⚠️ CITESTE RAND CU RAND.
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
    3,
    'C. RAMAN REALI',
    r.email,
    r.nume,
    'primeste emailurile automate',
    'inscris ' || to_char(r.created_at AT TIME ZONE 'Europe/Bucharest', 'DD.MM.YYYY'),
    'zone=' || r.zone_bifate
        || CASE WHEN r.zone_bifate >= 20
                THEN '  ⚠️ peste pragul de 20 — nu primeste digestul de terenuri'
                ELSE '' END
FROM raman_reali r

ORDER BY ord, motiv NULLS LAST, email;

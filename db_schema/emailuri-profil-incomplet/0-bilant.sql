-- =============================================================================
-- 0. BILANȚUL LOTULUI  (cine primește emailul „profilul te blochează”)
-- =============================================================================
-- Se rulează PRIMA. Nu produce lista, produce doar cifrele — ca să știm despre
-- cât de mulți oameni vorbim și dacă textul emailului are sens pentru ei.
--
-- ⚠️ DE CE NU REFOLOSIM `profiluri-incomplete/1-profiluri-incomplete.sql`
-- Interogarea aceea numără 9 condiții (inclusiv telefon, vârstă, profesie).
-- Telefonul și vârsta au devenit OPȚIONALE pe 4 august, iar poarta care chiar
-- decide cine intră în grupuri — funcția `public.profil_complet()` — cere 6:
--     pseudonym, preferred_rooms, preferred_area_sqm, preferred_city_id,
--     cel puțin o zonă, cel puțin un tag.
-- Lista făcută cu numărătoarea de 9 conține oameni care de fapt POT intra în
-- grupuri. Le-am scrie că sunt blocați când nu sunt. Aici întrebăm direct
-- funcția, deci nu putem ajunge cu două definiții diferite.
--
-- ⚠️ O DIFERENȚĂ FAȚĂ DE INTEROGAREA VECHE, INTENȚIONATĂ
-- Ea cerea `account_status = 'active'`. Platforma (`js/utilizatori.js:188`)
-- acceptă și `account_status IS NULL`. Dacă există conturi cu NULL acolo,
-- interogarea veche le-a sărit tăcut. Aici scriem `IS NULL OR = 'active'`,
-- adică exact ce face site-ul.
--
-- Totul într-o SINGURĂ interogare, fiindcă editorul SQL din Supabase afișează
-- doar rezultatul ultimei instrucțiuni dintr-un script.
--
-- Rulează în: Supabase SQL Editor. Nu modifică nimic (doar SELECT).
-- =============================================================================

WITH exclusi AS (
    -- Echipa + conturile noastre de test + demo. Aceeași listă ca în
    -- `analiza-zone/4-export-un-email-per-persoana.sql` (27 iulie).
    -- Fără ea, bilanțul „câți au profil incomplet” e aproape în întregime
    -- al lui Lucian: cele ~48 de aliasuri `+testNN` au toate profilul gol.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',      -- Fabian (superadmin)
              'lucianluta@yahoo.com',        -- Lucian (superadmin)
              'luta.lucian.m@gmail.com',     -- Lucian LM
              'cotofana.carmen@yahoo.com',   -- Carmen (cont de test, inactiv permanent)
              'carmen2000ro@yahoo.com',      -- Carmen, al doilea cont
              'raluca.ivanov26@gmail.com',   -- Raluca (cont 'deleted')
              'tiberiu.abc.maxim@gmail.com', -- Tibs (cont de test, inactiv permanent)
              'livia.dila@yahoo.com'         -- Livia
          )
       OR LOWER(p.email) LIKE 'luta.lucian.m+%'   -- aliasurile +testNN
       OR LOWER(p.email) LIKE '%@ltfbstudio.ro'
),

conturi AS (
    -- Conturile personale vii. Agențiile (`account_type = 'profesional'`) au
    -- alt formular de profil și nu intră în grupuri, deci n-au ce căuta aici.
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        p.pseudonym,
        (p.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat,
        public.profil_complet(p.user_id) AS complet,
        u.email_confirmed_at
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
),

incompleti AS (
    SELECT * FROM conturi WHERE complet = false
),

-- Cine s-a dezabonat explicit de la newsletter. Nu e același lucru cu emailul
-- ăsta (ăla e marketing, ăsta e o explicație despre contul lui), dar cine a
-- apăsat o dată „nu-mi mai scrie” merită respectat oricum.
dezabonati AS (
    SELECT LOWER(email) AS email
    FROM newsletter_subscribers
    WHERE status = 'unsubscribed'
),

-- Adresele cărora le-am scris deja, pe 17 și 22 iulie. Lista e INCOMPLETĂ:
-- a fost culeasă din două capturi de ecran tăiate jos (`screenshots/20260803/`),
-- deci cifra de mai jos înseamnă „cel puțin atâția”, nu „exact atâția”.
notificati_iulie AS (
    SELECT LOWER(e) AS email FROM unnest(ARRAY[
        'vlad.radu@gmail.com',
        'cristian_punct@yahoo.com',
        'adrianrosv@gmail.com',
        'tventarnii.artur@gmail.com',
        'carmen2000ro@yahoo.com',
        'bogdancezarsapcaliu@gmail.com',
        'mihai.mitel.31@gmail.com',
        'mariusanisiei@gmail.com'
    ]) AS e
),

-- Lotul final, după cele trei scoateri. Aceleași condiții sunt scrise identic
-- în interogarea 1 — dacă schimbi una, schimb-o în amândouă.
lot AS (
    SELECT i.*
    FROM incompleti i
    WHERE i.email_confirmed_at IS NOT NULL                     -- poate intra în cont
      AND i.inregistrat <= (now() AT TIME ZONE 'Europe/Bucharest')::date - 2  -- nu chiar de ieri
      AND i.email NOT IN (SELECT email FROM dezabonati)
)

SELECT * FROM (
          SELECT 1 AS nr, 'Conturi personale vii (fără noi, fără demo)' AS sectiune,
                 (SELECT COUNT(*) FROM conturi) AS numar,
                 'baza de comparație' AS observatie
UNION ALL SELECT 2, '— cu profil COMPLET (pot intra în grupuri)',
                 (SELECT COUNT(*) FROM conturi WHERE complet),
                 'după `profil_complet()`, nu după bara de progres'
UNION ALL SELECT 3, '— cu profil INCOMPLET (lotul brut)',
                 (SELECT COUNT(*) FROM incompleti),
                 'de aici scădem cele trei categorii de mai jos'

UNION ALL SELECT 4, 'SE SCOT: nu și-au confirmat emailul',
                 (SELECT COUNT(*) FROM incompleti WHERE email_confirmed_at IS NULL),
                 'nu pot intra în cont — au nevoie de alt mesaj, nu de ăsta'
UNION ALL SELECT 5, 'SE SCOT: înregistrați în ultimele 2 zile',
                 (SELECT COUNT(*) FROM incompleti
                   WHERE email_confirmed_at IS NOT NULL
                     AND inregistrat > (now() AT TIME ZONE 'Europe/Bucharest')::date - 2),
                 'încă sunt în flux; platforma îi duce singură spre profil'
UNION ALL SELECT 6, 'SE SCOT: dezabonați de la newsletter',
                 (SELECT COUNT(*) FROM incompleti i
                   WHERE i.email_confirmed_at IS NOT NULL
                     AND i.email IN (SELECT email FROM dezabonati)),
                 'au cerut o dată să nu le mai scriem'

UNION ALL SELECT 7, '= LOTUL FINAL, cui îi scriem',
                 (SELECT COUNT(*) FROM lot),
                 'ăsta e numărul care contează'

UNION ALL SELECT 8, 'din lot: fără pseudonim (chiar NU apar la Utilizatori)',
                 (SELECT COUNT(*) FROM lot WHERE pseudonym IS NULL),
                 'doar lor li se poate spune „nu apari în listă”'
UNION ALL SELECT 9, 'din lot: CU pseudonim (apar la Utilizatori, dar blocați)',
                 (SELECT COUNT(*) FROM lot WHERE pseudonym IS NOT NULL),
                 'lor NU li se spune „nu apari” — ar fi fals'
UNION ALL SELECT 10, 'din lot: au primit deja emailul din iulie',
                 (SELECT COUNT(*) FROM lot WHERE email IN (SELECT email FROM notificati_iulie)),
                 'e al treilea mesaj pentru ei — lista din iulie e incompletă'
UNION ALL SELECT 11, 'din lot: nu au niciun nume de salut',
                 (SELECT COUNT(*) FROM lot WHERE COALESCE(TRIM(pseudonym), '') = ''),
                 'emailul începe cu „Salut,” simplu'

UNION ALL SELECT 12, 'Conturi excluse ca fiind ale noastre / de test / demo',
                 (SELECT COUNT(*) FROM exclusi),
                 'dacă numărul sare brusc, verifică lista de adrese din CTE'
) t
ORDER BY nr;

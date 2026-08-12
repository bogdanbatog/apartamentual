-- =============================================================================
-- 0d. MĂSURĂTOARE: câte zone bifează oamenii, de fapt
-- =============================================================================
-- NU MODIFICĂ NIMIC. Doar citește. Rulabil oricând.
-- Rulează în: Supabase SQL Editor.
--
-- LA CE FOLOSEȘTE
-- Răspunde la întrebarea dinaintea deciziei despre prag: **câți oameni taie,
-- de fapt, fiecare prag?**
--
-- Pragul de 12 a fost ales pe 2 august, ca reacție la un caz real: un om avea
-- 58 de zone bifate din cele 61 ale Bucureștiului — pentru el, „au apărut
-- terenuri în zonele tale" n-ar fi însemnat nimic, fiindcă orice teren din
-- oraș i-ar fi produs o potrivire. Dar 12 a fost o cifră aleasă din burtă, nu
-- din distribuție. Aici se vede dacă e pusă unde trebuie.
--
-- CE E DE URMĂRIT
-- Secțiunea B (distribuția) arată unde stă masa oamenilor. Dacă aproape toți
-- au sub 12 zone, pragul nu face nimic — și atunci întrebarea „îl păstrăm?"
-- devine fără miză. Dacă masa e la 15–25, pragul taie serios și merită discutat.
-- Secțiunea C spune direct, pentru fiecare prag candidat, câți oameni pierd
-- dreptul la email.
-- =============================================================================

WITH

-- Aceeași listă de excluderi ca în campania din august, ca cifrele să fie
-- comparabile cu ce s-a trimis atunci.
useri_exclusi AS (
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false) = true
       OR LOWER(p.email) IN (
              'liviu.fabian@gmail.com',
              'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com',
              'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com',
              'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com',
              'livia.dila@yahoo.com'
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
      AND p.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),

-- LEFT JOIN, nu JOIN: oamenii cu ZERO zone bifate fac parte din răspuns.
-- Ei nu vor primi niciodată emailul ăsta, indiferent de prag — și e util de
-- știut cât de mare e grupul lor.
zone_per_om AS (
    SELECT
        u.user_id,
        COUNT(upz.zone_id) AS nr_zone
    FROM useri_reali u
    LEFT JOIN user_preferred_zones upz ON upz.user_id = u.user_id
    GROUP BY u.user_id
),

-- Primii 15, tăiați AICI, în propriul lor CTE. Un `LIMIT` pus la coada
-- interogării mari ar fi tăiat din tot rezultatul, nu din secțiunea asta —
-- adică ar fi putut înghiți rânduri din B sau C fără să spună nimic.
varful AS (
    SELECT
        lpad(ROW_NUMBER() OVER (ORDER BY z.nr_zone DESC, z.user_id)::text, 2, '0') AS loc,
        z.nr_zone
    FROM zone_per_om z
    WHERE z.nr_zone > 0
    ORDER BY z.nr_zone DESC, z.user_id
    LIMIT 15
)


-- ═════════════════════════════════════════════════════════════════════════════
-- A. REZUMAT
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
    'A. rezumat'                                              AS sectiune,
    'utilizatori reali, în total'                             AS detaliu_1,
    COUNT(*)::text                                            AS detaliu_2,
    '-'                                                       AS detaliu_3
FROM zone_per_om

UNION ALL
SELECT
    'A. rezumat',
    'dintre ei, cu ZERO zone bifate',
    COUNT(*) FILTER (WHERE nr_zone = 0)::text,
    'nu primesc emailul niciodată, indiferent de prag'
FROM zone_per_om

UNION ALL
SELECT
    'A. rezumat',
    'câte zone bifează, în medie (dintre cei care bifează)',
    COALESCE(ROUND(AVG(nr_zone) FILTER (WHERE nr_zone > 0), 1)::text, '—'),
    'maximul: ' || COALESCE(MAX(nr_zone)::text, '0') || ' zone'
FROM zone_per_om


-- ═════════════════════════════════════════════════════════════════════════════
-- B. DISTRIBUȚIA — unde stă masa oamenilor
-- ═════════════════════════════════════════════════════════════════════════════
-- Bucata `0` e separată dinadins: „n-a bifat nimic" e altceva decât „a bifat
-- puțin", chiar dacă ambele înseamnă că azi nu primește email.
UNION ALL
SELECT
    'B. distribuție',
    CASE
        WHEN nr_zone = 0            THEN '00 zone (niciuna)'
        WHEN nr_zone BETWEEN 1 AND 2   THEN '01 · 1–2 zone'
        WHEN nr_zone BETWEEN 3 AND 5   THEN '02 · 3–5 zone'
        WHEN nr_zone BETWEEN 6 AND 9   THEN '03 · 6–9 zone'
        WHEN nr_zone BETWEEN 10 AND 12 THEN '04 · 10–12 zone'
        WHEN nr_zone BETWEEN 13 AND 20 THEN '05 · 13–20 zone'
        WHEN nr_zone BETWEEN 21 AND 40 THEN '06 · 21–40 zone'
        ELSE                                '07 · peste 40 de zone'
    END,
    COUNT(*)::text || ' oameni',
    'de la ' || MIN(nr_zone)::text || ' la ' || MAX(nr_zone)::text || ' zone'
FROM zone_per_om
GROUP BY 2


-- ═════════════════════════════════════════════════════════════════════════════
-- C. CE TAIE FIECARE PRAG CANDIDAT
-- ═════════════════════════════════════════════════════════════════════════════
-- Se numără doar oamenii care CHIAR au bifat ceva (cei cu 0 zone n-ar primi
-- email oricum, deci n-au ce fi „tăiați" de un prag).
UNION ALL
SELECT
    'C. praguri',
    'prag ' || p.prag::text || ' zone',
    COUNT(*) FILTER (WHERE z.nr_zone > p.prag)::text || ' oameni tăiați',
    COUNT(*) FILTER (WHERE z.nr_zone > 0 AND z.nr_zone <= p.prag)::text
        || ' rămân eligibili'
FROM zone_per_om z
CROSS JOIN (VALUES (10), (12), (15), (20), (61)) AS p(prag)
WHERE z.nr_zone > 0
GROUP BY p.prag


-- ═════════════════════════════════════════════════════════════════════════════
-- D. CAPETELE LISTEI — cine sunt cei cu cele mai multe zone
-- ═════════════════════════════════════════════════════════════════════════════
-- Fără email și fără nume: aici contează cifra, nu persoana. Dacă vârful e un
-- singur om cu 58 de zone și restul au sub 10, pragul e o regulă scrisă pentru
-- un singur caz — de discutat dacă merită să existe.
UNION ALL
SELECT
    'D. vârful',
    'locul ' || v.loc,
    v.nr_zone::text || ' zone bifate',
    '-'
FROM varful v

ORDER BY 1, 2;

-- =============================================================================
-- CUM SE CITEȘTE
-- =============================================================================
--   • Dacă secțiunea C arată „prag 12 → 1 om tăiat", pragul e o regulă scrisă
--     pentru un singur caz. Atunci variantele sunt: îl păstrezi ca plasă de
--     siguranță pentru viitor, sau îl scoți și tratezi cazul acela separat.
--   • Dacă arată 10–20 de oameni tăiați, pragul e o decizie de produs reală și
--     merită cântărit: ei ar primi email în fiecare săptămână, aproape sigur,
--     fiindcă orice teren din oraș le-ar nimeri o zonă.
--   • Secțiunea A, rândul „ZERO zone bifate", e util și în afara discuției
--     despre prag: ăia sunt oameni cu cont activ și profil completat care
--     n-au spus niciodată unde vor să construiască. Pentru ei, emailul potrivit
--     e altul — „spune-ne unde cauți", nu „au apărut terenuri".
-- =============================================================================

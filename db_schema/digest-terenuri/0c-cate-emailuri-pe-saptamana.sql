-- =============================================================================
-- 0c. MĂSURĂTOARE: câte emailuri ar fi plecat, săptămână cu săptămână
-- =============================================================================
-- NU MODIFICĂ NIMIC. Doar citește. Rulabil oricând.
-- Rulează în: Supabase SQL Editor.
--
-- LA CE FOLOSEȘTE
-- Răspunde la întrebarea dinaintea deciziei „luni sau marți, la ce oră":
-- **avem material săptămânal, sau terenurile apar în rafale?**
--
-- Dacă ies 3 săptămâni pline și 20 goale, atunci „digest săptămânal" e o
-- promisiune pe care platforma n-o poate ține, iar întrebarea corectă devine
-- „trimitem când se adună destule", nu „trimitem lunea".
-- Dacă ies rânduri mici dar constante, săptămânalul e alegerea bună.
--
-- CE ÎNSEAMNĂ COLOANA `destinatari`
-- Câți oameni DIFERIȚI ar fi primit un email în săptămâna aia — adică au bifat
-- cel puțin o zonă în care a apărut un teren nou, și trec de pragul de zone.
-- Asta e cifra care contează. `terenuri_noi` arată doar cât material a fost.
--
-- -----------------------------------------------------------------------------
-- ⚠️ TREI APROXIMĂRI, ca să nu citești cifrele ca pe un adevăr exact
-- -----------------------------------------------------------------------------
-- 1. **Preferințele oamenilor sunt cele de AZI**, nu cele de atunci. Nu există
--    istoric al bifelor. Cine și-a bifat zonele săptămâna trecută apare ca și
--    cum le-ar fi avut dintotdeauna. Corecție parțială: se numără doar oamenii
--    al căror CONT exista deja în săptămâna respectivă (`profiles.created_at`).
--    Deci cifrele din trecut sunt mai degrabă o limită de sus.
--
-- 2. **Fereastra e săptămâna calendaristică** (luni→duminică, ora României).
--    Funcția adevărată va folosi „de la ultima trimitere către omul ăsta",
--    ceea ce e mai bun (nu pierde nimic dacă o săptămână pică), dar aici
--    aproximația e potrivită și mult mai ușor de citit.
--
-- 3. **Terenurile se numără după `created_at`**, nu după data aprobării. Un
--    teren propus vineri și aprobat marțea următoare apare în săptămâna în care
--    a fost propus, deși public a devenit mai târziu.
-- =============================================================================

WITH parametri AS (
    -- ⚠️ SINGURUL BLOC DE MODIFICAT ⚠️
    SELECT
        26  AS saptamani_inapoi,   -- cât de mult ne uităm în urmă (26 = ~6 luni)
        12  AS prag_zone           -- pragul din campania din august
),

-- Câte o linie per săptămână, chiar dacă n-a fost niciun teren în ea.
-- Săptămânile goale sunt jumătate din răspuns — fără ele n-ai ști cât de rare
-- sunt cele pline.
saptamani AS (
    SELECT generate_series(
        date_trunc('week', (now() AT TIME ZONE 'Europe/Bucharest')::date
                           - (par.saptamani_inapoi * 7)),
        date_trunc('week', (now() AT TIME ZONE 'Europe/Bucharest')::date),
        interval '1 week'
    )::date AS luni
    FROM parametri par
),

-- Lista de excluderi — aceeași ca în campania din august, ca cifrele să rămână
-- comparabile. ⚠️ E scrisă de mână; într-o funcție automată asta devine o bombă
-- cu ceas (vezi handoff/handoff-automatizare-terenuri-noi.md).
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
    SELECT p.user_id, p.created_at
    FROM profiles p
    WHERE p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND COALESCE(p.is_demo, false) = false
      -- ⚠️ `account_status` poate fi NULL pe conturi vechi; platforma le
      --    acceptă, deci un `= 'active'` strict ar sări tăcut peste ele.
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM useri_exclusi e WHERE e.user_id = p.user_id)
),

-- Câte zone are bifate fiecare om ÎN TOTAL — pentru prag.
total_zone_per_user AS (
    SELECT upz.user_id, COUNT(*) AS nr_zone
    FROM user_preferred_zones upz
    GROUP BY upz.user_id
),

-- Terenurile, legate de zona reală și puse în săptămâna lor.
-- Potrivirea e cea din producție: lower + btrim, pe text.
terenuri_pe_saptamana AS (
    SELECT
        s.luni,
        z.id   AS zone_id,
        t.id   AS teren_id
    FROM saptamani s
    JOIN terenuri t
      ON t.created_at >= (s.luni)::timestamp     AT TIME ZONE 'Europe/Bucharest'
     AND t.created_at <  (s.luni + 7)::timestamp AT TIME ZONE 'Europe/Bucharest'
     AND t.deleted_at IS NULL
     AND t.status = 'approved'
    JOIN cities c ON lower(btrim(c.name)) = lower(btrim(t.oras))
    JOIN zones  z ON lower(btrim(z.name)) = lower(btrim(t.cartier))
                 AND z.city_id = c.id
),

-- Cine ar fi primit email, în ce săptămână.
destinatari_pe_saptamana AS (
    SELECT DISTINCT
        tps.luni,
        u.user_id
    FROM terenuri_pe_saptamana tps
    JOIN user_preferred_zones upz ON upz.zone_id = tps.zone_id
    JOIN useri_reali u            ON u.user_id   = upz.user_id
    JOIN total_zone_per_user tz   ON tz.user_id  = u.user_id
    CROSS JOIN parametri par
    WHERE tz.nr_zone <= par.prag_zone
      -- contul trebuia să existe deja în săptămâna aia
      AND u.created_at < (tps.luni + 7)::timestamp AT TIME ZONE 'Europe/Bucharest'
),

-- Un rând per săptămână, cu tot ce ne interesează.
pe_saptamana AS (
    SELECT
        s.luni,
        (SELECT COUNT(DISTINCT teren_id) FROM terenuri_pe_saptamana t WHERE t.luni = s.luni) AS terenuri_noi,
        (SELECT COUNT(DISTINCT zone_id)  FROM terenuri_pe_saptamana t WHERE t.luni = s.luni) AS zone_atinse,
        (SELECT COUNT(*)                 FROM destinatari_pe_saptamana d WHERE d.luni = s.luni) AS destinatari
    FROM saptamani s
)


-- ═════════════════════════════════════════════════════════════════════════════
-- REZULTAT — rezumatul sus, apoi săptămânile, de la cea mai recentă
-- ═════════════════════════════════════════════════════════════════════════════
SELECT 0 AS ordine,
       'ᴀ. REZUMAT'                                          AS saptamana,
       COUNT(*)::text || ' săptămâni privite'                AS terenuri_noi,
       COUNT(*) FILTER (WHERE destinatari > 0)::text
           || ' cu material'                                 AS zone_atinse,
       SUM(destinatari)::text || ' emailuri în total'        AS destinatari
FROM pe_saptamana

UNION ALL
SELECT 0,
       'ᴀ. REZUMAT',
       'media pe săptămână activă',
       COALESCE(ROUND(AVG(destinatari) FILTER (WHERE destinatari > 0), 1)::text, '—'),
       'cea mai plină: ' || COALESCE(MAX(destinatari)::text, '0') || ' emailuri'
FROM pe_saptamana

UNION ALL
SELECT 1,
       to_char(ps.luni, 'YYYY-MM-DD') || ' (luni)',
       ps.terenuri_noi::text,
       ps.zone_atinse::text,
       CASE WHEN ps.destinatari = 0
            THEN '— (săptămână tăcută)'
            ELSE ps.destinatari::text || ' emailuri'
       END
FROM pe_saptamana ps

ORDER BY ordine, saptamana DESC;

-- =============================================================================
-- CUM SE CITEȘTE
-- =============================================================================
--   • Multe „săptămâni tăcute" la rând ⇒ digestul săptămânal ar fi mai mult
--     tăcere decât email. Nu e o problemă în sine (funcția nu trimite nimic
--     când n-are ce), dar schimbă întrebarea: poate vrei „când se adună N
--     terenuri" în loc de „în fiecare luni".
--   • Rânduri mici dar constante (2–15 emailuri) ⇒ săptămânalul e potrivit.
--   • O singură săptămână uriașă și restul goale ⇒ e tiparul „import în bloc",
--     nu ritm real de platformă; atunci cifra care contează e cât de des se
--     repetă importurile, nu media.
-- =============================================================================

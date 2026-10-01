-- =============================================================================
-- 0. ANALIZA „cine doarme pe platformă" (doar cifre, o singură interogare)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor. NU modifică nimic, doar SELECT.
-- Scop: să știm CÂȚI sunt, în ce stare, și dacă emailul de trezire are unde
-- să-i trimită. Fără cifrele astea, textul emailului e ghicit.
--
-- ⚠️ Editorul SQL din Supabase arată doar rezultatul ULTIMEI interogări dintr-un
-- script. De aceea totul e O SINGURĂ interogare, cu coloana `sectiune`.
--
-- Cum se citește rezultatul: patru secțiuni, în ordine.
--   1. LOT VIU           câți oameni pot primi un email, și cine cade pe drum
--   2. SEGMENTE          ce a făcut fiecare pe platformă (A...E)
--   3. FRÂNE             ce i-ar opri dacă ar apăsa butonul din email
--   4. UNDE ÎI TRIMITEM  câte grupuri există și mai primesc oameni
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din campaniile anterioare (`emailuri-webinar-septembrie`).
    -- ⚠️ Filtrul NU prinde oamenii casei cu Gmail personal și nici adresele de
    -- mail temporar. Lista finală se citește oricum cu ochiul înainte de trimis.
    SELECT p.user_id
    FROM profiles p
    WHERE COALESCE(p.is_super_admin, false) = true
       OR COALESCE(p.is_admin, false)       = true
       OR COALESCE(p.is_demo, false)        = true
       OR COALESCE(p.cont_intern, false)    = true
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
       OR LOWER(p.email) LIKE '%@ltfbstudio.ro'
),

dezabonati AS (
    SELECT LOWER(email) AS email
    FROM newsletter_subscribers
    WHERE status = 'unsubscribed'
),

toti AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        u.created_at,
        u.last_sign_in_at,
        (p.user_id IN (SELECT user_id FROM exclusi))              AS e_exclus,
        (u.email_confirmed_at IS NULL)                            AS neconfirmat,
        (LOWER(p.email) IN (SELECT email FROM dezabonati))         AS dezabonat,
        (p.account_type = 'activ')                                AS cont_activ,
        -- ⚠️ `account_status` e NULL la conturile vechi; NULL înseamnă activ.
        (p.account_status IS NULL OR p.account_status = 'active')  AS status_ok
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
),

lot AS (
    SELECT * FROM toti
    WHERE cont_activ AND status_ok AND NOT e_exclus AND NOT neconfirmat AND NOT dezabonat
),

-- --- ce a făcut fiecare -----------------------------------------------------

-- Fondator = are un grup nearhivat pe numele lui (`grupuri.admin_id`).
fondatori AS (
    SELECT DISTINCT admin_id AS user_id
    FROM grupuri
    WHERE status IS DISTINCT FROM 'arhivat' AND admin_id IS NOT NULL
),
membri_activi AS (
    SELECT DISTINCT user_id FROM grup_membri WHERE status = 'activ'
),
-- „A cerut și așteaptă" e cu totul altceva decât „n-a făcut nimic": omul a
-- apăsat butonul, iar fondatorul nu l-a aprobat încă. Pe ăsta nu-l trezim,
-- pe ăsta îl deblocăm.
cereri_in_asteptare AS (
    SELECT DISTINCT user_id FROM grup_membri WHERE status = 'pending'
),
likeuri AS (
    SELECT user_id, COUNT(*) AS n FROM terenuri_likes GROUP BY user_id
),
zone_alese AS (
    SELECT user_id, COUNT(*) AS n FROM user_preferred_zones GROUP BY user_id
),
vizite AS (
    -- Singurul semn că omul s-a uitat la pagina unui grup. Tabela e din 18
    -- august 2026, deci nu știe nimic despre ce s-a întâmplat înainte.
    SELECT user_id, MAX(vazut_la) AS ultima FROM grup_vizite GROUP BY user_id
),

clasificat AS (
    SELECT
        l.*,
        (l.user_id IN (SELECT user_id FROM fondatori))           AS e_fondator,
        (l.user_id IN (SELECT user_id FROM membri_activi))       AS e_membru,
        (l.user_id IN (SELECT user_id FROM cereri_in_asteptare)) AS asteapta_aprobare,
        COALESCE(lk.n, 0)                                        AS nr_likeuri,
        COALESCE(z.n, 0)                                         AS nr_zone,
        v.ultima                                                 AS ultima_vizita_grup,
        -- Aceeași funcție care păzește intrarea într-un grup. Dacă întoarce
        -- `false`, butonul din email îl duce pe om într-un perete de profil.
        public.profil_complet(l.user_id)                         AS profil_ok
    FROM lot l
    LEFT JOIN likeuri    lk ON lk.user_id = l.user_id
    LEFT JOIN zone_alese z  ON z.user_id  = l.user_id
    LEFT JOIN vizite     v  ON v.user_id  = l.user_id
),

segmentat AS (
    SELECT
        c.*,
        CASE
            WHEN c.e_fondator        THEN 'A1. fondator de grup'
            WHEN c.e_membru          THEN 'A2. membru activ intr-un grup'
            WHEN c.asteapta_aprobare THEN 'B. a cerut, asteapta aprobarea'
            WHEN c.nr_likeuri > 0    THEN 'C. fara grup, dar a dat like la terenuri'
            WHEN c.nr_zone > 0       THEN 'D. fara grup, fara like, doar zone alese'
            ELSE                          'E. adormit complet'
        END AS segment
    FROM clasificat c
),

-- --- unde îi trimitem -------------------------------------------------------
grupuri_vii AS (
    SELECT
        g.id,
        g.nume,
        COALESCE(mc.membri_count, 0) AS membri
    FROM grupuri g
    LEFT JOIN grup_membri_count mc ON mc.grup_id = g.id
    WHERE g.status IS DISTINCT FROM 'arhivat'
),

fara_grup AS (
    SELECT * FROM segmentat
    WHERE segment LIKE 'C.%' OR segment LIKE 'D.%' OR segment LIKE 'E.%'
)

-- =============================================================================
-- REZULTATUL
-- =============================================================================
SELECT * FROM (
    -- 1. LOT VIU --------------------------------------------------------------
      SELECT 1 AS ord, '1. LOT VIU' AS sectiune, 'profile in total' AS ce,
             (SELECT COUNT(*) FROM toti) AS cati, '' AS detaliu
    UNION ALL SELECT 2, '1. LOT VIU', 'scosi: admin / demo / cont intern',
             (SELECT COUNT(*) FROM toti WHERE e_exclus), ''
    UNION ALL SELECT 3, '1. LOT VIU', 'scosi: email neconfirmat',
             (SELECT COUNT(*) FROM toti WHERE neconfirmat), 'nu au terminat inregistrarea'
    UNION ALL SELECT 4, '1. LOT VIU', 'scosi: dezabonati',
             (SELECT COUNT(*) FROM toti WHERE dezabonat), ''
    UNION ALL SELECT 5, '1. LOT VIU', 'scosi: cont inactiv / suspendat',
             (SELECT COUNT(*) FROM toti WHERE NOT cont_activ OR NOT status_ok), ''
    UNION ALL SELECT 6, '1. LOT VIU', 'LOT FINAL (pot primi email)',
             (SELECT COUNT(*) FROM lot), ''

    -- 2. SEGMENTE -------------------------------------------------------------
    UNION ALL
      SELECT 10, '2. SEGMENTE', s.segment, COUNT(*)::bigint,
             'cu profil complet: ' || (COUNT(*) FILTER (WHERE s.profil_ok))::text
        FROM segmentat s
       GROUP BY s.segment

    -- 3. FRANE (doar la cei fara grup: C + D + E) -----------------------------
    UNION ALL SELECT 20, '3. FRANE (C+D+E)', 'total fara niciun grup',
             (SELECT COUNT(*) FROM fara_grup), ''
    UNION ALL SELECT 21, '3. FRANE (C+D+E)', 'din ei: cu PROFIL INCOMPLET',
             (SELECT COUNT(*) FROM fara_grup WHERE NOT profil_ok),
             'butonul din email ii duce in peretele de profil'
    UNION ALL SELECT 22, '3. FRANE (C+D+E)', 'din ei: fara logare de 30+ zile',
             (SELECT COUNT(*) FROM fara_grup WHERE last_sign_in_at IS NULL OR last_sign_in_at < NOW() - INTERVAL '30 days'), ''
    UNION ALL SELECT 23, '3. FRANE (C+D+E)', 'din ei: fara logare de 90+ zile',
             (SELECT COUNT(*) FROM fara_grup WHERE last_sign_in_at IS NULL OR last_sign_in_at < NOW() - INTERVAL '90 days'), ''
    UNION ALL SELECT 24, '3. FRANE (C+D+E)', 'din ei: nu au deschis niciodata pagina unui grup',
             (SELECT COUNT(*) FROM fara_grup WHERE ultima_vizita_grup IS NULL),
             'grup_vizite exista din 18 aug., deci cifra e o limita de sus'
    UNION ALL SELECT 25, '3. FRANE (C+D+E)', 'din ei: conturi facute in ultimele 30 de zile',
             (SELECT COUNT(*) FROM fara_grup WHERE created_at > NOW() - INTERVAL '30 days'),
             'astia sunt proaspeti, nu adormiti'

    -- 4. UNDE II TRIMITEM -----------------------------------------------------
    UNION ALL SELECT 30, '4. UNDE II TRIMITEM', 'grupuri nearhivate',
             (SELECT COUNT(*) FROM grupuri_vii), ''
    UNION ALL SELECT 31, '4. UNDE II TRIMITEM', 'grupuri cu loc liber (sub 10 membri)',
             (SELECT COUNT(*) FROM grupuri_vii WHERE membri < 10), 'marimea tinta e 5-10 familii'
    UNION ALL SELECT 32, '4. UNDE II TRIMITEM', 'grupuri cu 2+ membri (au deja dinamica)',
             (SELECT COUNT(*) FROM grupuri_vii WHERE membri >= 2), 'la un grup de un om nu prea ai ce vedea'
    UNION ALL SELECT 33, '4. UNDE II TRIMITEM', 'grupuri cu macar un teren legat',
             (SELECT COUNT(DISTINCT grup_id) FROM terenuri_likes_grupuri),
             'tabela vie e terenuri_likes_grupuri, nu grup_terenuri'
    UNION ALL SELECT 34, '4. UNDE II TRIMITEM', 'terenuri publicate (approved)',
             (SELECT COUNT(*) FROM terenuri WHERE status = 'approved'), ''
) x
ORDER BY ord, ce;

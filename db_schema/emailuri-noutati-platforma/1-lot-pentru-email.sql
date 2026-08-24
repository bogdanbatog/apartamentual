-- =============================================================================
-- 1. LOTUL PENTRU EMAIL  „ce s-a schimbat pe platformă” (un rând per persoană)
-- =============================================================================
-- Se rulează DUPĂ `0-bilant.sql`, în ziua trimiterii. Rezultatul se exportă cu
-- „Download CSV” și se dă scriptului din `scripts/emailuri-noutati-platforma/`.
--
-- Filtrele sunt EXACT cele din bilanț (CTE-ul `lot`). Dacă schimbi ceva aici,
-- schimbă și acolo, altfel cifra la care te-ai uitat nu mai e lotul care pleacă.
--
-- COLOANELE PENTRU MERGE
--   email            → destinatarul
--   nume             → pseudonimul, cu spațiile de la capete tăiate. Poate fi
--                      gol: atunci emailul începe cu „Salut,” simplu.
--   profil_complet   → 'da' / 'nu'. ⚠️ DECIDE FINALUL EMAILULUI ȘI BUTONUL.
--   are_grup         → 'da' / 'nu'
--   are_teren        → 'da' / 'nu'
--
-- ⚠️ DE CE CONTEAZĂ `profil_complet`
-- Cine are profilul incomplet NU AJUNGE pe homepage. `js/nav.js:716-728` îl
-- redirectează la `/profile-edit-new.html?obligatoriu=1` de pe orice pagină a
-- site-ului. Un email care îi spune „intră în spațiul tău” l-ar trimite în altă
-- parte decât promite. De aceea scriptul îi dă alt paragraf de final și alt
-- buton. Nu scoate coloana asta din CSV: fără ea, scriptul se oprește.
--
-- ⚠️ DE CE CONTEAZĂ `are_grup` / `are_teren`
-- Cardurile „Terenurile tale” și „Grupurile tale” au `cere:'teren'` și
-- `cere:'grup'` (`frontend/index.html:4202-4204`): lipsesc cu totul pentru cine
-- n-are. Cine n-are nici grup, nici teren primește o frază care spune ce vede
-- totuși, ca să nu deschidă și să caute două carduri care nu există.
--   • „terenurile tale” = terenuri puse la favorite (`terenuri_likes`),
--     exact ce citește homepage-ul la `index.html:4308`.
--   • „grupurile tale”  = `grup_membri` cu status `activ` sau `pending`,
--     ca la `index.html:4309` (o cerere în așteptare tot îți arată cardul).
--
-- Rulează în: Supabase SQL Editor. Nu modifică nimic (doar SELECT).
-- =============================================================================

WITH exclusi AS (
    -- Identic cu blocul din `0-bilant.sql`.
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

lot AS (
    SELECT
        p.user_id,
        LOWER(p.email) AS email,
        NULLIF(TRIM(COALESCE(p.pseudonym, '')), '') AS nume,
        p.created_at,
        public.profil_complet(p.user_id) AS profil_complet,
        EXISTS (SELECT 1 FROM terenuri_likes tl WHERE tl.user_id = p.user_id) AS are_teren,
        EXISTS (SELECT 1 FROM grup_membri gm
                WHERE gm.user_id = p.user_id AND gm.status IN ('activ','pending')) AS are_grup
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND u.email_confirmed_at IS NOT NULL
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
)

SELECT
    l.email,
    COALESCE(l.nume, '')                                 AS nume,
    CASE WHEN l.profil_complet THEN 'da' ELSE 'nu' END   AS profil_complet,
    CASE WHEN l.are_grup       THEN 'da' ELSE 'nu' END   AS are_grup,
    CASE WHEN l.are_teren      THEN 'da' ELSE 'nu' END   AS are_teren,

    -- Rămâne pentru sortare și pentru verificat cu ochiul. Scriptul n-o
    -- folosește. Ora e mutată la București: `created_at` e în UTC, iar un cont
    -- făcut noaptea ar apărea cu ziua de dinainte.
    (l.created_at AT TIME ZONE 'Europe/Bucharest')::date AS inregistrat

FROM lot l
ORDER BY
    l.are_grup  DESC,   -- întâi cei care chiar au ce vedea în noul spațiu
    l.are_teren DESC,
    l.created_at ASC;   -- apoi cei mai vechi, care au apucat platforma dinainte

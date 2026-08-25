-- =============================================================================
-- 0. BILANȚUL LOTULUI  „ce s-a schimbat pe platformă” (august 2026)
-- =============================================================================
-- Se rulează ÎN ZIUA TRIMITERII, înaintea interogării 1. Nu modifică nimic.
--
-- Ce trebuie să te uiți, în ordine:
--   1. `lot final` — câți pleacă. Compară-l cu ce te așteptai; dacă e mult mai
--      mare sau mai mic, oprește-te și află de ce.
--      ⚠️ Aici scria „planul gratuit Resend = 100 emailuri/zi, peste ~80 împarte
--      lotul pe două zile". Nu mai e adevărat: din 24 august 2026 contul e pe
--      plan plătit, 50.000 de emailuri pe lună, fără plafon zilnic. Un lot de
--      campanie nu-l atinge, deci NU mai împărți nimic pe zile. Singura limită
--      rămasă e 2 cereri pe secundă, de care se ocupă scriptul (pauză 600 ms).
--      ⚠️ Cifra asta e lotul din SQL, ÎNAINTE de excluderile scrise de mână în
--      `--fara=`. Lista din previzualizare e de după ele, deci e normal să fie
--      mai mică. Nu compara direct cifra de aici cu numărătoarea de ieri.
--   2. `cu profil incomplet` — ăștia NU ajung pe homepage. `js/nav.js:716-728`
--      îi redirectează la formularul de profil de pe ORICE pagină. Ei primesc
--      alt final de email și alt buton. Dacă cifra e 0, blocul acela nu se
--      vede la nimeni și poți sări peste el la citit previzualizarea.
--   3. `fără grup și fără teren` — lor le lipsesc două carduri din cele șapte
--      (`cere:'teren'` / `cere:'grup'`, `frontend/index.html:4202-4204`).
--      Primesc fraza care spune ce le rămâne.
--      ⚠️ Cifra de aici îi numără pe TOȚI, inclusiv pe cei cu profilul
--      neterminat. Scriptul raportează un număr mai mic, fiindcă îi numără doar
--      pe cei care chiar primesc fraza (cei cu profilul complet); ceilalți
--      primesc celălalt final. Pe 25 august: 47 aici, 37 în script. Nu e o
--      neconcordanță.
--
-- ⚠️ Scris ca UN SINGUR SELECT cu UNION ALL: editorul SQL din Supabase arată
--    doar rezultatul ultimei interogări dintr-un script cu mai multe.
--
-- Rulează în: Supabase SQL Editor.
-- =============================================================================

WITH exclusi AS (
    -- Echipa, conturile interne și de test, adresele de casă.
    -- ⚠️ `cont_intern` e steagul invizibil al conturilor noastre (Carmen, Tibs);
    --    `is_demo` e cu totul altceva, badge-ul public „Exemplu”. Nu le confunda.
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
        public.profil_complet(p.user_id) AS profil_complet,
        EXISTS (SELECT 1 FROM terenuri_likes tl WHERE tl.user_id = p.user_id) AS are_teren,
        EXISTS (SELECT 1 FROM grup_membri gm
                WHERE gm.user_id = p.user_id AND gm.status IN ('activ','pending')) AS are_grup
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.account_type = 'activ'                       -- doar conturi personale
      -- ⚠️ Platforma acceptă și NULL aici. Un `= 'active'` strict ar sări tăcut
      --    peste oamenii cu coloana nesetată.
      AND (p.account_status IS NULL OR p.account_status = 'active')
      AND p.user_id NOT IN (SELECT user_id FROM exclusi)
      AND u.email_confirmed_at IS NOT NULL               -- poate intra în cont
      AND LOWER(p.email) NOT IN (SELECT email FROM dezabonati)
)

SELECT 1 AS ord, 'lot final'                    AS sectiune, COUNT(*)::text AS valoare FROM lot
UNION ALL
SELECT 2, 'cu profil complet',    COUNT(*)::text FROM lot WHERE profil_complet
UNION ALL
SELECT 3, 'cu profil incomplet (nu ajung pe homepage)', COUNT(*)::text FROM lot WHERE NOT profil_complet
UNION ALL
SELECT 4, 'au cel puțin un grup', COUNT(*)::text FROM lot WHERE are_grup
UNION ALL
SELECT 5, 'au cel puțin un teren la favorite', COUNT(*)::text FROM lot WHERE are_teren
UNION ALL
SELECT 6, 'fără grup și fără teren', COUNT(*)::text FROM lot WHERE NOT are_grup AND NOT are_teren
UNION ALL
SELECT 7, 'fără nume afișat (primesc „Salut,” simplu)', COUNT(*)::text
FROM lot l JOIN profiles p ON p.user_id = l.user_id
WHERE COALESCE(TRIM(p.pseudonym), '') = ''
UNION ALL
-- Pentru comparație: câți au fost scoși și de ce. Dacă „dezabonați” sare brusc,
-- oprește-te și uită-te de ce.
SELECT 8, 'scoși: echipă și conturi interne', COUNT(*)::text FROM exclusi
UNION ALL
SELECT 9, 'scoși: dezabonați de la newsletter', COUNT(*)::text FROM dezabonati
ORDER BY ord;

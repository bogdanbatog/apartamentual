-- =============================================================================
-- 0b. DIAGNOSTIC: zonele duplicate din `zones`
-- =============================================================================
-- NU MODIFICĂ NIMIC. Doar citește.
-- Rulează în: Supabase SQL Editor. Rulează DUPĂ `0-diagnostic-potrivire.sql`.
--
-- DE UNDE VINE
-- Secțiunea F din diagnosticul precedent a găsit 15 perechi de zone care cad pe
-- aceeași cheie: `Pacurari | Păcurari`, `Dumbravita | Dumbrăvița`, dar și
-- perechi care arată IDENTIC pe ecran: `Astra | Astra`, `Copou | Copou`.
--
-- DE CE CONTEAZĂ
-- Lista de zone din pagina de profil se citește DIN ACEASTĂ TABELĂ
-- (`profile-edit-new.js:283`, `register.js:83`). Două rânduri = două opțiuni în
-- formular, iar oamenii se împart între ele fără să-și dea seama.
-- Terenurile, în schimb, vin din `frontend/js/orase-cartiere.js`, care are o
-- SINGURĂ scriere — deci un teren cade mereu pe unul singur dintre cele două
-- id-uri. Cine a bifat celălalt nu află niciodată de terenul respectiv.
--
-- CE LĂMUREȘTE SCRIPTUL
--   1. Sunt duplicate curate, sau diferă printr-un caracter invizibil?
--   2. Câți oameni au bifat fiecare variantă? (adică: pe cine ar costa)
--   3. Pe care dintre ele cad terenurile existente?
--   4. Care variantă e „cea bună" de păstrat?
--
-- ⚠️ O SINGURĂ INTEROGARE cu UNION ALL — editorul Supabase arată doar ultimul
--    rezultat dintr-un script cu mai multe instrucțiuni.
-- =============================================================================

WITH

zone_norm AS (
    SELECT
        z.id                                    AS zone_id,
        z.name                                  AS zona_nume,
        c.name                                  AS oras_nume,
        translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS zona_moale,
        translate(regexp_replace(lower(btrim(c.name)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS oras_moale
    FROM zones z
    JOIN cities c ON c.id = z.city_id
),

-- Cheile care apar de mai multe ori = perechile problematice.
chei_duble AS (
    SELECT oras_moale, zona_moale
    FROM zone_norm
    GROUP BY oras_moale, zona_moale
    HAVING COUNT(*) > 1
),

-- Fiecare zonă implicată într-o pereche, cu tot ce știm despre ea.
zone_implicate AS (
    SELECT zn.*
    FROM zone_norm zn
    JOIN chei_duble cd
      ON cd.oras_moale = zn.oras_moale
     AND cd.zona_moale = zn.zona_moale
),

-- Câți oameni au bifat fiecare zonă.
oameni AS (
    SELECT upz.zone_id, COUNT(DISTINCT upz.user_id) AS nr_oameni
    FROM user_preferred_zones upz
    GROUP BY upz.zone_id
),

-- Câte terenuri publice cad pe fiecare zonă — potrivirea se face EXACT cum o
-- face codul azi (lower + btrim), ca cifra să fie cea reală, nu una idealizată.
terenuri_pe_zona AS (
    SELECT zi.zone_id, COUNT(DISTINCT t.id) AS nr_terenuri
    FROM zone_implicate zi
    JOIN terenuri t
      ON lower(btrim(t.cartier)) = lower(btrim(zi.zona_nume))
     AND lower(btrim(t.oras))    = lower(btrim(zi.oras_nume))
     AND t.deleted_at IS NULL
     AND t.status = 'approved'
    GROUP BY zi.zone_id
)


-- ═════════════════════════════════════════════════════════════════════════════
-- A. REZUMAT
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
    'A. rezumat'                                    AS sectiune,
    'zone implicate în perechi duble'               AS zona,
    (SELECT COUNT(*)::text FROM zone_implicate)     AS detaliu_1,
    '-'                                             AS detaliu_2,
    '-'                                             AS detaliu_3

UNION ALL
SELECT
    'A. rezumat',
    'oameni care au bifat o zonă duplicată',
    COALESCE((
        SELECT COUNT(DISTINCT upz.user_id)::text
        FROM user_preferred_zones upz
        JOIN zone_implicate zi ON zi.zone_id = upz.zone_id
    ), '0'),
    'dacă e 0, problema e teoretică — de reparat, dar fără urgență',
    '-'

UNION ALL
SELECT
    'A. rezumat',
    'terenuri publice care cad pe o zonă duplicată',
    COALESCE((SELECT SUM(nr_terenuri)::text FROM terenuri_pe_zona), '0'),
    'dacă e 0, niciun teren nu e afectat azi',
    '-'


-- ═════════════════════════════════════════════════════════════════════════════
-- B. PERECHILE, RÂND CU RÂND
-- ═════════════════════════════════════════════════════════════════════════════
-- Fiecare zonă implicată, cu id, nume în paranteze drepte (ca să se vadă
-- spațiile de la capete) și numărul de caractere.
--
-- CUM CITEȘTI:
--   • Nume care arată la fel + ACELAȘI număr de caractere → duplicat CURAT.
--     Se șterge unul, iar oamenii de pe el se mută pe celălalt.
--   • Nume care arată la fel + număr DIFERIT de caractere → e un caracter
--     invizibil (spațiu la final, spațiu insecabil). Coloana `octeti` ajută:
--     un caracter cu diacritic ocupă 2 octeți, unul simplu 1.
--   • `Pacurari` vs `Păcurari` → se păstrează varianta CU diacritice, fiindcă
--     aia se potrivește cu `frontend/js/orase-cartiere.js`. ⚠️ De verificat
--     în fișier înainte de a decide, nu din memorie.
--
-- Coloana „oameni" spune cât costă alegerea greșită.
UNION ALL
SELECT
    'B. ' || zi.oras_nume || ' / ' || zi.zona_moale,
    'id ' || zi.zone_id::text || ' → [' || zi.zona_nume || ']',
    length(zi.zona_nume)::text || ' caractere, '
        || octet_length(zi.zona_nume)::text || ' octeți',
    COALESCE(o.nr_oameni, 0)::text || ' oameni au bifat-o',
    COALESCE(tz.nr_terenuri, 0)::text || ' terenuri cad pe ea'
FROM zone_implicate zi
LEFT JOIN oameni o           ON o.zone_id  = zi.zone_id
LEFT JOIN terenuri_pe_zona tz ON tz.zone_id = zi.zone_id


-- ═════════════════════════════════════════════════════════════════════════════
-- C. OCTEȚII, PENTRU PERECHILE CARE ARATĂ IDENTIC
-- ═════════════════════════════════════════════════════════════════════════════
-- Ultima instanță: dacă două nume arată la fel ȘI au aceeași lungime, singurul
-- mod de a ști dacă diferă e să ne uităm la octeții din care sunt făcuți.
-- Două șiruri hex identice = duplicat curat, fără nicio diferență ascunsă.
--
-- Reper util: 20 = spațiu obișnuit; c8 99 = ș cu virgulă; c5 9f = ş cu sedilă;
-- c8 9b = ț cu virgulă; c5 a3 = ţ cu sedilă; c4 83 = ă; c2 a0 = spațiu insecabil.
UNION ALL
SELECT
    'C. octeți',
    zi.oras_nume || ' / [' || zi.zona_nume || ']',
    'id ' || zi.zone_id::text,
    encode(convert_to(zi.zona_nume, 'UTF8'), 'hex'),
    '-'
FROM zone_implicate zi


-- ═════════════════════════════════════════════════════════════════════════════
-- D. E DOAR LA ORAȘELE ASTEA?
-- ═════════════════════════════════════════════════════════════════════════════
-- Câte zone are fiecare oraș în total și câte dintre ele sunt duplicate.
-- Dacă Bucureștiul iese cu 0, atunci problema n-atinge deloc utilizatorii
-- de azi — dar rămâne de reparat înainte să apară terenuri în alte orașe.
UNION ALL
SELECT
    'D. pe orașe',
    zn.oras_nume,
    COUNT(*)::text || ' zone în total',
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM zone_implicate zi WHERE zi.zone_id = zn.zone_id
        )
    )::text || ' zone duplicate',
    '-'
FROM zone_norm zn
GROUP BY zn.oras_nume

ORDER BY 1, 2;

-- =============================================================================
-- CE URMEAZĂ (nu se face în acest fișier)
-- =============================================================================
-- Reparația are trei pași, în ordinea asta, și se scrie separat:
--   1. Se alege varianta care se PĂSTREAZĂ — cea care se potrivește literă cu
--      literă cu `frontend/js/orase-cartiere.js`. Se verifică în fișier.
--   2. Oamenii de pe varianta care dispare se MUTĂ pe cea păstrată
--      (UPDATE pe `user_preferred_zones.zone_id`), cu grijă la cei care au
--      bifat AMBELE variante — la ei mutarea ar crea un rând dublu.
--   3. Abia apoi se șterge zona rămasă goală.
--
-- ⚠️ Pasul 3 înaintea pasului 2 ar șterge preferințele oamenilor, dacă legătura
--    e `on delete cascade`. Ordinea nu e o preferință de stil.
-- =============================================================================

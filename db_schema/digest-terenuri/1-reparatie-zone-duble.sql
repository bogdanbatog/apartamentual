-- =============================================================================
-- 1. REPARAȚIE: ștergerea zonelor duplicate vechi din `zones`
-- =============================================================================
--
-- ✅ RULAT ȘI ÎNCHEIAT — 12 AUGUST 2026. Nu mai e nimic de făcut aici.
--    Fișierul rămâne ca documentare a ce s-a schimbat și de ce.
--
--    Ce s-a șters: 16 zone rămase din numerotarea veche —
--      • BLOC 4: 15 zone cu geamăn (id 21–29 Timișoara/Iași, 31–36 Brașov)
--      • BLOC 6: `Centru` Brașov, id 30, fără geamăn (aceeași zonă cu
--        „Centru Vechi”, confirmat de Lucian)
--    Oameni mutați: 0. Grupuri mutate: 0. Niciun teren afectat.
--
--    Starea finală, identică acum cu `frontend/js/orase-cartiere.js`:
--      București 62 | Cluj-Napoca 20 | Timișoara 18 | Iași 18 | Brașov 19
--
--    O re-rulare e inofensivă (nu mai există zone cu id sub 100 care să aibă
--    geamăn), dar inutilă.
--
-- -----------------------------------------------------------------------------
-- ⚠️ ACEST SCRIPT MODIFICĂ BAZA DE DATE. Cele două dinainte doar citeau.
--    Rulează BLOCURILE PE RÂND, în ordine, și citește ce întoarce fiecare.
--    Nu da Run pe tot fișierul deodată.
--
-- ⚠️ NU pune BEGIN / ROLLBACK aici „doar ca să probezi". Editorul SQL din
--    Supabase rulează tot ce selectezi ca O SINGURĂ tranzacție, iar un ROLLBACK
--    pus la final anulează tăcut și mutările de deasupra lui.
--
-- -----------------------------------------------------------------------------
-- CE REPARĂ, ÎN LIMBAJ CLAR
-- -----------------------------------------------------------------------------
-- Tabela `zones` are 30 de rânduri care sunt de fapt 15 zone, fiecare trecută
-- de două ori: o dată cu un id vechi (21–36) și o dată cu id-ul din convenția
-- pe intervale a proiectului (Timișoara 301+, Iași 401+, Brașov 501+).
--
-- De ce contează: lista de zone din pagina de profil se citește DIN ACEASTĂ
-- TABELĂ, deci omul vede aceeași zonă de două ori și oamenii se împart între
-- cele două variante. Terenurile, în schimb, vin din
-- `frontend/js/orase-cartiere.js`, care are o singură scriere — deci un teren
-- cade mereu pe UNA dintre copii, iar cine a bifat cealaltă nu află niciodată.
--
-- REGULA DE PĂSTRARE: rămâne id-ul din intervalul convenției (>= 100), dispare
-- cel vechi (< 100). Verificat pe octeți în `0b-diagnostic-zone-duble.sql`:
-- 13 din 15 perechi sunt identice caracter cu caracter, iar la cele două care
-- diferă (`Pacurari`/`Păcurari`, `Dumbrăvița`/`Dumbravița`) id-ul din interval
-- e cel care se potrivește cu fișierul JS. Deci regula e bună în toate cazurile.
--
-- IMPACT AZI: 2 oameni au bifat o zonă duplicată (ambii pe zone din Iași),
-- 0 terenuri cad pe vreuna. Reparația e curățenie, nu urgență.
--
-- -----------------------------------------------------------------------------
-- ORDINEA E OBLIGATORIE
-- -----------------------------------------------------------------------------
-- Întâi se MUTĂ oamenii și grupurile de pe zona veche pe cea păstrată, și abia
-- apoi se ȘTERGE zona veche. Invers, dacă legătura e `on delete cascade`,
-- ștergerea zonei ar șterge preferințele oamenilor fără niciun avertisment.
-- =============================================================================


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și citește rezultatul)
-- ═════════════════════════════════════════════════════════════════════════════
-- Trei lucruri de aflat înainte de orice atingere:
--   A. Ce tabele mai arată către `zones`? Dacă apare una la care nu ne-am
--      gândit, OPREȘTE-TE și spune-mi — trebuie tratată și ea înainte de DELETE.
--   B. Perechile, cu id-ul care pleacă și cel care rămâne.
--   C. Zonele vechi (id < 100) care NU au pereche — cazul Brașov din socoteala
--      bază vs. fișier JS. Astea NU se ating în acest script: dacă o ștergem,
--      pierdem o zonă care poate e singura ei variantă. Se decid separat.

WITH pereche AS (
    SELECT
        vechi.id        AS id_vechi,
        vechi.name      AS nume_vechi,
        nou.id          AS id_pastrat,
        nou.name        AS nume_pastrat,
        c.name          AS oras
    FROM zones vechi
    JOIN cities c ON c.id = vechi.city_id
    JOIN zones nou
      ON nou.city_id = vechi.city_id
     AND nou.id >= 100
     AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
       = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
    WHERE vechi.id < 100
)

-- A. Ce mai arată către `zones`?
SELECT
    'A. tabele care arată către zones'  AS sectiune,
    tc.table_name                       AS detaliu_1,
    kcu.column_name                     AS detaliu_2,
    rc.delete_rule                      AS detaliu_3
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
     ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
     ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu
     ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'zones'

UNION ALL

-- B. Perechile și ce se întâmplă cu fiecare.
SELECT
    'B. pereche',
    p.oras || ' / ' || p.nume_pastrat,
    'PLEACĂ id ' || p.id_vechi::text || ' [' || p.nume_vechi || ']',
    'RĂMÂNE id ' || p.id_pastrat::text || ' [' || p.nume_pastrat || ']'
FROM pereche p

UNION ALL

-- C. Zone vechi FĂRĂ pereche — nu se ating aici.
SELECT
    'C. veche fără pereche — NU se atinge',
    c.name || ' / ' || z.name,
    'id ' || z.id::text,
    'de verificat manual în frontend/js/orase-cartiere.js'
FROM zones z
JOIN cities c ON c.id = z.city_id
WHERE z.id < 100
  AND NOT EXISTS (SELECT 1 FROM pereche p WHERE p.id_vechi = z.id)

UNION ALL

-- D. Coloanele celor două tabele de legătură.
--    BLOC 1 și 2 scriu doar `(user_id, zone_id)`, respectiv `(grup_id, zone_id)`.
--    Dacă apare aici o coloană care e `NOT NULL` și n-are valoare implicită,
--    INSERT-ul ar crăpa — și trebuie adăugată în listă înainte de rulare.
SELECT
    'D. coloane ' || c.table_name,
    c.column_name,
    c.is_nullable || ' nullable',
    COALESCE(c.column_default, '(fără valoare implicită)')
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('user_preferred_zones', 'grup_preferred_zones')

ORDER BY 1, 2;

-- AȘTEPTAT:
--   A. `user_preferred_zones` și `grup_preferred_zones`. Dacă apare altceva,
--      oprește-te aici.
--   B. 15 rânduri.
--   C. Probabil 1 rând (zona de Brașov din socoteală). Notează-l — se decide
--      separat, după ce te uiți în fișierul JS dacă zona există acolo.
--   D. Fiecare coloană `NO nullable` trebuie ori să apară în INSERT-urile din
--      BLOC 1/2, ori să aibă o valoare implicită. Dacă nu, spune-mi.


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 1 — Mută OAMENII de pe zona veche pe cea păstrată
-- ═════════════════════════════════════════════════════════════════════════════
-- Se face în doi pași, nu cu un UPDATE, tocmai din cauza cazului găsit la
-- Iași/Centru: acolo aceiași oameni au bifat AMBELE variante. Un UPDATE le-ar
-- fi cerut să aibă de două ori aceeași zonă — fie eroare, fie rând dublu.
--
-- Pasul 1a: adaugă legătura către zona păstrată, DOAR dacă omul n-o are deja.
-- `WHERE NOT EXISTS` în loc de `ON CONFLICT`: merge indiferent dacă tabela are
-- sau nu o constrângere de unicitate, iar noi n-am verificat că are.

INSERT INTO user_preferred_zones (user_id, zone_id)
SELECT DISTINCT upz.user_id, nou.id
FROM user_preferred_zones upz
JOIN zones vechi ON vechi.id = upz.zone_id AND vechi.id < 100
JOIN zones nou
  ON nou.city_id = vechi.city_id
 AND nou.id >= 100
 AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
   = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferred_zones deja
    WHERE deja.user_id = upz.user_id
      AND deja.zone_id = nou.id
);

-- Pasul 1b: scoate legăturile către zonele vechi. Acum sunt de prisos —
-- fiecare om are deja legătura către zona păstrată.
--
-- ⚠️ DOAR zonele vechi CARE AU GEAMĂN. Nu „toate zonele cu id sub 100".
--    Diferența contează: `Centru` Brașov (id 30) n-are geamăn, deci INSERT-ul
--    de mai sus nu i-a pus nimic în loc. Un DELETE larg i-ar șterge omului
--    preferința fără înlocuitor — exact paguba pe care scriptul o evită.
--    Azi nu e nimeni pe id 30, dar condiția trebuie să fie corectă în sine,
--    nu din întâmplare.

DELETE FROM user_preferred_zones
WHERE zone_id IN (
    SELECT vechi.id
    FROM zones vechi
    WHERE vechi.id < 100
      AND EXISTS (
          SELECT 1 FROM zones nou
          WHERE nou.city_id = vechi.city_id
            AND nou.id >= 100
            AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
              = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
      )
);


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 2 — Același lucru pentru GRUPURI
-- ═════════════════════════════════════════════════════════════════════════════
-- `grup_preferred_zones` funcționează la fel: grupurile își declară zonele de
-- interes, iar `grupuri.js:171` le citește pentru potrivirea cu utilizatorii.
-- Azi probabil nu e niciun grup pe o zonă veche, dar blocul trebuie să existe:
-- fără el, DELETE-ul din BLOC 4 ar crăpa (sau, mai rău, ar șterge în cascadă).

INSERT INTO grup_preferred_zones (grup_id, zone_id)
SELECT DISTINCT gpz.grup_id, nou.id
FROM grup_preferred_zones gpz
JOIN zones vechi ON vechi.id = gpz.zone_id AND vechi.id < 100
JOIN zones nou
  ON nou.city_id = vechi.city_id
 AND nou.id >= 100
 AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
   = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
WHERE NOT EXISTS (
    SELECT 1 FROM grup_preferred_zones deja
    WHERE deja.grup_id = gpz.grup_id
      AND deja.zone_id = nou.id
);

-- Aceeași restrângere ca la BLOC 1b: doar zonele vechi care au geamăn.

DELETE FROM grup_preferred_zones
WHERE zone_id IN (
    SELECT vechi.id
    FROM zones vechi
    WHERE vechi.id < 100
      AND EXISTS (
          SELECT 1 FROM zones nou
          WHERE nou.city_id = vechi.city_id
            AND nou.id >= 100
            AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
              = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
      )
);


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 3 — POARTA: chiar nu mai arată nimic către zonele vechi?
-- ═════════════════════════════════════════════════════════════════════════════
-- Rulează asta ÎNAINTE de BLOC 4 și citește rezultatul.
--
-- Primele două cifre trebuie să fie 0 — sunt legăturile către zonele pe care
-- BLOC 4 chiar le va șterge. Dacă nu sunt 0, NU rula ștergerea; spune-mi.
--
-- A treia cifră e doar informativă și NU blochează nimic: câți oameni sunt pe
-- o zonă veche FĂRĂ geamăn (azi: `Centru` Brașov, id 30). Pe aia n-o ștergem,
-- deci oamenii de pe ea rămân neatinși. Dacă iese diferit de 0, e bine de
-- știut când decidem ce facem cu zona aia.

WITH de_sters AS (
    SELECT vechi.id
    FROM zones vechi
    WHERE vechi.id < 100
      AND EXISTS (
          SELECT 1 FROM zones nou
          WHERE nou.city_id = vechi.city_id
            AND nou.id >= 100
            AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
              = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
      )
)
SELECT
    (SELECT COUNT(*) FROM user_preferred_zones
      WHERE zone_id IN (SELECT id FROM de_sters))          AS oameni_ramasi,
    (SELECT COUNT(*) FROM grup_preferred_zones
      WHERE zone_id IN (SELECT id FROM de_sters))          AS grupuri_ramase,
    (SELECT COUNT(*) FROM user_preferred_zones
      WHERE zone_id IN (SELECT id FROM zones WHERE id < 100)
        AND zone_id NOT IN (SELECT id FROM de_sters))      AS oameni_pe_zone_fara_geaman;


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 4 — ȘTERGEREA zonelor vechi duplicate
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚠️ RULEAZĂ DOAR DACĂ BLOC 3 A DAT 0 ȘI 0.
--
-- Se șterg DOAR zonele vechi care AU o pereche păstrată. Zonele vechi fără
-- pereche (secțiunea C din BLOC 0) rămân neatinse, intenționat: dacă ștergem
-- una care e singura variantă a acelei zone, pierdem zona cu totul.
--
-- `RETURNING` arată exact ce s-a șters — păstrează rezultatul.

DELETE FROM zones vechi
WHERE vechi.id < 100
  AND EXISTS (
      SELECT 1 FROM zones nou
      WHERE nou.city_id = vechi.city_id
        AND nou.id >= 100
        AND translate(regexp_replace(lower(btrim(nou.name)),   '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
          = translate(regexp_replace(lower(btrim(vechi.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt')
  )
RETURNING id, name, city_id;

-- AȘTEPTAT: 15 rânduri șterse, cu id-uri între 21 și 36.


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 5 — VERIFICARE FINALĂ (nu schimbă nimic)
-- ═════════════════════════════════════════════════════════════════════════════
-- După asta, rulează din nou `0b-diagnostic-zone-duble.sql`: secțiunea B
-- trebuie să iasă goală.

SELECT
    'zone per oraș, după reparație'  AS sectiune,
    c.name                            AS oras,
    COUNT(*)::text || ' zone'         AS detaliu_1,
    COUNT(*) FILTER (WHERE z.id < 100)::text || ' rămase cu id vechi' AS detaliu_2
FROM zones z
JOIN cities c ON c.id = z.city_id
GROUP BY c.name
ORDER BY c.name;

-- AȘTEPTAT după BLOCURILE 1–4:
--   București  62 zone,  0 cu id vechi
--   Brașov     20 zone,  1 cu id vechi   ← `Centru` id 30; o rezolvă BLOC 6
--   Cluj-Napoca 20 zone, 0 cu id vechi
--   Iași       18 zone,  0 cu id vechi
--   Timișoara  18 zone,  0 cu id vechi


-- ═════════════════════════════════════════════════════════════════════════════
-- BLOC 6 — `Centru` Brașov (id 30) → `Centru Vechi`
-- ═════════════════════════════════════════════════════════════════════════════
-- DE CE SEPARAT DE BLOCURILE 1–4
-- Acolo perechile se găsesc automat, comparând numele. Aici numele DIFERĂ
-- („Centru" vs. „Centru Vechi"), deci nicio regulă automată nu le-ar lega —
-- și nici nu trebuie să le lege, altfel ar începe să potrivească zone care
-- doar seamănă. Legătura o face o decizie omenească: Lucian a confirmat pe
-- 12 august 2026 că la Brașov e vorba de aceeași zonă, iar lista veche a fost
-- rafinată ulterior în „Centru Vechi", rândul vechi rămânând în urmă.
--
-- Efectul de reparat: `Centru` apare în lista de zone din pagina de profil
-- (citită din `zones`), dar NU apare în `frontend/js/orase-cartiere.js`, de
-- unde se alimentează formularul de teren. Deci cine bifa `Centru` la Brașov
-- n-ar fi primit niciodată vreun teren — formularul oferă doar „Centru Vechi".
--
-- ⚠️ Zonele se caută DUPĂ NUME, nu după id-urile 30 / 501. Dacă vreuna nu se
--    găsește sau se găsesc mai multe, interogarea CRAPĂ în loc să lucreze pe
--    zona greșită. Oprirea zgomotoasă e intenția.
--
-- Rulează sub-blocurile pe rând, ca mai sus.

-- ── 6a. VERIFICARE (nu schimbă nimic) ──────────────────────────────────────
-- Confirmă că există exact o zonă de fiecare fel și arată câți oameni și câte
-- grupuri sunt pe cea care pleacă.

WITH b AS (
    SELECT z.id, z.name,
           translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') AS cheie
    FROM zones z
    JOIN cities c ON c.id = z.city_id
    WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
)
SELECT
    (SELECT COUNT(*) FROM b WHERE cheie = 'centru'       AND id < 100)  AS gasite_centru_vechi_id,
    (SELECT COUNT(*) FROM b WHERE cheie = 'centru vechi' AND id >= 100) AS gasite_centru_vechi_nou,
    (SELECT COUNT(*) FROM user_preferred_zones u
      WHERE u.zone_id IN (SELECT id FROM b WHERE cheie = 'centru' AND id < 100))  AS oameni_de_mutat,
    (SELECT COUNT(*) FROM grup_preferred_zones g
      WHERE g.zone_id IN (SELECT id FROM b WHERE cheie = 'centru' AND id < 100))  AS grupuri_de_mutat;

-- AȘTEPTAT: primele două cifre = 1 și 1. Dacă nu, OPREȘTE-TE.


-- ── 6b. Mută oamenii ───────────────────────────────────────────────────────
INSERT INTO user_preferred_zones (user_id, zone_id)
SELECT DISTINCT u.user_id,
       (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
         WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
           AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru vechi'
           AND z.id >= 100)
FROM user_preferred_zones u
WHERE u.zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                    WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                      AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
                      AND z.id < 100)
  AND NOT EXISTS (
      SELECT 1 FROM user_preferred_zones deja
      WHERE deja.user_id = u.user_id
        AND deja.zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                             WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                               AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru vechi'
                               AND z.id >= 100)
  );

DELETE FROM user_preferred_zones
WHERE zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                  WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                    AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
                    AND z.id < 100);


-- ── 6c. Mută grupurile ─────────────────────────────────────────────────────
INSERT INTO grup_preferred_zones (grup_id, zone_id)
SELECT DISTINCT g.grup_id,
       (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
         WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
           AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru vechi'
           AND z.id >= 100)
FROM grup_preferred_zones g
WHERE g.zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                    WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                      AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
                      AND z.id < 100)
  AND NOT EXISTS (
      SELECT 1 FROM grup_preferred_zones deja
      WHERE deja.grup_id = g.grup_id
        AND deja.zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                             WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                               AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru vechi'
                               AND z.id >= 100)
  );

DELETE FROM grup_preferred_zones
WHERE zone_id = (SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
                  WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
                    AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
                    AND z.id < 100);


-- ── 6d. POARTA — ambele cifre trebuie 0 înainte de ștergere ────────────────
WITH vechea AS (
    SELECT z.id FROM zones z JOIN cities c ON c.id = z.city_id
    WHERE translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
      AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
      AND z.id < 100
)
SELECT
    (SELECT COUNT(*) FROM user_preferred_zones WHERE zone_id IN (SELECT id FROM vechea)) AS oameni_ramasi,
    (SELECT COUNT(*) FROM grup_preferred_zones WHERE zone_id IN (SELECT id FROM vechea)) AS grupuri_ramase;


-- ── 6e. Ștergerea ──────────────────────────────────────────────────────────
-- ⚠️ RULEAZĂ DOAR DACĂ 6d A DAT 0 ȘI 0.
DELETE FROM zones z
USING cities c
WHERE c.id = z.city_id
  AND translate(lower(btrim(c.name)), 'ăâîșşțţ', 'aaisstt') = 'brasov'
  AND translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'), 'ăâîșşțţ', 'aaisstt') = 'centru'
  AND z.id < 100
RETURNING z.id, z.name;

-- AȘTEPTAT: un singur rând — id 30, `Centru`.
--
-- După asta, rulează din nou BLOC 5. Brașovul trebuie să iasă cu 19 zone și
-- 0 cu id vechi, iar `0b-diagnostic-zone-duble.sql` trebuie să iasă gol.
-- =============================================================================

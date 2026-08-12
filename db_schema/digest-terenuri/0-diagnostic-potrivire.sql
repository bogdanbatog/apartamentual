-- =============================================================================
-- 0. DIAGNOSTIC: se leagă terenurile de zonele bifate de oameni?
-- =============================================================================
-- NU MODIFICĂ NIMIC. Doar citește. Poți să-l rulezi oricând, de câte ori vrei.
-- Rulează în: Supabase SQL Editor.
--
-- LA CE FOLOSEȘTE
-- Terenurile țin cartierul ca TEXT (`terenuri.cartier`), iar oamenii își bifează
-- zonele ca LEGĂTURĂ către tabela `zones` (`user_preferred_zones.zone_id`).
-- Cele două se împreunează abia la trimiterea emailului, comparând litere.
-- Dacă literele diferă cu ceva — un diacritic, un spațiu, o sedilă în loc de
-- virgulă — potrivirea eșuează ÎN TĂCERE: terenul apare normal pe site și pur
-- și simplu nu ajunge la nimeni. Nicio eroare, nicăieri.
--
-- Scriptul măsoară exact cât de mare e gaura, ACUM, pe toate terenurile publice.
--
-- ⚠️ SCRIS CA O SINGURĂ INTEROGARE, cu UNION ALL și o coloană `sectiune`.
--    Editorul SQL din Supabase afișează doar rezultatul ULTIMEI instrucțiuni
--    dintr-un script, deci cinci SELECT-uri separate ar arăta un singur tabel.
--
-- CUM SE CITEȘTE REZULTATUL
--    Secțiunea A = rezumatul. Dacă „nu se leagă deloc" și „salvate doar de
--    normalizare" sunt amândouă 0, totul e curat azi.
--    Secțiunea C e cea importantă: terenuri care AR trebui să se lege, dar nu
--    se leagă din cauza scrierii. Fiecare rând de acolo = oameni care n-au
--    aflat de un teren din zona lor.
-- =============================================================================

WITH

-- ─────────────────────────────────────────────────────────────────────────────
-- Cele două chei de comparație
-- ─────────────────────────────────────────────────────────────────────────────
-- `cheie_exacta` = exact ce face astăzi codul care trimite emailurile:
--     lower() + btrim(). Atât. Un „ţ" cu sedilă rămâne diferit de „ț" cu virgulă.
--
-- `cheie_moale` = aceeași comparație, dar cu diacriticele topite la litera de
--     bază și spațiile multiple strânse la unul singur. E o comparație mai
--     iertătoare, folosită AICI DOAR CA MĂSURĂTOARE — ca să vedem ce potriviri
--     s-ar face dacă scrierea ar fi curată.
--
-- Diferența dintre cele două = exact pierderile tăcute de azi.
--
-- În lista de tradus sunt AMBELE forme ale lui ș și ț:
--     ș (U+0219, virgulă dedesubt — corectă în românește)
--     ş (U+015F, sedilă — forma veche, turcească; arată aproape la fel)
--     ț (U+021B, virgulă)  /  ţ (U+0163, sedilă)
-- Confuzia dintre ele e cea mai frecventă cauză de nepotrivire tăcută, fiindcă
-- ochiul nu le distinge. (Precedent: în `frontend/js/orase-cartiere.js`,
-- „Griviţa" e scris cu sedilă, deși tot restul fișierului folosește virgula.)
-- lower() se aplică ÎNAINTE, deci în listă e destul forma mică a fiecărei litere.

zone_norm AS (
    SELECT
        z.id                                    AS zone_id,
        z.name                                  AS zona_nume,
        c.name                                  AS oras_nume,
        lower(btrim(z.name))                    AS zona_exacta,
        lower(btrim(c.name))                    AS oras_exact,
        translate(regexp_replace(lower(btrim(z.name)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS zona_moale,
        translate(regexp_replace(lower(btrim(c.name)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS oras_moale
    FROM zones z
    JOIN cities c ON c.id = z.city_id
),

-- Doar terenurile VIZIBILE PUBLIC. Cele `pending` sau șterse n-au de ce să
-- ajungă în emailuri, deci o nepotrivire la ele nu strică nimic încă.
teren_norm AS (
    SELECT
        t.id                                    AS teren_id,
        t.titlu,
        t.oras,
        t.cartier,
        t.created_at,
        lower(btrim(t.cartier))                 AS cartier_exact,
        lower(btrim(t.oras))                    AS oras_exact,
        translate(regexp_replace(lower(btrim(t.cartier)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS cartier_moale,
        translate(regexp_replace(lower(btrim(t.oras)), '\s+', ' ', 'g'),
                  'ăâîșşțţ', 'aaisstt')         AS oras_moale
    FROM terenuri t
    WHERE t.deleted_at IS NULL
      AND t.status = 'approved'
      AND t.cartier IS NOT NULL
      AND t.oras    IS NOT NULL
),

-- Fiecare teren, încercat pe ambele chei.
legatura AS (
    SELECT
        tn.teren_id,
        tn.titlu,
        tn.oras,
        tn.cartier,
        tn.created_at,
        ze.zone_id      AS zona_gasita_exact,
        zm.zone_id      AS zona_gasita_moale,
        zm.zona_nume    AS zona_scrisa_corect
    FROM teren_norm tn
    LEFT JOIN zone_norm ze
           ON ze.zona_exacta = tn.cartier_exact
          AND ze.oras_exact  = tn.oras_exact
    LEFT JOIN zone_norm zm
           ON zm.zona_moale = tn.cartier_moale
          AND zm.oras_moale = tn.oras_moale
),

-- Câți oameni au bifat fiecare zonă — ca să putem spune nu doar „un teren
-- nu se leagă", ci „un teren nu ajunge la N oameni".
oameni_pe_zona AS (
    SELECT upz.zone_id, COUNT(DISTINCT upz.user_id) AS nr_oameni
    FROM user_preferred_zones upz
    GROUP BY upz.zone_id
)


-- ═════════════════════════════════════════════════════════════════════════════
-- A. REZUMAT — citește asta prima
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
    'A. rezumat'                                        AS sectiune,
    'terenuri publice, în total'                        AS detaliu_1,
    COUNT(*)::text                                      AS detaliu_2,
    '-'                                                 AS detaliu_3
FROM legatura

UNION ALL
SELECT
    'A. rezumat',
    'se leagă corect (așa cum face codul azi)',
    COUNT(*) FILTER (WHERE zona_gasita_exact IS NOT NULL)::text,
    'ăstea ajung la oameni'
FROM legatura

UNION ALL
SELECT
    'A. rezumat',
    '⚠️ pierdute din cauza scrierii (vezi secțiunea C)',
    COUNT(*) FILTER (WHERE zona_gasita_exact IS NULL
                       AND zona_gasita_moale IS NOT NULL)::text,
    'zona EXISTĂ, dar textul diferă — reparabil'
FROM legatura

UNION ALL
SELECT
    'A. rezumat',
    '⚠️ nu se leagă deloc (vezi secțiunea D)',
    COUNT(*) FILTER (WHERE zona_gasita_exact IS NULL
                       AND zona_gasita_moale IS NULL)::text,
    'cartierul nu există în `zones`'
FROM legatura


-- ═════════════════════════════════════════════════════════════════════════════
-- C. PIERDERILE TĂCUTE — lista de aur
-- ═════════════════════════════════════════════════════════════════════════════
-- Terenuri pentru care zona EXISTĂ în bază, dar textul de pe teren e scris
-- altfel. Fiecare rând de aici e un teren care n-a ajuns la nimeni, deși ar
-- fi trebuit. `detaliu_3` arată cum e scris corect în `zones` — diferența
-- dintre cele două e adesea invizibilă cu ochiul liber.
UNION ALL
SELECT
    'C. pierdut din cauza scrierii',
    'teren: ' || COALESCE(l.titlu, '(fără titlu)'),
    'pe teren scrie: [' || l.cartier || '] (oraș: ' || l.oras || ')',
    'în `zones` scrie: [' || l.zona_scrisa_corect || '] — bifată de '
        || COALESCE(op.nr_oameni, 0)::text || ' oameni'
FROM legatura l
LEFT JOIN oameni_pe_zona op ON op.zone_id = l.zona_gasita_moale
WHERE l.zona_gasita_exact IS NULL
  AND l.zona_gasita_moale IS NOT NULL


-- ═════════════════════════════════════════════════════════════════════════════
-- D. CARTIERE CARE NU EXISTĂ DELOC ÎN `zones`
-- ═════════════════════════════════════════════════════════════════════════════
-- Aici nu e o greșeală de scriere, ci o zonă lipsă din bază — sau un oraș
-- scris altfel. Se repară adăugând zona (ca la Corbeanca), nu corectând textul.
UNION ALL
SELECT
    'D. cartier inexistent în zones',
    'oraș: ' || l.oras || ' / cartier: ' || l.cartier,
    COUNT(*)::text || ' terenuri',
    'de adăugat în `zones`, sau orașul e scris altfel decât în `cities`'
FROM legatura l
WHERE l.zona_gasita_exact IS NULL
  AND l.zona_gasita_moale IS NULL
GROUP BY l.oras, l.cartier


-- ═════════════════════════════════════════════════════════════════════════════
-- E. SEDILE ÎN TABELA `zones`
-- ═════════════════════════════════════════════════════════════════════════════
-- Zone al căror nume conține ş sau ţ CU SEDILĂ în loc de virgulă. Nu e o
-- problemă în sine dacă și fișierul JS le scrie la fel — dar e o mină, fiindcă
-- oricine le rescrie „corect" rupe potrivirea fără să-și dea seama.
-- Zero rânduri aici = curat.
UNION ALL
SELECT
    'E. sedile în zones',
    z.zona_nume,
    'oraș: ' || z.oras_nume,
    'conține ş/ţ cu SEDILĂ, nu cu virgulă — de verificat față de orase-cartiere.js'
FROM zone_norm z
WHERE z.zona_nume ~ '[şţŞŢ]'


-- ═════════════════════════════════════════════════════════════════════════════
-- F. ZONE CARE S-AR CONFUNDA ÎNTRE ELE
-- ═════════════════════════════════════════════════════════════════════════════
-- Control de sănătate pentru măsurătoarea de mai sus: dacă două zone diferite
-- din același oraș ajung la aceeași „cheie moale", atunci secțiunea C ar putea
-- arăta o potrivire greșită. Așteptat: zero rânduri.
UNION ALL
SELECT
    'F. zone care se confundă',
    z.oras_moale || ' / ' || z.zona_moale,
    COUNT(*)::text || ' zone diferite cad pe aceeași cheie',
    string_agg(z.zona_nume, ' | ' ORDER BY z.zona_nume)
FROM zone_norm z
GROUP BY z.oras_moale, z.zona_moale
HAVING COUNT(*) > 1

ORDER BY 1, 2;

-- =============================================================================
-- CE FACI CU REZULTATUL
-- =============================================================================
--   • Secțiunea C goală  → potrivirea e curată azi. Coloana `zone_id` propusă
--     pentru automatizare rămâne o măsură de precauție, nu o reparație.
--   • Secțiunea C are rânduri → sunt deja terenuri care nu ajung la nimeni.
--     Reparația e un UPDATE pe `terenuri.cartier` (textul din `zones`, litera
--     cu literă) + corectarea aceleiași scrieri în `frontend/js/orase-cartiere.js`,
--     altfel următorul teren postat din acel cartier reface problema.
--     ⚠️ UPDATE-ul se scrie separat, se citește împreună și se rulează cu ochii
--     pe el — acest fișier nu modifică nimic, intenționat.
--   • Secțiunea D are rânduri → zone lipsă, de adăugat pe tiparul din
--     `db_schema/zona-corbeanca/`.
-- =============================================================================

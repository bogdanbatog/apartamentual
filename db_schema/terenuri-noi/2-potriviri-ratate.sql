-- =============================================================================
-- 2. ⚠️ TERENURI CARE NU AJUNG LA NIMENI  (ruleaza AL DOILEA)
-- =============================================================================
-- Selecteaza TOT fisierul si apasa Run. O singura interogare. Doar SELECT.
--
-- ASTA E VERIFICAREA CARE CONTEAZA CEL MAI MULT DIN TOATA CAMPANIA.
--
-- DE CE
-- -----
-- Terenurile tin zona ca TEXT, in `oras` + `cartier`. Utilizatorii tin zonele
-- ca LEGATURI catre tabela `zones` (`user_preferred_zones.zone_id`). Ca sa
-- stim cui ii pasa de un teren, trebuie sa potrivim textul cu numele zonei.
--
-- Comentariul din `frontend/js/orase-cartiere.js` spune ca numele "trebuie sa
-- fie IDENTICE cu cele din tabelul zones". Aia e o INTENTIE scrisa intr-un
-- comentariu, nu o regula pe care baza de date o impune. Un diacritic diferit
-- ("Grivita" vs "Griviţa"), un spatiu in plus sau un cartier scris altfel
-- ("Titan" in loc de "Balta Alba / Titan") rup potrivirea IN TACERE: terenul
-- nu apare la nimeni si nu primesti nicio eroare.
--
-- CUM CITESTI REZULTATUL
-- ----------------------
--   0 randuri  -> perfect, toate terenurile se potrivesc. Treci la fisierul 3.
--   N randuri  -> fiecare rand e un teren despre care NU va fi anuntat nimeni.
--                 Coloana `motiv` iti spune de ce. Se repara din admin
--                 (Terenuri -> Modifica -> cartierul corect din lista), apoi
--                 re-rulezi fisierul asta pana iese gol.
-- =============================================================================

SELECT
    t.titlu,
    t.oras,
    t.cartier,
    t.status,
    CASE
        WHEN t.cartier IS NULL OR btrim(t.cartier) = ''
            THEN 'cartier GOL — terenul nu e legat de nicio zona'
        WHEN t.oras IS NULL OR btrim(t.oras) = ''
            THEN 'oras GOL'
        WHEN NOT EXISTS (SELECT 1 FROM cities c
                         WHERE lower(btrim(c.name)) = lower(btrim(t.oras)))
            THEN 'orasul nu exista in tabela `cities` sub numele asta'
        ELSE 'cartierul nu exista in `zones` sub numele asta (scriere diferita?)'
    END AS motiv,
    t.id
FROM terenuri t
WHERE t.deleted_at IS NULL
  AND t.status = 'approved'
  -- doar terenurile noi; daca vrei sa vezi problema pe tot istoricul,
  -- sterge cele doua randuri de mai jos
  AND t.created_at >= ((DATE '2026-07-30')::timestamp AT TIME ZONE 'Europe/Bucharest')
  AND NOT EXISTS (
      -- potrivirea "curata": ignora spatiile de la capete si diferentele de
      -- litere mari/mici, dar NU ignora diacriticele (alea chiar conteaza)
      SELECT 1
      FROM zones z
      JOIN cities c ON c.id = z.city_id
      WHERE lower(btrim(z.name)) = lower(btrim(t.cartier))
        AND lower(btrim(c.name)) = lower(btrim(t.oras))
  )
ORDER BY t.oras, t.cartier;

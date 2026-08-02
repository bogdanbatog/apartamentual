-- =============================================================================
-- 1. CE TERENURI AVEM, DE FAPT  (ruleaza PRIMUL)
-- =============================================================================
-- Selecteaza TOT fisierul si apasa Run. E o singura interogare, nu are blocuri
-- comentate. Nu modifica nimic (doar SELECT).
--
-- CE CAUTAM AICI, IN ORDINE:
--
--   1. Se vad cele 19 terenuri adaugate pe 30 iulie?
--      Numara randurile cu `adaugat_pe` = 2026-07-30.
--
--   2. Ce status au? Doar cele `approved` se vad public. N-are sens sa anuntam
--      pe cineva despre un teren `pending`, pe care nu-l poate deschide.
--
--   3. ⚠️ CARE COLOANA DE DATA E CEA BUNA?
--      Tabela `terenuri` are DOUA date: `created_at` (cand a intrat randul in
--      baza) si `data_adaugat` (data afisata public pe pagina terenului,
--      `teren-details.js:586`). De obicei coincid, dar daca terenurile au fost
--      importate sau li s-a pus o data manual, difera -- si atunci un filtru
--      pe coloana gresita le rateaza in tacere.
--      Coloana `ATENTIE` de mai jos iti spune daca s-au despartit undeva.
--
--   4. `cartier` e completat peste tot? Un teren fara cartier nu se poate lega
--      de nicio zona, deci nu ajunge la nimeni.
--
-- Se uita la ultimele 40 de terenuri, indiferent de data, ca sa vezi si
-- contextul din jur, nu doar ce credem noi ca s-a adaugat pe 30.
-- =============================================================================

SELECT
    -- Datele, aduse la ora Romaniei (in baza sunt stocate in UTC)
    (t.created_at   AT TIME ZONE 'Europe/Bucharest')::date AS adaugat_pe,
    (t.data_adaugat AT TIME ZONE 'Europe/Bucharest')::date AS data_afisata_public,

    CASE
        WHEN t.data_adaugat IS NULL THEN '— data_adaugat e goala'
        WHEN (t.data_adaugat AT TIME ZONE 'Europe/Bucharest')::date
           <> (t.created_at   AT TIME ZONE 'Europe/Bucharest')::date
            THEN '⚠️ DATE DIFERITE'
        ELSE 'ok'
    END AS atentie,

    t.status,
    t.oras,
    t.cartier,
    CASE WHEN t.cartier IS NULL OR btrim(t.cartier) = ''
         THEN '⚠️ FARA CARTIER' ELSE '' END AS lipsa_cartier,
    t.titlu
FROM terenuri t
WHERE t.deleted_at IS NULL
ORDER BY t.created_at DESC
LIMIT 40;

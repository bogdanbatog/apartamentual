-- =============================================================================
-- 0. VERIFICARE INAINTE DE A ADAUGA ZONA "Corbeanca"  (ruleaza PRIMUL)
-- =============================================================================
-- Nu modifica nimic. Doar citeste.
--
-- De ce e nevoie de pasul asta: nu stiu din repo daca `zones.id` se completeaza
-- singur (secventa / identity) sau se scrie de mana. De raspunsul asta depinde
-- CARE dintre cele doua variante din fisierul 1 se ruleaza.
--
-- Scris ca O SINGURA interogare cu UNION ALL, fiindca editorul SQL din Supabase
-- afiseaza doar rezultatul ULTIMEI instructiuni dintr-un script.
-- Ruleaza in: Supabase SQL Editor.
-- =============================================================================

-- A) Coloanele tabelei `zones` + daca `id` are valoare implicita
--    ATENTIE la randul cu column_name = 'id':
--      * daca "detaliu_2" (identitate) scrie "YES" sau "detaliu_3" (implicit)
--        contine ceva de forma nextval(...)  -> foloseste VARIANTA B din fisierul 1
--      * daca ambele sunt goale                -> foloseste VARIANTA A (implicita)
SELECT
    'A. coloane zones'                  AS sectiune,
    column_name                         AS detaliu_1,
    is_identity                         AS detaliu_2,
    COALESCE(column_default, '(fara)')  AS detaliu_3
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'zones'

UNION ALL

-- B) Cum se numeste exact orasul in tabela `cities` (diacriticele conteaza:
--    inserarea din fisierul 1 cauta orasul dupa numele "București")
SELECT
    'B. orase',
    c.name,
    c.id::text,
    '-'
FROM cities c

UNION ALL

-- C) Situatia zonelor Bucurestiului: cate sunt, ce id maxim si ce
--    display_order maxim au (asteptat: 61 de zone, id maxim 161)
SELECT
    'C. zone Bucuresti',
    'cate zone: '        || COUNT(*)::text,
    'id maxim: '         || COALESCE(MAX(z.id)::text, '(niciuna)'),
    'ordine maxima: '    || COALESCE(MAX(z.display_order)::text, '(niciuna)')
FROM zones z
JOIN cities c ON c.id = z.city_id
WHERE c.name = 'București'

UNION ALL

-- D) Exista deja ceva care seamana cu "Corbeanca"? (ca sa nu o adaugam de doua ori
--    si ca sa prindem o eventuala scriere diferita)
SELECT
    'D. exista deja Corbeanca?',
    z.name,
    'id: ' || z.id::text,
    'oras: ' || COALESCE(c.name, '(fara oras)')
FROM zones z
LEFT JOIN cities c ON c.id = z.city_id
WHERE z.name ILIKE '%corbeanc%'

ORDER BY 1, 2;

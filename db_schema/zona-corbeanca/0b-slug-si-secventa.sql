-- =============================================================================
-- 0b. A DOUA VERIFICARE — slug-ul si secventa  (ruleaza dupa 0, inainte de 1)
-- =============================================================================
-- Nu modifica nimic. Doar citeste.
--
-- De ce a fost nevoie de inca un pas: rularea lui `0-verificare.sql` a scos la
-- iveala o coloana pe care nu o stiam, `slug`, fara valoare implicita — nicio
-- pagina din frontend nu o citeste, deci nu aparea nicaieri in repo. Inserarea
-- din fisierul 1 ar fi crapat pe ea. Aici aflu ce forma are, ca sa nu inventez.
--
-- Al doilea lucru: `id` are default `nextval('zones_id_seq')`, dar id-urile
-- existente (101-161, 201-220, ... 501-519) par puse de mana. Daca e asa,
-- secventa a ramas in urma si o inserare care s-ar baza pe ea ar cere un id
-- deja ocupat. Aici vad exact unde a ramas.
--
-- Scris ca O SINGURA interogare cu UNION ALL (editorul Supabase arata doar
-- rezultatul ultimei instructiuni). Ruleaza in: Supabase SQL Editor.
-- =============================================================================

-- A) Ce forma au slug-urile: primele si ultimele zone ale Bucurestiului.
--    Ma uit daca e "baneasa" sau "bucuresti-baneasa", cu sau fara diacritice,
--    si cum se trateaza numele compuse ("Dămăroaia / Petrom").
SELECT
    'A. exemple de slug'    AS sectiune,
    z.id::text              AS detaliu_1,
    z.name                  AS detaliu_2,
    z.slug                  AS detaliu_3
FROM zones z
WHERE z.city_id = 1
  AND (z.id <= 105 OR z.id >= 157)

UNION ALL

-- B) Se poate lasa `slug` gol? Si `display_order`? (nu am cerut nullabilitatea
--    la pasul 0, doar valoarea implicita)
SELECT
    'B. se poate lasa gol?',
    column_name,
    'accepta NULL: ' || is_nullable,
    '-'
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'zones'

UNION ALL

-- C) Restrictii pe tabela: exista index unic pe `slug`? Daca da, valoarea pe
--    care o punem trebuie sa fie libera in TOATA tabela, nu doar la Bucuresti.
SELECT
    'C. restrictii',
    con.conname,
    con.contype::text,          -- p = cheie primara, u = unic, f = cheie straina
    pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public' AND rel.relname = 'zones'

UNION ALL

-- D) Unde a ramas secventa fata de cel mai mare id din tabela.
--    Daca "ultima valoare" e mult sub "id maxim in tabela", secventa e in urma
--    si o inserare fara id explicit ar cere un id deja ocupat -> eroare.
SELECT
    'D. secventa zones_id_seq',
    'ultima valoare: ' || s.last_value::text,
    'a fost folosita: ' || s.is_called::text,
    'id maxim in tabela: ' || (SELECT MAX(z.id)::text FROM zones z)
FROM zones_id_seq s

UNION ALL

-- E) Exista deja un slug care ar intra in conflict cu "corbeanca"?
SELECT
    'E. slug ocupat?',
    z.id::text,
    z.name,
    z.slug
FROM zones z
WHERE z.slug ILIKE '%corbeanc%'

ORDER BY 1, 2;

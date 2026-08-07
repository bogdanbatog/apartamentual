-- =============================================================================
-- 1. ADAUGA ZONA "Corbeanca" LA BUCURESTI
-- =============================================================================
-- Context: un utilizator vrea sa porneasca un grup de CASE in Corbeanca (comuna
-- in Ilfov). Experiment discret: adaugam zona, vedem daca se aduna oameni.
--
-- De ce zona a Bucurestiului si nu oras nou: platforma are deja precedentul —
-- Floresti / Baciu stau sub Cluj-Napoca, Dumbravita / Giroc / Mosnita Noua sub
-- Timisoara, Ghimbav / Sanpetru / Cristian sub Brasov. Toate sunt comune
-- periurbane, nu cartiere. Ca oras separat, Corbeanca ar fi invizibila pentru
-- cine cauta in Bucuresti — adica exact publicul ei.
--
-- Scris pe baza a doua verificari rulate pe 7 august (`0-verificare.sql` si
-- `0b-slug-si-secventa.sql`). Ce au schimbat fata de prima mea varianta:
--
--   1. Tabela are o coloana `slug`, NOT NULL, fara valoare implicita. Nicio
--      pagina din frontend nu o citeste, deci nu aparea nicaieri in repo.
--      Prima varianta nu o completa si ar fi crapat.
--   2. Slug-urile sunt fara diacritice, cu minuscule si cratime, FARA prefix de
--      oras: "aparatorii-patriei", "bucuresti-noi", "imgb". Deci "corbeanca".
--   3. Restrictia de unicitate e UNIQUE (city_id, slug) — pe pereche, nu pe
--      slug singur. "corbeanca" trebuie sa fie liber doar la Bucuresti, si e.
--   4. `id` are default nextval('zones_id_seq'), DAR secventa a ramas la 36, in
--      timp ce id-urile reale merg pana la 519. O inserare care s-ar baza pe
--      secventa ar da id-ul 37 — liber, deci fara eroare, dar in afara
--      conventiei pe intervale (Bucuresti 101-161, Cluj 201+, ... Brasov 501+).
--      De aceea scriem id-ul explicit: 162.
--   5. `display_order` oglindeste id-ul (maximul la Bucuresti e tot 161), deci
--      Corbeanca primeste 162 si la ordine. Apare la coada listei de bife.
--
-- NOTA despre secventa: o lasam la 36, neatinsa. Nu e stricata — id-urile 37-100
-- sunt libere. Zonele se adauga oricum cu id scris de mana, ca sa respecte
-- intervalele pe orase; secventa nu e folosita de nimeni.
--
-- Scriptul e idempotent: daca zona exista deja, nu insereaza nimic si nu da
-- eroare. Poti sa-l rulezi de doua ori fara consecinte.
--
-- Ruleaza in: Supabase SQL Editor. NU atinge plati, RLS sau alte tabele.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- INSERAREA
-- ---------------------------------------------------------------------------
-- Valorile nu sunt scrise "de-a gata": id-ul si ordinea se calculeaza din ce e
-- deja in tabela pentru Bucuresti, iar `city_id` se ia cautand orasul dupa nume.
-- Asa scriptul ramane corect si daca intre timp s-a mai adaugat o zona.
INSERT INTO zones (id, name, slug, city_id, display_order)
SELECT
    (SELECT MAX(z.id) FROM zones z WHERE z.city_id = c.id) + 1,   -- asteptat: 162
    'Corbeanca',
    'corbeanca',
    c.id,                                                          -- Bucuresti = 1
    COALESCE((SELECT MAX(z.display_order) FROM zones z WHERE z.city_id = c.id), 0) + 1
FROM cities c
WHERE c.name = 'București'
  AND NOT EXISTS (
        SELECT 1 FROM zones z
        WHERE z.city_id = c.id
          AND (z.name = 'Corbeanca' OR z.slug = 'corbeanca')
  );


-- ---------------------------------------------------------------------------
-- CONTROL — ce a iesit
-- ---------------------------------------------------------------------------
-- Asteptat: EXACT UN rand — id 162, zona "Corbeanca", slug "corbeanca",
-- oras "București", ordine 162.
--
-- Numele trebuie sa fie exact "Corbeanca" (fara diacritice, C mare). Frontendul
-- potriveste zonele PE TEXT in filtrele de pe /terenuri si /utilizatori — nu
-- exista cheie straina intre tabela si lista din `js/orase-cartiere.js`. O
-- litera diferita rupe legatura in tacere si zona nu ajunge la nimeni.
SELECT
    z.id,
    z.name          AS zona,
    z.slug,
    c.name          AS oras,
    z.display_order AS ordine
FROM zones z
JOIN cities c ON c.id = z.city_id
WHERE z.name = 'Corbeanca' OR z.slug = 'corbeanca';

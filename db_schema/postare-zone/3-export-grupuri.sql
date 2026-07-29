-- =============================================================================
-- 3. EXPORT: GRUPURILE REALE (non-demo)
-- =============================================================================
-- Coloane: nume grup, zonele asociate (concatenate), numarul de membri.
--
-- ⚠️ DOUA NUME DE CONFIRMAT INAINTE DE RULARE (vezi rezultatul lui 0):
--   1) coloana cu numele grupului din `grupuri` -- mai jos e scrisa `g.nume`.
--      Daca in 0b apare `name` sau `titlu`, inlocuieste peste tot in fisier.
--   2) tabelul de membri -- mai jos e `grup_membri` cu coloanele grup_id/user_id.
--      In 000_init.sql apare ca `grup_membership`, deci numele s-a schimbat
--      cel putin o data. Foloseste numele care apare in 0a.
-- Daca rulezi fara sa confirmi, Postgres da eroare de tipul
-- `column g.nume does not exist` -- inofensiva (e doar SELECT), dar corecteaza.
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- Export: butonul "Download CSV".
-- =============================================================================

SELECT
    g.nume                                   AS nume_grup,
    COALESCE(g.status, '(fara status)')       AS status,
    -- Zonele asociate, pe un singur rand. Separator bara, ca sa nu rupa CSV-ul.
    COALESCE(
        (SELECT string_agg(z.name, ' | ' ORDER BY z.name)
         FROM grup_preferred_zones gpz
         JOIN zones z ON z.id = gpz.zone_id
         WHERE gpz.grup_id = g.id),
        '(fara zone)'
    )                                         AS zone_asociate,
    -- Numarul de membri. Subinterogare, nu JOIN + COUNT: cu doua JOIN-uri
    -- (zone si membri) numaratorile se inmultesc intre ele si ies cifre umflate.
    (SELECT COUNT(DISTINCT gm.user_id)
     FROM grup_membri gm
     WHERE gm.grup_id = g.id)                 AS nr_membri
FROM grupuri g
WHERE COALESCE(g.is_demo, false) = false
ORDER BY nr_membri DESC, nume_grup;


-- ---------------------------------------------------------------------------
-- VARIANTA fara tabelul de membri
-- ---------------------------------------------------------------------------
-- Daca in 0a nu exista niciun tabel de membri (sau are alta structura), ruleaza
-- varianta asta ca sa ai macar grupurile si zonele, si spune-mi ce ai vazut in
-- 0a ca sa rescriu numaratoarea de membri corect.
--
-- SELECT
--     g.nume AS nume_grup,
--     COALESCE(g.status, '(fara status)') AS status,
--     COALESCE(string_agg(z.name, ' | ' ORDER BY z.name), '(fara zone)') AS zone_asociate
-- FROM grupuri g
-- LEFT JOIN grup_preferred_zones gpz ON gpz.grup_id = g.id
-- LEFT JOIN zones z ON z.id = gpz.zone_id
-- WHERE COALESCE(g.is_demo, false) = false
-- GROUP BY g.id, g.nume, g.status
-- ORDER BY nume_grup;

-- =============================================================================
-- 3. GRUPURILE în care îi trimitem (de citit cu ochiul, înainte de a scrie cifre
--    în email)
-- =============================================================================
-- Se rulează în Supabase → SQL Editor. Doar SELECT, nu modifică nimic.
--
-- De ce: emailul de trezire spune „cere alăturarea la un grup care există deja".
-- Promisiunea asta stă în picioare doar dacă grupurile sunt reale (nu exemple),
-- au loc liber, și au ceva de văzut înăuntru. Dacă din cele 8 grupuri 3 sunt
-- exemple și 2 sunt goale de activitate, cifra din email minte fără să vrem.
--
-- La ce te uiți:
--   - `exemplu = true`: grup marcat „Exemplu", NU se pune la socoteală
--   - `loc_liber`: câte locuri mai sunt până la `max_members`
--   - `ultimul_anunt`: dacă e vechi de luni de zile, omul intră într-o cameră goală
--   - `terenuri_legate`: fără niciun teren, grupul e încă doar o intenție
-- =============================================================================

WITH membri AS (
    SELECT grup_id, COUNT(*) AS activi
    FROM grup_membri
    WHERE status = 'activ'
    GROUP BY grup_id
),
cereri AS (
    SELECT grup_id, COUNT(*) AS in_asteptare
    FROM grup_membri
    WHERE status = 'pending'
    GROUP BY grup_id
),
terenuri_leg AS (
    -- Tabela vie e `terenuri_likes_grupuri`. `grup_terenuri` e goală și induce
    -- în eroare.
    SELECT grup_id, COUNT(*) AS n
    FROM terenuri_likes_grupuri
    GROUP BY grup_id
),
anunturi AS (
    SELECT grup_id, COUNT(*) AS n, MAX(created_at) AS ultimul
    FROM grup_anunturi
    GROUP BY grup_id
),
zonele AS (
    SELECT gpz.grup_id, STRING_AGG(z.name, ', ' ORDER BY z.name) AS zone
    FROM grup_preferred_zones gpz
    JOIN zones z ON z.id = gpz.zone_id
    GROUP BY gpz.grup_id
)

SELECT
    g.nume,
    COALESCE(g.is_demo, false)                                AS exemplu,
    g.status,
    COALESCE(m.activi, 0)                                     AS membri_activi,
    g.max_members                                             AS locuri_total,
    GREATEST(COALESCE(g.max_members, 0) - COALESCE(m.activi, 0), 0) AS loc_liber,
    COALESCE(c.in_asteptare, 0)                               AS cereri_in_asteptare,
    COALESCE(t.n, 0)                                          AS terenuri_legate,
    COALESCE(a.n, 0)                                          AS anunturi,
    (a.ultimul AT TIME ZONE 'Europe/Bucharest')::date          AS ultimul_anunt,
    (g.created_at AT TIME ZONE 'Europe/Bucharest')::date       AS grup_din,
    p.pseudonym                                               AS fondator,
    zl.zone
FROM grupuri g
LEFT JOIN membri       m  ON m.grup_id  = g.id
LEFT JOIN cereri       c  ON c.grup_id  = g.id
LEFT JOIN terenuri_leg t  ON t.grup_id  = g.id
LEFT JOIN anunturi     a  ON a.grup_id  = g.id
LEFT JOIN zonele       zl ON zl.grup_id = g.id
LEFT JOIN profiles     p  ON p.user_id  = g.admin_id
WHERE g.status IS DISTINCT FROM 'arhivat'
ORDER BY COALESCE(g.is_demo, false), COALESCE(m.activi, 0) DESC;

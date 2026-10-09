-- =============================================================================
-- 0. VERIFICARE — ce grupuri exemplu avem și cine e în ele
-- =============================================================================
-- STRICT SELECT. Nu schimbă nimic. Rulează-l înainte de 1-arhiveaza.sql.
--
-- Un rând pe grup marcat `is_demo = true`. Coloanele de urmărit:
--   status            — ce status are acum (după arhivare va fi „arhivat")
--   membri_exemplu    — membri care sunt personaje inventate (is_demo)
--   membri_interni    — conturile noastre / de test (cont_intern)
--   membri_reali      — ⚠️ oameni reali. Dacă e > 0, cineva real e într-un
--                       grup exemplu și va rămâne „fără grup" după arhivare.
--                       Coloana `nume_reali` spune cine.
-- =============================================================================

SELECT
    g.id,
    g.nume,
    g.status,
    g.created_at::date                                              AS creat_la,
    COUNT(m.user_id)                                                AS membri_total,
    COUNT(m.user_id) FILTER (WHERE COALESCE(p.is_demo, false))      AS membri_exemplu,
    COUNT(m.user_id) FILTER (WHERE NOT COALESCE(p.is_demo, false)
                               AND COALESCE(p.cont_intern, false))  AS membri_interni,
    COUNT(m.user_id) FILTER (WHERE NOT COALESCE(p.is_demo, false)
                               AND NOT COALESCE(p.cont_intern, false)) AS membri_reali,
    STRING_AGG(p.pseudonym, ', ') FILTER (WHERE NOT COALESCE(p.is_demo, false)
                               AND NOT COALESCE(p.cont_intern, false)) AS nume_reali
FROM public.grupuri g
LEFT JOIN public.grup_membri m ON m.grup_id = g.id
LEFT JOIN public.profiles    p ON p.user_id = m.user_id
WHERE COALESCE(g.is_demo, false) = true
GROUP BY g.id, g.nume, g.status, g.created_at
ORDER BY g.created_at;

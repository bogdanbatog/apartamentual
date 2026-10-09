-- =============================================================================
-- 0b. CINE SUNT oamenii reali din grupurile exemplu
-- =============================================================================
-- STRICT SELECT. Nu schimbă nimic.
--
-- 0-verificare.sql a găsit 4 oameni reali (Alint, Robert, Alex, Mihai Voda)
-- în două grupuri exemplu. Înainte de arhivare vrem să știm, pentru fiecare:
--   status_in_exemplu — „activ" = membru aprobat; altceva = doar a cerut intrarea
--   intrat_la         — când a intrat / a cerut
--   grupuri_reale     — în câte grupuri REALE, nearhivate, mai e (status activ).
--                       0 = după arhivare rămâne fără niciun grup.
--   email             — ca să-i putem scrie, dacă hotărăști asta.
-- Un rând pe pereche (om, grup exemplu). Alint apare de două ori.
-- =============================================================================

SELECT
    p.pseudonym,
    p.email,
    g.nume                                          AS grup_exemplu,
    m.status                                        AS status_in_exemplu,
    m.joined_at::date                               AS intrat_la,
    (SELECT COUNT(*)
       FROM public.grup_membri m2
       JOIN public.grupuri     g2 ON g2.id = m2.grup_id
      WHERE m2.user_id = m.user_id
        AND COALESCE(g2.is_demo, false) = false
        AND g2.status IS DISTINCT FROM 'arhivat'
        AND m2.status = 'activ')                    AS grupuri_reale,
    p.account_status
FROM public.grup_membri m
JOIN public.grupuri     g ON g.id = m.grup_id
JOIN public.profiles    p ON p.user_id = m.user_id
WHERE COALESCE(g.is_demo, false)     = true
  AND COALESCE(p.is_demo, false)     = false
  AND COALESCE(p.cont_intern, false) = false
ORDER BY p.pseudonym, g.nume;

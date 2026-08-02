-- =============================================================================
-- 3. ZONELE CARE AU PRIMIT TERENURI NOI  (ruleaza AL TREILEA)
-- =============================================================================
-- Selecteaza TOT fisierul si apasa Run. O singura interogare. Doar SELECT.
--
-- Asta e, practic, continutul emailurilor, vazut dinspre zone: in ce zone au
-- aparut terenuri si cati oameni au bifat zonele alea.
--
-- CUM CITESTI:
--   `terenuri_noi`          — cate terenuri au aparut in zona
--   `oameni_cu_zona_bifata` — cati utilizatori (oricare, inclusiv demo/echipa)
--                             au zona asta bifata. Daca e 0, terenul de acolo
--                             nu intereseaza inca pe nimeni -> nu produce email.
--
-- Suma din `oameni_cu_zona_bifata` NU e numarul de destinatari: un om poate
-- avea mai multe zone si se numara la fiecare. Numarul real de oameni iese
-- abia din fisierul 4.
-- =============================================================================

SELECT
    c.name AS oras,
    z.name AS zona,
    COUNT(DISTINCT t.id) AS terenuri_noi,
    (SELECT COUNT(*) FROM user_preferred_zones upz WHERE upz.zone_id = z.id)
        AS oameni_cu_zona_bifata
FROM terenuri t
JOIN cities c ON lower(btrim(c.name)) = lower(btrim(t.oras))
JOIN zones  z ON lower(btrim(z.name)) = lower(btrim(t.cartier))
             AND z.city_id = c.id
WHERE t.deleted_at IS NULL
  AND t.status = 'approved'
  AND t.created_at >= ((DATE '2026-07-30')::timestamp AT TIME ZONE 'Europe/Bucharest')
GROUP BY c.name, z.name, z.id
ORDER BY terenuri_noi DESC, oameni_cu_zona_bifata DESC;

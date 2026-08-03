-- =============================================================================
-- 2. AU MERS EMAILURILE DE REAMINTIRE?  (bilant scurt)
-- =============================================================================
-- Interogarea 1 iti da lista pe nume. Asta iti da cifra: din cei carora le-ai
-- scris, cati si-au completat profilul dupa aceea si cati nu.
--
-- ⚠️ Cifra e valabila doar pentru adresele din lista de mai jos. Daca ai
-- completat lista in interogarea 1 cu adrese noi din Trimise, copiaza aceeasi
-- lista si aici — altfel cele doua interogari raspund la intrebari diferite.
--
-- ⚠️ Nu putem sti daca cineva a completat profilul DIN CAUZA emailului. Baza de
-- date nu retine cand a fost modificat ultima oara profilul (nu exista
-- `updated_at` verificat pe `profiles`). Deci cifra spune "cati au profil
-- complet azi", nu "cati au reactionat la email".
--
-- Ruleaza in: Supabase SQL Editor. Nu modifica nimic (doar SELECT).
-- =============================================================================

WITH notificati AS (
    -- ✏️ Aceeasi lista ca in interogarea 1. Tine-le identice.
    SELECT LOWER(email) AS email
    FROM (VALUES
        ('vlad.radu@gmail.com'),
        ('cristian_punct@yahoo.com'),
        ('adrianrosv@gmail.com'),
        ('tventarnii.artur@gmail.com'),
        ('carmen2000ro@yahoo.com'),
        ('bogdancezarsapcaliu@gmail.com'),
        ('mihai.mitel.31@gmail.com'),
        ('mariusanisiei@gmail.com')
    ) AS t(email)
),

stare AS (
    SELECT
        LOWER(p.email) AS email,
        (p.pseudonym IS NOT NULL AND p.pseudonym <> '')
        AND (p.profession IS NOT NULL AND p.profession <> '')
        AND (p.phone IS NOT NULL AND p.phone <> '')
        AND p.age IS NOT NULL
        AND p.preferred_rooms IS NOT NULL
        AND p.preferred_area_sqm IS NOT NULL
        AND p.preferred_city_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM user_preferred_zones z WHERE z.user_id = p.user_id)
        AND EXISTS (SELECT 1 FROM user_tags t WHERE t.user_id = p.user_id)
            AS profil_complet,
        (p.pseudonym IS NOT NULL AND p.pseudonym <> '') AS a_inceput
    FROM profiles p
)

SELECT
    COUNT(*)                                          AS notificati_gasiti_in_baza,
    COUNT(*) FILTER (WHERE s.profil_complet)          AS au_completat,
    COUNT(*) FILTER (WHERE NOT s.profil_complet
                       AND s.a_inceput)               AS au_inceput_dar_nu_au_terminat,
    COUNT(*) FILTER (WHERE NOT s.a_inceput)           AS nu_au_atins_formularul
FROM notificati n
JOIN stare s ON s.email = n.email;

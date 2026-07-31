-- ═══════════════════════════════════════════════════════════════════
-- Ce ARE DE AFISAT pagina de grup pentru „Parcul Circului"
-- Reproduce exact ce face grup-details.html: ia membrii, le ataseaza
-- profilul, taie soft-deleted, si calculeaza numele afisat.
-- DOAR CITIRE.
-- ═══════════════════════════════════════════════════════════════════


-- ── A. Exista cumva DOUA grupuri cu nume asemanator? ────────────────
-- Daca da, poate te uiti la celalalt. Cel din CSV are id-ul
-- 75a1c2cf-6683-4802-8ff8-1a236661f82f.
SELECT id, nume, status, admin_id, max_membri, created_at
FROM public.grupuri
WHERE nume ILIKE '%circ%';


-- ── B. Toti membrii grupului, exact cum ii vede interfata ───────────
-- `nume_afisat` reproduce functia displayName() din grup-details.html:
--   pseudonim, altfel partea din fata a emailului, altfel „Utilizator".
-- `vizibil_in_ui` reproduce filtrul de la linia 1421:
--   se taie randurile fara profil sau cu account_status = 'deleted'.
SELECT
    gm.status                                   AS status_membru,
    COALESCE(
        NULLIF(TRIM(p.pseudonym), ''),
        SPLIT_PART(p.email, '@', 1),
        'Utilizator'
    )                                           AS nume_afisat,
    u.email,
    p.account_status,
    p.is_demo,
    gm.joined_at,
    CASE
        WHEN p.user_id IS NULL            THEN 'NU - profil inexistent'
        WHEN p.account_status = 'deleted' THEN 'NU - profil sters'
        ELSE 'DA'
    END                                         AS vizibil_in_ui
FROM public.grup_membri gm
LEFT JOIN auth.users u      ON u.id = gm.user_id
LEFT JOIN public.profiles p ON p.user_id = gm.user_id
WHERE gm.grup_id = '75a1c2cf-6683-4802-8ff8-1a236661f82f'
ORDER BY gm.status, gm.joined_at;


-- ── C. Numaratoare scurta ───────────────────────────────────────────
-- Cate randuri sunt in tabela vs cate ar trebui sa se vada pe pagina.
SELECT
    gm.status,
    COUNT(*)                                                    AS in_baza_de_date,
    COUNT(*) FILTER (
        WHERE p.user_id IS NOT NULL
          AND COALESCE(p.account_status, '') <> 'deleted'
    )                                                           AS vizibile_pe_pagina
FROM public.grup_membri gm
LEFT JOIN public.profiles p ON p.user_id = gm.user_id
WHERE gm.grup_id = '75a1c2cf-6683-4802-8ff8-1a236661f82f'
GROUP BY gm.status;

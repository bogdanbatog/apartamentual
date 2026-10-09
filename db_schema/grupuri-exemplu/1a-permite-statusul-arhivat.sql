-- =============================================================================
-- 1a. PERMITE statusul „arhivat" pe grupuri (schimbare de schemă)
-- =============================================================================
-- De ce: regula `grupuri_status_check` accepta doar
--   deschis, cu_aprobare, activ, explorare, inchis
-- dar codul site-ului filtra deja `status <> 'arhivat'` în patru locuri
-- (js/grupuri.js, index.html, js/profile-view-new.js, js/teren-details.js).
-- Filtrul era mort: niciun grup nu putea fi arhivat. Descoperit pe
-- 9 octombrie 2026, când 1-arhiveaza.sql a fost refuzat cu eroarea 23514.
--
-- Ce face: înlocuiește regula cu una identică + valoarea „arhivat".
-- Cele cinci valori vechi rămân valabile; niciun rând existent nu se schimbă.
--
-- Rulează-l ÎNAINTE de 1-arhiveaza.sql. Totul e într-o singură tranzacție:
-- dacă ceva crapă, regula veche rămâne pe loc.
-- =============================================================================

BEGIN;

ALTER TABLE public.grupuri
    DROP CONSTRAINT grupuri_status_check;

ALTER TABLE public.grupuri
    ADD CONSTRAINT grupuri_status_check
    CHECK (status::text = ANY (ARRAY[
        'deschis', 'cu_aprobare', 'activ', 'explorare', 'inchis',
        'arhivat'                                  -- ← singura valoare nouă
    ]::text[]));

COMMIT;

-- Verificare: trebuie să apară „arhivat" la sfârșitul listei.
SELECT pg_get_constraintdef(oid) AS regula
FROM pg_constraint
WHERE conname = 'grupuri_status_check';

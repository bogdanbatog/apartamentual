-- =============================================================================
-- 1. ARHIVEAZĂ grupurile exemplu (decizia lui Lucian, 9 octombrie 2026)
-- =============================================================================
-- Ce face: trece pe `status = 'arhivat'` toate grupurile cu `is_demo = true`.
--
-- Efectul pe site: grupurile arhivate nu mai apar în nicio listă. Le filtrează
-- deja codul existent: pagina de grupuri (js/grupuri.js), homepage-ul logat
-- (index.html), grupurile din profil (js/profile-view-new.js) și pagina unui
-- teren (js/teren-details.js). Nu trebuie schimbat nimic în cod pentru asta.
--
-- Ce NU face:
--   • nu șterge nimic: membrii, terenurile apreciate, jurnalul rămân în bază;
--   • nu atinge `is_demo` (grupul rămâne marcat exemplu, util la statistici);
--   • nu atinge utilizatorii-exemplu (Cristina Moldovan, Bogdan Radu etc.).
--
-- Rămâne o scăpare: cine are linkul direct (grup-details.html?id=...) poate
-- încă deschide pagina grupului. Acolo apare în continuare badge-ul „Exemplu".
--
-- Cum revii: UPDATE public.grupuri SET status = '<statusul vechi>'
--            WHERE id = '<id>';  (statusul vechi îl ai din 0-verificare.sql)
-- =============================================================================

UPDATE public.grupuri
   SET status     = 'arhivat',
       updated_at = now()
 WHERE COALESCE(is_demo, false) = true
   AND status IS DISTINCT FROM 'arhivat'
RETURNING id, nume, status;

-- Așteptat: câte un rând pentru fiecare grup din 0-verificare.sql care nu
-- era deja arhivat. Notează-ți statusul vechi din 0-verificare, dacă vrei
-- să poți reveni exact la el.

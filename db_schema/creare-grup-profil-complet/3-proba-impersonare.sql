-- ═══════════════════════════════════════════════════════════════════
--  PROBA CARE CHIAR DOVEDEȘTE CEVA
--
--  DE CE E NEVOIE DE EA: controalele din fișierul 1 arată că politica
--  EXISTĂ și e scrisă corect. Nu arată că REFUZĂ pe cineva. În SQL
--  Editor ești `postgres`: `auth.uid()` e NULL și RLS-ul nu te atinge,
--  deci orice INSERT de aici „merge" și nu dovedește nimic.
--
--  Se rulează în TREI pași, fiecare într-un tab NOU și gol.
--  ⚠️ Pașii B și C conțin ROLLBACK. Editorul Supabase rulează tot
--  tabul ca o singură tranzacție, iar ROLLBACK-ul anulează TOT ce e în
--  el (lecția din 1 august). De aia fiecare pas stă singur în tabul lui.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
--  PASUL A — găsește UUID-urile de care ai nevoie
--  Rulează asta singură. Copiază cele două UUID-uri din rezultat.
-- ═══════════════════════════════════════════════════════════════════
--
-- Îți trebuie două conturi:
--   • unul cu profilul INCOMPLET → INSERT-ul trebuie să PICE
--   • unul cu profilul COMPLET   → INSERT-ul trebuie să TREACĂ
--
-- ⚠️ NU folosi superadminul pentru cel „complet": el trece prin
-- `is_platform_admin()` și ascunde exact ce vrei să vezi. Coloana
-- `atentie` te avertizează.

SELECT CASE WHEN public.profil_complet(u.id)
            THEN 'COMPLET   → INSERT-ul trebuie să TREACĂ'
            ELSE 'INCOMPLET → INSERT-ul trebuie să PICE' END AS foloseste_pentru,
       u.id   AS uuid_de_copiat,
       u.email,
       CASE WHEN COALESCE(p.is_super_admin, false)
            THEN '⚠️ SUPERADMIN — nu-l folosi, trece pe deasupra'
            ELSE 'ok' END AS atentie,
       u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email ILIKE '%test%'
   OR u.email ILIKE 'luta.lucian%'
   OR u.email = 'max@susanu.com'
ORDER BY public.profil_complet(u.id), u.created_at DESC;


-- ═══════════════════════════════════════════════════════════════════
--  PASUL B — profil INCOMPLET: INSERT-ul TREBUIE SĂ PICE
--
--  Tab NOU și gol. Decomentează, înlocuiește UUID-ul, rulează.
--
--  ✅ REZULTAT AȘTEPTAT: eroare
--       „new row violates row-level security policy for table grupuri"
--  ❌ Dacă scrie „Success" fără eroare, poarta NU ține. Oprește-te și
--     spune-mi — nu deploya nimic mai departe.
-- ═══════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-PROFIL-INCOMPLET","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   INSERT INTO public.grupuri (nume, oras, status, created_by, admin_id)
--   VALUES ('Proba RLS — de sters daca o vezi', 'București', 'explorare',
--           'UUID-PROFIL-INCOMPLET', 'UUID-PROFIL-INCOMPLET');
-- ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
--  PASUL C — profil COMPLET: INSERT-ul TREBUIE SĂ TREACĂ
--
--  Tab NOU și gol. Fără el, proba de la pasul B nu înseamnă nimic: o
--  politică ce refuză pe TOATĂ lumea ar trece și ea testul B, dar ar
--  rupe crearea de grup pentru toți.
--
--  ✅ REZULTAT AȘTEPTAT: „INSERT 0 1", apoi ROLLBACK-ul îl șterge.
--  ❌ Dacă pică, politica e prea strictă. Blocul de revenire e la
--     finalul fișierului 1.
--
--  ⚠️ ROLLBACK-ul e OBLIGATORIU — altfel rămâne un grup de probă
--     vizibil pe site.
-- ═══════════════════════════════════════════════════════════════════
--
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-PROFIL-COMPLET","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   INSERT INTO public.grupuri (nume, oras, status, created_by, admin_id)
--   VALUES ('Proba RLS — de sters daca o vezi', 'București', 'explorare',
--           'UUID-PROFIL-COMPLET', 'UUID-PROFIL-COMPLET');
-- ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
--  PASUL D — control de curățenie, după B și C
--  Tab nou. Așteptat: 0 rânduri. Dacă apare ceva, un ROLLBACK n-a ținut
--  și trebuie șters manual grupul de probă.
-- ═══════════════════════════════════════════════════════════════════

SELECT id, nume, created_at
FROM public.grupuri
WHERE nume LIKE 'Proba RLS%';


-- ═══════════════════════════════════════════════════════════════════
--  ȘI PROBELE DIN INTERFAȚĂ, care contează la fel de mult
-- ═══════════════════════════════════════════════════════════════════
-- Politica poate fi perfectă, iar pagina să arate în continuare o
-- eroare seacă. Cu frontendul deployat pe cPanel:
--
--   1. cont cu profil INCOMPLET (contul de test), pe /grup-nou.html
--      → „Mai e un pas", NU formularul și NU o eroare roșie
--   2. butonul de acolo duce la profil; după salvare te întorci SINGUR
--      pe formularul de creare grup (asta probează `?redirect=`)
--   3. cont cu profil COMPLET → formularul apare ca înainte, grupul se
--      creează, iar fondatorul apare imediat ca membru activ cu
--      eticheta „Admin"  ⚠️ dacă pasul 3 pică, excepția fondatorului
--      din `grup_membri` s-a rupt — e cel mai important de verificat
--   4. înregistrare nouă din „Pornește un grup" → linkul din email duce
--      la PROFIL, nu direct la crearea grupului
--
-- ⚠️ La pasul 3 se creează un grup REAL. Șterge-l după.

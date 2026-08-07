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
--
--  ⚠️ Când INSERT-ul crapă (adică exact când proba REUȘEȘTE), editorul
--  arată doar eroarea, nu și rezultatul SELECT-ului de control de
--  deasupra. E în regulă: eroarea E răspunsul. Dacă vrei totuși să vezi
--  controlul, selectează cu mouse-ul doar primele trei rânduri ale
--  blocului (BEGIN, set_config, SET LOCAL, SELECT) și rulează-le
--  singure, apoi blocul întreg.
-- ═══════════════════════════════════════════════════════════════════
--
-- UUID-urile de mai jos sunt completate din CSV 74 (7 august).
-- Contul: luta.lucian.m+test98@gmail.com — cel cu care Lucian a
-- reprodus traseul lui Max pe 7 august. Profil gol pe toate cele șase.
--
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"c5315c99-377c-40d5-817b-f4a668024fc7","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   -- Control înainte de probă: contul NU trebuie să fie admin de
--   -- platformă, altfel trece prin prima ramură a politicii și proba
--   -- nu dovedește nimic. Aici `auth.uid()` e setat, deci funcția
--   -- răspunde corect (în afara impersonării ar fi NULL).
--   -- Așteptat: is_platform_admin = false, profil_complet = false
--   SELECT public.is_platform_admin() AS is_platform_admin,
--          public.profil_complet(auth.uid()) AS profil_complet;
--
--   INSERT INTO public.grupuri (nume, oras, status, created_by, admin_id)
--   VALUES ('Proba RLS — de sters daca o vezi', 'București', 'explorare',
--           'c5315c99-377c-40d5-817b-f4a668024fc7',
--           'c5315c99-377c-40d5-817b-f4a668024fc7');
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
-- Contul: luta.lucian.m+test12@gmail.com, profil complet.
--
-- ⚠️ DE CE NU CONTUL PRINCIPAL (`luta.lucian.m@gmail.com`):
-- coloana `atentie` de la pasul A verifică `is_super_admin`, dar
-- politica trece prin `is_platform_admin()` — sunt DOUĂ flaguri
-- diferite (capcana din 30 iulie). Un cont admin prin celălalt flag ar
-- trece proba pe ramura de admin, fără să atingă condiția de profil, și
-- ar da un „merge" fals. Controlul de mai jos închide întrebarea
-- oricum: dacă `is_platform_admin` iese `true`, schimbă contul.
--
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"bb7c9ca6-6cf3-42aa-bec8-9c13ca3657c6","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   -- Așteptat: is_platform_admin = FALSE, profil_complet = TRUE.
--   -- Dacă is_platform_admin e true, proba nu dovedește nimic —
--   -- alege alt cont din lista „COMPLET" de la pasul A.
--   SELECT public.is_platform_admin() AS is_platform_admin,
--          public.profil_complet(auth.uid()) AS profil_complet;
--
--   INSERT INTO public.grupuri (nume, oras, status, created_by, admin_id)
--   VALUES ('Proba RLS — de sters daca o vezi', 'București', 'explorare',
--           'bb7c9ca6-6cf3-42aa-bec8-9c13ca3657c6',
--           'bb7c9ca6-6cf3-42aa-bec8-9c13ca3657c6');
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

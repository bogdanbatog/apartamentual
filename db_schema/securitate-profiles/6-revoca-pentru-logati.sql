-- ═══════════════════════════════════════════════════════════════════
--  PASUL D — inchide efectiv gaura: nici utilizatorii LOGATI nu mai
--  citesc coloanele sensibile din `public.profiles`
--
--  ⚠ NU RULA ASTA inainte de a fi facut, IN ORDINE:
--     1. 4-view-si-functii-pentru-logati.sql   (rulat, 1 august)
--     2. deploy `notify-admins`                (facut, 1 august)
--     3. 5-lista-invitatii-grup.sql            (ruleaza-l inainte!)
--     4. codul de frontend URCAT PE cPANEL     (Pasul C)
--     5. fisierul asta                         (inchide gaura)
--
--  In ordinea gresita, paginile utilizatorilor logati raman fara date:
--  panoul de admin se goleste, navigarea crapa, invitatiile nu mai merg.
-- ═══════════════════════════════════════════════════════════════════
--
--  CONTEXT. Pe 1 august dimineata s-a inchis accesul ANONIM (fisierul
--  3). Rolul `authenticated` a ramas insa cu `GRANT SELECT` pe TOATA
--  tabela, deliberat: paginile de grup isi adunau in browser emailurile
--  membrilor si le pasau lui `notify-admins`.
--
--  Intre timp, poarta e gata:
--    • `profiles_visible` — citirea, cu regulile de intimitate aplicate
--      pe server (fisierul 4);
--    • `notify-admins` rezolva adresele din `user_id`-uri, cu service
--      role (deployat pe 1 august);
--    • `create_group_invitation` si `list_group_invitations` fac pe
--      server tot ce cerea inainte adresa in browser.
--
--  Frontendul a fost mutat integral pe ele in Pasul C. Fisierul asta
--  taie ultimul fir.
-- ═══════════════════════════════════════════════════════════════════


--  ⚠ NU PUNE NICIODATA `BEGIN ... ROLLBACK` in acelasi script cu
--  REVOKE/GRANT. Editorul SQL din Supabase ruleaza TOT scriptul ca o
--  singura tranzactie; un `ROLLBACK` scris undeva mai jos anuleaza si
--  modificarile de mai sus, tacut, dupa ce controalele au afisat deja
--  rezultate care par bune. Exact asa a picat prima incercare, pe
--  1 august 2026. Probele „ca un utilizator obisnuit" se ruleaza
--  SEPARAT, in alt tab.
-- ═══════════════════════════════════════════════════════════════════


-- ── Pasul 0 (diagnostic): cine are drept de citire pe tabela ────────
-- Ne intereseaza daca apare `PUBLIC` in lista. Daca da, `authenticated`
-- mosteneste dreptul de acolo si revocarea de mai jos nu e de ajuns
-- singura. (Pe 1 august nu aparea; verifica din nou, e ieftin.)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'SELECT'
ORDER BY grantee;


-- ── Pasul 1: ia-i lui `authenticated` dreptul global de citire ──────
-- Fara asta, un GRANT pe coloane n-ar avea efect: dreptul la nivel de
-- tabela le acopera oricum pe toate.
--
-- ⚠ Se revoca DOAR `SELECT`. `UPDATE` ramane neatins, deci salvarea
-- profilului merge mai departe. (Verificat in Pasul C: nicio scriere
-- din frontend nu cere date inapoi cu `.select()`, iar `user_id`, pe
-- care se face `.eq(...)`, ramane citibil mai jos.)
REVOKE SELECT ON public.profiles FROM authenticated;


-- ── Pasul 2: da-i inapoi DOAR coloanele nevinovate ──────────────────
-- Exact aceeasi lista de 20 ca la `anon`, pe 1 august.
-- Lipsesc intentionat: email, phone, first_name, last_name, notes,
-- is_admin, is_super_admin, suspended_until, age, varsta, anul_nasterii.
-- Toate se citesc de acum prin `profiles_visible`, care le da doar cui
-- are dreptul la ele.
GRANT SELECT (
    user_id,
    pseudonym,
    account_type,
    account_status,
    is_demo,
    created_at,
    updated_at,
    description,
    profesie,
    profession,
    zona,
    preferred_area_sqm,
    preferred_city_id,
    preferred_rooms,
    tip_apartament_cauta,
    agency_name,
    agency_website,
    agency_description,
    is_email_public,
    is_age_public
) ON public.profiles TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL — ruleaza dupa, ca sa vezi ca a prins
-- ═══════════════════════════════════════════════════════════════════

-- A. Ce coloane mai poate citi `authenticated` direct din tabela.
--    Trebuie sa iasa exact 20 de randuri, iar `email`, `phone`,
--    `notes`, `is_super_admin` sa NU apara.
SELECT column_name
FROM information_schema.column_privileges
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'SELECT'
ORDER BY column_name;

-- B. Poarta merge in continuare: view-ul si functiile sunt SECURITY
--    DEFINER, deci NU se rup odata cu revocarea.
SELECT count(*) AS randuri_prin_view FROM public.profiles_visible;


-- ═══════════════════════════════════════════════════════════════════
--  PROBELE — ⚠ RULEAZA-LE SEPARAT, IN ALT TAB, niciodata in acelasi
--  script cu REVOKE/GRANT de mai sus.
-- ═══════════════════════════════════════════════════════════════════
--
--  1. Ca utilizator obisnuit, tabela nu mai da emailuri.
--     Inlocuieste UUID-ul cu al unui cont de test (Carmen sau Tibs).
--
--       BEGIN;
--         SELECT set_config('request.jwt.claims',
--                '{"sub":"PUNE-AICI-UUID-UL","role":"authenticated"}', true);
--         SET LOCAL role authenticated;
--         SELECT email FROM public.profiles LIMIT 1;   -- trebuie sa CRAPE
--       ROLLBACK;
--
--     Mesajul asteptat: „permission denied for column email".
--
--  2. Acelasi utilizator, prin view: primeste randuri, dar aproape
--     numai emailuri NULL — doar cele 13 legitime (1 agentie + 12 cu
--     bifa) si propriul rand ies completate.
--
--       BEGIN;
--         SELECT set_config('request.jwt.claims',
--                '{"sub":"PUNE-AICI-UUID-UL","role":"authenticated"}', true);
--         SET LOCAL role authenticated;
--         SELECT count(*)                                    AS randuri,
--                count(*) FILTER (WHERE email IS NOT NULL)   AS emailuri_vizibile,
--                count(*) FILTER (WHERE phone IS NOT NULL)   AS telefoane_vizibile,
--                count(*) FILTER (WHERE notes IS NOT NULL)   AS notite_vizibile
--         FROM public.profiles_visible;
--       ROLLBACK;
--
--     Asteptat, ca pe 1 august: 80 / 14 / 1 / 0.
--
--  ⚠ Rulate ca superadmin (adica pur si simplu in editor, fara
--  `set_config`), ambele arata TOT — e normal si nu dovedeste nimic.
--  Proba se face impersonand.
--
--  3. Proba finala, din exterior, cu cheia anon + un cont de test:
--     GET /rest/v1/profiles?select=email&limit=5  →  „permission denied
--     for column email"; aceeasi cerere pe `profiles_visible` →  null
--     peste tot in afara celor 13 legitime.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
--  CE RAMANE DUPA
--
--  • `profiles_public` (fisierul 1) nu mai e folosit de nicaieri in
--    frontend — l-a inlocuit `profiles_visible`. Se poate sterge, dar
--    nu in acelasi script cu revocarea; alta zi, alt tab.
--  • Lista de membri a oricarui grup e in continuare citibila fara
--    cont (`grup_membri`, 34 de randuri cu cheia anon). Alt task.
-- ═══════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════
--  FAZA 3 — inchide efectiv gaura: rolul `anon` nu mai citeste
--  coloanele sensibile din `public.profiles`
--
--  ⚠ NU RULA ASTA inainte de a fi facut FAZA 1 (view-ul) SI de a fi
--  urcat pe cPanel modificarile de cod din FAZA 2. In ordinea gresita,
--  paginile publice raman fara date si arata gol.
--
--  Ordinea corecta:
--     1. rulezi 1-creeaza-view-public.sql        (nu strica nimic)
--     2. urci codul modificat pe cPanel          (nu strica nimic)
--     3. rulezi fisierul asta                    (inchide gaura)
--
--  De ce drepturi pe coloane si nu RLS: RLS filtreaza RANDURI, nu
--  coloane. Nu exista politica RLS care sa ascunda doar `email`.
--  Singurul mecanism care face asta in Postgres e GRANT/REVOKE
--  pe coloana, iar PostgREST il respecta.
-- ═══════════════════════════════════════════════════════════════════


--  ⚠ NU PUNE NICIODATA `BEGIN ... ROLLBACK` in acelasi script cu
--  REVOKE/GRANT. Editorul SQL din Supabase ruleaza TOT scriptul ca o
--  singura tranzactie; un `ROLLBACK` scris undeva mai jos anuleaza si
--  modificarile de mai sus, tacut, dupa ce controalele au afisat deja
--  rezultate care par bune. Exact asa a picat prima incercare, pe
--  1 august 2026: SQL-ul „a mers", dar emailurile se citeau in
--  continuare anonim. Proba „ca anon" se ruleaza SEPARAT, in alt tab.
-- ═══════════════════════════════════════════════════════════════════


-- ── Pasul 0 (diagnostic): cine are drept de citire pe tabela ────────
-- Ne intereseaza daca apare `PUBLIC` in lista. Daca da, `anon` mosteneste
-- dreptul de acolo si revocarea de mai jos nu e de ajuns singura.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'SELECT'
ORDER BY grantee;


-- ── Pasul 1: ia-i lui `anon` dreptul global de citire pe tabela ─────
-- Fara asta, un GRANT pe coloane n-ar avea efect: dreptul la nivel de
-- tabela le acopera oricum pe toate.
REVOKE SELECT ON public.profiles FROM anon;


-- ── Pasul 2: da-i inapoi DOAR coloanele nevinovate ──────────────────
-- Lipsesc intentionat: email, phone, first_name, last_name, notes,
-- is_admin, is_super_admin, suspended_until, age, varsta, anul_nasterii.
-- Cine are nevoie de ele in mod legitim (pagina publica de profil,
-- pagina de grup) le ia din `profiles_public`, unde sunt filtrate.
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
) ON public.profiles TO anon;


-- ── Pasul 3: asigura-te ca utilizatorii LOGATI raman neatinsi ───────
-- Idempotent (in Supabase dreptul exista deja). E aici ca plasa: daca
-- vreodata se revoca ceva de la `PUBLIC`, logatii sa nu cada odata cu
-- vizitatorii. Rolul `authenticated` ramane deliberat cu acces complet;
-- se strange separat, cand notificarile vor primi `user_id`-uri.
GRANT SELECT ON public.profiles TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL — ruleaza dupa, ca sa vezi ca a prins
-- ═══════════════════════════════════════════════════════════════════

-- A. Ce coloane mai poate citi `anon` direct din tabela.
--    `email`, `phone`, `notes` NU trebuie sa apara in lista.
SELECT column_name
FROM information_schema.column_privileges
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name = 'profiles'
  AND privilege_type = 'SELECT'
ORDER BY column_name;

-- B. Proba directa „ca anon" — ⚠ RULEAZA-O SINGURA, IN ALT TAB,
--    NICIODATA in acelasi script cu REVOKE/GRANT de mai sus (vezi
--    avertismentul din capul fisierului: `ROLLBACK` ar anula tot).
--
--    Copiaza intr-un tab nou DOAR randurile astea, fara alte comenzi:
--
--      BEGIN;
--        SET LOCAL role anon;
--        SELECT email FROM public.profiles LIMIT 1;   -- trebuie sa CRAPE
--      ROLLBACK;
--
--    Mesajul asteptat: „permission denied for column email".
--    Apoi, tot separat, ca sa vezi ca restul merge:
--
--      BEGIN;
--        SET LOCAL role anon;
--        SELECT user_id, pseudonym FROM public.profiles LIMIT 1;
--      ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
--  CE NU REZOLVA FISIERUL ASTA
--
--  Inchide accesul ANONIM. NU inchide accesul unui utilizator LOGAT:
--  rolul `authenticated` citeste in continuare toate emailurile si
--  telefoanele tuturor. Oricine isi face cont si isi confirma mailul
--  ajunge la aceleasi date.
--
--  Motivul pentru care nu se repara in acelasi fisier: paginile de grup
--  isi aduna in browser emailurile membrilor si le paseaza edge
--  functiei `notify-admins`. Ca sa-i putem lua lui `authenticated`
--  dreptul pe `email`, notificarile trebuie sa primeasca `user_id`-uri
--  si sa rezolve emailurile pe server, cu service role. Alta sesiune,
--  alt task.
-- ═══════════════════════════════════════════════════════════════════

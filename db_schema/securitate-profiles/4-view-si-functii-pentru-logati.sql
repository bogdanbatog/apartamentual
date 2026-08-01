-- ═══════════════════════════════════════════════════════════════════
--  PASUL A — pregatirea pentru inchiderea accesului utilizatorilor
--            LOGATI la emailurile si telefoanele celorlalti
--
--  ⚠ FISIERUL ASTA NU INCHIDE NIMIC. E pur ADITIV: creeaza o functie,
--  un view si doua functii de invitatie. Dupa ce il rulezi, site-ul
--  merge exact ca acum. Abia `5-revoca-pentru-logati.sql` inchide
--  gaura, si aia se ruleaza ULTIMA, dupa ce codul e pe cPanel.
--
--  Ordinea obligatorie (ca la faza anterioara, din 1 august):
--     1. rulezi fisierul asta                     (nu strica nimic)
--     2. deploy `notify-admins`                   (nu strica nimic)
--     3. urci codul modificat pe cPanel           (nu strica nimic)
--     4. rulezi 5-revoca-pentru-logati.sql        (inchide gaura)
--
--  Inversata, ordinea lasa paginile logatilor fara date.
-- ═══════════════════════════════════════════════════════════════════
--
--  CONTEXT. Pe 1 august s-a inchis accesul ANONIM: rolul `anon` mai
--  are drept de citire pe 20 de coloane nevinovate din `profiles`.
--  Rolul `authenticated` a ramas insa cu `GRANT SELECT` pe TOATA
--  tabela, deliberat. Adica oricine isi face cont si isi confirma
--  adresa poate cere din browser:
--
--      GET /rest/v1/profiles?select=email,phone,first_name,last_name
--
--  si primeste toate randurile. Aceeasi gaura, cu un pas in plus.
--
--  DE CE NU E DE AJUNS UN REVOKE. Drepturile pe coloana sunt globale
--  pe rol, nu pe rand. Daca ii iau lui `authenticated` dreptul pe
--  `email`, nu-si mai poate citi nici PROPRIUL email, iar panoul de
--  admin se goleste (adminul e tot `authenticated`). De aceea intai
--  se face o poarta care stie sa faca diferenta — view-ul de mai jos —
--  si abia apoi se revoca.
-- ═══════════════════════════════════════════════════════════════════


-- ── Pasul 0 (diagnostic): verifica lista de coloane ─────────────────
-- View-ul de mai jos enumera explicit cele 31 de coloane ale tabelei,
-- asa cum au fost numarate pe 31 iulie 2026. Daca intre timp cineva a
-- adaugat o coloana din dashboard, ea NU va aparea in view si codul
-- care o citeste se va rupe dupa revocare.
--
-- Ruleaza asta si numara: trebuie sa iasa 31. Daca iese alt numar,
-- OPRESTE-TE si spune-mi ce coloana e in plus.

SELECT count(*) AS numar_coloane
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles';

-- Si lista lor, ca sa poti compara cu view-ul:
SELECT string_agg(column_name, ', ' ORDER BY column_name) AS coloane
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles';


-- ═══════════════════════════════════════════════════════════════════
--  1. Cine e „admin de platforma"
-- ═══════════════════════════════════════════════════════════════════
--
-- ⚠ CAPCANA CARE NE-A COSTAT DEJA O DATA: exista DOUA flaguri de
-- admin pe `profiles` — `is_admin` si `is_super_admin` — iar functia
-- veche `is_super_admin()` acopera doar unul. O politica scrisa cu
-- functia gresita intoarce lista goala, fara nicio eroare, deci pare
-- ca „nu merge nimic" fara sa zica de ce.
--
-- Functia asta le acopera pe amandoua si e SECURITY DEFINER, ca sa
-- poata citi `profiles` chiar si dupa ce rolul apelantului nu mai are
-- dreptul (altfel s-ar rupe singura in momentul revocarii).
-- E STABLE, deci Postgres o evalueaza o singura data pe interogare,
-- nu o data pe rand.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT p.is_admin OR p.is_super_admin
         FROM public.profiles p
         WHERE p.user_id = auth.uid()),
        false
    );
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;

COMMENT ON FUNCTION public.is_platform_admin() IS
'True daca utilizatorul curent are is_admin SAU is_super_admin. Folosita in profiles_visible. Acopera ambele flaguri, spre deosebire de is_super_admin(), care acopera doar unul.';


-- ═══════════════════════════════════════════════════════════════════
--  2. `profiles_visible` — o singura poarta pentru toata lumea
-- ═══════════════════════════════════════════════════════════════════
--
-- Inlocuieste in frontend si `profiles`, si `profiles_public`.
-- Regula, aplicata pe server, nu in browser:
--
--   • randul TAU sau esti admin de platforma  → vezi tot
--   • orice alt rand                          → email doar daca omul
--     a bifat „arata-mi emailul" sau e cont de agentie; varsta doar
--     cu bifa; telefon, nume real, notite si flagurile de admin ies
--     NULL, din baza de date
--
-- ⚠ ADMINUL DE GRUP NU E ADMIN DE PLATFORMA. El nu vede aici
-- emailurile membrilor; le primeste in emailurile de notificare,
-- trimise de server (decizie luata explicit pe 1 august 2026).
--
-- View-ul e detinut de `postgres` si NU are `security_invoker`, deci
-- citeste tabela cu drepturile proprietarului — exact ca
-- `profiles_public`. Asta e INTENTIONAT: e singura poarta care mai
-- ramane dupa revocare. Linterul Supabase o sa semnaleze „security
-- definer view"; aici e comportamentul dorit, nu o scapare.

CREATE OR REPLACE VIEW public.profiles_visible AS
SELECT
    -- ── Coloane pe care le vede oricine ─────────────────────────────
    -- Sunt date pe care omul le completeaza tocmai ca sa fie vazute.
    p.user_id,
    p.pseudonym,
    p.account_type,
    p.account_status,
    p.is_demo,
    p.created_at,
    p.updated_at,
    p.description,
    p.profesie,
    p.profession,
    p.zona,
    p.preferred_area_sqm,
    p.preferred_city_id,
    p.preferred_rooms,
    p.tip_apartament_cauta,
    p.agency_name,
    p.agency_website,
    p.agency_description,
    p.is_email_public,
    p.is_age_public,

    -- ── Emailul ─────────────────────────────────────────────────────
    -- Al tau, sau al oricui daca esti admin de platforma. Al altora,
    -- doar daca e cont de agentie (agentiile vor sa fie contactate)
    -- sau daca omul a bifat explicit ca vrea sa fie vizibil.
    CASE
        WHEN acces.vede_tot
          OR p.account_type = 'profesional'
          OR p.is_email_public = true
        THEN p.email
    END                                                   AS email,

    -- ── Varsta ──────────────────────────────────────────────────────
    CASE WHEN acces.vede_tot OR p.is_age_public THEN p.age           END AS age,
    CASE WHEN acces.vede_tot OR p.is_age_public THEN p.varsta        END AS varsta,
    CASE WHEN acces.vede_tot OR p.is_age_public THEN p.anul_nasterii END AS anul_nasterii,

    -- ── Date strict personale ───────────────────────────────────────
    -- Nu exista bifa care sa le faca publice. Ies NULL pentru oricine
    -- altcineva, inclusiv pentru adminul grupului din care faci parte.
    CASE WHEN acces.vede_tot THEN p.phone           END AS phone,
    CASE WHEN acces.vede_tot THEN p.first_name      END AS first_name,
    CASE WHEN acces.vede_tot THEN p.last_name       END AS last_name,
    CASE WHEN acces.vede_tot THEN p.notes           END AS notes,
    CASE WHEN acces.vede_tot THEN p.suspended_until END AS suspended_until,

    -- ── Flagurile de admin ──────────────────────────────────────────
    -- Paginile de admin verifica flagul propriu ca sa decida daca
    -- afiseaza panoul; de aceea trebuie sa iasa pe randul tau.
    -- Pentru altii ies `false`, nu NULL, ca sa nu se rupa vreun
    -- `if (profil.is_super_admin)` care asteapta un boolean.
    CASE WHEN acces.vede_tot THEN p.is_admin       ELSE false END AS is_admin,
    CASE WHEN acces.vede_tot THEN p.is_super_admin ELSE false END AS is_super_admin

FROM public.profiles p
CROSS JOIN LATERAL (
    -- Conditia se scrie o singura data, ca sa nu se poata desincroniza
    -- intre coloane la o modificare viitoare.
    SELECT (p.user_id = auth.uid() OR public.is_platform_admin()) AS vede_tot
) acces;

GRANT SELECT ON public.profiles_visible TO anon, authenticated;

COMMENT ON VIEW public.profiles_visible IS
'Singura poarta de citire a profilurilor din frontend. Randul propriu si adminii de platforma vad tot; pentru restul, telefonul, numele real, notitele si flagurile de admin ies NULL, iar emailul si varsta doar cu acordul explicit al utilizatorului. Creat 1 august 2026, ca sa se poata revoca dreptul rolului authenticated pe coloanele sensibile din profiles.';


-- ═══════════════════════════════════════════════════════════════════
--  3. Invitatiile in grup, fara ca browserul sa vada emailul
-- ═══════════════════════════════════════════════════════════════════
--
-- PROBLEMA. Tabela `grup_invitations` e cheiata pe `invited_email`.
-- Azi frontendul trebuie sa citeasca adresa omului ca sa scrie randul
-- (`profile-view-new.js`, invitarea din pagina de profil), iar la
-- invitarea prin email tastat face si drumul invers — cauta in
-- `profiles` dupa adresa (`grup-details.html:3063`), ceea ce inseamna
-- ca oricine poate testa daca o adresa are cont pe platforma.
--
-- SOLUTIA. Functia de mai jos face toata treaba pe server si intoarce
-- DOAR tokenul. Adresa nu ajunge niciodata in browser.
--
-- Accepta ori un `user_id` (invitarea din pagina de profil), ori o
-- adresa tastata de om (invitarea din pagina grupului). In al doilea
-- caz adresa e oricum cunoscuta de cel care o tasteaza, deci nu se
-- divulga nimic — dar verificarile se muta tot pe server.

-- ⚠ VERSIUNEA ASTA E GRESITA — a fost reparata in
-- `5b-repara-tipuri-functii-invitatii.sql`, care e sursa de adevar.
-- `token` era declarat `uuid`, dar coloana `grup_invitations.token` e
-- `varchar(100)`, deci functia crapa cu 42804 la prima invitatie reala.
-- Lasata aici asa cum a fost rulata pe 1 august, ca sa se inteleaga
-- istoricul; NU o re-rula peste versiunea reparata.

CREATE OR REPLACE FUNCTION public.create_group_invitation(
    p_grup_id         uuid,
    p_target_user_id  uuid DEFAULT NULL,
    p_invited_email   text DEFAULT NULL
)
RETURNS TABLE (status text, token uuid, target_user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller  uuid := auth.uid();
    v_email   text;
    v_target  uuid;
BEGIN
    -- Cine cere. Fara cont, nimic.
    IF v_caller IS NULL THEN
        RETURN QUERY SELECT 'not_allowed'::text, NULL::uuid, NULL::uuid;
        RETURN;
    END IF;

    -- Are voie sa invite doar cine e membru activ al grupului, adminul
    -- grupului, sau un admin de platforma. Fara verificarea asta,
    -- functia ar deveni exact oracolul pe care il inchidem: oricine ar
    -- putea afla, prin raspunsuri diferite, daca o adresa are cont.
    IF NOT (
        public.is_platform_admin()
        OR EXISTS (SELECT 1 FROM public.grupuri g
                   WHERE g.id = p_grup_id AND g.admin_id = v_caller)
        OR EXISTS (SELECT 1 FROM public.grup_membri m
                   WHERE m.grup_id = p_grup_id
                     AND m.user_id = v_caller
                     AND m.status = 'activ')
    ) THEN
        RETURN QUERY SELECT 'not_allowed'::text, NULL::uuid, NULL::uuid;
        RETURN;
    END IF;

    -- Pe cine invitam: ori dupa user_id, ori dupa adresa tastata.
    IF p_target_user_id IS NOT NULL THEN
        SELECT p.email, p.user_id INTO v_email, v_target
        FROM public.profiles p WHERE p.user_id = p_target_user_id;
    ELSIF p_invited_email IS NOT NULL THEN
        v_email := lower(trim(p_invited_email));
        -- Poate sa nu aiba cont inca — e in regula, invitatia merge
        -- oricum pe email, iar `v_target` ramane NULL.
        SELECT p.user_id INTO v_target
        FROM public.profiles p WHERE lower(p.email) = v_email;
    END IF;

    IF v_email IS NULL OR v_email = '' THEN
        RETURN QUERY SELECT 'no_target'::text, NULL::uuid, NULL::uuid;
        RETURN;
    END IF;

    -- Deja membru activ?
    IF v_target IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.grup_membri m
        WHERE m.grup_id = p_grup_id AND m.user_id = v_target AND m.status = 'activ'
    ) THEN
        RETURN QUERY SELECT 'already_member'::text, NULL::uuid, v_target;
        RETURN;
    END IF;

    -- Deja invitat si inca in asteptare?
    IF EXISTS (
        SELECT 1 FROM public.grup_invitations i
        WHERE i.grup_id = p_grup_id
          AND lower(i.invited_email) = v_email
          AND i.status = 'pending'
    ) THEN
        RETURN QUERY SELECT 'already_invited'::text, NULL::uuid, v_target;
        RETURN;
    END IF;

    -- A fost invitat candva, a acceptat, apoi a plecat din grup:
    -- stergem invitatia veche, ca sa poata fi reinvitat. (Verificarea
    -- „e membru activ" de mai sus a trecut deja, deci sigur nu e.)
    DELETE FROM public.grup_invitations i
    WHERE i.grup_id = p_grup_id
      AND lower(i.invited_email) = v_email
      AND i.status = 'accepted';

    -- Invitatia noua. Tokenul se genereaza din default-ul tabelei.
    RETURN QUERY
    INSERT INTO public.grup_invitations (grup_id, invited_email, invited_by)
    VALUES (p_grup_id, v_email, v_caller)
    RETURNING 'ok'::text, grup_invitations.token, v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_invitation(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_group_invitation(uuid, uuid, text) IS
'Creeaza o invitatie in grup rezolvand adresa pe server. Intoarce doar tokenul, niciodata emailul. Inlocuieste cele doua trasee din frontend care aveau nevoie de adresa: invitarea din pagina de profil si cautarea in profiles dupa email.';


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL — ruleaza dupa, ca sa vezi ca a prins
-- ═══════════════════════════════════════════════════════════════════

-- A. View-ul exista si scoate acelasi numar de randuri ca tabela.
SELECT
    (SELECT count(*) FROM public.profiles)         AS randuri_in_tabela,
    (SELECT count(*) FROM public.profiles_visible) AS randuri_in_view,
    (SELECT count(*) FROM public.profiles_visible WHERE email IS NOT NULL) AS cu_email_vizibil;

-- Rulat de tine, ca superadmin, `cu_email_vizibil` va fi egal cu
-- numarul total de randuri — e normal, tu vezi tot. Un utilizator
-- obisnuit vede acolo cele 13 legitime (1 agentie + 12 cu bifa).

-- B. Functiile exista si au drepturile corecte.
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_platform_admin', 'create_group_invitation');


-- ═══════════════════════════════════════════════════════════════════
--  ⚠ CE NU FACE FISIERUL ASTA
--
--  NU inchide nimic. Rolul `authenticated` citeste in continuare toate
--  emailurile direct din `profiles`. Fisierul asta doar construieste
--  poarta prin care se va citi de acum incolo.
--
--  Inchiderea efectiva e in `5-revoca-pentru-logati.sql`, care se
--  ruleaza DUPA ce codul modificat e pe cPanel.
-- ═══════════════════════════════════════════════════════════════════

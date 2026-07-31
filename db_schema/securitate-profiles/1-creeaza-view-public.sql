-- ═══════════════════════════════════════════════════════════════════
--  FAZA 1 — creeaza `profiles_public`, un view cu DOAR datele publice
--
--  RULEAZA ASTA PRIMA. Este pur ADITIVA: nu schimba nimic din ce
--  exista, nu revoca niciun drept, nu poate strica site-ul.
--  Dupa ea, site-ul merge exact ca acum; abia FAZA 3 inchide gaura.
--
--  Context: tabela `public.profiles` e citibila anonim in intregime,
--  toate cele 31 de coloane, din cauza politicii `profiles_select_all`
--  (SELECT, rol `public`, qual = true). Politicile permisive se combina
--  cu OR, deci `anon_view_profiles` nu restrange nimic.
--  Verificat pe 31 iulie 2026: 80 de randuri, cu email si telefon,
--  descarcabile fara cont, folosind cheia anon din supabase-config.js.
-- ═══════════════════════════════════════════════════════════════════


-- ── View-ul public ──────────────────────────────────────────────────
-- Contine doar ce are voie sa vada un strain. Regulile de intimitate
-- care azi se aplica in JavaScript (is_email_public, is_age_public)
-- se muta AICI, pe server, unde chiar conteaza.
--
-- NU apar deloc in view: phone, first_name, last_name, notes,
-- is_admin, is_super_admin, suspended_until.

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
    user_id,
    pseudonym,
    account_type,
    account_status,
    is_demo,
    created_at,
    updated_at,

    -- Emailul se arata DOAR daca e cont de agentie (agentiile vor sa fie
    -- contactate) sau daca omul a bifat explicit „arata-mi emailul".
    -- Altfel iese NULL din baza de date, nu din browser.
    CASE
        WHEN account_type = 'profesional' OR is_email_public = true
        THEN email
        ELSE NULL
    END                                            AS email,

    -- Varsta, la fel: doar cu bifa explicita.
    CASE WHEN is_age_public = true THEN age           ELSE NULL END AS age,
    CASE WHEN is_age_public = true THEN varsta        ELSE NULL END AS varsta,
    CASE WHEN is_age_public = true THEN anul_nasterii ELSE NULL END AS anul_nasterii,

    -- Restul sunt date pe care omul le completeaza tocmai ca sa fie vazute.
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
FROM public.profiles;


-- ── Drepturi pe view ────────────────────────────────────────────────
-- View-ul e detinut de `postgres` si NU are `security_invoker`, deci
-- citeste tabela cu drepturile proprietarului. Asta e INTENTIONAT:
-- e singura poarta prin care un vizitator nelogat mai vede profiluri
-- dupa FAZA 3. Linterul Supabase o sa semnaleze „security definer
-- view" — aici e comportamentul dorit, nu o scapare.

GRANT SELECT ON public.profiles_public TO anon, authenticated;

COMMENT ON VIEW public.profiles_public IS
'Fereastra publica peste profiles. Ascunde telefon, nume real, notite si flagurile de admin; arata emailul si varsta doar cu acordul explicit al utilizatorului. Creat 31 iulie 2026, dupa ce s-a constatat ca profiles era citibila anonim in intregime.';


-- ── Control: ce iese prin view ──────────────────────────────────────
-- Ruleaza si uita-te: coloana `email` trebuie sa fie NULL peste tot,
-- in afara conturilor de agentie si a celor cu is_email_public = true.
SELECT
    COUNT(*)                                    AS total_randuri,
    COUNT(email)                                AS cu_email_vizibil,
    COUNT(*) FILTER (WHERE account_type = 'profesional') AS conturi_agentie
FROM public.profiles_public;

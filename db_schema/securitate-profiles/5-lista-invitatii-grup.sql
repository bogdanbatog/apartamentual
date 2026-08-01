-- ═══════════════════════════════════════════════════════════════════
--  PASUL C (partea de server) — lista de invitatii a unui grup,
--  calculata pe server
--
--  ⚠ FISIERUL ASTA NU INCHIDE NIMIC. E pur ADITIV: creeaza o singura
--  functie. Dupa ce il rulezi, site-ul merge exact ca acum.
--
--  Ordinea, ca la restul reparatiei:
--     1. 4-view-si-functii-pentru-logati.sql   (rulat pe 1 august)
--     2. deploy `notify-admins`                (facut pe 1 august)
--     3. rulezi fisierul asta                  (nu strica nimic)
--     4. urci codul modificat pe cPanel        (nu strica nimic)
--     5. rulezi 6-revoca-pentru-logati.sql     (inchide gaura)
-- ═══════════════════════════════════════════════════════════════════
--
--  DE CE E NEVOIE. In modalul „Invita membru" din pagina grupului,
--  lista de invitatii arata, pentru fiecare invitatie ACCEPTATA, daca
--  omul mai e sau nu membru activ („Membru" vs „A parasit"). Azi
--  calculul se face in browser si are nevoie de o interogare pe
--  `profiles` dupa adresa:
--
--      .from('profiles').select('user_id, email').in('email', ...)
--
--  Dupa revocarea drepturilor rolului `authenticated` pe coloana
--  `email`, interogarea aia nu mai merge. In plus, ea era si o cale
--  prin care browserul cerea explicit adrese din tabela.
--
--  Functia de mai jos face acelasi calcul pe server si intoarce doar
--  ce se afiseaza oricum in modal.
-- ═══════════════════════════════════════════════════════════════════


-- ⚠ Versiunea asta a fost inlocuita de cea din
-- `5b-repara-tipuri-functii-invitatii.sql`, unde valorile din coloane
-- sunt castate explicit. NU o re-rula peste versiunea reparata.

CREATE OR REPLACE FUNCTION public.list_group_invitations(p_grup_id uuid)
RETURNS TABLE (
    invited_email text,
    status        text,
    created_at    timestamptz,
    still_member  boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller uuid := auth.uid();
BEGIN
    -- Fara cont, nimic. Si, ca la `create_group_invitation`, are voie sa
    -- vada lista doar cine e membru activ al grupului, adminul grupului
    -- sau un admin de platforma. Altfel functia ar deveni o cale de a
    -- citi adresele invitate in orice grup.
    IF v_caller IS NULL THEN
        RETURN;
    END IF;

    IF NOT (
        public.is_platform_admin()
        OR EXISTS (SELECT 1 FROM public.grupuri g
                   WHERE g.id = p_grup_id AND g.admin_id = v_caller)
        OR EXISTS (SELECT 1 FROM public.grup_membri m
                   WHERE m.grup_id = p_grup_id
                     AND m.user_id = v_caller
                     AND m.status = 'activ')
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        i.invited_email::text,
        i.status::text,
        i.created_at,
        -- „Mai e membru activ?" — se calculeaza aici, nu in browser.
        EXISTS (
            SELECT 1
            FROM public.grup_membri m
            JOIN public.profiles p ON p.user_id = m.user_id
            WHERE m.grup_id      = i.grup_id
              AND m.status       = 'activ'
              AND lower(p.email) = lower(i.invited_email)
        ) AS still_member
    FROM public.grup_invitations i
    WHERE i.grup_id = p_grup_id
    ORDER BY i.created_at DESC
    LIMIT 10;
END;
$$;

REVOKE ALL ON FUNCTION public.list_group_invitations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_group_invitations(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_group_invitations(uuid) IS
'Lista de invitatii a unui grup, cu „mai e membru activ?" calculat pe server. Inlocuieste interogarea din browser care cauta in profiles dupa adresa. Vizibila doar membrilor activi ai grupului, adminului de grup si adminilor de platforma.';


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL — ruleaza dupa, ca sa vezi ca a prins
-- ═══════════════════════════════════════════════════════════════════

-- A. Functia exista si e SECURITY DEFINER.
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'list_group_invitations';

-- B. ⚠ NU O APELA DIRECT DIN EDITORUL SQL. Acolo rulezi ca `postgres`,
--    unde `auth.uid()` e NULL, iar functia e scrisa sa nu intoarca nimic
--    fara cont — deci va da ZERO randuri chiar daca e perfect sanatoasa.
--    Verificat pe 1 august 2026: exact asa pare „stricata" cand nu e.
--
--    Proba corecta cere impersonare. Inlocuieste UUID-ul cu al tau si
--    ID-ul cu al unui grup care ARE invitatii:
--
--      BEGIN;
--        SELECT set_config('request.jwt.claims',
--               '{"sub":"UUID-UL-TAU","role":"authenticated"}', true);
--        SET LOCAL role authenticated;
--        SELECT * FROM public.list_group_invitations('PUNE-ID-UL-GRUPULUI');
--      ROLLBACK;
--
--    (`ROLLBACK` e permis aici — fisierul asta nu contine GRANT/REVOKE.)
--
--    Inainte de asta, verifica daca grupul are ce afisa:
--
--      SELECT status, count(*) FROM public.grup_invitations
--      WHERE grup_id = 'PUNE-ID-UL-GRUPULUI' GROUP BY status;

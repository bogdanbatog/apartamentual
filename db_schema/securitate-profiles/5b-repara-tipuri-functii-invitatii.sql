-- ═══════════════════════════════════════════════════════════════════
--  REPARATIE — tipurile intoarse de functiile de invitatii
--
--  ⚠ FISIERUL ASTA NU INCHIDE NIMIC. Doar reface doua functii care
--  existau deja. Se ruleaza INAINTE de 6-revoca-pentru-logati.sql.
--
--  Ordinea completa:
--     1. 4-view-si-functii-pentru-logati.sql   (rulat, 1 august)
--     2. deploy `notify-admins`                (facut, 1 august)
--     3. 5-lista-invitatii-grup.sql            (rulat, 1 august)
--     4. fisierul asta                         (repara)
--     5. cod pe cPanel                         (facut)
--     6. 6-revoca-pentru-logati.sql            (inchide gaura)
-- ═══════════════════════════════════════════════════════════════════
--
--  CE S-A INTAMPLAT. La prima invitatie reala trimisa prin
--  `create_group_invitation`, Postgres a raspuns:
--
--    ERROR 42804: structure of query does not match function result type
--    DETAIL: Returned type character varying(100) does not match
--            expected type uuid in column 2.
--
--  Adica `grup_invitations.token` e `varchar(100)`, nu `uuid`, iar
--  functia fusese declarata `RETURNS TABLE (..., token uuid, ...)`.
--
--  ⚠ LECTIA, DE TINUT MINTE: o functie plpgsql se CREEAZA cu succes
--  chiar daca tipurile din `RETURNS TABLE` nu se potrivesc cu ce
--  intoarce corpul ei. Nepotrivirea iese la iveala abia la PRIMA
--  RULARE EFECTIVA. Deci „functia exista si e SECURITY DEFINER" NU e
--  o proba ca merge — proba e s-o apelezi pe date reale.
--
--  In plus, ambele functii ies devreme cand `auth.uid()` e NULL — adica
--  exact cum se intampla in editorul SQL, unde rulezi ca `postgres`.
--  De aceea nici apelurile de control de pe 1 august n-au atins corpul
--  lor. Probele se fac impersonand (vezi finalul fisierului).
--
--  REPARATIA. Se forteaza tipurile cu `::text` peste tot unde valoarea
--  vine dintr-o coloana, ca functiile sa nu mai depinda de presupuneri
--  despre schema. `token` devine `text` (frontendul il foloseste ca
--  sir, intr-un URL — nimic de schimbat acolo).
--
--  De ce DROP si nu doar CREATE OR REPLACE: Postgres nu lasa sa se
--  schimbe tipul intors al unei functii existente. DROP sterge si
--  drepturile, de aceea `GRANT EXECUTE` e refacut mai jos.
-- ═══════════════════════════════════════════════════════════════════


-- ── Pasul 0 (diagnostic): ce tipuri au de fapt coloanele ────────────
-- Ruleaza asta INTAI si uita-te la rezultat. Asa nu mai presupunem.
SELECT column_name, data_type, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'grup_invitations'
ORDER BY ordinal_position;


-- ═══════════════════════════════════════════════════════════════════
--  1. `create_group_invitation` — reparata
-- ═══════════════════════════════════════════════════════════════════
-- Identica cu cea din fisierul 4, cu o singura diferenta de fond:
-- `token` se intoarce ca `text`, iar valorile din coloane se casteaza
-- explicit.

DROP FUNCTION IF EXISTS public.create_group_invitation(uuid, uuid, text);

CREATE FUNCTION public.create_group_invitation(
    p_grup_id         uuid,
    p_target_user_id  uuid DEFAULT NULL,
    p_invited_email   text DEFAULT NULL
)
RETURNS TABLE (status text, token text, target_user_id uuid)
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
        RETURN QUERY SELECT 'not_allowed'::text, NULL::text, NULL::uuid;
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
        RETURN QUERY SELECT 'not_allowed'::text, NULL::text, NULL::uuid;
        RETURN;
    END IF;

    -- Pe cine invitam: ori dupa user_id, ori dupa adresa tastata.
    IF p_target_user_id IS NOT NULL THEN
        SELECT p.email::text, p.user_id INTO v_email, v_target
        FROM public.profiles p WHERE p.user_id = p_target_user_id;
    ELSIF p_invited_email IS NOT NULL THEN
        v_email := lower(trim(p_invited_email));
        -- Poate sa nu aiba cont inca — e in regula, invitatia merge
        -- oricum pe email, iar `v_target` ramane NULL.
        SELECT p.user_id INTO v_target
        FROM public.profiles p WHERE lower(p.email) = v_email;
    END IF;

    IF v_email IS NULL OR v_email = '' THEN
        RETURN QUERY SELECT 'no_target'::text, NULL::text, NULL::uuid;
        RETURN;
    END IF;

    -- Deja membru activ?
    IF v_target IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.grup_membri m
        WHERE m.grup_id = p_grup_id AND m.user_id = v_target AND m.status = 'activ'
    ) THEN
        RETURN QUERY SELECT 'already_member'::text, NULL::text, v_target;
        RETURN;
    END IF;

    -- Deja invitat si inca in asteptare?
    IF EXISTS (
        SELECT 1 FROM public.grup_invitations i
        WHERE i.grup_id = p_grup_id
          AND lower(i.invited_email) = v_email
          AND i.status = 'pending'
    ) THEN
        RETURN QUERY SELECT 'already_invited'::text, NULL::text, v_target;
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
    -- ⚠ `::text` pe token — coloana e varchar(100), nu uuid. Fara cast,
    -- functia crapa cu 42804 la prima invitatie reala (1 august 2026).
    RETURN QUERY
    INSERT INTO public.grup_invitations (grup_id, invited_email, invited_by)
    VALUES (p_grup_id, v_email, v_caller)
    RETURNING 'ok'::text, grup_invitations.token::text, v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.create_group_invitation(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group_invitation(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.create_group_invitation(uuid, uuid, text) IS
'Creeaza o invitatie in grup rezolvand adresa pe server. Intoarce doar tokenul (text — coloana e varchar, nu uuid), niciodata emailul. Inlocuieste cele doua trasee din frontend care aveau nevoie de adresa: invitarea din pagina de profil si cautarea in profiles dupa email.';


-- ═══════════════════════════════════════════════════════════════════
--  2. `list_group_invitations` — intarita impotriva aceleiasi capcane
-- ═══════════════════════════════════════════════════════════════════
-- Aceeasi logica, dar toate valorile din coloane sunt castate explicit.
-- N-a apucat sa crape fiindca n-a rulat niciodata pe date reale: in
-- modal, grupul verificat n-avea nicio invitatie.

DROP FUNCTION IF EXISTS public.list_group_invitations(uuid);

CREATE FUNCTION public.list_group_invitations(p_grup_id uuid)
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
    -- sau un admin de platforma.
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
        i.created_at::timestamptz,
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
'Lista de invitatii a unui grup, cu „mai e membru activ?" calculat pe server. Vizibila doar membrilor activi ai grupului, adminului de grup si adminilor de platforma.';


-- ═══════════════════════════════════════════════════════════════════
--  PROBELE — ⚠ SE RULEAZA IMPERSONAND, altfel ies zero randuri fara
--  sa insemne nimic (in editor, `auth.uid()` e NULL).
--
--  Inlocuieste UUID-ul cu al tau si ID-ul cu al grupului de test.
--  ROLLBACK e permis aici: fisierul nu contine GRANT/REVOKE pe tabele.
-- ═══════════════════════════════════════════════════════════════════
--
--    BEGIN;
--      SELECT set_config('request.jwt.claims',
--             '{"sub":"bb7c9ca6-6cf3-42aa-bec8-9c13ca3657c6","role":"authenticated"}', true);
--      SET LOCAL role authenticated;
--
--      -- a) creeaza invitatia: trebuie sa intoarca `ok` + un token
--      SELECT * FROM public.create_group_invitation(
--          'd6ab0a78-6935-4a95-8967-794708c208e5'::uuid,
--          NULL,
--          'luta.lucian.m+test80@gmail.com');
--
--      -- b) si lista trebuie sa arate invitatia proaspata, cu
--      --    still_member = false
--      SELECT * FROM public.list_group_invitations(
--          'd6ab0a78-6935-4a95-8967-794708c208e5'::uuid);
--    ROLLBACK;
--
--  `ROLLBACK` sterge invitatia de proba, deci nu ramane nimic in urma.
--  Daca ambele trec, incearca din nou din interfata.
-- ═══════════════════════════════════════════════════════════════════

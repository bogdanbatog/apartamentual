-- ═══════════════════════════════════════════════════════════════════
--  PASUL 3 — `get_invitation_by_token`: validarea invitației pe server
--
--  Ce face: NIMIC pentru vizitatori, deocamdată. E pur aditiv —
--  creează o funcție nouă, nu atinge nicio politică, niciun drept,
--  niciun rând existent. Se poate rula oricând, în siguranță.
--
--  De ce există: azi `accept-invite.html` citește invitația DIRECT
--  din tabelă, ca să afle dacă tokenul e valid — și o face ÎNAINTE
--  să verifice dacă omul e logat (linia 232, față de verificarea de
--  la 261). Adică fix cazul obișnuit — cineva primește invitația pe
--  email și dă click nelogat — depinde de faptul că tabela e deschisă
--  către oricine. Când o închidem (PASUL 4), acel om ar primi
--  „Invitație negăsită" în loc de ecranul de autentificare.
--
--  Funcția asta mută întrebarea pe server. Primește tokenul și
--  întoarce DOAR ce-i trebuie paginii:
--     • există invitația și în ce stare e
--     • în ce grup, cum se numește grupul
--     • „emailul tău se potrivește?" — calculat aici, nu în browser
--     • adresa invitată MASCATĂ (at***@yahoo.com), atât cât să
--       recunoști cu ce cont trebuie să intri
--
--  Adresa completă nu iese niciodată. Tokenul rămâne singura cheie,
--  iar el ajunge doar la cel care a primit emailul.
--
--  ⚠ NU pune BEGIN…ROLLBACK în acest fișier — vezi lecția din 1
--  august (`supabase-sql-editor-rollback`). Aici n-ar strica nimic,
--  fiindcă nu sunt GRANT/REVOKE pe tabele, dar ține obiceiul curat.
-- ═══════════════════════════════════════════════════════════════════


-- ── ⚠ Capcana tipurilor, plătită deja o dată pe 1 august ───────────
-- `RETURNS TABLE` NU se verifică la creare. Postgres compară tipurile
-- abia la PRIMA RULARE EFECTIVĂ, și atunci crapă cu 42804. Așa a picat
-- `create_group_invitation`, care declara `token uuid` pe o coloană
-- `varchar(100)`. De aceea aici fiecare valoare venită dintr-o coloană
-- e castată explicit: `::text`, `::uuid`.
--
-- Tipurile reale ale tabelei, verificate atunci:
--   token varchar(100) · invited_email varchar(255) · status varchar(20)
--   created_at timestamptz · expires_at timestamptz


DROP FUNCTION IF EXISTS public.get_invitation_by_token(text);

CREATE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
    gasit                boolean,   -- există un rând cu tokenul ăsta?
    status               text,      -- pending / accepted / expired / cancelled / rejected
    grup_id              uuid,
    grup_nume            text,
    email_matches        boolean,   -- ești TU cel invitat?
    invited_email_mascat text       -- at***@yahoo.com, niciodată adresa întreagă
)
LANGUAGE plpgsql
VOLATILE                            -- ⚠ NU `STABLE`: funcția scrie (marchează expirarea)
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_inv     public.grup_invitations%ROWTYPE;
    v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
    v_status  text;
    v_nume    text;
    v_local   text;
    v_domeniu text;
BEGIN
    -- Tokenul e singura cheie. Fără el, nimic — funcția nu poate fi
    -- folosită ca să enumeri invitații, doar ca să verifici una anume.
    IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
        RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::text, false, NULL::text;
        RETURN;
    END IF;

    SELECT * INTO v_inv
    FROM public.grup_invitations i
    WHERE i.token = p_token
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::text, false, NULL::text;
        RETURN;
    END IF;

    v_status := v_inv.status::text;

    -- ── Expirarea se marchează AICI, nu din browser ─────────────────
    -- Azi o face `accept-invite.html:256`, cu un UPDATE trimis de un
    -- vizitator nelogat. După PASUL 4, acel UPDATE n-ar mai avea voie.
    -- Funcția rulează cu drepturile proprietarului, deci poate.
    IF v_status = 'pending'
       AND v_inv.expires_at IS NOT NULL
       AND v_inv.expires_at < now() THEN
        UPDATE public.grup_invitations SET status = 'expired' WHERE id = v_inv.id;
        v_status := 'expired';
    END IF;

    -- Numele grupului, ca pagina să nu-l mai ia din parametrul din URL
    -- (`?grup=…`, care se putea și falsifica, și lipsi).
    SELECT g.nume::text INTO v_nume
    FROM public.grupuri g
    WHERE g.id = v_inv.grup_id;

    -- ── Mascarea adresei ────────────────────────────────────────────
    -- Primele două litere + domeniul. Destul cât să-ți recunoști
    -- propria adresă, prea puțin cât să afli adresa altcuiva.
    v_local   := split_part(v_inv.invited_email::text, '@', 1);
    v_domeniu := split_part(v_inv.invited_email::text, '@', 2);

    RETURN QUERY SELECT
        true,
        v_status,
        v_inv.grup_id::uuid,
        v_nume,
        (v_email <> '' AND v_email = lower(v_inv.invited_email::text)),
        (left(v_local, 2) || '***@' || v_domeniu)::text;
END;
$$;

-- Se apelează și de vizitatorii fără cont — ăsta e tot rostul ei.
-- Tokenul e cheia; fără el nu întoarce nimic.
REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

COMMENT ON FUNCTION public.get_invitation_by_token(text) IS
'Validează o invitație după token, pe server. Întoarce starea, grupul, „e invitația ta?" și adresa mascată — niciodată adresa completă sau tokenul altcuiva. Înlocuiește citirea directă din `grup_invitations` făcută de accept-invite.html, ca tabela să poată fi închisă.';


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL 1 — funcția s-a creat și e SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════
-- Așteptat: un rând, `security_definer = true`, `volatile = v`.
-- ⚠ Dar „funcția există" NU e o probă că merge — capcana 42804 se
-- vede abia la prima rulare pe date reale. De aia urmează CONTROL 2.

SELECT p.proname                AS functie,
       p.prosecdef              AS security_definer,
       p.provolatile            AS volatilitate   -- 'v' = volatile, corect
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_invitation_by_token';


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL 2 — proba pe invitația reală (ASTA contează)
-- ═══════════════════════════════════════════════════════════════════
-- Rulează funcția pe tokenul invitației care există azi în tabelă.
-- Așteptat: `gasit = true`, `status = pending`, numele grupului
-- completat, `email_matches = false` (în editor n-ai JWT, deci nu
-- ești nimeni), iar adresa mascată de forma `lu***@gmail.com`.
--
-- Dacă apare `ERROR 42804: structure of query does not match…`,
-- atunci un cast lipsește — spune-mi mesajul exact.

SELECT * FROM public.get_invitation_by_token(
    (SELECT token FROM public.grup_invitations ORDER BY created_at DESC LIMIT 1)
);


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL 3 — un token inventat nu întoarce nimic
-- ═══════════════════════════════════════════════════════════════════
-- Așteptat: un singur rând, cu `gasit = false` și restul NULL.

SELECT * FROM public.get_invitation_by_token('token-care-nu-exista');

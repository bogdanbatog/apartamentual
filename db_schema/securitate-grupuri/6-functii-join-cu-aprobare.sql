-- ═══════════════════════════════════════════════════════════════════
--  PASUL 6 — FUNCȚIILE PE CARE SE SPRIJINĂ INTRAREA ÎN GRUP
--
--  Fișierul ăsta e PUR ADITIV: creează patru funcții și nu atinge
--  nicio politică, niciun drept, niciun rând. După ce-l rulezi, site-ul
--  se comportă exact ca înainte. Strângerea propriu-zisă vine abia în
--  fișierul 7, DUPĂ ce codul e pe cPanel.
--
--  ORDINEA E OBLIGATORIE, aceeași ca la `profiles` (1 august) și la
--  `grup_invitations` (2 august):
--      6 (funcții)  →  cod live pe cPanel  →  7 (politici)
--  Inversată, oamenii primesc erori pe butoane care încă nu știu să
--  ceară altfel.
--
--  ⚠️ NU pune BEGIN…ROLLBACK în script. Editorul SQL din Supabase
--  rulează tot fișierul ca o singură tranzacție, iar un ROLLBACK de
--  probă anulează tăcut și ce e deasupra lui (lecția din 1 august).
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
--  1. `profil_complet(user_id)` — pragul, scris o singură dată
-- ═══════════════════════════════════════════════════════════════════
--
-- Pragul NU e inventat aici. Sunt exact cele șase lucruri pe care
-- formularul din `profile-edit-new.html` le cere deja:
--   • pseudonim, camere, suprafață, oraș  → `required` în HTML
--   • cel puțin o zonă preferată          → `profile-edit-new.js:589`
--   • cel puțin un tag de interes         → `profile-edit-new.js:594`
--
-- Îl codificăm într-un singur loc ca să nu ajungem cu trei definiții
-- ușor diferite (una în HTML, una în JS, una în politică).
--
-- ⚠️ DE CE `SECURITY DEFINER` — capcana din 1 august:
-- expresia unei politici RLS se evaluează cu drepturile CELUI CARE
-- INTEROGHEAZĂ. Rolul `authenticated` nu mai are SELECT pe toate
-- coloanele din `profiles`, iar o funcție obișnuită care le citește
-- n-ar întoarce „fals" — ar CRĂPA, și odată cu ea toată interogarea.
-- Exact așa au rămas goale paginile de terenuri și parteneri.
-- `SECURITY DEFINER` + `row_security = off` o fac imună, la fel ca
-- `is_super_admin()` și `is_platform_admin()`.

CREATE OR REPLACE FUNCTION public.profil_complet(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
    SELECT COALESCE(
        (SELECT
                COALESCE(TRIM(p.pseudonym), '') <> ''
            AND COALESCE(TRIM(p.preferred_rooms::text), '') <> ''
            AND p.preferred_area_sqm IS NOT NULL
            AND p.preferred_city_id  IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.user_preferred_zones z WHERE z.user_id = p.user_id)
            AND EXISTS (SELECT 1 FROM public.user_tags            t WHERE t.user_id = p.user_id)
         FROM public.profiles p
         WHERE p.user_id = p_user_id),
        false   -- fără rând în `profiles` ⇒ profil incomplet, nu eroare
    );
$$;

REVOKE ALL ON FUNCTION public.profil_complet(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profil_complet(uuid) TO authenticated;

COMMENT ON FUNCTION public.profil_complet(uuid) IS
'True daca profilul are pseudonim, camere, suprafata, oras, cel putin o zona si cel putin un tag. Acelasi prag pe care il cere formularul de profil. Folosita in politica de INSERT pe grup_membri si in accept_group_invitation.';


-- ═══════════════════════════════════════════════════════════════════
--  2. `este_admin_grup(grup_id)` — cine gestionează grupul
-- ═══════════════════════════════════════════════════════════════════
--
-- Adminul unui grup e `grupuri.admin_id`. Atenție: NU e mereu
-- fondatorul — există transfer de administrare (evenimentul
-- `admin_left_with_transfer`), deci coloana se schimbă în timp.
--
-- Tot `SECURITY DEFINER`, din același motiv: o politică pe
-- `grup_membri` care ar citi direct `grupuri` s-ar lovi de RLS-ul de
-- pe `grupuri` (grupurile arhivate nu sunt vizibile oricui) și ar da
-- rezultate care depind de cine întreabă, nu de adevăr.

CREATE OR REPLACE FUNCTION public.este_admin_grup(p_grup_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.grupuri g
        WHERE g.id = p_grup_id
          AND g.admin_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.este_admin_grup(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.este_admin_grup(uuid) TO authenticated;

COMMENT ON FUNCTION public.este_admin_grup(uuid) IS
'True daca utilizatorul curent e adminul grupului dat (grupuri.admin_id). NU e admin de platforma — pentru acela e is_platform_admin().';


-- ═══════════════════════════════════════════════════════════════════
--  3. `cont_de_agentie()` — regula care azi trăiește doar în butoane
-- ═══════════════════════════════════════════════════════════════════
--
-- „Conturile de agenție nu pot face parte din grupuri" e scris în
-- trei locuri din interfață (`grupuri.js:505`, `grup-details.html:1745`,
-- `grup-nou.html:714`), dar în bază nu-l aplică nimeni.
--
-- ⚠️ ASTA E SINGURA BUCATĂ DIN FIȘIER CARE NU E STRICT CERUTĂ DE
-- TASKUL DE AZI. Dacă vrei s-o lăsăm pe altă dată, se scoate cu o
-- singură linie din politica din fișierul 7 (e marcată acolo) și
-- funcția rămâne nefolosită, inofensivă.

CREATE OR REPLACE FUNCTION public.cont_de_agentie(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
    SELECT COALESCE(
        (SELECT p.account_type = 'profesional'
         FROM public.profiles p
         WHERE p.user_id = p_user_id),
        false
    );
$$;

REVOKE ALL ON FUNCTION public.cont_de_agentie(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cont_de_agentie(uuid) TO authenticated;

COMMENT ON FUNCTION public.cont_de_agentie(uuid) IS
'True pentru conturile de agentie (account_type = profesional), care nu au voie in grupuri.';


-- ═══════════════════════════════════════════════════════════════════
--  4. `accept_group_invitation(token)` — acceptarea, mutată pe server
-- ═══════════════════════════════════════════════════════════════════
--
-- DE CE EXISTĂ: azi, acceptarea unei invitații se face din browser
-- (`grup-details.html:3388-3412`) și decide singură dacă omul intră
-- `activ` sau `pending`, comparând `invitation.invited_by` cu
-- `currentGroup.admin_id`. Amândouă valorile vin din browser, deci
-- regula „doar adminul poate băga pe cineva direct" e o convenție de
-- JavaScript, nu o garanție. Iar după fișierul 7, browserul nici n-ar
-- mai avea voie să scrie `activ`.
--
-- Funcția face TOT lanțul pe server, într-o singură apăsare de buton:
-- validează tokenul, verifică adresa, expirarea, locurile libere,
-- profilul completat, decide `activ` vs `pending`, scrie rândul de
-- membru și marchează invitația ca acceptată.
--
-- ⚠️ E `SECURITY DEFINER`, deci trece INTENȚIONAT peste politicile din
-- fișierul 7. Asta e și rostul ei: e singura ușă prin care se poate
-- ajunge `activ` fără aprobarea adminului, și numai pentru că adminul
-- a fost cel care a trimis invitația. De aceea verificările dinăuntru
-- sunt poarta reală — nu le slăbi fără să te gândești de două ori.
--
-- ⚠️ CASTĂRI EXPLICITE PESTE TOT (`::text`, `::boolean`): coloanele
-- reale sunt `varchar`, iar `RETURNS TABLE` NU se verifică la creare.
-- Fără castări, funcția s-ar crea fără reproș și ar crăpa abia la
-- prima invitație reală, cu `42804` (capcana din 1 august).
--
-- Emailurile de notificare NU se trimit de aici — rămân în browser,
-- exact ca azi, pe baza statusului întors.

CREATE OR REPLACE FUNCTION public.accept_group_invitation(p_token text)
RETURNS TABLE (
    ok             boolean,
    motiv          text,     -- cod scurt, pentru ramificare în JS
    mesaj          text,     -- text gata de arătat omului
    status_membru  text,     -- 'activ' | 'pending' | NULL
    grup           uuid,
    grup_nume      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_uid           uuid := auth.uid();
    v_email         text := lower(COALESCE(auth.jwt() ->> 'email', ''));
    v_inv           public.grup_invitations%ROWTYPE;
    v_grup_admin    uuid;
    v_grup_max      integer;
    v_grup_nume     text;
    v_activi        integer;
    v_membru_id     uuid;
    v_membru_status text;
    v_status_nou    text;
BEGIN
    -- ── fără cont, nimic ────────────────────────────────────────────
    IF v_uid IS NULL THEN
        RETURN QUERY SELECT false, 'fara_cont'::text,
            'Trebuie să fii conectat ca să accepți invitația.'::text,
            NULL::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    -- ── invitația ───────────────────────────────────────────────────
    SELECT * INTO v_inv
    FROM public.grup_invitations i
    WHERE i.token = p_token;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'negasita'::text,
            'Invitația nu a fost găsită.'::text,
            NULL::text, NULL::uuid, NULL::text;
        RETURN;
    END IF;

    -- ── expirată: o marcăm și ne oprim ──────────────────────────────
    -- (până acum, marcarea o făcea browserul unui vizitator nelogat)
    IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < now() THEN
        IF v_inv.status = 'pending' THEN
            UPDATE public.grup_invitations SET status = 'expired' WHERE id = v_inv.id;
        END IF;
        RETURN QUERY SELECT false, 'expirata'::text,
            'Invitația a expirat. Cere-i adminului grupului una nouă.'::text,
            NULL::text, v_inv.grup_id, NULL::text;
        RETURN;
    END IF;

    -- ── orice stare care nu e `pending` e capăt de drum ─────────────
    -- (inclusiv `rejected` — pe 2 august s-a văzut că o invitație
    --  refuzată trecea prin toate verificările ca și cum ar fi validă)
    IF v_inv.status <> 'pending' THEN
        RETURN QUERY SELECT false, 'stare_gresita'::text,
            'Invitația nu mai e valabilă.'::text,
            NULL::text, v_inv.grup_id, NULL::text;
        RETURN;
    END IF;

    -- ── adresa se compară pe server, nu în browser ──────────────────
    IF v_email = '' OR lower(v_inv.invited_email) <> v_email THEN
        RETURN QUERY SELECT false, 'alt_email'::text,
            'Invitația e pentru altă adresă de email decât contul cu care ești conectat.'::text,
            NULL::text, v_inv.grup_id, NULL::text;
        RETURN;
    END IF;

    -- ── grupul ──────────────────────────────────────────────────────
    SELECT g.admin_id, g.max_membri, g.nume
      INTO v_grup_admin, v_grup_max, v_grup_nume
    FROM public.grupuri g
    WHERE g.id = v_inv.grup_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'grup_inexistent'::text,
            'Grupul nu mai există.'::text,
            NULL::text, v_inv.grup_id, NULL::text;
        RETURN;
    END IF;

    -- ── conturile de agenție nu intră în grupuri ────────────────────
    IF public.cont_de_agentie(v_uid) THEN
        RETURN QUERY SELECT false, 'cont_agentie'::text,
            'Conturile de agenție nu pot face parte din grupuri.'::text,
            NULL::text, v_inv.grup_id, v_grup_nume::text;
        RETURN;
    END IF;

    -- ── deja membru activ: nu mai facem nimic, doar închidem invitația ──
    SELECT gm.id, gm.status INTO v_membru_id, v_membru_status
    FROM public.grup_membri gm
    WHERE gm.grup_id = v_inv.grup_id AND gm.user_id = v_uid;

    IF v_membru_status = 'activ' THEN
        UPDATE public.grup_invitations SET status = 'accepted' WHERE id = v_inv.id;
        RETURN QUERY SELECT true, 'deja_membru'::text,
            'Ești deja membru al grupului.'::text,
            'activ'::text, v_inv.grup_id, v_grup_nume::text;
        RETURN;
    END IF;

    -- ── profilul completat, aceeași regulă ca la cererea obișnuită ──
    IF NOT public.profil_complet(v_uid) THEN
        RETURN QUERY SELECT false, 'profil_incomplet'::text,
            'Completează-ți profilul (pseudonim, preferințe de locuință, cel puțin o zonă și un interes) ca să te poți alătura grupului.'::text,
            NULL::text, v_inv.grup_id, v_grup_nume::text;
        RETURN;
    END IF;

    -- ── locuri libere ───────────────────────────────────────────────
    -- Se numără pe server; până acum verificarea se făcea în browser,
    -- deci putea fi sărită.
    SELECT count(*) INTO v_activi
    FROM public.grup_membri gm
    WHERE gm.grup_id = v_inv.grup_id AND gm.status = 'activ';

    IF v_grup_max IS NOT NULL AND v_activi >= v_grup_max THEN
        RETURN QUERY SELECT false, 'grup_plin'::text,
            'Grupul a atins numărul maxim de membri. Contactează adminul grupului.'::text,
            NULL::text, v_inv.grup_id, v_grup_nume::text;
        RETURN;
    END IF;

    -- ── REGULA CENTRALĂ ─────────────────────────────────────────────
    -- Invitat de adminul grupului  → intră direct `activ`
    -- Invitat de un membru obișnuit → `pending`, adminul aprobă
    v_status_nou := CASE
        WHEN v_inv.invited_by IS NOT NULL AND v_inv.invited_by = v_grup_admin
        THEN 'activ' ELSE 'pending'
    END;

    IF v_membru_id IS NOT NULL THEN
        -- rând vechi, de la o plecare sau o excludere anterioară
        UPDATE public.grup_membri
           SET status = v_status_nou, joined_at = now()
         WHERE id = v_membru_id;
    ELSE
        INSERT INTO public.grup_membri (grup_id, user_id, status)
        VALUES (v_inv.grup_id, v_uid, v_status_nou);
    END IF;

    UPDATE public.grup_invitations SET status = 'accepted' WHERE id = v_inv.id;

    RETURN QUERY SELECT true, 'ok'::text,
        CASE WHEN v_status_nou = 'activ'
             THEN 'Ai intrat în grup.'
             ELSE 'Cererea ta a fost trimisă adminului grupului spre aprobare.'
        END::text,
        v_status_nou::text, v_inv.grup_id, v_grup_nume::text;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_group_invitation(text) IS
'Accepta o invitatie de grup pe server: valideaza tokenul, adresa, expirarea, locurile libere si profilul completat, apoi scrie randul de membru (activ daca invitatia vine de la adminul grupului, altfel pending). Singura cale prin care se poate ajunge activ fara aprobare.';


-- ═══════════════════════════════════════════════════════════════════
--  CONTROALE
-- ═══════════════════════════════════════════════════════════════════

-- Poți rula tot fișierul dintr-o bucată — editorul îl tratează ca pe o
-- singură tranzacție, deci ori se creează toate patru funcțiile, ori
-- niciuna. Interogarea de mai jos e ultima, deci rezultatul ei e cel
-- care rămâne afișat. Cele două controale sunt unite tocmai de aceea.
--
-- AȘTEPTAT, exact:
--   • patru rânduri „1. functii", toate cu `security_definer: true`
--   • un rând „2. prag": membri activi 29, complet 28, incomplet 1
--     Cifra 1 trebuie să fie IDENTICĂ cu cea din inventar (CSV 44).
--     Dacă iese alta, funcția nu spune același lucru ca verificarea
--     de mână și NU mergem mai departe cu fișierul 7.

SELECT ce, rezultat FROM (

    SELECT '1. functii' AS ce,
           p.proname || '  |  security_definer: ' || p.prosecdef AS rezultat
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('profil_complet', 'este_admin_grup',
                        'cont_de_agentie', 'accept_group_invitation')

    UNION ALL

    -- Pragul, rulat prin funcția nouă, peste membrii activi reali.
    SELECT '2. prag',
           'membri activi ' || count(*)
             || ', cu profil complet '   || count(*) FILTER (WHERE public.profil_complet(gm.user_id))
             || ', cu profil incomplet ' || count(*) FILTER (WHERE NOT public.profil_complet(gm.user_id))
    FROM public.grup_membri gm
    WHERE gm.status = 'activ'

) t
ORDER BY ce, rezultat;


-- ═══════════════════════════════════════════════════════════════════
--  ⚠️ CE NU DOVEDESC CONTROALELE DE MAI SUS
-- ═══════════════════════════════════════════════════════════════════
-- În SQL Editor rulezi ca `postgres`, deci `auth.uid()` e NULL și
-- `auth.jwt()` nu există. `accept_group_invitation` iese pe prima
-- ramură („fără cont") și NU-i atinge niciodată corpul — deci faptul
-- că „merge" aici nu spune absolut nimic despre ea.
--
-- Proba adevărată se dă impersonând, într-un tab separat, cu tokenul
-- unei invitații reale `pending` (înlocuiește UUID-ul și adresa cu ale
-- contului invitat, NU cu ale superadminului):
--
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-UL-INVITATULUI","role":"authenticated","email":"adresa@invitatului"}',
--       true);
--   SET LOCAL role authenticated;
--   SELECT * FROM public.accept_group_invitation('TOKENUL-REAL');
--
-- ⚠️ Rulează asta doar dacă ești dispus să accepți efectiv invitația —
-- funcția SCRIE. Pentru o probă fără urmări, folosește tokenul unei
-- invitații deja `accepted`: trebuie să întoarcă `stare_gresita`,
-- ceea ce dovedește că funcția chiar rulează și că nu crapă cu 42804.

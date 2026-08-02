-- ═══════════════════════════════════════════════════════════════════
--  PASUL 4 — închide `grup_invitations`
--
--  ⚠⚠ NU RULA ASTA ÎNAINTE DE:
--     1. să fi rulat `3-functie-invitatie-dupa-token.sql`, ȘI
--     2. `accept-invite.html` să fie DEPLOYAT pe cPanel.
--
--  Ordinea inversă = orice om care dă click pe linkul de invitație
--  primit pe email vede „Invitație negăsită". Aceeași lecție ca la
--  profiles (1 august) și la grup_membri (2 august):
--  funcție/view → cod live → strâns politicile. Niciodată altfel.
--
--  ⚠ NU pune BEGIN…ROLLBACK în acest script — vezi memoria
--  `supabase-sql-editor-rollback`. Editorul rulează tot fișierul ca
--  o singură tranzacție, deci un ROLLBACK de probă la final anulează
--  tăcut și modificările de deasupra.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
--  CE E GREȘIT AZI (măsurat, nu presupus — 2 august 2026)
-- ═══════════════════════════════════════════════════════════════════
--
--  „Select invitations"  SELECT · rol {public} · qual = true
--     Rolul `public` acoperă și `anon`, și `authenticated`. Adică
--     ORICINE, fără cont, cere `GET /rest/v1/grup_invitations` și
--     primește rândul întreg: `invited_email` (adresă reală) și
--     `token`. Verificat azi cu cheia anon: 200, 1 rând, 9 coloane.
--     Exact tiparul `profiles_select_all` / `anon_count_grup_membri`.
--     Azi e o singură invitație, de test — dar ORICE invitație
--     viitoare stă acolo cât timp e `pending`.
--
--  „Update invitations"  UPDATE · rol {public} · qual = auth.uid() IS NOT NULL
--     Mai slabă decât pare: nu spune „invitația TA", spune „ești
--     logat". Deci orice om cu cont poate modifica ORICE invitație —
--     inclusiv să-și pună propria adresă pe invitația altcuiva și
--     apoi s-o accepte. Se strânge în același pas.
--
--  „Insert invitations"  INSERT · {public} · invited_by = auth.uid()
--                        AND autorul e membru activ al grupului
--     ✅ ASTA E BUNĂ. NU se atinge. (Oricum e ocolită de
--     `create_group_invitation`, care e SECURITY DEFINER.)


-- ═══════════════════════════════════════════════════════════════════
--  1. CITIREA — doar cel invitat
-- ═══════════════════════════════════════════════════════════════════
-- Cine mai are nevoie să citească tabela direct din browser, după
-- schimbarea de cod:
--   • `grup-details.html:3268` — invitația din `?invite=TOKEN`
--   • `grup-details.html:3280` — invitațiile `pending` pe adresa proprie
-- Ambele sunt ale celui invitat, deci potrivirea pe email le acoperă.
--
-- Cine NU mai are nevoie:
--   • `accept-invite.html` — trece prin `get_invitation_by_token`
--   • modalul „Invită membru" — trece prin `list_group_invitations`
--
-- ⚠ `auth.jwt() ->> 'email'` NU citește din `profiles`. E important:
-- pe 1 august, 12 politici care citeau `profiles` de mână au golit
-- pagini întregi după revocarea drepturilor pe coloane (memoria
-- `politici-rls-citesc-direct-din-profiles`). Aici nu există riscul
-- ăla — adresa vine din token, nu din tabelă.
--
-- `is_platform_admin()` e SECURITY DEFINER, construită exact ca să
-- poată fi apelată din politici fără să se rupă de revocări.

DROP POLICY IF EXISTS "Select invitations" ON public.grup_invitations;

CREATE POLICY "Invitatul isi vede invitatia" ON public.grup_invitations
    FOR SELECT TO authenticated
    USING (
        lower(invited_email) = lower(auth.jwt() ->> 'email')
        OR public.is_platform_admin()
    );


-- ═══════════════════════════════════════════════════════════════════
--  2. SCRIEREA — doar cel invitat, doar pe rândul lui
-- ═══════════════════════════════════════════════════════════════════
-- Ce scrie frontendul, tot cu `status`, tot pe invitația proprie:
--   • `grup-details.html:3298` → 'expired'
--   • `grup-details.html:3416` → 'accepted'
--   • `grup-details.html:3516` → 'rejected'
--   • `accept-invite.html`     → 'accepted' (cazul „ești deja membru")
--
-- `WITH CHECK` e la fel de important ca `USING`: fără el, cineva ar
-- putea muta invitația pe altă adresă printr-un UPDATE și apoi n-ar
-- mai fi a nimănui. Cu el, rândul trebuie să rămână al aceluiași om
-- și după modificare.
--
-- ⚠ Marcarea automată a expirării (care se făcea din browser, de un
-- vizitator NELOGAT, `accept-invite.html:256`) e mutată în
-- `get_invitation_by_token` — funcția rulează cu drepturile
-- proprietarului, deci nu are nevoie de politica asta.

DROP POLICY IF EXISTS "Update invitations" ON public.grup_invitations;

CREATE POLICY "Invitatul isi raspunde la invitatie" ON public.grup_invitations
    FOR UPDATE TO authenticated
    USING (
        lower(invited_email) = lower(auth.jwt() ->> 'email')
        OR public.is_platform_admin()
    )
    WITH CHECK (
        lower(invited_email) = lower(auth.jwt() ->> 'email')
        OR public.is_platform_admin()
    );


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL 1 — ce politici au rămas
-- ═══════════════════════════════════════════════════════════════════
-- Așteptat: TREI rânduri — INSERT (cea veche, neatinsă), SELECT și
-- UPDATE (cele două noi, ambele `{authenticated}`).
-- ⚠ Dacă mai apare vreuna cu rolul `{public}` sau cu qual `true` pe
-- SELECT, gaura nu s-a închis: politicile permisive se combină cu OR,
-- deci cea largă o anulează pe cea strictă.

SELECT policyname, cmd AS operatie, roles AS pentru_cine,
       qual AS conditie_citire, with_check AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'grup_invitations'
ORDER BY cmd, policyname;


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL 2 — proba impersonând, nu ca superadmin
-- ═══════════════════════════════════════════════════════════════════
-- ⚠ În SQL Editor ești `postgres`: vezi tot, indiferent de politici,
-- iar `auth.uid()` e NULL. O interogare rulată așa NU dovedește nimic.
-- Se impersonează, în alt tab, ca să nu se amestece cu scriptul ăsta:
--
--   BEGIN;
--     SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-UL-TAU","role":"authenticated","email":"adresa@ta.ro"}', true);
--     SET LOCAL role authenticated;
--     -- ar trebui să vezi DOAR invitațiile trimise pe adresa ta:
--     SELECT id, grup_id, status FROM public.grup_invitations;
--   ROLLBACK;
--
-- ⚠ Nu proba cu contul de superadmin — trece prin `is_platform_admin()`
-- și vede tot, adică ascunde exact ce vrem să verificăm.
-- ⚠ Conturile Carmen/Tibs sunt ale unor oameni reali — se folosesc
-- doar prin impersonare aici, nu prin logare pe site.


-- ═══════════════════════════════════════════════════════════════════
--  VERIFICAREA CARE CONTEAZĂ — se face DIN AFARĂ
-- ═══════════════════════════════════════════════════════════════════
-- Cu cheia anon din `frontend/js/supabase-config.js`:
--
--   GET /rest/v1/grup_invitations?select=*
--        ÎNAINTE: 200, Content-Range: 0-0/1, cu invited_email + token
--        DUPĂ:    200, Content-Range: */0   ← listă goală
--
--   POST /rest/v1/rpc/get_invitation_by_token  {"p_token":"…"}
--        DUPĂ:    tot răspunde — starea, grupul, adresa mascată
--
-- Și în interfață, cu linkul unei invitații reale:
--   • nelogat        → ecranul „Conectează-te", cu numele grupului
--   • logat, corect  → banner-ul de acceptare pe pagina grupului
--   • logat, alt cont→ „Email diferit", cu adresa mascată


-- ═══════════════════════════════════════════════════════════════════
--  DACĂ SE STRICĂ CEVA — revenire în 5 secunde
-- ═══════════════════════════════════════════════════════════════════
-- Decomentează și rulează. Redeschide gaura, dar repune site-ul în
-- starea de dinainte până înțelegem ce n-a mers.
--
-- CREATE POLICY "Select invitations" ON public.grup_invitations
--     FOR SELECT USING (true);
-- CREATE POLICY "Update invitations" ON public.grup_invitations
--     FOR UPDATE USING (auth.uid() IS NOT NULL);

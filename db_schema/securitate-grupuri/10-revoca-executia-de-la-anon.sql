-- ═══════════════════════════════════════════════════════════════════
--  10. Funcțiile de grup: doar pentru cine e logat
-- ═══════════════════════════════════════════════════════════════════
--
--  DE CE (10 august 2026)
--  Fișierul 6 scria deja `REVOKE ALL ... FROM PUBLIC` + `GRANT ... TO
--  authenticated`. Probat din exterior cu CHEIA ANONIMĂ, apelul
--    POST /rest/v1/rpc/profil_complet  {"p_user_id": "<uuid>"}
--  a răspuns `200 false`, NU „permission denied" — deci dreptul lui
--  `anon` a rămas. Scurgerea e mică (un singur true/false despre un
--  UUID dat), dar n-are niciun motiv să existe.
--
--  DE CE E SIGUR SĂ REVOCĂM (verificat, nu presupus — CSV 80):
--  singurele politici RLS care cheamă funcțiile astea sunt pe INSERT
--  și UPDATE, toate pe rolul {authenticated}. NICIO politică de SELECT
--  nu le folosește, deci un vizitator nelogat nu le evaluează niciodată
--  și nu are ce să crape (capcana din 1 august, cu terenurile și
--  partenerii rămase goale, nu se aplică aici).
--  Iar în frontend, toate cele 3 apeluri (`accept-invite.html:360`,
--  `grup-details.html:1333`, `grup-nou.html:775`) se fac după login.
--
--  ⚠️ NU ATINGEM `get_invitation_by_token` — aia TREBUIE să rămână
--  deschisă lui `anon`: pagina de invitație o cheamă înainte de login,
--  ca să afle numele grupului. E singura din familie care are voie.
-- ═══════════════════════════════════════════════════════════════════

-- `REVOKE ... FROM PUBLIC` singur NU șterge un grant dat explicit lui
-- `anon` — se scriu amândouă, altfel comanda trece curat și nu schimbă
-- nimic (aceeași capcană ca la GRANT pe tabelă vs. pe coloană).

REVOKE ALL ON FUNCTION public.profil_complet(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.este_admin_grup(uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cont_de_agentie(uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_group_invitation(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.profil_complet(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.este_admin_grup(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.cont_de_agentie(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(text) TO authenticated;


-- ── Proba, în aceeași rulare ────────────────────────────────────────
-- `anon=X` nu mai trebuie să apară nicăieri în coloana `drepturi`.

SELECT
    p.proname || '(' || pg_get_function_arguments(p.oid) || ')' AS functie,
    COALESCE(
        array_to_string(p.proacl, '  |  '),
        '(fara ACL explicit ⇒ EXECUTE pentru PUBLIC, adica si anon)'
    ) AS drepturi
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('profil_complet', 'este_admin_grup', 'cont_de_agentie',
                    'accept_group_invitation', 'get_invitation_by_token')
ORDER BY 1;

-- ⏭️ DUPĂ RULARE, două probe pe viu:
--   1. Deschide un link de invitație NELOGAT — trebuie să vezi în
--      continuare numele grupului și formularul de login
--      (`get_invitation_by_token` a rămas neatinsă).
--   2. Logat, cu profil incomplet, același link — trebuie să vezi
--      ecranul „A mai rămas un pas".

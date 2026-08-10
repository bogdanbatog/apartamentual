-- ═══════════════════════════════════════════════════════════════════
--  9. Cine are voie să execute funcțiile de grup?
-- ═══════════════════════════════════════════════════════════════════
--
--  DE CE EXISTĂ FIȘIERUL ĂSTA (10 august 2026)
--  Fișierul `6-functii-join-cu-aprobare.sql` scrie, pentru fiecare
--  funcție, `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO
--  authenticated`. Probat din exterior cu CHEIA ANONIMĂ, apelul
--    POST /rest/v1/rpc/profil_complet  {"p_user_id": "<uuid>"}
--  a răspuns `200 false`, NU „permission denied". Deci `anon` poate
--  executa funcția — între ce scrie în fișier și ce e în bază e o
--  diferență. Interogarea de mai jos arată drepturile reale.
--
--  ⚠️ NU REVOCA NIMIC ÎNAINTE SĂ CITEȘTI PARTEA A DOUA.
--  Doar SELECT-uri aici, nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════

SELECT
    p.proname || '(' || pg_get_function_arguments(p.oid) || ')' AS functie,
    p.prosecdef                                                 AS security_definer,
    COALESCE(
        array_to_string(p.proacl, '  |  '),
        '(fara ACL explicit ⇒ EXECUTE pentru PUBLIC, adica si anon)'
    )                                                           AS drepturi
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('profil_complet', 'este_admin_grup',
                    'cont_de_agentie', 'accept_group_invitation')
ORDER BY 1;

-- Cum se citește coloana `drepturi`:
--   postgres=X/postgres        → doar proprietarul
--   authenticated=X/postgres   → rolul logat, corect
--   anon=X/postgres            → ⚠️ vizitatorii nelogați pot executa
--   =X/postgres                → ⚠️ PUBLIC, adică toată lumea


-- ═══════════════════════════════════════════════════════════════════
--  PARTEA A DOUA — de citit ÎNAINTE de orice REVOKE
-- ═══════════════════════════════════════════════════════════════════
--
--  În Postgres, o politică RLS care cheamă o funcție se evaluează cu
--  drepturile ROLULUI CARE INTEROGHEAZĂ. Dacă îi iei lui `anon`
--  dreptul de EXECUTE pe o funcție folosită într-o politică de SELECT,
--  interogarea unui vizitator nelogat nu întoarce „fals" — CRAPĂ, și
--  odată cu ea toată pagina. Exact așa au rămas goale paginile de
--  terenuri și parteneri pe 1 august.
--
--  Deci întâi: CE politici cheamă funcțiile astea și pe ce comenzi?
--  (`cmd` = SELECT / INSERT / UPDATE / ALL; `roles` = cine e vizat)

SELECT
    schemaname || '.' || tablename AS tabela,
    policyname                     AS politica,
    cmd                            AS comanda,
    roles::text                    AS roluri,
    COALESCE(qual, '')  || ' || ' || COALESCE(with_check, '') AS conditie
FROM pg_policies
WHERE schemaname = 'public'
  AND (COALESCE(qual, '') || COALESCE(with_check, '')) ~
      '(profil_complet|este_admin_grup|cont_de_agentie)'
ORDER BY tabela, politica;

-- Regula de decizie, în cuvinte simple:
--   • Dacă o funcție apare DOAR în politici de INSERT/UPDATE cu rolul
--     {authenticated}, atunci `anon` n-are nevoie de ea → se poate
--     revoca fără risc.
--   • Dacă apare într-o politică de SELECT pe o tabelă pe care o
--     citesc și vizitatorii nelogați → NU revoca de la `anon`, altfel
--     rupi pagina. Scurgerea (un singur true/false per UUID) e mai
--     ieftină decât o pagină moartă.


-- ═══════════════════════════════════════════════════════════════════
--  REPARAȚIA — de rulat DOAR dacă partea a doua o confirmă
-- ═══════════════════════════════════════════════════════════════════
--
--  `REVOKE ... FROM PUBLIC` singur NU șterge un grant dat explicit lui
--  `anon` (aceeași capcană ca la GRANT pe tabelă vs. pe coloană), de
--  aia se scriu amândouă.
--
-- REVOKE ALL ON FUNCTION public.profil_complet(uuid) FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.profil_complet(uuid) TO authenticated;
--
--  După rulare, re-probează din exterior cu cheia anonimă: apelul
--  trebuie să întoarcă 401/403 „permission denied for function", nu
--  `200 false`. Și deschide o pagină de grup NELOGAT, ca să vezi că
--  n-a crăpat nimic.

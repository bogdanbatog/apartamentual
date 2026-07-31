-- ═══════════════════════════════════════════════════════════════════
-- DIAGNOSTIC: userul radulesc@gmail.com în grupul „Parcul Circului"
-- Rulează blocurile pe rând în Supabase SQL Editor (glbvbbgmcobtswwlktic).
-- Toate interogările sunt DOAR CITIRE (SELECT). Nu modifică nimic.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Există contul de autentificare? Și-a confirmat emailul? ──────
-- Dacă email_confirmed_at este NULL, userul NU s-a putut loga niciodată,
-- deci nu avea cum să apese „Cere alăturarea".
SELECT
    id            AS user_id,
    email,
    created_at    AS cont_creat,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
WHERE email ILIKE '%radulesc%';


-- ── 2. Există rândul de profil? Ce conține? ─────────────────────────
-- pseudonym NULL  = profil necompletat -> nu apare pe /utilizatori.html
-- account_type != 'activ' -> nu apare pe /utilizatori.html
-- account_status = 'deleted' -> e ascuns din liste de membri și cereri
SELECT
    user_id,
    email,
    pseudonym,
    account_type,
    account_status,
    created_at,
    updated_at
FROM public.profiles
WHERE email ILIKE '%radulesc%';


-- ── 2b. Conturi de auth FĂRĂ rând în profiles (orfani) ──────────────
-- Dacă radulesc apare aici, trigger-ul handle_new_user a eșuat la el.
-- Un user orfan e invizibil peste tot: și în admin, și în listele de membri.
SELECT
    u.id      AS user_id,
    u.email,
    u.created_at,
    u.email_confirmed_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ORDER BY u.created_at DESC;


-- ── 3. Grupul „Parcul Circului" ─────────────────────────────────────
-- Atenție: în exportul din 29 iulie numele apare cu virgulă la final
-- („Parcul Circului,"), de aceea căutăm cu ILIKE, nu cu egal.
SELECT
    id        AS grup_id,
    nume,
    status,
    admin_id,
    max_membri,
    created_at
FROM public.grupuri
WHERE nume ILIKE '%circului%';


-- ── 4. Toate rândurile lui radulesc în grup_membri (ORICE status) ───
-- Aici se vede negru pe alb dacă a dat sau nu join.
--   status = 'pending' -> a cerut alăturarea, așteaptă aprobarea ta
--   status = 'activ'   -> e membru cu drepturi depline
SELECT
    gm.*,
    g.nume    AS nume_grup,
    g.status  AS status_grup
FROM public.grup_membri gm
JOIN public.grupuri g ON g.id = gm.grup_id
JOIN auth.users u     ON u.id = gm.user_id
WHERE u.email ILIKE '%radulesc%';


-- ── 5. Toți membrii + cererile din „Parcul Circului", cu profilul lor ─
-- Coloana `problema` arată de ce un rând e invizibil în interfață:
--   PROFIL LIPSA  -> filtrul din grup-details.html îl scoate din listă
--   PROFIL STERS  -> idem (account_status = 'deleted')
--   OK            -> ar trebui să se vadă
SELECT
    gm.status                                   AS status_membru,
    u.email,
    p.pseudonym,
    p.account_type,
    p.account_status,
    gm.joined_at,
    CASE
        WHEN p.user_id IS NULL                  THEN 'PROFIL LIPSA (invizibil in UI)'
        WHEN p.account_status = 'deleted'       THEN 'PROFIL STERS (invizibil in UI)'
        WHEN p.account_type = 'profesional'     THEN 'CONT DE AGENTIE'
        WHEN p.pseudonym IS NULL                THEN 'PROFIL NECOMPLETAT (vizibil in grup, dar nu pe /utilizatori)'
        ELSE 'OK'
    END                                         AS problema
FROM public.grup_membri gm
JOIN public.grupuri g ON g.id = gm.grup_id
LEFT JOIN auth.users u     ON u.id = gm.user_id
LEFT JOIN public.profiles p ON p.user_id = gm.user_id
WHERE g.nume ILIKE '%circului%'
ORDER BY gm.status, gm.joined_at;

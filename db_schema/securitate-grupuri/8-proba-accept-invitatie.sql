-- ═══════════════════════════════════════════════════════════════════
--  PASUL 8 — PROBA CARE CHIAR RULEAZĂ `accept_group_invitation`
--
--  DE CE EXISTĂ, pe scurt: `RETURNS TABLE` NU se verifică la creare.
--  Pe 1 august, `create_group_invitation` s-a creat fără nicio eroare
--  și a crăpat abia la prima invitație reală, cu
--  `42804: structure of query does not match function result type`,
--  fiindcă declarase `token uuid` iar coloana e `varchar(100)`.
--  „Funcția există și e SECURITY DEFINER" nu e o probă că merge.
--
--  ⚠️ ÎN SQL EDITOR, `auth.uid()` E NULL (rulezi ca `postgres`, fără
--  token). Apelată direct, funcția iese pe prima ramură („fără cont")
--  și nu-i atinge niciodată corpul — deci n-ar dovedi nimic. De aceea
--  proba se face IMPERSONÂND.
--
--  CE FACE SCRIPTUL: rulează acceptarea pe o invitație reală `pending`,
--  cu identitatea celui invitat, apoi ANULEAZĂ TOT prin ROLLBACK.
--  Nimeni nu intră în niciun grup, nicio invitație nu rămâne acceptată.
--
--  ⚠️ RULEAZĂ-L ÎNTREG, DINTR-O SINGURĂ APĂSARE. E o singură
--  tranzacție care se termină cu ROLLBACK — exact comportamentul care
--  ne-a păcălit pe 1 august (un ROLLBACK anulează tot scriptul) și care
--  aici e fix ce vrem.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Alegem o invitație `pending` a cărei adresă are cont ─────────
-- (fără cont, funcția n-are pe cine impersona)
-- Valorile se pun în variabile de sesiune, nu într-un tabel temporar:
-- după `SET LOCAL role authenticated` n-am mai avea drepturi pe el.
SELECT
    set_config('proba.token', i.token, true)                AS token_ales,
    set_config('proba.uid',   p.user_id::text, true)         AS uid_ales,
    set_config('proba.email', lower(i.invited_email), true)  AS email_ales
FROM public.grup_invitations i
JOIN public.profiles p ON lower(p.email) = lower(i.invited_email)
WHERE i.status = 'pending'
  AND (i.expires_at IS NULL OR i.expires_at > now())
ORDER BY i.created_at DESC
LIMIT 1;

-- Dacă interogarea de mai sus a întors 0 rânduri, nu există invitație
-- pending cu cont — sari la PROBA B de la finalul fișierului.


-- ── 2. Devenim, pentru o clipă, omul invitat ────────────────────────
-- ⚠️ NU folosi contul superadminului: `is_platform_admin()` e true
-- pentru el și ar ascunde exact ce vrem să vedem.
SELECT set_config(
    'request.jwt.claims',
    json_build_object(
        'sub',   current_setting('proba.uid',   true),
        'role',  'authenticated',
        'email', current_setting('proba.email', true)
    )::text,
    true
);

SET LOCAL role authenticated;


-- ── 3. Apelul propriu-zis ───────────────────────────────────────────
-- AȘTEPTAT: un rând cu
--   ok = true
--   motiv = 'ok'
--   status_membru = 'activ'  (dacă invitația vine de la adminul grupului)
--               sau 'pending' (dacă vine de la un membru obișnuit)
--   grup = un uuid, grup_nume = numele grupului, nu NULL
--
-- ORICE eroare `42804` aici înseamnă că o castare lipsește și
-- NU mergem mai departe cu fișierul 7.
--
-- `ok = false` cu `motiv = 'profil_incomplet'` e tot un rezultat bun:
-- dovedește că funcția a rulat până adânc în corp și că pragul se
-- aplică. La fel `grup_plin`.

SELECT * FROM public.accept_group_invitation(current_setting('proba.token', true));


-- ── 4. Anulăm tot ───────────────────────────────────────────────────
ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════
--  PROBA B — dacă nu există nicio invitație `pending` cu cont
-- ═══════════════════════════════════════════════════════════════════
-- Mai slabă (nu atinge scrierea), dar tot dovedește că funcția rulează
-- și că tipurile se potrivesc pe ramura care întoarce valori din
-- coloane. Ia tokenul unei invitații DEJA `accepted` sau `rejected`:
-- trebuie să întoarcă `ok=false, motiv='stare_gresita'` și un `grup`
-- uuid nenul, fără 42804.
--
-- Rulează blocul de mai jos separat, după ce înlocuiești UUID-ul și
-- adresa cu ale unui cont OBIȘNUIT (nu superadmin):
--
-- BEGIN;
-- SELECT set_config('request.jwt.claims',
--     '{"sub":"UUID-UTILIZATOR","role":"authenticated","email":"adresa@lui"}',
--     true);
-- SET LOCAL role authenticated;
-- SELECT * FROM public.accept_group_invitation('TOKENUL-UNEI-INVITATII-ACCEPTATE');
-- ROLLBACK;
--
-- Ca să găsești un token potrivit, rulează întâi (ca postgres):
--   SELECT token, invited_email, status FROM public.grup_invitations
--   WHERE status <> 'pending' ORDER BY created_at DESC LIMIT 5;

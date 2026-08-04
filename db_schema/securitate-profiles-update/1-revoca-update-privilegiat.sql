-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES — ÎNCHIDEREA SCRIERII PE COLOANELE PRIVILEGIATE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️⚠️ RULAT PE 4 AUGUST, A MERS DOAR PE JUMĂTATE. NU-L MAI RULA.
--       Blocul 3 (`anon`) a închis tot — acela e bun și rămâne aplicat.
--       Blocul 2 (`authenticated`) s-a executat fără eroare și n-a schimbat
--       nimic: `authenticated` are grant pe TABELĂ, iar un REVOKE pe coloană
--       nu poate scădea dintr-un grant de tabelă.
--       Continuarea corectă: `2-revoca-tabel-apoi-lista-coloane.sql`.
--       Fișierul ăsta rămâne pentru istoric și pentru diagnostic.
--
-- PROBLEMA (găsită 4 august 2026, la inventarul făcut pentru digest):
--
-- Rolul `authenticated` are drept de UPDATE pe `profiles.is_super_admin`.
-- Politicile de RLS nu-l opresc, pentru că din cele patru politici de UPDATE
-- două sunt largi:
--
--     Users can update own profile    {authenticated}  check: auth.uid() = user_id
--     profiles_update_own             {public}         check: auth.uid() = user_id
--
-- iar a treia, scrisă anume ca să apere coloana:
--
--     Users can update their own profile except admin status
--         check: (auth.uid() = user_id) AND (is_super_admin() OR (is_super_admin = false))
--
-- e fără efect. Politicile permisive se combină cu SAU, deci e destul ca una
-- să spună „da". Cea strictă nu poate interzice nimic cât timp lângă ea stă
-- una largă. (Același tipar ca la politica „doar pentru numărat" de pe
-- grup_membri, 2 august.)
--
-- CONSECINȚA: orice utilizator logat își poate da singur drepturi de
-- superadmin printr-o cerere directă către API, cu cheia publică `anon` din
-- JavaScript-ul site-ului. Superadmin = citirea tuturor profilurilor, deci a
-- tuturor emailurilor și telefoanelor.
--
-- REPARAȚIA DE AICI: tăiem GRANTUL, nu politica. Drepturile pe coloană se
-- verifică ÎNAINTE de RLS — fără UPDATE pe coloană, nicio politică nu mai
-- contează. E cea mai mică schimbare care închide gaura și e reversibilă
-- printr-un GRANT.
--
-- ⚠️ Curățarea politicilor redundante (ștergerea celor două largi, ca să
--    rămână doar cea strictă) e pasul următor, ÎNTR-UN FIȘIER SEPARAT.
--    Nu le amestecăm: aici schimbăm drepturi, acolo schimbăm politici.
--
-- ⚠️ FĂRĂ BEGIN / ROLLBACK în acest fișier. Editorul rulează tot ca o singură
--    tranzacție, iar un ROLLBACK de probă anulează tăcut și revocările.
--
-- ⚠️ Tabelă cu 80 de utilizatori reali. Rulează bloc cu bloc.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Ce e acum (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Fotografia dinainte. Păstreaz-o: e proba că reparația a schimbat ceva.

select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type = 'UPDATE'
  and column_name  in ('is_super_admin', 'is_admin', 'user_id', 'created_at', 'email')
order by grantee, column_name;

-- Așteptat ÎNAINTE de reparație: 10 rânduri (5 coloane × 2 roluri).


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Coloanele privilegiate, luate de la `authenticated`
-- ───────────────────────────────────────────────────────────────────────────
-- De ce exact acestea cinci și nu mai multe: sunt singurele pe care NICIO
-- pagină din aplicație nu le scrie. Verificat pe cod, 4 august:
--
--   • profile-edit-new.js scrie: pseudonym, profession, phone, age,
--     is_email_public, is_age_public, preferred_rooms, preferred_area_sqm,
--     preferred_city_id, description, agency_name, agency_website,
--     agency_description
--   • admin-utilizatori.html scrie: account_status, suspended_until, is_demo
--   • profile-view-new.js scrie: notes
--
-- ⚠️ De ce NU revoc account_status / suspended_until / is_demo / notes, deși
--    sunt la fel de sensibile: granturile sunt pe ROL, iar superadminul e și
--    el `authenticated`. Revocarea lor ar omorî paginile de admin. Acolo
--    apărarea trebuie să fie politica de RLS, nu grantul — pas separat.

revoke update (is_super_admin) on public.profiles from authenticated;
revoke update (is_admin)       on public.profiles from authenticated;
revoke update (user_id)        on public.profiles from authenticated;
revoke update (created_at)     on public.profiles from authenticated;
revoke update (email)          on public.profiles from authenticated;

-- Notă despre `email`: e o oglindă a adresei din `auth.users`, nu sursa de
-- adevăr. Nicio pagină n-o scrie prin UPDATE, iar înscrierea folosește INSERT
-- (drept separat, neatins aici). O las revocată pentru că `notify-admins`
-- citește tocmai coloana asta ca să afle unde trimite emailurile — nu vrem
-- ca cineva s-o poată rescrie de la client.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — `anon` nu scrie nimic, niciodată
-- ───────────────────────────────────────────────────────────────────────────
-- Azi e oprit din întâmplare, nu prin proiectare: politicile cer
-- `auth.uid() = user_id`, iar pentru un vizitator fără cont `auth.uid()` e
-- NULL, deci nu se potrivește niciun rând. Dar grantul există, pe toate
-- coloanele, inclusiv is_super_admin. Dacă mâine cineva adaugă o politică
-- permisivă pe rolul `public`, gaura se deschide singură.
--
-- Înscrierea nu suferă: după `signUp` omul are deja sesiune, deci e
-- `authenticated`, nu `anon`. Iar crearea profilului e INSERT, nu UPDATE.

revoke update on public.profiles from anon;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────

-- 4a. Aceeași interogare ca la BLOC 1. Acum trebuie să întoarcă ZERO rânduri.
select grantee, privilege_type, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type = 'UPDATE'
  and column_name  in ('is_super_admin', 'is_admin', 'user_id', 'created_at', 'email')
order by grantee, column_name;

-- 4b. `anon` nu mai are UPDATE pe nicio coloană. Tot zero.
select count(*) as coloane_scrise_de_anon
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      = 'anon'
  and privilege_type = 'UPDATE';

-- 4c. Ce a rămas scriitibil pentru `authenticated`. Citește lista pe îndelete
--     și confirmă că fiecare coloană de aici e scrisă de o pagină reală.
select column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;

-- 4d. Câți superadmini există acum? Numărul trebuie să fie cel știut de tine.
--     Dacă e mai mare, cineva a folosit deja gaura — și atunci vorbim.
select count(*) filter (where is_super_admin) as superadmini,
       count(*) filter (where is_admin)       as admini
from public.profiles;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — DE PROBAT ÎN APLICAȚIE, după rulare
-- ───────────────────────────────────────────────────────────────────────────
-- Drepturile pe coloane se văd abia la scriere, nu la creare. Probează:
--
--   1. Intră cu un cont NORMAL (nu al tău de superadmin), deschide pagina de
--      profil, schimbă ceva și salvează. Trebuie să meargă ca înainte.
--      Conturile de test Carmen / Tibs sunt bune pentru asta.
--   2. Intră cu contul tău de superadmin în admin-utilizatori.html și
--      suspendă apoi reactivează un cont de test. Trebuie să meargă.
--   3. Marchează și demarchează pe cineva ca „Exemplu". Trebuie să meargă.
--
-- Dacă vreuna dă „permission denied for column ...", spune-mi CARE coloană —
-- înseamnă că am ratat un loc din cod care o scrie, și dăm grantul înapoi
-- doar pentru ea, cu un singur GRANT.

-- ═══════════════════════════════════════════════════════════════════════════
-- PROFILES — ÎNCHIDEREA SCRIERII PE COLOANELE PRIVILEGIATE (varianta corectă)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE EXISTĂ ACEST FIȘIER: `1-revoca-update-privilegiat.sql` a mers doar pe
-- jumătate. Blocul pentru `anon` a închis tot (probat: 0 coloane). Blocul
-- pentru `authenticated` s-a executat fără eroare și N-A SCHIMBAT NIMIC.
--
-- MOTIVUL, de reținut pentru totdeauna:
--
--   `authenticated` NU are drepturi pe coloane. Are un singur GRANT UPDATE
--   pe TOATĂ tabela. `information_schema.column_privileges` desfășoară un
--   astfel de grant în câte un rând per coloană — de asta inventarul arăta
--   ca o listă de drepturi pe coloane, deși nu era.
--
--   Iar în Postgres, un REVOKE pe o coloană nu poate scădea dintr-un grant
--   dat pe tabelă. Nu dă eroare. Nu face nimic. Tăcut, ca de obicei.
--
-- REPARAȚIA: se ia grantul de tabelă, apoi se dau înapoi coloanele ca listă
-- explicită. Se trece de la „poate scrie orice, în afară de..." la „poate
-- scrie exact astea".
--
-- ⚠️ E o schimbare mai mare decât cea din fișierul 1. Dacă lipsește din listă
--    o coloană pe care o scrie o pagină, pagina aia crapă cu
--    „permission denied for column". De asta lista de mai jos NU e minimală:
--    scot doar cele CINCI coloane despre care am probă în cod că nu le scrie
--    nimeni. Tot restul se dă înapoi, inclusiv coloane vechi, nefolosite —
--    ele nu sunt periculoase, iar păstrarea lor face reparația nerupătoare.
--
-- ⚠️ FĂRĂ BEGIN / ROLLBACK în acest fișier.
-- ⚠️ Tabelă cu 80 de utilizatori reali. Bloc cu bloc.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Confirmă diagnosticul (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Dacă grantul e într-adevăr pe tabelă, apare aici cu column_name gol.

select grantee, privilege_type, table_name
from information_schema.table_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type = 'UPDATE';

-- Așteptat: un rând, `authenticated`. Dacă apare și `anon`, înseamnă că
-- blocul 3 din fișierul 1 n-a prins — spune-mi înainte să mergi mai departe.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Se ia grantul de tabelă
-- ───────────────────────────────────────────────────────────────────────────
-- Atenție: asta șterge ȘI eventualele granturi pe coloane date anterior
-- pentru UPDATE (inclusiv `email_anunturi_grup`, dat azi pentru digest).
-- Se dau toate înapoi în blocul 3. Între cele două blocuri, editarea de
-- profil e picată — de asta se rulează unul după altul, nu cu pauză de cafea
-- între ele.

revoke update on public.profiles from authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Se dau înapoi coloanele, ca listă explicită
-- ───────────────────────────────────────────────────────────────────────────
-- LIPSESC EXACT CINCI: is_super_admin, is_admin, user_id, created_at, email.
--
-- Probă că nicio pagină nu le scrie (verificat pe tot `frontend/`, 4 august):
--   • register.js .................. account_type, account_status, pseudonym,
--                                    profession, phone, age, is_email_public,
--                                    is_age_public, preferred_rooms,
--                                    preferred_area_sqm, preferred_city_id,
--                                    description, agency_name,
--                                    agency_website, agency_description
--   • profile-edit-new.js .......... același set (fără account_*)
--   • admin-utilizatori.html ....... account_status, suspended_until, is_demo
--   • profile-view-new.js .......... notes
--   • digest-anunturi-grup ......... email_anunturi_grup (citit, nu scris,
--                                    dar bifa din profil îl va scrie)
--
-- Coloanele vechi (first_name, varsta, zona, profesie, anul_nasterii,
-- tip_apartament_cauta, last_name) rămân scriitibile deși nu le folosește
-- nimic azi. Nu sunt periculoase, iar dacă mai există vreo pagină veche pe
-- care n-am găsit-o, nu se rupe.

grant update (
    -- profil, scrise de register.js și profile-edit-new.js
    pseudonym,
    profession,
    phone,
    age,
    description,
    is_email_public,
    is_age_public,
    preferred_rooms,
    preferred_area_sqm,
    preferred_city_id,
    -- agenții
    agency_name,
    agency_website,
    agency_description,
    -- stare cont: scrise de register.js și de paginile de admin
    account_type,
    account_status,
    suspended_until,
    is_demo,
    notes,
    -- digestul de anunțuri
    email_anunturi_grup,
    -- coloane vechi, păstrate ca să nu rupem vreo pagină negăsită
    first_name,
    last_name,
    varsta,
    anul_nasterii,
    zona,
    profesie,
    tip_apartament_cauta,
    updated_at
) on public.profiles to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — VERIFICARE
-- ───────────────────────────────────────────────────────────────────────────

-- 4a. Grantul de tabelă a dispărut? Trebuie ZERO rânduri.
select grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type = 'UPDATE';

-- 4b. Cele cinci coloane sunt închise? Trebuie ZERO rânduri.
--     ASTA E PROBA CARE CONTEAZĂ. Dacă întoarce rânduri, gaura e deschisă.
select grantee, column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type = 'UPDATE'
  and column_name  in ('is_super_admin', 'is_admin', 'user_id', 'created_at', 'email');

-- 4c. Ce a rămas scriitibil. Așteptat: 27 de coloane, niciuna din cele cinci.
select column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      = 'authenticated'
  and privilege_type = 'UPDATE'
order by column_name;

-- 4d. Câți superadmini și admini sunt acum. Compară cu ce știi tu.
select count(*) filter (where is_super_admin) as superadmini,
       count(*) filter (where is_admin)       as admini
from public.profiles;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — DE PROBAT ÎN APLICAȚIE (obligatoriu, imediat)
-- ───────────────────────────────────────────────────────────────────────────
--   1. Cont NORMAL (Carmen sau Tibs): deschide profilul, schimbă ceva, salvează.
--   2. Contul tău de superadmin, admin-utilizatori.html: suspendă și
--      reactivează un cont de test.
--   3. Tot acolo: marchează și demarchează pe cineva ca „Exemplu".
--   4. Dacă poți, o înscriere nouă cu un email de unică folosință.
--
-- Dacă apare „permission denied for column X", spune-mi CARE X. Se repară cu
-- o singură linie:
--     grant update (X) on public.profiles to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ DE ȚINUT MINTE PENTRU VIITOR
-- ───────────────────────────────────────────────────────────────────────────
-- De acum, `profiles` are drepturi de UPDATE pe LISTĂ EXPLICITĂ, nu pe tabelă.
-- Orice coloană nouă adăugată de aici încolo NU va fi scriitibilă din
-- aplicație până nu primește propriul GRANT. E comportamentul sigur, dar e și
-- o capcană: se manifestă ca „butonul de salvare nu face nimic", nu ca o
-- eroare evidentă. Când adaugi o coloană pe care o scrie utilizatorul, adaugă
-- în aceeași migrație:
--     grant update (coloana_noua) on public.profiles to authenticated;

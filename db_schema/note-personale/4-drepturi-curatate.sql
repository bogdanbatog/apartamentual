-- ═══════════════════════════════════════════════════════════════════════════
-- IGIENA DREPTURILOR PE TABELELE DE NOTIȚE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE S-A MĂSURAT (19 august 2026):
--   - RLS e PORNIT pe `user_notes` și pe `user_teren_notes` (`relrowsecurity = t`)
--   - `user_teren_notes` are 4 politici, fiecare pe `auth.uid() = user_id`
--   - `user_notes` are 3 politici (select/insert/update). Lipsa lui DELETE e
--     intenționată: nota se golește, rândul nu se șterge.
--   - DAR `anon` și `authenticated` au pe `user_teren_notes` TOATE drepturile,
--     inclusiv TRUNCATE, TRIGGER și REFERENCES. Le-a primit implicit la creare
--     (capcana știută: Supabase acordă `ALL` din oficiu).
--
-- CÂT DE GRAV E: mic, azi. `anon` nu e un rol de login la Postgres, se ajunge
-- la el doar prin PostgREST cu cheia anonimă, iar PostgREST nu expune TRUNCATE.
-- Rândurile sunt apărate de RLS. Scriptul ăsta scoate drepturile de care nu are
-- nevoie nimeni, ca să nu rămână acolo pentru ziua în care apare un drum nou.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un ROLLBACK pus „doar de probă"
--    anulează tăcut și REVOKE-urile de deasupra.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Ce nu-i trebuie nimănui, niciodată
-- ───────────────────────────────────────────────────────────────────────────
-- TRUNCATE golește tabela fără să treacă prin RLS. TRIGGER și REFERENCES sunt
-- drepturi de administrare a schemei, n-au ce căuta la un rol de aplicație.
-- Niciunul nu e folosit de vreo pagină, deci REVOKE-ul de aici nu poate rupe
-- nimic.

revoke truncate, trigger, references on public.user_teren_notes from anon, authenticated;
revoke truncate, trigger, references on public.user_notes          from anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Drepturile lui `anon` pe notițe  ✅ RULAT 19 august 2026
-- ───────────────────────────────────────────────────────────────────────────
-- Notițele sunt, prin definiție, ale unui om logat. Un vizitator nelogat n-are
-- ce citi și ce scrie acolo: RLS îi întoarce deja listă goală, fiindcă
-- `auth.uid()` e NULL. Deci drepturile lui `anon` sunt inutile.
--
-- ⚠️ DAR REVOKE-ul schimbă FELUL răspunsului, nu doar conținutul: în loc de
--    „am citit, nu e nimic" (listă goală) vine „nu ai voie" (eroare 401/403).
--    O pagină care tratează eroarea altfel decât lista goală se poartă altfel.
--    Homepage-ul chiar face diferența asta dinadins (`blandNul`), tocmai ca să
--    știe dacă să arate câmpul de scris. Rulează blocul ăsta doar dacă ai
--    câteva minute să reîncarci homepage-ul logat și pagina de profil după.
--
revoke all on public.user_teren_notes from anon;
revoke all on public.user_notes       from anon;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — PROBA (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Ce a mai rămas acordat, pe rol.
--
-- Măsurat după rularea din 19 august 2026:
--   anon           → nu mai apare deloc, pe niciuna din tabele
--   authenticated  → user_notes: INSERT, SELECT, UPDATE
--                    user_teren_notes: DELETE, INSERT, SELECT, UPDATE
--   service_role   → tot (neatins dinadins, e rolul edge functions)
--
-- Atât folosesc paginile, nimic în plus. Dacă vreodată vezi aici din nou
-- TRUNCATE sau `anon`, înseamnă că tabela a fost recreată și a primit iar
-- drepturile implicite.

select g.grantee::text                        as rol,
       g.table_name::text                     as tabela,
       string_agg(distinct g.privilege_type, ', ' order by g.privilege_type) as drepturi
from information_schema.role_table_grants g
where g.table_schema = 'public'
  and g.table_name in ('user_notes', 'user_teren_notes')
  and g.grantee in ('anon', 'authenticated', 'service_role')
group by g.grantee, g.table_name
order by g.table_name, g.grantee;

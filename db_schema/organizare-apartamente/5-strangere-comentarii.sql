-- ═══════════════════════════════════════════════════════════════════════════
-- STRÂNGEREA COMENTARIILOR DE TEREN: drepturi și status
-- 30 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: două strângeri pe `grup_teren_comments`, tabela care de acum ține și
-- jurnalul terenului.
--
--   1. `revoke` de la `anon`, ca poarta să fie și pe drepturi, nu doar pe
--      politici.
--   2. `status = 'activ'` în politici, ca membrii NEAPROBAȚI să nu mai
--      citească și să nu mai scrie în jurnal.
--
-- DE CE ACUM: până pe 30 august tabela ținea comentarii despre terenuri, și
-- avea UNUL singur în toată platforma. De azi ține jurnalul: prețul cerut de
-- proprietar, cât e dispus să lase, ce a zis agentul, ce probleme are terenul.
-- Alea sunt lucruri de negociere, iar cine a apăsat „cer să mă alătur" și încă
-- așteaptă răspunsul fondatorului n-are ce să le citească.
--
-- ⚠️ NICIUNA NU E O SCURGERE ACTIVĂ AZI. Le scriu ca atare ca să nu pară mai
--    grav decât e:
--    · `anon` are drepturi de tabelă, dar politicile cer `auth.uid()`, care
--      pentru un nelogat e NULL, deci nu trece niciun rând. Revoke-ul e a doua
--      poartă, nu prima.
--    · membrul `pending` e un om real care a cerut să intre în grup, nu un
--      străin. Dar el vede azi ce vorbește grupul cu agentul, ceea ce nu e în
--      regulă nici așa.
--
-- CE ATINGE SCRIPTUL: DOAR `grup_teren_comments`. Nimic din pachetul de
-- organizare pe apartamente, nimic din pagina grupului în afară de tabela asta.
--
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul rulează tot tabul ca o singură
--    tranzacție, iar un ROLLBACK pus „de probă" anulează tăcut tot.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CINE CITEȘTE AZI (nu schimbă nimic; rulează-l ÎNTÂI)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Memoria proiectului spune negru pe alb că un `revoke` de la `anon` poate
--    rupe pagini publice, fiindcă o politică de SELECT care cheamă o funcție
--    fără drept nu întoarce „fals", ci CRAPĂ toată interogarea. Aici riscul e
--    mic (comentariile se citesc doar din `grup-details.html`, care e pentru
--    logați), dar mic nu înseamnă zero, iar proba costă o interogare.
--
-- Ce se verifică:
--   (a) starea de acum a drepturilor, ca să existe cu ce compara la final;
--   (b) politicile, cu tot cu condiție, ca să se vadă exact ce se schimbă;
--   (c) câți membri `pending` există chiar acum în platformă, adică pe câți
--       oameni îi atinge strângerea a doua.

select 'a. drepturi acum'   as sectiune,
       grantee::text        as nume,
       privilege_type::text as detaliu
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and grantee in ('anon', 'authenticated', 'public')

union all

select 'b. politici acum'   as sectiune,
       policyname::text     as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'

union all

select 'c. membri pending'  as sectiune,
       count(*)::text       as nume,
       'cereri neaprobate in toata platforma' as detaliu
from public.grup_membri
where status::text <> 'activ'

order by sectiune, nume, detaliu;

-- ⚠️ ÎN AFARA SQL-ULUI, înainte de BLOC 1: un grep prin frontend după
--    `grup_teren_comments`. Dacă apare în vreo pagină care se deschide fără
--    cont, `revoke`-ul de la `anon` o rupe. Verificat pe 30 august: apare doar
--    în `grup-details.html`, unde tot ce e legat de terenuri stă în spatele
--    autentificării.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Drepturile
-- ───────────────────────────────────────────────────────────────────────────
-- Tabela a fost creată fără `revoke`, deci a rămas cu drepturile depline pe
-- care Supabase le dă automat. Se strâng acum, ca la toate tabelele scrise în
-- pachetul ăsta.
--
-- ⚠️ `revoke ... from public` NU acoperă `authenticated`: e rol separat, care
--    își primește drepturile direct. De aceea apare pe rândul lui, iar apoi i
--    se dă înapoi exact ce îi trebuie.
--
-- ⚠️ `authenticated` NU primește UPDATE. Nu există în pagină nicio cale de a
--    edita un comentariu sau o intrare de jurnal: se scrie și, dacă e greșit,
--    se șterge. Un drept fără buton e un drept care se folosește doar de cine
--    nu trece prin butoane.

revoke all on public.grup_teren_comments from anon;
revoke all on public.grup_teren_comments from public;
revoke all on public.grup_teren_comments from authenticated;

grant select, insert, delete on public.grup_teren_comments to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Politicile, cu status
-- ───────────────────────────────────────────────────────────────────────────
-- Se rescriu cele trei politici existente, păstrându-le numele, ca istoricul să
-- rămână citibil. Ce se schimbă, față de forma de dinainte:
--
--   · rolul trece de la `public` la `authenticated`. Politicile cereau oricum
--     `auth.uid()`, deci un nelogat nu trecea; dar rolul strâmt spune limpede
--     cui se adresează regula.
--   · se cere `status = 'activ'`. ASTA E SCHIMBAREA CARE CONTEAZĂ: până acum
--     era destul să EXISTE un rând în `grup_membri`, iar un rând se creează în
--     clipa în care cineva cere să intre în grup.
--
-- ⚠️ `status::text` cu cast, nu comparație directă: coloana e `character
--    varying`, confirmat pe 28 august. Fără cast, comparația merge, dar
--    tiparul dovedit în producție pe `grup_teren_checklist` are castul, iar
--    aici nu inventăm o formă nouă.
--
-- ⚠️ Fondatorul grupului e adăugat explicit, ca peste tot: el poate să nu aibă
--    rând în `grup_membri` (e `grupuri.admin_id`), iar fără rândul de mai jos
--    ar rămâne pe dinafară din propriul grup.

drop policy if exists select_comments on public.grup_teren_comments;
create policy select_comments on public.grup_teren_comments
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_comments.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_comments.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists insert_comments on public.grup_teren_comments;
create policy insert_comments on public.grup_teren_comments
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and (
            exists (select 1 from public.grup_membri m
                     where m.grup_id = grup_teren_comments.grup_id
                       and m.user_id = auth.uid()
                       and m.status::text = 'activ')
            or exists (select 1 from public.grupuri g
                        where g.id = grup_teren_comments.grup_id
                          and g.admin_id = auth.uid())
        )
    );

-- Ștergerea rămâne cum era: fiecare doar ce a scris el. Nu i se adaugă
-- `status`, dinadins: dacă cineva iese din grup, comentariile lui rămân, dar
-- dreptul de a-și șterge propriile cuvinte n-are de ce să depindă de asta.
drop policy if exists delete_own_comments on public.grup_teren_comments;
create policy delete_own_comments on public.grup_teren_comments
    for delete to authenticated
    using (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Arată forma, nu comportamentul: în SQL Editor ești `postgres`, `auth.uid()`
--    e NULL și politicile nici nu te ating.
--
--    PROBA ADEVĂRATĂ, de făcut din pagină după ce rulezi:
--      1. cu contul tău, membru într-un grup: comentariile de pe cardurile de
--         teren se văd și se poate scrie unul nou;
--      2. cu un cont care a CERUT să intre și n-a fost aprobat: nu se mai vede
--         niciun comentariu;
--      3. cu un curl pe cheia anonimă către `grup_teren_comments`: listă goală
--         sau refuz, nu rânduri.

select 'a. drepturi'      as sectiune,
       grantee::text      as nume,
       privilege_type::text as detaliu
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and grantee in ('anon', 'authenticated', 'public')

union all

select 'b. politici'      as sectiune,
       policyname::text   as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'

union all

select 'c. cere status'   as sectiune,
       policyname::text   as nume,
       case when coalesce(qual, with_check, '') like '%activ%'
            then 'DA' else 'NU (verifica)' end as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'
  and cmd in ('SELECT', 'INSERT')

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): `anon` NU trebuie să apară deloc. `authenticated` are exact SELECT,
--     INSERT, DELETE. Fără UPDATE, fără TRUNCATE, fără REFERENCES.
--   • (b): aceleași trei nume ca înainte, dar toate pe `authenticated`, nu pe
--     `public`.
--   • (c): amândouă `DA`.

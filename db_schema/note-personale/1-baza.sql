-- ═══════════════════════════════════════════════════════════════════════════
-- „NOTELE TALE" — tabela pentru pasul 6 din spațiul de lucru
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: o singură notă liberă per persoană, scrisă direct în cardul de pe
-- homepage și văzută DOAR de ea. Decizia lui Lucian, 17 august 2026: nu listă
-- de note, nu note legate de un teren sau un grup — un singur câmp de text,
-- exact ca în machetă („Întrebări pentru grup, numere de telefon, ce ai de
-- verificat săptămâna asta...").
--
-- ⚠️ NU E ACEEAȘI TABELĂ CU `user_teren_notes`, care există din altă etapă și
--    ține notele private lipite pe câte un TEREN anume (pagina de profil,
--    `frontend/js/teren-notes.js`; homepage-ul le citește deja pentru cardul
--    „Terenurile tale"). Aceea rămâne complet neatinsă de scriptul ăsta.
--
-- CE ATINGE SCRIPTUL: doar lucruri NOI. O tabelă nouă, o funcție nouă de
-- trigger, trei politici pe tabela nouă, granturi pe tabela nouă.
-- ZERO atingeri la `profiles`, la politicile existente, la plăți, la frontend.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în fișierul ăsta. Editorul SQL din Supabase
--    rulează tot tabul ca o singură tranzacție, iar un ROLLBACK pus „doar de
--    probă" anulează tăcut și granturile de deasupra lui (lecția din 1 august).
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND și citește ce întoarce fiecare. BLOC 0 e un
--    inventar pe care trebuie să-l CITEȘTI înainte de a merge mai departe.
--
-- ORDINEA FAȚĂ DE RESTUL PAȘILOR:
--   fișierul ăsta  →  `2-proba-impersonare.sql`  →  abia apoi cardul din
--   `frontend/index.html`. Cardul scrie în tabelă; dacă granturile nu sunt
--   puse, salvarea eșuează mut și omul crede că și-a pierdut textul.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Trei lucruri de confirmat înainte de a scrie ceva:
--
--   (a) `user_notes` NU există deja sub alt înțeles. Dacă apare aici, OPREȘTE-TE
--       și spune-mi: `create table if not exists` ar trece tăcut peste o tabelă
--       străină cu același nume și n-am afla decât din cardul care nu merge.
--   (b) cum arată sora ei, `user_teren_notes` — ca să știm dacă în proiectul
--       ăsta granturile stau pe TABELĂ sau pe COLOANE. Un REVOKE pe coloană nu
--       scade dintr-un grant de tabelă (capcana din 1 august), deci convenția
--       contează.
--   (c) câte politici are `user_teren_notes`. Dacă are 4 (select/insert/update/
--       delete pe `auth.uid()`), tabela nouă le imită și n-avem de inventat
--       nimic.
--
-- ⚠️ Interogările sunt unite cu UNION ALL dinadins: editorul SQL din Supabase
--    arată DOAR rezultatul ultimei interogări dintr-un tab.

select 'a. exista deja?'      as sectiune,
       c.relname::text        as nume,
       ''                     as detaliu,
       ''                     as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('user_notes', 'user_teren_notes')

union all

select 'b. drepturi pe sora ei'        as sectiune,
       g.grantee::text                 as nume,
       g.privilege_type::text          as detaliu,
       coalesce(g.column_name, 'TOATĂ TABELA')::text as detaliu2
from (
    -- drepturi pe toată tabela
    select grantee, privilege_type, null::text as column_name
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'user_teren_notes'
      and grantee in ('anon', 'authenticated', 'service_role')
    union all
    -- drepturi pe coloane
    select grantee, privilege_type, column_name
    from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'user_teren_notes'
      and grantee in ('anon', 'authenticated', 'service_role')
) g

union all

select 'c. politici pe sora ei' as sectiune,
       p.policyname::text       as nume,
       p.cmd::text              as detaliu,
       coalesce(p.qual, p.with_check, '')::text as detaliu2
from pg_policies p
where p.schemaname = 'public' and p.tablename = 'user_teren_notes'

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • La (a): trebuie să apară DOAR `user_teren_notes`. Dacă apare și
--     `user_notes`, oprește-te.
--   • La (b): dacă vezi „TOATĂ TABELA" pentru `authenticated`, convenția
--     proiectului aici e grantul pe tabelă și BLOC 5 e scris exact așa.
--     Dacă vezi coloane numite, spune-mi — rescriu BLOC 5 pe coloane.
--   • La (c): `anon` NU trebuie să aibă nimic pe note. Dacă are, e o scăpare
--     veche pe tabela cealaltă, de reparat separat (n-o repar din fișierul
--     ăsta, ca să nu amestec două treburi).


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Tabela
-- ───────────────────────────────────────────────────────────────────────────
-- UN SINGUR RÂND PER OM. De aceea `user_id` e chiar cheia primară, nu o
-- coloană oarecare cu un `id` separat lângă ea:
--
--   • baza de date garantează singură că nu pot apărea două note pentru
--     același om — nu depinde de corectitudinea frontendului;
--   • salvarea din card e un `upsert` pe `user_id`: prima scriere inserează,
--     restul actualizează, fără ca pagina să știe dinainte dacă există rând.
--     Fără cheie primară (sau unică) pe `user_id`, `upsert` n-are pe ce să se
--     sprijine și PostgREST refuză cererea.
--
-- `content` e `not null default ''`, nu nullable: „nota golită" și „nota
-- nescrisă" sunt același lucru pentru om, deci n-au voie să fie două stări
-- diferite în bază. Un `where content is not null` scris peste un an ar fi
-- sărit tăcut peste rânduri (capcana `account_status`).
--
-- Limita de 10.000 de caractere e o plasă de siguranță, nu o regulă de produs:
-- ~4 pagini de text, mult peste orice notă reală, dar destul de jos cât să nu
-- ajungă cineva să lipească un roman în homepage. Textarea din card poartă
-- același număr în `maxlength`, ca omul să fie oprit ÎNAINTE de salvare, nu
-- printr-o eroare venită de la server.

create table if not exists public.user_notes (
    user_id    uuid        primary key,
    content    text        not null default '',
    updated_at timestamptz not null default now(),
    constraint user_notes_content_max check (char_length(content) <= 10000)
);

comment on table public.user_notes is
    'Nota personală liberă a fiecărui utilizator, scrisă din cardul „Notele tale" de pe homepage. Un singur rând per om (user_id e cheia primară, ca upsert-ul din pagină să aibă pe ce se sprijini). Privată: RLS lasă fiecare om doar la rândul lui. NU are legătură cu user_teren_notes, care ține note lipite pe câte un teren.';

comment on column public.user_notes.content is
    'Textul notei. Șir gol = notă golită de om; nu se șterge rândul.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Legătura cu utilizatorul (OPȚIONAL, rulează-l separat)
-- ───────────────────────────────────────────────────────────────────────────
-- Face ca ștergerea unui cont să-i șteargă și nota (util la o cerere GDPR).
-- E pus SEPARAT dinadins, ca la `terenuri_digest_log`: dacă proiectul nu
-- permite chei străine către schema `auth`, blocul ăsta dă eroare — și atunci
-- pur și simplu NU-L RULEZI. Tabela funcționează perfect și fără el.
--
-- `add constraint` n-are variantă `if not exists`, deci e învelit într-un bloc
-- care verifică întâi, ca fișierul să poată fi rulat de două ori.
--
-- ⚠️ Când îl selectezi cu mouse-ul, pornește de la `do $$`, NU de la `begin`.
--    O selecție care lasă `do $$` afară dă o eroare care arată ca o greșeală
--    de cod, dar e una de copiere (lecția din august).

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'user_notes_user_fk'
          and conrelid = 'public.user_notes'::regclass
    ) then
        alter table public.user_notes
            add constraint user_notes_user_fk
            foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Data ultimei salvări, pusă de bază, nu de pagină
-- ───────────────────────────────────────────────────────────────────────────
-- Cardul scrie sub textarea „Salvat la 14:32". Ora aceea trebuie să fie ora la
-- care baza a primit textul, nu ora ceasului din calculatorul omului: un
-- calculator rămas în urmă ar scrie o oră din trecut și nota ar părea nesalvată.
--
-- Triggerul suprascrie orice valoare trimisă de client, deci pagina nici nu
-- trebuie să trimită coloana. Așa rămâne un singur loc unde se decide ora.
--
-- `security invoker` (implicit) e suficient: funcția nu citește nimic, doar
-- pune `now()`. `set search_path` e igienă, ca funcția să nu poată fi păcălită
-- cu un `now()` pus de altcineva în calea de căutare.

create or replace function public.user_notes_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_user_notes_touch on public.user_notes;

create trigger trg_user_notes_touch
    before insert or update on public.user_notes
    for each row execute function public.user_notes_touch();


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Cine vede ce (RLS)
-- ───────────────────────────────────────────────────────────────────────────
-- Trei politici, toate cu aceeași condiție: rândul e al meu dacă `user_id`
-- este chiar `auth.uid()`.
--
-- ⚠️ DOUĂ LUCRURI PE CARE POLITICILE ASTEA NU LE FAC, dinadins:
--
--   (1) NU citesc nimic din `profiles`. Pe 1 august, 12 politici scrise așa au
--       golit paginile de terenuri și de parteneri în clipa în care s-au
--       revocat drepturi pe coloane: o politică ce citește o coloană interzisă
--       nu întoarce „fals", ci crapă toată interogarea. `auth.uid()` nu depinde
--       de nicio tabelă, deci nu poate fi rupt de o revocare viitoare.
--   (2) NU există politică de superadmin. Notele sunt private și rămân private;
--       dacă vreodată e nevoie să fie citite pentru un motiv serios, se face de
--       la `service_role`, nu printr-o poartă lăsată deschisă permanent. Cel
--       mai sigur tip de politică e cel care nu există.
--
-- ⚠️ Nu există politică de DELETE și nici grant de DELETE (BLOC 5). Golirea
--    notei se face prin UPDATE cu șir gol. Cu o ușă mai puțin, o greșeală de
--    frontend nu poate șterge rândul cuiva.
--
-- `to authenticated` pe fiecare politică e important: fără el, politica se
-- aplică rolului `public`, adică inclusiv lui `anon`, iar atunci singurul lucru
-- care mai stă între vizitatorul nelogat și tabelă e grantul. Două porți sunt
-- mai bune decât una.

alter table public.user_notes enable row level security;

drop policy if exists user_notes_select_own on public.user_notes;
create policy user_notes_select_own on public.user_notes
    for select to authenticated
    using (user_id = auth.uid());

drop policy if exists user_notes_insert_own on public.user_notes;
create policy user_notes_insert_own on public.user_notes
    for insert to authenticated
    with check (user_id = auth.uid());

-- `using` = pe care rânduri am voie să pun mâna; `with check` = cum au voie să
-- arate DUPĂ modificare. Fără al doilea, cineva ar putea muta nota lui pe
-- `user_id`-ul altcuiva și i-ar scrie peste ea.
drop policy if exists user_notes_update_own on public.user_notes;
create policy user_notes_update_own on public.user_notes
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — Drepturile pe tabelă
-- ───────────────────────────────────────────────────────────────────────────
-- RLS spune CARE RÂNDURI, granturile spun DACĂ AI VOIE SĂ ATINGI TABELA. Sunt
-- două lucruri diferite și trebuie amândouă: cu politici perfecte și fără
-- grant, cardul primește „permission denied for table user_notes".
--
-- Grant pe TOATĂ tabela, nu pe coloane (spre deosebire de `profiles`): aici
-- fiecare coloană a fiecărui rând îi aparține chiar omului care o citește, deci
-- n-are ce ascunde una de alta.
--
-- `anon` nu primește nimic: un vizitator fără cont n-are ce căuta în notele
-- nimănui. `revoke` e scris explicit ca să nu depindem de drepturile implicite
-- ale proiectului.

revoke all on public.user_notes from anon;
revoke all on public.user_notes from public;

grant select, insert, update on public.user_notes to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 6 — VERIFICARE STRUCTURALĂ (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Blocul ăsta arată că tabela ARATĂ cum trebuie. NU arată că RLS-ul chiar
--    refuză pe cineva: în SQL Editor ești `postgres`, `auth.uid()` e NULL și
--    politicile nici nu te ating. Dovada aceea e în `2-proba-impersonare.sql`
--    și e obligatorie înainte de a construi cardul.

select 'a. coloane'                as sectiune,
       column_name::text           as nume,
       data_type::text             as detaliu,
       (is_nullable || ' / ' || coalesce(column_default, 'fără'))::text as detaliu2
from information_schema.columns
where table_schema = 'public' and table_name = 'user_notes'

union all

select 'b. politici'               as sectiune,
       policyname::text            as nume,
       cmd::text                   as detaliu,
       coalesce(qual, with_check, '')::text as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'user_notes'

union all

select 'c. drepturi'               as sectiune,
       grantee::text               as nume,
       privilege_type::text        as detaliu,
       ''                          as detaliu2
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'user_notes'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')

union all

select 'd. RLS pornit'             as sectiune,
       c.relname::text             as nume,
       case when c.relrowsecurity then 'DA' else '🔴 NU' end as detaliu,
       ''                          as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'user_notes'

union all

select 'e. trigger'                as sectiune,
       t.tgname::text              as nume,
       'activ'                     as detaliu,
       ''                          as detaliu2
from pg_trigger t
where t.tgrelid = 'public.user_notes'::regclass
  and not t.tgisinternal

order by sectiune, nume, detaliu;

-- AȘTEPTAT:
--   a. trei coloane: user_id (uuid, NO), content (text, NO, default ''),
--      updated_at (timestamp with time zone, NO, default now())
--   b. exact TREI politici: select / insert / update, toate pe
--      `(user_id = auth.uid())`. Zero politici de delete.
--   c. `authenticated` cu SELECT, INSERT, UPDATE. `anon` să NU apară deloc.
--      Dacă vezi `anon` pe orice linie, oprește-te și spune-mi.
--   d. „DA". Un „🔴 NU" înseamnă că tabela e deschisă oricui e logat.
--   e. `trg_user_notes_touch`.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 7 — REVENIRE (rulează-l DOAR dacă vrei să dai totul înapoi)
-- ───────────────────────────────────────────────────────────────────────────
-- Tabela e nouă și nimic altceva nu depinde de ea, deci revenirea e curată și
-- fără urme. ⚠️ ȘTERGE ȘI NOTELE SCRISE ÎNTRE TIMP — dacă cardul a fost deja
-- publicat și oamenii au apucat să scrie, textele lor dispar definitiv.
--
-- drop trigger  if exists trg_user_notes_touch on public.user_notes;
-- drop table    if exists public.user_notes;
-- drop function if exists public.user_notes_touch();

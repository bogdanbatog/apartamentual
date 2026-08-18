-- ═══════════════════════════════════════════════════════════════════════════
-- „CINE S-A ALĂTURAT DE CÂND N-AI MAI INTRAT" — tabela de vizite pe grup
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: un rând per om per grup, cu ora la care a deschis ultima oară pagina
-- grupului. Din el se scade, pe homepage, ce s-a întâmplat de atunci încoace:
-- „2 membri noi de la ultima ta vizită", nu „acum 3 zile".
--
-- DE CE ARE NEVOIE DE O TABELĂ (decizia lui Lucian, 18 august 2026): singura
-- alternativă fără migrație era ținerea minte în browser (`localStorage`), care
-- pierde socoteala la fiecare schimbare de dispozitiv — pe telefon i-ar fi
-- arătat ca „noi" oameni pe care îi văzuse deja pe laptop. Fereastra fixă de 14
-- zile, care există azi în cod, spune altceva decât ce a cerut el: repetă
-- aceleași nume două săptămâni, chiar dacă a intrat în grup în fiecare zi.
--
-- CE ATINGE SCRIPTUL: doar lucruri NOI. O tabelă nouă, o funcție de trigger
-- nouă, trei politici pe tabela nouă, granturi pe tabela nouă.
-- ZERO atingeri la `grup_membri`, `grupuri`, `profiles`, la politicile
-- existente, la plăți sau la vreo tabelă veche.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în fișierul ăsta. Editorul SQL din Supabase
--    rulează tot tabul ca o singură tranzacție, iar un ROLLBACK pus „doar de
--    probă" anulează tăcut și granturile de deasupra lui (lecția din 1 august).
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND și citește ce întoarce fiecare. BLOC 0 e un
--    inventar pe care trebuie să-l CITEȘTI înainte de a merge mai departe.
--
-- ORDINEA FAȚĂ DE RESTUL PAȘILOR:
--   fișierul ăsta  →  `2-proba-impersonare.sql`  →  abia apoi frontendul.
--   Pagina grupului scrie în tabelă la fiecare deschidere; dacă granturile nu
--   sunt puse, scrierea eșuează mut și homepage-ul rămâne pe vechea fereastră
--   de 14 zile fără ca cineva să afle de ce.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Patru lucruri de confirmat înainte de a scrie ceva:
--
--   (a) `grup_vizite` NU există deja sub alt înțeles. `create table if not
--       exists` ar trece tăcut peste o tabelă străină cu același nume.
--   (b) tipul lui `grupuri.id` chiar e `uuid`. Toată tabela de mai jos se
--       sprijină pe asta; dacă e altceva, oprește-te și spune-mi.
--   (c) ce drepturi are `authenticated` pe `user_notes`, sora ei cea mai
--       recentă — ca să știm dacă în proiect granturile stau pe TABELĂ sau pe
--       COLOANE. Un REVOKE pe coloană nu scade dintr-un grant de tabelă.
--   (d) ⭐ CE POLITICI DE **UPDATE** ARE `grup_membri`. Nu e nevoie pentru
--       tabela asta — e o întrebare separată, pe care o punem cât suntem
--       oricum aici. Motivul e în nota de la finalul fișierului („DATA CARE
--       MINTE"): vrem să știm dacă adminul are voie să scrie `joined_at` la
--       aprobare. NU schimbăm nimic acum, doar citim.
--
-- ⚠️ Interogările sunt unite cu UNION ALL dinadins: editorul SQL din Supabase
--    arată DOAR rezultatul ultimei interogări dintr-un tab.

select 'a. exista deja?'          as sectiune,
       c.relname::text            as nume,
       ''                         as detaliu,
       ''                         as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('grup_vizite')

union all

select 'b. tipul id-urilor'       as sectiune,
       (table_name || '.' || column_name)::text as nume,
       data_type::text            as detaliu,
       ''                         as detaliu2
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'grupuri'     and column_name in ('id', 'admin_id'))
    or (table_name = 'grup_membri' and column_name in ('grup_id', 'user_id', 'status', 'joined_at')))

union all

select 'c. drepturi pe sora ei'   as sectiune,
       grantee::text              as nume,
       privilege_type::text       as detaliu,
       'TOATĂ TABELA'             as detaliu2
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'user_notes'
  and grantee in ('anon', 'authenticated', 'service_role')

union all

select 'd. UPDATE pe grup_membri' as sectiune,
       policyname::text           as nume,
       cmd::text                  as detaliu,
       coalesce(qual, with_check, '')::text as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'grup_membri'
  and cmd in ('UPDATE', 'ALL')

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • La (a): NU trebuie să apară niciun rând. Dacă apare, oprește-te.
--   • La (b): `grupuri.id` și `grupuri.admin_id` = `uuid`; `grup_membri.
--     joined_at` = `timestamp with time zone`. Dacă `joined_at` lipsește sau e
--     `date`, spune-mi — homepage-ul se sprijină pe el.
--   • La (c): dacă vezi `authenticated` cu SELECT/INSERT/UPDATE pe toată
--     tabela, convenția e grantul pe tabelă și BLOC 5 e scris exact așa.
--   • La (d): doar de citit și de trimis mai departe. Nu se schimbă nimic azi.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Tabela
-- ───────────────────────────────────────────────────────────────────────────
-- UN SINGUR RÂND PER OM PER GRUP, iar perechea (om, grup) e chiar cheia
-- primară, nu o coloană `id` separată cu o constrângere unică lângă ea:
--
--   • baza garantează singură că nu se adună un rând la fiecare deschidere de
--     pagină — altfel tabela ar crește cu fiecare clic, la nesfârșit;
--   • pagina grupului scrie printr-un `upsert` pe perechea asta: prima
--     deschidere inserează, restul actualizează. Fără cheia primară compusă,
--     `upsert` n-are pe ce se sprijini și PostgREST refuză cererea.
--     ⚠️ Frontendul trebuie să ceară explicit `onConflict: 'user_id,grup_id'`;
--     PostgREST nu ghicește cheia compusă.
--
-- `vazut_la` e `not null default now()` și oricum rescris de trigger (BLOC 3):
-- ora care contează e ora la care baza a primit cererea, nu ceasul din
-- calculatorul omului. Un calculator rămas în urmă ar scrie o oră din trecut,
-- iar homepage-ul i-ar arăta la nesfârșit aceiași „membri noi".
--
-- ⚠️ NU ține minte CE a văzut, doar CÂND. Dacă vreodată e nevoie de „citit /
--    necitit" pe fiecare lucru în parte (bifă pe fiecare anunț, de pildă),
--    aceea e altă tabelă, nu o coloană în plus aici.

create table if not exists public.grup_vizite (
    user_id  uuid        not null,
    grup_id  uuid        not null,
    vazut_la timestamptz not null default now(),
    primary key (user_id, grup_id)
);

comment on table public.grup_vizite is
    'Când a deschis fiecare om ultima oară pagina fiecărui grup. Un rând per pereche (om, grup), scris prin upsert din grup-details.html. Din el se calculează pe homepage „N membri noi de la ultima ta vizită". Privată: RLS lasă fiecare om doar la rândurile lui. Creată 18 august 2026.';

comment on column public.grup_vizite.vazut_la is
    'Ora ultimei deschideri, pusă de bază prin trigger, nu de browser.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Legăturile (OPȚIONAL, rulează-l separat)
-- ───────────────────────────────────────────────────────────────────────────
-- Fac curat singure: la ștergerea unui cont sau a unui grup dispar și rândurile
-- de vizită. Sunt puse SEPARAT dinadins, ca la `user_notes`: dacă proiectul nu
-- permite chei străine către schema `auth`, primul bloc dă eroare — și atunci
-- pur și simplu NU-L RULEZI. Tabela funcționează perfect și fără ele; cel mult
-- rămân rânduri orfane, care nu deranjează pe nimeni (homepage-ul le citește
-- oricum doar pentru grupurile în care omul chiar e membru).
--
-- `add constraint` n-are variantă `if not exists`, deci fiecare e învelit într-un
-- bloc care verifică întâi, ca fișierul să poată fi rulat de două ori.
--
-- ⚠️ Când selectezi cu mouse-ul, pornește de la `do $$`, NU de la `begin`.
--    O selecție care lasă `do $$` afară dă o eroare care arată ca o greșeală de
--    cod, dar e una de copiere (lecția din august).

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'grup_vizite_user_fk'
          and conrelid = 'public.grup_vizite'::regclass
    ) then
        alter table public.grup_vizite
            add constraint grup_vizite_user_fk
            foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'grup_vizite_grup_fk'
          and conrelid = 'public.grup_vizite'::regclass
    ) then
        alter table public.grup_vizite
            add constraint grup_vizite_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Ora, pusă de bază
-- ───────────────────────────────────────────────────────────────────────────
-- Triggerul suprascrie orice valoare trimisă de browser, deci pagina nici nu
-- trebuie să trimită coloana. Un singur loc unde se decide ora.
--
-- `security invoker` (implicit) e suficient: funcția nu citește nimic, doar
-- pune `now()`. `set search_path` e igienă, ca funcția să nu poată fi păcălită
-- cu un `now()` strecurat de altcineva în calea de căutare.

create or replace function public.grup_vizite_touch()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.vazut_la := now();
    return new;
end;
$$;

drop trigger if exists trg_grup_vizite_touch on public.grup_vizite;

create trigger trg_grup_vizite_touch
    before insert or update on public.grup_vizite
    for each row execute function public.grup_vizite_touch();


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Cine vede ce (RLS)
-- ───────────────────────────────────────────────────────────────────────────
-- Trei politici, toate cu aceeași condiție: rândul e al meu dacă `user_id`
-- este chiar `auth.uid()`.
--
-- ⚠️ TREI LUCRURI PE CARE POLITICILE ASTEA NU LE FAC, dinadins:
--
--   (1) NU verifică dacă omul chiar e membru al grupului. Ar fi părut riguros,
--       dar ar fi însemnat o politică ce citește `grup_membri`, iar o politică
--       ce citește altă tabelă crapă toată interogarea în ziua în care acolo se
--       revocă un drept (1 august, 12 politici, paginile golite). Ce se poate
--       scrie fără ea: că am deschis pagina unui grup din care nu fac parte —
--       adevărat oricum, fiindcă pagina se poate deschide.
--   (2) NU citesc nimic din `profiles`, din același motiv.
--   (3) NU există politică de superadmin. Nimeni n-are nevoie să știe când a
--       intrat altcineva ultima oară într-un grup. Cel mai sigur tip de
--       politică e cel care nu există.
--
-- ⚠️ Nu există politică de DELETE și nici grant de DELETE (BLOC 5). Nu are ce
--    șterge nimeni de aici: rândul se rescrie la fiecare vizită.
--
-- `to authenticated` pe fiecare politică e important: fără el politica s-ar
-- aplica rolului `public`, adică inclusiv lui `anon`, iar atunci singurul lucru
-- dintre vizitatorul nelogat și tabelă ar fi grantul. Două porți sunt mai bune
-- decât una.

alter table public.grup_vizite enable row level security;

drop policy if exists grup_vizite_select_own on public.grup_vizite;
create policy grup_vizite_select_own on public.grup_vizite
    for select to authenticated
    using (user_id = auth.uid());

drop policy if exists grup_vizite_insert_own on public.grup_vizite;
create policy grup_vizite_insert_own on public.grup_vizite
    for insert to authenticated
    with check (user_id = auth.uid());

-- `using` = pe care rânduri am voie să pun mâna; `with check` = cum au voie să
-- arate DUPĂ modificare. Fără al doilea, cineva ar putea muta rândul lui pe
-- `user_id`-ul altcuiva și i-ar strica socoteala.
drop policy if exists grup_vizite_update_own on public.grup_vizite;
create policy grup_vizite_update_own on public.grup_vizite
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — Drepturile pe tabelă
-- ───────────────────────────────────────────────────────────────────────────
-- RLS spune CARE RÂNDURI, granturile spun DACĂ AI VOIE SĂ ATINGI TABELA. Sunt
-- două lucruri diferite și trebuie amândouă: cu politici perfecte și fără
-- grant, scrierea din pagina grupului primește „permission denied for table
-- grup_vizite".
--
-- Grant pe TOATĂ tabela, nu pe coloane: fiecare coloană a fiecărui rând îi
-- aparține chiar omului care o citește.
--
-- `anon` nu primește nimic. `revoke` e scris explicit fiindcă în Supabase
-- tabelele noi vin cu drepturi depline — un GRANT scris după nu restrânge
-- nimic, doar REVOKE.
--
-- ⚠️ SE REVOCĂ ȘI DE LA `authenticated`, ÎNAINTE de grant. Rândul ăsta a lipsit
--    la prima rulare, pe 18 august, și tabela a rămas cu DELETE, TRUNCATE,
--    REFERENCES și TRIGGER date utilizatorilor logați (aceeași scăpare ca la
--    `user_notes`, pe 17 august). `revoke ... from public` NU acoperă
--    `authenticated`: e un rol separat, care își primește drepturile direct.
--    ⚠️ TRUNCATE nu e atins de RLS și ar șterge socoteala TUTUROR dintr-o dată.

revoke all on public.grup_vizite from anon;
revoke all on public.grup_vizite from public;
revoke all on public.grup_vizite from authenticated;

grant select, insert, update on public.grup_vizite to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 6 — VERIFICARE STRUCTURALĂ (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Blocul ăsta arată că tabela ARATĂ cum trebuie. NU arată că RLS-ul chiar
--    refuză pe cineva: în SQL Editor ești `postgres`, `auth.uid()` e NULL și
--    politicile nici nu te ating. Dovada aceea e în `2-proba-impersonare.sql`
--    și e obligatorie înainte de a publica frontendul.

select 'a. coloane'                as sectiune,
       column_name::text           as nume,
       data_type::text             as detaliu,
       (is_nullable || ' / ' || coalesce(column_default, 'fără'))::text as detaliu2
from information_schema.columns
where table_schema = 'public' and table_name = 'grup_vizite'

union all

select 'b. cheia primara'          as sectiune,
       a.attname::text             as nume,
       'PK'                        as detaliu,
       ''                          as detaliu2
from pg_constraint c
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.conrelid = 'public.grup_vizite'::regclass and c.contype = 'p'

union all

select 'c. politici'               as sectiune,
       policyname::text            as nume,
       cmd::text                   as detaliu,
       coalesce(qual, with_check, '')::text as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'grup_vizite'

union all

select 'd. drepturi'               as sectiune,
       grantee::text               as nume,
       privilege_type::text        as detaliu,
       ''                          as detaliu2
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_vizite'
  and grantee in ('anon', 'authenticated', 'service_role', 'public')

union all

select 'e. RLS pornit'             as sectiune,
       c.relname::text             as nume,
       case when c.relrowsecurity then 'DA' else '🔴 NU' end as detaliu,
       ''                          as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'grup_vizite'

union all

select 'f. trigger'                as sectiune,
       t.tgname::text              as nume,
       'activ'                     as detaliu,
       ''                          as detaliu2
from pg_trigger t
where t.tgrelid = 'public.grup_vizite'::regclass
  and not t.tgisinternal

order by sectiune, nume, detaliu;

-- AȘTEPTAT:
--   a. trei coloane: user_id (uuid, NO), grup_id (uuid, NO),
--      vazut_la (timestamp with time zone, NO, default now())
--   b. DOUĂ rânduri: `user_id` și `grup_id`. Dacă apare unul singur, upsert-ul
--      din pagină va insera un rând nou la fiecare deschidere.
--   c. exact TREI politici: select / insert / update, toate pe
--      `(user_id = auth.uid())`. Zero politici de delete.
--   d. `authenticated` cu SELECT, INSERT, UPDATE. `anon` să NU apară deloc.
--      Dacă vezi `anon` pe orice linie, oprește-te și spune-mi.
--   e. „DA". Un „🔴 NU" înseamnă că oricine e logat vede când au intrat toți
--      ceilalți în toate grupurile.
--   f. `trg_grup_vizite_touch`.


-- ═══════════════════════════════════════════════════════════════════════════
--  ⚠️ DATA CARE MINTE — de citit, e o chestiune separată, pentru altă zi
-- ═══════════════════════════════════════════════════════════════════════════
-- `grup_membri.joined_at` se pune la CEREREA de alăturare, nu la aprobarea ei:
-- `requestJoinGroup` inserează rândul cu `status = 'pending'` (data vine din
-- default), iar `approveRequest` face doar `update({status: 'activ'})` și nu
-- atinge data. Consecința, pentru ce construim acum:
--
--   dacă cineva cere pe 1 ale lunii și adminul aprobă pe 20, membrul apare la
--   ceilalți ca „alăturat pe 1" — adică poate mai vechi decât ultima lor
--   vizită, deci NU li se arată deloc, deși pentru ei chiar e om nou.
--
-- Nu se repară din fișierul ăsta, dinadins: reparația înseamnă să scrii
-- `joined_at = now()` la aprobare, iar dacă `grup_membri` nu lasă coloana aceea
-- să fie scrisă, APROBĂRILE ÎNCEP SĂ EȘUEZE — cea mai proastă defecțiune pe
-- care o putem introduce.
--
-- CE ȘTIM DEJA (BLOC 0 (d), rulat pe 18 august 2026): există O SINGURĂ politică
-- de UPDATE pe `grup_membri`, „Adminul grupului gestioneaza membrii", cu
-- `(este_admin_grup(grup_id) OR is_platform_admin())`. E o regulă pe RÂNDURI,
-- nu pe coloane, deci nu stă ea în calea scrierii.
--
-- CE MAI LIPSEȘTE ÎNAINTE DE REPARAȚIE: granturile de UPDATE pe `grup_membri`
-- pentru `authenticated` — pe toată tabela sau pe o listă de coloane? Dacă sunt
-- pe listă și `joined_at` nu e în ea, scrierea eșuează MUT, exact ca la
-- `profiles` (vezi memoria „profiles: UPDATE doar pe listă explicită").
-- Interogarea care răspunde:
--
--   select grantee, privilege_type, coalesce(column_name, 'TOATĂ TABELA')
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'grup_membri'
--     and grantee = 'authenticated' and privilege_type = 'UPDATE';
--
-- Cât timp nu e reparat: aprobările făcute repede (zilele obișnuite) se văd
-- corect; doar cele întârziate cu săptămâni se pot pierde.


-- ═══════════════════════════════════════════════════════════════════════════
--  BLOC 7 — REVENIRE (rulează-l DOAR dacă vrei să dai totul înapoi)
-- ═══════════════════════════════════════════════════════════════════════════
-- Tabela e nouă și nimic altceva nu depinde de ea. Se pierde doar socoteala
-- vizitelor, iar homepage-ul se întoarce singur la fereastra de 14 zile (codul
-- tratează lipsa rândului ca pe „n-a intrat niciodată").
--
-- drop trigger  if exists trg_grup_vizite_touch on public.grup_vizite;
-- drop table    if exists public.grup_vizite;
-- drop function if exists public.grup_vizite_touch();

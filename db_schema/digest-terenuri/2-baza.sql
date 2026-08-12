-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST SĂPTĂMÂNAL „TERENURI NOI ÎN ZONELE TALE" — pregătirea bazei de date
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PIESA 1 din 4 (vezi `handoff/handoff-automatizare-terenuri-noi.md`).
-- Aici NU pleacă niciun email. Se pregătesc doar cele trei lucruri de care are
-- nevoie edge function-ul de săptămâna viitoare:
--
--   1. bifa `profiles.email_terenuri_noi` — prin care omul poate opri emailul
--   2. jurnalul `terenuri_digest_log` — anti-dublare + fereastra per persoană
--   3. funcția `lot_terenuri_noi(...)` — cine primește și ce scrie în email
--
-- ⚠️ ZERO ATINGERI la plăți, la politici RLS existente, la `frontend/`.
--    Singura tabelă existentă atinsă e `profiles`, și doar cu o coloană NOUĂ.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în acest script. Editorul SQL din Supabase
--    rulează tot fișierul ca o singură tranzacție, iar un ROLLBACK pus „doar
--    de probă" anulează tăcut și GRANT-urile de deasupra lui.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND și citește ce întoarce fiecare. Nu da „Run"
--    peste tot fișierul: BLOC 0 e un inventar pe care trebuie să-l CITEȘTI
--    înainte să meargă mai departe.
--
-- ORDINEA FAȚĂ DE RESTUL PIESELOR:
--   acest fișier  →  deploy `digest-terenuri-zone`  →  `3-programare.sql`
--   Bifa din pagina de profil (Piesa 4) vine ULTIMA, dar granturile ei sunt
--   deja în BLOC 2 de aici — altfel formularul de profil ar pica pentru toți.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Două lucruri de confirmat înainte de a scrie ceva:
--
--   (a) TIPURILE REALE ale coloanelor pe care le întoarce funcția. `RETURNS
--       TABLE` NU se verifică la creare — Postgres compară tipurile abia la
--       PRIMA RULARE și atunci crapă cu 42804. Așa a picat
--       `create_group_invitation` pe 1 august, care declara `token uuid` pe o
--       coloană `varchar(100)`. De aceea în BLOC 5 fiecare valoare venită
--       dintr-o coloană e castată explicit: `::text`, `::integer`.
--
--   (b) că `authenticated` are drepturi pe COLOANE, nu pe toată tabela —
--       caz în care BLOC 2 e obligatoriu.

select 'a. tipuri'          as ce,
       table_name::text    as tabela,
       column_name::text   as coloana,
       data_type::text     as tip
from information_schema.columns
where table_schema = 'public'
  and (   (table_name = 'profiles' and column_name in ('user_id','email','pseudonym','cont_intern','account_type','account_status'))
       or (table_name = 'zones'    and column_name in ('id','name','city_id'))
       or (table_name = 'terenuri' and column_name in ('id','oras','cartier','status','created_at','deleted_at')) )

union all

select 'b. drepturi'          as ce,
       grantee::text          as tabela,
       column_name::text      as coloana,
       privilege_type::text   as tip
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type in ('SELECT', 'UPDATE')

order by ce, tabela, coloana;

-- Interpretare:
--   • La (a): `character varying` ⇒ castul `::text` din BLOC 5 e obligatoriu,
--     nu decorativ. Dacă vezi `text` peste tot, castul e oricum inofensiv.
--   • La (b): lista trebuie să fie LUNGĂ (o linie per coloană). Așa a rămas
--     `profiles` după revocarea din 1 august: `authenticated` are SELECT pe
--     exact 20 de coloane numite, nu pe tabelă. Deci o coloană nouă e
--     invizibilă din naștere, iar BLOC 2 e OBLIGATORIU ca bifa să se poată
--     citi și salva.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Bifa de oprire a emailului
-- ───────────────────────────────────────────────────────────────────────────
-- Implicit ADEVĂRAT: toți o primesc. Cine nu vrea, o oprește din pagina de
-- profil. `not null` + `default true` înseamnă că profilurile existente
-- primesc automat valoarea, fără UPDATE separat.
--
-- ⚠️ `not null` e deliberat, ca la `cont_intern`: cu NULL permis, un
--    `WHERE email_terenuri_noi = true` ar fi sărit tăcut peste rândurile cu
--    NULL — exact capcana lui `account_status`.

alter table public.profiles
    add column if not exists email_terenuri_noi boolean not null default true;

comment on column public.profiles.email_terenuri_noi is
    'Fals = utilizatorul nu mai primește emailul săptămânal cu terenurile noi apărute în zonele lui preferate. Implicit adevărat.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Dreptul de a citi și schimba propria bifă
-- ───────────────────────────────────────────────────────────────────────────
-- Doar dreptul pe COLOANĂ. Cine are voie să atingă CARE RÂND rămâne stabilit
-- de politicile RLS existente pe `profiles` (fiecare doar rândul lui) — aici
-- nu se schimbă nicio politică.
--
-- ⚠️ FĂRĂ grantul de UPDATE, formularul de profil pică ÎN ÎNTREGIME, pentru
--    toți, tăcut, în clipa în care frontendul începe să trimită coloana. De
--    aceea SQL-ul se rulează ÎNAINTE de deployul Piesei 4, nu după.

grant select (email_terenuri_noi) on public.profiles to authenticated;
grant update (email_terenuri_noi) on public.profiles to authenticated;

-- `anon` NU primește nimic — un vizitator fără cont n-are ce căuta aici.
--
-- ⚠️ A DOUA POARTĂ, care NU se rezolvă de aici: `profiles_visible` e înghețat
--    la 31 de coloane (31 iulie), deci coloana asta NU iese dintr-un
--    `select('*')` pe view. În Piesa 4 se citește separat, direct din
--    `profiles`, exact ca `email_anunturi_grup` (`profile-edit-new.js:333-339`).


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Jurnalul trimiterilor
-- ───────────────────────────────────────────────────────────────────────────
-- La ce folosește, în ordinea importanței:
--   1. FEREASTRA PER PERSOANĂ: emailul următor ia terenurile apărute de la
--      ULTIMA trimitere către omul ăsta, nu „ultimele 7 zile calendaristice".
--      Dacă o luni pică trimiterea, terenurile nu se pierd — intră în emailul
--      de săptămâna viitoare.
--   2. ANTI-DUBLARE: dacă sarcina se execută de două ori în aceeași
--      dimineață (repornire, reîncercare), a doua oară fereastra e goală
--      pentru toți, deci nu mai pleacă nimic.
--   3. Istoric: ce a plecat, către câți, cu ce material.
--
-- ⚠️ UN RÂND PER OM, nu per trimitere globală — spre deosebire de digestul de
--    anunțuri, care ține un rând per GRUP. Emailul ăsta e personalizat, deci
--    și fereastra e a fiecăruia.

create table if not exists public.terenuri_digest_log (
    id              uuid        primary key default gen_random_uuid(),
    user_id         uuid        not null,
    trimis_la       timestamptz not null default now(),
    fereastra_de_la timestamptz not null,
    nr_terenuri     integer     not null,
    nr_zone         integer     not null
);

comment on table public.terenuri_digest_log is
    'Câte un rând per persoană per săptămână în care i-a plecat emailul cu terenuri noi. Scris exclusiv de edge function-ul digest-terenuri-zone. Din el se calculează fereastra fiecărui om la rularea următoare.';

-- Căutarea făcută de funcție e mereu „ultima trimitere către omul X".
create index if not exists idx_terenuri_digest_log_user_trimis
    on public.terenuri_digest_log (user_id, trimis_la desc);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3b — Legătura cu utilizatorul (OPȚIONAL, rulează-l separat)
-- ───────────────────────────────────────────────────────────────────────────
-- Face ca ștergerea unui cont să-i ștreargă și rândurile de jurnal (util la o
-- cerere GDPR de ștergere). E pus SEPARAT dinadins: dacă proiectul nu permite
-- chei străine către schema `auth`, blocul ăsta dă eroare — și atunci pur și
-- simplu NU-L RULEZI. Tabela de mai sus funcționează perfect și fără el.

-- `add constraint` nu are variantă `if not exists`, deci e învelit într-un
-- bloc care verifică întâi — ca fișierul să poată fi rulat de două ori fără
-- să dea eroare la a doua.
do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'terenuri_digest_log_user_fk'
          and conrelid = 'public.terenuri_digest_log'::regclass
    ) then
        alter table public.terenuri_digest_log
            add constraint terenuri_digest_log_user_fk
            foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Închiderea jurnalului
-- ───────────────────────────────────────────────────────────────────────────
-- RLS pornit ȘI NICIO POLITICĂ. Nu e o scăpare, e intenția:
--   • `service_role` (funcția) ocolește RLS din construcție ⇒ scrie normal.
--   • `authenticated` și `anon` n-au nicio politică ⇒ nu văd niciun rând.
--   • Tu, în SQL Editor, rulezi ca `postgres` și ocolești RLS ⇒ citești tot.
--
-- Aleasă exact ca la digestul de anunțuri, tocmai ca să NU scriu o politică de
-- superadmin care citește `profiles.is_super_admin`. Pe 1 august, 12 politici
-- scrise așa au golit paginile de terenuri și parteneri la prima revocare de
-- drepturi pe coloane. Cel mai sigur tip de politică e cel care nu există.

alter table public.terenuri_digest_log enable row level security;

revoke all on public.terenuri_digest_log from anon;
revoke all on public.terenuri_digest_log from authenticated;

-- Explicit, ca să nu depindem de drepturile implicite ale proiectului: dacă
-- funcția n-ar putea scrie în jurnal, fereastra n-ar mai avansa niciodată și
-- oamenii ar primi în fiecare luni aceleași terenuri.
grant select, insert on public.terenuri_digest_log to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — Funcția care alege destinatarii
-- ───────────────────────────────────────────────────────────────────────────
-- ACEASTA E INIMA AUTOMATIZĂRII. Nu e scrisă de la zero: e interogarea
-- validată pe date reale în august (`db_schema/terenuri-noi/4-lot-destinatari.sql`,
-- din care au plecat cele 38 de emailuri pe 3 august), mutată în funcție.
--
-- ⚠️ NU O REscrie în JavaScript. O rescriere e cod nou, neprobat, iar aici
--    „neprobat" înseamnă emailuri greșite către oameni reali.
--
-- ═══ CELE TREI SCHIMBĂRI FAȚĂ DE ORIGINAL — citește-le, sunt tot ce s-a atins
--
-- (1) LISTA DE EXCLUDERI, ÎNLOCUITĂ. Blocul `useri_exclusi` (liniile 35-55 din
--     original) era o listă de emailuri scrisă de mână. Într-o campanie
--     pornită de mână e acceptabil — te uiți la lot înainte de trimitere.
--     Într-o funcție care rulează singură în fiecare luni e o bombă cu ceas:
--     un cont de test făcut peste trei luni ar primi emailul.
--     ⇒ înlocuit cu `p.cont_intern = false` (steagul pus pe 12 august, 23 de
--       conturi marcate).
--
-- (2) BIFA DE DEZABONARE, ADĂUGATĂ. `p.email_terenuri_noi = true`. În august
--     coloana nu exista; acum e Piesa 4 și trebuie respectată de la început,
--     altfel omul o oprește din profil și emailul pleacă oricum.
--
-- (3) FEREASTRA E PER PERSOANĂ, nu una singură pentru toți. Originalul avea o
--     dată fixă („de la 30 iulie"), fiindcă era o campanie unică. Aici
--     `p_de_la` e doar PODEAUA — cel mai devreme moment la care ne uităm — iar
--     pentru fiecare om se folosește ultima trimitere către el, dacă e mai
--     recentă. De asta numărătoarea terenurilor s-a mutat din CTE-ul global
--     `zone_cu_terenuri` în `per_zona`, care numără per (om, zonă):
--     doi oameni cu ferestre diferite trebuie să vadă cifre diferite.
--
-- Restul — pragul de zone, ordinea zonelor, primele 3 zone, acordul gramatical
-- („1 teren nou" / „3 terenuri noi" / „21 de terenuri noi") — e neatins.
-- BLOC 6 dovedește pe cifre că restructurarea n-a schimbat rezultatul.
--
-- ⚠️ `p_prag_zone` = 20 implicit: decizia din 12 august, luată pe distribuția
--    reală (68 din 70 de oameni au cel mult 19 zone bifate, apoi e un gol,
--    apoi doi oameni singuri la 30 și 58). Pragul e despre ZONE BIFATE, nu
--    despre terenuri, și nu scoate pe nimeni de pe platformă — doar nu-i
--    trimite ACEST email.

drop function if exists public.lot_terenuri_noi(timestamptz, integer);

create function public.lot_terenuri_noi(
    p_de_la      timestamptz,              -- podeaua ferestrei (vezi (3) mai sus)
    p_prag_zone  integer default 20
)
returns table (
    user_id                uuid,
    email                  text,
    nume                   text,
    fereastra_de_la        timestamptz,    -- fereastra REALĂ folosită pentru omul ăsta
    zona_1                 text,
    terenuri_1             integer,
    zona_2                 text,
    terenuri_2             integer,
    zona_3                 text,
    terenuri_3             integer,
    terenuri_1_text        text,
    total_zone_cu_terenuri integer,
    total_terenuri         integer,
    nr_zone_bifate         integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$

with parametri as (
    select p_de_la as de_la, p_prag_zone as prag_zone
),

useri_reali as (
    -- Conturi reale, active, cu profil completat, care n-au oprit emailul.
    -- Aceeași definiție ca în analiza-zone/ și postare-zone/, ca cifrele să
    -- rămână comparabile între analize.
    select
        p.user_id                   as user_id,
        p.email::text               as email,
        btrim(p.pseudonym)::text    as nume
    from public.profiles p
    where p.account_type = 'activ'
      and p.pseudonym is not null
      and coalesce(p.is_demo, false) = false
      and (p.account_status is null or p.account_status = 'active')
      and p.email is not null
      and p.cont_intern = false          -- (1) în loc de lista scrisă de mână
      and p.email_terenuri_noi = true    -- (2) bifa din pagina de profil
),

ferestre as (
    -- (3) Fereastra fiecărui om: de la ultima trimitere către el, dar
    -- niciodată mai devreme de podeaua `p_de_la`. Cine n-a primit niciodată
    -- nimic pornește chiar de la podea.
    -- Plafonul de siguranță (ex. „nu mai mult de 14 zile în urmă") se dă din
    -- afară, prin `p_de_la` — ca să fie într-un singur loc, în edge function,
    -- nu ascuns aici.
    select
        u.user_id,
        greatest(par.de_la, coalesce(max(l.trimis_la), par.de_la)) as de_la_efectiv
    from useri_reali u
    cross join parametri par
    left join public.terenuri_digest_log l on l.user_id = u.user_id
    group by u.user_id, par.de_la
),

total_zone_per_user as (
    -- Câte zone are bifate fiecare om ÎN TOTAL (pentru prag).
    -- Se numără TOATE zonele lui, nu doar cele cu terenuri noi: pragul e
    -- despre cât de împrăștiată e căutarea lui, nu despre câte potriviri a
    -- nimerit săptămâna asta.
    select upz.user_id, count(*)::integer as nr_zone_bifate
    from public.user_preferred_zones upz
    group by upz.user_id
),

terenuri_noi as (
    -- Terenurile publice adăugate după podea, legate de zona reală din `zones`.
    -- ⚠️ Potrivirea se face PE TEXT, nu pe cheie străină. Verificată pe
    --    12 august: 46 din 46 de terenuri se leagă corect. JOIN (nu LEFT
    --    JOIN) ⇒ un teren care nu se potrivește pe nicio zonă cade aici, tăcut.
    --    De aceea edge function-ul numără separat terenurile nelegate și
    --    semnalează pe Slack dacă sunt mai multe de zero.
    select
        z.id            as zone_id,
        z.name::text    as zona,
        t.id            as teren_id,
        t.created_at    as created_at
    from public.terenuri t
    cross join parametri par
    join public.cities c on lower(btrim(c.name))   = lower(btrim(t.oras))
    join public.zones  z on lower(btrim(z.name))   = lower(btrim(t.cartier))
                        and z.city_id = c.id
    where t.created_at >= par.de_la
      and t.deleted_at is null
      and t.status = 'approved'          -- doar ce e vizibil public
),

per_zona as (
    -- Câte terenuri noi are FIECARE OM în FIECARE ZONĂ a lui.
    -- Numărătoarea e aici, nu într-un CTE global, tocmai fiindcă fereastra
    -- diferă de la om la om — vezi (3).
    -- Se grupează pe NUMELE zonei, nu pe id: dacă vreodată reapar două zone
    -- cu același nume (cele 16 fantome șterse pe 12 august), omul vede o
    -- singură linie, nu două.
    select
        u.user_id,
        u.email,
        u.nume,
        tn.zona,
        count(distinct tn.teren_id)::integer as nr_terenuri,
        f.de_la_efectiv,
        tz.nr_zone_bifate
    from useri_reali u
    join ferestre f                       on f.user_id  = u.user_id
    join total_zone_per_user tz           on tz.user_id = u.user_id
    join public.user_preferred_zones upz  on upz.user_id = u.user_id
    join terenuri_noi tn                  on tn.zone_id = upz.zone_id
                                         and tn.created_at >= f.de_la_efectiv
    cross join parametri par
    where tz.nr_zone_bifate <= par.prag_zone
    group by u.user_id, u.email, u.nume, tn.zona, f.de_la_efectiv, tz.nr_zone_bifate
),

potriviri as (
    select
        pz.*,
        row_number() over (
            partition by pz.user_id
            -- zona cu cele mai multe terenuri noi prima; la egalitate, alfabetic
            order by pz.nr_terenuri desc, pz.zona
        ) as pozitie
    from per_zona pz
)

select
    pt.user_id,
    pt.email,
    pt.nume,
    min(pt.de_la_efectiv)                                       as fereastra_de_la,

    -- Primele 3 zone, ca în campania din 28 iulie. Restul se rezumă în email
    -- printr-un rând de tipul „și încă N zone".
    max(case when pt.pozitie = 1 then pt.zona end)::text        as zona_1,
    max(case when pt.pozitie = 1 then pt.nr_terenuri end)::integer as terenuri_1,
    max(case when pt.pozitie = 2 then pt.zona end)::text        as zona_2,
    max(case when pt.pozitie = 2 then pt.nr_terenuri end)::integer as terenuri_2,
    max(case when pt.pozitie = 3 then pt.zona end)::text        as zona_3,
    max(case when pt.pozitie = 3 then pt.nr_terenuri end)::integer as terenuri_3,

    -- Acordul gramatical se rezolvă AICI, nu în JavaScript: „1 teren nou",
    -- „3 terenuri noi", „21 de terenuri noi".
    (max(case when pt.pozitie = 1 then
        case
            when pt.nr_terenuri = 1  then '1 teren nou'
            when pt.nr_terenuri < 20 then pt.nr_terenuri || ' terenuri noi'
            else                          pt.nr_terenuri || ' de terenuri noi'
        end
    end))::text                                                 as terenuri_1_text,

    count(*)::integer                                           as total_zone_cu_terenuri,
    sum(pt.nr_terenuri)::integer                                as total_terenuri,
    max(pt.nr_zone_bifate)::integer                             as nr_zone_bifate
from potriviri pt
group by pt.user_id, pt.email, pt.nume
order by sum(pt.nr_terenuri) desc, count(*) desc;

$$;

-- ⚠️ Cine are voie s-o cheme. `SECURITY DEFINER` înseamnă că rulează cu
--    drepturile proprietarului, deci trece peste RLS — exact ce trebuie
--    pentru o funcție de server, și exact de ce NU are voie s-o cheme un
--    utilizator logat: i-ar întoarce emailurile tuturor.
revoke all on function public.lot_terenuri_noi(timestamptz, integer) from public;
revoke all on function public.lot_terenuri_noi(timestamptz, integer) from anon, authenticated;

-- Doar serverul. Fără grantul ăsta, edge function-ul primește „permission
-- denied for function" și nu pleacă niciun email — tăcut, o dată pe săptămână.
grant execute on function public.lot_terenuri_noi(timestamptz, integer) to service_role;

comment on function public.lot_terenuri_noi(timestamptz, integer) is
'Lotul săptămânal pentru emailul „terenuri noi în zonele tale": un rând per persoană, cu primele 3 zone ale ei în care au apărut terenuri și acordul gramatical rezolvat. Fereastra e per persoană (de la ultima trimitere către ea, dar nu mai devreme de p_de_la). Exclude conturile interne (cont_intern), pe cei care au oprit bifa (email_terenuri_noi) și pe cei cu mai mult de p_prag_zone zone bifate. Chemată exclusiv de edge function-ul digest-terenuri-zone, cu service_role.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 6 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ ABIA AICI se vede dacă funcția e corectă. O funcție SQL se verifică la
--    RULARE, nu la creare: `RETURNS TABLE` nu se validează când o scrii.
--    Dacă 6c dă eroare 42804, un cast lipsește — spune-mi ce coloană zice.

-- 6a. Coloana există și are valoarea implicită corectă?
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'profiles'
  and column_name  = 'email_terenuri_noi';
-- Așteptat: boolean | NO | true


-- 6b. Jurnalul e într-adevăr închis? Trebuie să întoarcă 0 politici.
select count(*) as politici_pe_jurnal
from pg_policies
where schemaname = 'public'
  and tablename  = 'terenuri_digest_log';


-- 6c. ⭐ PROBA CEA MARE: cine ar primi emailul dacă ar pleca ACUM, cu
--     terenurile din ultimele 14 zile. Jurnalul e gol la prima rulare, deci
--     fereastra tuturor pornește de la podea.
select *
from public.lot_terenuri_noi(now() - interval '14 days', 20);

-- Cum se citește:
--   • `nr_zone_bifate` trebuie să fie ≤ 20 pe TOATE rândurile (pragul).
--   • Coloana `email` — citește lista cu ochiul. Aici s-a găsit pe 12 august
--     `ltfb.studio@gmail.com`, contul studioului, pe care niciun filtru
--     automat nu-l prindea. Dacă vezi vreo adresă de-a noastră, contul acela
--     n-are `cont_intern = true` și trebuie marcat.
--   • Zero rânduri e un rezultat VALID, nu o defecțiune: pe 10 august n-a
--     apărut niciun teren nou. Verifică cu 6d înainte de a bănui funcția.


-- 6d. Dacă 6c a ieșit gol: chiar n-au fost terenuri, sau e ceva stricat?
select count(*) as terenuri_publice_ultimele_14_zile
from public.terenuri t
where t.created_at >= now() - interval '14 days'
  and t.deleted_at is null
  and t.status = 'approved';
-- 0 aici ⇒ 6c gol e corect. Un număr > 0 cu 6c gol ⇒ scrie-mi, e o problemă
-- de potrivire teren↔zonă și se reia `0-diagnostic-potrivire.sql`.


-- 6e. Câți oameni sunt tăiați de prag și câți de bifă — ca să știi
--     dinainte cine NU va primi, fără să te uiți la emailuri.
select
    count(*) filter (where p.cont_intern)                as conturi_interne,
    count(*) filter (where not p.email_terenuri_noi)     as si_au_oprit_emailul,
    count(*) filter (where z.nr_zone_bifate > 20)        as peste_prag,
    count(*)                                            as total_profiluri
from public.profiles p
left join (
    select user_id, count(*) as nr_zone_bifate
    from public.user_preferred_zones
    group by user_id
) z on z.user_id = p.user_id
where p.account_type = 'activ'
  and p.pseudonym is not null
  and coalesce(p.is_demo, false) = false
  and (p.account_status is null or p.account_status = 'active');
-- Așteptat pe 12 august: conturi_interne 23, si_au_oprit_emailul 0,
-- peste_prag 2 (cei cu 30 și 58 de zone).

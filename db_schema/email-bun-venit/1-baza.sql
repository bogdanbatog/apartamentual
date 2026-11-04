-- ═══════════════════════════════════════════════════════════════════════════
-- EMAILUL DE BUN VENIT — baza (jurnal, lista „stop”, funcția care alege lotul)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE FACE, PE SCURT
-- În fiecare dimineață, la 10 (ora României), edge function-ul `email-bun-venit`
-- cheamă funcția SQL de mai jos și primește lista oamenilor care:
--   • și-au făcut cont DUPĂ data de pornire (doar conturile noi),
--   • au profilul complet (aceeași regulă ca la intrarea în grupuri:
--     `profil_complet()`, deci au cel puțin o zonă bifată),
--   • și-au făcut contul cel târziu IERI (emailul pleacă „a doua zi dimineață”),
--   • n-au primit încă emailul (jurnalul de mai jos, cu un rând per om),
--   • n-au cerut „stop” (lista de mai jos).
-- Pentru fiecare, funcția dă și cifrele din email: câți oameni mai caută în
-- zonele lui și câte grupuri se formează acolo.
--
-- CE NU ATINGE: plățile, `profiles` (doar citește), politicile existente,
-- `notify-admins`. Creează două tabele noi și o funcție nouă.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în acest script.
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND. BLOC 0 se citește înainte de orice altceva.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (doar citește). Trimite-mi rezultatul înainte de BLOC 1.
-- ───────────────────────────────────────────────────────────────────────────
-- Funcția din BLOC 3 se sprijină pe coloane pe care nu le pot vedea din cod.
-- Dacă vreuna lipsește sau are alt nume, funcția se creează fără eroare, dar
-- CRAPĂ abia la prima rulare (vezi memoria „funcțiile SQL se verifică la
-- rulare”). Interogarea de mai jos întoarce un singur tabel, cu o coloană
-- `sectiune`, fiindcă editorul arată doar ultimul rezultat.

select 'coloane' as sectiune,
       table_name || '.' || column_name as ce,
       data_type as detaliu
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
      ('profiles', 'created_at'),
      ('profiles', 'email'),
      ('profiles', 'pseudonym'),
      ('profiles', 'account_type'),
      ('profiles', 'account_status'),
      ('profiles', 'is_demo'),
      ('profiles', 'cont_intern'),
      ('user_preferred_zones', 'zone_id'),
      ('grup_preferred_zones', 'zone_id'),
      ('grup_preferred_zones', 'grup_id'),
      ('grupuri', 'status'),
      ('grupuri', 'is_demo'),
      ('zones', 'name')
  )
union all
-- Câte grupuri reale sunt pe fiecare status (ca să știm ce înseamnă
-- „grupuri care se formează”).
select 'grupuri pe status',
       coalesce(g.status::text, '(gol)'),
       count(*)::text
from public.grupuri g
where coalesce(g.is_demo, false) = false
group by g.status
union all
-- Câte conturi ar fi intrat în lot dacă emailul ar fi existat deja, pe zile.
-- Doar ca să vedem ordinul de mărime: câte emailuri pe dimineață.
select 'conturi noi complete, ultimele 30 zile',
       (p.created_at at time zone 'Europe/Bucharest')::date::text,
       count(*)::text
from public.profiles p
where p.created_at >= now() - interval '30 days'
  and p.account_type = 'activ'
  and coalesce(p.is_demo, false) = false
  and coalesce(p.cont_intern, false) = false
  and public.profil_complet(p.user_id)
group by 2
order by 1, 2;

-- Așteptat: 13 rânduri „coloane” (dacă sunt mai puține, una lipsește: spune-mi
-- care), câteva rânduri „grupuri pe status” și câteva zile cu 0-3 conturi.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Jurnalul: un rând per om căruia i-a plecat emailul
-- ───────────────────────────────────────────────────────────────────────────
-- `user_id` e CHEIE PRIMARĂ, nu doar o coloană: baza refuză al doilea rând
-- pentru același om. Chiar dacă funcția ar fi chemată de două ori în aceeași
-- secundă, nimeni nu poate fi trecut de două ori în jurnal.
--
-- Cifrele din email se păstrează, ca să putem răspunde mai târziu la „ce i-am
-- scris omului ăstuia?”.

create table if not exists public.bun_venit_log (
    user_id     uuid        primary key,
    trimis_la   timestamptz not null default now(),
    varianta    text        not null,      -- 'A' (există grupuri) / 'B' (niciun grup) / 'B0' (nimeni altcineva)
    nr_oameni   integer     not null,
    nr_grupuri  integer     not null,
    resend_id   text                       -- id-ul mesajului la Resend, pentru urmărire
);

comment on table public.bun_venit_log is
    'Un rând per persoană căreia i-a plecat emailul de bun venit. Scris exclusiv de edge function-ul email-bun-venit. Cheia primară pe user_id face imposibilă o a doua trimitere.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Lista „stop”: adresele care nu mai vor emailuri de la noi
-- ───────────────────────────────────────────────────────────────────────────
-- Până acum, cine răspundea „stop” intra în `EXCLUSI_IMPLICIT` din scripturile
-- locale. Emailul de bun venit pleacă singur, de pe server, deci are nevoie de
-- o listă pe care s-o vadă și serverul. O facem generală (nu „doar pentru
-- bun venit”), ca s-o poată citi și campaniile de mai târziu.
--
-- Adresa se ține cu litere mici, ca „Ana@Gmail.com” și „ana@gmail.com” să fie
-- același om. Cum adaugi pe cineva: vezi exemplul de la sfârșitul blocului.

create table if not exists public.emailuri_stop (
    email    text        primary key check (email = lower(btrim(email))),
    cerut_la timestamptz not null default now(),
    nota     text
);

comment on table public.emailuri_stop is
    'Adresele care au cerut „stop”. Citită de emailul de bun venit (și, pe viitor, de celelalte trimiteri automate). Se completează de mână din SQL Editor.';

-- (EXEMPLU, NU-L RULA ACUM. Îl folosești mai târziu, când cineva cere „stop”.)
-- insert into public.emailuri_stop (email, nota)
-- values (lower('cineva@exemplu.ro'), 'stop la bun venit');


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2b — Închiderea celor două tabele
-- ───────────────────────────────────────────────────────────────────────────
-- RLS pornit și NICIO POLITICĂ, ca la `terenuri_digest_log`:
--   • `service_role` (edge function-ul) ocolește RLS ⇒ citește și scrie;
--   • `anon` și `authenticated` n-au nicio politică ⇒ nu văd nimic;
--   • tu, în SQL Editor, ești `postgres` ⇒ vezi tot.
-- REVOKE-ul e necesar: tabelele noi vin cu drepturi depline pentru `anon` și
-- `authenticated` (memoria „tabelele noi vin cu drepturi depline”). Lista
-- „stop” are adrese de email, deci nu are voie să fie citibilă din site.

alter table public.bun_venit_log  enable row level security;
alter table public.emailuri_stop  enable row level security;

revoke all on public.bun_venit_log from anon, authenticated;
revoke all on public.emailuri_stop from anon, authenticated;

grant select, insert on public.bun_venit_log to service_role;
grant select         on public.emailuri_stop to service_role;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Funcția care alege lotul
-- ───────────────────────────────────────────────────────────────────────────
-- Parametri:
--   p_de_la      — data de pornire: doar conturile făcute de atunci încolo.
--                  O dă edge function-ul (constanta DATA_PORNIRE), nu stă aici.
--   p_inainte_de — miezul nopții de azi, la București. Doar conturile făcute
--                  înainte de el, ca emailul să plece „a doua zi dimineață”.
--
-- ⚠️ DE CE „CONTUL FĂCUT IERI” ȘI NU „PROFILUL COMPLETAT IERI”: baza nu ține
-- minte când a fost completat profilul (`profiles.updated_at` nu e scris de
-- formularul nou). Aproape toți își completează profilul imediat după
-- înregistrare (formularul `?welcome=1`), deci diferența e mică. Cazul rar:
-- cineva care și-a făcut contul ieri și completează profilul azi la 9:55
-- primește emailul la 10:09, la câteva minute după. Nu e greșit, doar rapid.
--
-- CIFRELE DIN EMAIL
--   nr_oameni  = ceilalți oameni reali (fără el, fără conturi interne, fără
--                exemple) care au bifat CEL PUȚIN O zonă comună cu el.
--   nr_grupuri = grupurile reale, nearhivate și neînchise, care au bifat cel
--                puțin o zonă comună cu el.
--   ⚠️ „Grupuri care se formează” = status `deschis`, `cu_aprobare`, `activ`
--      sau `explorare`. Afară: `inchis`, `arhivat` și grupurile-exemplu.

-- ⚠️ `p_inainte_de` are valoare implicită: dacă nu e dat, e miezul nopții de
-- azi la București, calculat AICI (Postgres știe de ora de vară). Edge
-- function-ul îl dă explicit doar la probe, ca să poată include un cont de
-- test făcut chiar azi.

create or replace function public.lot_bun_venit(
    p_de_la      timestamptz,
    p_inainte_de timestamptz default null
)
returns table (
    user_id    uuid,
    email      text,
    nume       text,
    creat_la   timestamptz,
    zone       text[],       -- numele zonelor bifate, în ordine alfabetică
    nr_oameni  integer,
    nr_grupuri integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$

with oameni_reali as (
    -- Aceleași filtre ca la digestul de terenuri (minus bifa lui, care e
    -- despre terenuri, nu despre emailurile personale).
    select p.user_id, p.email, p.pseudonym, p.created_at
    from public.profiles p
    where p.account_type = 'activ'
      and p.pseudonym is not null
      and coalesce(p.is_demo, false) = false
      and coalesce(p.cont_intern, false) = false
      and (p.account_status is null or p.account_status = 'active')
),

destinatari as (
    select o.*
    from oameni_reali o
    where o.email is not null
      and o.created_at >= p_de_la
      and o.created_at <  coalesce(
              p_inainte_de,
              date_trunc('day', now() at time zone 'Europe/Bucharest') at time zone 'Europe/Bucharest'
          )
      and public.profil_complet(o.user_id)
      and not exists (select 1 from public.bun_venit_log l where l.user_id = o.user_id)
      and not exists (select 1 from public.emailuri_stop s where s.email = lower(btrim(o.email)))
)

select
    d.user_id,
    d.email::text,
    btrim(d.pseudonym)::text,
    d.created_at,

    (select array_agg(z.name::text order by z.name)
       from public.user_preferred_zones upz
       join public.zones z on z.id = upz.zone_id
      where upz.user_id = d.user_id),

    (select count(distinct alt.user_id)::integer
       from public.user_preferred_zones mine
       join public.user_preferred_zones altz on altz.zone_id = mine.zone_id
       join oameni_reali alt                 on alt.user_id = altz.user_id
      where mine.user_id = d.user_id
        and alt.user_id <> d.user_id),

    (select count(distinct g.id)::integer
       from public.user_preferred_zones mine
       join public.grup_preferred_zones gpz on gpz.zone_id = mine.zone_id
       join public.grupuri g                on g.id = gpz.grup_id
      where mine.user_id = d.user_id
        and coalesce(g.is_demo, false) = false
        and g.status in ('deschis', 'cu_aprobare', 'activ', 'explorare'))

from destinatari d
order by d.created_at;

$$;

revoke all on function public.lot_bun_venit(timestamptz, timestamptz) from public;
revoke all on function public.lot_bun_venit(timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.lot_bun_venit(timestamptz, timestamptz) to service_role;

comment on function public.lot_bun_venit(timestamptz, timestamptz) is
'Lotul pentru emailul de bun venit: conturile noi (create între p_de_la și p_inainte_de), cu profil complet, fără rând în bun_venit_log și fără adresă în emailuri_stop. Pentru fiecare: zonele bifate, câți alți oameni reali au o zonă comună și câte grupuri care se formează sunt în zonele lui. Chemată exclusiv de edge function-ul email-bun-venit, cu service_role.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — VERIFICARE (doar citește)
-- ───────────────────────────────────────────────────────────────────────────
-- Cine AR fi primit emailul dacă l-am fi pornit acum 14 zile. Nu trimite
-- nimic și nu scrie nimic. Uită-te la 2-3 oameni pe care îi știi și spune-mi
-- dacă cifrele par corecte (de exemplu: cineva din Parcul Circului ar trebui
-- să aibă cel puțin un grup).
--
-- ⚠️ `auth.uid()` nu contează aici: funcția e `security definer` și nu
-- depinde de cine e logat, deci rezultatul din editor e cel real.

select nume, email, creat_la, zone, nr_oameni, nr_grupuri,
       case when nr_grupuri > 0 then 'A'
            when nr_oameni  > 0 then 'B'
            else 'B0' end as varianta
from public.lot_bun_venit(now() - interval '14 days');

-- Așteptat: câțiva oameni (cât arată BLOC 0 pe ultimele 14 zile, fără azi),
-- fiecare cu cel puțin o zonă. `zone` gol ar fi imposibil: `profil_complet`
-- cere o zonă.

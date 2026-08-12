-- Doar functia `lot_terenuri_noi`, versiunea 2 (13 august 2026).
-- Extras din `2c-functie-cu-lista-terenuri.sql`, BLOC 1, ca sa poata fi rulat
-- cu Ctrl+A / Ctrl+C fara riscul unei selectii partiale.
-- Explicatiile si verificarile sunt in fisierul `2c`.

drop function if exists public.lot_terenuri_noi(timestamptz, integer);
drop function if exists public.lot_terenuri_noi(timestamptz, integer, integer);

create function public.lot_terenuri_noi(
    p_de_la         timestamptz,          -- podeaua ferestrei
    p_prag_zone     integer default 20,   -- peste atâtea zone bifate, îl sărim
    p_max_terenuri  integer default 40    -- plafon de SIGURANȚĂ, nu editorial
)
returns table (
    user_id                uuid,
    email                  text,
    nume                   text,
    fereastra_de_la        timestamptz,
    zona_1                 text,
    terenuri_1             integer,
    zona_2                 text,
    terenuri_2             integer,
    zona_3                 text,
    terenuri_3             integer,
    terenuri_1_text        text,
    total_zone_cu_terenuri integer,
    total_terenuri         integer,
    nr_zone_bifate         integer,
    terenuri_lista         jsonb          -- ⭐ NOU
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$

with parametri as (
    select p_de_la as de_la, p_prag_zone as prag_zone, p_max_terenuri as max_terenuri
),

useri_reali as (
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
      and p.cont_intern = false
      and p.email_terenuri_noi = true
),

ferestre as (
    -- Fereastra fiecărui om: de la ultima trimitere către el, dar niciodată
    -- mai devreme de podeaua `p_de_la`. Cine n-a primit nimic pornește de la podea.
    select
        u.user_id,
        greatest(par.de_la, coalesce(max(l.trimis_la), par.de_la)) as de_la_efectiv
    from useri_reali u
    cross join parametri par
    left join public.terenuri_digest_log l on l.user_id = u.user_id
    group by u.user_id, par.de_la
),

total_zone_per_user as (
    select upz.user_id, count(*)::integer as nr_zone_bifate
    from public.user_preferred_zones upz
    group by upz.user_id
),

terenuri_noi as (
    -- Terenurile publice adăugate după podea, legate de zona reală din `zones`.
    -- ⚠️ Potrivirea se face PE TEXT. Verificată pe 12 august: 46 din 46.
    select
        z.id                                    as zone_id,
        z.name::text                            as zona,
        t.id                                    as teren_id,
        t.created_at                            as created_at,
        t.titlu::text                           as titlu,
        t.oras::text                            as oras,
        t.suprafata                             as suprafata,
        t.pret_total                            as pret_total,
        t.nr_apartamente_min                    as nr_apartamente_min,
        t.nr_apartamente_max                    as nr_apartamente_max,
        -- Prima imagine, dacă există. `image_urls` e un tablou Postgres
        -- (confirmat în BLOC 0: tipul e ARRAY), deci se indexează de la 1.
        -- `image_url` e cea veche, cu o singură poză — se încearcă a doua,
        -- exact în ordinea din `terenuri.js:348-350`.
        coalesce(t.image_urls[1]::text, t.image_url::text) as imagine
    from public.terenuri t
    cross join parametri par
    join public.cities c on lower(btrim(c.name))   = lower(btrim(t.oras))
    join public.zones  z on lower(btrim(z.name))   = lower(btrim(t.cartier))
                        and z.city_id = c.id
    where t.created_at >= par.de_la
      and t.deleted_at is null
      and t.status = 'approved'
),

-- ── Potrivirile brute: om × teren nou dintr-o zonă bifată de el ────────────
-- `distinct` fiindcă, dacă vreodată reapar două zone cu același nume, același
-- teren s-ar lega de om de două ori și ar apărea dublat în listă.
potriviri_terenuri as (
    select distinct
        u.user_id,
        u.email,
        u.nume,
        f.de_la_efectiv,
        tz.nr_zone_bifate,
        tn.teren_id,
        tn.zona,
        tn.oras,
        tn.titlu,
        tn.suprafata,
        tn.pret_total,
        tn.nr_apartamente_min,
        tn.nr_apartamente_max,
        tn.imagine,
        tn.created_at
    from useri_reali u
    join ferestre f                       on f.user_id  = u.user_id
    join total_zone_per_user tz           on tz.user_id = u.user_id
    join public.user_preferred_zones upz  on upz.user_id = u.user_id
    join terenuri_noi tn                  on tn.zone_id = upz.zone_id
                                         and tn.created_at >= f.de_la_efectiv
    cross join parametri par
    where tz.nr_zone_bifate <= par.prag_zone
),

-- ── Numărătoarea per zonă (neschimbată față de versiunea 1) ────────────────
per_zona as (
    select
        pu.user_id, pu.email, pu.nume, pu.zona,
        count(distinct pu.teren_id)::integer as nr_terenuri,
        pu.de_la_efectiv,
        pu.nr_zone_bifate
    from potriviri_terenuri pu
    group by pu.user_id, pu.email, pu.nume, pu.zona, pu.de_la_efectiv, pu.nr_zone_bifate
),

potriviri as (
    select
        pz.*,
        row_number() over (
            partition by pz.user_id
            order by pz.nr_terenuri desc, pz.zona
        ) as pozitie
    from per_zona pz
),

-- ── ⭐ NOU: lista de terenuri, cele mai noi întâi ──────────────────────────
terenuri_ordonate as (
    select
        pu.*,
        row_number() over (
            partition by pu.user_id
            -- cel mai recent adăugat primul; la egalitate, alfabetic după titlu
            order by pu.created_at desc, pu.titlu
        ) as poz
    from potriviri_terenuri pu
),

lista_terenuri as (
    select
        t.user_id,
        jsonb_agg(
            jsonb_build_object(
                'id',         t.teren_id,
                'titlu',      t.titlu,
                'zona',       t.zona,
                'oras',       t.oras,
                'suprafata',  t.suprafata,
                'pret_total', t.pret_total,
                -- ⚠️ Prețul pe mp se CALCULEAZĂ, deși există o coloană
                -- `terenuri.pret_pe_mp` în bază. Motivul: frontendul n-o
                -- folosește — `terenuri.js:335` împarte `pret_total` la
                -- `suprafata`. Dacă am citi coloana, emailul ar putea arăta
                -- alt număr decât pagina terenului, iar omul ar avea dreptate
                -- să nu ne mai creadă pe niciuna.
                'pret_mp',    case when t.pret_total is not null
                                    and t.suprafata is not null
                                    and t.suprafata > 0
                                   then round(t.pret_total / t.suprafata)
                              end,
                -- Câte apartamente se pot construi — completate doar la
                -- terenurile care au deja o analiză. NULL la restul, iar
                -- emailul pur și simplu nu afișează rândul. Vezi 2d: dacă
                -- sunt aproape peste tot NULL, textul nu se poate sprijini pe ele.
                'ap_min',     t.nr_apartamente_min,
                'ap_max',     t.nr_apartamente_max,
                'imagine',    t.imagine,
                'adaugat_la', t.created_at
            )
            order by t.poz
        ) as terenuri_lista
    from terenuri_ordonate t
    cross join parametri par
    where t.poz <= par.max_terenuri
    group by t.user_id
)

-- ⚠️ Linkul NU se construiește aici. Domeniul site-ului n-are ce căuta în
--    bază — emailul îl compune din `id`, în edge function. Dacă mutăm vreodată
--    site-ul, nu vrem să fie nevoie de o migrație SQL.
select
    pt.user_id,
    pt.email,
    pt.nume,
    min(pt.de_la_efectiv)                                          as fereastra_de_la,

    max(case when pt.pozitie = 1 then pt.zona end)::text           as zona_1,
    max(case when pt.pozitie = 1 then pt.nr_terenuri end)::integer as terenuri_1,
    max(case when pt.pozitie = 2 then pt.zona end)::text           as zona_2,
    max(case when pt.pozitie = 2 then pt.nr_terenuri end)::integer as terenuri_2,
    max(case when pt.pozitie = 3 then pt.zona end)::text           as zona_3,
    max(case when pt.pozitie = 3 then pt.nr_terenuri end)::integer as terenuri_3,

    (max(case when pt.pozitie = 1 then
        case
            when pt.nr_terenuri = 1  then '1 teren nou'
            when pt.nr_terenuri < 20 then pt.nr_terenuri || ' terenuri noi'
            else                          pt.nr_terenuri || ' de terenuri noi'
        end
    end))::text                                                    as terenuri_1_text,

    count(*)::integer                                              as total_zone_cu_terenuri,
    sum(pt.nr_terenuri)::integer                                   as total_terenuri,
    max(pt.nr_zone_bifate)::integer                                as nr_zone_bifate,
    -- ⚠️ NU `max(lt.terenuri_lista)`: pe `jsonb` nu există `max()`
    -- (`42883: function max(jsonb) does not exist`). Nici n-are ce agrega —
    -- `lista_terenuri` are exact un rând per om, deci coloana intră în
    -- `group by` și se ia ca atare.
    lt.terenuri_lista                                              as terenuri_lista
from potriviri pt
left join lista_terenuri lt on lt.user_id = pt.user_id
group by pt.user_id, pt.email, pt.nume, lt.terenuri_lista
order by sum(pt.nr_terenuri) desc, count(*) desc;

$$;

revoke all on function public.lot_terenuri_noi(timestamptz, integer, integer) from public;
revoke all on function public.lot_terenuri_noi(timestamptz, integer, integer) from anon, authenticated;
grant execute on function public.lot_terenuri_noi(timestamptz, integer, integer) to service_role;

comment on function public.lot_terenuri_noi(timestamptz, integer, integer) is
'Lotul săptămânal pentru emailul „terenuri noi în zonele tale": un rând per persoană, cu primele 3 zone, acordul gramatical rezolvat și lista celor mai noi p_max_terenuri terenuri (jsonb, pentru cardurile din email). Fereastra e per persoană (de la ultima trimitere către ea, dar nu mai devreme de p_de_la). Exclude conturile interne, pe cei care au oprit bifa și pe cei cu peste p_prag_zone zone bifate. Chemată exclusiv de edge function-ul digest-terenuri-zone, cu service_role.';

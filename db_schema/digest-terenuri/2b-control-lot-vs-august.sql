-- ═══════════════════════════════════════════════════════════════════════════
-- CONTROL: funcția nouă dă ACELEAȘI cifre ca interogarea din august?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE EXISTĂ ACEST FIȘIER. `lot_terenuri_noi` nu e o interogare nouă, e cea
-- validată pe date reale în august (`terenuri-noi/4-lot-destinatari.sql`, din
-- care au plecat 38 de emailuri pe 3 august), MUTATĂ în funcție. Dar mutarea
-- n-a fost o simplă copiere: fereastra a devenit per persoană, deci
-- numărătoarea terenurilor s-a mutat dintr-un CTE global într-unul per (om,
-- zonă). O restructurare arată inofensivă și poate schimba tăcut cifrele.
--
-- Ăsta e testul: rulăm AMÂNDOUĂ variantele pe aceleași date, cu aceiași
-- parametri ca în august (30 iulie, prag 12), și ne uităm la diferențe.
--
-- ⚠️ NU SCHIMBĂ NIMIC — strict SELECT, se poate rula oricând.
--
-- ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN SINGUR „Run" (o singură interogare cu
--    `UNION ALL` — editorul Supabase arată doar ultimul rezultat).
--
-- ⚠️ ARE SENS DOAR CÂT TIMP `terenuri_digest_log` E GOALĂ. După prima
--    trimitere reală, fiecare om are propria fereastră și cele două variante
--    NU MAI AU CUM să dea la fel — atunci diferențele sunt corecte, nu erori.
--    Verifică cu secțiunea Z înainte de a interpreta orice.
--
-- ═══ CE E O DIFERENȚĂ AȘTEPTATĂ (nu e defect) ═════════════════════════════
--   • Cineva apare DOAR ÎN VECHI ⇒ e un cont pe care lista scrisă de mână
--     NU-l excludea, dar steagul `cont_intern` îl exclude. Corect: exact de
--     asta s-a făcut steagul (ex. `ltfb.studio@gmail.com`).
--   • Cineva apare DOAR ÎN NOU ⇒ era pe lista veche de excluderi dar n-are
--     `cont_intern = true`. ⚠️ ASTA VERIFIC-O: ori e un om real exclus din
--     greșeală în august, ori un cont de-al nostru rămas nemarcat.
--   • Cineva apare în amândouă cu CIFRE DIFERITE ⇒ 🔴 ASTA E PROBLEMA pe care
--     o caută fișierul. Restructurarea a schimbat numărătoarea. Scrie-mi.
-- ═══════════════════════════════════════════════════════════════════════════

with

-- ── Parametrii din august, litera cu litera ────────────────────────────────
parametri as (
    select
        (date '2026-07-30')::timestamp at time zone 'Europe/Bucharest' as de_la,
        12 as prag_zone
),

-- ═══ VARIANTA VECHE — copie fidelă din terenuri-noi/4-lot-destinatari.sql ══

useri_exclusi as (
    select p.user_id
    from public.profiles p
    where coalesce(p.is_super_admin, false) = true
       or coalesce(p.is_admin, false) = true
       or lower(p.email) in (
              'liviu.fabian@gmail.com',
              'lucianluta@yahoo.com',
              'luta.lucian.m@gmail.com',
              'cotofana.carmen@yahoo.com',
              'carmen2000ro@yahoo.com',
              'raluca.ivanov26@gmail.com',
              'tiberiu.abc.maxim@gmail.com',
              'livia.dila@yahoo.com'
          )
       or lower(p.email) like 'luta.lucian.m+%'
),

v_useri_reali as (
    select p.user_id, p.email, p.pseudonym
    from public.profiles p
    where p.account_type = 'activ'
      and p.pseudonym is not null
      and coalesce(p.is_demo, false) = false
      and (p.account_status is null or p.account_status = 'active')
      and p.email is not null
      and not exists (select 1 from useri_exclusi e where e.user_id = p.user_id)
),

v_terenuri_noi as (
    select z.id as zone_id, t.id as teren_id
    from public.terenuri t
    cross join parametri par
    join public.cities c on lower(btrim(c.name)) = lower(btrim(t.oras))
    join public.zones  z on lower(btrim(z.name)) = lower(btrim(t.cartier))
                        and z.city_id = c.id
    where t.created_at >= par.de_la
      and t.deleted_at is null
      and t.status = 'approved'
),

v_zone_cu_terenuri as (
    select zone_id, count(distinct teren_id) as nr_terenuri
    from v_terenuri_noi
    group by zone_id
),

v_total_zone as (
    select upz.user_id, count(*) as nr_zone_bifate
    from public.user_preferred_zones upz
    group by upz.user_id
),

v_potriviri as (
    select
        u.email,
        z.name as zona,
        zct.nr_terenuri,
        row_number() over (partition by u.user_id
                           order by zct.nr_terenuri desc, z.name) as pozitie
    from v_useri_reali u
    join public.user_preferred_zones upz on upz.user_id = u.user_id
    join v_zone_cu_terenuri zct          on zct.zone_id = upz.zone_id
    join public.zones z                  on z.id = upz.zone_id
    join v_total_zone tz                 on tz.user_id = u.user_id
    cross join parametri par
    where tz.nr_zone_bifate <= par.prag_zone
),

vechi as (
    select
        lower(p.email)::text                                as email,
        max(case when p.pozitie = 1 then p.zona end)::text  as zona_1,
        count(*)::integer                                   as nr_zone,
        sum(p.nr_terenuri)::integer                         as nr_terenuri
    from v_potriviri p
    group by lower(p.email)
),

-- ═══ VARIANTA NOUĂ — funcția, cu exact aceiași parametri ══════════════════

nou as (
    select
        lower(f.email)::text            as email,
        f.zona_1::text                  as zona_1,
        f.total_zone_cu_terenuri        as nr_zone,
        f.total_terenuri                as nr_terenuri
    from parametri par
    cross join lateral public.lot_terenuri_noi(par.de_la, par.prag_zone) f
),

-- ═══ COMPARAȚIA ═══════════════════════════════════════════════════════════

a_doar_vechi as (
    select
        'A. doar în VECHI (exclus acum de cont_intern)'::text as sectiune,
        v.email,
        (v.nr_terenuri::text || ' terenuri în ' || v.nr_zone::text || ' zone')::text as detaliu
    from vechi v
    where not exists (select 1 from nou n where n.email = v.email)
),

b_doar_nou as (
    select
        'B. doar în NOU (era pe lista scrisă de mână) ⚠️ verifică'::text as sectiune,
        n.email,
        (n.nr_terenuri::text || ' terenuri în ' || n.nr_zone::text || ' zone')::text as detaliu
    from nou n
    where not exists (select 1 from vechi v where v.email = n.email)
),

c_cifre_diferite as (
    select
        'C. 🔴 ACEEAȘI PERSOANĂ, CIFRE DIFERITE'::text as sectiune,
        v.email,
        ('vechi: ' || v.nr_terenuri::text || ' terenuri / ' || v.nr_zone::text || ' zone / „' || coalesce(v.zona_1,'—') || '"'
         || '  ·  nou: ' || n.nr_terenuri::text || ' terenuri / ' || n.nr_zone::text || ' zone / „' || coalesce(n.zona_1,'—') || '"')::text as detaliu
    from vechi v
    join nou n on n.email = v.email
    where v.nr_terenuri is distinct from n.nr_terenuri
       or v.nr_zone     is distinct from n.nr_zone
       or v.zona_1      is distinct from n.zona_1
),

d_rezumat as (
    select
        'D. rezumat'::text as sectiune,
        'destinatari'::text as email,
        ('vechi: ' || (select count(*) from vechi)::text
         || '  ·  nou: ' || (select count(*) from nou)::text
         || '  ·  identici: ' || (select count(*) from vechi v join nou n on n.email = v.email
                                   where v.nr_terenuri = n.nr_terenuri
                                     and v.nr_zone = n.nr_zone
                                     and v.zona_1 is not distinct from n.zona_1)::text)::text as detaliu
),

z_valabilitate as (
    select
        'Z. e valabil controlul?'::text as sectiune,
        case when (select count(*) from public.terenuri_digest_log) = 0
             then 'DA — jurnalul e gol'
             else 'NU — jurnalul are rânduri'
        end::text as email,
        case when (select count(*) from public.terenuri_digest_log) = 0
             then 'Ferestrele tuturor pornesc de la aceeași dată, deci cele două variante sunt comparabile.'
             else 'Au plecat deja emailuri, deci fiecare om are propria fereastră. Diferențele de mai sus NU mai înseamnă nimic.'
        end::text as detaliu
)

select * from z_valabilitate
union all select * from d_rezumat
union all select * from c_cifre_diferite
union all select * from a_doar_vechi
union all select * from b_doar_nou
order by sectiune, email;

-- ═══ REZULTATUL BUN ════════════════════════════════════════════════════════
-- Secțiunea C GOALĂ. Atât. Dacă C e goală, restructurarea e curată și
-- funcția poate merge mai departe în edge function.
-- Secțiunile A și B se citesc cu ochiul — sunt despre CINE, nu despre CÂȚI.

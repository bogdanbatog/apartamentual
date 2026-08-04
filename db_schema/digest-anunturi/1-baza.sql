-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST ZILNIC DE ANUNȚURI — pregătirea bazei de date
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ce face acest script:
--   1. Adaugă pe `profiles` o bifă prin care omul poate opri emailul zilnic.
--   2. Creează tabela-jurnal a trimiterilor (anti-dublare + istoric).
--   3. Închide jurnalul cu RLS, ca nimeni în afară de server să nu-l vadă.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în acest script. Editorul SQL din Supabase
--    rulează tot fișierul ca o singură tranzacție, iar un ROLLBACK pus
--    „doar de probă" anulează tăcut și GRANT-urile de deasupra lui.
--
-- Rulează blocurile PE RÂND și citește ce întoarce fiecare.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Vrem să știm dacă `authenticated` are UPDATE la nivel de TABELĂ pe profiles
-- (caz în care coloana nouă e acoperită automat) sau doar pe coloane anume
-- (caz în care trebuie dat explicit dreptul, altfel bifa nu se poate salva).

select
    grantee,
    privilege_type,
    column_name
from information_schema.column_privileges
where table_schema = 'public'
  and table_name   = 'profiles'
  and grantee      in ('authenticated', 'anon')
  and privilege_type in ('SELECT', 'UPDATE')
order by grantee, privilege_type, column_name;

-- Interpretare:
--   • Dacă lista e LUNGĂ (o linie per coloană) ⇒ drepturile sunt pe coloane,
--     deci BLOC 2 de mai jos e OBLIGATORIU.
--   • Dacă nu apare nimic aici dar `authenticated` poate edita profilul în
--     aplicație ⇒ dreptul e la nivel de tabelă, iar BLOC 2 e inofensiv
--     (repetarea unui GRANT existent nu strică nimic).


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Bifa de oprire a emailului
-- ───────────────────────────────────────────────────────────────────────────
-- Implicit ADEVĂRAT: toți primesc digestul. Cine nu-l vrea, îl oprește.
-- `not null` + `default true` înseamnă că profilurile existente primesc
-- automat valoarea true, fără să fie nevoie de un UPDATE separat.

alter table public.profiles
    add column if not exists email_anunturi_grup boolean not null default true;

comment on column public.profiles.email_anunturi_grup is
    'Fals = utilizatorul nu mai primește emailul zilnic cu anunțurile grupurilor din care face parte. Implicit adevărat.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Dreptul de a citi și schimba propria bifă
-- ───────────────────────────────────────────────────────────────────────────
-- Doar dreptul pe COLOANĂ. Cine are voie să atingă CARE RÂND rămâne stabilit
-- de politicile RLS existente pe `profiles` (fiecare doar rândul lui) —
-- aici nu schimbăm nimic din ele.

grant select (email_anunturi_grup) on public.profiles to authenticated;
grant update (email_anunturi_grup) on public.profiles to authenticated;

-- `anon` NU primește nimic — un vizitator fără cont n-are ce căuta aici.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Jurnalul trimiterilor
-- ───────────────────────────────────────────────────────────────────────────
-- La ce folosește, în ordinea importanței:
--   1. ANTI-DUBLARE: dacă sarcina programată se execută de două ori în
--      aceeași seară (repornire, reîncercare), a doua oară nu mai trimite.
--   2. FEREASTRA: următorul digest ia mesajele de la ultima trimitere
--      încoace. Dacă într-o seară trimiterea eșuează, mesajele nu se pierd —
--      intră în digestul de a doua zi.
--   3. Istoric, ca să poți vedea ce-a plecat și către câți oameni.

create table if not exists public.grup_anunturi_digest_log (
    id                uuid        primary key default gen_random_uuid(),
    grup_id           uuid        not null references public.grupuri(id) on delete cascade,
    trimis_la         timestamptz not null default now(),
    fereastra_de_la   timestamptz not null,
    numar_anunturi    integer     not null,
    numar_destinatari integer     not null
);

comment on table public.grup_anunturi_digest_log is
    'Câte un rând per grup per seară în care a plecat digestul de anunțuri. Scris exclusiv de edge function-ul digest-anunturi-grup.';

-- Căutarea făcută de funcție e mereu „ultima trimitere pentru grupul X".
create index if not exists idx_digest_log_grup_trimis
    on public.grup_anunturi_digest_log (grup_id, trimis_la desc);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Închiderea jurnalului
-- ───────────────────────────────────────────────────────────────────────────
-- RLS pornit ȘI NICIO POLITICĂ. Nu e o scăpare, e intenția:
--   • `service_role` (funcția) ocolește RLS din construcție ⇒ scrie normal.
--   • `authenticated` și `anon` nu au nicio politică ⇒ nu văd niciun rând.
--   • Tu, în SQL Editor, rulezi ca `postgres` și ocolești RLS ⇒ citești tot.
--
-- Am ales varianta asta tocmai ca să NU scriu o politică de superadmin care
-- citește `profiles.is_super_admin`. Pe 1 august, 12 politici scrise așa au
-- golit paginile de terenuri și parteneri la prima revocare de drepturi pe
-- coloane. Cel mai sigur tip de politică e cel care nu există.

alter table public.grup_anunturi_digest_log enable row level security;

-- `anon` nu are ce căuta nici măcar la nivel de drepturi de tabelă.
revoke all on public.grup_anunturi_digest_log from anon;
revoke all on public.grup_anunturi_digest_log from authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────

-- 5a. Coloana există și are valoarea implicită corectă?
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'profiles'
  and column_name  = 'email_anunturi_grup';
-- Așteptat: boolean | NO | true

-- 5b. Câți utilizatori ar primi digestul, dacă azi ar scrie cineva?
--     (doar membri activi, profil neșters, care n-au oprit emailul)
select count(distinct m.user_id) as destinatari_posibili
from public.grup_membri m
join public.profiles p on p.user_id = m.user_id
where m.status = 'activ'
  and coalesce(p.account_status, 'active') <> 'deleted'
  and p.email_anunturi_grup is true
  and coalesce(p.is_demo, false) is false;

-- 5c. Jurnalul e într-adevăr închis? Trebuie să întoarcă 0 politici.
select count(*) as politici_pe_jurnal
from pg_policies
where schemaname = 'public'
  and tablename  = 'grup_anunturi_digest_log';

-- 5d. Cât material ar avea de trimis un prim digest — câte anunțuri
--     s-au scris în ultimele 24 de ore, pe grupuri.
select g.nume as grup, count(*) as anunturi_ultimele_24h
from public.grup_anunturi a
join public.grupuri g on g.id = a.grup_id
where a.created_at >= now() - interval '24 hours'
group by g.nume
order by anunturi_ultimele_24h desc;

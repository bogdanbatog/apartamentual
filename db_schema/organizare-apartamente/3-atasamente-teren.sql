-- ═══════════════════════════════════════════════════════════════════════════
-- ATAȘAMENTELE UNUI TEREN: un singur loc, nu împrăștiate prin anunțuri
-- 30 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: o tabelă și un bucket privat, pentru documentele adunate de grup despre
-- un teren: extrase de carte funciară, certificate de urbanism, planuri
-- cadastrale, oferte, poze de la vizită.
--
-- DE CE: azi documentele ajung agățate de câte un anunț sau de câte un pas din
-- checklist, iar ca să afli ce are grupul trebuie să răsfoiești tot firul.
-- Decizia lui Lucian, 30 august: „o zonă comună cu toate atașamentele, nu la
-- fiecare anunț, că e greu de văzut ce atașamente sunt".
--
-- ⭐ DOUĂ FELURI DE ATAȘAMENT, ȘI AL DOILEA E LA FEL DE IMPORTANT:
--
--   · FIȘIER urcat la noi, în bucketul privat `teren-documente`.
--   · LINK către altundeva: Drive, WeTransfer, portalul ANCPI.
--
--   Linkul nu e o soluție de mâna a doua. Grupurile lucrează deja pe Drive și
--   WhatsApp, iar un extras de carte funciară de 8 MB pe care îl are cineva în
--   Drive n-are de ce să fie mutat la noi ca să apară în listă. Ce lipsește nu
--   e locul de stocare, ci LISTA: „ce documente are grupul despre terenul
--   ăsta", într-un singur loc.
--
--   ⚠️ Un link se strică fără să anunțe pe nimeni: dosarul din Drive se mută,
--   omul își schimbă setările de partajare, contul dispare. De aceea `fel` e
--   scris pe rând, iar pagina spune limpede care e fișier la noi și care e link
--   în altă parte. Nu promitem că un link va merge peste doi ani.
--
-- CE ATINGE SCRIPTUL: o tabelă nouă, un bucket nou și politicile lor. ZERO
-- atingeri la `grup_checklist_files`, la `checklist-files` sau la orice altceva
-- existent. Documentele agățate azi de pașii de teren rămân unde sunt.
--
-- ⚠️ ORDINEA: după `1-tabele-analiza-si-interes.sql`. Nu depinde de el, dar
--    politicile copiază același tipar și e mai ușor de verificat la rând.
--
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul SQL din Supabase rulează tot tabul ca o
--    singură tranzacție, iar un ROLLBACK pus „de probă" anulează tăcut și
--    politicile de deasupra lui.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și trimite-mi rezultatul)
-- ───────────────────────────────────────────────────────────────────────────

select 'a. exista deja?'        as sectiune,
       c.relname::text          as nume,
       'ATENTIE: nu ar trebui'  as detaliu
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'teren_atasamente'

union all

select 'b. bucketuri'           as sectiune,
       id::text                 as nume,
       case when public then 'PUBLIC' else 'privat' end as detaliu
from storage.buckets

union all

-- Câte fișiere sunt deja agățate de pașii de teren. Nu se mută nicăieri: e doar
-- ca să știm despre ce volum vorbim și dacă merită vreodată o punte.
select 'c. fisiere pe pasi'     as sectiune,
       count(*)::text           as nume,
       'in grup_checklist_files' as detaliu
from public.grup_checklist_files

order by sectiune, nume;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Tabela
-- ───────────────────────────────────────────────────────────────────────────
-- Cheia e (grup, teren): documentele aparțin grupului care le-a strâns, despre
-- terenul acela. Alt grup care se uită la același teren nu le vede, ca la
-- analiză și din același motiv: e munca lor.
--
-- `fel` deosebește cele două cazuri. Nu e `check`, ci înțelegere între pagină
-- și bază, ca la `etaj` din preferințe: lista se poate lungi (o zi vom vrea
-- poate „foto"), iar paguba maximă a unei valori greșite e un rând care se
-- afișează neutru.
--
-- ⚠️ `storage_path` ȘI `url` sunt amândouă nullable, dar exact una trebuie
--    completată. Constrângerea de la final o cere: fără ea, un rând cu amândouă
--    goale ar fi un atașament care nu duce nicăieri, iar pagina ar arăta un
--    link mort fără să știe de ce.
--
-- `categorie` e liberă și poate lipsi. Servește la grupare în pagină („acte",
-- „urbanism", „oferte"), nu la vreo regulă.

create table if not exists public.teren_atasamente (
    id            uuid        primary key default gen_random_uuid(),
    grup_id       uuid        not null,
    teren_id      uuid        not null,
    fel           text        not null default 'fisier',   -- fisier | link
    titlu         text        not null,
    categorie     text,
    -- pentru fel = 'fisier'
    storage_path  text,
    nume_fisier   text,
    marime_bytes  bigint,
    tip_mime      text,
    -- pentru fel = 'link'
    url           text,
    note          text,
    adaugat_de    uuid,
    created_at    timestamptz not null default now(),
    constraint teren_atasamente_sursa_ok check (
        (fel = 'fisier' and storage_path is not null and url is null) or
        (fel = 'link'   and url is not null and storage_path is null)
    )
);

comment on table public.teren_atasamente is
    'Documentele adunate de un grup despre un teren, într-un singur loc: extrase de carte funciară, certificate de urbanism, planuri, oferte. Un rând e ori un fișier urcat în bucketul privat teren-documente, ori un link către altundeva (Drive, ANCPI). Înlocuiește căutarea prin firul de anunțuri, unde documentele erau agățate de câte un mesaj.';

comment on column public.teren_atasamente.fel is
    'fisier = urcat la noi, în teren-documente; link = ținut în altă parte. Al doilea nu e o soluție de mâna a doua: grupurile lucrează deja pe Drive, iar ce lipsea era lista, nu locul de stocare. Un link se poate strica fără să anunțe pe nimeni, de aceea felul se scrie pe rând și se vede în pagină.';

comment on column public.teren_atasamente.storage_path is
    'Calea în bucketul teren-documente, de forma {grup_id}/{teren_id}/{timestamp}_{nume}. Primul folder e grup_id, ca politica de citire să fie o singură comparație, la fel ca la checklist-files.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Legăturile și indexul
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Când selectezi cu mouse-ul, pornește de la `do $$`, NU de la `begin`.

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'teren_atasamente_grup_fk') then
        alter table public.teren_atasamente add constraint teren_atasamente_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'teren_atasamente_teren_fk') then
        alter table public.teren_atasamente add constraint teren_atasamente_teren_fk
            foreign key (teren_id) references public.terenuri(id) on delete cascade;
    end if;
end $$;

-- Cine a adăugat rămâne pe `set null`: dacă omul își șterge contul, documentul
-- rămâne (grupul chiar îl are), doar numele de lângă el dispare.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'teren_atasamente_user_fk') then
        alter table public.teren_atasamente add constraint teren_atasamente_user_fk
            foreign key (adaugat_de) references auth.users(id) on delete set null;
    end if;
end $$;

create index if not exists teren_atasamente_grup_teren_idx
    on public.teren_atasamente (grup_id, teren_id, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Cine vede și cine scrie
-- ───────────────────────────────────────────────────────────────────────────
-- Membrii activi ai grupului și fondatorul lui. Același tipar dovedit pe
-- `grup_teren_checklist`, citit direct din `grup_membri`.
--
-- ⭐ ȘTERGEREA E DOAR A CELUI CARE A ADĂUGAT, sau a fondatorului. Spre deosebire
--    de suprafețele apartamentelor, care sunt ale grupului și le mișcă oricine,
--    un document e pus de un om anume și n-are de ce să îl șteargă altcineva
--    din greșeală. Fondatorul rămâne, ca să existe cineva care poate face
--    curat.

alter table public.teren_atasamente enable row level security;

drop policy if exists ta_select_membri on public.teren_atasamente;
create policy ta_select_membri on public.teren_atasamente
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = teren_atasamente.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = teren_atasamente.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists ta_insert_membri on public.teren_atasamente;
create policy ta_insert_membri on public.teren_atasamente
    for insert to authenticated
    with check (
        adaugat_de = auth.uid()
        and (
            exists (select 1 from public.grup_membri m
                     where m.grup_id = teren_atasamente.grup_id
                       and m.user_id = auth.uid()
                       and m.status::text = 'activ')
            or exists (select 1 from public.grupuri g
                        where g.id = teren_atasamente.grup_id
                          and g.admin_id = auth.uid())
        )
    );

drop policy if exists ta_update_propriu on public.teren_atasamente;
create policy ta_update_propriu on public.teren_atasamente
    for update to authenticated
    using (adaugat_de = auth.uid())
    with check (adaugat_de = auth.uid());

drop policy if exists ta_delete_propriu on public.teren_atasamente;
create policy ta_delete_propriu on public.teren_atasamente
    for delete to authenticated
    using (
        adaugat_de = auth.uid()
        or exists (select 1 from public.grupuri g
                    where g.id = teren_atasamente.grup_id
                      and g.admin_id = auth.uid())
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Drepturile pe tabelă
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Se revocă ȘI de la `authenticated`, ÎNAINTE de grant: în Supabase tabelele
--    noi vin cu drepturi depline, iar `revoke ... from public` nu acoperă
--    `authenticated`, care e rol separat. Fără rândul acela, tabela rămâne cu
--    TRUNCATE dat utilizatorilor logați, iar TRUNCATE nu e atins de RLS.

revoke all on public.teren_atasamente from anon, public, authenticated;
grant select, insert, update, delete on public.teren_atasamente to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — Bucketul, privat
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ `public = false`, ca la `analize-fise` și spre deosebire de toate cele
--    patru bucketuri vechi. Un bucket public se servește și pe ruta
--    /storage/v1/object/public/..., care NU trece prin RLS: cine are odată
--    URL-ul descarcă documentul oricând, inclusiv după ce a fost scos din grup.
--    Aici sunt extrase de carte funciară, deci nu.
--
-- 25 MB per fișier: un extras cu planuri scanate trece de 10, dar n-are de ce
-- să treacă de 25. Tipurile acceptate acoperă ce trimit notarii și agenții.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teren-documente', 'teren-documente', false, 26214400,
        array['application/pdf','image/jpeg','image/png','image/webp',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

update storage.buckets set public = false where id = 'teren-documente';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 6 — Cine ajunge la fișiere
-- ───────────────────────────────────────────────────────────────────────────
-- Calea e {grup_id}/{teren_id}/{timestamp}_{nume}, deci `grup_id` e primul
-- folder și politica e o singură comparație, ca la `checklist-files`.
--
-- ⚠️ Politica de INSERT cere apartenența la grup, spre deosebire de cea de pe
--    `checklist-files`, care e doar `bucket_id = 'checklist-files'`: acolo orice
--    om logat poate urca un fișier în folderul oricărui grup. Nu copiem asta.

drop policy if exists "Membrii citesc documentele terenului" on storage.objects;
create policy "Membrii citesc documentele terenului"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'teren-documente'
        and (
            is_super_admin()
            or exists (select 1 from public.grupuri g
                        where g.id::text = (storage.foldername(name))[1]
                          and g.admin_id = auth.uid())
            or exists (select 1 from public.grup_membri m
                        where m.grup_id::text = (storage.foldername(name))[1]
                          and m.user_id = auth.uid()
                          and m.status::text = 'activ')
        )
    );

drop policy if exists "Membrii urca documente de teren" on storage.objects;
create policy "Membrii urca documente de teren"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'teren-documente'
        and (
            exists (select 1 from public.grupuri g
                     where g.id::text = (storage.foldername(name))[1]
                       and g.admin_id = auth.uid())
            or exists (select 1 from public.grup_membri m
                        where m.grup_id::text = (storage.foldername(name))[1]
                          and m.user_id = auth.uid()
                          and m.status::text = 'activ')
        )
    );

-- Ștergerea din storage urmează rândul din tabelă: poate șterge cine a adăugat.
drop policy if exists "Cine a urcat sterge documentul" on storage.objects;
create policy "Cine a urcat sterge documentul"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'teren-documente'
        and exists (select 1 from public.teren_atasamente t
                     where t.storage_path = storage.objects.name
                       and (t.adaugat_de = auth.uid()
                            or exists (select 1 from public.grupuri g
                                        where g.id = t.grup_id and g.admin_id = auth.uid())))
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 7 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Arată că lucrurile ARATĂ cum trebuie. NU arată că RLS-ul refuză pe cineva:
--    în SQL Editor ești `postgres`, `auth.uid()` e NULL și politicile nici nu te
--    ating. Proba adevărată se dă din pagină, logat, cu un cont care NU e în
--    grup, plus o cerere pe ruta publică (care trebuie să dea eroare).

select 'a. tabela'      as sectiune, c.relname::text as nume,
       ('RLS: ' || c.relrowsecurity::text) as detaliu
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'teren_atasamente'

union all

select 'b. politici tabela' as sectiune, policyname::text as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies where schemaname = 'public' and tablename = 'teren_atasamente'

union all

select 'c. drepturi'    as sectiune, grantee::text as nume, privilege_type::text as detaliu
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'teren_atasamente'
  and grantee in ('anon','authenticated','public')

union all

select 'd. bucket'      as sectiune, id::text as nume,
       case when public then 'PUBLIC (GRESIT)' else 'privat (corect)' end as detaliu
from storage.buckets where id = 'teren-documente'

union all

select 'e. politici storage' as sectiune, policyname::text as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies where schemaname = 'storage' and tablename = 'objects'
  and (policyname like '%documentele terenului%' or policyname like '%documente de teren%'
       or policyname like '%sterge documentul%')

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): un rând, `RLS: true`.
--   • (b): patru politici, toate pe `authenticated`.
--   • (c): `anon` NU trebuie să apară. `authenticated` are exact SELECT,
--     INSERT, UPDATE, DELETE. Dacă apare TRUNCATE, REVOKE-ul n-a prins.
--   • (d): `privat (corect)`.
--   • (e): trei politici, toate pe `authenticated`.

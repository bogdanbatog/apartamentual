-- ═══════════════════════════════════════════════════════════════════════════
-- PAȘII DE VERIFICARE, BIFAȚI PE FIECARE TEREN ÎN PARTE
-- 22 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: un rând per (grup, teren, pas). Un grup se uită la trei-patru terenuri
-- deodată și face pe fiecare aceiași șapte pași: analiza preliminară, vizita,
-- extrasul de carte funciară, notarul, certificatul de urbanism, studiul
-- geotehnic, acordul vecinilor de la calcan. „Am extrasul de carte funciară"
-- e adevărat despre UN teren, nu despre grup.
--
-- DE CE ACUM: bifele de grup au ieșit din pagină pe 22 august (decizia lui
-- Lucian: „ăștia sunt pași informativi, nu bifezi doar ca să știi pe unde
-- ești"). Tabela veche `grup_checklist` rămâne neatinsă, cu tot ce era în ea,
-- dar nimeni nu mai scrie în ea. Aici se bifează de acum înainte, unde bifa
-- chiar înseamnă ceva.
--
-- CE ATINGE SCRIPTUL: doar lucruri NOI. O tabelă nouă, legăturile ei, patru
-- politici pe ea, granturi pe ea. ZERO atingeri la `grupuri`, `grup_membri`,
-- `terenuri`, `grup_checklist`, la politicile existente, la plăți.
--
-- CE NU ARE NEVOIE DE TABELĂ: notele și fișierele puse pe un pas de teren. Ele
-- se scriu în `grup_checklist_notes` și `grup_checklist_files`, cele care
-- există deja, cu o cheie compusă de forma
--
--     t-<id-ul terenului>-<cheia pasului>
--     t-9f8c1e3a-...-carte-funciara
--
-- Așa moștenesc politicile care le închid deja pe membrii grupului, iar codul
-- de note și atașamente din pagina grupului rămâne neschimbat. BLOC 0 verifică
-- singurul lucru care ar putea strica planul ăsta: lungimea coloanei `step_key`.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în fișierul ăsta. Editorul SQL din Supabase
--    rulează tot tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă"
--    anulează tăcut și granturile de deasupra lui.
--
-- ✅ BLOC 0 RULAT PE 23 AUGUST, răspunsurile sunt scrise la BLOC 3. Din ele au
--    ieșit două decizii: politicile citesc direct din `grup_membri` (nu prin
--    funcție), iar BLOC 5 NU se mai rulează.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND, în ordinea 1 → 2 → 3 → 4 → 6. BLOC 5 se sare.
--
-- ORDINEA FAȚĂ DE RESTUL: fișierul ăsta → îmi trimiți rezultatul BLOC 6 → abia
-- apoi se urcă frontendul pe cPanel. Pagina grupului deja are lista de pași
-- scrisă; fără tabelă, ea se vede nebifată și orice bifă dă „Nu am putut salva
-- bifa".
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Patru lucruri de confirmat:
--
--   (a) `grup_teren_checklist` NU există deja. `create table if not exists` ar
--       trece tăcut peste o tabelă străină cu același nume.
--   (b) ⭐ CE FUNCȚIE DE MEMBRU EXISTĂ. Politicile din BLOC 3 cheamă
--       `is_group_member(grup_id, user_id)`, numele scris în
--       `db_schema/README_GROUPS.md`. Dacă lista întoarsă nu conține exact
--       funcția asta, cu două argumente `uuid`, OPREȘTE-TE și trimite-mi
--       rezultatul: politicile se rescriu, nu se ghicesc.
--   (c) CE POLITICI ARE SORA EI, `grup_checklist`. Le copiem forma, ca pașii de
--       teren să fie închiși exact ca pașii de grup, nici mai strâns, nici mai
--       larg.
--   (d) ⭐ LUNGIMEA LUI `step_key` în tabelele de note și fișiere. Cheia compusă
--       are până la 58 de caractere. Dacă tipul e `text` sau un `varchar` de
--       cel puțin 80, totul e în regulă și BLOC 5 nu se rulează. Dacă e mai
--       scurt, se rulează BLOC 5.
--
-- ⚠️ Interogările sunt unite cu UNION ALL dinadins: editorul SQL din Supabase
--    arată DOAR rezultatul ultimei interogări dintr-un tab.

select 'a. exista deja?'            as sectiune,
       c.relname::text              as nume,
       ''                           as detaliu,
       ''                           as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'grup_teren_checklist'

union all

select 'b. functii de membru'       as sectiune,
       p.proname::text              as nume,
       pg_get_function_arguments(p.oid)::text as detaliu,
       pg_get_function_result(p.oid)::text    as detaliu2
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_group_member', 'este_membru_grup', 'este_admin_grup',
                    'is_group_owner', 'can_manage_group', 'is_super_admin')

union all

select 'c. politicile surorii'      as sectiune,
       policyname::text             as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       coalesce(qual, with_check, '')::text  as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'grup_checklist'

union all

select 'd. lungimea step_key'       as sectiune,
       (table_name || '.' || column_name)::text as nume,
       data_type::text              as detaliu,
       coalesce(character_maximum_length::text, 'fără limită') as detaliu2
from information_schema.columns
where table_schema = 'public'
  and column_name = 'step_key'
  and table_name in ('grup_checklist', 'grup_checklist_notes', 'grup_checklist_files')

union all

select 'e. tipul id-urilor'         as sectiune,
       (table_name || '.' || column_name)::text as nume,
       data_type::text              as detaliu,
       ''                           as detaliu2
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'grupuri'  and column_name = 'id')
    or (table_name = 'terenuri' and column_name = 'id'))

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): NU trebuie să apară niciun rând. Dacă apare, oprește-te.
--   • (b): trebuie să apară `is_group_member` cu `p_grup_id uuid, p_user_id uuid`
--     (sau nume asemănătoare). Dacă nu apare deloc, oprește-te și trimite-mi
--     lista. NU rula BLOC 3 pe ghicite: o politică ce cheamă o funcție
--     inexistentă crapă toată interogarea, nu întoarce „fals".
--   • (c): dacă `grup_checklist` are politici pe rolul `public` în loc de
--     `authenticated`, spune-mi. Aici scriem `authenticated`, care e mai strâns.
--   • (d): vezi mai sus. `text` = perfect.
--   • (e): amândouă trebuie să fie `uuid`.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Tabela
-- ───────────────────────────────────────────────────────────────────────────
-- Cheia primară e tripleta (grup, teren, pas), nu o coloană `id` separată:
--
--   • baza garantează singură că nu se adună două rânduri pentru același pas
--     al aceluiași teren, oricâți membri apasă deodată;
--   • pagina grupului scrie printr-un `upsert` pe tripleta asta. Fără cheia
--     compusă, `upsert` n-are pe ce se sprijini și PostgREST refuză cererea.
--     ⚠️ Frontendul cere explicit `onConflict: 'grup_id,teren_id,step_key'`;
--     PostgREST nu ghicește cheia compusă. E scris în `grup-details.html`,
--     funcția `toggleTerenStep`.
--
-- `step_key` e text liber, nu o listă închisă de valori. Lista pașilor stă în
-- `js/pasi-din-ghid.js` (`PASI_TEREN`) și se va mai schimba; o constrângere
-- CHECK aici ar însemna o migrație la fiecare pas adăugat, iar paguba maximă a
-- unei chei scrise greșit e un rând care nu se citește de nicăieri.
--
-- `checked_at` și `checked_by` sunt goale când bifa e scoasă: ora și omul se
-- referă la bifare, nu la ultima atingere. Cine a atins ultima oară rândul se
-- vede oricum în `updated_at`.

create table if not exists public.grup_teren_checklist (
    grup_id    uuid        not null,
    teren_id   uuid        not null,
    step_key   text        not null,
    checked    boolean     not null default false,
    checked_at timestamptz,
    checked_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (grup_id, teren_id, step_key)
);

comment on table public.grup_teren_checklist is
    'Pașii de verificare bifați pe fiecare teren al unui grup (vizita, cartea funciară, notarul, certificatul de urbanism, studiul geotehnic, vecinii de la calcan, plus analiza preliminară). Un rând per (grup, teren, pas), scris prin upsert din grup-details.html. Lista pașilor stă în js/pasi-din-ghid.js, PASI_TEREN. Înlocuiește bifele de grup din grup_checklist, care au ieșit din interfață pe 22 august 2026 și au rămas în bază ca plasă de siguranță.';

comment on column public.grup_teren_checklist.step_key is
    'Cheia pasului din PASI_TEREN (js/pasi-din-ghid.js): analiza-prelim, vizita, carte-funciara, notar, certificat-urbanism, geotehnic, vecini-calcan.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Legăturile (rulează-l separat)
-- ───────────────────────────────────────────────────────────────────────────
-- Fac curat singure: la ștergerea unui grup sau a unui teren dispar și bifele.
-- `checked_by` NU are `on delete cascade`, ci `set null`: dacă omul care a
-- bifat își șterge contul, bifa rămâne (grupul chiar a făcut pasul), doar
-- numele de lângă ea dispare.
--
-- Legătura către `auth.users` e pusă separat, ca la `grup_vizite`: dacă
-- proiectul nu permite chei străine către schema `auth`, blocul dă eroare și
-- pur și simplu nu-l rulezi. Tabela funcționează și fără el.
--
-- ⚠️ Când selectezi cu mouse-ul, pornește de la `do $$`, NU de la `begin`.
--    O selecție care lasă `do $$` afară dă o eroare care arată ca o greșeală de
--    cod, dar e una de copiere.

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'grup_teren_checklist_grup_fk'
          and conrelid = 'public.grup_teren_checklist'::regclass
    ) then
        alter table public.grup_teren_checklist
            add constraint grup_teren_checklist_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'grup_teren_checklist_teren_fk'
          and conrelid = 'public.grup_teren_checklist'::regclass
    ) then
        alter table public.grup_teren_checklist
            add constraint grup_teren_checklist_teren_fk
            foreign key (teren_id) references public.terenuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'grup_teren_checklist_user_fk'
          and conrelid = 'public.grup_teren_checklist'::regclass
    ) then
        alter table public.grup_teren_checklist
            add constraint grup_teren_checklist_user_fk
            foreign key (checked_by) references auth.users(id) on delete set null;
    end if;
end $$;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Cine vede ce (RLS)
-- ───────────────────────────────────────────────────────────────────────────
-- ✅ BLOC 0 A FOST RULAT PE 23 AUGUST 2026. Ce a întors:
--    (a) `grup_teren_checklist` nu există. Drum liber.
--    (b) `is_group_member(p_grup_id uuid, p_user_id uuid)` EXISTĂ, plus
--        `este_admin_grup`, `is_group_owner`, `can_manage_group`.
--    (c) politicile lui `grup_checklist` NU cheamă funcția aceea. Citesc direct
--        din `grup_membri`, cu un `exists`, iar cea de SELECT cere în plus
--        `status = 'activ'`.
--    (d) `step_key` e `text`, fără limită, în toate trei tabelele. Cheia
--        compusă încape. BLOC 5 NU se rulează.
--    (e) `grupuri.id` și `terenuri.id` sunt amândouă `uuid`.
--
-- ⚠️ DE CE NU FOLOSIM `is_group_member()`, deși există. Nu-i știm corpul: nu se
--    vede din inventar dacă e `security definer`. Dacă NU e, funcția citește
--    `grup_membri` sub RLS-ul cui întreabă, iar `grup_membri` e o tabelă închisă
--    din 2 august. Ar întoarce `false` pentru un membru adevărat, politica ar
--    tăcea, iar lista de bife s-ar goli fără nicio eroare, exact tipul de
--    defecțiune care se caută două zile.
--    Mai jos e copiat, în schimb, EXACT tiparul care merge azi pe `grup_checklist`
--    (răspunsul (c) de mai sus). E dovedit în producție de luni de zile.
--    Dacă vreodată confirmăm că funcția e `security definer`, politicile astea
--    se pot scurta la un singur apel.
--
-- Regula, în cuvinte: bifele unui teren se văd și se pun de membrii ACTIVI ai
-- grupului, plus de adminul lui. Nimeni altcineva, nici măcar cine vede terenul
-- pe site: ce a verificat un grup e treaba lui.
--
-- ⚠️ DOUĂ LUCRURI ÎN CARE SUNTEM MAI STRICȚI DECÂT SORA EI:
--    · politicile ei de INSERT și UPDATE sunt pe rolul `public`, adică includ
--      și `anon`. Ale noastre sunt `to authenticated`.
--    · politicile ei de INSERT și UPDATE nu cer `status = 'activ'`, deci cineva
--      cu cererea încă neaprobată putea bifa. Aici se cere peste tot.
--
-- Nu există politică de superadmin, dinadins. Nimeni de la platformă n-are
-- nevoie să știe dacă un grup și-a luat extrasul de carte funciară. Cel mai
-- sigur tip de politică e cel care nu există.

alter table public.grup_teren_checklist enable row level security;

drop policy if exists gtc_select_membri on public.grup_teren_checklist;
create policy gtc_select_membri on public.grup_teren_checklist
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_checklist.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_checklist.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists gtc_insert_membri on public.grup_teren_checklist;
create policy gtc_insert_membri on public.grup_teren_checklist
    for insert to authenticated
    with check (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_checklist.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_checklist.grup_id
                      and g.admin_id = auth.uid())
    );

-- `using` = pe ce rânduri am voie să pun mâna; `with check` = cum au voie să
-- arate DUPĂ modificare. Fără al doilea, un membru ar putea muta un rând pe
-- `grup_id`-ul altui grup.
drop policy if exists gtc_update_membri on public.grup_teren_checklist;
create policy gtc_update_membri on public.grup_teren_checklist
    for update to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_checklist.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_checklist.grup_id
                      and g.admin_id = auth.uid())
    )
    with check (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_checklist.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_checklist.grup_id
                      and g.admin_id = auth.uid())
    );

-- DELETE există fiindcă un teren scos de la favorite lasă bife orfane, iar
-- membrii trebuie să le poată curăța. Bifa scoasă din pagină NU șterge rândul,
-- doar îl trece pe `checked = false`: se păstrează cine și când, ca la note.
drop policy if exists gtc_delete_membri on public.grup_teren_checklist;
create policy gtc_delete_membri on public.grup_teren_checklist
    for delete to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_teren_checklist.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_teren_checklist.grup_id
                      and g.admin_id = auth.uid())
    );


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Drepturile pe tabelă
-- ───────────────────────────────────────────────────────────────────────────
-- RLS spune CARE RÂNDURI, granturile spun DACĂ AI VOIE SĂ ATINGI TABELA. Sunt
-- două lucruri diferite și trebuie amândouă: cu politici perfecte și fără
-- grant, bifatul din pagină primește „permission denied for table
-- grup_teren_checklist".
--
-- `anon` nu primește nimic. `revoke` e scris explicit fiindcă în Supabase
-- tabelele noi vin cu drepturi depline: un GRANT scris după nu restrânge
-- nimic, doar REVOKE.
--
-- ⚠️ SE REVOCĂ ȘI DE LA `authenticated`, ÎNAINTE de grant. `revoke ... from
--    public` NU acoperă `authenticated`: e un rol separat, care își primește
--    drepturile direct. Fără rândul ăsta, tabela rămâne cu TRUNCATE dat
--    utilizatorilor logați, iar TRUNCATE nu e atins de RLS: ar șterge bifele
--    TUTUROR grupurilor dintr-o dată.

revoke all on public.grup_teren_checklist from anon;
revoke all on public.grup_teren_checklist from public;
revoke all on public.grup_teren_checklist from authenticated;

grant select, insert, update, delete on public.grup_teren_checklist to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — ❌ NU SE RULEAZĂ (verificat pe 23 august)
-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 (d) a arătat `text`, fără limită, în toate trei tabelele. Cheia
-- compusă de 58 de caractere încape fără nicio schimbare. Blocul rămâne aici
-- doar ca urmă a verificării.
--
-- Notele și fișierele unui pas de teren se scriu în tabelele existente, cu o
-- cheie compusă de până la 58 de caractere („t-" + uuid + "-" + numele
-- pasului). Dacă `step_key` e un `varchar` scurt, inserarea eșuează cu „value
-- too long for type character varying(N)" — o eroare care în pagină arată ca
-- „nu se salvează nota", fără să spună de ce.
--
-- ⚠️ Schimbarea e pe TABELE EXISTENTE, deci NU se rulează din reflex. Rulează
--    doar dacă BLOC 0 a arătat o limită, și spune-mi înainte.
--
-- alter table public.grup_checklist_notes alter column step_key type text;
-- alter table public.grup_checklist_files alter column step_key type text;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 6 — VERIFICARE STRUCTURALĂ (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Blocul arată că tabela ARATĂ cum trebuie. NU arată că RLS-ul chiar refuză
--    pe cineva: în SQL Editor ești `postgres`, `auth.uid()` e NULL și
--    politicile nici nu te ating. Proba adevărată se dă din pagină, logat, cu
--    un cont care NU e în grup.

select 'a. coloane'                as sectiune,
       column_name::text           as nume,
       data_type::text             as detaliu,
       (is_nullable || ' / ' || coalesce(column_default, 'fără'))::text as detaliu2
from information_schema.columns
where table_schema = 'public' and table_name = 'grup_teren_checklist'

union all

select 'b. cheia primara'          as sectiune,
       a.attname::text             as nume,
       'PK'                        as detaliu,
       ''                          as detaliu2
from pg_constraint c
join unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.conrelid = 'public.grup_teren_checklist'::regclass and c.contype = 'p'

union all

select 'c. politici'               as sectiune,
       policyname::text            as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       coalesce(qual, with_check, '')::text as detaliu2
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_checklist'

union all

select 'd. drepturi'               as sectiune,
       grantee::text               as nume,
       privilege_type::text        as detaliu,
       ''                          as detaliu2
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_checklist'
  and grantee in ('anon', 'authenticated', 'public', 'service_role')

union all

select 'e. RLS pornit?'            as sectiune,
       c.relname::text             as nume,
       c.relrowsecurity::text      as detaliu,
       ''                          as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'grup_teren_checklist'

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): opt coloane, `grup_id`/`teren_id`/`step_key` NOT NULL.
--   • (b): trei rânduri, tripleta.
--   • (c): patru politici, toate pe rolul `authenticated`.
--   • (d): `anon` NU trebuie să apară deloc. `authenticated` are exact
--     SELECT, INSERT, UPDATE, DELETE. Dacă apare TRUNCATE sau REFERENCES,
--     REVOKE-ul din BLOC 4 n-a prins, spune-mi.
--   • (e): `true`.

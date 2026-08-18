-- ═══════════════════════════════════════════════════════════════════════════
--  PROBA CARE CHIAR DOVEDEȘTE CEVA — vizitele pe grup (`grup_vizite`)
--  ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN FOC, ÎNTR-UN TAB NOU ȘI GOL.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  DE CE E NEVOIE DE EA: verificarea din `1-tabela-vizite.sql` arată că
--  politicile EXISTĂ și sunt scrise corect. Nu arată că REFUZĂ pe cineva. În
--  SQL Editor ești `postgres`: `auth.uid()` e NULL și RLS-ul nici nu te atinge,
--  deci orice scriere de acolo „merge" și nu dovedește nimic.
--
--  Ce dovedește fișierul ăsta, în ordinea importanței:
--    1. omul își poate scrie vizita, iar ora o pune baza (triggerul), nu
--       browserul — inclusiv la a doua deschidere, care trebuie să ACTUALIZEZE
--       rândul, nu să adauge unul nou
--    2. ⭐ omul NU vede vizitele altuia
--    3. omul NU poate scrie o vizită pe numele altuia
--    4. vizitatorul nelogat nu ajunge deloc la tabelă
--
--  CUM FUNCȚIONEAZĂ: scriptul se dă drept doi utilizatori reali, pe rând
--  (`set role` + `request.jwt.claims`, exact ce trimite platforma în locul
--  tău). Conturile și grupul se aleg singure, nu copiezi niciun UUID.
--
--  ⚠️ DE CE NU FOLOSEȘTE TABELE TEMPORARE pentru rezultate: după `set role`,
--     accesul la schema temporară a sesiunii nu e garantat, iar scriptul ar fi
--     picat pe o eroare care n-are legătură cu ce vrem să aflăm. Rezultatele se
--     strâng în setări de sesiune (`proba.*`), care se citesc de orice rol.
--
--  ⚠️ SE SCRIE ÎN BAZĂ, în contul a doi oameni reali. Rândurile scrise sunt
--     doar ore de vizită, nimic ce vede vreun utilizator, și se șterg la
--     finalul scriptului; penultimul rând din rezultat („Curățenie") arată câte
--     au rămas. Trebuie să fie 0.
--
--  ⚠️ NU pune BEGIN/ROLLBACK în tab. Un ROLLBACK ar anula și curățenia, și ar
--     ascunde tabelul de rezultate (editorul arată doar ultimul rezultat).
--
--  CE ÎNSEAMNĂ O EROARE: dacă scriptul se oprește cu eroare în loc să întoarcă
--  tabelul, NU trece mai departe — e chiar ce voiam să aflăm. Trimite-mi
--  eroarea așa cum e.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── pregătire ──────────────────────────────────────────────────────────────
-- Revenire la rolul meu, ÎNAINTE de orice. Dacă o rulare anterioară s-a oprit
-- la jumătate, sesiunea poate fi rămasă pe `authenticated`, iar ștergerea de
-- mai jos ar pica pe „permission denied" — o eroare care n-are nicio legătură
-- cu ce probăm. Rulate din postgres, cele două rânduri nu schimbă nimic.
reset role;
select set_config('request.jwt.claims', '', false);

-- Doi oameni reali și un grup real. Grupul trebuie să existe cu adevărat:
-- dacă ai rulat BLOC 2 din fișierul precedent, cheia străină refuză un
-- `grup_id` inventat.
select set_config('proba.x', (array_agg(u.id order by u.created_at desc))[1]::text, false),
       set_config('proba.y', (array_agg(u.id order by u.created_at desc))[2]::text, false)
from auth.users u;

select set_config('proba.g', (array_agg(g.id order by g.created_at desc))[1]::text, false)
from public.grupuri g;

-- Curățenie de siguranță, dacă o rulare anterioară s-a oprit la jumătate.
delete from public.grup_vizite
where user_id in (current_setting('proba.x')::uuid, current_setting('proba.y')::uuid)
  and grup_id = current_setting('proba.g')::uuid;

-- Vizita lui Y, pusă de la `postgres` (ocolește RLS, deci sigur intră). E
-- rândul pe care X nu trebuie să-l vadă.
insert into public.grup_vizite (user_id, grup_id)
values (current_setting('proba.y')::uuid, current_setting('proba.g')::uuid)
on conflict (user_id, grup_id) do update set vazut_la = now();


-- ── de aici încolo sunt X ──────────────────────────────────────────────────
select set_config('request.jwt.claims',
       json_build_object('sub', current_setting('proba.x'),
                         'role', 'authenticated')::text, false);
set role authenticated;


-- 1. Câte rânduri vede X în toată tabela ÎNAINTE să scrie ceva.
--    ⭐ Trebuie să fie 0: rândul lui Y există, dar nu e al lui.
select set_config('proba.p1', count(*)::text || ' rând(uri) vizibile', false)
from public.grup_vizite;


-- 2. X își scrie vizita. Exact ce face pagina grupului la deschidere: upsert pe
--    perechea (user_id, grup_id), FĂRĂ să trimită `vazut_la`.
insert into public.grup_vizite (user_id, grup_id)
values (current_setting('proba.x')::uuid, current_setting('proba.g')::uuid)
on conflict (user_id, grup_id) do update set vazut_la = now();

select set_config('proba.p2',
       case when count(*) = 1 then 'DA, un rând, ora pusă de bază: ' || max(vazut_la)::text
            else '🔴 NU (' || count(*)::text || ' rânduri)' end, false)
from public.grup_vizite
where user_id = current_setting('proba.x')::uuid;


-- 3. A doua deschidere a aceleiași pagini. Trebuie să ACTUALIZEZE rândul, nu să
--    adauge al doilea. Dacă adaugă, tabela crește cu fiecare clic la nesfârșit.
--    ⚠️ Se trimite dinadins o oră din trecut, ca browserului unui om cu ceasul
--    rămas în urmă: triggerul trebuie s-o ignore.
insert into public.grup_vizite (user_id, grup_id, vazut_la)
values (current_setting('proba.x')::uuid, current_setting('proba.g')::uuid,
        now() - interval '30 days')
on conflict (user_id, grup_id) do update set vazut_la = excluded.vazut_la;

select set_config('proba.p3',
       case when count(*) <> 1 then '🔴 NU, s-au adunat ' || count(*)::text || ' rânduri'
            when max(vazut_la) > now() - interval '1 minute'
                 then 'DA, tot un rând, iar ora din trecut a fost ignorată'
            else '🔴 un rând, dar ora trimisă de browser a intrat în bază' end, false)
from public.grup_vizite
where user_id = current_setting('proba.x')::uuid;


-- 4. ⭐ Vede X vizita lui Y? Trebuie să nu.
select set_config('proba.p4',
       case when count(*) = 0 then 'NU (bine)'
            else '🔴 DA — ' || count(*)::text || ' rând(uri) străine' end, false)
from public.grup_vizite
where user_id = current_setting('proba.y')::uuid;


-- 5. Poate X să scrie o vizită pe numele lui Y? Trebuie să fie refuzat.
--    Eroarea se prinde, ca scriptul să meargă mai departe și să întoarcă
--    tabelul: aici o eroare e rezultatul bun, nu o defecțiune.
do $$
begin
    insert into public.grup_vizite (user_id, grup_id)
    values (current_setting('proba.y')::uuid,
            (current_setting('proba.g')::uuid))
    on conflict (user_id, grup_id) do update set vazut_la = now();
    perform set_config('proba.p5', '🔴 A REUȘIT — poate scrie pe numele altuia', false);
exception when others then
    perform set_config('proba.p5', 'refuzat (bine): ' || sqlerrm, false);
end $$;


-- ── acum sunt vizitatorul nelogat ──────────────────────────────────────────
reset role;
select set_config('request.jwt.claims',
       json_build_object('role', 'anon')::text, false);
set role anon;

do $$
declare n integer;
begin
    select count(*) into n from public.grup_vizite;
    perform set_config('proba.p6', '🔴 VEDE ' || n::text || ' rânduri', false);
exception when others then
    perform set_config('proba.p6', 'refuzat (bine): ' || sqlerrm, false);
end $$;


-- ── curățenie și rezultat ──────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', false);

delete from public.grup_vizite
where user_id in (current_setting('proba.x')::uuid, current_setting('proba.y')::uuid)
  and grup_id = current_setting('proba.g')::uuid;

select '1. X vede la început'            as proba, current_setting('proba.p1') as rezultat
union all select '2. X își scrie vizita',        current_setting('proba.p2')
union all select '3. a doua deschidere',         current_setting('proba.p3')
union all select '4. ⭐ X vede vizita lui Y',    current_setting('proba.p4')
union all select '5. X scrie pe numele lui Y',   current_setting('proba.p5')
union all select '6. nelogatul vede tabela',     current_setting('proba.p6')
union all select 'Curățenie (trebuie 0)',
       (select count(*)::text || ' rând(uri) de probă rămase'
          from public.grup_vizite
         where user_id in (current_setting('proba.x')::uuid, current_setting('proba.y')::uuid)
           and grup_id = current_setting('proba.g')::uuid);

-- CE TREBUIE SĂ SCRIE:
--   1. „0 rând(uri) vizibile"
--   2. „DA, un rând, ora pusă de bază: <acum>"
--   3. „DA, tot un rând, iar ora din trecut a fost ignorată"
--   4. „NU (bine)"           ← dacă scrie 🔴 DA, OPREȘTE-TE și spune-mi
--   5. „refuzat (bine): new row violates row-level security policy..."
--   6. „refuzat (bine): permission denied for table grup_vizite"
--   Curățenie: „0 rând(uri) de probă rămase"
--
-- Orice 🔴 înseamnă că frontendul NU se publică până nu înțelegem de ce.

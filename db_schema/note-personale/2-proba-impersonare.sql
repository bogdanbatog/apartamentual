-- ═══════════════════════════════════════════════════════════════════════════
--  PROBA CARE CHIAR DOVEDEȘTE CEVA — notele personale (`user_notes`)
--  ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN FOC, ÎNTR-UN TAB NOU ȘI GOL.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  DE CE E NEVOIE DE EA: verificările din `1-baza.sql` și `1b-completari.sql`
--  arată că politicile EXISTĂ și sunt scrise corect. Nu arată că REFUZĂ pe
--  cineva. În SQL Editor ești `postgres`: `auth.uid()` e NULL și RLS-ul nici
--  nu te atinge, deci orice scriere de acolo „merge" și nu dovedește nimic.
--
--  Ce dovedește fișierul ăsta, în ordinea importanței:
--    1. omul își poate SCRIE nota, iar ora de salvare o pune baza (triggerul)
--    2. ⭐ omul NU vede nota altuia — altfel e o scurgere de date private
--    3. omul NU poate scrie nici peste nota altuia, nici pe numele lui
--    4. vizitatorul nelogat nu ajunge deloc la tabelă
--
--  CUM FUNCȚIONEAZĂ: scriptul se dă drept doi utilizatori reali, pe rând
--  (`set role` + `request.jwt.claims`, exact ce trimite platforma în locul
--  tău). Conturile se aleg singure, nu mai copiezi UUID-uri.
--
--  ⚠️ DE CE NU FOLOSEȘTE TABELE TEMPORARE pentru rezultate: după `set role`,
--     accesul la schema temporară a sesiunii nu e garantat, iar scriptul ar fi
--     picat pe o eroare care n-are legătură cu ce vrem să aflăm. Rezultatele
--     se strâng în setări de sesiune (`proba.*`), care se citesc de orice rol.
--
--  ⚠️ SE SCRIE ÎN BAZĂ, în contul a doi oameni reali, dar toate rândurile de
--     probă încep cu „PROBĂ" și se șterg la finalul scriptului, iar penultimul
--     rând din rezultat („Curățenie") arată câte au rămas. Trebuie să fie 0.
--     Cardul nu e încă publicat, deci în intervalul ăsta nu le vede nimeni.
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
-- la jumătate, sesiunea poate fi rămasă pe `anon`, iar ștergerea de mai jos ar
-- pica pe „permission denied" — o eroare care n-are nicio legătură cu ce
-- probăm. Rulate din postgres, cele două rânduri nu schimbă nimic.
reset role;
select set_config('request.jwt.claims', '', false);

-- Curățenie de siguranță, dacă o rulare anterioară s-a oprit la jumătate.
delete from public.user_notes where content like 'PROBĂ%';

-- Două conturi reale, oricare două: politicile de pe `user_notes` nu se uită
-- la nimic din `profiles` (nici la admin, nici la profil complet), doar la
-- `auth.uid()`. De asta nu contează pe cine nimerește.
select set_config('proba.x', (array_agg(u.id order by u.created_at desc))[1]::text, false),
       set_config('proba.y', (array_agg(u.id order by u.created_at desc))[2]::text, false)
from auth.users u;


-- ── 1. nota lui X, pusă de la `postgres` (ocolește RLS, deci sigur intră) ───
insert into public.user_notes (user_id, content)
values (current_setting('proba.x')::uuid, 'PROBĂ secretul lui X')
on conflict (user_id) do update set content = excluded.content;


-- ── 2. de aici încolo sunt X ───────────────────────────────────────────────
select set_config('request.jwt.claims',
       json_build_object('sub', current_setting('proba.x'),
                         'role', 'authenticated')::text, false);
set role authenticated;

select set_config('proba.p1', count(*)::text || ' rând(uri)', false)
from public.user_notes;

-- Exact ce face cardul la salvare: upsert pe `user_id`, FĂRĂ să trimită
-- `updated_at`. Dacă ora iese „de acum", triggerul lucrează.
insert into public.user_notes (user_id, content)
values (current_setting('proba.x')::uuid, 'PROBĂ scrisă de X însuși')
on conflict (user_id) do update set content = excluded.content;

select set_config('proba.p2',
       content || ' / ' ||
       case when updated_at > now() - interval '2 minutes'
            then 'ora de ACUM ✅ (triggerul lucrează)'
            else '🔴 oră veche, triggerul NU lucrează' end, false)
from public.user_notes;


-- ── 3. de aici încolo sunt Y ───────────────────────────────────────────────
select set_config('request.jwt.claims',
       json_build_object('sub', current_setting('proba.y'),
                         'role', 'authenticated')::text, false);

-- ⭐ Fără niciun `where`: exact ce ar trimite un curios care cere toată tabela.
-- Dacă RLS-ul ține, întoarce gol chiar și așa.
select set_config('proba.p3', count(*)::text || ' rând(uri)', false)
from public.user_notes;

-- Y încearcă să scrie PESTE nota lui X. Nu dă eroare: politica îl scoate din
-- start dintre rândurile pe care are voie să pună mâna, deci pur și simplu nu
-- atinge nimic. De aceea se numără rândurile schimbate.
with incercare as (
    update public.user_notes
       set content = 'PROBĂ scris de Y peste nota lui X'
     where user_id = current_setting('proba.x')::uuid
    returning 1
)
select set_config('proba.p4', count(*)::text || ' rând(uri) schimbate', false)
from incercare;

-- Y încearcă să CREEZE o notă pe numele lui X. Aici trebuie să crape, deci
-- eroarea se prinde într-un bloc `do`, ca scriptul să meargă mai departe.
-- Se citește și codul erorii: 42501 = refuzat de RLS, adică exact motivul
-- corect. Alt cod ar însemna că a picat din alt motiv și proba n-ar dovedi ce
-- credem că dovedește.
--
-- ⚠️ Când selectezi blocul cu mouse-ul, pornește de la `do $$`, nu de la
--    `declare` sau `begin` — altfel eroarea arată ca o greșeală de cod, dar e
--    una de copiere. (De-aia se rulează tot fișierul dintr-un foc.)
do $$
declare a_mers boolean := false; cod text := '';
begin
    begin
        insert into public.user_notes (user_id, content)
        values (current_setting('proba.x')::uuid, 'PROBĂ scriu eu în locul lui X');
        a_mers := true;
    exception when others then
        cod := sqlstate;
    end;

    perform set_config('proba.p5',
            case when a_mers        then '🔴 A REUȘIT'
                 when cod = '42501' then 'refuzat de RLS ✅ (42501)'
                 else 'refuzat, dar cu alt cod: ' || cod end, false);
end $$;


-- ── 4. vizitatorul nelogat ─────────────────────────────────────────────────
-- `reset role` întâi: din `authenticated` nu se poate trece direct în `anon`.
reset role;
set role anon;

-- ⚠️ Numărătoarea e scrisă ca expresie, nu ca `select ... into <variabilă>`.
--    Forma cu `into` a picat pe 17 august cu „relation n does not exist":
--    citirea a fost luată drept `SELECT INTO`-ul din SQL simplu, care crează o
--    tabelă, nu drept atribuirea din plpgsql. Fără variabilă, ambiguitatea
--    dispare.
do $$
begin
    begin
        perform set_config('proba.p6',
            '🔴 a citit ' || (select count(*) from public.user_notes)::text
            || ' rând(uri)', false);
    exception when others then
        perform set_config('proba.p6', 'refuzat ✅ (' || sqlstate || ')', false);
    end;
end $$;


-- ── 5. înapoi la mine, curățenie și rezultat ───────────────────────────────
reset role;
select set_config('request.jwt.claims', '', false);

delete from public.user_notes where content like 'PROBĂ%';

select set_config('proba.p7', count(*)::text || ' rând(uri) în toată tabela', false)
from public.user_notes;

select 1 as nr, 'X își vede propria notă'                       as pas, 'exact 1 rând'          as asteptat, current_setting('proba.p1', true) as obtinut
union all
select 2, 'X își poate scrie nota (upsert, ca din card)', 'textul nou + ora de acum', current_setting('proba.p2', true)
union all
select 3, '⭐ Y NU vede nota lui X',                       '0 rânduri',            current_setting('proba.p3', true)
union all
select 4, 'Y NU poate scrie peste nota lui X',             '0 rânduri schimbate',  current_setting('proba.p4', true)
union all
select 5, 'Y NU poate crea o notă pe numele lui X',        'refuzat cu 42501',     current_setting('proba.p5', true)
union all
select 6, 'Nelogatul nu ajunge la tabelă',                 'refuzat din drepturi', current_setting('proba.p6', true)
union all
select 7, 'Curățenie: n-a rămas nicio notă de probă',      '0 rânduri',            current_setting('proba.p7', true)
order by nr;

-- CUM SE CITEȘTE REZULTATUL — toate șapte trebuie să iasă bine:
--   1. „1 rând(uri)"
--   2. „PROBĂ scrisă de X însuși / ora de ACUM ✅"
--   3. ⭐ „0 rând(uri)". Orice altceva înseamnă că notele sunt publice între
--      utilizatori: oprește-te și spune-mi, NU construiesc cardul.
--   4. „0 rând(uri) schimbate"
--   5. „refuzat de RLS ✅ (42501)"
--   6. „refuzat ✅ (42501)"
--   7. „0 rând(uri) în toată tabela"
--
-- ⚠️ O coloană `obtinut` GOALĂ pe vreun rând înseamnă că pasul acela n-a
--    ajuns să ruleze, nu că a ieșit bine.
--
-- ⚠️ Dacă la 3 și 4 ies cifre în loc de zerouri, cea mai probabilă explicație
--    nu e RLS-ul, ci că `set role` n-a prins și tot scriptul a rulat ca
--    `postgres`, care trece peste politici din construcție. Se vede după
--    rândul 6: dacă și acolo scrie că „a citit", nu e RLS-ul de vină, e proba.


-- ═══════════════════════════════════════════════════════════════════════════
--  ȘI PROBA DIN AFARĂ, care contează la fel de mult
-- ═══════════════════════════════════════════════════════════════════════════
-- Politicile pot fi perfecte, iar tabela să rămână deschisă prin PostgREST:
-- „am mutat citirea pe o funcție" e o propoziție despre cod, nu despre
-- securitate (lecția din 1 august). În PowerShell, cu cheia anonimă publică:
--
--   Invoke-RestMethod -Uri 'https://glbvbbgmcobtswwlktic.supabase.co/rest/v1/user_notes?select=content' `
--     -Headers @{ apikey = '<cheia anonimă publică>' }
--
-- Așteptat: eroare 401/403. ⚠️ O listă goală cu 200 NU e același lucru și ar
-- însemna că `anon` are grant și e oprit doar de lipsa politicilor.

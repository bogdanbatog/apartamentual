-- ═══════════════════════════════════════════════════════════════════════════
-- BUCKET-UL PENTRU FIȘELE DE ANALIZĂ (PDF)
-- 28 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: un bucket nou, `analize-fise`, unde stau fișele PDF ale analizelor, și
-- politicile care îl deschid DOAR membrilor grupului care a plătit analiza.
--
-- ⭐ PRIVAT DE LA ÎNCEPUT, spre deosebire de toate cele patru bucket-uri
--    existente (`articles`, `checklist-files`, `group-images`,
--    `terrain-images`), care sunt marcate publice.
--
--    În Supabase, un bucket public se servește și pe ruta
--        /storage/v1/object/public/{bucket}/{cale}
--    care NU trece prin RLS. Politicile de pe `storage.objects` apără ruta
--    autentificată și listarea, dar nu și pe aceea: cine are odată URL-ul
--    complet descarcă fișierul oricând, inclusiv după ce a fost scos din grup.
--
--    Pentru poze de teren și imagini de articole, asta e chiar ce vrem. Pentru
--    fișa de analiză a unui grup, nu: e un document plătit, care conține ce se
--    poate construi pe teren și la ce costuri.
--
-- CE ATINGE SCRIPTUL: creează un bucket nou și trei politici pe el. NU atinge
-- niciun bucket existent, nicio politică existentă, niciun fișier deja urcat.
--
-- ⚠️ ORDINEA: se rulează DUPĂ `1-tabele-analiza-si-interes.sql`, fiindcă
--    politicile de mai jos citesc din `grup_membri` și `grupuri` (care există
--    dinainte), dar calea fișierelor e legată de analizele din tabela nouă.
--
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul SQL din Supabase rulează tot tabul ca o
--    singură tranzacție, iar un ROLLBACK pus „de probă" anulează tăcut și
--    politicile de deasupra lui.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- CALEA FIȘIERELOR
-- ═══════════════════════════════════════════════════════════════════════════
--
--     {grup_id}/{analiza_id}/{nume-fisier}.pdf
--
-- Primul folder e `grup_id` DINADINS, exact ca la `checklist-files`: politica
-- de citire se scrie atunci pe `storage.foldername(name)[1]`, adică o singură
-- comparație, fără niciun join către tabelele de analiză. Tiparul e copiat de
-- la politica `Members can read checklist files`, care merge azi în producție
-- și e scrisă corect.
--
-- ⚠️ Dacă vreodată calea se schimbă și `grup_id` nu mai e primul folder,
--    politica de citire se rupe tăcut: nu dă eroare, doar nu mai găsește pe
--    nimeni îndreptățit, iar butonul de descărcare tace.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Bucket-ul
-- ───────────────────────────────────────────────────────────────────────────
-- `public = false` e tot rostul fișierului ăstuia.
--
-- `file_size_limit` la 25 MB: o fișă de analiză cu planuri și imagine satelit
-- trece de 10 MB (limita pusă în pagină pentru atașamentele de checklist), dar
-- nu are de ce să treacă de 25.
--
-- `allowed_mime_types` doar PDF: bucket-ul ăsta ține fișe, nu poze. Orice
-- altceva urcat aici e o greșeală, și e mai bine să fie refuzată de la poartă.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('analize-fise', 'analize-fise', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

-- Dacă bucket-ul exista deja din alt motiv, ne asigurăm că e privat.
update storage.buckets
   set public = false
 where id = 'analize-fise';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Cine citește
-- ───────────────────────────────────────────────────────────────────────────
-- Aceeași regulă ca peste tot în organizarea pe apartamente: membrii ACTIVI ai
-- grupului, plus fondatorul lui. Plus superadminul, aici, spre deosebire de
-- tabele: fișa e un document livrat de noi, iar când un grup spune „nu se
-- descarcă", cineva de la platformă trebuie să poată verifica.
--
-- ⚠️ `is_super_admin()` e chemat exact ca în politica surorii ei de pe
--    `checklist-files`, unde funcționează azi. Nu îl înlocuim cu `is_admin()`:
--    sunt două steaguri diferite, iar cel de-al doilea NU acoperă superadminul.

drop policy if exists "Membrii citesc fisele de analiza" on storage.objects;
create policy "Membrii citesc fisele de analiza"
    on storage.objects for select to authenticated
    using (
        bucket_id = 'analize-fise'
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


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Cine scrie
-- ───────────────────────────────────────────────────────────────────────────
-- ⭐ DOAR SUPERADMINUL. Nu există buton de încărcare în pagină și nici nu va
--    exista: fișa vine din procesul de proiectare, nu din interfață. Un membru
--    de grup nu are ce să urce aici, iar dacă nu are ce, nu primește dreptul.
--
--    Diferă dinadins de `checklist-files`, unde politica de INSERT e
--    `bucket_id = 'checklist-files'` și atât, adică orice om logat poate urca
--    în folderul oricărui grup. Acolo are sens (membrii chiar atașează
--    documente), dar politica e mai largă decât ar trebui. Aici nu o copiem.
--
-- Ștergerea și înlocuirea sunt tot ale superadminului: o fișă greșită se
-- înlocuiește de cine a livrat-o.

drop policy if exists "Superadminul urca fise de analiza" on storage.objects;
create policy "Superadminul urca fise de analiza"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'analize-fise' and is_super_admin());

drop policy if exists "Superadminul inlocuieste fise de analiza" on storage.objects;
create policy "Superadminul inlocuieste fise de analiza"
    on storage.objects for update to authenticated
    using      (bucket_id = 'analize-fise' and is_super_admin())
    with check (bucket_id = 'analize-fise' and is_super_admin());

drop policy if exists "Superadminul sterge fise de analiza" on storage.objects;
create policy "Superadminul sterge fise de analiza"
    on storage.objects for delete to authenticated
    using (bucket_id = 'analize-fise' and is_super_admin());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Arată că bucket-ul și politicile ARATĂ cum trebuie. NU arată că RLS-ul
--    chiar refuză pe cineva: în SQL Editor ești `postgres`, `auth.uid()` e NULL
--    și politicile nici nu te ating. Proba adevărată se dă din pagină, logat,
--    cu un cont care NU e în grup, plus o cerere pe ruta publică (care trebuie
--    să întoarcă eroare, fiindcă bucket-ul nu e public).

select 'a. bucket'          as sectiune,
       id::text             as nume,
       case when public then 'PUBLIC (GRESIT)' else 'privat (corect)' end as detaliu,
       coalesce(file_size_limit::text, 'fara limita') as detaliu2
from storage.buckets
where id = 'analize-fise'

union all

-- ⚠️ Se caută după BUCKET, nu după numele politicii. Prima formă filtra
-- `policyname like '%fise de analiza%'`, ceea ce rata tăcut politica de
-- citire, botezată „Membrii citesc FISELE de analiza": „fisele" nu conține
-- „fise ". Rezultatul arăta trei politici în loc de patru și părea că lipsește
-- exact cea mai importantă. O verificare care se sprijină pe cum am scris noi
-- un nume nu verifică nimic.
select 'b. politici'        as sectiune,
       policyname::text     as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       ''                   as detaliu2
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (coalesce(qual, '') like '%analize-fise%'
    or coalesce(with_check, '') like '%analize-fise%')

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): un rând, `privat (corect)`, limită 26214400.
--   • (b): patru politici (select, insert, update, delete), toate pe
--     `authenticated`. Dacă apare vreuna pe `public` sau `anon`, spune-mi.


-- ═══════════════════════════════════════════════════════════════════════════
-- ANEXĂ: `checklist-files` e public, și n-ar trebui
-- ═══════════════════════════════════════════════════════════════════════════
-- NU FACE PARTE DIN SCRIPTUL ĂSTA. E scrisă aici ca să nu se piardă.
--
-- Bucket-ul `checklist-files` ține documentele pașilor de teren (extrase de
-- carte funciară, certificate de urbanism, ce primesc grupurile de la
-- proprietari) și e marcat public, deci ruta `/object/public/...` îl servește
-- fără RLS. Politica lui de SELECT e scrisă corect și apără ruta autentificată,
-- dar nu și pe aceea.
--
-- Reparația e o linie, și NU rupe nimic: `grup-details.html` descarcă
-- fișierele cu `.download()` (ruta autentificată), nu cu `getPublicUrl`.
-- Verificat pe 28 august 2026, funcțiile `downloadStepFile` și
-- `handleFileUpload`.
--
--     update storage.buckets set public = false where id = 'checklist-files';
--
-- ⚠️ Înainte de a o rula, mai dă un grep după `getPublicUrl` în tot frontendul:
--    dacă între timp a apărut undeva un link public către bucket-ul ăsta, se
--    rupe fără nicio eroare în consolă, doar cu o imagine sau un fișier care
--    nu se mai încarcă.
--
-- Rămâne deschisă și politica lui de INSERT, care e doar
-- `bucket_id = 'checklist-files'`: orice om logat poate urca un fișier în
-- folderul oricărui grup. Nu poate CITI ce e acolo, deci nu e o scurgere, dar
-- nici n-ar trebui să poată scrie. Se strânge separat, cu aceeași formă ca
-- politica de SELECT de lângă ea.
-- ═══════════════════════════════════════════════════════════════════════════

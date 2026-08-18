-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMINUL POATE SCRIE ANUNȚURI ÎN GRUPURI (și le poate șterge)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE REPARĂ. Pe 18 august, Lucian: „eu ca superadmin nu pot posta în anunțuri
-- generale pe un grup, ar trebui să pot". Verificat în cod, așa e:
--
--   • `grup-details.html:1680` deschide secțiunile de membru și pentru
--     `isSuperAdmin`, deci FORMULARUL DE POSTARE I SE AFIȘEAZĂ;
--   • `postAnunt()` (`:4448`) face un INSERT obișnuit în `grup_anunturi`;
--   • politica de INSERT cere apartenența activă la grup, pe care superadminul
--     n-o are în grupurile oamenilor.
--
--   Rezultat: butonul „Postează" întoarce „Eroare la postarea anunțului",
--   fără să spună de ce. Aceeași nepotrivire ca la citire, reparată pe 13
--   august prin `2-politica-superadmin.sql` — care ATUNCI a lăsat dinadins
--   scrierea neatinsă („CE NU FACE: nu dă superadminului drept de SCRIERE").
--   Cerința s-a schimbat, deci se schimbă și politica.
--
-- ⚠️ DE CE INSERT ȘI DELETE ÎMPREUNĂ, deși s-a cerut doar postarea.
--    Politica de ștergere are aceeași lipsă: butonul de ștergere i se
--    afișează superadminului (`grup-details.html:4399`), dar `anunturi_delete`
--    acceptă doar autorul și adminul grupului. Cu INSERT reparat singur,
--    primul lucru care se întâmplă e un anunț de probă scris într-un grup
--    REAL, cu oameni reali, pe care apoi nu-l poate retrage din interfață:
--    ar trebui șters din SQL Editor. Deci cele două merg împreună.
--
-- ⚠️ E ȘI O DECIZIE DE PRODUS, NU DOAR TEHNICĂ. Membrii vor vedea un anunț
--    semnat cu pseudonimul superadminului, ca al oricărui membru:
--    `loadAnunturi()` (`:4402`) ia numele din `profiles_visible` și nu are
--    niciun marcaj pentru „echipa ApartamenTUal". Pentru oameni, va arăta ca
--    un mesaj de la cineva pe care nu-l știu din grup. De reparat în frontend,
--    separat, printr-un badge — nu se rezolvă din SQL.
--
-- ⚠️ CE NU FACE: nu atinge UPDATE (superadminul tot nu poate edita anunțul
--    altcuiva), nu atinge politicile existente și nu schimbă cine citește.
--    Politicile permisive se COMBINĂ CU OR, deci cele vechi rămân întregi;
--    aici doar se adaugă un al doilea drum, îngust, spre aceeași tabelă.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND și citește ce întoarce fiecare.
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul rulează tot fișierul ca o singură
--    tranzacție, iar un ROLLBACK „de probă" anulează tăcut și ce e deasupra.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CE POLITICI EXISTĂ ACUM (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Se citește ÎNAINTE de a adăuga ceva. Două lucruri contează:
--   1. numele exacte, ca să nu calc peste o politică existentă;
--   2. condiția de INSERT, ca să știu ce cere azi.
-- ⚠️ Dacă apare deja o politică de INSERT care pomenește `is_super_admin`,
--    OPREȘTE-TE: reparația e făcută și altceva e de vină.

select
    policyname                       as politica,
    cmd                              as operatiune,
    roles::text                      as roluri,
    coalesce(qual, '(fără)')         as conditie_citire,
    coalesce(with_check, '(fără)')   as conditie_scriere
from pg_policies
where schemaname = 'public'
  and tablename  = 'grup_anunturi'
order by
    case cmd when 'SELECT' then 1 when 'INSERT' then 2
             when 'UPDATE' then 3 when 'DELETE' then 4 else 5 end,
    policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — POLITICA DE SCRIERE
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ `user_id = auth.uid()` NU e decor: fără el, superadminul ar putea scrie
--    un anunț în NUMELE altui om, iar în pagină ar apărea pseudonimul aceluia.
--    Adică exact lucrul pe care nicio platformă n-are voie să-l poată face.
--    Politica dă dreptul de a scrie ORIUNDE, dar numai SEMNAT CU NUMELE TĂU.
--
-- ⚠️ `is_super_admin()` e `security definer` (verificat pe 13 august, BLOC 0
--    din fișierul precedent), deci nu crapă dacă mâine se revocă vreun drept
--    de coloană pe `profiles` — capcana din memoria
--    `politici-rls-citesc-direct-din-profiles`.

drop policy if exists "anunturi_insert_superadmin" on public.grup_anunturi;

create policy "anunturi_insert_superadmin"
on public.grup_anunturi
for insert
to authenticated
with check (
    public.is_super_admin()
    and user_id = auth.uid()
);

comment on policy "anunturi_insert_superadmin" on public.grup_anunturi is
    'Superadminul poate scrie anunțuri în orice grup, semnate cu numele lui. '
    'Adăugată 18 august 2026, la cererea lui Lucian. Perechea ei este '
    'anunturi_delete_superadmin: fără aceea, un anunț scris din greșeală '
    'într-un grup real n-ar putea fi retras din interfață.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — POLITICA DE ȘTERGERE
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Aici NU se pune `user_id = auth.uid()`: rostul ei e tocmai să poată
--    retrage un mesaj scris de altcineva (moderare). E singurul drept din
--    scriptul ăsta care atinge conținutul altui om, deci merită spus cu voce
--    tare: după blocul ăsta, superadminul poate șterge orice anunț din orice
--    grup, iar autorul nu află.

drop policy if exists "anunturi_delete_superadmin" on public.grup_anunturi;

create policy "anunturi_delete_superadmin"
on public.grup_anunturi
for delete
to authenticated
using ( public.is_super_admin() );

comment on policy "anunturi_delete_superadmin" on public.grup_anunturi is
    'Superadminul poate șterge orice anunț (moderare + retragerea propriilor '
    'mesaje, fiindcă nu e membru în grupurile oamenilor). Adăugată 18 august '
    '2026. Butonul exista în interfață din iulie și eșua tăcut.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Trebuie să iasă DOUĂ rânduri, ambele cu `gata = true`.
-- ⚠️ Editorul arată doar rezultatul ULTIMEI interogări dintr-o selecție, de
--    aceea verificarea e scrisă ca o singură interogare, nu ca două.

select
    policyname                                    as politica,
    cmd                                           as operatiune,
    (policyname is not null)                      as gata,
    coalesce(with_check, qual, '(fără condiție)') as conditia
from pg_policies
where schemaname = 'public'
  and tablename  = 'grup_anunturi'
  and policyname in ('anunturi_insert_superadmin', 'anunturi_delete_superadmin')
order by policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — DREPTUL DE TABELĂ (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ RLS NU E DE AJUNS. O politică permite, dar `GRANT`-ul deschide poarta:
--    fără INSERT/DELETE acordat rolului `authenticated` pe tabelă, politica de
--    mai sus n-ar salva pe nimeni și eroarea ar arăta la fel ca înainte.
--    Membrii postează deja, deci grantul ar trebui să existe — se verifică,
--    nu se presupune (memoria `supabase-grant-implicit-anon`).
--
-- Se așteaptă cel puțin INSERT și DELETE pentru `authenticated`.

select
    grantee    as rol,
    privilege_type as drept
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name   = 'grup_anunturi'
  and grantee in ('authenticated', 'anon')
order by grantee, privilege_type;


-- ═══════════════════════════════════════════════════════════════════════════
-- PROBA, DUPĂ RULARE — se face din interfață, nu de aici
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ NU proba cu un INSERT + ROLLBACK în editor: tot fișierul e o singură
--    tranzacție, iar ROLLBACK-ul ar anula și politicile de mai sus, tăcut
--    (memoria `supabase-sql-editor-rollback`).
--
-- ⚠️ NU proba pe un grup cu oameni reali. Anunțul pleacă mai departe: seara,
--    `digest-anunturi-grup` trimite email tuturor membrilor activi. Un „test"
--    scris la 11 dimineața ajunge în inboxul oamenilor la ora 20.
--
-- Proba corectă: intri pe un grup de-al tău (sau unul de test), scrii un
-- anunț, apoi îl ștergi cu butonul din dreptul lui. Dacă amândouă merg,
-- ambele politici lucrează. Dacă postarea merge dar ștergerea nu, BLOC 2
-- n-a intrat sau grantul de DELETE lipsește (vezi BLOC 4).
-- ═══════════════════════════════════════════════════════════════════════════

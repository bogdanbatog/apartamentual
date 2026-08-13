-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMINUL VEDE ANUNȚURILE GRUPURILOR
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE REPARĂ. Pe 13 august, Alin a semnalat că a scris pe grup și nimeni n-a
-- reacționat. Diagnosticul (`1-diagnostic.sql`) a arătat că mesajele există —
-- trei, în „Rond Cosbuc" și „Constantin Bosianu" — dar politica de citire de
-- pe `grup_anunturi` cere apartenența la grup:
--
--     anunturi_select_members:  EXISTS (SELECT 1 FROM grup_membri
--                                       WHERE ... user_id = auth.uid()
--                                         AND status = 'activ')
--
-- Superadminul nu e membru în grupurile oamenilor, deci primea zero rânduri —
-- fără eroare, fără nimic în consolă. Pagina scria „Niciun anunț încă", ceea
-- ce arată identic cu „grupul chiar n-are anunțuri". Aceeași capcană ca în
-- memoria `rls-superadmin-doua-flaguri`: `is_admin()` din politici NU acoperă
-- superadminul, iar aici nu era nici măcar `is_admin()`.
--
-- ⚠️ E ȘI O DECIZIE DE PRODUS, NU DOAR TEHNICĂ. Oamenii scriu pe grup crezând
--    că-i citește grupul. După scriptul ăsta, superadminul (Lucian și Liviu,
--    singurii doi) le citește pe toate. Se justifică — fără asta nu putem
--    răspunde când cineva ne spune „am scris și n-a văzut nimeni" — dar merită
--    scris undeva vizibil pentru utilizatori, la momentul potrivit.
--
-- CE NU FACE: nu dă superadminului drept de SCRIERE. Politicile de INSERT și
-- DELETE rămân neatinse — el poate deja șterge orice anunț prin
-- `anunturi_delete` doar dacă e adminul grupului, ceea ce nu e cazul. Butonul
-- de ștergere din interfață i se AFIȘEAZĂ (`grup-details.html:4399` verifică
-- `isSuperAdmin`), dar apăsarea lui ar eșua tăcut. Nu-l reparăm acum: e o
-- nepotrivire veche, fără efect distructiv, și n-are legătură cu ce urmărim.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND și citește ce întoarce fiecare.
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul rulează tot fișierul ca o singură
--    tranzacție, iar un ROLLBACK „de probă" anulează tăcut și ce e deasupra.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CE FACE `is_super_admin()` (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Citește corpul funcției ÎNAINTE de a construi o politică peste ea. Două
-- lucruri trebuie să fie adevărate, altfel oprește-te:
--
--   1. E `security definer` — rulează cu drepturile proprietarului, deci nu
--      crapă dacă mâine se revocă vreun drept de coloană pe `profiles`. Asta
--      e diferența față de cele 12 politici care au golit pagina de terenuri
--      pe 1 august (memoria `politici-rls-citesc-direct-din-profiles`).
--   2. Se sprijină pe `auth.uid()` și întoarce FALS pentru un vizitator fără
--      cont — nu crapă. O funcție care crapă într-o politică de SELECT nu
--      întoarce „fals", ci rupe toată interogarea (memoria
--      `revoke-anon-poate-rupe-pagini`).

select pg_get_functiondef(p.oid) as definitie
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_super_admin';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — POLITICA
-- ───────────────────────────────────────────────────────────────────────────
-- E o politică PERMISIVĂ, adăugată lângă cea existentă. Politicile permisive
-- se combină cu SAU, deci efectul e exact „membrii activi SAU superadminul".
--
-- ⚠️ Tocmai fiindcă se combină cu SAU, o politică largă o anulează pe una
--    strictă (memoria `politica-rls-doar-pentru-numarat-nu-exista`). Aici e
--    în regulă: condiția nu e largă, e `is_super_admin()`, adevărată pentru
--    exact doi oameni. Dacă vreodată scrii una cu `using (true)`, ai deschis
--    tabela pentru toată lumea, oricâte politici stricte ar sta lângă ea.
--
-- `to authenticated`, nu `{public}` ca politicile vechi: un vizitator fără
-- cont n-are cum să fie superadmin, deci n-are rost să fie măcar evaluat.
--
-- ⚠️ DE CE `(select public.is_super_admin())` ȘI NU `public.is_super_admin()`:
--    o funcție chemată direct într-o politică se evaluează PENTRU FIECARE RÂND
--    scanat. Învelită în `select`, devine o subinterogare fără legătură cu
--    rândul curent, pe care Postgres o calculează O SINGURĂ DATĂ pe interogare.
--    Rezultatul e identic — funcția n-are argumente și nu depinde de rând —
--    dar la o tabelă care crește, diferența e între „o citire din `profiles`"
--    și „o citire per anunț". Verificat pe corpul funcției (blocul 0): e
--    `stable`, deci n-are efecte secundare pe care cachearea le-ar pierde.

drop policy if exists "anunturi_select_superadmin" on public.grup_anunturi;

create policy "anunturi_select_superadmin"
    on public.grup_anunturi
    for select
    to authenticated
    using ((select public.is_super_admin()));

comment on policy "anunturi_select_superadmin" on public.grup_anunturi is
    'Superadminul citește anunțurile oricărui grup, fără să fie membru. Adăugată 13 august 2026: fără ea, un mesaj scris pe grup era invizibil pentru noi și nu puteam răspunde când cineva semnala că a scris. Doar SELECT — scrierea și ștergerea rămân ale membrilor și ale adminului de grup.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- Așteptat: DOUĂ politici de SELECT pe tabelă — cea veche, pe membri, și cea
-- nouă. Dacă a rămas una singură, blocul 1 n-a trecut.

select
    cmd,
    policyname,
    roles::text                        as roluri,
    left(coalesce(qual, '—'), 200)     as conditie
from pg_policies
where schemaname = 'public'
  and tablename  = 'grup_anunturi'
order by cmd, policyname;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — PROBA ADEVĂRATĂ (se face în browser, nu aici)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ NU încerca să probezi cu un `select * from grup_anunturi` în editorul
--    SQL. Acolo rulezi ca `postgres` și ocolești RLS din construcție — vei
--    vedea toate rândurile chiar dacă politica e greșită, iar dacă politica
--    e ștearsă vei vedea tot toate rândurile. Editorul nu poate infirma nimic
--    aici (memoria `functii-sql-verificate-abia-la-rulare`: `auth.uid()` e
--    NULL în editor).
--
-- PROBA E ASTA, și durează un minut:
--   1. Intră pe apartamentual.ro cu contul tău de superadmin.
--   2. Deschide grupul „Rond Cosbuc - Palatul Parlamentului - Parc Carol":
--      https://apartamentual.ro/grup-details.html?id=041eb6f5-ef07-4812-b56c-c325a84ee3f8
--   3. La „Anunțuri generale grup" trebuie să apară DOUĂ mesaje de la Alint,
--      din 23 și 28 iulie.
--   4. Și grupul „Constantin Bosianu nr. 32, sector 4":
--      https://apartamentual.ro/grup-details.html?id=597d71bd-2289-468a-8988-d510e1ac55a6
--      Acolo e UNUL, din 12 august.
--
-- CONTRA-PROBA, dacă vrei să fii sigur că n-ai deschis tabela pentru toți:
--   deschide același link într-o fereastră privată, fără cont. Secțiunea
--   „Anunțuri" nici nu trebuie să apară (e `member-only`).


-- ───────────────────────────────────────────────────────────────────────────
-- DACĂ TREBUIE DAT ÎNAPOI
-- ───────────────────────────────────────────────────────────────────────────
-- Reversibil complet, dintr-o linie. Nu se pierde niciun mesaj — politica
-- doar decide cine citește, nu atinge datele:
--
--     drop policy "anunturi_select_superadmin" on public.grup_anunturi;

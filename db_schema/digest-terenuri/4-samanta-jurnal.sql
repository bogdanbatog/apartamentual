-- ═══════════════════════════════════════════════════════════════════════════
-- SĂMÂNȚA JURNALULUI — ca prima trimitere automată să nu repete campania
-- manuală din 3 august
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE EXISTĂ ACEST FIȘIER
--
-- Jurnalul `terenuri_digest_log` e gol. Consecință: la prima rulare, fereastra
-- FIECĂRUI om începe de la podea (acum minus 14 zile), deci fiecare primește
-- tot ce s-a adăugat în ultimele două săptămâni.
--
-- Dar pe 3 august, la 16:42 ora României, a plecat deja o campanie MANUALĂ cu
-- exact același subiect — „terenuri noi în zonele tale" — către 38 de oameni
-- (`scripts/emailuri-terenuri-noi/local/trimise-2026-08-03.json`).
--
-- Măsurat pe 13 august, la proba `dry_run`: **35 din cei 61 de destinatari de
-- azi au primit deja emailul acela**. Fără fișierul ăsta, primul email automat
-- le-ar arăta din nou terenuri despre care le-am scris acum zece zile, sub
-- titlul „au apărut". La primul email dintr-o serie recurentă, exact ăsta e
-- lucrul care nu trebuie greșit.
--
-- CE FACE
-- Scrie câte un rând de jurnal, datat 3 august, pentru cei 38 de oameni ai
-- campaniei manuale. La prima rulare automată, fereastra lor va porni de la
-- acea dată în loc de podea, deci vor vedea DOAR ce a apărut după campanie.
-- Ceilalți 26 rămân cu fereastra de 14 zile — pentru ei nimic nu se repetă,
-- fiindcă n-au primit nimic până acum.
--
-- ⚠️ RÂNDURILE DE SĂMÂNȚĂ SE RECUNOSC DUPĂ `nr_terenuri = 0`. Tabela n-are
--    coloană de notă, iar eu nu adaug una doar pentru asta. O trimitere reală
--    nu poate avea 0 (funcția nu trimite email fără terenuri), deci zero e un
--    marcaj sigur. Vezi verificarea din BLOC 3.
--
-- ⚠️ POTRIVIREA SE FACE PE EMAIL, cu `lower(btrim(...))`. Dacă cineva și-a
--    schimbat adresa între timp, nu se potrivește și primește fereastra
--    întreagă — adică repetiția pe care o evităm. BLOC 1 îți arată cine nu s-a
--    potrivit, ÎNAINTE să scrii ceva.
--
-- CÂND SE RULEAZĂ
-- ÎNAINTE de prima trimitere reală, după ce ai probat cu `dry_run`.
-- ⚠️ SE RULEAZĂ O SINGURĂ DATĂ. BLOC 2 se apără singur împotriva rulării de
--    două ori, dar tot uită-te la ce întoarce.
--
-- ⚠️ NU pune BEGIN / ROLLBACK. Editorul SQL din Supabase rulează tot fișierul
--    ca o singură tranzacție, iar un ROLLBACK „doar de probă" anulează tăcut
--    și ce s-a scris deasupra.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — CINE SE POTRIVEȘTE (nu scrie nimic; rulează-l și citește)
-- ───────────────────────────────────────────────────────────────────────────
-- Așteptat: 38 la „găsit", 0 la „NEGĂSIT".
-- Dacă apar negăsiți, sunt oameni care și-au schimbat emailul sau și-au șters
-- contul. Pentru cei cu contul șters nu contează. Pentru ceilalți, caută-i
-- după nume și adaugă-le adresa nouă în lista din BLOC 2.

with campanie(email) as (
    values
    ('mariuseu@outlook.com'),
    ('sorinadraghici13@gmail.com'),
    ('sld.bogdan@yahoo.com'),
    ('mihai.ppscu@gmail.com'),
    ('robertxtanase@gmail.com'),
    ('minzatrobert@gmail.com'),
    ('cristian.pelivan@gmail.com'),
    ('mihaitudormare@gmail.com'),
    ('timestreamer@gmail.com'),
    ('georgescu.stefan.v@gmail.com'),
    ('blinman2003@yahoo.com'),
    ('ionutcosminlupu@gmail.com'),
    ('bpriceputu@gmail.com'),
    ('constantin.caciur@gmail.com'),
    ('andrab90@yahoo.com'),
    ('bebe.nita@yahoo.com'),
    ('cristi.secu@gmail.com'),
    ('stefania.konst@gmail.com'),
    ('atortolea@yahoo.com'),
    ('razvan@printoteca.ro'),
    ('iuliancastel@gmail.com'),
    ('oana.eremia@icloud.com'),
    ('mihai.sadaca@gmail.com'),
    ('mihailescu.alex@ymail.com'),
    ('ivan.sorin.daniel@gmail.com'),
    ('dannitu@gmail.com'),
    ('ion.meitoiu@gmail.com'),
    ('rox.brustur@yahoo.com'),
    ('alexbaleanu@yahoo.com'),
    ('iacob.alexandru04@gmail.com'),
    ('costache.f.g@gmail.com'),
    ('ems.cuptrade@gmail.com'),
    ('gxg1313@yahoo.com'),
    ('adrian.rasoiu@gmail.com'),
    ('cristianghita123@gmail.com'),
    ('danacaratas@yahoo.com'),
    ('gabriel.lenghen.85@gmail.com'),
    ('bergmann.backup@gmail.com')
)
select
    case when p.user_id is null then 'NEGĂSIT' else 'găsit' end as stare,
    c.email,
    p.pseudonym,
    p.account_status,
    p.email_terenuri_noi
from campanie c
left join public.profiles p on lower(btrim(p.email)) = c.email
order by 1, 2;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — SCRIE SĂMÂNȚA (rulează-l după ce ai citit BLOC 1)
-- ───────────────────────────────────────────────────────────────────────────
-- `trimis_la` = 3 august 2026, 16:42 ora României — momentul real al primului
-- email din campania manuală (`trimise-2026-08-03.json`, primul rând, ora UTC
-- 13:42). E ora care contează: de la ea încolo pornește fereastra lor.
--
-- `fereastra_de_la` = 20 iulie, adică începutul perioadei acoperite de
-- campania manuală. Nu e folosit de nimic în calcule — funcția SQL se uită
-- doar la `trimis_la` — dar coloana e `not null` și e mai cinstit să scrie
-- ce a acoperit emailul acela decât o valoare inventată.
--
-- `nr_terenuri = 0` e MARCAJUL de rând de sămânță (vezi antetul).
--
-- ⚠️ `where not exists` face blocul rulabil de două ori fără efect. Fără el,
--    o a doua rulare ar adăuga încă 38 de rânduri — inofensive pentru calcul
--    (funcția ia `max(trimis_la)`), dar ar murdări pentru totdeauna
--    verificarea de la BLOC 3 și rezumatul pe săptămâni din `3-programare.sql`.

insert into public.terenuri_digest_log
    (user_id, trimis_la, fereastra_de_la, nr_terenuri, nr_zone)
select
    p.user_id,
    timestamptz '2026-08-03 16:42:00+03',
    timestamptz '2026-07-20 00:00:00+03',
    0,
    0
from public.profiles p
where lower(btrim(p.email)) in (
    'mariuseu@outlook.com',
    'sorinadraghici13@gmail.com',
    'sld.bogdan@yahoo.com',
    'mihai.ppscu@gmail.com',
    'robertxtanase@gmail.com',
    'minzatrobert@gmail.com',
    'cristian.pelivan@gmail.com',
    'mihaitudormare@gmail.com',
    'timestreamer@gmail.com',
    'georgescu.stefan.v@gmail.com',
    'blinman2003@yahoo.com',
    'ionutcosminlupu@gmail.com',
    'bpriceputu@gmail.com',
    'constantin.caciur@gmail.com',
    'andrab90@yahoo.com',
    'bebe.nita@yahoo.com',
    'cristi.secu@gmail.com',
    'stefania.konst@gmail.com',
    'atortolea@yahoo.com',
    'razvan@printoteca.ro',
    'iuliancastel@gmail.com',
    'oana.eremia@icloud.com',
    'mihai.sadaca@gmail.com',
    'mihailescu.alex@ymail.com',
    'ivan.sorin.daniel@gmail.com',
    'dannitu@gmail.com',
    'ion.meitoiu@gmail.com',
    'rox.brustur@yahoo.com',
    'alexbaleanu@yahoo.com',
    'iacob.alexandru04@gmail.com',
    'costache.f.g@gmail.com',
    'ems.cuptrade@gmail.com',
    'gxg1313@yahoo.com',
    'adrian.rasoiu@gmail.com',
    'cristianghita123@gmail.com',
    'danacaratas@yahoo.com',
    'gabriel.lenghen.85@gmail.com',
    'bergmann.backup@gmail.com'
)
and not exists (
    select 1 from public.terenuri_digest_log l
    where l.user_id = p.user_id
);

-- Așteptat: „INSERT 0 38" (sau mai puțin, dacă BLOC 1 a arătat negăsiți).


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu scrie nimic)
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. Câte rânduri de sămânță și câte trimiteri reale sunt în jurnal.
--     Înainte de prima rulare automată: 38 de sămânță, 0 reale.
select
    case when nr_terenuri = 0 then 'sămânță (campania manuală)' else 'trimitere reală' end as fel,
    count(*)             as randuri,
    min(trimis_la)       as prima,
    max(trimis_la)       as ultima
from public.terenuri_digest_log
group by 1
order by 1;

-- 3b. Nimeni nu trebuie să aibă două rânduri de sămânță.
--     Așteptat: zero rânduri.
select user_id, count(*) as randuri_samanta
from public.terenuri_digest_log
where nr_terenuri = 0
group by user_id
having count(*) > 1;


-- ───────────────────────────────────────────────────────────────────────────
-- DUPĂ ACEST FIȘIER
-- ───────────────────────────────────────────────────────────────────────────
-- Rulează din nou proba `dry_run` a funcției `digest-terenuri-zone`. Cifrele
-- TREBUIE să scadă: cei 35 de oameni suprapuși vor avea mai puține terenuri,
-- iar unii vor dispărea cu totul din lot (dacă în zonele lor n-a mai apărut
-- nimic după 3 august). Asta nu e o pierdere — e exact ce nu trebuia trimis
-- a doua oară.
--
-- ⚠️ DACĂ LOTUL SCADE MULT (să zicem sub 20 de oameni), nu e o defecțiune a
--    fișierului ăsta, ci semnalul că săptămâna asta n-a avut material. Emailul
--    automat e proiectat să tacă în săptămânile goale.
--
-- ⚠️ DE ȘTIUT PENTRU VIITOR: dacă se mai face vreodată o campanie manuală pe
--    terenuri, trebuie scris și în jurnalul ăsta — altfel digestul automat o
--    va repeta. E prețul faptului că avem două căi către același email.

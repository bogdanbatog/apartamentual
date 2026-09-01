-- ═══════════════════════════════════════════════════════════════════════════
-- JURNALUL TERENULUI: două coloane pe comentariile care există deja
-- 30 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: `grup_teren_comments` capătă `fel` și `data_faptului`, ca un fir de
-- comentarii să devină un jurnal care se poate citi pe verticală.
--
-- DE CE: în Google Sheet-ul grupului Parcul Circului, ce noi ținem ca un fir de
-- comentarii stătea pe două coloane, „Observații" și „Note discuție la telefon",
-- cu lucruri de felul „proprietarul e plecat în Germania de 30 de ani, prețul e
-- discutabil". Un fir nu se poate scana: ca să afli când s-a vorbit ultima oară
-- cu agentul, trebuie să îl citești tot.
--
-- ⭐ DE CE DOUĂ DATE, NU UNA. `created_at` e ziua în care s-a scris nota.
--    `data_faptului` e ziua în care s-a întâmplat lucrul. Sunt aproape mereu
--    diferite: vorbești cu agentul marți și apuci să notezi joi. Peste trei
--    luni, când cineva caută „când am vorbit cu ăia de pe Despot Vodă", caută
--    ziua discuției, nu ziua notării. Un fir de comentarii obișnuit are doar a
--    doua dată, și de aceea nu ține loc de jurnal.
--
-- ⚠️ ASTA E SINGURA MIGRAȚIE DIN PACHET CARE ATINGE O TABELĂ EXISTENTĂ. De
--    aceea e scrisă separat și rulată ultima: dacă ceva merge prost aici,
--    restul (tabelele analizei, bucketurile, atașamentele) sunt deja în
--    picioare și neatinse.
--
--    Amândouă coloanele sunt NULLABLE și fără `default` care să schimbe ceva.
--    Cele 100+ de comentarii existente rămân exact cum sunt: `fel` gol
--    înseamnă „observație", `data_faptului` gol înseamnă „ziua în care s-a
--    scris". Pagina știe să citească ambele cazuri, deci nu e nevoie de nicio
--    completare retroactivă.
--
--    NU se ating politicile RLS ale tabelei. Cine putea citi și scrie
--    comentarii poate în continuare exact la fel: coloanele noi merg pe același
--    rând, sub aceleași politici.
--
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul SQL din Supabase rulează tot tabul ca o
--    singură tranzacție, iar un ROLLBACK pus „de probă" anulează tăcut tot.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și uită-te la rezultat)
-- ───────────────────────────────────────────────────────────────────────────
-- Trei lucruri de confirmat înainte de a atinge o tabelă care are date în ea:
--
--   (a) ce coloane are acum. Dacă `fel` sau `data_faptului` există deja, sub
--       alt înțeles, OPREȘTE-TE: `add column if not exists` ar trece tăcut
--       peste ele și pagina ar scrie într-o coloană a altcuiva.
--   (b) câte comentarii sunt. Toate rămân valide, dar e bine să știm despre ce
--       volum vorbim.
--   (c) ce politici are. Nu le atingem; sunt aici ca să se vadă negru pe alb
--       că rămân neschimbate după BLOC 1.

select 'a. coloane'        as sectiune,
       column_name::text   as nume,
       data_type::text     as detaliu
from information_schema.columns
where table_schema = 'public' and table_name = 'grup_teren_comments'

union all

select 'b. cate comentarii' as sectiune,
       count(*)::text       as nume,
       'randuri existente'  as detaliu
from public.grup_teren_comments

union all

select 'c. politici'       as sectiune,
       policyname::text    as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'

order by sectiune, nume;

-- Cum se citește:
--   • (a): NU trebuie să apară nici `fel`, nici `data_faptului`. Restul (id,
--     grup_id, teren_id, user_id, content, created_at) sunt cele de care
--     depinde pagina grupului azi.
--   • (b): orice număr e în regulă.
--   • (c): notează-le. După BLOC 1 trebuie să fie exact aceleași.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Cele două coloane
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Rulează-l DOAR dacă BLOC 0 (a) n-a arătat coloanele astea.
--
-- `fel` e listă închisă scrisă în pagină: discutie | vizita | document |
-- observatie. Nu e `check`, ci înțelegere între pagină și bază, ca la `etaj`
-- din preferințe: lista se va mai lungi, iar paguba maximă a unei valori
-- greșite e o intrare care se afișează neutru.
--
-- `data_faptului` e `date`, nu `timestamptz`: ora la care s-a purtat o discuție
-- nu interesează pe nimeni, iar o oră ar cere fus orar, care aici s-ar citi
-- greșit noaptea. (Vezi capcana din `db_schema/`: filtrarea pe dată în UTC
-- pierde tăcut rândurile create seara.)

alter table public.grup_teren_comments
    add column if not exists fel text;

alter table public.grup_teren_comments
    add column if not exists data_faptului date;

comment on column public.grup_teren_comments.fel is
    'Ce fel de intrare e: discutie, vizita, document, observatie. Gol înseamnă observație, ca să rămână valide comentariile scrise înainte de 30 august 2026. Listă închisă scrisă în pagină, nu constrângere în bază: se va mai lungi.';

comment on column public.grup_teren_comments.data_faptului is
    'Ziua în care s-a întâmplat lucrul, nu cea în care s-a scris nota (aceea e created_at). Vorbești cu agentul marți și notezi joi; peste trei luni cineva caută ziua discuției. Gol înseamnă că se folosește created_at. Tip date, nu timestamptz: ora nu interesează, iar un fus orar s-ar citi greșit seara.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Indexul de citire
-- ───────────────────────────────────────────────────────────────────────────
-- Jurnalul se citește mereu la fel: intrările unui grup despre un teren, cele
-- mai noi întâi.
--
-- ⚠️ PRIMA FORMĂ A ACESTUI INDEX A FOST REFUZATĂ DE BAZĂ, și pe bună dreptate:
--
--     ... (grup_id, teren_id, coalesce(data_faptului, created_at::date) desc)
--     ERROR 42P17: functions in index expression must be marked IMMUTABLE
--
--    Conversia unui `timestamptz` în `date` depinde de fusul orar al sesiunii:
--    același moment cade în zile diferite la București și la UTC. O expresie al
--    cărei rezultat se poate schimba n-are ce căuta într-un index, fiindcă
--    rândurile ar ajunge indexate pe o zi și căutate pe alta.
--
--    Indexul merge pe `created_at`, care e o cifră fixă. Ordinea DUPĂ DATA
--    FAPTULUI se face în pagină, pe cele cel mult 200 de rânduri citite: e o
--    sortare în memorie pe o listă mică, nu merită un index funcțional și un
--    fus orar bătut în cuie ca să o mutăm în bază.

create index if not exists grup_teren_comments_jurnal_idx
    on public.grup_teren_comments (grup_id, teren_id, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Drepturile pe coloanele noi
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ SE VERIFICĂ, NU SE PRESUPUNE. Dacă tabela are granturi pe TABELĂ (nu pe
--    coloane), coloanele noi sunt deja scriitibile și blocul ăsta nu schimbă
--    nimic. Dacă are granturi PE COLOANE, coloanele noi NU sunt scriitibile
--    până nu primesc explicit dreptul, iar salvarea din pagină ar eșua mut.
--
--    E aceeași capcană ca la `profiles`, unde UPDATE-ul e dat pe listă
--    explicită de coloane și o coloană nouă nu se poate scrie până nu i se
--    adaugă numele.
--
-- ⚠️ INTEROGAREA DE MAI JOS NU DEOSEBEȘTE CELE DOUĂ CAZURI, și am aflat-o pe
--    30 august, rulând-o. `information_schema.column_privileges` desfășoară pe
--    coloane ȘI granturile date pe tabelă, deci întoarce rânduri în amândouă
--    situațiile. Ce se citește din ea e altceva, dar tot util: dacă `fel` și
--    `data_faptului` apar acolo cu INSERT și UPDATE pentru `authenticated`,
--    atunci sunt scriitibile, indiferent de unde le vine dreptul, iar grantul
--    de la final nu mai trebuie rulat.
--
--    Ca să afli de unde vine dreptul, interogarea corectă e pe
--    `information_schema.role_table_grants` (granturi de TABELĂ). Dacă tabela
--    apare acolo, drepturile sunt pe tabelă și acoperă automat orice coloană
--    nouă.
--
-- Rulează întâi interogarea, apoi grantul DOAR dacă `fel` și `data_faptului`
-- LIPSESC din rezultat pentru `authenticated`.

select grantee::text        as cine,
       privilege_type::text as ce,
       column_name::text    as pe_coloana
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and grantee in ('anon', 'authenticated')
order by grantee, privilege_type, column_name;

-- Cum se citește (verificat pe 30 august):
--   • Caută `fel` și `data_faptului` pe rândurile lui `authenticated`, la
--     INSERT și UPDATE. Dacă sunt acolo, coloanele sunt scriitibile și NU
--     rulezi nimic mai jos. Așa a ieșit la noi.
--   • Dacă lipsesc, rulează cele două rânduri de mai jos.
--
-- ⚠️ CE A MAI IEȘIT DIN INTEROGAREA ASTA, deși nu o căutam: rolul `anon` are
--    SELECT, INSERT, UPDATE și REFERENCES pe toată tabela. Nu e o scurgere
--    activă, fiindcă politicile cer `auth.uid()`, iar pentru un nelogat acela e
--    NULL. Dar e poarta lăsată deschisă pe drepturi, cu RLS ca singură apărare.
--    Se strânge în `5-strangere-comentarii.sql`, împreună cu `status = 'activ'`
--    în politici.
--
-- grant insert (fel, data_faptului), update (fel, data_faptului)
--   on public.grup_teren_comments to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Cel mai important lucru de verificat aici NU sunt coloanele noi, ci că
--    nimic din ce era înainte nu s-a schimbat: aceleași politici, aceleași
--    comentarii, aceeași tabelă pe care se sprijină pagina grupului.

select 'a. coloanele noi'  as sectiune,
       column_name::text   as nume,
       (data_type || ' / ' || is_nullable)::text as detaliu
from information_schema.columns
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and column_name in ('fel', 'data_faptului')

union all

select 'b. politici'       as sectiune,
       policyname::text    as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'

union all

select 'c. comentariile vechi' as sectiune,
       count(*)::text          as nume,
       'inca acolo, cu fel gol' as detaliu
from public.grup_teren_comments
where fel is null

order by sectiune, nume;

-- Cum se citește:
--   • (a): două rânduri, `text / YES` și `date / YES`. Amândouă NULLABLE.
--   • (b): EXACT politicile notate la BLOC 0 (c). Dacă lipsește vreuna sau a
--     apărut una nouă, spune-mi imediat: pagina grupului depinde de ele.
--   • (c): numărul de la BLOC 0 (b). Toate comentariile vechi sunt neatinse și
--     se vor citi în jurnal ca observații, cu data scrierii.
--
-- ⚠️ DUPĂ MIGRAȚIE, ÎNAINTE DE ORICE ALTCEVA: deschide pagina unui grup care
--    are terenuri cu comentarii și verifică cu ochiul că firul de comentarii
--    de pe cardul terenului arată exact ca înainte. `grup-details.html` cere
--    `select('id, content, created_at, user_id')`, deci coloanele noi nici nu
--    ajung la el, dar proba se dă oricum: e singura tabelă existentă atinsă de
--    tot pachetul ăsta.

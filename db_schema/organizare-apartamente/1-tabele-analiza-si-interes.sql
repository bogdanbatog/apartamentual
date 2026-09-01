-- ═══════════════════════════════════════════════════════════════════════════
-- ORGANIZAREA PE APARTAMENTE: analiza unui teren și interesul membrilor
-- 27 august 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: șapte tabele noi care aduc în platformă ce produce Urban Analyzer
-- (instrumentul lui Liviu) și lasă membrii unui grup să își împartă
-- apartamentele și să spună pe care pun ochii.
--
--   analiza_teren           o analiză, făcută pentru UN grup pe UN teren
--   analiza_varianta        „Varianta 5, 6 apartamente": variantele din fișă
--   analiza_nivel           un etaj, cu suprafața utilă disponibilă pe el
--   analiza_apartament      o casetă: tipologia și intervalul ei de suprafață
--   apartament_suprafata    suprafața pe care a ales-o grupul, trăgând cursorul
--   apartament_interes      cine s-a înscris pe ce apartament
--   grup_membru_preferinte  ce vrea fiecare membru, independent de orice analiză
--
-- DE CE ACUM: grupul Parcul Circului (~20 membri) compară terenuri chiar în
-- săptămânile astea și își ține echivalentul în Google Sheets.
--
-- CE ATINGE SCRIPTUL: doar lucruri NOI. Șapte tabele, legăturile lor, politicile
-- și granturile lor. ZERO atingeri la `grupuri`, `grup_membri`, `terenuri`,
-- `profiles`, la politicile existente, la plăți, la Oblio, la Netopia.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în fișierul ăsta. Editorul SQL din Supabase
--    rulează tot tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă"
--    anulează tăcut și granturile de deasupra lui.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND, în ordinea 0 → 1 → 2 → 3 → 4 → 5.
--    BLOC 0 nu schimbă nimic: rulează-l și trimite-mi rezultatul ÎNAINTE de
--    restul.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DECIZIILE DIN SPATELE FORMEI ĂSTEIA (Lucian, 26-27 august 2026)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- 1. ANALIZA APARȚINE PERECHII (GRUP, TEREN), NU TERENULUI SINGUR.
--    Un grup plătește analiza. Dacă alt grup are același teren la favorite, nu
--    o vede. De aceea `analiza_teren` are `grup_id` NOT NULL, iar politicile
--    întreabă strict de grupul acela.
--
-- 2. NUMELE CELOR INTERESAȚI SE VĂD DE TOȚI MEMBRII.
--    Nu „2 familii interesate", ci „Alin, Vlad". Rostul uneltei e să vadă
--    grupul unde se calcă pe picioare, iar un număr nu pornește nicio discuție.
--    Consecință tehnică plăcută: NU e nevoie de nicio funcție `security
--    definer` care să numere fără să arate cine. Politica de SELECT e simplă.
--
-- 3. NU SE STOCHEAZĂ NICIUN PREȚ, NICIUN PROCENT, NICIO MEDIE.
--    Tot lanțul se calculează în pagină, din suprafețele pe care grupul le-a
--    împărțit chiar în clipa aceea:
--
--        Sd               = (Su împărțit + Su comun) / coef_su_sd
--        cost construcție = Sd × cost_constructie_mp + costul subsolului
--        cost total       = cost_teren + cost construcție
--        cota apartamentului = suprafața lui / Su împărțit
--        cost apartament  = cotă × cost total
--
--    ⭐ SINGURA SUMĂ FIXĂ E TERENUL. Când grupul lasă goluri, construcția lor
--    nu se mai face și investiția scade, dar terenul costă la fel și se împarte
--    la mai puțini metri utili: ponderea lui în investiție crește, și de aceea
--    golurile sunt neeficiente. (Prima formă a machetei ținea construcția fixă
--    și scotea 2,9% scumpire acolo unde adevărul e 1,5%.)
--
--    ⚠️ Spațiul comun (`analiza_nivel.su_comun_mp`) NU se numără ca gol: e o
--    alegere a variantei, nu o scăpare a grupului. Se construiește, deci intră
--    în cost, dar nu se împarte, deci nu intră în cote: exact asta face
--    varianta cu parter comun mai scumpă pe metru de locuință. Fără scăderea
--    lui, un parter comun de 48 mp apărea ca suprafață pierdută și arăta o
--    scumpire de 14% în loc de 1,4%.
--
--    ⚠️ O valoare derivată scrisă în bază e o valoare care rămâne greșită după
--    ce se schimbă costul construcției. Nu stocăm nimic ce se poate calcula.
--
-- 4. `grup_id` E COPIAT PE FIECARE TABELĂ (denormalizare voită).
--    Fără el, politica de pe `apartament_interes` ar trebui să urce trei
--    tabele (apartament → variantă → analiză) la fiecare rând citit. Cu el,
--    fiecare politică e aceeași frază scurtă, dovedită deja în producție pe
--    `grup_teren_checklist`. Plata: `grup_id` trebuie scris corect la import,
--    iar BLOC 5 (e) verifică exact asta.
--
-- 5. NIMENI NU SCRIE ANALIZA DIN PAGINĂ.
--    `analiza_teren`, `analiza_varianta`, `analiza_nivel` și
--    `analiza_apartament` primesc doar SELECT. Datele intră prin SQL Editor,
--    rulat de Lucian (unde ești `postgres` și RLS-ul nu te atinge). Fără UI de
--    admin, fără politici de scriere care să fie ocolite. Cel mai sigur drept
--    e cel care nu există.
--
--    Membrii scriu în exact trei tabele: `apartament_suprafata` (cursoarele),
--    `apartament_interes` și `grup_membru_preferinte`. Niciuna nu conține vreun
--    cost sau vreun indicator urbanistic.
--
-- 6. CE VINE DIN URBAN ANALYZER ȘI CE NU.
--    Structura variantei din UA (neschimbată între mai și august, verificat pe
--    v263_36 și v263_39) e:
--
--        {levelData:[{name:"Etaj 1", isParter:false,
--                     counts:{gars,studio,cam2,cam3,cam34}}],
--         comercialActive, suComercial, subsolOn}
--
--    De acolo vin: variantele, nivelurile, tipologiile, câte bucăți din
--    fiecare, subsolul, comercialul, Su/Sd, costul terenului, costul
--    construcției. Adică TOT ce ne trebuie.
--
--    Importul e o traducere directă, fără nicio cifră inventată pe drum:
--
--        un element din levelData    →  un rând `analiza_nivel`, cu su_mp
--        counts:{cam3:2} pe „Etaj 1" →  două rânduri `analiza_apartament`,
--                                       tip_key='cam3', mpu 66-87
--
--    Singurul lucru pe care UA nu îl dă e cât are FIECARE apartament în parte:
--    el spune „etajul 1 are 145 mp utili și pe el stau un 2 camere și un 3-4
--    camere". Nu îl inventăm noi. `mpu_propus` se calculează la import
--    împărțind Su-ul nivelului proporțional cu mijlocul intervalului fiecărei
--    tipologii, iar de acolo încolo grupul trage de cursoare cum vrea.
--    Propunerea rămâne scrisă, deci există mereu drum înapoi la ea.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — INVENTAR (nu schimbă nimic; rulează-l și trimite-mi rezultatul)
-- ───────────────────────────────────────────────────────────────────────────
-- Patru lucruri de confirmat înainte de a crea ceva:
--
--   (a) niciuna dintre cele șapte tabele NU există deja. `create table if not
--       exists` ar trece tăcut peste o tabelă străină cu același nume și am
--       construi peste ea.
--   (b) ⭐ COLOANELE DE MEMBRU. Politicile de mai jos copiază tiparul dovedit
--       de pe `grup_teren_checklist`: `grup_membri(grup_id, user_id, status)`
--       cu `status = 'activ'`, plus `grupuri.admin_id`. Dacă lista nu arată
--       exact coloanele astea, OPREȘTE-TE și trimite-mi rezultatul.
--   (c) tipul id-urilor din `grupuri`, `terenuri` și `profiles`.
--   (d) ce bucket-uri de storage există (pentru PDF-ul analizei; precedentul e
--       `checklist-files`).
--
-- ⚠️ Interogările sunt unite cu UNION ALL dinadins: editorul SQL din Supabase
--    arată DOAR rezultatul ultimei interogări dintr-un tab.

select 'a. exista deja?'             as sectiune,
       c.relname::text               as nume,
       'ATENTIE: nu ar trebui'       as detaliu,
       ''                            as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('analiza_teren', 'analiza_varianta', 'analiza_nivel',
                    'analiza_apartament', 'apartament_suprafata',
                    'apartament_interes', 'grup_membru_preferinte')

union all

select 'b. coloane de membru'        as sectiune,
       (table_name || '.' || column_name)::text as nume,
       data_type::text               as detaliu,
       ''                            as detaliu2
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'grup_membri' and column_name in ('grup_id','user_id','status'))
    or (table_name = 'grupuri'     and column_name in ('id','admin_id')))

union all

select 'c. tipul id-urilor'          as sectiune,
       (table_name || '.' || column_name)::text as nume,
       data_type::text               as detaliu,
       ''                            as detaliu2
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'terenuri' and column_name = 'id')
    or (table_name = 'profiles' and column_name = 'user_id'))

union all

select 'd. bucket-uri storage'       as sectiune,
       id::text                      as nume,
       case when public then 'PUBLIC' else 'privat' end as detaliu,
       ''                            as detaliu2
from storage.buckets

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): NU trebuie să apară niciun rând. Dacă apare vreunul, oprește-te.
--   • (b): trebuie să apară exact `grup_membri.grup_id`, `grup_membri.user_id`,
--     `grup_membri.status`, `grupuri.id`, `grupuri.admin_id`. Dacă lipsește
--     vreuna, politicile din BLOC 3 se rescriu, NU se rulează pe ghicite: o
--     politică ce citește o coloană inexistentă crapă toată interogarea, nu
--     întoarce „fals".
--   • (c): amândouă `uuid`.
--   • (d): caut `checklist-files` (ca precedent) și îmi spui dacă vrei
--     PDF-urile de analiză într-un bucket nou sau în cel existent.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Tabelele
-- ───────────────────────────────────────────────────────────────────────────

-- ── 1.1 Analiza unui teren, făcută pentru un grup ──────────────────────────
--
-- `cost_teren` și `cost_constructie_mp` sunt exact cele două cifre pe care
-- Liviu le tastează în Urban Analyzer. Din ele și din `sd_total` iese tot
-- restul, în pagină.
--
-- `tip` deosebește analiza preliminară de cea detaliată: un teren poate primi
-- amândouă, la luni distanță. De aceea NU există cheie unică pe (grup, teren):
-- același grup poate avea două analize pe același teren.
--
-- `pdf_path` e drumul în storage. Poate fi gol: o analiză poate exista ca date
-- fără să aibă fișa atașată, și invers.

create table if not exists public.analiza_teren (
    id                   uuid        primary key default gen_random_uuid(),
    grup_id              uuid        not null,
    teren_id             uuid        not null,
    tip                  text        not null default 'preliminara',
    titlu                text,
    data_analizei        date,
    -- cifrele de intrare din Urban Analyzer
    cost_teren           numeric(12,2),
    cost_constructie_mp  numeric(10,2),
    cost_subsol_pct      numeric(5,2),
    -- bilanțul, așa cum apare pe prima pagină a fișei
    suprafata_teren_mp   numeric(10,2),
    sd_total_mp          numeric(10,2),
    su_total_mp          numeric(10,2),
    pot_obtinut          numeric(6,2),
    cut_obtinut          numeric(6,3),
    -- fișa PDF
    pdf_path             text,
    pdf_nume             text,
    note                 text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

comment on table public.analiza_teren is
    'O analiză urbanistică (preliminară sau detaliată) făcută pentru UN grup pe UN teren. Cifrele vin din Urban Analyzer, instrumentul intern al lui Liviu (apartamentual-strategie/produs/urban-analyzer). Analiza NU se vede în alt grup care are același teren la favorite: o plătește un grup anume. Datele se încarcă prin SQL Editor, nu din pagină.';

comment on column public.analiza_teren.cost_constructie_mp is
    'Euro pe mp de suprafață desfășurată, tastat de arhitect în Urban Analyzer. Din el se calculează în pagină costul fiecărui apartament; NU se stochează niciun preț derivat.';


-- ── 1.2 O variantă de împărțire ────────────────────────────────────────────
--
-- Un rând per casetă „Varianta A" din machetă. Fișa din 2 august are cinci
-- variante; plafonul de 3 din Urban Analyzer a fost scos în v263_39, deci nu
-- punem nicio limită nici aici.
--
-- ⭐ NU SE STOCHEAZĂ UN COST AL CONSTRUCȚIEI (corecția lui Lucian, 28 august).
--
--    Prima formă a tabelei avea `cost_constructie numeric`, o sumă fixă a
--    variantei. Era greșit, și greșeala se vedea de îndată ce cineva trăgea de
--    un cursor: micșorând un apartament, aceeași sumă se împărțea la mai puțini
--    metri și pagina anunța o scumpire de 3%, ca și cum clădirea ar costa la
--    fel dacă se construiește mai puțin.
--
--    Lanțul corect:
--
--        Sd               = (Su împărțit + Su comun) / coef_su_sd
--        cost construcție = Sd × analiza_teren.cost_constructie_mp
--                           + subsol_sd_mp × cost_constructie_mp × cost_subsol_pct
--        cost total       = cost_teren + cost construcție
--
--    ⭐ TERENUL E SINGURA SUMĂ CARE NU SE MIȘCĂ. Prețul pe metru util tot urcă
--    atunci când rămân goluri, dar din motivul adevărat: cele 700.000 € de
--    teren se împart la mai puțini metri, deci ponderea terenului în investiție
--    crește. Asta face golurile neeficiente. Cu modelul vechi ieșeau 2,9%
--    scumpire pe o variantă; cu cel corect, 1,5%.
--
--    La fel și subsolul: parcarea rămâne aceeași chiar dacă apartamentele scad,
--    deci `subsol_sd_mp` e o suprafață fixă a variantei, nu una care se
--    recalculează. Variantele cu subsol au partea fixă mai mare și sunt
--    pedepsite mai tare de goluri.
--
-- `cost_teren` stă pe variantă, nu doar pe analiză, fiindcă e cifra folosită la
-- calcul și trebuie să rămână cea de la data analizei chiar dacă prețul cerut
-- de proprietar se schimbă între timp.

create table if not exists public.analiza_varianta (
    id                uuid        primary key default gen_random_uuid(),
    analiza_id        uuid        not null,
    grup_id           uuid        not null,   -- copiat, vezi decizia 4
    nume              text        not null,
    descriere         text,
    su_total_mp       numeric(10,2),          -- suma nivelurilor, ca reper
    sd_total_mp       numeric(10,2),          -- din fișă, ca reper
    cost_teren        numeric(12,2),
    coef_su_sd        numeric(4,3) not null default 0.700,
    subsol_sd_mp      numeric(10,2) not null default 0,
    are_subsol        boolean     not null default false,
    su_comercial_mp   numeric(10,2),
    locuri_parcare    integer,
    note              text,
    ordine            integer     not null default 0,
    created_at        timestamptz not null default now(),
    constraint analiza_varianta_coef_ok check (coef_su_sd > 0 and coef_su_sd <= 1)
);

comment on table public.analiza_varianta is
    'O variantă de împărțire din fișa de analiză („Varianta 5, 6 apartamente"). Corespunde unui element din savedVariants al Urban Analyzer. Numărul de variante nu e plafonat: fișa din 2 august 2026 are cinci. NU ține un cost al construcției: acela se calculează în pagină din suprafața pe care grupul chiar a împărțit-o, fiindcă o clădire mai mică chiar costă mai puțin.';

comment on column public.analiza_varianta.coef_su_sd is
    'Raportul suprafață utilă / suprafață desfășurată, 0,70 în Urban Analyzer. Din el se află câți metri desfășurați se construiesc pentru metrii utili împărțiți, iar de acolo costul construcției.';

comment on column public.analiza_varianta.subsol_sd_mp is
    'Suprafața desfășurată a subsolului. Fixă: parcarea rămâne aceeași chiar dacă apartamentele se micșorează. Costă analiza_teren.cost_subsol_pct la sută dintr-un metru obișnuit (implicit 70%, fiindcă săpătura, hidroizolația și sprijinirile costă).';


-- ── 1.3 Nivelurile unei variante ───────────────────────────────────────────
--
-- Tabelă cerută de cursoarele de suprafață (vezi 1.5): fără ea, nimic nu
-- oprește grupul să dea la trei apartamente de pe același etaj mai mulți metri
-- decât are etajul.
--
-- `su_mp` e PLAFONUL nivelului, cifră care vine din Urban Analyzer (`levelData`,
-- unde Su-ul unui nivel e aria lui înmulțită cu 0,7). Suma apartamentelor de pe
-- nivel nu îl poate depăși; ce rămâne sub el e suprafață încă neîmpărțită, nu
-- suprafață economisită, fiindcă se construiește și se plătește oricum.
--
-- `ordine` există fiindcă „Etaj 10" se sortează înaintea lui „Etaj 2" ca text.
-- Parterul e 0, subsolul ar fi -1. Pagina afișează de sus în jos, ca o secțiune
-- prin clădire, deci sortează descrescător.

create table if not exists public.analiza_nivel (
    id           uuid        primary key default gen_random_uuid(),
    varianta_id  uuid        not null,
    grup_id      uuid        not null,   -- copiat, vezi decizia 4
    nume         text        not null,   -- „Parter”, „Etaj 1”
    ordine       integer     not null default 0,
    su_mp        numeric(10,2) not null,
    este_parter  boolean     not null default false,
    su_comun_mp  numeric(10,2),          -- spațiu comun sau comercial pe nivel
    note         text,
    created_at   timestamptz not null default now()
);

comment on table public.analiza_nivel is
    'Un nivel dintr-o variantă, cu suprafața utilă disponibilă pe el. Vine din levelData al Urban Analyzer. su_mp e plafonul peste care suma apartamentelor de pe nivel nu poate trece atunci când membrii trag de cursoare.';

comment on column public.analiza_nivel.su_comun_mp is
    'Suprafață de pe nivel care NU se împarte pe apartamente: spațiu comun (lobby, boxe, sală) sau comercial. Costul ei se împarte oricum între apartamente, de aceea varianta cu parter comun iese mai scumpă pe metru de locuință. ⚠️ Nu se numără ca suprafață nedistribuită: la calculul scumpirii se scade din plafon, altfel un parter comun de 48 mp apare ca gol lăsat de grup și umflă prețul cu 14% în loc de 1%.';


-- ── 1.4 Un apartament dintr-o variantă ─────────────────────────────────────
--
-- Fiecare rând e o casetă din pagina de organizare.
--
-- ⭐ CE SE STOCHEAZĂ AICI SUNT LIMITELE, NU ALEGEREA.
--
--    `mpu_min` și `mpu_max` sunt intervalul din normativ (gars 37-42,
--    studio 42-52, 2 cam 52-65, 3 cam 66-87, 3-4 cam 87-120), editabil în
--    Urban Analyzer din v263_38c, deci vine cu importul. Între ele se poate
--    mișca cursorul din pagină.
--
--    `mpu_propus` e de unde pornește cursorul: propunerea arhitectului. Grupul
--    o poate schimba, dar nu o pierde, deci există mereu un „înapoi la ce a
--    propus arhitectul".
--
--    ⚠️ Suprafața pe care o ALEGE grupul nu se scrie aici, ci în
--    `apartament_suprafata` (1.5). Tabela asta rămâne parte din analiză, deci
--    strict de citit: nimeni nu trebuie să poată atinge din pagină costul
--    terenului trăgând de un cursor.
--
-- ⚠️ Suprafața construită (mpc) NU se stochează. Ar fi o valoare derivată
--    dintr-un raport care variază de la o clădire la alta, iar în pagină nu se
--    afișează nicăieri. Dacă va fi nevoie, se adaugă atunci.

create table if not exists public.analiza_apartament (
    id             uuid        primary key default gen_random_uuid(),
    nivel_id       uuid        not null,
    varianta_id    uuid        not null,   -- copiat, ca să nu urcăm mereu la nivel
    grup_id        uuid        not null,   -- copiat, vezi decizia 4
    eticheta       text,                   -- „A-11”, pentru discuția din grup
    tip_key        text        not null,   -- gars | studio | cam2 | cam3 | cam34
    tip_eticheta   text        not null,   -- „3 camere”
    mpu_min        numeric(8,2) not null,  -- capătul de jos al intervalului
    mpu_max        numeric(8,2) not null,  -- capătul de sus
    mpu_propus     numeric(8,2) not null,  -- de unde pornește cursorul
    ordine         integer     not null default 0,
    note           text,
    created_at     timestamptz not null default now(),
    constraint analiza_apartament_interval_ok check (mpu_max >= mpu_min),
    constraint analiza_apartament_propus_ok   check (mpu_propus between mpu_min and mpu_max)
);

comment on table public.analiza_apartament is
    'Un apartament dintr-o variantă: tipologia și intervalul de suprafață utilă din normativ, plus suprafața propusă de arhitect. Suprafața aleasă de grup stă separat, în apartament_suprafata: tabela asta e parte din analiză și rămâne doar de citit.';

comment on column public.analiza_apartament.mpu_propus is
    'Suprafața de la care pornește cursorul din pagină, adică propunerea arhitectului. Se păstrează chiar dacă grupul o schimbă, ca să existe mereu drum înapoi.';

comment on column public.analiza_apartament.tip_key is
    'Cheia tipologiei din Urban Analyzer (APT_TYPES): gars, studio, cam2, cam3, cam34. Text liber dinadins, nu listă închisă: tipurile pot fi excluse sau editate în UA.';


-- ── 1.5 Suprafața pe care a ales-o grupul ──────────────────────────────────
--
-- ⭐ DE CE E O TABELĂ SEPARATĂ, ȘI NU O COLOANĂ ÎN `analiza_apartament`.
--
--    Pentru că altfel analiza ar deveni scriitibilă din pagină. Ca să poată
--    trage cineva de un cursor, rolul `authenticated` ar avea nevoie de UPDATE
--    pe `analiza_apartament`, iar de acolo până la un UPDATE trimis direct prin
--    PostgREST pe altă coloană e un pas. Aici, drepturile de scriere stau pe o
--    tabelă care nu conține niciun cost și niciun indicator urbanistic: paguba
--    maximă e o suprafață greșită, vizibilă imediat de tot grupul.
--
--    Efectul secundar util: un rând lipsă înseamnă „nimeni n-a mișcat nimic",
--    deci pagina cade pe `mpu_propus`, propunerea arhitectului. Ștergerea unui
--    rând readuce apartamentul la ea, fără nicio coloană de „valoare inițială".
--
-- ⚠️ Nu există constrângere care să oprească suma de pe un nivel să treacă
--    peste `analiza_nivel.su_mp`. Baza nu poate verifica o sumă pe grup de
--    rânduri fără un declanșator, iar un declanșator pe calea asta ar transforma
--    fiecare tragere de cursor într-o blocare de tabelă. Plafonul se ține în
--    pagină (cursorul nu urcă peste cât e liber pe nivel), iar BLOC 5 (f) îl
--    verifică după fapt. Dacă vreodată apare o depășire, e o greșeală de cod,
--    nu de om.
--
-- `updated_by` rămâne ca să știe grupul cine a mișcat ultima oară: e o
-- negociere între oameni, iar „cine a schimbat asta" e prima întrebare.

create table if not exists public.apartament_suprafata (
    apartament_id  uuid        primary key,
    grup_id        uuid        not null,   -- copiat, vezi decizia 4
    mpu            numeric(8,2) not null,
    updated_by     uuid,
    updated_at     timestamptz not null default now()
);

comment on table public.apartament_suprafata is
    'Suprafața utilă pe care a ales-o grupul pentru un apartament, trăgând de cursorul din pagină. Un rând lipsă înseamnă că nimeni n-a mișcat nimic și se folosește analiza_apartament.mpu_propus. Separată de analiză dinadins: aici e singurul loc din organizarea pe apartamente unde membrii au drept de scriere pe date care vin din analiză, și nu conține niciun cost.';


-- ── 1.6 Cine s-a înscris pe ce apartament ──────────────────────────────────
--
-- Cheia primară e perechea (apartament, om): baza garantează singură că nimeni
-- nu apare de două ori pe același apartament, oricâte clicuri dă.
--
-- Un om poate marca oricâte apartamente, din oricâte variante. Asta e voit:
-- variantele sunt alternative, iar „mi-ar plăcea ăsta din A și ăsta din B" e
-- exact informația de care are nevoie grupul.

create table if not exists public.apartament_interes (
    apartament_id  uuid        not null,
    user_id        uuid        not null,
    grup_id        uuid        not null,   -- copiat, vezi decizia 4
    created_at     timestamptz not null default now(),
    primary key (apartament_id, user_id)
);

comment on table public.apartament_interes is
    'Membrii care și-au marcat interesul pe un apartament. Numele lor se văd de toți membrii grupului (decizia lui Lucian, 27 august 2026): rostul uneltei e să arate unde se calcă grupul pe picioare, iar un simplu număr nu pornește nicio discuție. Un om poate marca oricâte apartamente, din oricâte variante.';


-- ── 1.7 Ce vrea fiecare membru, independent de orice analiză ───────────────
--
-- Partea care funcționează CHIAR ȘI PE UN GRUP FĂRĂ NICIUN TEREN ANALIZAT.
-- Un grup de 20 de oameni vede dintr-o privire dacă toți vor 3 camere la
-- etajul 1. Se completează o dată, se vede în pagina grupului lângă membri și
-- se reia în pagina de organizare, ca în josul machetei.
--
-- Cheia e (grup, om), nu omul singur: în două grupuri diferite poți vrea
-- altceva. Preferința e despre proiectul acela, nu despre viață în general.
--
-- ⭐ COLOANELE VIN DIN EXCELUL GRUPULUI PARCUL CIRCULUI (screenshot-uri în
--    `handoff/xcel grup parc circului/`, 27 august 2026). Grupul acela a
--    ignorat platforma și și-a făcut singur un Google Sheet, fiindcă le era mai
--    ușor. Coloanele lor sunt lista de nevoi reale, verificată pe nouă oameni,
--    nu o presupunere de-a noastră. Le acoperim pe toate, altfel îi mutăm
--    dintr-un tabel care merge într-un formular mai sărac.
--
-- ⭐ BUGETUL E ÎMPĂRȚIT ÎN DOUĂ, ca la ei, și asta NU e o redundanță:
--    · `buget_teren_cash` — banii pe care omul îi are LICHIZI, acum, pentru
--      partea lui din teren. Terenul se cumpără cash, înainte de orice credit.
--    · `buget_total` — cât poate duce în total, cu credit cu tot.
--    Sunt două întrebări diferite puse aceluiași om, iar prima e cea care
--    decide dacă grupul poate cumpăra terenul luna asta. Fără ele, „mă
--    interesează apartamentul ăsta" nu spune nimic: nu știi dacă îl poate
--    plăti.
--
-- ⭐ CAMERELE ȘI SUPRAFAȚA NU SE CER AICI DIN NOU. Sunt deja în profil, ca
--    `profiles.preferred_rooms` și `profiles.preferred_area_sqm`, amândouă
--    `required` în formular ȘI parte din definiția SQL a „profilului complet",
--    care e condiția de intrare într-un grup. Cine e într-un grup le are
--    completate, altfel n-ar fi putut intra. (Verificat pe 28 august 2026 în
--    `profile-edit-new.html` și în `db_schema/creare-grup-profil-complet/`.)
--
--    `nr_camere` și `mpu_dorit` de mai jos sunt NULL în mod normal și înseamnă
--    „ca în profil". Se completează DOAR când omul vrea altceva anume în
--    grupul acesta („în general vreau 100 mp, dar pe terenul ăsta accept 80").
--
--    ⚠️ NU se copiază valorile din profil la înscriere. O valoare copiată
--    rămâne veche după ce omul își schimbă profilul, iar apoi nimeni nu mai
--    știe care dintre cele două e adevărul. NULL înseamnă „întreabă profilul",
--    și întrebarea se pune de fiecare dată.
--
-- ⭐ `etaj` E LISTĂ ÎNCHISĂ, NU TEXT LIBER. În Excelul lor asta era o notă
--    („dispus să locuiască la parter / ultimul etaj"): se citește bine de om,
--    dar nu se poate număra. Cu valori fixe, pagina poate spune „2 din 9
--    acceptă parter", ceea ce chiar hotărăște dacă parterul se face locuință
--    sau parcare. Valorile sunt în comentariul de pe coloană.
--
--    Nu e pusă ca `check`, ci ca înțelegere între pagină și bază: lista se va
--    mai lungi, iar o constrângere ar cere migrație la fiecare valoare nouă.
--    Paguba maximă a unei valori scrise greșit e o preferință care nu se
--    numără nicăieri.
--
-- `note` rămâne singura casetă liberă, pentru ce nu încape în rubrici.

create table if not exists public.grup_membru_preferinte (
    grup_id           uuid        not null,
    user_id           uuid        not null,
    -- ce fel de apartament; NULL = ca în profil
    nr_camere         integer,
    mpu_dorit         numeric(8,2),
    etaj              text,
    -- ce mai are nevoie pe lângă apartament
    locuri_parcare    integer,
    boxa              boolean,
    -- banii
    buget_teren_cash  numeric(12,2),
    buget_total       numeric(12,2),
    note              text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    primary key (grup_id, user_id)
);

comment on table public.grup_membru_preferinte is
    'Ce își dorește fiecare membru în grupul acesta: etajul, locurile de parcare, boxa și cei doi bugeți (cash pentru teren, total cu credit). Camerele și suprafața NU se țin aici decât dacă omul vrea altceva decât scrie în profilul lui: NULL înseamnă „ca în profil". Coloanele vin din Google Sheet-ul pe care și l-a făcut singur grupul Parcul Circului în august 2026, ignorând platforma. Nu depinde de nicio analiză, deci un grup o poate folosi din prima zi.';

comment on column public.grup_membru_preferinte.nr_camere is
    'NULL = se citește profiles.preferred_rooms. Se completează doar când omul vrea altceva în grupul acesta decât în general. Nu se copiază din profil la înscriere: o copie rămâne veche după ce profilul se schimbă.';

comment on column public.grup_membru_preferinte.mpu_dorit is
    'NULL = se citește profiles.preferred_area_sqm. La fel ca nr_camere.';

comment on column public.grup_membru_preferinte.etaj is
    'Listă închisă, scrisă în pagină: orice, parter, etaj-1-2, superior, ultim, parter-sau-ultim. Nu text liber, ca să se poată număra câți din grup acceptă parterul.';

comment on column public.grup_membru_preferinte.buget_teren_cash is
    'Banii lichizi pentru partea lui din teren. Separat de buget_total fiindcă terenul se cumpără cash, înainte de orice credit: e întrebarea care decide dacă grupul poate cumpăra acum.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Legăturile (rulează-l separat)
-- ───────────────────────────────────────────────────────────────────────────
-- Fac curat singure: la ștergerea unui grup, a unui teren sau a unei analize
-- dispare tot ce atârnă de ele.
--
-- Legăturile către `auth.users` sunt puse în blocuri separate, ca la
-- `grup_teren_checklist`: dacă proiectul nu permite chei străine către schema
-- `auth`, blocul dă eroare și pur și simplu nu-l rulezi. Tabelele funcționează
-- și fără ele.
--
-- ⚠️ Când selectezi cu mouse-ul, pornește de la `do $$`, NU de la `begin`.
--    O selecție care lasă `do $$` afară dă o eroare care arată ca o greșeală de
--    cod, dar e una de copiere.

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'analiza_teren_grup_fk') then
        alter table public.analiza_teren add constraint analiza_teren_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'analiza_teren_teren_fk') then
        alter table public.analiza_teren add constraint analiza_teren_teren_fk
            foreign key (teren_id) references public.terenuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'analiza_varianta_analiza_fk') then
        alter table public.analiza_varianta add constraint analiza_varianta_analiza_fk
            foreign key (analiza_id) references public.analiza_teren(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'analiza_varianta_grup_fk') then
        alter table public.analiza_varianta add constraint analiza_varianta_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'analiza_nivel_varianta_fk') then
        alter table public.analiza_nivel add constraint analiza_nivel_varianta_fk
            foreign key (varianta_id) references public.analiza_varianta(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'analiza_nivel_grup_fk') then
        alter table public.analiza_nivel add constraint analiza_nivel_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'analiza_apartament_nivel_fk') then
        alter table public.analiza_apartament add constraint analiza_apartament_nivel_fk
            foreign key (nivel_id) references public.analiza_nivel(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'analiza_apartament_varianta_fk') then
        alter table public.analiza_apartament add constraint analiza_apartament_varianta_fk
            foreign key (varianta_id) references public.analiza_varianta(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'analiza_apartament_grup_fk') then
        alter table public.analiza_apartament add constraint analiza_apartament_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

-- `apartament_suprafata` cade odată cu apartamentul: o suprafață aleasă pentru
-- un apartament care nu mai există n-are ce căuta nicăieri.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'apartament_suprafata_apartament_fk') then
        alter table public.apartament_suprafata add constraint apartament_suprafata_apartament_fk
            foreign key (apartament_id) references public.analiza_apartament(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'apartament_suprafata_grup_fk') then
        alter table public.apartament_suprafata add constraint apartament_suprafata_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'apartament_interes_apartament_fk') then
        alter table public.apartament_interes add constraint apartament_interes_apartament_fk
            foreign key (apartament_id) references public.analiza_apartament(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'apartament_interes_grup_fk') then
        alter table public.apartament_interes add constraint apartament_interes_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'grup_membru_preferinte_grup_fk') then
        alter table public.grup_membru_preferinte add constraint grup_membru_preferinte_grup_fk
            foreign key (grup_id) references public.grupuri(id) on delete cascade;
    end if;
end $$;

-- Legăturile către `auth.users`. Dacă blocul ăsta dă eroare, sari peste el.
-- `updated_by` e pe `set null`, nu `cascade`: dacă omul care a mișcat ultima
-- oară un cursor își șterge contul, suprafața aleasă rămâne (grupul chiar a
-- hotărât-o), doar numele de lângă ea dispare.
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'apartament_interes_user_fk') then
        alter table public.apartament_interes add constraint apartament_interes_user_fk
            foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'grup_membru_preferinte_user_fk') then
        alter table public.grup_membru_preferinte add constraint grup_membru_preferinte_user_fk
            foreign key (user_id) references auth.users(id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'apartament_suprafata_user_fk') then
        alter table public.apartament_suprafata add constraint apartament_suprafata_user_fk
            foreign key (updated_by) references auth.users(id) on delete set null;
    end if;
end $$;

-- Indecșii pentru cum se citește chiar: „dă-mi analiza grupului ăstuia pe
-- terenul ăsta", apoi „variantele ei", apoi „nivelurile", apoi „apartamentele".
create index if not exists analiza_teren_grup_teren_idx
    on public.analiza_teren (grup_id, teren_id);
create index if not exists analiza_varianta_analiza_idx
    on public.analiza_varianta (analiza_id, ordine);
create index if not exists analiza_nivel_varianta_idx
    on public.analiza_nivel (varianta_id, ordine);
create index if not exists analiza_apartament_nivel_idx
    on public.analiza_apartament (nivel_id, ordine);
create index if not exists analiza_apartament_varianta_idx
    on public.analiza_apartament (varianta_id);
create index if not exists apartament_suprafata_grup_idx
    on public.apartament_suprafata (grup_id);
create index if not exists apartament_interes_apartament_idx
    on public.apartament_interes (apartament_id);
create index if not exists apartament_interes_user_idx
    on public.apartament_interes (user_id);


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Cine vede ce (RLS)
-- ───────────────────────────────────────────────────────────────────────────
-- Regula, în cuvinte: analiza unui grup se vede DOAR de membrii activi ai
-- grupului aceluia și de fondatorul lui. Nimeni altcineva: nici cine vede
-- terenul pe site, nici alt grup care are același teren la favorite, nici
-- superadminul.
--
-- ⚠️ DE CE NU FOLOSIM `is_group_member()`, deși funcția există. Nu-i știm
--    corpul: nu se vede din inventar dacă e `security definer`. Dacă NU e,
--    citește `grup_membri` sub RLS-ul celui care întreabă, iar `grup_membri` e
--    o tabelă închisă din 2 august. Ar întoarce `false` pentru un membru
--    adevărat, politica ar tăcea, iar pagina s-ar goli fără nicio eroare.
--    Mai jos e copiat EXACT tiparul care merge azi pe `grup_teren_checklist`,
--    dovedit în producție.
--
-- ⚠️ ANALIZA NU ARE POLITICI DE SCRIERE, DINADINS (decizia 5). Datele intră
--    prin SQL Editor, unde ești `postgres` și RLS-ul nu te atinge. Nicio
--    politică de INSERT înseamnă că nimeni nu poate insera din pagină, oricât
--    de creativ ar fi cu PostgREST.

alter table public.analiza_teren          enable row level security;
alter table public.analiza_varianta       enable row level security;
alter table public.analiza_nivel          enable row level security;
alter table public.analiza_apartament     enable row level security;
alter table public.apartament_suprafata   enable row level security;
alter table public.apartament_interes     enable row level security;
alter table public.grup_membru_preferinte enable row level security;

-- ── 3.1 Analiza, variantele, apartamentele: doar citire, doar membrii ──────

drop policy if exists at_select_membri on public.analiza_teren;
create policy at_select_membri on public.analiza_teren
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = analiza_teren.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = analiza_teren.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists av_select_membri on public.analiza_varianta;
create policy av_select_membri on public.analiza_varianta
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = analiza_varianta.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = analiza_varianta.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists an_select_membri on public.analiza_nivel;
create policy an_select_membri on public.analiza_nivel
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = analiza_nivel.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = analiza_nivel.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists aa_select_membri on public.analiza_apartament;
create policy aa_select_membri on public.analiza_apartament
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = analiza_apartament.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = analiza_apartament.grup_id
                      and g.admin_id = auth.uid())
    );

-- ── 3.1b Suprafețele alese: le mișcă ORICINE din grup ─────────────────────
--
-- ⚠️ Aici NU se cere `user_id = auth.uid()`, spre deosebire de interes și de
--    preferințe, fiindcă suprafața nu aparține nimănui: e împărțirea clădirii,
--    hotărâtă de grup. Oricine e înăuntru poate trage de orice cursor, exact
--    ca la bifele de pe teren.
--
--    Riscul real nu e cineva care strică dinadins, ci doi oameni care trag în
--    același timp. Ultimul scrie peste primul, iar `updated_by` arată cine a
--    fost. Într-un grup unde toți se cunosc și vorbesc pe WhatsApp, asta e
--    suficient; o blocare pe rând ar fi o unealtă mai complicată decât
--    problema pe care o rezolvă.
--
-- Există UPDATE și DELETE separat de INSERT fiindcă pagina scrie prin `upsert`
-- (rândul poate exista sau nu), iar ștergerea readuce apartamentul la
-- propunerea arhitectului, fără nicio coloană în plus.

drop policy if exists asup_select_membri on public.apartament_suprafata;
create policy asup_select_membri on public.apartament_suprafata
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_suprafata.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_suprafata.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists asup_insert_membri on public.apartament_suprafata;
create policy asup_insert_membri on public.apartament_suprafata
    for insert to authenticated
    with check (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_suprafata.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_suprafata.grup_id
                      and g.admin_id = auth.uid())
    );

-- `using` = pe ce rânduri am voie să pun mâna; `with check` = cum au voie să
-- arate DUPĂ modificare. Fără al doilea, un membru ar putea muta un rând pe
-- `grup_id`-ul altui grup.
drop policy if exists asup_update_membri on public.apartament_suprafata;
create policy asup_update_membri on public.apartament_suprafata
    for update to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_suprafata.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_suprafata.grup_id
                      and g.admin_id = auth.uid())
    )
    with check (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_suprafata.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_suprafata.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists asup_delete_membri on public.apartament_suprafata;
create policy asup_delete_membri on public.apartament_suprafata
    for delete to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_suprafata.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_suprafata.grup_id
                      and g.admin_id = auth.uid())
    );

-- ── 3.2 Interesul: toți membrii îl CITESC cu nume, fiecare scrie doar al lui ──
--
-- SELECT larg (decizia 2): oricine e în grup vede cine s-a înscris unde.
-- INSERT și DELETE strâmte: `user_id = auth.uid()` înseamnă că nu poți înscrie
-- pe altcineva și nu poți retrage pe altcineva.
--
-- Nu există politică de UPDATE: rândul n-are ce actualizări să primească. Te
-- înscrii sau te retragi, atât.

drop policy if exists ai_select_membri on public.apartament_interes;
create policy ai_select_membri on public.apartament_interes
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = apartament_interes.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = apartament_interes.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists ai_insert_propriu on public.apartament_interes;
create policy ai_insert_propriu on public.apartament_interes
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and (
            exists (select 1 from public.grup_membri m
                     where m.grup_id = apartament_interes.grup_id
                       and m.user_id = auth.uid()
                       and m.status::text = 'activ')
            or exists (select 1 from public.grupuri g
                        where g.id = apartament_interes.grup_id
                          and g.admin_id = auth.uid())
        )
    );

drop policy if exists ai_delete_propriu on public.apartament_interes;
create policy ai_delete_propriu on public.apartament_interes
    for delete to authenticated
    using (user_id = auth.uid());

-- ── 3.3 Preferințele: la fel, citite de toți, scrise de fiecare ale lui ────
--
-- `using` = pe ce rânduri am voie să pun mâna; `with check` = cum au voie să
-- arate DUPĂ modificare. Fără al doilea, un membru și-ar putea muta preferința
-- pe `user_id`-ul altcuiva.

drop policy if exists gmp_select_membri on public.grup_membru_preferinte;
create policy gmp_select_membri on public.grup_membru_preferinte
    for select to authenticated
    using (
        exists (select 1 from public.grup_membri m
                 where m.grup_id = grup_membru_preferinte.grup_id
                   and m.user_id = auth.uid()
                   and m.status::text = 'activ')
        or exists (select 1 from public.grupuri g
                    where g.id = grup_membru_preferinte.grup_id
                      and g.admin_id = auth.uid())
    );

drop policy if exists gmp_insert_propriu on public.grup_membru_preferinte;
create policy gmp_insert_propriu on public.grup_membru_preferinte
    for insert to authenticated
    with check (
        user_id = auth.uid()
        and (
            exists (select 1 from public.grup_membri m
                     where m.grup_id = grup_membru_preferinte.grup_id
                       and m.user_id = auth.uid()
                       and m.status::text = 'activ')
            or exists (select 1 from public.grupuri g
                        where g.id = grup_membru_preferinte.grup_id
                          and g.admin_id = auth.uid())
        )
    );

drop policy if exists gmp_update_propriu on public.grup_membru_preferinte;
create policy gmp_update_propriu on public.grup_membru_preferinte
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists gmp_delete_propriu on public.grup_membru_preferinte;
create policy gmp_delete_propriu on public.grup_membru_preferinte
    for delete to authenticated
    using (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Drepturile pe tabele
-- ───────────────────────────────────────────────────────────────────────────
-- RLS spune CARE RÂNDURI, granturile spun DACĂ AI VOIE SĂ ATINGI TABELA. Sunt
-- două lucruri diferite și trebuie amândouă: cu politici perfecte și fără
-- grant, pagina primește „permission denied for table analiza_apartament".
--
-- ⚠️ SE REVOCĂ ȘI DE LA `authenticated`, ÎNAINTE de grant. În Supabase tabelele
--    noi vin cu drepturi depline, iar `revoke ... from public` NU acoperă
--    `authenticated`: e un rol separat, care își primește drepturile direct.
--    Fără rândurile astea, tabelele rămân cu TRUNCATE dat utilizatorilor
--    logați, iar TRUNCATE nu e atins de RLS: ar goli analizele TUTUROR
--    grupurilor dintr-o dată.
--
-- Cele trei tabele de analiză primesc DOAR select. Nici insert, nici update,
-- nici delete: datele intră prin SQL Editor (decizia 5).

revoke all on public.analiza_teren          from anon, public, authenticated;
revoke all on public.analiza_varianta       from anon, public, authenticated;
revoke all on public.analiza_nivel          from anon, public, authenticated;
revoke all on public.analiza_apartament     from anon, public, authenticated;
revoke all on public.apartament_suprafata   from anon, public, authenticated;
revoke all on public.apartament_interes     from anon, public, authenticated;
revoke all on public.grup_membru_preferinte from anon, public, authenticated;

grant select                          on public.analiza_teren          to authenticated;
grant select                          on public.analiza_varianta       to authenticated;
grant select                          on public.analiza_nivel          to authenticated;
grant select                          on public.analiza_apartament     to authenticated;
grant select, insert, update, delete  on public.apartament_suprafata   to authenticated;
grant select, insert, delete          on public.apartament_interes     to authenticated;
grant select, insert, update, delete  on public.grup_membru_preferinte to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 5 — VERIFICARE STRUCTURALĂ (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Blocul arată că tabelele ARATĂ cum trebuie. NU arată că RLS-ul chiar
--    refuză pe cineva: în SQL Editor ești `postgres`, `auth.uid()` e NULL și
--    politicile nici nu te ating. Proba adevărată se dă din pagină, logat, cu
--    un cont care NU e în grup, plus un curl cu cheia anonimă.

select 'a. tabele'          as sectiune,
       c.relname::text      as nume,
       ('RLS: ' || c.relrowsecurity::text) as detaliu,
       ''                   as detaliu2
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('analiza_teren','analiza_varianta','analiza_nivel',
                    'analiza_apartament','apartament_suprafata',
                    'apartament_interes','grup_membru_preferinte')

union all

select 'b. politici'        as sectiune,
       (tablename || ' · ' || policyname)::text as nume,
       (cmd || ' / ' || array_to_string(roles, ','))::text as detaliu,
       ''                   as detaliu2
from pg_policies
where schemaname = 'public'
  and tablename in ('analiza_teren','analiza_varianta','analiza_nivel',
                    'analiza_apartament','apartament_suprafata',
                    'apartament_interes','grup_membru_preferinte')

union all

select 'c. drepturi'        as sectiune,
       (table_name || ' · ' || grantee)::text as nume,
       privilege_type::text as detaliu,
       ''                   as detaliu2
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('analiza_teren','analiza_varianta','analiza_nivel',
                     'analiza_apartament','apartament_suprafata',
                     'apartament_interes','grup_membru_preferinte')
  and grantee in ('anon','authenticated','public')

union all

select 'd. legaturi'        as sectiune,
       conname::text        as nume,
       conrelid::regclass::text as detaliu,
       ''                   as detaliu2
from pg_constraint
where contype = 'f'
  and conrelid::regclass::text in ('analiza_teren','analiza_varianta','analiza_nivel',
                                   'analiza_apartament','apartament_suprafata',
                                   'apartament_interes','grup_membru_preferinte')

union all

-- (e) Plasa de siguranță pentru `grup_id`-ul copiat (decizia 4): dacă o
-- variantă e scrisă pe alt grup decât analiza ei, membrii n-ar vedea-o, iar
-- pagina ar tăcea. Rulează-l ȘI după fiecare import de analiză.
select 'e. grup_id nepotrivit' as sectiune,
       v.nume::text            as nume,
       'VARIANTA pe alt grup decat analiza' as detaliu,
       ''                      as detaliu2
from public.analiza_varianta v
join public.analiza_teren a on a.id = v.analiza_id
where v.grup_id <> a.grup_id

union all

select 'e. grup_id nepotrivit' as sectiune,
       n.nume::text            as nume,
       'NIVEL pe alt grup decat varianta' as detaliu,
       ''                      as detaliu2
from public.analiza_nivel n
join public.analiza_varianta v on v.id = n.varianta_id
where n.grup_id <> v.grup_id

union all

select 'e. grup_id nepotrivit' as sectiune,
       coalesce(ap.eticheta, ap.tip_eticheta)::text as nume,
       'APARTAMENT pe alt grup decat nivelul' as detaliu,
       ''                      as detaliu2
from public.analiza_apartament ap
join public.analiza_nivel n on n.id = ap.nivel_id
where ap.grup_id <> n.grup_id

union all

-- (f) Depășirea plafonului pe nivel. Baza NU o poate opri singură: ar cere un
-- declanșator care să adune rândurile fraților la fiecare scriere, adică o
-- blocare de tabelă la fiecare tragere de cursor. Plafonul se ține în pagină
-- (cursorul nu urcă peste cât e liber pe nivel), iar aici se verifică după
-- fapt. Un rând întors aici înseamnă o greșeală de cod, nu una de om.
--
-- ⚠️ `coalesce(s.mpu, ap.mpu_propus)`: un apartament pe care nu l-a mișcat
--    nimeni nu are rând în `apartament_suprafata` și contează cu propunerea
--    arhitectului. Fără `coalesce`, nivelurile neatinse ar părea goale.
select 'f. nivel depasit'      as sectiune,
       (v.nume || ' · ' || n.nume)::text as nume,
       (round(sum(coalesce(s.mpu, ap.mpu_propus)), 2)::text
         || ' mp pusi pe un nivel de ' || n.su_mp::text) as detaliu,
       ''                      as detaliu2
from public.analiza_apartament ap
join public.analiza_nivel n     on n.id = ap.nivel_id
join public.analiza_varianta v  on v.id = n.varianta_id
left join public.apartament_suprafata s on s.apartament_id = ap.id
group by v.nume, n.nume, n.su_mp, n.su_comun_mp
having sum(coalesce(s.mpu, ap.mpu_propus)) > n.su_mp - coalesce(n.su_comun_mp, 0)

order by sectiune, nume, detaliu;

-- Cum se citește:
--   • (a): șapte rânduri, toate cu `RLS: true`.
--   • (b): câte o politică de SELECT pe fiecare dintre cele patru tabele de
--     analiză, 4 pe `apartament_suprafata` (select/insert/update/delete), 3 pe
--     `apartament_interes` (select/insert/delete), 4 pe preferințe. Toate pe
--     rolul `authenticated`. NICIO politică de INSERT/UPDATE/DELETE pe cele
--     PATRU tabele de analiză: dacă apare vreuna, spune-mi.
--   • (c): `anon` NU trebuie să apară deloc. `authenticated` are DOAR SELECT pe
--     cele patru tabele de analiză. Dacă apare TRUNCATE undeva, REVOKE-ul din
--     BLOC 4 n-a prins.
--   • (d): 17 legături.
--   • (e): ZERO rânduri. Orice rând aici e o parte de analiză invizibilă pentru
--     grupul ei, fără nicio eroare în pagină.
--   • (f): ZERO rânduri.

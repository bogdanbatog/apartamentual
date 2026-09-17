-- ═══════════════════════════════════════════════════════════════════════════
-- DUPLEXURILE
-- 17 septembrie 2026
--
-- CE FACE. Adaugă O SINGURĂ coloană pe `analiza_apartament`, `duplex_nr`, goală
-- la toate rândurile care există azi. Nu schimbă nicio coloană existentă, nicio
-- politică RLS, niciun drept, nicio suprafață aleasă de oameni, nicio înscriere.
-- Galvani, Bosianu și Despot Vodă arată exact ca înainte.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE
--
-- Din 8 septembrie Urban Analyzer poate lega două (sau trei) apartamente de pe
-- niveluri succesive într-o singură locuință: un duplex. În CSV fiecare jumătate
-- e un rând separat, cu `apt_nr = 1`. Importul de până acum le lua drept
-- apartamente independente: la Radovici 4 ieșeau 8 apartamente în loc de 6,
-- fiecare jumătate cu prețul și înscrierile ei.
--
-- Jumătățile aceluiași duplex primesc același `duplex_nr`. Cheia e perechea
-- (varianta_id, duplex_nr), NU numărul singur:
--
-- ⚠️ Numărul NU e unic în tot exportul, deși spec-ul lui Liviu spune că ar fi.
--    La Radovici 4, „duplexul 1" din V1 e studio + 3 camere, iar „duplexul 1"
--    din V2 e studio + garsonieră. Sunt locuințe diferite, în variante diferite.
--
-- ⭐ CE RĂMÂNE PE FIECARE JUMĂTATE, și de ce nu s-a făcut o tabelă `duplex`:
--    Suprafața fiecărei jumătăți stă în bugetul NIVELULUI ei (regula 1 din
--    spec): o jumătate de la parter ia din parter, cealaltă din etajul 1. Deci
--    fiecare rămâne un rând în `analiza_apartament`, cu cursorul ei în
--    `apartament_suprafata`, exact ca până acum. Ce e comun (prețul, cine s-a
--    înscris) se calculează în pagină din suma jumătăților.
--
-- CE NU SE ȚINE, fiindcă iese din ce există deja:
--    · intervalul întregului duplex = suma intervalelor jumătăților
--      (la Radovici: 42 + 66 = 108, 52 + 87 = 139, exact cifrele din CSV);
--    · parcarea: locurile pe variantă vin deja corect din `var_parcaje_necesare`;
--    · „duplex" sau „triplex": câte jumătăți au același număr.
--
-- ⚠️ ÎNSCRIEREA PE DUPLEX se scrie o singură dată, pe jumătatea de la nivelul
--    cel mai de jos. Regula e ținută de pagină, nu de bază: `apartament_interes`
--    rămâne neatinsă, cu aceleași politici.
--
-- ⚠️ NU pune begin / rollback în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un rollback „de probă" anulează tăcut
--    și coloana de mai sus.
--
-- ⚠️ SE RULEAZĂ ÎNAINTE DE IMPORTUL RADOVICI 4. SQL-ul generat scrie în coloana
--    asta, deci fără ea blocul 4 al importului crapă cu
--    „column duplex_nr does not exist".
--
-- RULEAZĂ BLOCURILE PE RÂND: 1 → 2.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · COLOANA.
--
-- Nullable dinadins: gol înseamnă „apartament obișnuit", adică tot ce există
-- azi. Condiția `> 0` oprește un zero scris din greșeală, care altfel ar lega
-- între ele toate apartamentele cu zero dintr-o variantă.
--
-- Drepturile NU trebuie atinse: `authenticated` are SELECT pe toată tabela
-- (nu pe coloane), deci coloana nouă se citește din prima. Tabela e citită
-- direct de pagină, nu printr-un view, deci nu se lovește de capcana
-- `profiles_visible` (coloane înghețate la crearea view-ului).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.analiza_apartament
  add column if not exists duplex_nr smallint;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'analiza_apartament_duplex_ok') then
        alter table public.analiza_apartament add constraint analiza_apartament_duplex_ok
            check (duplex_nr is null or duplex_nr > 0);
    end if;
end $$;

comment on column public.analiza_apartament.duplex_nr is
    'Gol la un apartament obișnuit. La un duplex (sau triplex) din Urban Analyzer, jumătățile de pe niveluri diferite poartă același număr, unic doar ÎN VARIANTĂ: cheia e (varianta_id, duplex_nr). Fiecare jumătate își ține suprafața în bugetul nivelului ei; prețul și înscrierea sunt ale locuinței întregi și se calculează în pagină. Înscrierea se scrie doar pe jumătatea de la nivelul cel mai de jos.';


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VERIFICAREA. Nu schimbă nimic.
-- ═══════════════════════════════════════════════════════════════════════════

select column_name, data_type, is_nullable,
       (select count(*) from public.analiza_apartament)                         as apartamente_total,
       (select count(*) from public.analiza_apartament where duplex_nr is not null) as jumatati_de_duplex
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'analiza_apartament'
   and column_name  = 'duplex_nr';

-- CE TREBUIE SĂ VEZI: un rând, `smallint`, `YES`, iar `jumatati_de_duplex` = 0
-- (niciuna din analizele importate până azi n-are duplex).

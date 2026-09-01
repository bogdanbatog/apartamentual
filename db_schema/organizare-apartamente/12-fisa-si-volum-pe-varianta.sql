-- ═══════════════════════════════════════════════════════════════════════════
-- FIȘA PDF ȘI VOLUMUL KML, PE VARIANTĂ
-- 1 septembrie 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: patru coloane noi pe `analiza_varianta` și încă un tip de fișier
-- acceptat în bucketul `analize-fise`.
--
-- CE ATINGE: doar lucruri NOI pe o tabelă din pachetul „Împărțirea
-- apartamentelor”, plus lista de tipuri acceptate a unui bucket făcut acum
-- patru zile. ZERO atingeri la plăți, la Oblio, la Netopia, la `profiles`, la
-- politici existente.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un ROLLBACK pus „de probă” anulează
--    tăcut și modificările de deasupra lui.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND: 0 → 1 → 2 → 3.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE PE VARIANTĂ ȘI NU PE ANALIZĂ
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fiindcă asta spun fișierele. La Luigi Galvani, Urban Analyzer a scos două
-- exporturi, unul pentru P+4 și unul pentru P+5, iar fiecare vine la pachet cu
-- fișa lui PDF și cu KML-ul lui. KML-ul nu e al unei variante anume: e volumul
-- construibil al ipotezei de volum, „5 niveluri” față de „6 niveluri”, deci
-- toate cele patru variante P+4 arată la fel în Google Earth.
--
-- Adevăratul proprietar al fișierelor e deci **setul**, adică ipoteza de volum.
-- Setul nu e o tabelă la noi, și nu merită să devină una pentru două linkuri:
-- ar însemna tabelă nouă, RLS nou, politici noi. Aici plătim în schimb o
-- repetare: aceeași cale scrisă pe trei sau patru variante.
--
-- Plata asta se întoarce ca avantaj în ziua în care Liviu scoate câte un KML
-- pe variantă, ceea ce e drumul firesc al instrumentului. Atunci nu se schimbă
-- nimic: se scriu pur și simplu căi diferite.
--
-- `analiza_teren.pdf_path` RĂMÂNE și rămâne folosit: e fișa analizei întregi,
-- pentru cazul obișnuit al unei analize cu un singur set. Pagina cade pe ea
-- când varianta nu are una a ei.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — Verificare. Nu schimbă nimic.
-- ───────────────────────────────────────────────────────────────────────────
--
-- Cele două secțiuni ies într-un singur tabel, prin UNION ALL: editorul SQL
-- din Supabase arată doar rezultatul ULTIMEI interogări dintr-un tab.

select * from (
  -- (a) coloanele NU trebuie să existe încă
  select 1 as ord, 'coloană existentă deja' as sectiune,
         column_name as detaliu, data_type as extra
    from information_schema.columns
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and column_name in ('pdf_path', 'pdf_nume', 'kml_path', 'kml_nume')
  union all
  -- (b) ce tipuri acceptă azi bucketul
  select 2, 'bucket analize-fise', coalesce(array_to_string(allowed_mime_types, ', '),
         '(orice tip)'), file_size_limit::text
    from storage.buckets
   where id = 'analize-fise'
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • NICIUN rând „coloană existentă deja”. Dacă apare vreunul, BLOC 1 s-a
--     rulat deja și nu se mai rulează încă o dată (deși `if not exists` îl
--     face inofensiv).
--   • un rând „bucket analize-fise” cu `application/pdf` și 26214400.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Coloanele
-- ───────────────────────────────────────────────────────────────────────────
--
-- Toate patru sunt nullable: o variantă poate să nu aibă niciun fișier, și
-- aceea e starea obișnuită până urcă cineva ceva.
--
-- ⚠️ NU e nevoie de niciun GRANT nou. `analiza_varianta` are un grant de
--    SELECT pe TABELĂ, nu pe coloane, iar acela acoperă și coloanele adăugate
--    după el. Capcana din `profiles` (unde o coloană nouă rămâne invizibilă)
--    vine de la un VIEW înghețat și de la granturi date pe coloane; aici nu e
--    nici view, nici grant pe coloană. Se verifică oricum în BLOC 3.

alter table public.analiza_varianta
    add column if not exists pdf_path text,
    add column if not exists pdf_nume text,
    add column if not exists kml_path text,
    add column if not exists kml_nume text;

comment on column public.analiza_varianta.pdf_path is
    'Drumul fișei PDF a SETULUI din care face parte varianta, în bucketul privat `analize-fise`. Trebuie să înceapă cu id-ul grupului: politica de citire se uită la primul folder din nume. Mai multe variante din același set poartă aceeași cale, dinadins. NULL înseamnă „ia fișa analizei” (`analiza_teren.pdf_path`).';

comment on column public.analiza_varianta.kml_path is
    'Drumul fișierului KML cu volumul construibil, în bucketul privat `analize-fise`. E volumul IPOTEZEI de volum (P+4 față de P+5), nu al variantei: toate variantele aceluiași set arată la fel în Google Earth. Se descarcă și se deschide în Google Earth; nu există adresă care să îl deschidă direct acolo.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Bucketul acceptă și KML
-- ───────────────────────────────────────────────────────────────────────────
--
-- `analize-fise` a fost făcut să primească doar `application/pdf`, ca poarta să
-- refuze din start orice altceva. Acum are de ținut și KML-uri, deci lista
-- crește cu exact atât cât trebuie.
--
-- Trei tipuri, nu unul: browserele nu se înțeleg asupra unui `.kml`. Chrome îl
-- trimite ca `application/vnd.google-earth.kml+xml` când tipul e înregistrat în
-- sistem, dar pe un Windows fără Google Earth instalat ajunge `text/xml` sau
-- chiar gol.
--
-- ⚠️ Dacă dashboardul REFUZĂ totuși încărcarea („mime type not supported”),
--    fișierul pleacă probabil ca `application/octet-stream`. Spune-mi și îl
--    adaug, dar separat: `octet-stream` înseamnă „orice”, deci ar desființa
--    poarta. Nu îl pun de la început tocmai de-aia.

update storage.buckets
   set allowed_mime_types = array[
         'application/pdf',
         'application/vnd.google-earth.kml+xml',
         'application/xml',
         'text/xml'
       ]
 where id = 'analize-fise';

-- Trebuie să scrie „UPDATE 1”.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Verificările. Nu schimbă nimic.
-- ───────────────────────────────────────────────────────────────────────────

select * from (
  -- (a) cele patru coloane există acum
  select 1 as ord, 'coloană' as sectiune, column_name as detaliu,
         is_nullable as extra
    from information_schema.columns
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and column_name in ('pdf_path', 'pdf_nume', 'kml_path', 'kml_nume')
  union all
  -- (b) bucketul acceptă acum patru tipuri
  select 2, 'bucket analize-fise', array_to_string(allowed_mime_types, ', '),
         case when public then 'PUBLIC (GREȘIT)' else 'privat' end
    from storage.buckets
   where id = 'analize-fise'
  union all
  -- (c) dreptul de citire: trebuie să fie un grant pe TABELĂ (fără nume de
  --     coloană), altfel coloanele noi nu se citesc și pagina nu spune nimic
  select 3, 'drept de citire', grantee || ' → ' || privilege_type,
         'pe tabelă'
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and grantee in ('anon', 'authenticated')
  union all
  select 4, 'ATENȚIE: drept pe coloană', grantee || ' → ' || column_name, privilege_type
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and grantee in ('anon', 'authenticated')
     and column_name in ('pdf_path', 'pdf_nume', 'kml_path', 'kml_nume')
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • patru rânduri „coloană”, toate cu `YES` la nullable;
--   • un rând „bucket analize-fise”, scris `privat`, cu cele patru tipuri;
--   • la „drept de citire”: `authenticated → SELECT`, și NIMIC pentru `anon`.
--   • rândurile „ATENȚIE: drept pe coloană” pot să apară și e în regulă:
--     Postgres raportează drepturile de tabelă și pe fiecare coloană în parte.
--     Important e ca `authenticated → SELECT` de la (c) să fie acolo.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Întoarcerea. NU se rulează la instalare.
-- ───────────────────────────────────────────────────────────────────────────

-- alter table public.analiza_varianta
--     drop column if exists pdf_path,
--     drop column if exists pdf_nume,
--     drop column if exists kml_path,
--     drop column if exists kml_nume;
--
-- update storage.buckets set allowed_mime_types = array['application/pdf']
--  where id = 'analize-fise';

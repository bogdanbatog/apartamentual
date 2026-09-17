-- ═══════════════════════════════════════════════════════════════════════════
-- LINKUL GOOGLE EARTH AL VOLUMULUI, PE VARIANTĂ
-- 17 septembrie 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: o coloană nouă, `earth_url`, pe `analiza_varianta`, plus linkul
-- pentru Radovici 4, singura analiză care îl are deocamdată.
--
-- CE ATINGE: doar o coloană NOUĂ pe o tabelă din pachetul „Împărțirea
-- apartamentelor”. ZERO atingeri la plăți, la Oblio, la Netopia, la
-- `profiles`, la politici, la drepturi, la storage.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție.
--
-- ⚠️ RULEAZĂ BLOCURILE PE RÂND: 0 → 1 → 2 → 3.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DE CE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Oamenii nu găseau volumul: era un link mic, „Volumul (KML)”, care descărca
-- un fișier pe care puțini știu să îl deschidă. Din versiunea v263_48 a lui
-- Urban Analyzer, Liviu poate lipi linkul proiectului din Google Earth, iar
-- linkul acela se deschide direct în browser, fără nimic de instalat.
--
-- Linkul NU vine în CSV, ci doar în fișa PDF, ca hyperlink. De aceea se
-- scrie de mână în configurația de import (câmpul `earth_url` al setului).
--
-- Stă tot pe variantă, ca `pdf_path` și `kml_path` din migrația 12: e al
-- SETULUI (ipoteza de volum), deci aceeași adresă se repetă pe variantele
-- setului, dinadins.
--
-- Pagina: dacă există link, butonul deschide Google Earth; dacă nu (Galvani,
-- Bosianu, Despot Vodă, Mieilor, exportate înainte de v263_48), butonul
-- descarcă fișierul KML, ca până acum.
--
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — Verificare. Nu schimbă nimic.
-- ───────────────────────────────────────────────────────────────────────────

select * from (
  -- (a) coloana NU trebuie să existe încă
  select 1 as ord, 'coloană existentă deja' as sectiune,
         column_name::text as detaliu, data_type::text as extra
    from information_schema.columns
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and column_name = 'earth_url'
  union all
  -- (b) variantele Radovici 4 care vor primi linkul
  select 2, 'variantă Radovici 4', va.nume, coalesce(va.kml_nume, '(fără KML)')
    from public.analiza_varianta va
    join public.analiza_teren a on a.id = va.analiza_id
   where a.titlu = 'Analiză preliminară Radovici 4'
     and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • NICIUN rând „coloană existentă deja”;
--   • trei rânduri „variantă Radovici 4”: P+3 · V1, V2, V3, toate cu
--     `radovici-4-volum.kml`.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Coloana
-- ───────────────────────────────────────────────────────────────────────────
--
-- Nullable: analizele vechi n-au link, și aceea e starea obișnuită.
--
-- Regula `earth_url_doar_google_earth` lasă să intre doar adrese care încep
-- cu `https://earth.google.com/`. Pagina pune adresa într-un link pe care
-- oamenii apasă, deci o greșeală de lipire (sau orice altă adresă) trebuie
-- refuzată la intrare, nu descoperită de un membru al grupului.
--
-- ⚠️ NU e nevoie de GRANT nou: `analiza_varianta` are SELECT pe TABELĂ,
--    care acoperă și coloanele adăugate după (verificat la migrația 12).

alter table public.analiza_varianta
    add column if not exists earth_url text;

alter table public.analiza_varianta
    drop constraint if exists earth_url_doar_google_earth;

alter table public.analiza_varianta
    add constraint earth_url_doar_google_earth
    check (earth_url is null or earth_url like 'https://earth.google.com/%');

comment on column public.analiza_varianta.earth_url is
    'Linkul proiectului Google Earth cu volumul SETULUI (ca `kml_path`: toate variantele setului poartă același link). Vine din fișa PDF a lui Urban Analyzer (v263_48+), nu din CSV. NULL = pagina descarcă fișierul KML în loc.';


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Linkul pentru Radovici 4
-- ───────────────────────────────────────────────────────────────────────────
--
-- Scos din `radovici-4-fisa.pdf`, singurul hyperlink Google Earth din el.
--
-- ⚠️ Înainte de rulare: deschide linkul într-o FEREASTRĂ PRIVATĂ. Proiectul
--    stă pe Drive-ul lui Liviu; dacă cere cont sau spune „nu ai acces”,
--    oamenii din grup vor vedea același lucru. Atunci NU rula blocul: Liviu
--    trebuie să schimbe partajarea în „Oricine are linkul”.

update public.analiza_varianta va
   set earth_url = 'https://earth.google.com/earth/d/1yUOeFqNMxnHVnO3f4AZDGV15YI94XQYj?usp=sharing'
  from public.analiza_teren a
 where a.id = va.analiza_id
   and a.titlu = 'Analiză preliminară Radovici 4'
   and a.grup_id = (select id from public.grupuri where nume ilike '%Parcul Circului%')
   and va.nume like 'P+3 · %';

-- Trebuie să scrie „UPDATE 3”.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — Verificările. Nu schimbă nimic.
-- ───────────────────────────────────────────────────────────────────────────

select * from (
  -- (a) coloana există
  select 1 as ord, 'coloană' as sectiune, column_name::text as detaliu,
         is_nullable::text as extra
    from information_schema.columns
   where table_schema = 'public' and table_name = 'analiza_varianta'
     and column_name = 'earth_url'
  union all
  -- (b) regula de adresă există
  select 2, 'regulă', conname::text, pg_get_constraintdef(oid)
    from pg_constraint
   where conrelid = 'public.analiza_varianta'::regclass
     and conname = 'earth_url_doar_google_earth'
  union all
  -- (c) câte variante au link, pe analiză
  select 3, 'variante cu link', a.titlu,
         count(va.earth_url)::text || ' din ' || count(*)::text
    from public.analiza_varianta va
    join public.analiza_teren a on a.id = va.analiza_id
   group by a.titlu
) x order by ord, detaliu;

-- CE TREBUIE SĂ VEZI:
--   • un rând „coloană” earth_url, cu `YES`;
--   • un rând „regulă” cu `CHECK ((earth_url IS NULL) OR (earth_url ~~ 'https://earth.google.com/%'...`;
--   • la „variante cu link”: Radovici 4 cu „3 din 3”, toate celelalte „0 din N”.


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 4 — Întoarcerea. NU se rulează la instalare.
-- ───────────────────────────────────────────────────────────────────────────

-- alter table public.analiza_varianta
--     drop constraint if exists earth_url_doar_google_earth,
--     drop column if exists earth_url;

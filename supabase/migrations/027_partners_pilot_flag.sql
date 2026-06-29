-- ============================================================================
-- 027_partners_pilot_flag.sql
--
-- SCOP: Separă „peretele de credit" (cine a construit Județului Housing) de
-- „directorul de profesioniști" (parteneri disponibili grupurilor noi:
-- arhitecți, avocați, agenții, brokeri).
--
-- Adaugă un marcaj boolean `is_pilot_builder`:
--   true  => a construit Județului Housing  => apare în secțiunea de credit (sus)
--   false => partener din director           => apare grupat pe categorie (jos)
--
-- Apoi marchează cele 8 firme reale de pe pilot ca is_pilot_builder = true.
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script IDEMPOTENT: poate fi rulat de mai multe ori.
-- ============================================================================

-- ── 1. Coloana nouă `is_pilot_builder` ──────────────────────────────────────
-- default false => orice partener nou adăugat din admin intră, implicit, în
-- director (nu în peretele de credit). Bifezi manual doar firmele de pe pilot.
alter table public.partners
  add column if not exists is_pilot_builder boolean not null default false;

comment on column public.partners.is_pilot_builder is
  'true => a construit Județului Housing (apare în peretele de credit). false => partener din director, grupat pe categorie.';

-- ── 2. Marchează cele 8 firme de pe Județului Housing ───────────────────────
update public.partners
set is_pilot_builder = true
where name in (
  'Mozaic Engineering',
  'Ecodivision',
  'Hidrotec Instalații',
  'Anyta Falko',
  'Qfort',
  'HC93',
  'ISOVER',
  'CETBOX'
);

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- select name, is_pilot_builder, category, sort_order
-- from public.partners
-- order by is_pilot_builder desc, sort_order, name;

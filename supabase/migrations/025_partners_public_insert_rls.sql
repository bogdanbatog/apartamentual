-- ============================================================================
-- 025_partners_public_insert_rls.sql
--
-- SCOP: Repară formularul „Devino partener" (devino-partener.html).
--
-- PROBLEMA: Tabela `partners` are RLS pornit și o politică de SELECT (publicul
-- vede partenerii activi), DAR nu are nicio politică de INSERT pentru public.
-- De aceea, când un vizitator NELOGAT trimite cererea de parteneriat,
-- INSERT-ul e respins cu eroarea:
--     "new row violates row-level security policy for table partners" (42501)
-- Cererea nu se salvează niciodată și nu ajunge nici notificarea pe email/Slack.
--
-- SOLUȚIA: Permitem rolului `anon` (vizitator nelogat) și `authenticated`
-- (utilizator logat) să INSEREZE o cerere — DAR numai ca rând „neaprobat":
-- is_active = false, is_verified = false, is_featured = false.
-- Astfel nimeni nu-și poate publica singur un partener activ/verificat/recomandat;
-- toate cererile rămân ascunse până le aprobi tu din panoul de admin.
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script idempotent: poate fi rulat de mai multe ori fără efecte secundare.
-- ============================================================================

-- ── 1. Politica de INSERT public pe tabela partners ─────────────────────────
-- WITH CHECK validează rândul NOU care se inserează. Dacă oricare dintre cele
-- trei flag-uri nu e false, INSERT-ul e respins. Formularul trimite deja toate
-- trei pe false, deci aplicanții legitimi trec; un atacator nu poate forța
-- is_active = true.

drop policy if exists "public_can_submit_partner_application" on public.partners;

create policy "public_can_submit_partner_application"
on public.partners
for insert
to anon, authenticated
with check (
  is_active   = false
  and is_verified = false
  and is_featured = false
);

-- ── 2. (OPȚIONAL) Upload logo în bucket-ul `public-assets` ──────────────────
-- Formularul încearcă să urce logo-ul în `public-assets/partner-logos/...`.
-- Fără politică de INSERT pe storage.objects, upload-ul eșuează pentru anonimi
-- (dar codul tratează asta „blând": doar console.warn, NU oprește cererea —
-- logo-ul rămâne gol, îl poți adăuga tu mai târziu din admin).
--
-- Dacă vrei ca aplicanții să poată atașa logo direct, rulează și blocul de mai
-- jos. Permitem upload DOAR în folderul `partner-logos/` din `public-assets`,
-- nu oriunde în bucket.
--
-- TRADEOFF: orice vizitator poate urca fișiere (≤2MB, limitat din frontend) în
-- acel folder — risc mic de abuz. Dacă preferi zero risc, NU rula acest bloc și
-- lasă logo-ul să-l pună adminul după aprobare.
--
-- Decomentează blocul dacă vrei upload-ul activ:

-- drop policy if exists "public_can_upload_partner_logos" on storage.objects;
--
-- create policy "public_can_upload_partner_logos"
-- on storage.objects
-- for insert
-- to anon, authenticated
-- with check (
--   bucket_id = 'public-assets'
--   and (storage.foldername(name))[1] = 'partner-logos'
-- );

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- select policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public' and tablename = 'partners';

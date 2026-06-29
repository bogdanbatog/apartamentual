-- ============================================================================
-- 026_partners_role_and_seed.sql
--
-- SCOP: Pregătește pagina „Parteneri" ca perete de credit pentru Județului
-- Housing, păstrând gestionarea din admin.
--
-- Face două lucruri:
--   1. Adaugă o coloană nouă `role` (text, opțional) în tabela `partners`.
--      `category` rămâne (larg: construcții/furnizori, folosit la filtrarea din
--      admin), iar `role` ține rolul SPECIFIC afișat pe card
--      (ex. „Hidroizolații", „Tâmplării exterioare").
--   2. Inserează cele 8 firme reale care au construit Județului Housing.
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script IDEMPOTENT: poate fi rulat de mai multe ori fără să dubleze rândurile.
-- ============================================================================

-- ── 1. Coloana nouă `role` ──────────────────────────────────────────────────
-- IF NOT EXISTS => sigur de rulat de mai multe ori.
alter table public.partners
  add column if not exists role text;

comment on column public.partners.role is
  'Rolul specific al partenerului afișat pe card (ex. „Constructor general", „Hidroizolații"). Mai precis decât category.';

-- ── 2. Seed cele 8 firme de pe Județului Housing ────────────────────────────
-- Fiecare INSERT e protejat de WHERE NOT EXISTS (după nume), deci dacă firma
-- există deja (ai rulat scriptul o dată), nu se mai adaugă a doua oară.
-- Toate intră active (is_active = true) ca să apară pe pagină; fără badge-uri
-- (is_verified / is_featured = false — pagina publică nici nu le mai arată).
-- sort_order păstrează ordinea logică de pe șantier (constructor → instalații →
-- anvelopă → confecții).

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'Mozaic Engineering', 'Constructor general', 'constructii',
       'A executat structura de rezistență și arhitectura clădirii.',
       true, false, false, 10
where not exists (select 1 from public.partners where name = 'Mozaic Engineering');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'Ecodivision', 'Instalații sanitare și termice (furnizor)', 'furnizori',
       'A furnizat sistemele de instalații sanitare și termice.',
       true, false, false, 20
where not exists (select 1 from public.partners where name = 'Ecodivision');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'Hidrotec Instalații', 'Instalații sanitare și termice (execuție)', 'constructii',
       'A executat instalațiile sanitare și termice.',
       true, false, false, 30
where not exists (select 1 from public.partners where name = 'Hidrotec Instalații');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'Anyta Falko', 'Instalații electrice', 'constructii',
       'A executat instalațiile electrice.',
       true, false, false, 40
where not exists (select 1 from public.partners where name = 'Anyta Falko');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'Qfort', 'Tâmplării exterioare', 'furnizori',
       'A montat tâmplăriile exterioare PVC/aluminiu.',
       true, false, false, 50
where not exists (select 1 from public.partners where name = 'Qfort');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'HC93', 'Hidroizolații', 'constructii',
       'A executat hidroizolațiile la terase, balcoane și jardiniere.',
       true, false, false, 60
where not exists (select 1 from public.partners where name = 'HC93');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'ISOVER', 'Termoizolații și fonoizolații', 'furnizori',
       'Termoizolații exterioare și fonoizolații interioare.',
       true, false, false, 70
where not exists (select 1 from public.partners where name = 'ISOVER');

insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, sort_order)
select 'CETBOX', 'Confecții metalice', 'constructii',
       'Confecții metalice exterioare și balustrade.',
       true, false, false, 80
where not exists (select 1 from public.partners where name = 'CETBOX');

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- select name, role, category, sort_order, is_active
-- from public.partners
-- order by sort_order, name;

-- ============================================================================
-- 028_partner_ltfb_studio.sql
--
-- SCOP: Adaugă LTFB Studio în peretele de credit Județului Housing.
-- LTFB Studio este biroul de arhitectură care a proiectat și a coordonat
-- proiectul-pilot, deci intră ca is_pilot_builder = true, primul în listă
-- (sort_order = 5, înaintea constructorului Mozaic = 10).
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script IDEMPOTENT și sigur indiferent dacă LTFB Studio există deja:
--   1. INSERT dacă nu există (DB proaspăt).
--   2. UPDATE pe câmpurile-cheie (dacă rândul exista deja cu valori vechi).
-- ============================================================================

-- 1. Inserează doar dacă nu există deja.
insert into public.partners (name, role, category, description, is_active, is_verified, is_featured, is_pilot_builder, sort_order)
select 'LTFB Studio', 'Proiectare/coordonare construcție colaborativă', 'arhitectura',
       'A proiectat și a coordonat construcția Județului Housing.',
       true, false, false, true, 5
where not exists (select 1 from public.partners where name = 'LTFB Studio');

-- 2. Asigură valorile corecte și pentru un rând preexistent.
update public.partners
set role = 'Proiectare/coordonare construcție colaborativă',
    category = 'arhitectura',
    description = 'A proiectat și a coordonat construcția Județului Housing.',
    is_active = true,
    is_pilot_builder = true,
    sort_order = 5
where name = 'LTFB Studio';

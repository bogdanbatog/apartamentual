-- ============================================================================
-- 029_partners_websites_contacts.sql
--
-- SCOP: Completează site-ul și emailul de contact pentru firmele de pe
-- Județului Housing (din handoff parteneri-page-completare.md).
--
-- IMPORTANT:
--   - `website` SE AFIȘEAZĂ public pe card (întărește dovada).
--   - `email` NU se afișează public (partenerii nu și-au dat acordul + spam).
--     Rămâne doar pentru tine, în panoul de admin, ca să trimiți mailurile de
--     acord. Pagina publică a fost ajustată să NU mai randeze butonul de email.
--
-- Hidrotec Instalații: nu are nici site, nici email => rămâne card de credit
-- simplu (nume + rol + descriere).
--
-- DE RULAT MANUAL în Supabase SQL Editor (proiect glbvbbgmcobtswwlktic).
-- Script idempotent (UPDATE după nume; rulabil de mai multe ori).
-- ============================================================================

update public.partners set website = 'https://www.mozaiceng.ro/', email = 'andrei.truica@mozaiceng.ro'
where name = 'Mozaic Engineering';

update public.partners set website = 'https://ecodivision.ro/', email = 'office@ecodivision.ro'
where name = 'Ecodivision';

-- Hidrotec Instalații: fără site / fără email (nu actualizăm nimic).

update public.partners set website = 'https://anyta.ro/', email = 'comenzi@anyta.ro'
where name = 'Anyta Falko';

update public.partners set website = 'https://qfort.ro/', email = 'office@qfort.ro'
where name = 'Qfort';

update public.partners set website = 'https://hc93.ro/', email = 'office@hc93.ro'
where name = 'HC93';

update public.partners set website = 'https://www.isover.ro/', email = 'info.constructionproducts@saint-gobain.com'
where name = 'ISOVER';

-- CETBOX: fără site, dar are email de contact intern.
update public.partners set email = 'e.tolstobrach@gmail.com'
where name = 'CETBOX';

-- ── Verificare după rulare (rulează separat, opțional) ──────────────────────
-- select name, website, email from public.partners
-- where is_pilot_builder = true order by sort_order, name;

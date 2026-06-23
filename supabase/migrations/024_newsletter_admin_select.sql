-- Migration 024: acces de CITIRE la newsletter_subscribers pentru superadmin
-- ────────────────────────────────────────────────────────────────────────────
-- Tabelul newsletter_subscribers (creat în migrația 023) are RLS activ și ZERO
-- policy-uri = acces zero din client. Scrierile trec doar prin edge functions cu
-- service_role (care ocolește RLS). Asta e corect pentru securitate.
--
-- Pentru pagina de admin (admin-newsletter.html) avem nevoie ca superadminul
-- (profiles.is_super_admin = true) să poată CITI lista direct din browser, prin
-- clientul `sb`. Adăugăm DOAR o policy de SELECT, folosind funcția existentă
-- public.is_super_admin() (security definer, vezi migrația 001).
--
-- NU adăugăm policy de INSERT/UPDATE/DELETE: abonarea/confirmarea rămân exclusiv
-- în edge functions cu service_role. Pagina de admin e read-only.
--
-- Rulează manual în Supabase SQL Editor, DUPĂ migrația 023.

create policy "Super admins can view newsletter subscribers"
  on public.newsletter_subscribers
  for select
  to authenticated
  using (public.is_super_admin());

-- =====================================================================
-- 004_terenuri_hard_delete.sql
-- Permite superadminului sa stearga DEFINITIV (hard delete) un teren
-- din panoul admin, in loc de soft delete (deleted_at).
--
-- Rulează manual în Supabase SQL Editor.
--
-- Notă: toate tabelele-copil care referă terenuri (grup_terenuri,
-- terenuri_likes_grupuri, grup_teren_comments, terenuri_likes,
-- user_teren_notes) au deja ON DELETE CASCADE — verificat 2026-06-18.
-- Deci nu e nevoie să atingem cheile străine; e suficientă politica RLS.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASUL 1 — Politica RLS care permite superadminului să șteargă (DELETE).
-- Fără ea, RLS blochează orice ștergere pe terenuri.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Super admins can delete terenuri" ON public.terenuri;

CREATE POLICY "Super admins can delete terenuri"
  ON public.terenuri
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());


-- ---------------------------------------------------------------------
-- PASUL 2 — (opțional) Curăță definitiv terenurile deja soft-deleted
-- (cele cărora le-am pus deleted_at azi). Rulează DOAR dacă ești sigur
-- că nu mai vrei niciunul dintre ele.
-- ---------------------------------------------------------------------
-- DELETE FROM public.terenuri WHERE deleted_at IS NOT NULL;


-- ---------------------------------------------------------------------
-- DIAGNOSTIC (opțional) — listează tabelele cu FK către terenuri și
-- regula lor de ștergere (confdeltype: c = CASCADE).
-- ---------------------------------------------------------------------
-- SELECT conrelid::regclass AS tabela_copil, conname, confdeltype
-- FROM pg_constraint
-- WHERE confrelid = 'public.terenuri'::regclass AND contype = 'f';

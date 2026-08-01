-- ═══════════════════════════════════════════════════════════════════
--  PREGATIRE PENTRU REVOCARE — politicile RLS nu mai citesc direct
--  din `profiles`
--
--  ⚠ FISIERUL ASTA NU SCHIMBA CINE CE POATE FACE. Rescrie 12 politici
--  ca sa apeleze `public.is_super_admin()` in loc sa citeasca tabela
--  cu mana. Functia intoarce EXACT ce testa subinterogarea, deci
--  comportamentul ramane identic.
--
--  Ordinea:
--     1. 4-view-si-functii-pentru-logati.sql   (rulat, 1 august)
--     2. deploy `notify-admins`                (facut, 1 august)
--     3. 5-lista-invitatii-grup.sql            (rulat)
--     4. 5b-repara-tipuri-functii-invitatii.sql (rulat)
--     5. cod pe cPanel                         (facut)
--     6. fisierul asta                         (pregateste terenul)
--     7. 6-revoca-pentru-logati.sql            (inchide gaura)
-- ═══════════════════════════════════════════════════════════════════
--
--  DE CE. Pe 1 august seara, dupa `REVOKE SELECT ... FROM authenticated`,
--  pagina de terenuri si cea de parteneri au ramas goale pentru orice
--  utilizator logat. Cauza nu era in interogarile paginilor — nici una
--  nu citeste `profiles` — ci in politicile RLS ale tabelelor.
--
--  Doisprezece politici aveau acelasi tipar copiat:
--
--      EXISTS (SELECT 1 FROM profiles
--              WHERE profiles.user_id = auth.uid()
--                AND profiles.is_super_admin = true)
--
--  ⚠ MECANISMUL, DE TINUT MINTE: expresia unei politici RLS se evalueaza
--  cu drepturile CELUI CARE INTEROGHEAZA, nu ale proprietarului tabelei.
--  Deci citirea aia cere dreptul pe coloana `is_super_admin` — exact
--  coloana revocata. Cand dreptul lipseste, politica nu „intoarce fals",
--  ci CRAPA, si odata cu ea toata interogarea. Un utilizator obisnuit,
--  care n-avea oricum nicio treaba cu ramura de superadmin, nu mai putea
--  citi deloc tabela.
--
--  DE CE N-A APARUT PE 1 AUGUST DIMINEATA, la revocarea pentru anonimi:
--  aproape toate politicile astea sunt `TO authenticated`, deci pentru
--  rolul `anon` nici nu se evaluau.
--
--  DE CE FUNCTIA REZOLVA. `public.is_super_admin()` e SECURITY DEFINER
--  si are `SET row_security TO 'off'` — citeste `profiles` cu drepturile
--  proprietarului, deci nu depinde de ce mai are voie apelantul. Restul
--  politicilor de pe `terenuri` o foloseau deja si n-au avut nimic
--  (comparatie utila: „Super admins can delete terenuri" a mers, in timp
--  ce „Super admins can view all terenuri including deleted" a picat).
--
--  ⚠ ZONA DE PLATI: doua dintre politici sunt pe `comenzi_analize` si
--  `comenzi_analize_log`. NU se schimba nicio logica de plata, de pret
--  sau de facturare — doar felul in care politica afla daca esti
--  superadmin. Conditia ramane identica.
-- ═══════════════════════════════════════════════════════════════════


-- ── Diagnostic inainte ──────────────────────────────────────────────
-- Lista politicilor care citesc `profiles` in expresia lor. Ruleaz-o
-- acum si pastreaza rezultatul, ca sa poti compara la final.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%')
ORDER BY tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════
--  Rescrierea. Fiecare bloc: DROP + CREATE cu aceleasi roluri, aceeasi
--  comanda si aceeasi conditie, exprimata prin functie.
-- ═══════════════════════════════════════════════════════════════════

-- ── comenzi_analize (ZONA DE PLATI — conditie neschimbata) ──────────
DROP POLICY IF EXISTS superadmin_can_view_all_comenzi ON public.comenzi_analize;
CREATE POLICY superadmin_can_view_all_comenzi
    ON public.comenzi_analize
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

DROP POLICY IF EXISTS superadmin_can_update_comenzi ON public.comenzi_analize;
CREATE POLICY superadmin_can_update_comenzi
    ON public.comenzi_analize
    FOR UPDATE TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ── comenzi_analize_log (ZONA DE PLATI — conditie neschimbata) ──────
DROP POLICY IF EXISTS superadmin_can_view_logs ON public.comenzi_analize_log;
CREATE POLICY superadmin_can_view_logs
    ON public.comenzi_analize_log
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

-- ── grup_checklist ──────────────────────────────────────────────────
-- ⚠ Rolul e `public` (adica inclusiv `anon`), nu `authenticated`.
-- Se pastreaza asa cum era.
DROP POLICY IF EXISTS "Super admin full access checklist" ON public.grup_checklist;
CREATE POLICY "Super admin full access checklist"
    ON public.grup_checklist
    FOR ALL TO public
    USING (public.is_super_admin());

-- ── grup_checklist_notes ────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admin full access checklist notes" ON public.grup_checklist_notes;
CREATE POLICY "Super admin full access checklist notes"
    ON public.grup_checklist_notes
    FOR ALL TO public
    USING (public.is_super_admin());

-- ── grup_membri ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can delete group members" ON public.grup_membri;
CREATE POLICY "Super admins can delete group members"
    ON public.grup_membri
    FOR DELETE TO authenticated
    USING (public.is_super_admin());

-- ── grupuri ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can delete groups" ON public.grupuri;
CREATE POLICY "Super admins can delete groups"
    ON public.grupuri
    FOR DELETE TO authenticated
    USING (public.is_super_admin());

-- ⚠ Aici `WITH CHECK` era `true`, nu conditia de superadmin. Se pastreaza
-- exact asa: superadminul poate modifica orice grup, fara restrictie pe
-- randul rezultat.
DROP POLICY IF EXISTS "Super admins can update any group" ON public.grupuri;
CREATE POLICY "Super admins can update any group"
    ON public.grupuri
    FOR UPDATE TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (true);

-- ── notification_log ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read notification log" ON public.notification_log;
CREATE POLICY "Admins can read notification log"
    ON public.notification_log
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

-- ── partners ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage partners" ON public.partners;
CREATE POLICY "Admins can manage partners"
    ON public.partners
    FOR ALL TO authenticated
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

-- ── terenuri ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can view all terenuri including deleted" ON public.terenuri;
CREATE POLICY "Super admins can view all terenuri including deleted"
    ON public.terenuri
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

-- ── terenuri_likes_grupuri ──────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can delete group terrain likes" ON public.terenuri_likes_grupuri;
CREATE POLICY "Super admins can delete group terrain likes"
    ON public.terenuri_likes_grupuri
    FOR DELETE TO authenticated
    USING (public.is_super_admin());


-- ═══════════════════════════════════════════════════════════════════
--  CONTROL
-- ═══════════════════════════════════════════════════════════════════

-- A. Aceeasi scanare ca la inceput. Acum trebuie sa ramana UN SINGUR
--    rand: politica `profiles / "Users can view group owner profiles"`,
--    care citeste tabela `grup`, nu coloane sensibile din `profiles`.
--    Daca mai apare oricare alta, opreste-te si spune-mi.
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%')
ORDER BY tablename, policyname;

-- B. Politicile rescrise trebuie sa fie toate acolo, 12 la numar.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual ILIKE '%is_super_admin()%' OR with_check ILIKE '%is_super_admin()%')
ORDER BY tablename, policyname;


-- ═══════════════════════════════════════════════════════════════════
--  DUPA fisierul asta
--
--  1. Verifica site-ul ca superadmin: terenuri, parteneri, admin.
--     Totul trebuie sa arate exact ca inainte — n-am schimbat nicio
--     permisiune, doar felul in care se afla.
--  2. Abia apoi re-ruleaza `6-revoca-pentru-logati.sql`.
--  3. Dupa revocare, verifica din nou aceleasi pagini, SI ca utilizator
--     obisnuit (nu doar ca superadmin) — ruperea de pe 1 august se vedea
--     numai pentru cine era logat fara drepturi de admin.
-- ═══════════════════════════════════════════════════════════════════

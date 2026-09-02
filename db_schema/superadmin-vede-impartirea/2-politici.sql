-- ═══════════════════════════════════════════════════════════════════════════
-- SUPERADMINUL VEDE ÎMPĂRȚIREA APARTAMENTELOR PE ORICE TEREN, AL ORICĂRUI GRUP
-- 2 septembrie 2026
--
-- CE FACE. Adaugă zece politici de CITIRE, câte una pe tabelă, care lasă
-- superadminul să citească tot. Nu atinge nicio politică existentă, nu dă
-- niciun drept de scriere, nu schimbă nicio coloană.
--
-- DE CE E NEVOIE. Politicile de azi cer să fii membru activ sau fondator.
-- Superadminul nu e membru în grupurile oamenilor, deci primea LISTĂ GOALĂ,
-- fără eroare și fără nimic în consolă. E al patrulea caz al aceluiași tipar
-- (`grup_checklist_files` 25 iulie, `grup_anunturi` 13 august, butonul de
-- ștergere a anunțurilor).
--
-- CE NU E AICI, fiindcă diagnosticul din `1-diagnostic.sql` a arătat că are
-- deja acces:
--   • `grup_checklist_notes` are „Super admin full access checklist notes”;
--   • `grup_membri` are o politică largă, „Authenticated users can view group
--     members”, deci citirea membrilor merge oricum.
-- O politică în plus pe o tabelă care are deja acces NU e inofensivă:
-- politicile permisive se combină cu OR, deci una largă o anulează tăcut pe
-- una strictă. De asta sunt exact zece, nu douăsprezece.
--
-- ⚠️ NU pune begin / rollback în tab. Editorul SQL din Supabase rulează tot
--    tabul ca o singură tranzacție, iar un rollback „de probă” anulează tăcut
--    și politicile de deasupra lui.
--
-- ⚠️ PROBA NU SE POATE DA DIN SQL EDITOR. Acolo rulezi ca `postgres` și
--    ocolești RLS-ul, deci ai vedea toate rândurile și cu politicile șterse.
--    Editorul nu poate infirma nimic. Proba se dă în browser, logat ca tine,
--    pe pagina unui grup în care NU ești membru.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 1 · CELE ZECE POLITICI
--
-- TREI ALEGERI CARE NU SE VĂD ÎN COD:
--
-- (1) `(select public.is_super_admin())`, nu `public.is_super_admin()`.
--     Învelită în select, devine o subinterogare fără legătură cu rândul
--     curent, deci se calculează O DATĂ pe interogare în loc de o dată pe
--     rând. Pe o variantă cu 64 de apartamente, diferența se vede.
--
-- (2) Cheamă FUNCȚIA, nu citește direct din `profiles`. O politică ce citește
--     o coloană la care rolul n-are drept nu întoarce fals, ci CRAPĂ toată
--     interogarea, adică pagina s-ar goli pentru toți membrii, nu doar pentru
--     superadmin. Exact așa s-au golit paginile de terenuri și parteneri pe
--     1 august. Corpul funcției e potrivit pentru treaba asta: security
--     definer, stable, search_path fixat, row_security oprit înăuntru (deci nu
--     reintră în RLS pe `profiles`, fără recursiune) și coalesce pe fals, deci
--     pentru `anon` întoarce fals în loc să crape.
--
-- (3) `to authenticated`, nu `to public`. Superadminul e mereu logat, iar o
--     politică pusă pe public s-ar evalua și pentru `anon` la fiecare citire,
--     degeaba.
--
-- DOAR SELECT. Superadminul vede, nu mișcă: nicio politică de INSERT, UPDATE
-- sau DELETE. Suprafețele mutate de oameni și înscrierile pe apartamente
-- rămân ale lor. Pagina nu-i arată nici butoanele fondatorului, deci nu apare
-- niciun buton care eșuează tăcut.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Analiza și structura ei ────────────────────────────────────────────────

drop policy if exists at_select_superadmin on public.analiza_teren;
create policy at_select_superadmin on public.analiza_teren
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists av_select_superadmin on public.analiza_varianta;
create policy av_select_superadmin on public.analiza_varianta
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists an_select_superadmin on public.analiza_nivel;
create policy an_select_superadmin on public.analiza_nivel
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists aa_select_superadmin on public.analiza_apartament;
create policy aa_select_superadmin on public.analiza_apartament
    for select to authenticated
    using ((select public.is_super_admin()));

-- ── Ce au făcut oamenii cu analiza ─────────────────────────────────────────
-- Fără astea două, pagina s-ar deschide dar ar arăta propunerile arhitectului
-- în loc de suprafețele negociate, și niciun nume pe apartamente. Adică o
-- pagină care pare în regulă și spune altceva decât văd membrii.

drop policy if exists asup_select_superadmin on public.apartament_suprafata;
create policy asup_select_superadmin on public.apartament_suprafata
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists ai_select_superadmin on public.apartament_interes;
create policy ai_select_superadmin on public.apartament_interes
    for select to authenticated
    using ((select public.is_super_admin()));

-- ── Preferințele membrilor ─────────────────────────────────────────────────
-- ⚠️ DECIZIE DE PRODUS, NU DOAR TEHNICĂ. Aici stau bugetele. Oamenii le scriu
--    crezând că le vede grupul lor; de acum le văd și cei doi superadmini. Se
--    justifică pentru suport, dar MERITĂ SPUS UTILIZATORILOR, la momentul
--    potrivit, exact ca la anunțuri (13 august).

drop policy if exists gmp_select_superadmin on public.grup_membru_preferinte;
create policy gmp_select_superadmin on public.grup_membru_preferinte
    for select to authenticated
    using ((select public.is_super_admin()));

-- ── Munca de pe teren: bife, jurnal, documente ─────────────────────────────
-- `grup_checklist_notes` NU e aici: are deja „Super admin full access
-- checklist notes”, confirmat de diagnostic.

drop policy if exists gtc_select_superadmin on public.grup_teren_checklist;
create policy gtc_select_superadmin on public.grup_teren_checklist
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists gtcom_select_superadmin on public.grup_teren_comments;
create policy gtcom_select_superadmin on public.grup_teren_comments
    for select to authenticated
    using ((select public.is_super_admin()));

drop policy if exists ta_select_superadmin on public.teren_atasamente;
create policy ta_select_superadmin on public.teren_atasamente
    for select to authenticated
    using ((select public.is_super_admin()));


-- ═══════════════════════════════════════════════════════════════════════════
-- BLOC 2 · VERIFICAREA. Nu schimbă nimic.
-- Trebuie să iasă exact 10 rânduri, toate cu SELECT și `authenticated`.
-- ═══════════════════════════════════════════════════════════════════════════

select p.tablename                        as tabela,
       p.policyname                       as politica,
       p.cmd                              as comanda,
       array_to_string(p.roles, ', ')     as roluri,
       p.qual                             as conditia
  from pg_policies p
 where p.schemaname = 'public'
   and p.policyname like '%_select_superadmin'
 order by p.tablename;

-- `conditia` trebuie să pomenească peste tot `is_super_admin()`. Dacă undeva
-- apare `profiles`, politica citește direct din tabelă și trebuie rescrisă:
-- vezi alegerea (2) de mai sus.


-- ═══════════════════════════════════════════════════════════════════════════
-- ÎNAPOI, dacă ceva nu merge. Zece linii, fără efect asupra a nimic altceva.
-- ═══════════════════════════════════════════════════════════════════════════

-- drop policy if exists at_select_superadmin    on public.analiza_teren;
-- drop policy if exists av_select_superadmin    on public.analiza_varianta;
-- drop policy if exists an_select_superadmin    on public.analiza_nivel;
-- drop policy if exists aa_select_superadmin    on public.analiza_apartament;
-- drop policy if exists asup_select_superadmin  on public.apartament_suprafata;
-- drop policy if exists ai_select_superadmin    on public.apartament_interes;
-- drop policy if exists gmp_select_superadmin   on public.grup_membru_preferinte;
-- drop policy if exists gtc_select_superadmin   on public.grup_teren_checklist;
-- drop policy if exists gtcom_select_superadmin on public.grup_teren_comments;
-- drop policy if exists ta_select_superadmin    on public.teren_atasamente;

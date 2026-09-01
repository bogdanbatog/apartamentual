-- ═══════════════════════════════════════════════════════════════════════════
-- EDITAREA ÎN JURNALUL TERENULUI: doar autorul, doar trei coloane
-- 1 septembrie 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- CE E: `grup_teren_comments` capătă dreptul de UPDATE, care până azi nu exista
-- pentru nimeni, dat pe coloane, plus politica care îl leagă de autor.
--
-- DE CE: până acum o intrare greșită se putea doar șterge și scrie din nou, iar
-- asta pierdea data faptului și locul din jurnal. O greșeală de tastare nu
-- merită atâta.
--
-- ⭐ CE NU SE SCHIMBĂ DIN DECIZIA DE PE 31 AUGUST. Regula era: fondatorul poate
--    ȘTERGE ceva greșit, dar nu poate REscrie ce a spus altcineva. Rămâne
--    întreagă. UPDATE se dă DOAR autorului (`user_id = auth.uid()` și în
--    `using`, și în `with check`); fondatorul nu primește nimic aici. Omul își
--    corectează propria intrare, nimeni nu umblă la vorbele altuia.
--
-- ⚠️ GRANTUL E PE COLOANE, NU PE TABELĂ. Cu `grant update` pe toată tabela,
--    cineva își poate rescrie propriul rând mutându-l în alt grup: `with check`
--    verifică `user_id`, nu `grup_id`, iar rândul ar apărea în jurnalul unui
--    grup din care omul nu face parte. Se dau doar cele trei coloane care se
--    editează, plus `updated_at`. `id`, `grup_id`, `teren_id`, `user_id` și
--    `created_at` rămân nescriitibile de oricine în afară de service role.
--
--    Grantul pe coloane e curat aici tocmai fiindcă NU există grant de UPDATE
--    pe tabelă: un grant de tabelă nu se poate restrânge după aceea cu un
--    revoke pe coloană (se execută fără eroare și nu schimbă nimic).
--
-- ⭐ NU SE ADAUGĂ NICIO COLOANĂ. Prima formă a scriptului adăuga `editat_la`.
--    BLOC 0 a arătat că tabela are deja `updated_at`, de dinaintea pachetului,
--    și ar fi ieșit două coloane pentru același lucru, dintre care peste un an
--    nimeni n-ar mai fi știut care spune adevărul. Verificat, tot la BLOC 0:
--      • `updated_at` are `default now()`, la fel ca `created_at`, deci la
--        scriere sunt egale (zero rânduri cu valori diferite);
--      • singurul declanșator e `trigger_activity_on_comment`, AFTER INSERT,
--        care ține evidența activității membrilor și n-o atinge.
--    Deci „a fost modificată" se citește din `updated_at > created_at`, nu din
--    prezența unei coloane. Pagina scrie `updated_at` la fiecare salvare.
--
-- CE ATINGE SCRIPTUL: un grant pe patru coloane și o politică nouă. Nu se ating
-- coloanele, SELECT, INSERT, DELETE, declanșatorul, politicile de superadmin,
-- nici rândurile existente.
--
-- ⚠️ NU pune BEGIN / ROLLBACK: editorul SQL din Supabase rulează tot tabul ca o
--    singură tranzacție, iar un ROLLBACK pus „de probă" anulează tăcut tot ce e
--    deasupra lui, inclusiv granturile.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 0 — CUM ERA ÎNAINTE (rulat pe 1 septembrie; se poate rula din nou)
-- ───────────────────────────────────────────────────────────────────────────
-- Ce a ieșit, scris aici ca să rămână:
--
--   coloane:   id, grup_id, teren_id, user_id, content, created_at,
--              updated_at, fel, data_faptului
--   politici:  delete_own_comments (DELETE), insert_comments (INSERT),
--              select_comments (SELECT). NICIUNA de UPDATE.
--   drepturi:  authenticated = SELECT, INSERT, DELETE. Fără UPDATE.
--              anon = nimic.
--   updated_at: default now(), nullable; 2 rânduri în tabelă, la amândouă
--              egală cu created_at.
--   declanșatoare: trigger_activity_on_comment, AFTER INSERT.

select 'a. coloane' as sectiune, column_name::text as nume,
       (coalesce(column_default, 'fara default'))::text as detaliu
from information_schema.columns
where table_schema = 'public' and table_name = 'grup_teren_comments'

union all

select 'b. politici', policyname::text,
       (cmd || ' / ' || array_to_string(roles, ','))::text
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments'

union all

select 'c. drepturi pe tabela', grantee::text, privilege_type::text
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and grantee in ('anon', 'authenticated')

order by sectiune, nume;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 1 — Dreptul, pe coloane
-- ───────────────────────────────────────────────────────────────────────────
-- Doar ce se editează din pagină: textul, felul, data faptului. Plus ora
-- modificării, din care pagina scrie „modificat" lângă intrare.

grant update (content, fel, data_faptului, updated_at)
    on public.grup_teren_comments to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 2 — Politica
-- ───────────────────────────────────────────────────────────────────────────
-- `using` spune ce rânduri pot fi atinse; `with check` spune cum au voie să
-- arate după. Amândouă cer autorul, deci nici rândul altcuiva nu se poate
-- edita, nici propriul rând nu se poate da pe numele altuia.

drop policy if exists update_own_comments on public.grup_teren_comments;
create policy update_own_comments
    on public.grup_teren_comments for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());


-- ───────────────────────────────────────────────────────────────────────────
-- BLOC 3 — VERIFICARE (nu schimbă nimic)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠️ Arată forma, nu comportamentul: în SQL Editor ești `postgres`, `auth.uid()`
--    e NULL și politicile nici nu te ating.
--
-- ⚠️ De ce două interogări pentru drepturi: `information_schema.column_privileges`
--    NU deosebește un grant pe tabelă de unul pe coloane, le desfășoară pe
--    amândouă la fel, pe coloane. Deci se citesc împreună:
--      • `role_table_grants` NU trebuie să arate UPDATE (grantul nu e pe tabelă);
--      • `column_privileges` trebuie să arate UPDATE pe EXACT patru coloane.
--    Dacă a doua ar arăta UPDATE pe toate cele nouă coloane, ar însemna că
--    grantul a ajuns pe tabelă și cineva își poate muta intrarea în alt grup.

select 'a. politica de update' as sectiune,
       policyname::text        as nume,
       (array_to_string(roles, ',') || ' / ' || coalesce(qual, '?'))::text as detaliu
from pg_policies
where schemaname = 'public' and tablename = 'grup_teren_comments' and cmd = 'UPDATE'

union all

select 'b. update pe tabela (fara authenticated)',
       grantee::text, privilege_type::text
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and privilege_type = 'UPDATE'

union all

select 'c. update pe coloane (patru)',
       column_name::text, grantee::text
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'grup_teren_comments'
  and privilege_type = 'UPDATE' and grantee = 'authenticated'

order by sectiune, nume;

-- Cum se citește:
--   (a) un rând: `update_own_comments`, pe `authenticated`, cu
--       `user_id = auth.uid()`.
--   (b) `postgres` și `service_role` apar, e normal, ei dețin tabela. Ce NU
--       trebuie să apară e `authenticated`: dreptul lui e pe coloane, la (c).
--       Verificat pe 1 septembrie: exact așa a ieșit.
--   (c) exact patru rânduri: content, data_faptului, fel, updated_at.
--
-- PROBA ADEVĂRATĂ se dă din pagină, nu de aici:
--   • propria intrare: creionul apare, salvarea merge, apare „modificat";
--   • intrarea altcuiva, chiar și ca fondator: creionul NU apare deloc.

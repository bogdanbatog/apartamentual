-- ═══════════════════════════════════════════════════════════════════
--  PASUL 7 — APROBAREA FONDATORULUI DEVINE REGULĂ ÎN BAZĂ,
--            NU DOAR ÎN BUTOANE
--
--  ⚠️⚠️ NU RULA ASTA ÎNAINTE DE:
--     1. să fi rulat `6-functii-join-cu-aprobare.sql`, ȘI
--     2. codul de frontend să fie DEPLOYAT pe cPanel.
--
--  Ordinea inversă = cine acceptă o invitație primește eroare, fiindcă
--  browserul încă scrie direct în tabelă. Aceeași lecție ca la
--  `profiles` (1 august) și `grup_invitations` (2 august):
--  funcții → cod live → strângere. Niciodată altfel.
--
--  ⚠️ NU pune BEGIN…ROLLBACK în script — vezi nota din fișierul 6.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
--  CE E AZI, ȘI DE CE CELE DOUĂ SE REPARĂ ÎMPREUNĂ SAU DELOC
-- ═══════════════════════════════════════════════════════════════════
--
-- INSERT — „Users can join groups"
--   with_check: auth.uid() = user_id
--               AND status IN ('activ', 'pending')
--   Adică: orice utilizator logat se poate insera SINGUR, cu
--   `status = 'activ'`, în ORICE grup, printr-o cerere directă la API.
--   Fără invitație, fără aprobare, fără să atingă vreun buton.
--   Decizia de produs „grupuri doar cu aprobare" e respectată azi doar
--   de interfață.
--
-- UPDATE — „Users or admin can update membership"
--   qual:       auth.uid() = user_id OR ești adminul grupului
--   with_check: NULL  ⇒ Postgres refolosește `qual` și la scriere
--   Adică: omul își poate muta singur rândul propriu pe `activ`.
--   ⚠️ DE AICI VINE REGULA SESIUNII: dacă am strânge doar INSERT-ul,
--   ocolirea ar fi de două cereri în loc de una — inserezi `pending`,
--   apoi te muți pe `activ`. Fixul pe INSERT singur nu valorează
--   nimic.
--
-- NU SE ATINGE AICI (pe listă separat, sesiunea următoare):
--   DELETE — „Users can delete membership" are o greșeală de scriere,
--   `gm.grup_id = gm.grup_id` (comparație cu ea însăși, mereu
--   adevărată), care lasă orice membru activ al oricărui grup să
--   șteargă pe oricine din orice grup. Repararea ei cere și o funcție
--   pentru votul de excludere, fiindcă ștergerea de acolo o face
--   browserul membrului care dă votul decisiv, nu adminul
--   (`grup-details.html:4037`).


-- ── 1. INSERT: se cere alăturarea, nu se ia ─────────────────────────
--
-- Trei porți, în aceeași politică:
--   • te inserezi doar pe tine                → auth.uid() = user_id
--   • `activ` DOAR dacă ești adminul grupului → cazul fondatorului,
--     care se adaugă singur ca membru imediat după ce creează grupul
--     (`grup-nou.html:837`). Fără excepția asta, crearea de grup se
--     rupe.
--   • toți ceilalți: doar `pending`, și doar cu profilul completat
--
-- ⚠️ Fondatorul NU trece prin `profil_complet`. E deliberat: cine
-- pornește un grup e deja implicat, iar `grup-nou.html` nu cere azi
-- profil completat — dacă am adăuga condiția aici, crearea de grup
-- s-ar rupe tăcut pentru cine n-a terminat profilul. De discutat
-- separat, e decizie de produs, nu de securitate.

DROP POLICY IF EXISTS "Users can join groups" ON public.grup_membri;

CREATE POLICY "Cerere de alaturare, doar pending"
ON public.grup_membri
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    -- ⬇️ LINIA OPȚIONALĂ: regula „agențiile nu intră în grupuri",
    --    care azi trăiește doar în trei butoane. Dacă vrei s-o lăsăm
    --    pe altă dată, șterge rândul de mai jos și rulează la loc.
    AND NOT public.cont_de_agentie(auth.uid())
    AND (
            (status::text = 'activ'   AND public.este_admin_grup(grup_id))
         OR (status::text = 'pending' AND public.profil_complet(auth.uid()))
    )
);


-- ── 2. UPDATE: statusul îl mută adminul, nu membrul ─────────────────
--
-- Ce rămâne să funcționeze, verificat în cod:
--   • adminul aprobă o cerere            → `grup-details.html:2529`
--   • adminul de platformă intervine     → nou, n-avea voie până acum
--
-- Ce dispare INTENȚIONAT:
--   • ramura „auth.uid() = user_id", adică membrul care își scrie
--     singur statusul. Singurul loc din frontend care o folosea era
--     acceptarea invitației (`grup-details.html:3401`) — mutată pe
--     `accept_group_invitation()` din fișierul 6.
--
-- `WITH CHECK` e scris explicit și identic cu `USING`. Fără el,
-- Postgres l-ar deduce din `USING`, dar am mai plătit o dată lipsa lui
-- (2 august, `grup_invitations`): fără `WITH CHECK`, un UPDATE poate
-- muta rândul într-o stare pe care politica n-a apucat s-o verifice.

DROP POLICY IF EXISTS "Users or admin can update membership" ON public.grup_membri;

CREATE POLICY "Adminul grupului gestioneaza membrii"
ON public.grup_membri
FOR UPDATE
TO authenticated
USING      (public.este_admin_grup(grup_id) OR public.is_platform_admin())
WITH CHECK (public.este_admin_grup(grup_id) OR public.is_platform_admin());


-- ═══════════════════════════════════════════════════════════════════
--  CONTROALE
-- ═══════════════════════════════════════════════════════════════════

-- CONTROL 1 — cum arată acum politicile de scriere
-- Așteptat: INSERT-ul și UPDATE-ul cu numele noi, ambele
-- `{authenticated}`. Dacă mai apare vreun rând `{public}` pe INSERT
-- sau UPDATE, ceva n-a fost șters.
SELECT policyname, cmd AS operatie, roles AS pentru_cine,
       qual AS conditie_citire, with_check AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grup_membri'
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY cmd;


-- CONTROL 2 — nicio politică de pe `grup_membri` nu citește `profiles`
-- direct. Capcana din 1 august: o politică ce citește o coloană
-- revocată nu întoarce fals, ci CRAPĂ toată interogarea. Toate
-- citirile noastre trec prin funcții `SECURITY DEFINER`.
-- Așteptat: 0 rânduri.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grup_membri'
  AND (qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%');


-- ═══════════════════════════════════════════════════════════════════
--  PROBA CARE CHIAR DOVEDEȘTE CEVA — se face impersonând
-- ═══════════════════════════════════════════════════════════════════
-- În SQL Editor ești `postgres`: `auth.uid()` e NULL, RLS-ul nu te
-- atinge, deci orice INSERT de aici „merge" și nu dovedește nimic.
--
-- Rulează blocul de mai jos ÎNTR-UN TAB SEPARAT (nu aici, ca să nu
-- amesteci tranzacțiile). Înlocuiește UUID-ul cu al unui cont
-- OBIȘNUIT — NU al superadminului, care trece oricum prin
-- `is_platform_admin()` și ascunde exact ce vrei să vezi — și
-- GRUP-UUID cu un grup din care contul ăla NU face parte.
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-UTILIZATOR","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   -- (a) intrare directă ca `activ` — TREBUIE să pice
--   --     mesaj așteptat: „new row violates row-level security policy"
--   INSERT INTO public.grup_membri (grup_id, user_id, status)
--   VALUES ('GRUP-UUID', 'UUID-UTILIZATOR', 'activ');
--
--   ROLLBACK;
--
-- Apoi, în alt tab, aceeași impersonare pentru celelalte două:
--
--   -- (b) cerere `pending` cu profil completat — TREBUIE să treacă
--   INSERT INTO public.grup_membri (grup_id, user_id, status)
--   VALUES ('GRUP-UUID', 'UUID-UTILIZATOR', 'pending');
--
--   -- (c) auto-promovarea, ocolirea de două cereri — TREBUIE să pice
--   --     (0 rânduri actualizate, fără eroare — RLS filtrează rândul)
--   UPDATE public.grup_membri SET status = 'activ'
--   WHERE user_id = 'UUID-UTILIZATOR' AND grup_id = 'GRUP-UUID';
--
-- ⚠️ Fiecare bloc trebuie să aibă ROLLBACK-ul lui, altfel rămân rânduri
-- de probă în tabelă. Și ⚠️ ROLLBACK-ul anulează tot ce e în același
-- script — de aia probele astea stau AICI, în comentariu, nu în
-- fișierul care creează politicile.
--
-- ȘI PROBA DIN INTERFAȚĂ, care contează la fel de mult:
--   1. cu un cont cu profil INCOMPLET, pe pagina unui grup → butonul
--      trebuie să spună „Completează-ți profilul", nu să dea eroare;
--   2. cu un cont cu profil complet → „Cere alăturarea" trimite
--      cererea și adminul o vede în „Cereri în așteptare";
--   3. adminul aprobă → membrul devine activ;
--   4. o invitație trimisă de ADMIN, acceptată → intri direct;
--   5. o invitație trimisă de un MEMBRU obișnuit, acceptată → rămâi
--      în așteptare și adminul primește emailul de aprobare.


-- ═══════════════════════════════════════════════════════════════════
--  DACĂ SE STRICĂ CEVA — revenire la starea de dinainte
-- ═══════════════════════════════════════════════════════════════════
-- Decomentează și rulează. Redeschide gaura, dar repune site-ul exact
-- cum era, până înțelegem ce n-a mers.
--
-- DROP POLICY IF EXISTS "Cerere de alaturare, doar pending" ON public.grup_membri;
-- DROP POLICY IF EXISTS "Adminul grupului gestioneaza membrii" ON public.grup_membri;
--
-- CREATE POLICY "Users can join groups" ON public.grup_membri
--     FOR INSERT TO public
--     WITH CHECK ((auth.uid() = user_id)
--                 AND ((status)::text = ANY ((ARRAY['activ'::character varying,
--                                                   'pending'::character varying])::text[])));
--
-- CREATE POLICY "Users or admin can update membership" ON public.grup_membri
--     FOR UPDATE TO public
--     USING ((auth.uid() = user_id)
--            OR (auth.uid() IN (SELECT grupuri.admin_id FROM grupuri
--                               WHERE grupuri.id = grup_membri.grup_id)));

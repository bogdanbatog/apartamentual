-- ═══════════════════════════════════════════════════════════════════
--  CREAREA DE GRUP CERE PROFIL COMPLETAT
--
--  CE REPARĂ: pe 2 august am închis intrarea în grupuri fără profil
--  completat (`grup_membri`), dar am lăsat deliberat o excepție pentru
--  fondator — vezi comentariul din
--  `securitate-grupuri/7-politici-join-cu-aprobare.sql:60`:
--
--      „⚠️ Fondatorul NU trece prin `profil_complet`. E deliberat […]
--       De discutat separat, e decizie de produs, nu de securitate."
--
--  Discuția s-a purtat pe 7 august, după ce un cont nou (Max Susanu)
--  a pornit un grup cu profilul gol, iar Lucian a reprodus traseul cu
--  o adresă de test. Decizia: crearea de grup cere profil completat,
--  ca și intrarea în grup. Cine pornește un grup devine adminul lui —
--  oamenii îi cer alăturarea uitându-se la un profil care azi e gol.
--
--  ⚠️⚠️ ORDINEA E OBLIGATORIE, aceeași lecție ca pe 1 și 2 august:
--     1. frontendul deployat pe cPanel  (grup-nou.html, register.js,
--        profile-edit-new.js), APOI
--     2. fișierul ăsta.
--  Invers, cine are profilul incomplet primește o eroare seacă de la
--  API în loc de mesajul „Mai e un pas".
--
--  ⚠️ NU pune BEGIN…ROLLBACK în script. Editorul SQL din Supabase
--  rulează tot fișierul ca o singură tranzacție, iar un ROLLBACK de
--  probă anulează tăcut și ce e deasupra lui (lecția din 1 august).
--
--  ⚠️ RULEAZĂ ÎNTÂI `0-diagnostic.sql` și uită-te la interogarea 1.
--  Blocul de mai jos șterge TOATE politicile de INSERT de pe `grupuri`
--  și pune una singură în loc. Dacă în diagnostic apare vreo politică
--  de INSERT pe care n-o recunoști, oprește-te și întreabă-mă.
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Ștergem politicile de INSERT existente ───────────────────────
--
-- DE CE NU LE LĂSĂM ȘI ADĂUGĂM UNA STRICTĂ PESTE:
-- politicile permisive se combină cu OR. O politică largă lăsată în
-- urmă o anulează complet pe cea nouă, iar scriptul „rulează cu
-- succes" fără să schimbe nimic. E capcana din 2 august.
--
-- Ștergem printr-un bloc care le enumeră singur, ca să nu ghicim
-- numele. Fiecare ștergere e anunțată — uită-te în panoul de mesaje
-- („Notices") după rulare și compară cu diagnosticul.

DO $$
DECLARE
    p record;
    n int := 0;
BEGIN
    FOR p IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'grupuri'
          AND cmd = 'INSERT'
    LOOP
        RAISE NOTICE 'Șterg politica de INSERT: %', p.policyname;
        EXECUTE format('DROP POLICY %I ON public.grupuri', p.policyname);
        n := n + 1;
    END LOOP;

    IF n = 0 THEN
        RAISE NOTICE 'Nicio politică de INSERT găsită pe `grupuri`.';
    END IF;
END $$;


-- ── 2. Politica nouă ────────────────────────────────────────────────
--
-- Patru condiții, toate necesare:
--
--   • te treci pe tine ca autor       → auth.uid() = created_by
--   • și ca admin al grupului         → auth.uid() = admin_id
--     (până acum nimic nu împiedica pe cineva să creeze prin API un
--      grup administrat de altcineva)
--   • nu ești cont de agenție         → regula era doar în butoane
--     (`grup-nou.html`), acum e și în bază
--   • ai profilul completat           → NOUL PRAG
--
-- `profil_complet()` e aceeași funcție care păzește intrarea în grup
-- (`securitate-grupuri/6-functii-join-cu-aprobare.sql`). O refolosim
-- exact ca să nu apară un al doilea prag, ușor diferit — „profil
-- complet" e deja scris în prea multe locuri.
--
-- Adminul de platformă trece pe deasupra: are nevoie să poată crea
-- sau repara grupuri fără să-și completeze un profil de participant.

CREATE POLICY "Creare grup: doar cu profil completat"
ON public.grupuri
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_platform_admin()
    OR (
            auth.uid() = created_by
        AND auth.uid() = admin_id
        AND NOT public.cont_de_agentie(auth.uid())
        AND public.profil_complet(auth.uid())
    )
);


-- ── 3. Ce NU se atinge aici, intenționat ────────────────────────────
--
-- • Grupurile deja create rămân exact cum sunt. Politica se aplică la
--   INSERT, iar grupul lui Max Susanu („Bloc Boutique 4-8
--   apartamente") e deja în tabelă. Decizia luată e (a): grupul
--   rămâne, îi trimitem un email să-și completeze profilul.
--
-- • Excepția fondatorului din politica de pe `grup_membri`
--   („status='activ' AND este_admin_grup(grup_id)") RĂMÂNE, și trebuie
--   să rămână: `grup-nou.html` inserează creatorul ca membru activ
--   imediat după crearea grupului. Nu mai e o gaură, pentru că nu mai
--   poți deveni `admin_id` fără profil completat — poarta s-a mutat cu
--   un pas mai devreme, pe `grupuri`.
--
-- • Politica de DELETE de pe `grup_membri`, cu greșeala de scriere
--   `gm.grup_id = gm.grup_id`, rămâne pe listă separat (vine cu votul
--   de excludere).


-- ═══════════════════════════════════════════════════════════════════
--  CONTROALE
-- ═══════════════════════════════════════════════════════════════════

-- CONTROL 1 — o singură politică de INSERT, pe `authenticated`
-- Așteptat: exact 1 rând. Dacă apar două, ștergerea de la pasul 1
-- n-a prins ceva, iar cea largă o anulează pe cea nouă.
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grupuri'
  AND cmd = 'INSERT';


-- CONTROL 2 — nicio politică de pe `grupuri` nu citește `profiles`
-- direct. Capcana din 1 august: o politică ce citește o coloană
-- revocată nu întoarce fals, ci CRAPĂ toată interogarea, și odată cu
-- ea toată pagina. Citirile noastre trec prin funcții SECURITY DEFINER.
-- Așteptat: 0 rânduri.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grupuri'
  AND (qual ILIKE '%profiles%' OR with_check ILIKE '%profiles%');


-- CONTROL 3 — grupurile existente n-au fost atinse
-- Așteptat: același număr ca înainte de rulare, iar grupul lui Max
-- încă acolo.
SELECT COUNT(*) AS grupuri_totale FROM public.grupuri;


-- ═══════════════════════════════════════════════════════════════════
--  PROBA CARE CHIAR DOVEDEȘTE CEVA — se face impersonând
-- ═══════════════════════════════════════════════════════════════════
-- În SQL Editor ești `postgres`: `auth.uid()` e NULL și RLS-ul nu te
-- atinge, deci orice INSERT de aici „merge" și nu dovedește nimic.
--
-- Rulează blocul de mai jos ÎNTR-UN TAB SEPARAT, cu UUID-ul contului
-- de test cu care ai reprodus traseul (profil gol). NU al
-- superadminului — acela trece prin `is_platform_admin()` și ascunde
-- exact ce vrei să vezi.
--
--   BEGIN;
--   SELECT set_config('request.jwt.claims',
--       '{"sub":"UUID-CONT-TEST","role":"authenticated"}', true);
--   SET LOCAL role authenticated;
--
--   -- TREBUIE să pice, cu „new row violates row-level security policy"
--   INSERT INTO public.grupuri (nume, oras, status, created_by, admin_id)
--   VALUES ('Proba RLS', 'București', 'explorare',
--           'UUID-CONT-TEST', 'UUID-CONT-TEST');
--
--   ROLLBACK;
--
-- Și încă una, cu un cont cu profilul COMPLET (al tău, dacă nu ești
-- superadmin — altfel nu dovedește nimic): același INSERT TREBUIE să
-- treacă. Tot cu ROLLBACK la final, ca să nu rămână grupul de probă.
--
-- ȘI PROBA DIN INTERFAȚĂ, care contează la fel de mult:
--   1. cont cu profil incomplet → `grup-nou.html` arată „Mai e un pas",
--      NU formularul și NU o eroare;
--   2. butonul de acolo duce la profil, iar după salvare te întorci
--      singur pe formularul de creare grup;
--   3. cont cu profil complet → formularul apare ca înainte, grupul se
--      creează, iar fondatorul apare imediat ca membru activ cu
--      eticheta „Admin";
--   4. înregistrare nouă din „Pornește un grup" → linkul din email duce
--      la PROFIL, nu direct la crearea grupului.


-- ═══════════════════════════════════════════════════════════════════
--  DACĂ SE STRICĂ CEVA — revenire la starea de dinainte
-- ═══════════════════════════════════════════════════════════════════
-- ⚠️ Completează numele și condiția politicii vechi din rezultatul
-- interogării 1 a diagnosticului ÎNAINTE de a avea nevoie de asta —
-- după DROP nu mai poți afla ce scria acolo.
--
-- DROP POLICY IF EXISTS "Creare grup: doar cu profil completat" ON public.grupuri;
--
-- CREATE POLICY "✏️ NUMELE VECHI" ON public.grupuri
--     FOR INSERT TO public
--     WITH CHECK ( /* ✏️ CONDIȚIA VECHE, din diagnostic */ );

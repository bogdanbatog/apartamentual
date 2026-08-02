-- ═══════════════════════════════════════════════════════════════════
--  PASUL 2 — șterge politica ce deschide `grup_membri` către oricine
--
--  ⚠️⚠️ NU RULA ASTA ÎNAINTE DE:
--     1. să fi rulat `1-view-numar-membri.sql`, ȘI
--     2. codul de frontend să fie DEPLOYAT pe cPanel.
--
--  Ordinea inversă = toate cardurile de pe /grupuri.html arată „0/12"
--  până se face deploy-ul. Aceeași lecție ca la profiles, 1 august:
--  view → cod live → revocare. Niciodată altfel.
--
--  ⚠️ NU pune BEGIN…ROLLBACK în acest script — vezi nota din PASUL 1.
-- ═══════════════════════════════════════════════════════════════════


-- ── Ce se șterge și de ce ───────────────────────────────────────────
-- `anon_count_grup_membri` (SELECT, rol `anon`, qual = true) a fost
-- adăugată ca să meargă numărul de membri de pe vitrina publică.
-- Efectul real e însă acces liber la toată tabela: 34 de rânduri,
-- toate grupurile, cu user_id, status și dată de intrare. Postgres nu
-- poate exprima „ai voie doar să numeri" — cine poate număra, poate
-- citi. Numărul vine de acum din view-ul `grup_membri_count`.
--
-- Politicile permisive se combină cu OR, deci CÂT TIMP asta există,
-- politica bună de dedesubt nu restrânge nimic.

DROP POLICY IF EXISTS anon_count_grup_membri ON public.grup_membri;


-- ── Ce NU se atinge ─────────────────────────────────────────────────
-- Politica dorită EXISTĂ DEJA și rămâne exact cum e:
--
--   „Authenticated users can view group members"
--   SELECT | qual: auth.role() = 'authenticated'
--
-- Adică fix decizia de produs din 1 august: lista de membri se vede
-- de oricine are cont, nu doar de membrii grupului. Nu e nevoie să
-- scriem nicio politică nouă — doar s-o lăsăm să conteze, ștergând-o
-- pe cea care o anula.
--
-- Rămân neatinse și cele trei politici `anon` legitime, care țin
-- vitrina publică în viață:
--   • anon_view_grupuri      (grupurile nearhivate)
--   • anon_view_grup_zones   (21 de rânduri)
--   • anon_view_grup_tags    (47 de rânduri)


-- ── CONTROL 1: ce politici de citire au mai rămas pe grup_membri ─────
-- Așteptat: UN SINGUR rând de SELECT, cel cu `authenticated`.
-- Dacă mai apare vreunul cu rolul `anon` sau cu qual `true`, gaura
-- nu s-a închis.

SELECT policyname, cmd AS operatie, roles AS pentru_cine, qual AS conditie
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grup_membri'
  AND cmd = 'SELECT';


-- ── CONTROL 2: view-ul încă răspunde ────────────────────────────────
-- Trebuie să întoarcă aceleași numere ca înainte de ștergere.
-- Dacă întoarce 0 peste tot, view-ul a fost creat greșit — pune
-- politica la loc imediat cu blocul de la finalul fișierului.

SELECT grup_id, membri_count
FROM public.grup_membri_count
ORDER BY membri_count DESC;


-- ═══════════════════════════════════════════════════════════════════
--  VERIFICAREA CARE CONTEAZĂ — se face DIN AFARĂ, nu de aici
-- ═══════════════════════════════════════════════════════════════════
-- În SQL Editor ești superutilizator, deci vezi tot indiferent de
-- politici. Proba adevărată se dă cu cheia anon, din browser sau
-- terminal. Cele două cereri, cu cheia din `js/supabase-config.js`:
--
--   GET /rest/v1/grup_membri?select=*
--        ÎNAINTE: 206, Content-Range: 0-33/34
--        DUPĂ:    200, Content-Range: */0   ← listă goală
--
--   GET /rest/v1/grup_membri_count?select=*
--        DUPĂ:    numerele, intacte
--
-- Și în interfață, nelogat: cardurile de pe /grupuri.html trebuie să
-- arate în continuare „3/12", nu „0/12".


-- ═══════════════════════════════════════════════════════════════════
--  DACĂ SE STRICĂ CEVA — revenire în 5 secunde
-- ═══════════════════════════════════════════════════════════════════
-- Decomentează și rulează. Redeschide gaura, dar repune site-ul în
-- starea de dinainte până înțelegem ce n-a mers.
--
-- CREATE POLICY anon_count_grup_membri ON public.grup_membri
--     FOR SELECT TO anon USING (true);

-- =============================================================================
-- 1. STEAGUL `profiles.cont_intern` — coloana + marcarea conturilor
-- =============================================================================
--
--  ✅✅ RULAT PE 12 AUGUST 2026. NU MAI E DE FACUT.
--      Rezultat (CSV 91): 23 de conturi marcate, 70 de utilizatori reali ramasi.
--      Il pastram fiindca explica DE CE exista coloana si CUM se marcheaza un
--      cont nou. Blocul 2 poate fi rulat oricand din nou, fara efecte secundare.
--
-- =============================================================================
-- ⚠️ ACEST FISIER SCRIE IN BAZA. Se ruleaza PE BLOCURI, in ordine, nu tot odata.
-- ⚠️ RULEAZA INTAI `0-cine-ar-fi-marcat.sql` si citeste sectiunea C cu ochiul.
--    Lista din Blocul 2 de mai jos e punctul de plecare, nu adevarul final.
--
-- CE E ASTA SI DE CE NU E `is_demo`
--   `is_demo` = PERSONAJ INVENTAT. E un marcaj PUBLIC: pune badge-ul „Exemplu"
--   langa nume pe /utilizatori (`js/utilizatori.js:440`), scrie „Exemplu" in
--   loc de „Utilizator Activ" pe pagina profilului (`js/profile-view-new.js:269`)
--   si pune badge in lista de membri a grupului (`grup-details.html:1839`).
--   Asta e potrivit pentru Cristina Moldovan sau Bogdan Radu. NU e potrivit
--   pentru Liviu Fabian, co-fondatorul platformei, sau pentru Carmen si Tibs,
--   care sunt oameni reali cu cont de test.
--
--   `cont_intern` = OM REAL, DAR DE-AL CASEI. Steag pur intern:
--     • NU se vede nicaieri pe site;
--     • NU scoate contul din lista publica si nu schimba numaratoarea;
--     • serveste la un singur lucru — sa nu-i trimita campaniile si sa nu-i
--       numere in statistici.
--
--   Cele doua NU se exclud. Un cont poate fi si `is_demo`, si `cont_intern`.
--
-- DE CE ACUM
--   Automatizarea digestului de terenuri ruleaza singura in fiecare saptamana.
--   Lista de emailuri scrisa de mana (copiata azi in doua fisiere de campanie)
--   nu poate fi intretinuta de o functie care porneste fara sa fie nimeni acolo.
--
-- ⚠️ NU PUNE `BEGIN ... ROLLBACK` in acest script. Editorul SQL din Supabase
--    ruleaza TOT scriptul ca o singura tranzactie; un ROLLBACK scris mai jos
--    anuleaza tacut si ALTER-ul, si UPDATE-urile de deasupra, dupa ce
--    controalele au afisat deja rezultate care par bune.
-- =============================================================================


-- ═════════════════════════════════════════════════════════════════════════════
--  BLOCUL 1 — coloana
-- ═════════════════════════════════════════════════════════════════════════════
-- `NOT NULL DEFAULT false` e deliberat, nu stil. Daca as lasa-o sa accepte NULL,
-- am repeta capcana lui `account_status`: o interogare scrisa `WHERE cont_intern
-- = false` ar sari TACUT peste toate randurile cu NULL. Asa, orice cont are un
-- raspuns clar: da sau nu.
--
-- Adaugarea nu rescrie tabela (Postgres 11+ tine valoarea implicita in catalog),
-- deci nu blocheaza site-ul cat ruleaza.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS cont_intern boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.cont_intern IS
    'Om real, dar de-al casei (echipa, prieteni cu cont de test, adrese temporare). '
    'Steag INTERN, invizibil pe site — spre deosebire de is_demo, care e public. '
    'Se foloseste ca sa nu primeasca emailurile de campanie si sa nu intre in statistici.';


-- ═════════════════════════════════════════════════════════════════════════════
--  BLOCUL 1b — DREPTURI: se lasa dinadins NEATINSE
-- ═════════════════════════════════════════════════════════════════════════════
-- Aici NU e nimic de rulat. Blocul exista ca sa nu vina cineva peste sase luni
-- si sa „repare" lipsa unui GRANT crezand ca s-a uitat.
--
-- Pe 1 august, `authenticated` a ramas cu SELECT pe o lista de exact 20 de
-- coloane numite (`securitate-profiles/6-revoca-pentru-logati.sql:73-94`), iar
-- dreptul pe toata tabela a fost revocat. Consecinta: o coloana NOUA nu e
-- citibila de nimeni logat, si cu atat mai putin de `anon`. Nu trebuie ascunsa,
-- e ascunsa din nastere.
--
-- La fel la scriere: UPDATE pe `profiles` merge tot pe lista explicita de
-- coloane. `cont_intern` nu primeste GRANT, deci NIMENI nu si-l poate scoate
-- singur din browser. Se pune doar de aici, din SQL Editor (ca `postgres`), sau
-- din edge functions cu `service_role` — amandoua ocolesc drepturile.
--
-- Si `profiles_visible` e inghetat la 31 de coloane (31 iulie), deci coloana nu
-- iese nici pe acolo. A treia poarta, inchisa fara sa facem nimic.
--
--   ⚠️ DACA vreodata vrei bifa asta in `/admin.html`, atunci — si NUMAI atunci —
--      ai nevoie de `GRANT UPDATE (cont_intern) ON public.profiles TO authenticated`
--      PLUS o politica RLS care sa o restranga la superadmini. Fara politica,
--      grantul o deschide pentru ORICINE e logat. Nu o face acum: nu e nevoie.


-- ═════════════════════════════════════════════════════════════════════════════
--  BLOCUL 2 — marcarea conturilor
-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ LISTA A FOST VERIFICATA pe diagnosticul din 12 august (CSV 90):
--    22 de candidati, 0 ratati de regulile automate, PLUS `ltfb.studio@gmail.com`
--    gasit cu ochiul in sectiunea C si confirmat de Lucian ca fiind al studioului.
--    E ultima data cand lista se scrie de mana — de aici incolo traieste in baza.
--
-- ⚠️ Daca rulezi asta mai tarziu de 12 august 2026, ruleaza INTAI fisierul 0 din
--    nou: intre timp se pot fi inscris conturi noi de test.
--
-- Marcarea e facuta sa poata fi rulata de mai multe ori fara efecte secundare:
-- pune `true` unde e `false`, atat.

UPDATE public.profiles p
SET cont_intern = true
WHERE COALESCE(p.cont_intern, false) = false
  AND (
        -- 1. Adresele confirmate (echipa + prietenii cu cont de test)
        LOWER(btrim(p.email)) IN (
            'liviu.fabian@gmail.com',      -- Liviu Fabian, co-fondator
            'lucianluta@yahoo.com',        -- Lucian
            'luta.lucian.m@gmail.com',     -- Lucian, al doilea cont
            'cotofana.carmen@yahoo.com',   -- Carmen, cont de test (inactiv permanent)
            'carmen2000ro@yahoo.com',      -- Carmen, al doilea cont
            'raluca.ivanov26@gmail.com',   -- Raluca, angajata, cont de testari
            'tiberiu.abc.maxim@gmail.com', -- Tibs, cont de test (inactiv permanent)
            'livia.dila@yahoo.com',        -- Livia

            -- ⚠️ Adaugat pe 12 august, dupa diagnostic. Contul studioului, dar pe
            -- GMAIL — deci filtrul de domeniu de mai jos NU-l prindea, si nici
            -- lista veche. Aparea printre destinatarii reali (CSV 90, sectiunea C:
            -- „Liviu Marian", inscris 05.08.2026, 9 zone bifate).
            -- Lectia: filtrul pe domeniul firmei prinde doar adresele DE PE domeniu.
            -- Conturile facute cu Gmail personal trec pe langa el, tacut.
            'ltfb.studio@gmail.com'        -- contul studioului (confirmat de Lucian)
        )

        -- 2. Orice adresa de pe domeniul firmei
     OR LOWER(p.email) LIKE '%@ltfbstudio.ro'

        -- 3. Orice alias de test, al oricui — nu doar `luta.lucian.m+`.
        --    Asa se face un cont de test in cinci secunde; lista veche prindea
        --    doar aliasurile lui Lucian, deci al oricui altcuiva trecea.
        --
        --    ⚠️ SINGURA REGULA DE AICI CARE POATE GRESI. Exista oameni reali
        --    care se inscriu cu alias, ca sa vada cine le vinde adresa:
        --    `numele.lui+apartamentual@gmail.com`. Un asemenea om e prospect
        --    adevarat, iar regula asta l-ar scoate TACUT din toate campaniile.
        --    De asta fisierul 0 ii arata separat, cu motivul „alias de test":
        --    uita-te la ei INAINTE de a rula blocul. Daca vezi pe cineva care
        --    nu e de-al nostru, sterge randul asta si pune-l pe om la punctul 1.
        --
        --    ✅ VERIFICAT pe 12 august (CSV 90): toate cele 14 adrese cu `+` din
        --    baza sunt `luta.lucian.m+testN`. Niciun utilizator real nu foloseste
        --    alias, deci regula nu taie azi pe nimeni. Reverifica la urmatoarea
        --    rulare — e singurul loc unde regula poate incepe sa greseasca.
     OR LOWER(p.email) LIKE '%+%@%'

        -- 4. Steagurile de administrare. Cine administreaza platforma nu e
        --    destinatar de campanie.
     OR COALESCE(p.is_admin, false)       = true
     OR COALESCE(p.is_super_admin, false) = true
  );


-- ═════════════════════════════════════════════════════════════════════════════
--  BLOCUL 3 — CONTROL. Ruleaza-l dupa Blocul 2 si citeste rezultatul.
-- ═════════════════════════════════════════════════════════════════════════════
-- Cine a fost marcat, si cati oameni reali raman.
-- ⚠️ Iese o singura tabela — e o interogare cu UNION ALL, dinadins (editorul
--    Supabase arata doar rezultatul ultimei instructiuni).

WITH marcati AS (
    SELECT LOWER(btrim(email)) AS email,
           btrim(COALESCE(pseudonym, '(fara nume)')) AS nume
    FROM public.profiles
    WHERE cont_intern = true
),
reali AS (
    SELECT 1
    FROM public.profiles p
    WHERE p.cont_intern = false
      AND COALESCE(p.is_demo, false) = false
      AND p.account_type = 'activ'
      AND p.pseudonym IS NOT NULL
      AND p.email IS NOT NULL
      AND (p.account_status IS NULL OR p.account_status = 'active')
)
SELECT 1 AS ord, 'MARCAT `cont_intern`' AS ce, m.email AS detaliu, m.nume AS nume
FROM marcati m
UNION ALL
SELECT 2, 'TOTAL marcate', (SELECT COUNT(*)::text FROM marcati),
          'asteptat: 23 (cele 22 din diagnostic + ltfb.studio@gmail.com)'
UNION ALL
SELECT 2, 'RAMAN utilizatori reali', (SELECT COUNT(*)::text FROM reali),
          'asteptat: 70 (71 in diagnostic, minus contul studioului)'
ORDER BY ord, detaliu;


-- ═════════════════════════════════════════════════════════════════════════════
--  CE URMEAZA DUPA CE RULEZI FISIERUL ASTA
-- ═════════════════════════════════════════════════════════════════════════════
--   • Functia `lot_terenuri_noi` (digestul automat de terenuri) foloseste
--     `cont_intern = false` in loc de lista scrisa de mana.
--   • Blocurile `useri_exclusi` / `exclusi` din campaniile existente pot fi
--     inlocuite cu aceeasi conditie:
--         `terenuri-noi/4-lot-destinatari.sql:35-55`
--         `emailuri-profil-incomplet/1-lot-pentru-email.sql:35-54`
--     ⚠️ NU le atinge acum. Sunt fisiere de campanie deja rulate; se schimba
--     cand se scrie campania urmatoare, altfel rescriem istoria degeaba.
--   • Contul de test facut peste trei luni: pune-i steagul cu un UPDATE de un
--     rand, sau, daca folosesti un alias cu `+`, e prins automat.
-- =============================================================================

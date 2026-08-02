-- ═══════════════════════════════════════════════════════════════════
--  PASUL 5 — INVENTAR ÎNAINTE DE A STRÂNGE INTRAREA ÎN GRUPURI
--
--  Ce face: NIMIC. Doar citește și numără.
--  Nu creează, nu șterge, nu modifică nicio politică și niciun rând.
--  E sigur de rulat oricând, de câte ori vrei.
--
--  De ce există: pe 1 august, o revocare făcută fără inventar a golit
--  paginile de terenuri și parteneri, pentru că nimeni nu se uitase
--  ÎNAINTE la ce depinde de ce se schimbă. Scriptul ăsta e pasul care
--  a lipsit atunci.
--
--  Rulează-l în Supabase SQL Editor și trimite-mi rezultatul fiecărei
--  interogări. Pe baza lor confirmăm (sau corectăm) fișierele 6 și 7.
-- ═══════════════════════════════════════════════════════════════════


-- ------------------------------------------------------------
-- 1. Politicile de SCRIERE de pe `grup_membri`, exact cum sunt azi
--
--    Ce așteptăm să vedem (din inventarul de pe 2 august):
--      • INSERT „Users can join groups"
--          with_check: auth.uid() = user_id AND status IN ('activ','pending')
--          ⇒ orice cont se bagă singur, direct `activ`, în orice grup
--      • UPDATE „Users or admin can update membership"
--          qual: auth.uid() = user_id OR ești adminul grupului
--          with_check: NULL  ⇒ omul își poate muta singur rândul pe
--          `activ`, deci strângerea INSERT-ului singură n-ar valora
--          nimic
--      • DELETE „Users can delete membership"
--          ⚠️ ASTA NU SE ATINGE ÎN SESIUNEA ASTA — are o greșeală de
--          scriere (`gm.grup_id = gm.grup_id`, comparație cu ea
--          însăși, mereu adevărată) care lasă orice membru activ să
--          șteargă pe oricine din orice grup. E pe listă separat,
--          fiindcă repararea ei cere și o funcție pentru votul de
--          excludere.
-- ------------------------------------------------------------
SELECT
    policyname,
    cmd        AS operatie,
    roles      AS pentru_cine,
    qual       AS conditie_citire,
    with_check AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grup_membri'
ORDER BY cmd, policyname;


-- ------------------------------------------------------------
-- 2. Mai există grupuri „deschise" (intrare fără aprobare)?
--
--    Decizia de produs e „grupuri doar cu aprobare", dar butonul
--    „Alătură-te grupului" (intrare directă, fără aprobare) apare în
--    `grup-details.html` DOAR când grupul are status `deschis`.
--    Dacă ies 0 rânduri cu `deschis`, butonul e deja neatins de
--    nimeni și schimbarea din frontend e pur preventivă.
--    Dacă ies grupuri reale, trebuie să știm care sunt înainte de a
--    strânge politica — altfel oamenii care apasă butonul primesc
--    eroare în loc de explicație.
-- ------------------------------------------------------------
SELECT
    status,
    count(*) AS numar_grupuri,
    string_agg(nume, ' | ' ORDER BY nume) AS care_sunt
FROM public.grupuri
GROUP BY status
ORDER BY numar_grupuri DESC;


-- ------------------------------------------------------------
-- 3. Câți membri ACTUALI ar pica pragul „profil completat"?
--
--    ⚠️ De citit corect: regula nouă se aplică doar la intrările
--    VIITOARE. Rândurile existente NU sunt atinse, nimeni nu e dat
--    afară. Numărul de mai jos e doar ca să știm dinainte despre
--    câți oameni vorbim și să nu ne sperie o cifră mare la un audit
--    de peste trei luni.
--
--    Cele șase condiții sunt exact cele pe care le cere deja
--    formularul din `profile-edit-new.html` (pseudonim, camere,
--    suprafață, oraș — toate `required` — plus ≥1 zonă și ≥1 tag,
--    validate în `profile-edit-new.js:589` și `:594`). Nu inventăm
--    un prag nou.
-- ------------------------------------------------------------
SELECT
    gm.status                                   AS status_membru,
    count(*)                                    AS total,
    -- `COALESCE(..., false)` la final: cine n-are deloc rând în
    -- `profiles` trebuie numărat ca incomplet, nu sărit tăcut.
    count(*) FILTER (WHERE NOT COALESCE(
            COALESCE(TRIM(p.pseudonym), '') <> ''
        AND COALESCE(TRIM(p.preferred_rooms::text), '') <> ''
        AND p.preferred_area_sqm IS NOT NULL
        AND p.preferred_city_id  IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.user_preferred_zones z WHERE z.user_id = p.user_id)
        AND EXISTS (SELECT 1 FROM public.user_tags            t WHERE t.user_id = p.user_id)
    , false))                                   AS cu_profil_incomplet,
    count(*) FILTER (WHERE p.user_id IS NULL)   AS fara_rand_in_profiles
FROM public.grup_membri gm
LEFT JOIN public.profiles p ON p.user_id = gm.user_id
GROUP BY gm.status
ORDER BY total DESC;


-- ------------------------------------------------------------
-- 4. Conturi de agenție aflate în grupuri
--
--    În interfață, agențiile sunt oprite în trei locuri
--    (`grupuri.js`, `grup-details.html`, `grup-nou.html:714`), dar
--    în bază nu le oprește nimic. Politica nouă adaugă și regula
--    asta. Dacă apare aici vreun rând, spune-mi ÎNAINTE — înseamnă
--    că regula din interfață a fost ocolită cândva și trebuie decis
--    ce facem cu omul respectiv, nu doar închisă ușa.
-- ------------------------------------------------------------
SELECT
    gm.grup_id,
    g.nume        AS grup,
    gm.user_id,
    gm.status,
    p.account_type
FROM public.grup_membri gm
JOIN public.profiles p ON p.user_id = gm.user_id
LEFT JOIN public.grupuri g ON g.id = gm.grup_id
WHERE p.account_type = 'profesional';


-- ------------------------------------------------------------
-- 5. Numele exact al coloanei de admin pe `grupuri`
--
--    Politicile noi se sprijină pe `grupuri.admin_id`. Verificăm că
--    așa se numește (și că e `uuid`), ca să nu scriem o funcție care
--    trece la creare și crapă abia la prima rulare reală — exact
--    capcana `42804` din 1 august.
-- ------------------------------------------------------------
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'grupuri'
  AND column_name IN ('admin_id', 'max_membri', 'status')
ORDER BY column_name;


-- ------------------------------------------------------------
-- 6. Ce coloane are `grup_membri` (ca să nu ratăm un câmp scris de
--    utilizator pe rândul propriu, care ar cădea odată cu politica
--    de UPDATE)
--
--    În frontend, singurele UPDATE-uri pe tabela asta sunt:
--      • `grup-details.html:2529` — adminul aprobă o cerere (rămâne)
--      • `grup-details.html:3401` — acceptarea unei invitații (se
--        mută pe funcția din fișierul 6)
--    Dacă apare aici o coloană gen „rol" sau „notificări" pe care
--    membrul și-o setează singur, spune-mi — n-am găsit-o în cod.
-- ------------------------------------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'grup_membri'
ORDER BY ordinal_position;

-- ═══════════════════════════════════════════════════════════════════
--  DIAGNOSTIC — cum a putut un cont cu profilul gol să creeze un grup
--
--  ⚠️⚠️ NU RULA FIȘIERUL ĂSTA. Folosește `0b-diagnostic-intr-o-
--  singura-interogare.sql`.
--
--  DE CE: editorul SQL din Supabase afișează DOAR rezultatul ULTIMEI
--  interogări dintr-un script. Fișierul ăsta are cinci, deci din el se
--  vede una singură — exact ce s-a întâmplat pe 7 august (CSV 71 a
--  întors doar interogarea 5). Lecția era deja scrisă în
--  `securitate-grupuri/5b-inventar-intr-o-singura-interogare.sql`.
--
--  Îl păstrăm doar pentru că interogările sunt lizibile una câte una și
--  se pot rula manual, separat, dacă vrei să te uiți la ceva anume.
--
--  Fișier PUR DE CITIRE. Nu modifică nimic, nu are BEGIN/ROLLBACK
--  (lecția din 1 august: ROLLBACK-ul anulează tăcut tot scriptul).
-- ═══════════════════════════════════════════════════════════════════


-- ── 1. Politicile de pe `grupuri` ───────────────────────────────────
-- ÎNTREBAREA: cine are voie să insereze un rând în `grupuri`?
-- Asta e singura piesă care nu e în repo — politicile de pe
-- `grup_membri` le știm (fișierul 7), pe astea nu.
--
-- DE URMĂRIT: rândul cu `operatie = INSERT`. Dacă `conditie_scriere`
-- e doar `auth.uid() = created_by` (sau ceva la fel de larg), atunci
-- confirmă: nimic nu verifică profilul la crearea grupului.
-- ⚠️ Dacă vreun rând are `pentru_cine = {public}`, e o a doua
-- problemă — înseamnă că include și anonimii.
SELECT policyname   AS politica,
       cmd          AS operatie,
       roles        AS pentru_cine,
       qual         AS conditie_citire,
       with_check   AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grupuri'
ORDER BY cmd, policyname;


-- ── 2. Politicile de pe `grup_membri`, ca reamintire ────────────────
-- Ca să vedem negru pe alb excepția fondatorului din fișierul 7:
--   (status='activ' AND este_admin_grup(grup_id))
--    OR (status='pending' AND profil_complet(auth.uid()))
-- Prima ramură e poarta pe care a intrat.
SELECT policyname   AS politica,
       cmd          AS operatie,
       roles        AS pentru_cine,
       with_check   AS conditie_scriere
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'grup_membri'
  AND cmd IN ('INSERT', 'UPDATE')
ORDER BY cmd;


-- ── 3. Grupurile al căror fondator are profilul incomplet ───────────
-- ÎNTREBAREA: e Max Susanu un caz singular, sau sunt mai multe?
--
-- Folosim `profil_complet()` — aceeași funcție care păzește intrarea
-- în grupuri — ca să nu inventăm un al doilea prag (capcana „profil
-- complet definit în cinci locuri").
--
-- DE URMĂRIT: coloana `profil_fondator`. Fiecare „INCOMPLET" e un
-- grup pornit de cineva care doar și-a confirmat mailul.
SELECT g.nume                      AS grup,
       g.oras,
       g.status                    AS status_grup,
       g.created_at                AS creat_la,
       u.email                     AS email_fondator,
       COALESCE(NULLIF(TRIM(p.pseudonym), ''), '(fără pseudonim)') AS pseudonim,
       CASE WHEN public.profil_complet(g.admin_id)
            THEN 'complet' ELSE '⚠️ INCOMPLET' END AS profil_fondator,
       (SELECT COUNT(*) FROM public.grup_membri gm
         WHERE gm.grup_id = g.id AND gm.status = 'activ') AS membri_activi
FROM public.grupuri g
LEFT JOIN auth.users     u ON u.id       = g.admin_id
LEFT JOIN public.profiles p ON p.user_id = g.admin_id
ORDER BY public.profil_complet(g.admin_id) ASC, g.created_at DESC;


-- ── 4. Ce anume lipsește din profilul fondatorilor incompleți ───────
-- ÎNTREBAREA: cât de gol e profilul? Dacă lipsește doar tag-ul, e o
-- discuție. Dacă lipsește tot, e altceva.
--
-- Cele șase condiții din `profil_complet()`, desfăcute una câte una.
SELECT u.email,
       g.nume AS grup_pornit,
       CASE WHEN COALESCE(TRIM(p.pseudonym), '') <> '' THEN 'ok' ELSE 'LIPSĂ' END AS pseudonim,
       CASE WHEN COALESCE(TRIM(p.preferred_rooms::text), '') <> '' THEN 'ok' ELSE 'LIPSĂ' END AS camere,
       CASE WHEN p.preferred_area_sqm IS NOT NULL THEN 'ok' ELSE 'LIPSĂ' END AS suprafata,
       CASE WHEN p.preferred_city_id  IS NOT NULL THEN 'ok' ELSE 'LIPSĂ' END AS oras,
       CASE WHEN EXISTS (SELECT 1 FROM public.user_preferred_zones z WHERE z.user_id = p.user_id)
            THEN 'ok' ELSE 'LIPSĂ' END AS zone,
       CASE WHEN EXISTS (SELECT 1 FROM public.user_tags t WHERE t.user_id = p.user_id)
            THEN 'ok' ELSE 'LIPSĂ' END AS taguri,
       p.created_at AS profil_creat_la,
       u.email_confirmed_at AS mail_confirmat_la
FROM public.grupuri g
JOIN auth.users      u ON u.id       = g.admin_id
LEFT JOIN public.profiles p ON p.user_id = g.admin_id
WHERE NOT public.profil_complet(g.admin_id)
ORDER BY g.created_at DESC;


-- ── 5. Traseul contului: a văzut vreodată formularul de profil? ─────
-- ÎNTREBAREA: confirmă ipoteza din cod — cine vine pe
-- `register.html?redirect=/grup-nou.html` e trimis după confirmarea
-- mailului direct la crearea grupului, nu la profil (`register.js:462`).
--
-- DE URMĂRIT: distanța dintre `mail_confirmat_la` și `grup_creat_la`.
-- Câteva minute ⇒ a mers drept de la confirmare la creare, exact pe
-- traseul ocolitor.
SELECT u.email,
       u.created_at         AS cont_creat_la,
       u.email_confirmed_at AS mail_confirmat_la,
       g.created_at         AS grup_creat_la,
       g.created_at - u.email_confirmed_at AS cat_a_durat,
       g.nume               AS grup
FROM public.grupuri g
JOIN auth.users u ON u.id = g.admin_id
ORDER BY g.created_at DESC
LIMIT 20;

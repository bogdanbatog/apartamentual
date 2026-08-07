-- ═══════════════════════════════════════════════════════════════════
--  DIAGNOSTIC, DAR ÎNTR-O SINGURĂ INTEROGARE
--
--  De ce există: editorul SQL din Supabase afișează DOAR rezultatul
--  ultimei interogări dintr-un script. Fișierul `0-diagnostic.sql` are
--  cinci, deci din el s-a văzut una singură (CSV 71, interogarea 5).
--  Aceeași lecție ca la `securitate-grupuri/5b`, pe care am ratat-o.
--
--  Aici totul iese ca un singur tabel, cu o coloană `sectiune` care
--  spune la ce se uită fiecare rând.
--
--  Ce face: NIMIC. Doar citește. Sigur de rulat oricând.
--  Selectează tot, rulează o dată, exportă CSV-ul întreg.
-- ═══════════════════════════════════════════════════════════════════

SELECT sectiune, detaliu FROM (

    -- ── 1. Politicile de pe `grupuri`, exact cum sunt azi ───────────
    --    ASTA E PIESA CARE LIPSEȘTE și fără de care nu pot rula
    --    fișierul 1 în siguranță: ce politică păzește azi INSERT-ul.
    --    ⚠️ Notează rândul de INSERT undeva ÎNAINTE de a rula fișierul
    --    1 — după DROP nu mai poți afla ce scria acolo, iar blocul de
    --    revenire din fișierul 1 are nevoie de el.
    --    ⚠️ Dacă vreun rând spune `roluri: {public}`, e o a doua
    --    problemă: include și vizitatorii nelogați.
    SELECT '1. politici grupuri' AS sectiune,
           cmd
             || '  |  ' || policyname
             || '  |  roluri: ' || roles::text
             || '  |  qual: '   || COALESCE(qual, '—')
             || '  |  check: '  || COALESCE(with_check, '—') AS detaliu
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grupuri'

    UNION ALL

    -- ── 2. Politicile de scriere de pe `grup_membri`, ca reamintire ─
    --    Ca să se vadă negru pe alb excepția fondatorului din
    --    `securitate-grupuri/7`: ramura
    --      (status='activ' AND este_admin_grup(grup_id))
    --    e poarta pe care a intrat Max. Rămâne, dar devine inofensivă
    --    odată ce nu mai poți deveni `admin_id` fără profil completat.
    SELECT '2. politici grup_membri (scriere)',
           cmd
             || '  |  ' || policyname
             || '  |  roluri: ' || roles::text
             || '  |  check: '  || COALESCE(with_check, '—')
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grup_membri'
      AND cmd IN ('INSERT', 'UPDATE')

    UNION ALL

    -- ── 3. Fondatorii de grup, cu pragul aplicat ────────────────────
    --    ÎNTREBAREA: e Max singurul, sau sunt mai mulți?
    --    Folosim `profil_complet()` — aceeași funcție care păzește
    --    intrarea în grup — ca să nu inventăm un al doilea prag.
    --    Fiecare „⚠️ INCOMPLET" e un grup pornit de cineva care doar
    --    și-a confirmat un mail.
    SELECT '3. fondatori vs prag profil',
           CASE WHEN public.profil_complet(g.admin_id)
                THEN 'complet     ' ELSE '⚠️ INCOMPLET' END
             || '  |  ' || COALESCE(u.email, '(fara cont)')
             || '  |  grup: ' || g.nume
             || '  |  creat: ' || to_char(g.created_at AT TIME ZONE 'Europe/Bucharest', 'YYYY-MM-DD HH24:MI')
             || '  |  membri activi: '
             || (SELECT count(*) FROM public.grup_membri gm
                  WHERE gm.grup_id = g.id AND gm.status = 'activ')
    FROM public.grupuri g
    LEFT JOIN auth.users u ON u.id = g.admin_id

    UNION ALL

    -- ── 4. Ce anume lipsește din profilul fondatorilor incompleți ───
    --    ÎNTREBAREA: cât de gol e profilul? Dacă lipsește doar tagul, e
    --    o discuție. Dacă lipsește tot, e altceva.
    --    Cele șase condiții din `profil_complet()`, desfăcute.
    SELECT '4. ce lipseste din profil',
           COALESCE(u.email, '(fara cont)')
             || '  |  ' || CASE WHEN p.user_id IS NULL THEN 'NICIUN RAND IN PROFILES' ELSE 'are rand in profiles' END
             || '  |  pseudonim: '  || CASE WHEN COALESCE(TRIM(p.pseudonym), '') <> '' THEN 'ok' ELSE 'LIPSA' END
             || '  |  camere: '     || CASE WHEN COALESCE(TRIM(p.preferred_rooms::text), '') <> '' THEN 'ok' ELSE 'LIPSA' END
             || '  |  suprafata: '  || CASE WHEN p.preferred_area_sqm IS NOT NULL THEN 'ok' ELSE 'LIPSA' END
             || '  |  oras: '       || CASE WHEN p.preferred_city_id IS NOT NULL THEN 'ok' ELSE 'LIPSA' END
             || '  |  zone: '       || CASE WHEN EXISTS (SELECT 1 FROM public.user_preferred_zones z WHERE z.user_id = g.admin_id) THEN 'ok' ELSE 'LIPSA' END
             || '  |  taguri: '     || CASE WHEN EXISTS (SELECT 1 FROM public.user_tags t WHERE t.user_id = g.admin_id) THEN 'ok' ELSE 'LIPSA' END
    FROM public.grupuri g
    LEFT JOIN auth.users      u ON u.id       = g.admin_id
    LEFT JOIN public.profiles p ON p.user_id  = g.admin_id
    WHERE NOT public.profil_complet(g.admin_id)

    UNION ALL

    -- ── 5. Cine ar fi blocat de politica nouă, dacă ar crea azi ─────
    --    Control de siguranță ÎNAINTE de a rula fișierul 1: verificăm
    --    că nu blocăm din greșeală un cont care ar trebui să treacă.
    --    ⚠️ `is_platform_admin()` NU se poate evalua util aici —
    --    depinde de `auth.uid()`, care în SQL Editor e NULL. De aia
    --    numărăm pe coloanele din `profiles`, nu prin funcție.
    SELECT '5. bilant conturi active',
           'conturi „activ" total ' || count(*)
             || '  |  cu profil complet ' || count(*) FILTER (WHERE public.profil_complet(p.user_id))
             || '  |  incomplete ' || count(*) FILTER (WHERE NOT public.profil_complet(p.user_id))
    FROM public.profiles p
    WHERE COALESCE(p.account_type, 'activ') <> 'profesional'

) t
ORDER BY sectiune, detaliu;

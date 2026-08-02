-- ═══════════════════════════════════════════════════════════════════
--  PASUL 5b — ACELAȘI INVENTAR, DAR ÎNTR-O SINGURĂ INTEROGARE
--
--  De ce există: editorul SQL din Supabase afișează DOAR rezultatul
--  ultimei interogări dintr-un script. Fișierul 5 avea șase, deci din
--  el s-a văzut una singură. Aici totul iese ca un singur tabel, cu o
--  coloană „sectiune" care spune la ce se uită fiecare rând.
--
--  Ce face: NIMIC. Doar citește și numără. Sigur de rulat oricând.
--  Selectează tot și rulează o dată; exportă CSV-ul întreg.
-- ═══════════════════════════════════════════════════════════════════

SELECT sectiune, detaliu FROM (

    -- ── 1. Politicile de pe `grup_membri`, exact cum sunt azi ───────
    --    Ne uităm la INSERT și UPDATE (cele pe care le schimbăm) și la
    --    DELETE (pe care NU-l atingem azi, dar vreau confirmarea că are
    --    într-adevăr comparația `gm.grup_id = gm.grup_id`).
    SELECT '1. politici grup_membri' AS sectiune,
           policyname
             || '  |  ' || cmd
             || '  |  roluri: ' || roles::text
             || '  |  qual: '   || COALESCE(qual, '—')
             || '  |  check: '  || COALESCE(with_check, '—') AS detaliu
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'grup_membri'

    UNION ALL

    -- ── 2. Mai există grupuri „deschise" (intrare fără aprobare)? ───
    --    Butonul de intrare directă apărea doar la status `deschis`.
    --    Dacă nu mai există niciunul, schimbarea din frontend e pur
    --    preventivă.
    SELECT '2. grupuri dupa status',
           COALESCE(status, '(fara status)') || ' → ' || count(*) || ' grupuri: '
             || COALESCE(string_agg(nume, ', ' ORDER BY nume), '—')
    FROM public.grupuri
    GROUP BY status

    UNION ALL

    -- ── 3. Câți membri actuali ar pica pragul „profil completat" ────
    --    ⚠️ Doar informativ: regula nouă se aplică la intrările
    --    VIITOARE. Rândurile existente nu sunt atinse, nimeni nu iese
    --    din grup.
    --    `COALESCE(..., false)` e important: cine n-are deloc rând în
    --    `profiles` trebuie numărat ca incomplet, nu sărit.
    SELECT '3. membri vs prag profil',
           gm.status || ' → total ' || count(*)
             || ', cu profil incomplet ' || count(*) FILTER (WHERE NOT COALESCE(
                    COALESCE(TRIM(p.pseudonym), '') <> ''
                AND COALESCE(TRIM(p.preferred_rooms::text), '') <> ''
                AND p.preferred_area_sqm IS NOT NULL
                AND p.preferred_city_id  IS NOT NULL
                AND EXISTS (SELECT 1 FROM public.user_preferred_zones z WHERE z.user_id = p.user_id)
                AND EXISTS (SELECT 1 FROM public.user_tags            t WHERE t.user_id = p.user_id)
             , false))
             || ', fara rand in profiles ' || count(*) FILTER (WHERE p.user_id IS NULL)
    FROM public.grup_membri gm
    LEFT JOIN public.profiles p ON p.user_id = gm.user_id
    GROUP BY gm.status

    UNION ALL

    -- ── 4. Conturi de agenție ajunse în grupuri ─────────────────────
    --    În interfață sunt oprite în trei locuri, în bază de nimeni.
    --    Dacă apare vreun rând, spune-mi ÎNAINTE de fișierul 7.
    SELECT '4. agentii in grupuri',
           COALESCE(g.nume, '(grup sters)') || ' | ' || gm.status || ' | ' || gm.user_id::text
    FROM public.grup_membri gm
    JOIN public.profiles p ON p.user_id = gm.user_id
    LEFT JOIN public.grupuri g ON g.id = gm.grup_id
    WHERE p.account_type = 'profesional'

    UNION ALL

    -- ── 5. Coloanele pe care se sprijină politicile noi ─────────────
    --    `grupuri.admin_id` trebuie să existe și să fie uuid. Dacă nu,
    --    funcțiile din fișierul 6 s-ar crea fără reproș și ar crăpa
    --    abia la prima rulare reală (capcana 42804 din 1 august).
    SELECT '5. coloane grupuri',
           column_name || ' | ' || data_type || ' | nullable: ' || is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grupuri'
      AND column_name IN ('admin_id', 'max_membri', 'status')

    UNION ALL

    -- ── 6. Plasă: dacă vreo secțiune iese goală, să se vadă ─────────
    SELECT '0. control', 'inventar rulat pe ' || current_database()
                          || ', schema public, tabela grup_membri: '
                          || (SELECT count(*) FROM public.grup_membri) || ' randuri'

) t
ORDER BY sectiune, detaliu;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTROL: a trimis vreodată SINGUR digestul de anunțuri, în producție?
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE ÎNAINTE DE ORICE COD. Automatizarea „terenuri noi" copiază tiparul
-- digestului de anunțuri: aceeași poartă `x-cron-secret`, același `pg_cron`
-- din oră în oră, aceeași verificare a orei la București, același jurnal
-- anti-dublare. Dacă tiparul are un defect, îl moștenim în amândouă și-l
-- descoperim de două ori.
--
-- Ce ȘTIM deja: pe 5 august, digestul a fost probat MANUAL cap-coadă și a
-- ajuns un email real (vezi `3-proba-email.sql`). Ce NU ȘTIM: dacă sarcina
-- programată a mai trimis ceva de atunci, singură, fără să pornim noi nimic.
-- Asta se vede aici.
--
-- ⚠️ NU SCHIMBĂ NIMIC — strict SELECT, se poate rula oricând, de câte ori vrei.
--
-- ⚠️ SE RULEAZĂ ÎNTREG, DINTR-UN SINGUR „Run". E scris ca o singură
--    interogare cu `UNION ALL` fiindcă editorul SQL din Supabase afișează
--    doar rezultatul ULTIMEI instrucțiuni dintr-un script; cinci SELECT-uri
--    separate ar arăta o singură tabelă și ai crede că restul n-au întors nimic.
--
-- CUM SE CITEȘTE REZULTATUL — coloana `sectiune` te plimbă de la A la E.
-- Secțiunea D e cea care contează: dacă are rânduri cu dată DUPĂ 5 august,
-- tiparul funcționează nesupravegheat și poate fi copiat liniștit.
-- ═══════════════════════════════════════════════════════════════════════════

WITH

-- ── A. Sarcina programată există și e pornită? ─────────────────────────────
-- Dacă lipsește de tot, nimic din ce urmează nu are cum să fi rulat.
a_sarcina AS (
    SELECT
        'A. sarcina cron'::text                         AS sectiune,
        j.jobname::text                                 AS detaliu,
        ('activă: ' || j.active::text ||
         '  ·  program: ' || j.schedule::text)::text    AS valoare,
        NULL::timestamptz                               AS cand
    FROM cron.job j
    WHERE j.jobname = 'digest-anunturi-grup'
),

-- ── B. Ultimele 5 execuții ale sarcinii ────────────────────────────────────
-- ⚠️ `succeeded` înseamnă doar că CEREREA a plecat către funcție, NU că s-a
--    trimis vreun email. Pentru asta e secțiunea D.
--
-- ⚠️ `cron.job_run_details` NU are coloana `jobname` — are doar `jobid`, deci
--    numele sarcinii se ia din `cron.job` printr-un JOIN. (Aceeași greșeală e
--    și în `digest-anunturi/2-programare.sql`, pasul 3b — semn că interogarea
--    de acolo n-a fost rulată niciodată.)
b_executii AS (
    SELECT
        'B. execuții cron (ultimele 5)'::text                  AS sectiune,
        d.status::text                                         AS detaliu,
        COALESCE(left(d.return_message, 120), '(fără mesaj)')  AS valoare,
        d.start_time                                           AS cand
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
    WHERE j.jobname = 'digest-anunturi-grup'
    ORDER BY d.start_time DESC
    LIMIT 5
),

-- ── C. Ce a răspuns efectiv funcția ────────────────────────────────────────
-- `net._http_response` păstrează răspunsurile cererilor plecate cu pg_net.
-- 23 din 24 de execuții zilnice răspund „nu e ora potrivită" — e normal.
-- Căutăm rândurile de la ora 19 (București), singurele care pot trimite.
c_raspunsuri AS (
    SELECT
        'C. răspunsul funcției (ultimele 5)'::text          AS sectiune,
        ('cod HTTP ' || COALESCE(r.status_code::text, '—')) AS detaliu,
        COALESCE(left(r.content, 200), '(gol)')             AS valoare,
        r.created                                           AS cand
    FROM net._http_response r
    ORDER BY r.created DESC
    LIMIT 5
),

-- ── D. ⭐ RÂNDUL CARE CONTEAZĂ: ce a plecat, per grup, per seară ───────────
-- Un rând aici = un digest trimis efectiv. Dacă vezi date de DUPĂ 5 august,
-- sarcina programată își face treaba singură.
d_jurnal AS (
    SELECT
        'D. digesturi trimise (jurnal)'::text                       AS sectiune,
        COALESCE(g.nume::text, '(grup șters)')                      AS detaliu,
        (l.numar_anunturi::text || ' anunțuri → ' ||
         l.numar_destinatari::text || ' destinatari')::text         AS valoare,
        l.trimis_la                                                 AS cand
    FROM public.grup_anunturi_digest_log l
    LEFT JOIN public.grupuri g ON g.id = l.grup_id
    ORDER BY l.trimis_la DESC
    LIMIT 10
),

-- ── E. Emailurile propriu-zise, din jurnalul de notificări ─────────────────
-- Aici se vede dacă Resend le-a acceptat sau a dat eroare.
e_emailuri AS (
    SELECT
        'E. emailuri de digest (notification_log)'::text        AS sectiune,
        (n.channel::text || ' · ' || n.status::text)            AS detaliu,
        COALESCE(left(COALESCE(n.error, n.recipient), 160),
                 '(fără detalii)')::text                        AS valoare,
        n.created_at                                            AS cand
    FROM public.notification_log n
    WHERE n.event_type = 'anunturi_digest'
    ORDER BY n.created_at DESC
    LIMIT 10
),

-- ── Verdictul, scris în cuvinte ────────────────────────────────────────────
-- Ca să nu trebuiască să interpretezi tu tabelul de mai sus.
z_verdict AS (
    SELECT
        'Z. VERDICT'::text AS sectiune,
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digest-anunturi-grup')
                THEN 'Sarcina programată NU există'
            WHEN EXISTS (SELECT 1 FROM public.grup_anunturi_digest_log
                          WHERE trimis_la > timestamptz '2026-08-05 12:00+03')
                THEN 'TIPARUL MERGE NESUPRAVEGHEAT'
            ELSE 'Sarcina rulează, dar N-A TRIMIS nimic de la proba manuală'
        END::text AS detaliu,
        CASE
            WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'digest-anunturi-grup')
                THEN 'Nu copia tiparul până nu înțelegem de ce lipsește.'
            WHEN EXISTS (SELECT 1 FROM public.grup_anunturi_digest_log
                          WHERE trimis_la > timestamptz '2026-08-05 12:00+03')
                THEN 'Se poate copia liniștit pentru terenuri.'
            ELSE 'ATENȚIE: poate fi normal (grupurile n-au avut anunțuri noi) SAU '
                 || 'poate fi un defect tăcut. Uită-te la secțiunea C: dacă răspunsul '
                 || 'de la ora 19 spune „0 grupuri", chiar n-a avut ce trimite.'
        END::text AS valoare,
        NULL::timestamptz AS cand
)

SELECT * FROM a_sarcina
UNION ALL SELECT * FROM b_executii
UNION ALL SELECT * FROM c_raspunsuri
UNION ALL SELECT * FROM d_jurnal
UNION ALL SELECT * FROM e_emailuri
UNION ALL SELECT * FROM z_verdict
ORDER BY sectiune, cand DESC NULLS LAST;

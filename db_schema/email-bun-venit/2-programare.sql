-- ═══════════════════════════════════════════════════════════════════════════
-- EMAILUL DE BUN VENIT — programarea zilnică
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ RULEAZĂ ACEST FIȘIER ABIA DUPĂ CE, ÎN ORDINEA ASTA:
--      1. ai rulat `1-baza.sql` (BLOC 0 citit, apoi BLOC 1-4);
--      2. ai făcut deploy:
--            npx supabase functions deploy email-bun-venit --no-verify-jwt
--      3. ai probat cu `dry_run` și ai primit emailurile de probă;
--      4. ai trimis o dată real, prudent (`{"force": true, "limita": 1}`),
--         dacă există deja cineva în lot.
--    Altfel programezi o sarcină care eșuează în fiecare dimineață, tăcut.
--
-- ⚠️ NU pune BEGIN / ROLLBACK aici.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 1 — Sarcina programată
-- ───────────────────────────────────────────────────────────────────────────
-- Din oră în oră, la minutul 9. Funcția verifică singură dacă la București e
-- între 10 și 12 (pg_cron socotește în UTC, România schimbă ora).
-- Minutul 9, nu 5 sau 7: la 5 rulează digestul de anunțuri, la 7 cel de
-- terenuri. Așa nu pornesc toate în aceeași secundă spre Resend.
--
-- ⚠️ ÎNLOCUIEȘTE `PUNE_AICI_SECRETUL` cu valoarea lui CRON_SECRET, aceeași ca
--    la celelalte două sarcini. O citești de acolo:
--        select jobname, command from cron.job where jobname = 'digest-terenuri-zone';

select cron.schedule(
    'email-bun-venit',
    '9 * * * *',
    $$
    select net.http_post(
        url     := 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/email-bun-venit',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', 'PUNE_AICI_SECRETUL'
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 60000
    );
    $$
);


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 2 — VERIFICARE (un singur tabel, cu coloana `sectiune`)
-- ───────────────────────────────────────────────────────────────────────────

select 'sarcina' as sectiune, jobname as ce, schedule || ' activ=' || active as detaliu, null::timestamptz as cand
from cron.job where jobname = 'email-bun-venit'
union all
select 'executie', d.status, left(coalesce(d.return_message, ''), 80), d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'email-bun-venit'
  and d.start_time > now() - interval '2 days'
union all
-- Sursa de adevăr: cui i-a plecat emailul.
select 'trimis', p.pseudonym, l.varianta || ' · ' || l.nr_oameni || ' oameni · ' || l.nr_grupuri || ' grupuri', l.trimis_la
from public.bun_venit_log l
join public.profiles p on p.user_id = l.user_id
order by sectiune, cand desc nulls first;


-- ───────────────────────────────────────────────────────────────────────────
-- DACĂ TREBUIE SĂ OPREȘTI
-- ───────────────────────────────────────────────────────────────────────────
--     select cron.unschedule('email-bun-venit');
--
-- Oprirea e sigură: cine n-a primit emailul rămâne în lot și îl primește la
-- repornire (doar dacă și-a făcut contul după DATA_PORNIRE din edge function).
--
-- Ca să NU-l primească un singur om (a cerut „stop”, sau e cineva cunoscut):
--     insert into public.emailuri_stop (email, nota)
--     values (lower('cineva@exemplu.ro'), 'motivul');

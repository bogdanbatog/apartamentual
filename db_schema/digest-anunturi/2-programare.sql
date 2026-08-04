-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST ZILNIC DE ANUNȚURI — programarea
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ RULEAZĂ ACEST FIȘIER ABIA DUPĂ CE:
--      1. ai rulat `1-baza.sql`
--      2. ai făcut deploy la `digest-anunturi-grup`
--      3. ai pus secretul: npx supabase secrets set CRON_SECRET=...
--      4. ai probat funcția manual (vezi comanda curl din capul funcției)
--    Altfel programezi o sarcină care va eșua din oră în oră, tăcut.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 1 — Extensiile
-- ───────────────────────────────────────────────────────────────────────────
-- `pg_net` există deja (o folosesc trigger-ele de notificare). `pg_cron`
-- probabil nu — nu apare nicăieri în proiect.
--
-- RECOMANDARE: pornește pg_cron din Dashboard → Database → Extensions,
-- nu de aici. E calea susținută de Supabase și se ocupă singură de schema
-- în care ajunge extensia.
--
-- Verifică ce ai activ acum:

select extname, extversion
from pg_extension
where extname in ('pg_cron', 'pg_net')
order by extname;

-- Așteptat după pasul din Dashboard: două rânduri.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 2 — Sarcina programată
-- ───────────────────────────────────────────────────────────────────────────
-- DE CE DIN ORĂ ÎN ORĂ, ȘI NU LA 19:00 FIX:
--
-- pg_cron socotește în UTC. Acum, în august, România e la UTC+3, deci 19:00
-- la noi = 16:00 UTC. La ultima duminică din octombrie trecem la UTC+2 și
-- aceeași sarcină programată la 16:00 UTC ar începe să trimită la 18:00.
-- Nu crapă nimic, nu apare nicio eroare — doar sosesc emailurile cu o oră mai
-- devreme, șase luni pe an, până observă cineva.
--
-- Așa că sarcina se execută din oră în oră, iar FUNCȚIA verifică dacă la
-- București e ora 19. Ea știe de ora de vară; noi nu trebuie să ținem minte.
--
-- 23 din 24 de execuții se termină instantaneu cu „nu e ora potrivită".
--
-- ⚠️ ÎNLOCUIEȘTE `PUNE_AICI_SECRETUL` cu valoarea dată la
--    `npx supabase secrets set CRON_SECRET=...` — aceeași, litera cu literă.
--    Secretul rămâne vizibil în `cron.job` pentru cine are acces la baza de
--    date (adică tu). De asta e un secret dedicat și nu cheia de service role:
--    dacă scapă, cel mult poate declanșa digestul, nu poate citi baza.

select cron.schedule(
    'digest-anunturi-grup',
    '5 * * * *',                  -- la minutul 5 al fiecărei ore
    $$
    select net.http_post(
        url     := 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/digest-anunturi-grup',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', 'PUNE_AICI_SECRETUL'
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 30000
    );
    $$
);

-- Emailurile pleacă deci la 19:05, nu la 19:00 fix. Minutul 5 ține sarcina
-- departe de vârful de la fix, când pornesc toate sarcinile programate.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 3 — VERIFICARE
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. Sarcina e înregistrată și activă?
select jobid, jobname, schedule, active
from cron.job
where jobname = 'digest-anunturi-grup';

-- 3b. Ultimele execuții (rulează asta mâine dimineață, după prima seară).
--     `status` trebuie să fie 'succeeded'. Atenție: „succeeded" înseamnă că
--     CEREREA a plecat, nu că s-au trimis emailuri — pentru asta e 3c.
select runid, status, return_message, start_time
from cron.job_run_details
where jobname = 'digest-anunturi-grup'
order by start_time desc
limit 10;

-- 3c. Ce a răspuns funcția. AICI se vede dacă a trimis ceva.
--     Caută rândul de la ora 19:05 și uită-te în `content`.
select id, status_code, content, created
from net._http_response
order by created desc
limit 10;

-- 3d. Ce s-a trimis, per grup și per seară.
select g.nume as grup,
       l.trimis_la,
       l.numar_anunturi,
       l.numar_destinatari
from public.grup_anunturi_digest_log l
join public.grupuri g on g.id = l.grup_id
order by l.trimis_la desc
limit 20;


-- ───────────────────────────────────────────────────────────────────────────
-- DACĂ TREBUIE SĂ OPREȘTI SAU SĂ SCHIMBI SARCINA
-- ───────────────────────────────────────────────────────────────────────────
-- `cron.schedule` cu același nume SUPRASCRIE sarcina existentă, deci ca s-o
-- modifici e destul să rulezi din nou PASUL 2 cu valorile schimbate.
--
-- Ca s-o oprești de tot:
--     select cron.unschedule('digest-anunturi-grup');
--
-- Oprirea e sigură și reversibilă: mesajele nu se pierd. Fereastra fiecărui
-- grup pornește de la ultima trimitere din jurnal, deci la repornire primul
-- digest va cuprinde tot ce s-a scris între timp (plafonat la 7 zile).

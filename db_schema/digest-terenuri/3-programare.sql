-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST SĂPTĂMÂNAL DE TERENURI — programarea (Piesa 2, partea de bază)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️ RULEAZĂ ACEST FIȘIER ABIA DUPĂ CE, ÎN ORDINEA ASTA:
--      1. ai rulat `2-baza.sql` (blocurile) și `2c-doar-functia.sql`  ✅ 13 aug
--      2. ai făcut deploy la `digest-terenuri-zone`:
--            npx supabase functions deploy digest-terenuri-zone --no-verify-jwt
--      3. ai probat cu `dry_run` și ai citit ce AR trimite
--      4. ai văzut emailul randat (`email_proba`) și ți-a plăcut
--      5. ai trimis o dată real, prudent (`{"force": true, "limita": 2}`)
--    Altfel programezi o sarcină care va eșua în fiecare luni, tăcut.
--
-- ⚠️ SECRETUL: e același `CRON_SECRET` folosit de `digest-anunturi-grup`. Dacă
--    e deja pus (și e, din 5 august), NU-l pui din nou — funcția nouă îl
--    citește din aceeași variabilă de mediu a proiectului.
--
-- ⚠️ NU pune BEGIN / ROLLBACK aici. Editorul SQL din Supabase rulează tot
--    fișierul ca o singură tranzacție, iar un ROLLBACK pus „doar de probă"
--    anulează tăcut și ce s-a programat deasupra lui.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 1 — Extensiile (ar trebui să fie deja acolo)
-- ───────────────────────────────────────────────────────────────────────────
-- `pg_cron` și `pg_net` sunt pornite din 5 august, pentru digestul de anunțuri.
-- Verificare de o secundă:

select extname, extversion
from pg_extension
where extname in ('pg_cron', 'pg_net')
order by extname;

-- Așteptat: două rânduri. Dacă lipsește vreuna, pornește-o din
-- Dashboard → Database → Extensions, nu de aici.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 2 — Sarcina programată
-- ───────────────────────────────────────────────────────────────────────────
-- DE CE DIN ORĂ ÎN ORĂ, ȘI NU LUNI LA 10:00 FIX:
--
-- pg_cron socotește în UTC. Acum, în august, România e la UTC+3, deci 10:00
-- la noi = 07:00 UTC. La ultima duminică din octombrie trecem la UTC+2 și
-- aceeași sarcină ar începe să trimită la 09:00. Nu crapă nimic, nu apare
-- nicio eroare — doar sosesc emailurile cu o oră mai devreme, șase luni pe an.
--
-- Așa că sarcina se execută din oră în oră, iar FUNCȚIA verifică dacă la
-- București e LUNI, ORA 10. Ea știe de ora de vară; noi nu trebuie să ținem
-- minte. 167 din 168 de execuții săptămânale se termină instantaneu cu
-- „nu e ziua/ora potrivită" — costul e neglijabil, siguranța e reală.
--
-- ⚠️ ÎNLOCUIEȘTE `PUNE_AICI_SECRETUL` cu valoarea lui CRON_SECRET — aceeași
--    care e deja în sarcina `digest-anunturi-grup`. O poți citi de acolo:
--        select jobname, command from cron.job where jobname = 'digest-anunturi-grup';
--    Secretul rămâne vizibil în `cron.job` pentru cine are acces la baza de
--    date (adică tu). De asta e un secret dedicat și nu cheia de service role:
--    dacă scapă, cel mult poate declanșa digestul, nu poate citi baza.

select cron.schedule(
    'digest-terenuri-zone',
    '7 * * * *',                  -- la minutul 7 al fiecărei ore
    $$
    select net.http_post(
        url     := 'https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/digest-terenuri-zone',
        headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'x-cron-secret', 'PUNE_AICI_SECRETUL'
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 120000
    );
    $$
);

-- Emailurile pleacă deci luni la 10:07, nu la 10:00 fix.
--
-- ⚠️ ACTUALIZAT 27 AUGUST: funcția acceptă acum o FEREASTRĂ, luni 10:00-13:00,
--    nu o oră fixă, și procesează cel mult 30 de oameni pe rulare. Sarcina de
--    cron rămâne neschimbată, fiindcă bătea oricum din oră în oră: rulările de
--    la 10:07, 11:07, 12:07 și 13:07 intră toate în fereastră, iar un lot mai
--    mare de 30 se drenează singur peste ele. În săptămânile obișnuite pleacă
--    tot la 10:07, iar rulările următoare găsesc lotul gol și tac.
--
--    Motivul plafonului: pe 27 august, o trimitere de recuperare cu 66 de
--    oameni a fost oprită de limita de invocări a platformei la al 61-lea apel
--    („RateLimitError ... Retry after 1562ms"), pierzând 4 oameni și rezumatul
--    de pe Slack. Detaliile stau în `digest-terenuri-zone/index.ts`, la
--    `cheamaNotifyAdmins`.
--
-- ⚠️ DOUĂ DIFERENȚE FAȚĂ DE SARCINA DIGESTULUI DE ANUNȚURI, ambele voite:
--
--   • MINUTUL 7, nu 5. Digestul de anunțuri rulează la minutul 5. Dacă ar
--     porni amândouă în aceeași secundă, s-ar bate pe aceleași invocări de
--     `notify-admins` și pe aceeași limită de la Resend. Două minute distanță
--     e destul — digestul de anunțuri pleacă seara, oricum.
--
--   • TIMEOUT 120 de secunde, nu 30. Digestul de anunțuri face UN apel per
--     grup (câteva). Ăsta face CÂTE UN APEL PER OM — până la 30 de apeluri cu
--     pauză de 0,7s între ele, deci circa 21 de secunde doar din pauze, plus
--     timpul fiecărei trimiteri.
--     ⚠️ Timeout-ul lui `pg_net` NU oprește funcția: cererea e asincronă, iar
--     funcția își duce treaba până la capăt chiar dacă `pg_net` a renunțat să
--     mai aștepte răspunsul. Dar cu timeout mic n-ai avea ce citi în
--     `net._http_response` (pasul 3c), adică ai pierde singura dovadă
--     comodă că a mers.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 3 — VERIFICARE
-- ───────────────────────────────────────────────────────────────────────────

-- 3a. Sarcina e înregistrată și activă?
select jobid, jobname, schedule, active
from cron.job
where jobname = 'digest-terenuri-zone';

-- 3b. Ultimele execuții. `status` trebuie să fie 'succeeded'.
--     ⚠️ „succeeded" înseamnă că CEREREA a plecat, nu că s-au trimis emailuri.
--     Pentru asta e 3c.
--     ⚠️ `cron.job_run_details` NU are coloana `jobname` (dă `42703`), doar
--     `jobid` — numele se ia din `cron.job` printr-un JOIN.
select d.runid, d.status, d.return_message, d.start_time
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
where j.jobname = 'digest-terenuri-zone'
order by d.start_time desc
limit 12;

-- 3c. Ce a răspuns funcția. AICI se vede dacă a trimis ceva.
--     Caută rândul de luni de la 10:07 și citește `content`: are `trimise`,
--     `erori` și `terenuri_nelegate`.
select id, status_code, content, created
from net._http_response
order by created desc
limit 10;

-- 3d. Ce s-a trimis, per om și per săptămână. Sursa de adevăr.
select p.pseudonym          as om,
       p.email,
       l.trimis_la,
       l.fereastra_de_la,
       l.nr_terenuri,
       l.nr_zone
from public.terenuri_digest_log l
join public.profiles p on p.user_id = l.user_id
order by l.trimis_la desc
limit 40;

-- 3e. Rezumat pe săptămâni — se citește dintr-o privire dacă ritmul e sănătos.
select date_trunc('week', l.trimis_la at time zone 'Europe/Bucharest')::date as saptamana,
       count(*)                    as emailuri,
       sum(l.nr_terenuri)          as potriviri_teren_x_om,
       round(avg(l.nr_terenuri), 1) as medie_terenuri_per_om
from public.terenuri_digest_log l
group by 1
order by 1 desc;


-- ───────────────────────────────────────────────────────────────────────────
-- DACĂ TREBUIE SĂ OPREȘTI SAU SĂ SCHIMBI SARCINA
-- ───────────────────────────────────────────────────────────────────────────
-- `cron.schedule` cu același nume SUPRASCRIE sarcina existentă, deci ca s-o
-- modifici e destul să rulezi din nou PASUL 2 cu valorile schimbate.
--
-- Ca s-o oprești de tot:
--     select cron.unschedule('digest-terenuri-zone');
--
-- Oprirea e sigură și reversibilă: terenurile nu se pierd. Fereastra fiecărui
-- om pornește de la ultima trimitere din jurnal, deci la repornire primul
-- email va cuprinde tot ce a apărut între timp — plafonat la 14 zile, plafon
-- care stă în edge function (`FEREASTRA_MAXIMA_ZILE`), nu aici.
--
-- ⚠️ Dacă vrei să oprești trimiterea pentru O SINGURĂ persoană, nu opri
--    sarcina: debifează-i `profiles.email_terenuri_noi`. Funcția SQL o
--    citește la fiecare rulare.

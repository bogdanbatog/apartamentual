-- ═══════════════════════════════════════════════════════════════════
--  PASUL 1 — creează `grup_membri_count`, poarta prin care vitrina
--  publică află câți membri are un grup, FĂRĂ să vadă cine sunt.
--
--  RULEAZĂ ASTA PRIMA. Este pur ADITIVĂ: nu șterge nicio politică,
--  nu revocă niciun drept, nu poate strica nimic. După ea site-ul
--  merge exact ca acum. Abia PASUL 2 închide gaura.
--
--  ⚠️ NU pune BEGIN…ROLLBACK în acest script. În SQL Editor tot
--  scriptul e o singură tranzacție, iar un ROLLBACK anulează tăcut
--  și CREATE VIEW, și GRANT — pare că a mers, dar nu s-a salvat.
--
--  CONTEXT (măsurat 2 august 2026, cu cheia anon din site):
--  tabela `public.grup_membri` e citibilă integral fără cont — 34 de
--  rânduri, toate grupurile, cine în ce grup, cu ce status, din ce
--  dată. Cauza e politica `anon_count_grup_membri` (SELECT, rol
--  `anon`, qual = true), adăugată ca să meargă numărul „3/12" de pe
--  /grupuri.html. Dar Postgres NU are politică „doar pentru numărat":
--  RLS filtrează rânduri, nu operații. O politică ce te lasă să
--  numeri te lasă să și citești tot. Numele zice „count", efectul e
--  „SELECT liber" — exact tiparul `profiles_select_all` din 31 iulie.
--
--  Aceeași gaură deservea și cealaltă direcție: „din ce grupuri face
--  parte omul ăsta", citit de pe profilul lui public
--  (`js/profile-view-new.js:161`). O singură politică ștearsă le
--  închide pe amândouă, fiindcă citesc aceeași tabelă.
-- ═══════════════════════════════════════════════════════════════════


-- ── View-ul cu numărul de membri ────────────────────────────────────
-- Expune EXCLUSIV `grup_id` + un număr. Niciun `user_id`, niciun
-- status individual, nicio dată de intrare. Un vizitator fără cont
-- poate afla că grupul are 3 membri, dar nu poate afla cine sunt.
--
-- Logica de numărare copiază EXACT ce face azi frontendul în
-- `js/grupuri.js:235-241`, ca numerele de pe carduri să rămână
-- identice după schimbare:
--   • se numără doar membrii cu status = 'activ';
--   • se sar cei cu profilul marcat `account_status = 'deleted'`
--     (conturi șterse soft — altfel cardurile arătau umflat, ex. 3/20
--     când mai rămăsese un singur om real).
--
-- ⚠️ LEFT JOIN, nu INNER, INTENȚIONAT: un membru fără rând în
-- `profiles` trebuie să fie NUMĂRAT, nu sărit. Așa face și JS-ul de
-- azi (construiește mulțimea celor șterși și scade doar din ea).
-- Cu INNER JOIN, membrii fără profil ar dispărea din numărătoare și
-- numerele s-ar micșora fără explicație.

CREATE OR REPLACE VIEW public.grup_membri_count AS
SELECT
    gm.grup_id,
    count(*)::int AS membri_count
FROM public.grup_membri gm
LEFT JOIN public.profiles p
       ON p.user_id = gm.user_id
WHERE gm.status = 'activ'
  AND p.account_status IS DISTINCT FROM 'deleted'
GROUP BY gm.grup_id;


-- ── Drepturi pe view ────────────────────────────────────────────────
-- View-ul e deținut de `postgres` și NU are `security_invoker`, deci
-- citește tabela cu drepturile proprietarului, ocolind RLS-ul de pe
-- `grup_membri`. Asta e INTENȚIONAT: e singura poartă prin care un
-- vizitator nelogat mai află numărul de membri după PASUL 2.
-- Linterul Supabase o să semnaleze „security definer view" — aici e
-- comportamentul dorit, nu o scăpare. Același tipar ca la
-- `profiles_public`, creat pe 31 iulie.

GRANT SELECT ON public.grup_membri_count TO anon, authenticated;

COMMENT ON VIEW public.grup_membri_count IS
'Numărul de membri activi per grup, pentru vitrina publică de pe /grupuri.html. Expune doar grup_id + număr, niciodată identități. Creat 2 august 2026, ca să se poată șterge politica anon_count_grup_membri, care deschidea toată tabela grup_membri către vizitatorii fără cont.';


-- ── CONTROL: numerele noi trebuie să fie identice cu cele de pe site ─
-- Rulează și compară cu ce scrie ACUM pe cardurile de pe /grupuri.html
-- (înainte de orice deploy). Dacă un număr diferă, OPREȘTE-TE și
-- spune-mi — înseamnă că logica de numărare nu s-a copiat corect și
-- nu are rost să mergem mai departe.
--
-- Grupurile fără niciun membru activ NU apar deloc în listă (așa
-- lucrează GROUP BY). E normal: frontendul le pune 0 singur.

SELECT
    g.nume                              AS grup,
    g.status,
    COALESCE(c.membri_count, 0)         AS membri_activi,
    g.max_membri
FROM public.grupuri g
LEFT JOIN public.grup_membri_count c ON c.grup_id = g.id
WHERE g.status <> 'arhivat'
ORDER BY g.nume;

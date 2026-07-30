-- ============================================================================
-- REPARARE MANUALĂ: comanda APT-20260729-80d946 (prima comandă reală plătită)
--
-- CONTEXT: clientul a plătit pe 29 iulie 2026 (Netopia: CONFIRMATĂ, tranzacție
-- #249373379; Oblio: proforma APT 0013 -> FACTURATA, factura fiscală LTFB0205),
-- dar la noi comanda a rămas `pending_payment`, fiindcă Oblio nu ne-a apelat
-- niciodată webhook-ul. Cauza (cinci blocaje suprapuse) e reparată separat, în
-- commit-ul c7c0f1c. Fișierul ăsta repară DOAR această comandă rămasă în urmă.
--
-- DE CE MANUAL, ȘI NU PRIN FUNCȚIE: `oblio-webhook` ar fi făcut asta singur,
-- dar el trimite și emailul „Comandă confirmată" către client. Lucian i-a scris
-- deja personal pe 30 iulie, deci al doilea mesaj automat ar fi derutant.
-- UPDATE-ul de mai jos NU trimite niciun email — nici clientului, nici nouă.
--
-- SE RULEAZĂ MANUAL în Supabase SQL Editor, bloc cu bloc, citind rezultatele.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- BLOCUL 1 — VERIFICARE ÎNAINTE (nu modifică nimic)
-- Rulează-l singur întâi. Trebuie să vezi UN rând, cu status = pending_payment.
-- Dacă vezi zero rânduri sau status = paid, OPREȘTE-TE: altcineva a reparat-o
-- deja și restul scriptului nu mai are ce căuta.
-- ---------------------------------------------------------------------------

select
  order_id,
  status,
  paid_at,
  oblio_factura_serie,
  oblio_factura_numar,
  pret_total,
  created_at
from public.comenzi_analize
where order_id = 'APT-20260729-80d946';


-- ---------------------------------------------------------------------------
-- BLOCUL 2 — REPARAREA propriu-zisă
--
-- ⚠️ ÎNAINTE SĂ RULEZI: înlocuiește data/ora de mai jos cu momentul REAL al
-- plății, așa cum apare în panoul Netopia la tranzacția #249373379.
-- Formatul e: 'AAAA-LL-ZZ HH:MM:00+03' (ora României vara).
-- Dacă nu găsești ora exactă, lasă valoarea de mai jos: e ora la care a fost
-- creată comanda, deci plata a venit sigur după ea — cel mult subestimăm cu
-- câteva minute, ceea ce e onest. NU pune ora de azi: ar strica statisticile
-- despre cât durează de la comandă la plată.
--
-- CE FACE: trece comanda pe `paid` și salvează factura fiscală în locul
-- proformei (exact ce ar fi făcut funcția). Condiția `status = 'pending_payment'`
-- e plasa de siguranță — dacă între timp comanda a fost deja reparată,
-- UPDATE-ul nu atinge niciun rând în loc să suprascrie ceva bun.
-- ---------------------------------------------------------------------------

update public.comenzi_analize
set
  status              = 'paid',
  paid_at             = '2026-07-29 17:47:00+03',   -- <<< ora reală a plății
  oblio_factura_serie = 'LTFB',
  oblio_factura_numar = '0205'
where order_id = 'APT-20260729-80d946'
  and status  = 'pending_payment';

-- Trebuie să scrie „UPDATE 1". Dacă scrie „UPDATE 0", comanda nu mai era
-- `pending_payment` — recitește blocul 1 înainte să faci altceva.


-- ---------------------------------------------------------------------------
-- BLOCUL 3 — URMA ÎN JURNAL
-- Ca peste șase luni să se știe că plata asta a fost confirmată de mână, nu de
-- webhook, și de ce. Fără rândul ăsta, comanda ar arăta identic cu una
-- procesată automat, iar jurnalul ei ar avea o gaură.
-- ---------------------------------------------------------------------------

insert into public.comenzi_analize_log (comanda_id, event_type, success, message, payload)
select
  id,
  'status_changed',
  true,
  'Reparare manuala: plata confirmata de Netopia/Oblio pe 29.07.2026, dar webhook-ul Oblio nu era inregistrat, deci comanda a ramas pending_payment. Trecuta manual pe paid pe 30.07.2026. Emailul automat de confirmare NU a fost trimis - clientului i s-a scris personal.',
  jsonb_build_object(
    'reparare_manuala', true,
    'netopia_tranzactie', '249373379',
    'oblio_proforma', 'APT 0013',
    'oblio_factura', 'LTFB0205',
    'email_automat_trimis', false
  )
from public.comenzi_analize
where order_id = 'APT-20260729-80d946';


-- ---------------------------------------------------------------------------
-- BLOCUL 4 — VERIFICARE DUPĂ
-- Trebuie să vezi status = paid, paid_at completat, factura LTFB 0205,
-- și în jurnal cele 3 rânduri vechi de la creare + cel nou de reparare.
--
-- Dacă dă eroare pe `created_at` (nu am putut verifica numele exact al coloanei
-- de timp din jurnal, DDL-ul tabelului nu e în repo), șterge ultimul rând
-- `order by l.created_at;` și pe `l.created_at,` din listă — restul merge.
-- ---------------------------------------------------------------------------

select
  c.order_id,
  c.status,
  c.paid_at,
  c.oblio_factura_serie || ' ' || c.oblio_factura_numar as factura,
  l.event_type,
  l.message,
  l.created_at
from public.comenzi_analize c
join public.comenzi_analize_log l on l.comanda_id = c.id
where c.order_id = 'APT-20260729-80d946'
order by l.created_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- DIGEST ZILNIC DE ANUNȚURI — proba șablonului de email
-- ═══════════════════════════════════════════════════════════════════════════
--
-- DE CE E NEVOIE DE UN OCOLIȘ
-- Funcția taie din destinatari, în ordine: conturile șterse, profilurile
-- marcate `is_demo`, cei care au oprit bifa, și autorul dacă e singurul care
-- a scris. Grupul pe care probăm — „Investiție Inteligentă – Bloc Boutique
-- Central" — are exact doi membri activi, amândoi profiluri-exemplu. Deci
-- proba, așa cum e, întoarce „niciun destinatar eligibil" și nu pleacă nimic.
--
-- Asta NU e un defect: e filtrul care-și face treaba. Ca să vedem totuși
-- emailul, scoatem marcajul de exemplu de pe UN singur cont, pentru câteva
-- minute, și-l punem la loc imediat după.
--
-- ⚠️ CEI 4 MEMBRI `pending` DIN GRUP SUNT OAMENI REALI. Funcția cere
--    `status = 'activ'`, deci nu-i atinge — dar nu umbla la statusul lor.
--
-- ⚠️ NU pune BEGIN / ROLLBACK în acest script.
--
-- Grup: d6ab0a78-6935-4a95-8967-794708c208e5
-- Autor anunț:  Bogdan Radu  (luta.lucian.m+test12@gmail.com) — rămâne exemplu
-- Destinatar:   Ioana Nistor (luta.lucian.m+test5@gmail.com)  — se dezmarchează


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 1 — Scoate temporar marcajul de exemplu de pe destinatar
-- ───────────────────────────────────────────────────────────────────────────
-- Cât timp e fals, contul apare pe /utilizatori.html FĂRĂ badge-ul „Exemplu".
-- De aia pasul 4 se rulează în aceeași sesiune, nu „mâine".

update public.profiles
   set is_demo = false
 where lower(email) = 'luta.lucian.m+test5@gmail.com'
returning user_id, pseudonym, email, is_demo;

-- Așteptat: un rând, is_demo = false.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 2 — Scrie anunțul (NU din SQL)
-- ───────────────────────────────────────────────────────────────────────────
-- Loghează-te cu contul Bogdan Radu (luta.lucian.m+test12@gmail.com), intră pe
-- pagina grupului și scrie un anunț scurt. Îl scriem din interfață, nu cu un
-- `insert`, ca să treacă și `postAnunt()` prin probă.
--
-- Verificare că a intrat (rulează după ce ai apăsat trimite):

-- select a.created_at, p.pseudonym as autor, a.content
-- from public.grup_anunturi a
-- join public.profiles p on p.user_id = a.user_id
-- where a.grup_id = 'd6ab0a78-6935-4a95-8967-794708c208e5'::uuid
-- order by a.created_at desc
-- limit 5;


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 3 — Rularea digestului (o fac eu, din terminal)
-- ───────────────────────────────────────────────────────────────────────────
-- Întâi dry_run pe grupul ăsta (arată câți destinatari ies), apoi rularea
-- reală. Emailul ajunge la luta.lucian.m+test5@gmail.com, adică în inboxul tău.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 4 — Pune marcajul la loc (OBLIGATORIU, în aceeași sesiune)
-- ───────────────────────────────────────────────────────────────────────────

-- update public.profiles
--    set is_demo = true
--  where lower(email) = 'luta.lucian.m+test5@gmail.com'
-- returning user_id, pseudonym, email, is_demo;

-- Așteptat: un rând, is_demo = true. Dacă nu iese, contul rămâne afișat ca
-- utilizator real pe vitrină — verifică până iese.


-- ───────────────────────────────────────────────────────────────────────────
-- PASUL 5 — Curățenie, dacă vrei să repeți proba
-- ───────────────────────────────────────────────────────────────────────────
-- Anti-dublarea oprește o a doua trimitere în interval de 12 ore. Ca s-o
-- repeți, șterge rândul de jurnal al grupului:
--
--   delete from public.grup_anunturi_digest_log
--   where grup_id = 'd6ab0a78-6935-4a95-8967-794708c208e5'::uuid;
--
-- Anunțul de probă se șterge din interfața grupului, ca orice anunț.

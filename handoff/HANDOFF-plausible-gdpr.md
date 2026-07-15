# Handoff — Mențiune Plausible Analytics în politica de confidențialitate (GDPR)

## Context
Am instalat recent Plausible Analytics (script în `<head>`, fără cookies). Plausible nu
folosește cookie-uri și nu colectează date personale identificabile, deci NU e nevoie de
banner de consimțământ. Mențiunea în politica de confidențialitate e corectă și recomandată.

## Ce s-a făcut
Adăugat o subsecțiune nouă **10.3 „Analiza traficului"** în `frontend/gdpr.html`, la finalul
Secțiunii 10 (Cookie-uri și Tehnologii de Urmărire), imediat după 10.2.

Text adăugat (3 linii, fără em-dash/en-dash, diacritice corecte):
> **10.3 Analiza traficului**
> Folosim Plausible Analytics pentru statistici agregate de trafic. Este o soluție care
> respectă confidențialitatea, nu folosește cookie-uri și nu colectează date personale
> identificabile. Datele sunt stocate în Uniunea Europeană.

Motivul plasării: Secțiunea 10.1 afirmă deja că nu folosim cookie-uri de analiză (ex. Google
Analytics). Rămâne adevărat cu Plausible (cookieless), dar acum e completat corect: facem
analiză de trafic, doar fără cookie-uri.

Nu am atins cod JS/plăți. Un singur fișier modificat.

## Stadiu
- Commit: `43a6c12` — "content: mentiune Plausible Analytics in politica de confidentialitate"
- Push: `d506c69..43a6c12` → `main` (bogdanbatog/apartamentual) — DONE
- **Deploy: MANUAL din cPanel.** Trebuie urcat `frontend/gdpr.html` în cPanel ca să apară live
  pe apartamentual.ro. (CLAUDE.md spune greșit Render/auto-deploy; deploy-ul real e cPanel.)

## Pași rămași
1. Urcă `gdpr.html` prin cPanel.
2. Verifică live: https://apartamentual.ro/gdpr.html → Secțiunea 10 → apare 10.3 „Analiza traficului".

## Opțional (neefectuat, la decizia ta pentru viitor)
Plausible NU a fost adăugat în lista de prestatori/procesatori din Secțiunea 5.2 (Supabase,
Render, Resend, Netopia, Oblio). Strict GDPR nu e obligatoriu, fiindcă Plausible nu procesează
date personale identificabile. Dacă vrei completitudine formală, se poate adăuga acolo o linie.

# HANDOFF Claude Code — Pagina „Servicii" (pagină-umbrelă, 5 blocuri)

---

## ✅ STADIU: LIVRAT (2026-06-18) — commit `a5f9f29`, pushed pe `main`

**Făcut:**
- Creată `frontend/servicii.html` — intro + 5 blocuri (Gratuit · Analize · Consultanță · Parteneri · Asistență și coordonare grup) + pâlnia + FAQ specific. Reutilizează design system v9 (`.section/.card/.avantaje/.faq/.cta-final`).
- Prețuri confirmate de Lucian:
  - Analiză preliminară: **99 RON lansare / 149 RON standard**, TVA inclus (consecvent cu `comanda-analiza.html`).
  - Analiză detaliată: **la cerere** (fără interval — de adăugat când Lucian dă cifra X–Y).
  - Consultanță online: **299 RON/oră, primele 30 min gratuite**.
  - Consultanță la birou: **499 RON/oră, deplasare la teren inclusă**.
  - Coordonare grup: **onorariu, nu procent**, fără preț fix (marcat „mai târziu / la cerere").
- Aliniat `frontend/consultanta.html` la noile cifre (era „60 min gratuite, se discută" → acum 30 min + 299/499 RON).
- Decizii: bloc Gratuit → CTA principal **webinar** (Luma); FAQ specific de servicii (NU `faq.js` global).

**Rămas:**
- **Deploy manual din cPanel** (nu e încă live pe apartamentual.ro).
- Când Lucian confirmă intervalul analizei detaliate → de adăugat în bloc + FAQ.

---

## Context

Construim pagina-umbrelă „Servicii" pentru ApartamenTUal. Rolul ei: să arate clar **ce e gratuit** (accesul la platformă) și **ce se plătește** (serviciile), fără să pară că pui platforma la plată. Conținutul și prețurile sunt deja stabilite (mai jos). Pagina se leagă de itemul „Servicii" din meniu (vezi handoff-ul de meniu).

**Principiu central, valabil peste tot:** accesul la platformă e gratuit; banii vin doar din servicii. Prima consultanță e gratuită. Niciun procent de economie nicăieri. Ton calm, explicativ — „arhitect care povestește", fără superlative.

---

## Faza 0 — Audit (NU scrie cod încă)

Citește repo-ul și raportează-mi:

- ce pagini/fluxuri de servicii EXISTĂ deja, ca să le LEGĂM, nu să le rescriem:
  - pagina de comandă analiză (`comanda-analiza.html`?) — ruta exactă;
  - flux/pagina de consultanță (FAB „Cere consultanță"? o pagină dedicată?) — ruta exactă;
  - pagina/secțiunea Parteneri — ruta exactă;
  - linkul de webinar (Luma) folosit în homepage;
  - `politica-retur.html` (pt. mențiunea de retur la analize).
- sistemul de stiluri/componente de secțiune și card pe care să-l REUTILIZEZ (nu inventa altul);
- unde trăiește pagina nouă (`servicii.html`? `servicii/`?) și cum se include nav.js/nav.css/footer/FAQ;
- dacă există deja text de prețuri pe `comanda-analiza.html`, ca să fie CONSECVENT cu pagina Servicii (aceleași cifre, aceiași termeni).

**STOP.** Plan scurt + întrebări. Așteaptă confirmarea mea.

---

## Faza 1 — Plan

Propune-mi: structura paginii (cele 5 blocuri în ordine + un intro scurt + pâlnia), ce CTA duce la ce flux existent, ce componente reutilizezi. Confirmă înainte de implementare.

---

## Faza 2 — Implementare

Pagina = intro scurt + 5 blocuri + (la final) pâlnia care le leagă. Reutilizează stilurile existente. Conectează la nav.js/footer/FAQ existente.

### Intro (1–2 fraze)
Ideea: „Accesul la platformă e gratuit. Plătești doar pentru serviciile care te ajută concret — analize, consultanță, coordonare — atunci când ai nevoie de ele." (reformulează în voce calmă, fără superlative.)

### Bloc 1 — Gratuit (afișat explicit ca gratuit)
Conținut: cont, profil, matching, vizualizare terenuri și grupuri, formare și aderare la grup, notificări de matching, webinarii, newsletter — **plus prima ședință de consultanță gratuită**.
Mesaj: accesul la platformă nu costă; banii vin doar din servicii.
CTA: „Înscrie-te la webinar" (linkul Luma) sau „Creează cont".

### Bloc 2 — Analize de teren
- Analiză preliminară: **99 RON la lansare → 149 RON standard** (afișează ambele + termenul de la început), TVA inclus, livrare 3–5 zile, livrabil PDF.
- Analiză detaliată: **la cerere**, cu fraza-ancoră: „majoritatea se încadrează între X–Y RON" (interval de confirmat cu mine).
- Distincție obligatorie în copy: aprobarea/filtrarea terenurilor pe platformă = gratuită (filtru al arhitecților); **analiza = serviciul plătit**. Niciodată confundate.
- CTA: → pagina de comandă analiză existentă (`comanda-analiza.html`). Menționează discret politica de retur (link).

### Bloc 3 — Consultanță
- Prima ședință **gratuită**.
- Apoi **~299–349 RON/ședință** (1h, online, **max 4 persoane** — peste 4 devine prezentare/webinar).
- Consultanță offline / vizită la teren: **500–700 RON** + deplasare în afara Bucureștiului.
- CTA: → fluxul de consultanță existent (FAB / pagina dedicată).

### Bloc 4 — Profesioniști / Parteneri
- Directory de birouri de arhitectură, design interior, urbanism, constructori, furnizori de produse și finisaje.
- Ton onest: la lansare puțini parteneri, crește în timp.
- CTA: → pagina Parteneri + (dacă există) „Vrei să devii partener?".

### Bloc 5 — Coordonare de grup
- Marcat ca **„mai târziu / la cerere"** — serviciul prin care grupul e dus de la formare spre construcție.
- **Onorariu, nu procent.** Fără preț fix acum — îl pui ca direcție.
- Fără CTA de cumpărare; eventual „Întreabă-ne".

### Pâlnia (la final, scurt, vizual simplu)
webinar gratuit → prima consultanță gratuită → consultanță plătită → analiză preliminară → analiză detaliată → (mai târziu) coordonare de grup.

### Reguli de conținut (peste tot)
- **niciun procent de economie**; mesajul corect e „toți banii tăi rămân în apartamentul tău", nu „economisești X%";
- prețuri transparente: prețul de lansare se afișează împreună cu cel standard și cu termenul;
- „mic bloc", nu „bloc"; „grupuri de construcție" / Baugruppen, nu „co-housing";
- ton calm, explicativ; fără superlative, fără promisiuni.

---

## Faza 3 — Test + commit

- toate CTA-urile duc la fluxurile existente corecte (analiză, consultanță, parteneri, webinar);
- prețurile sunt IDENTICE cu cele de pe `comanda-analiza.html` (fără neconcordanțe);
- responsive; coerent vizual cu restul site-ului (componente reutilizate);
- itemul „Servicii" din meniu duce la această pagină (dacă meniul a fost deja modificat în celălalt handoff);
- commit ca save point. **NU** deploy fără confirmarea mea.

---

## De confirmat cu mine ÎNAINTE de Faza 2

1. intervalul orientativ pentru analiza detaliată (X–Y RON) din fraza-ancoră;
2. rutele exacte pentru consultanță și parteneri (din audit);
3. dacă blocul „Gratuit" linkează la webinar (Luma) sau la „Creează cont" ca CTA principal.

# Handoff: Curățare articol Brutopia din News (drepturi de autor + text propriu)

**Context și problemă:** Articolul „Brutopia / stekke + fraas" din secțiunea News (publicat 14 februarie 2026, etichetă EXEMPLE) republică materiale protejate de drepturi de autor: 3 fotografii de Tim Van de Velde și descrierea în engleză preluată cuvânt cu cuvânt de pe ArchDaily. Mențiunea „Preluat de pe: archdaily.com" nu ține loc de licență. Urmează să-i cerem fotografului permisiunea pentru poze, deci articolul trebuie curățat ÎNAINTE de trimiterea emailului.

**Obiectiv:** Înlocuim conținutul preluat cu text propriu în română (mai jos, aprobat de Lucian), scoatem cele 3 fotografii, păstrăm trimiterile spre surse ca linkuri externe. Structura paginii (titlu, etichetă, dată, share, layout) rămâne.

**Prioritate: ridicată.** Emailul către fotograf așteaptă după acest deploy. Postarea de Instagram de mâine dimineață trimite prin „link în bio" către acest articol.

**Reguli de limbaj obligatorii:** fără em-dash, fără sintagma „fără dezvoltator", diacritice corecte, „bloc" nu „mic bloc", „Județului Housing" formă fixă, fără procente de economie.

---

## FAZA 1: AUDIT (fără modificări)

1. Localizează articolul Brutopia: cum sunt stocate articolele din News (fișier HTML dedicat, conținut în news.html, JSON/JS cu articole)? Identifică exact blocurile de conținut: titlul, banda „Preluat de pe", cele 3 imagini (și fișierele lor: sunt găzduite local în repo sau hotlink-uite de pe ArchDaily?), textul în engleză.
2. Verifică dacă imaginile au fișiere locale în repo (de șters la implementare) sau sunt referințe externe.
3. Caută în TOT site-ul alte articole sau pagini construite pe același model „Preluat de pe" cu imagini sau text copiat din surse externe (grep după „Preluat de pe", „archdaily", „dezeen", „provided by the architects"). Raportează lista completă, dar NU le modifica pe celelalte în acest handoff.
4. Verifică dacă pagina ce-este/exemple-europa.html menționează Brutopia și cum (pentru consistența linkului din bio).

**STOP 1: Raportează structura articolului, situația imaginilor (locale/externe) și lista altor pagini cu conținut preluat. Așteaptă confirmarea lui Lucian.**

---

## FAZA 2: PLAN

Propune modificările exacte pe fișierele identificate:
- Titlul articolului devine: **„Brutopia, Bruxelles: 29 de familii care au construit împreună"**
- Banda „Preluat de pe: archdaily.com" se elimină (conținutul nu mai e preluat)
- Cele 3 imagini se elimină (și fișierele locale, dacă există); articolul rămâne temporar fără imagini, NU se adaugă alt vizual în acest handoff
- Textul în engleză se înlocuiește integral cu textul de mai jos
- La finalul articolului, secțiune de surse cu linkuri externe (target="_blank", rel="noopener")

**Textul nou al articolului (aprobat, de folosit ca atare):**

> În 2008, un grup de locuitori din Bruxelles căuta locuințe de calitate la un preț rezonabil în capitală. Nu găseau. Așa că au cumpărat împreună un teren în cartierul Forest, s-au organizat într-o asociație și au construit preluând ei înșiși rolul dezvoltatorului: buget, autorizații, execuție.
>
> Rezultatul, terminat în 2013, se numește Brutopia: două clădiri cu 29 de apartamente, câteva spații pentru birouri și un centru de zi pentru vârstnicii din cartier, în jurul unei grădini comune. Fiecare familie e proprietară pe apartamentul ei, gândit după nevoile și bugetul propriu. Apartamentele au fost livrate la gri, ca fiecare să-și finiseze locuința în ritmul și cu banii lui.
>
> Din cele 29 de apartamente, 27 sunt case pasive. Proiectul a primit premiul „clădire exemplară" al Regiunii Bruxelles încă din faza de proiect.
>
> Față de modelul nostru, Brutopia are partea comună mai dezvoltată: spălătorie, sală polivalentă, mașini folosite în comun. Fiecare grup decide câtă viață în comun își dorește; principiul rămâne același: cei care vor locui acolo conduc proiectul.

**Secțiunea de surse (la final, sub text):**

> Mai multe despre proiect:
> - Brutopia pe ArchDaily → https://www.archdaily.com/641278/brutopia-stekke-fraas
> - Articolul din Dezeen → https://www.dezeen.com/2015/06/21/brutopia-aluminium-clad-apartment-complex-cooperative-brussels-belgium-stekke-fraas/

**STOP 2: Prezintă diff-ul propus și așteaptă aprobarea lui Lucian.**

---

## FAZA 3: IMPLEMENTARE

1. Aplică modificările aprobate.
2. Șterge fișierele de imagini din repo dacă există local (raportează căile șterse).
3. Verifică că nu rămân referințe rupte (img cu src inexistent, alt-uri orfane).
4. Nu atinge alte articole sau pagini.

---

## FAZA 4: TEST

1. Deschide articolul local/preview: titlul nou, textul în română, fără imagini, fără banda „Preluat de pe", secțiunea de surse cu ambele linkuri funcționale, deschise în tab nou.
2. Verifică diacriticele și lipsa em-dash în tot textul afișat.
3. Verifică listarea articolului în indexul News (titlul nou apare corect; dacă listarea folosea prima imagine ca thumbnail, verifică că lipsa ei nu strică layoutul; raportează dacă strică).
4. Verifică pe viewport mobil (375px).
5. Verifică butoanele de share existente (funcționale, titlul corect în share).

**STOP 3: Raportează rezultatele. NU face commit fără aprobarea explicită a lui Lucian (push = deploy live pe Render).**

---

## FAZA 5: COMMIT (doar după aprobare la STOP 3)

1. Commit cu mesaj: `fix(news): articol Brutopia rescris cu text propriu, eliminat continut preluat (foto + text)`
2. După deploy (~2 min), verificare pe apartamentual.ro: articolul live, linkurile de surse funcționale.

---

## Pași după deploy (Lucian, în afara Claude Code)
1. Trimite emailul către Tim Van de Velde (draftul e pregătit); abia după ce articolul curat e live.
2. Actualizează linkul din bio Instagram spre acest articol (sau spre ce-este/exemple-europa.html, conform deciziei) înainte de postarea de dimineață.
3. Dacă auditul a găsit alte articole cu conținut preluat: decidem tratarea lor într-un handoff separat.
4. Dacă fotograful răspunde pozitiv: handoff nou pentru reintroducerea pozelor cu credit „Foto: Tim Van de Velde" + link.

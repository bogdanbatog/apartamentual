# Handoff: Curățare articole EXEMPLE din News (drepturi de autor + text propriu)

**Context și problemă:** Cel puțin DOUĂ articole din secțiunea News (etichetă EXEMPLE, ambele publicate pe 14 februarie 2026) republică materiale protejate de drepturi de autor:
- **„Brutopia / stekke + fraas"**: 3 fotografii de Tim Van de Velde + descrierea în engleză preluată cuvânt cu cuvânt de pe ArchDaily
- **„Cohousing De Sijs / OFFICEU architects"**: 3 fotografii (fotograful proiectului) + descrierea arhitecților tradusă în română (traducerea e operă derivată, textul rămâne al autorului original; prima frază chiar spune „Descrierea text furnizată de arhitecți")

Mențiunea „Preluat de pe: archdaily.com" nu ține loc de licență, nici pentru poze, nici pentru text. Urmează să-i cerem fotografului Brutopiei permisiunea pentru poze, deci articolele trebuie curățate ÎNAINTE de trimiterea emailului. E posibil ca auditul să găsească și alte articole pe același model (aceeași dată de publicare sugerează o sesiune comună de creare).

**Obiectiv:** Pentru AMBELE articole: înlocuim conținutul preluat cu texte proprii în română (mai jos, aprobate de Lucian), scoatem fotografiile, păstrăm trimiterile spre surse ca linkuri externe. Structura paginilor (titlu, etichetă, dată, share, layout) rămâne. Pentru orice ALT articol cu conținut preluat găsit la audit: se raportează la STOP 1 și se așteaptă text nou de la Lucian; NU se rescrie fără text aprobat.

**Prioritate: ridicată.** Emailul către fotograf așteaptă după acest deploy. Postarea de Instagram de mâine dimineață trimite prin „link în bio" către acest articol.

**Reguli de limbaj obligatorii:** fără em-dash, fără sintagma „fără dezvoltator", diacritice corecte, „bloc" nu „mic bloc", „Județului Housing" formă fixă, fără procente de economie.

---

## FAZA 1: AUDIT (fără modificări)

1. Localizează articolele „Brutopia / stekke + fraas" și „Cohousing De Sijs / OFFICEU architects": cum sunt stocate articolele din News (fișier HTML dedicat, conținut în news.html, JSON/JS cu articole)? Pentru fiecare, identifică exact blocurile de conținut: titlul, banda „Preluat de pe", imaginile (și fișierele lor: găzduite local în repo sau hotlink-uite de pe ArchDaily?), textul preluat (engleză la Brutopia, română tradusă la De Sijs).
2. Verifică dacă imaginile au fișiere locale în repo (de șters la implementare) sau sunt referințe externe.
3. Caută în TOT site-ul alte articole sau pagini construite pe același model (grep după „Preluat de pe", „archdaily", „dezeen", „provided by the architects", „furnizată de arhitecți"). Raportează lista completă. Pentru orice articol găsit în plus față de cele două: STOP, se cere text nou de la Lucian înainte de modificare.
4. Verifică dacă pagina ce-este/exemple-europa.html menționează Brutopia și cum (pentru consistența linkului din bio).

**STOP 1: Raportează structura articolului, situația imaginilor (locale/externe) și lista altor pagini cu conținut preluat. Așteaptă confirmarea lui Lucian.**

---

## FAZA 2: PLAN

Propune modificările exacte pe fișierele identificate, pentru ambele articole:
- Benzile „Preluat de pe: archdaily.com" se elimină (conținutul nu mai e preluat)
- Toate imaginile se elimină (și fișierele locale, dacă există); articolele rămân temporar fără imagini, NU se adaugă alt vizual în acest handoff
- Textele preluate se înlocuiesc integral cu textele de mai jos
- La finalul fiecărui articol, secțiune de surse cu linkuri externe (target="_blank", rel="noopener")

### Articolul 1: Brutopia

- Titlul devine: **„Brutopia, Bruxelles: 29 de familii care au construit împreună"**

**Textul nou (aprobat, de folosit ca atare):**

> În 2008, un grup de locuitori din Bruxelles căuta locuințe de calitate la un preț rezonabil în capitală. Nu găseau. Așa că au cumpărat împreună un teren în cartierul Forest, s-au organizat într-o asociație și au construit preluând ei înșiși rolul dezvoltatorului: buget, autorizații, execuție.
>
> Rezultatul, terminat în 2013, se numește Brutopia: două clădiri cu 29 de apartamente, câteva spații pentru birouri și un centru de zi pentru vârstnicii din cartier, în jurul unei grădini comune. Fiecare familie e proprietară pe apartamentul ei, gândit după nevoile și bugetul propriu. Apartamentele au fost livrate la gri, ca fiecare să-și finiseze locuința în ritmul și cu banii lui.
>
> Din cele 29 de apartamente, 27 sunt case pasive. Proiectul a primit premiul „clădire exemplară" al Regiunii Bruxelles încă din faza de proiect.
>
> Față de modelul nostru, Brutopia are partea comună mai dezvoltată: spălătorie, sală polivalentă, mașini folosite în comun. Fiecare grup decide câtă viață în comun își dorește; principiul rămâne același: cei care vor locui acolo conduc proiectul.

**Secțiunea de surse Brutopia (la final, sub text):**

> Mai multe despre proiect:
> - Brutopia pe ArchDaily → https://www.archdaily.com/641278/brutopia-stekke-fraas
> - Articolul din Dezeen → https://www.dezeen.com/2015/06/21/brutopia-aluminium-clad-apartment-complex-cooperative-brussels-belgium-stekke-fraas/

### Articolul 2: De Sijs

- Titlul devine: **„De Sijs, Leuven: cohousing în jurul unei foste cafenele"**

**Textul nou (aprobat, de folosit ca atare):**

> La Leuven, în Belgia, un grup de viitori locatari a construit împreună un ansamblu de locuințe organizat în trei volume, legate de un ax de circulație în formă de L. În centrul ansamblului, o cafenea din secolul al XVIII-lea, numită „De Sijs", a devenit intrarea principală și inima proiectului: sală comună de mese cu bucătărie, spațiu pentru oaspeți, atelier și coworking.
>
> Viitorii locatari au fost implicați în proiectare dintr-o etapă foarte timpurie, cu tot ce înseamnă asta: participare la deciziile ansamblului, dar și confruntarea directă cu efectul alegerilor individuale asupra întregului. Locuințele merg de la garsoniere compacte până la duplexuri cu trei dormitoare, fiecare cu terasă privată spre grădina comună.
>
> Construcția e pe schelet de lemn, izolată cu vată din celuloză și placată cu panouri din plută, un material neobișnuit, rezistent la apă și cu izolare fonică foarte bună.
>
> De Sijs e un exemplu de cohousing în sensul propriu: spații comune extinse și viață colectivă asumată. E capătul celălalt al axei față de modelul nostru, în care colaborarea se concentrează pe construcție, iar la final fiecare rămâne cu apartamentul lui. Între cele două extreme, fiecare grup își alege punctul.

**Secțiunea de surse De Sijs (la final, sub text):**

> Sursa: proiectul pe ArchDaily → linkul exact identificat la audit din banda „Preluat de pe" a articolului actual (pagina Cohousing De Sijs / OFFICEU architects)

**STOP 2: Prezintă diff-ul propus pentru ambele articole și așteaptă aprobarea lui Lucian.**

---

## FAZA 3: IMPLEMENTARE

1. Aplică modificările aprobate pe ambele articole.
2. Șterge fișierele de imagini din repo dacă există local, pentru ambele articole (raportează căile șterse).
3. Verifică că nu rămân referințe rupte (img cu src inexistent, alt-uri orfane).
4. Nu atinge alte articole sau pagini (inclusiv cele găsite suplimentar la audit, dacă există).

---

## FAZA 4: TEST

1. Deschide fiecare articol local/preview: titlul nou, textul în română, fără imagini, fără banda „Preluat de pe", secțiunile de surse cu linkuri funcționale, deschise în tab nou.
2. Verifică diacriticele și lipsa em-dash în tot textul afișat.
3. Verifică listarea ambelor articole în indexul News (titlurile noi apar corect; dacă listarea folosea prima imagine ca thumbnail, verifică că lipsa ei nu strică layoutul; raportează dacă strică).
4. Verifică pe viewport mobil (375px).
5. Verifică butoanele de share existente (funcționale, titlul corect în share).

**STOP 3: Raportează rezultatele. NU face commit fără aprobarea explicită a lui Lucian (push = deploy live pe Render).**

---

## FAZA 5: COMMIT (doar după aprobare la STOP 3)

1. Commit cu mesaj: `fix(news): articole Brutopia si De Sijs rescrise cu text propriu, eliminat continut preluat (foto + text)`
2. După deploy (~2 min), verificare pe apartamentual.ro: ambele articole live, linkurile de surse funcționale.

---

## Pași după deploy (Lucian, în afara Claude Code)
1. Trimite emailul către Tim Van de Velde (draftul e pregătit); abia după ce articolul curat e live.
2. Actualizează linkul din bio Instagram spre acest articol (sau spre ce-este/exemple-europa.html, conform deciziei) înainte de postarea de dimineață.
3. Dacă auditul a găsit ALTE articole cu conținut preluat (în plus față de Brutopia și De Sijs): Lucian scrie/aprobă texte noi și se tratează într-o rulare separată.
4. Dacă fotograful răspunde pozitiv: handoff nou pentru reintroducerea pozelor cu credit „Foto: Tim Van de Velde" + link.

# Handoff: Organizarea pe apartamente (tab pe pagina grupului)

**Proiect:** ApartamenTUal (repo bogdanbatog/apartamentual, frontend vanilla JS/HTML/CSS pe Render, backend Supabase, project ID glbvbbgmcobtswwlktic)
**Data handoff:** 26 august 2026
**Autor context:** Lucian (decizii de produs) + Claude (structurare). Claude Code execută pe faze, cu STOP-uri.

---

## 1. Context și obiectiv

Grupurile de pe platformă au terenuri favorite. Pentru unele terenuri există (sau va exista) o **analiză preliminară/elaborată** făcută de arhitecți: variante de împărțire a construcției în apartamente, cu suprafețe, ponderi de cost și prețuri estimative per apartament.

**Obiectiv:** o secțiune nouă „Organizarea pe apartamente" pe pagina grupului (grup-details.html), vizibilă doar membrilor grupului, care:
1. afișează variantele de împărțire și apartamentele fiecărei variante (casete cu preț/suprafață);
2. arată un panou de detaliu per apartament: teren + construcție = total, medii pe mp per variantă (calculate în frontend din date);
3. permite membrilor să marcheze interes pe apartamente;
4. oferă PDF-ul analizei la descărcare.

**De ce acum:** un grup real (Parcul Circului, ~20 membri) compară terenuri chiar în aceste săptămâni și își construiește manual echivalentul în Google Sheets. Referință de nevoi reale: coloanele din Excel-urile lui Robert (terenuri, suprafețe, linkuri CU/CF, rubrica „ce-și dorește fiecare").

**Referință vizuală:** mockup HTML existent (Lucian îl atașează în /_handoff/ sau îl dă în conversație). Mockup-ul e ghid de structură, NU specificație pixel-perfect. Stilul urmează design-ul existent al platformei.

---

## 2. Decizii deja luate (nu se rediscută)

- **PDF ≠ date structurate.** PDF-ul analizei se atașează terenului (upload în Supabase Storage, bucket separat, precedent: checklist bucket) și e descărcabil din tab. Tab-ul interactiv se deblochează DOAR când există date structurate pentru terenul respectiv. PDF fără date → mesaj intermediar: „Analiza e atașată; organizarea pe apartamente se activează în curând."
- **Condiția de afișare a secțiunii:** terenul e la favoritele grupului ȘI există date structurate de analiză pentru el. Altfel secțiunea nu apare deloc (sau apare doar starea intermediară dacă există PDF).
- **Vizibilitate:** doar membrii grupului văd tab-ul și datele. Nelogații/ne-membrii văd cel mult un teaser („grupul are o analiză pe acest teren"). Excepție cunoscută: grupurile marcate Exemplu sunt publice; datele de test de acolo NU vor fi copii ale analizelor reale plătite (cifre modificate obligatoriu).
- **Calculele** (teren + construcție = total, medie pe mp per variantă) se fac în frontend din datele stocate; nu se stochează valori derivate.
- **Datele structurate le introduce operatorul** (Lucian). Analiza vine din procesul de proiectare, nu se automatizează introducerea.
- **Fluxul de test** (validat): grup demo cu admin user de test → terenul cu analiză adăugat la favoritele grupului → PDF atașat → date structurate încărcate → tab-ul apare → conturile de test marchează interes. Datele de test cu cifre schimbate față de orice analiză reală.

## 3. Decizii deschise — de confirmat cu Lucian la STOP-ul din faza Plan

Claude Code NU decide singur; prezintă opțiunile și așteaptă răspunsul lui Lucian. Default-urile recomandate:

- **D1. Încărcarea datelor în faza 1:** (B, recomandat) script SQL comentat, rulat de Lucian în SQL Editor, cu template de INSERT-uri livrat de Claude Code; fără UI de admin. (A) formular minim de admin — doar dacă Lucian o cere explicit; dublează scope-ul.
- **D2. Marcarea interesului:** (recomandat) un membru poate marca mai multe apartamente simultan; ceilalți membri văd doar numărul („2 familii interesate"), nu identitatea; toggle simplu; fără notificări în faza 1. De confirmat: adminul grupului vede ceva în plus (ex. nominal cine a marcat)? Default: nu, în faza 1 nimeni nu vede nominal.
- **D3. Poziționare față de celelalte handoff-uri** (2 homepage logat → 3 harta pe pagina-ghid → 4 indicator etapă pe pagina de grup): recomandat ca acest handoff să ruleze lipit de 4 (ambele ating grup-details.html și cer migrație; o singură trecere). Alternativ, înaintea tuturor, dacă Lucian decide că grupul Circului îl face urgent.

## 4. Model de date propus (draft pentru faza Plan; Claude Code îl validează pe schema existentă la Audit)

Tabele noi (nume finale de aliniat la convențiile existente din migrațiile 001–029):

- `analize`: id, teren_id (FK terenuri), titlu, data_analizei, pdf_path (nullable), note, created_at
  - Notă: analiza aparține terenului, nu grupului; dacă schema existentă leagă analizele plătite de comenzi/grupuri, se discută la Audit dace refolosim ceva existent.
- `analiza_variante`: id, analiza_id (FK), nume (ex. „Varianta A — 5 apartamente"), suprafata_construita_mp, suprafata_utila_mp, cost_teren_total, cost_constructie_total, note, ordine
- `analiza_apartamente`: id, varianta_id (FK), eticheta (ex. „Ap. 2"), nivel (ex. „Etaj 1"), suprafata_utila_mp, pondere_cost (procent din total), pret_estimat, note, ordine
- `apartament_interes`: id, apartament_id (FK), user_id (FK profiles), created_at, UNIQUE(apartament_id, user_id)

RLS (de detaliat la Plan pe modelul politicilor existente pentru grupuri):
- SELECT pe analize/variante/apartamente: user e membru activ al unui grup care are terenul la favorite (sau superadmin). Atenție la cazul „terenul e favorit la două grupuri" — analiza se vede în ambele; de confirmat la Plan că e acceptabil (default: da).
- INSERT/DELETE pe apartament_interes: doar pentru propriul user_id, doar dacă e membru al unui grup calificat.
- Tot restul de scriere: service role / superadmin.
- SELECT agregat pe interes pentru membri: număr, nu identități (view sau count în query, nu expunerea rândurilor).

## 5. Ce NU intră în faza 1 (explicit out of scope)

- UI de admin pentru încărcarea analizelor (vezi D1)
- Notificări (de niciun fel; nu se atinge sistemul de notificări)
- Export PDF generat din date
- Editarea variantelor de către membri sau admin de grup
- Orice legătură cu plăți/Netopia/Oblio
- Comentarii pe apartamente (comentariile există la nivel de teren, rămân acolo)

## 6. Faze de execuție

### Faza 1: AUDIT (read-only)
- Citește schema existentă: tabele grupuri, membri, terenuri, favorite, profiles, politici RLS existente, convenții de numire din migrațiile aplicate (001–029).
- Citește grup-details.html + JS-ul aferent: cum se randează secțiunile existente, cum se verifică apartenența la grup în frontend, cum se apelează Supabase.
- Identifică dacă există deja vreo structură pentru analize (comenzi de analiză plătite prin Netopia/Oblio) și raportează dacă/ cum se leagă.
- Livrabil: raport scurt (ce există, ce se refolosește, riscuri, propunere finală de schema aliniată la convenții).

**STOP 1 — prezintă raportul de audit + întrebările D1–D3. Așteaptă confirmarea lui Lucian.**

### Faza 2: PLAN
- Migrația SQL completă (numerotată în continuarea celor existente), cu comentarii, gata de rulat manual în SQL Editor. Include tabele, indecși, RLS, eventual view pentru count interes.
- Planul de frontend: ce fișiere se modifică (grup-details.html + js), structura secțiunii (listă variante → casete apartamente → panou detaliu → buton interes → link PDF), stările (fără analiză / doar PDF / complet), mesajele în română cu diacritice corecte.
- Template-ul de script SQL de încărcare a unei analize (INSERT-uri comentate, cu placeholder-e clare), pentru fluxul operatorului.
- Planul de test (vezi faza 4).

**STOP 2 — Lucian aprobă migrația și planul înainte de orice implementare. Migrația o rulează Lucian manual în SQL Editor; Claude Code nu are și nu cere acces la Supabase.**

### Faza 3: IMPLEMENTARE
- Frontend-ul complet pe grup-details.html, în stilul existent al platformei (vanilla JS, fără librării noi).
- Textele UI în română cu diacritice corecte (ș/ț cu virgulă), fără em-dash, „bloc" nu „mic bloc".
- Fără nicio modificare în afara scope-ului; fără refactorizări oportuniste.

### Faza 4: TEST
Checklist minim, executat de Lucian cu ghidajul Claude Code:
- [ ] Migrația rulată fără erori; tabelele și politicile există.
- [ ] Script de încărcare rulat cu date de test (cifre fictive) pe terenul favorit al grupului demo.
- [ ] Cont admin de test: vede secțiunea, vede variantele, casetele, panoul de detaliu, mediile pe mp calculate corect (verificare de mână pe un exemplu).
- [ ] Cont membru de test: vede tot, poate marca/demarca interes pe mai multe apartamente; vede „N familii interesate" fără nume.
- [ ] Cont NE-membru + delogat: nu vede datele (nici prin API direct — verificare RLS cu request manual).
- [ ] Teren cu PDF dar fără date: apare starea intermediară.
- [ ] Teren fără analiză: secțiunea nu apare.
- [ ] Mobil: casetele și panoul utilizabile pe ecran mic.

**STOP 3 — rezultatele testelor prezentate lui Lucian. Commit doar după aprobare explicită. Push = deploy live pe Render, deci nimic nu se împinge fără OK-ul lui Lucian.**

### Faza 5: COMMIT
- Un commit cu mesaj clar; fișierul de migrație inclus în repo (folderul de migrații existent) chiar dacă rularea e manuală.
- Actualizare scurtă în /_handoff/ cu stadiul final și pașii de operare (cum se încarcă o analiză nouă: pașii + template-ul SQL).

---

## 7. Anexe de furnizat de Lucian în conversația cu Claude Code

1. Mockup-ul HTML (organizare pe apartamente) — referință de structură.
2. Structura reală a unei analize elaborate (variantele + apartamentele de la un caz real, cu cifrele MODIFICATE) — ca modelul de date să fie validat pe realitate.
3. Răspunsurile la D1–D3 (dacă nu s-au dat până la STOP 1).

## 8. Reguli permanente (memento)

- Fără deploy fără aprobarea lui Lucian; push-ul pe main = deploy automat pe Render.
- Migrații DB: doar manual, prin SQL Editor, rulate de Lucian.
- Fără credențiale în chat.
- Diacritice corecte cu virgulă în toate textele afișate; fără em-dash; „Județului Housing" formă fixă dacă apare; fără procente de economii nicăieri în UI.
- Datele de test nu reproduc cifrele niciunei analize reale plătite.

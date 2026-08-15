# NOTES — observații tehnice deschise

Listă de lucruri observate la audit, care nu sunt urgențe, dar merită discutate / decise.
Nu acționa pe niciuna fără confirmare explicită.

---

## TODO

- [ ] **Migrație profil incompletă (`*-new` vs versiuni vechi)**
  Există în paralel `profile-view.html` + `profile-view.js` și `profile-view-new.html` + `profile-view-new.js` (la fel pentru edit). De decis: migrația e completă și ștergem versiunile vechi, sau încă rulează ambele în paralel? Dacă e complet migrat, fișierele vechi sunt cod mort care creează confuzie la editări viitoare.

- [ ] **`terenuri-old.html` + `terenuri-old.js`**
  Sufixul `-old` sugerează cod legacy păstrat pentru fallback. De verificat dacă mai e linkat de undeva și dacă mai are sens să rămână în repo.

- [ ] **`grup-details.html` are 176.6 KB**
  Semnificativ mai mare decât celelalte pagini (a doua ca mărime, `index.html`, are 75 KB). Probabil conține mult JS/CSS inline. Candidat pentru extragere în fișiere separate dacă ajungem să-l atingem oricum pentru altă schimbare — nu refactor preventiv.

- [ ] **Videoclipuri mari servite direct din repo prin Render**
  `povestea_noastra/videos/timelapse-santier.mp4` (17 MB) și `tur-interior.mp4` (11 MB) — funcționează, dar la trafic real consumă bandă Render și încetinesc deploy-urile. De evaluat mutarea pe Supabase Storage sau un CDN când avem timp. Nu urgent.

- [ ] **Duplicare `terrain-card.js`**
  Există în două locuri: `frontend/js/terrain-card.js` (3.1 KB) și `frontend/js/components/terrain-card.js` (3.0 KB). De verificat care e cel folosit efectiv (grep prin HTML-uri după calea de `<script>`) și de șters cel orfan, ca să nu edităm pe viitor varianta greșită.

- [ ] **`frontend/js/faq.js` — fără diacritice**
  Tot conținutul FAQ (39 întrebări) e scris fără diacritice românești („fata", „pretul" etc.), contrar regulii din CLAUDE.md. La integrarea homepage v9 (28 mai) am corectat doar întrebarea cu procentul de economie, păstrând stilul fără diacritice ca să rămână diff-ul minimal. De curățat tot fișierul la o trecere dedicată.
  ⚠️ **Tot acolo, găsit pe 15 august: 5 răspunsuri conțin em-dash** (liniile 18, 20, 24, 35, 46), contrar regulii permanente din CLAUDE.md. Se văd doar când deschizi întrebarea, de aceea au scăpat. **De făcut în aceeași trecere cu diacriticele** — e același fișier, altfel îl citești de două ori. Regula: se rescrie fraza, nu se înlocuiește semnul.
  ⚠️ `js/footer.js` mai are unul, în alt-ul logoului Netopia, dar acela e pe **toate** paginile, nu doar pe homepage.

- [ ] **Diacritice greșite în titlurile din `ce-este/cum-functioneaza.html`**
  Văzut pe 15 august, la capturi: „CǍUTAREA SI ACHIZIȚIA TERENULUI" (Ǎ greșit, plus „SI" în loc de „ȘI"), „4. CONSTRUCTIA", „4.1. Selectia constructorului". **Doar titlurile mari**, corpul textului e corect. E o trecere scurtă, nu s-a făcut ca să nu se amestece cu altă treabă.

- [ ] **FAQ-ul fără diacritice se vede pe HOMEPAGE, nu doar în `faq.js`**
  Legat de punctul de mai sus despre `frontend/js/faq.js`: întrebările apar pe pagina principală („Cu cat e mai ieftin fata de un apartament de la dezvoltator?", „Cum se personalizeaza apartamentele?", „Exista proiecte Baugruppen realizate deja in Romania?"), adică exact la primul contact al unui vizitator nou, iar restul paginii are diacriticele corecte. Contrastul sare în ochi. ✅ Verificat pe 15 august: **răspunsul despre preț NU promite niciun procent** („Nu lucrăm cu un procent fix de economie… toți banii tăi rămân în apartamentul tău"), deci regula de conținut e respectată.

- [ ] **Harta de cartiere e cod mort (`bucuresti-map.js` + `bucuresti-cartiere.js`)**
  `bucuresti-cartiere.js` (511 linii, poligoanele GeoJSON ale celor 61 de cartiere) e încărcat de `register.html`, dar singurul lui consumator, `bucuresti-map.js`, **nu e încărcat de nicio pagină** — deci se descarcă degeaba la fiecare înregistrare. De decis: reînviem harta (era o selecție de zone pe hartă, mai plăcută decât bifele) sau scoatem ambele fișiere? Descoperit pe 7 august, la adăugarea Corbeancăi. Consecință practică: o zonă nouă **nu** are nevoie de poligon.

- [ ] **Gruparea zonelor periurbane nu ajunge în locurile care citesc din DB**
  De pe 7 august, filtrele de pe `/terenuri` și `/utilizatori` și formularul de propunere teren afișează zonele alfabetic, cu comunele din jur într-un `<optgroup>` separat („Ilfov"). Dar **chips-urile de la crearea/editarea grupului** (din DB, `.order('name')`) și **bifele din profil/înregistrare** (`.order('display_order')`) nu știu de grupare — acolo Corbeanca stă alfabetic printre cartiere, respectiv ultima. De decis, când adăugăm a doua comună: punem un marcaj în baza de date (coloană nouă pe `zones`, gen `tip` sau `judet`) și grupăm peste tot din aceeași sursă, sau lăsăm așa? Cât e o singură comună, nu deranjează.

- [ ] **Secvența `zones_id_seq` a rămas la 36, id-urile reale ajung la 519**
  Zonele au fost inserate cu id scris de mână, pe intervale per oraș (București 101-161, Cluj 201+, Timișoara 301+, Iași 401+, Brașov 501+), deci secvența n-a fost avansată niciodată. Un `INSERT` fără id explicit ar primi 37 — liber, deci **fără eroare**, dar în afara convenției. Nu e stricat nimic (37-100 sunt libere) și zonele se adaugă oricum manual. De ținut minte doar ca să nu pară bug dacă apare vreodată o zonă cu id mic.

- [ ] **FAQ pe homepage — insulă vizuală**
  Homepage-ul v9 (Mona Sans, bej minimalist) afișează `faq.js` ca atare, care are stiluri proprii (carduri albe, accent portocaliu, DM Sans). Arată diferit de restul paginii. Decizie acceptată de Lucian la integrare; de armonizat dacă deranjează.

- [ ] **`terenuri` are două coloane de dată și nu se știe care e „adevărata"**
  `created_at` (după care se sortează lista și care se afișează pe card, `terenuri.js:218` și `343`) și `data_adaugat`, rămasă din schema veche. Cât timp coincid, nu se vede nimic. La un teren la care diferă, lista pare pusă în ordine greșită deși codul e corect. A ieșit la iveală pe 14 august, când Lucian a cerut „cele mai noi întâi" pe `/terenuri.html` — ordine care **există deja** ca implicită. ✅ **Întrebat Lucian pe 14 august: ordinea de pe site e cea așteptată, sortarea NU s-a atins.** Rămâne deschis doar: e `data_adaugat` folosită de ceva, sau se scoate? **Nu rescrie sortarea până nu se lămurește**, altfel repari ceva ce nu e stricat.

- [ ] **Prețul de 99 RON e scris de mână în 11 locuri**
  `analize.html`, `analiza-simplificata.html` (de trei ori), `comanda-analiza.html` (plus `js/comanda-analiza.js`), `servicii.html` (de două ori, în preț și în FAQ), panoul din `terenuri.html` plus constanta `PRET_ANALIZA` din `js/terenuri.js`, iar de pe 15 august și cardul de analiză din `teren-details.html`. La expirarea prețului de lansare (mijlocul lui noiembrie 2026) sunt toate de schimbat. De făcut o listă scrisă **înainte** de a-l mai pune undeva, sau de mutat într-un singur loc citit de toate paginile.
  ⚠️ **Singura sursă de adevăr pentru suma încasată e `supabase/functions/creeaza-proforma-oblio/index.ts`** (`const pretTotal = 99.00`). Cifrele din frontend sunt doar afișare. Dacă se schimbă prețul, ăla e rândul care contează.

- [ ] **Bifa „doar terenurile din zonele mele" e invizibilă pentru nelogat**
  Regula, stabilită la construirea ei pe 14 august: se arată doar celui logat cu cel puțin o zonă bifată în profil; nelogatului i se arată în locul ei rândul cu „Intră în cont", dar **numai** dacă a venit pe un link cu `?zonele_mele=1`. Rațiunea: să nu-i promitem ceva ce nu poate vedea. **Consecință:** un vizitator obișnuit nu află niciodată că funcția există, iar Lucian însuși a crezut că a dispărut când s-a uitat la pagină nelogat. De decis: o lăsăm așa, sau o arătăm oricui și cerem autentificarea la clic? Nu e o reparație, e o decizie de produs.

- [ ] **Datele de urbanism nu există nicăieri (POT, CUT, regim, deschidere, utilități)**
  Macheta paginii unui teren avea un rând de chips cu „Regim: S+P+2+3 retras", „POT: 65%", „CUT: 1,8", „Deschidere: 12 ml", „Utilități: toate". Tabela `terenuri` **nu are coloanele astea**, iar formularul de propunere nu le cere: sunt doar titlu, descriere, oraș, cartier, suprafață, preț total, poze, link sursă. Pe 15 august s-a decis să sărim rândul, nu să-l inventăm. Dacă îl vrem: coloane noi + câmpuri în `terenuri-propune.html` + editare în admin + afișare. Informația **există** azi, dar înecată în textul agentului, de unde n-o poate citi nici filtrarea, nici o analiză.

- [ ] **Unele terenuri au ca poză principală o captură de ecran, nu o fotografie**
  Găsit pe 15 august la „Teren zona Rond Cosbuc, blvd Libertății, Unirii": poza principală e o captură de ecran de pe Storia, făcută cu telefonul, 1080×2340, cu tot cu ceasul, bara de stare, butoanele aplicației și „Contact prin Storia". Afișarea a fost reparată (pozele înalte nu se mai taie), dar **conținutul rămâne prost** și se repară din admin, nu din cod. Măsurat: 4 din 46 de terenuri au poza principală în portret, alte 9 sunt aproape pătrate. De trecut o dată prin ele cu ochiul.

- [ ] **Niciun teren nu are `nr_apartamente_min/max` completat**
  Măsurat pe 15 august: 0 din 46 de terenuri aprobate. Faptul „Apartamente estimate" din antetul paginii unui teren e scris și merge, dar azi nu-l vede nimeni. Se umple abia când o analiză scrie înapoi în teren. De verificat dacă fluxul de analiză chiar scrie coloanele alea, sau dacă au rămas moarte din altă schemă.

- [ ] **Homepage-ul uită că omul are cont (trei locuri)**
  Măsurat pe 15 august, parcurgând pagina logat, cadru cu cadru (`screenshots/20260815/homepage-logat-01..14.jpg`). Hero-ul se schimbă corect (varianta A, cu numele și vecinii compatibili), **restul paginii nu știe nimic**: caseta webinar oferă butonul „Creează cont" cuiva logat, la două ecrane sub hero-ul care îi scrie numele; blocul final spune „fără cont, fără nimic de pregătit"; newsletterul cere adresa de email pe care platforma o are deja. Niciunul nu e stricat, toate sunt scrise pentru un străin. **Nu se rezolvă ascunzând blocurile** — webinarul e util și celor cu cont; se schimbă butonul și fraza. Mecanismul există deja în scriptul „HERO PE ROLURI" de la finalul lui `index.html`, nu se adaugă a doua verificare de sesiune în paralel. Detalii și capcane: `handoff/20260815 - handoff-2-resturi-homepage.md`, punctul A.

- [ ] **Liniuța lungă are o poartă în baza de date, nu doar în cod**
  Găsit pe 15 august, scanând pagina **live**: titlul unui articol din News, „Povestea noastra — Prototipul Judetului Housing", conține em-dash și e și fără diacritice. Vine din Supabase, deci **niciun grep prin repo nu-l putea găsi**. Consecința e mai mare decât titlul: regula permanentă despre liniuța lungă poate fi încălcată din admin, cu codul curat. Se repară din admin. 🔴 **Editarea titlului poate regenera slug-ul și rupe linkurile** (memoria `admin-slug-editare-articole`) — nu atinge câmpul slug, iar după salvare verifică pe homepage că articolul se mai deschide.

- [ ] **Secțiunea News amestecă serialul cu articolele, și nu în ordine**
  Văzut pe 15 august pe live: cardurile de serial apar numerotate 3, 2, 0, 1, cu un articol despre Bruxelles între ele. Cine vrea să citească povestea de la cap n-are de unde ști de unde începe. Nediscutat cu Lucian, deci nici măcar decis că e o problemă.

- [ ] **Capcană de stil: `.hero-content p` bate orice selector cu o singură clasă**
  Hero-ul paginii de terenuri are `.hero-content p { color: var(--slate-300); font-size: 1rem; }`. Orice `<p>` nou pus în hero primește culoarea și mărimea aia, oricât de explicit ai scris tu altceva într-o clasă. Pe 14 august eticheta panoului de analiză s-a randat gri deschis la 16px, cu contrast sub 1,5:1, deși în cod scria teracotă la 11px. Reparat cu selectori de două clase. **Tiparul de hero se repetă și pe alte pagini**, deci capcana nu e doar aici.

---

## Rezolvate

- [x] **2026-08-15 — Homepage: secțiunea „Cum începi", două căi de intrare** *(comituri `7df6e2d` + `2ff29e6`, împinse; **publicat** din cPanel și verificat pe live)*
  Secțiunea „Cum funcționează" (4 pași) s-a **înlocuit** cu două căi concrete, de la teren sau de la zonă, și s-a **mutat** imediat sub blocul „Cum a devenit posibil", deasupra liniei de derulare a majorității vizitatorilor. Motivul din handoff: 52% rată de ieșire, 43% adâncime de derulare, iar cei 4 pași vechi descriau serviciul și includeau etape aflate la ani distanță de vizitator („Cumpărați terenul", „Construiți și vă mutați"). CTA-ul secundar din hero a devenit ancoră internă `#cum-incepi`, cu derulare lină și `scroll-margin-top:88px` (nav-ul e `sticky`, 64px, altfel titlul rămânea sub el).
  **Derularea lină e anulată pe `prefers-reduced-motion`** — cine a cerut din sistem mai puțină mișcare primește saltul instant. Butonul „sus" din nav era deja lin prin JS, nu se bat cap în cap.
  „5 familii" scos din hero („Câteva familii") și din caseta webinar („Familiile care l-au construit"), la cererea din handoff. **Restul termenilor semnalați acolo („mic bloc", „primul din România", „fără dezvoltator") au rămas NEATINȘI, prin decizia explicită a lui Lucian.**
  ⚠️ **Un eveniment Plausible a dispărut**: „Creează cont gratuit" din secțiunea veche avea `loc=pasi dest=register`. Cele trei butoane noi folosesc convenția existentă (`CTA Click` + `loc=cum-incepi`), **nu** nume noi de evenimente — altfel ar fi ieșit din raportul în care se compară toate CTA-urile între ele. Butonul din hero raportează acum `dest=cum-incepi` în loc de `cum-functioneaza`, deci în grafic linia veche se oprește și începe una nouă.
  ⚠️ **Handoff-ul se contrazicea singur pe em-dash** (faza 2C zicea să nu se atingă, faza 3 zicea să se verifice că n-au rămas). S-a urmat 2C, apoi Lucian a cerut explicit scoaterea lor: 7 texte și atribute din `index.html`, inclusiv două `aria-label`, două titluri de iframe, alt-ul Netopia, mesajul „niciun vecin găsit" și liniuța singură afișată agenției când n-are propuneri. Cele 9 rămase în fișier sunt toate în comentarii de cod, unde regula le permite.
  ✅ Verificat pe live după deploy: secțiunea există, cea veche e ștearsă, „5 familii" nu mai apare nicăieri, cele trei linkuri întorc 200, Plausible e încărcat, **diacriticele au supraviețuit urcării în cPanel**.
  📸 Referință vizuală comisă în `screenshots/20260815/`: `homepage-logat-01..14` (pagina întreagă, logat), `homepage-mobil-01..02` (secțiunea nouă la 375px), `homepage-dupa-nelogat-02`. Setul „înainte" (`homepage-nelogat-01..14`) a rămas netrackuit, ca restul folderului.
  🟡 **Trei rămășițe, fiecare o sesiune scurtă separată: `handoff/20260815 - handoff-2-resturi-homepage.md`.**

- [x] **2026-08-15 — Prețul standard tăiat (149 RON) scos de peste tot** *(commit `2ee22cb`; **publicat**)*
  Cerut de Lucian. Se afișează doar prețul de lansare: **99 RON, TVA inclus**. Opt locuri, în patru pagini: `analize.html` (cardul), `analiza-simplificata.html` (butonul din hero, rândul „Preț", paragraful de CTA, butonul de jos), `comanda-analiza.html` (rândul de preț din hero), `servicii.html` (cardul de serviciu și întrebarea din FAQ, care se numea „Analiza preliminară costă 99 sau 149 RON?" și acum e „Cât costă analiza preliminară?").
  Scoase și cele două reguli CSS rămase fără folos (`.price-old`, `.ord-price-old`), ca să nu ispitească pe cineva să pună prețul tăiat la loc.
  Butonul care duce la plată scrie acum **„Continuă la plată, 99 RON cu TVA inclus"** (era „Continuă la plată — 99 RON", fără TVA și cu liniuță lungă). ⚠️ Eticheta lui e scrisă în **două locuri**: `comanda-analiza.html` și `setSubmitting()` din `js/comanda-analiza.js`, care o pune la loc după starea „Se procesează…". Dacă se despart, butonul își schimbă singur textul după o încercare de plată eșuată.
  **Suma încasată nu s-a atins**: rămâne 99,00 în `creeaza-proforma-oblio`. S-a schimbat doar afișarea.
  ⚠️ Mențiunile la 149 rămase în `handoff/HANDOFF-pagina-servicii.md` și în nota din `email_templates/` sunt **înregistrări istorice, datate**, nu se rescriu.

- [x] **2026-08-15 — Reorganizarea paginii unui teren (`/teren-details.html`)** *(comituri `74dea00`, `0efc0d1`, `ecd763b`, `9aaa62a`; **publicat** și verificat pe live)*
  Trei blocuri, după macheta din `handoff/apartamentual 03-handoff_pagina unui teren.zip`: antet (galerie + cele patru date), „Ce poți face cu terenul acesta" (cinci carduri), descrierea din anunț mutată la subsol și pliată la trei rânduri. Foaie nouă, `frontend/teren-details.css`, cu tokenurile din `terenuri.css`; clasele sunt prefixate `td-` fiindcă pagina încarcă și Tailwind, și `styles.css`, și v9. Până la primul pas de făcut: pe telefon 1.619 → 881 px, pe desktop 867 → 673 px. Detalii, capcane și decizii: **`handoff/handoff-pagina-unui-teren.md`**.
  ✅ Rezolvate pe drum și cele două rămășițe vechi: butonul „Cere o analiză" **are acum explicație** (cardul mare, cu ce primești și 99 RON), iar panoul de grupuri **nu mai dispare** pentru cine nu e în niciun grup (are trei stări: nelogat, logat fără grupuri, logat cu grupuri).
  ✅ Pozele în portret nu se mai taie: sub raportul 1,3, rama trece pe `object-fit: contain`. Priveau 13 din 46 de terenuri.
  ⚠️ **Două defecte au ieșit abia DUPĂ publicare**, fiindcă proba locală s-a făcut nelogat și cu fila în față: rândul de acțiuni rapide are patru butoane când ești logat, nu trei, și se rupea la patru pixeli distanță (`ecd763b`); iar butonul „Citește mai mult" lipsea în fila deschisă în fundal, unde `requestAnimationFrame` nu rulează deloc (`9aaa62a`). **Regula de acum înainte: o pagină cu stări de autentificare se probează LOGAT, iar una care măsoară ceva la încărcare se probează și cu fila în fundal.** Detalii: `handoff/handoff-pagina-unui-teren.md`.
  ⚠️ Găsit și reparat un bug vechi: badge-ul de status scria **„approved", în engleză, pe fiecare pagină de teren**. `statusMapping` avea valori care nu există în bază (`active`, `under_review`, `reserved`, `sold`, `inactive`), iar codul afișa valoarea brută când nu găsea potrivire. Statusurile reale sunt `pending` / `approved` / `rejected`. Acum „approved" nu se mai arată deloc (toate terenurile publice sunt aprobate, deci semnul nu spunea nimic).

- [x] **2026-08-14 — Reorganizarea paginii `/terenuri.html`** *(commit `a0df9d1`, împins; **nepublicat**, cPanel manual)*
  Panoul „Analiză preliminară" în hero (cei patru pași, din macheta din `handoff/`), CTA de analiză pe fiecare card, cardul întreg clicabil, iconițele „vezi cine e interesat" scoase, faptele terenului pe două rânduri, pașii 3 și 4 pliați pe telefon, bara de filtre strânsă. Pe telefon, până la primul teren: 1.127 → 777 px. Detalii complete, capcane și decizii: **`handoff/handoff-reorganizare-pagina-terenuri.md`**.
  ⚠️ Două capcane de ținut minte la orice atingere viitoare a fișierelor astea: **apostrofurile inverse într-un comentariu din interiorul unui template string** închid string-ul și pagina rămâne blocată pe „Se încarcă", fără eroare în consolă (se prinde cu `node --check js/terenuri.js`); și **orice element interactiv nou pus pe card are nevoie de `position: relative; z-index: 2`**, altfel intră sub folia linkului care face cardul clicabil și clicul pe el deschide terenul.
  ✅ Decizie: **rămânem pe Mona Sans**, nu trecem pe Nunito ca în machetă.

- [x] **2026-08-14 — Bifa „doar terenurile din zonele mele" pe `/terenuri.html`** *(commit `c984209`)*
  Cerută de Lucian în aceeași zi. `terenuri.js` citește acum zonele bifate din `user_preferred_zones` (plus numele orașului din `cities`) și filtrează lista după ele. Bifa se adună cu filtrele de oraș/cartier, are etichetă în „Filtre active", se stinge la „Resetează" și își schimbă mesajul stării goale.
  **Potrivirea teren↔zonă e pe text, cu aceeași normalizare ca emailul săptămânal** (`lower(btrim(...))` pe ambele capete, fără scoaterea diacriticelor, ca în `db_schema/digest-terenuri/2c-functie-cu-lista-terenuri.sql`). Dacă se schimbă una, se schimbă amândouă, altfel pagina și emailul arată liste diferite. Se compară și orașul, nu doar cartierul: „Centru" există în mai multe orașe.
  **`?zonele_mele=1` există tocmai ca emailul să poată da un link gata filtrat** — a doua jumătate a cerinței vechi, care bloca pasul 1 din email. Bifa apare doar celui logat cu cel puțin o zonă; pentru nelogatul venit pe acel link se arată în locul ei intrarea în cont, iar parametrul supraviețuiește reîncărcării de după autentificare.
  ⚠️ **Neprobat: citirea efectivă din `user_preferred_zones`**, fiindcă cere cont. Filtrarea, eticheta, resetarea, combinația cu orașul, starea goală și traseul nelogatului au fost probate local pe baza reală (46 → 5 pe două zone).

- [x] **2026-06-18 — Ștergere teren din admin nu se propaga pe platformă**
  Cauză: `terenuri` are RLS pornit fără politică DELETE → hard delete-ul era blocat tăcut, iar `deleteTeren` nu verifica eroarea (rândul dispărea doar local din admin, rămânea în DB). Schema avea `deleted_at` (soft delete) dar nefolosit corect.
  Rezolvare: `migrations/004_terenuri_hard_delete.sql` adaugă politica RLS de DELETE pentru superadmin; `admin-terenuri.html` face acum hard delete real cu verificare de eroare. Toate tabelele-copil (grup_terenuri, terenuri_likes_grupuri, grup_teren_comments, terenuri_likes, user_teren_notes) au deja `ON DELETE CASCADE`, deci ștergerea curăță automat dependențele. Confirmat funcțional.
  Lecție: în panourile admin, **mereu verifică `error`** la `.delete()`/`.update()` pe tabele cu RLS — altfel eșecurile de politică trec neobservate. Notă: poza din Storage (`image_url`) NU se șterge automat la hard delete — rămâne fișier orfan în bucket (inofensiv).

---

*Ultima actualizare: 2026-08-15*

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

---

## Rezolvate

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

*Ultima actualizare: 2026-08-14*

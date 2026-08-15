# Handoff Claude Code: Homepage nelogat, secțiunea „Cum începi" + corecturi limbaj

**Repo:** bogdanbatog/apartamentual
**Fișier principal:** index.html (homepage nelogat; dacă structura e alta, identifică la Audit)
**Regulă de bază: NICIUN commit și NICIUN push fără aprobarea explicită a lui Lucian. Push = deploy live pe Render.**

---

## Context

Homepage-ul are 52% rată de ieșire și 43% adâncime de derulare (Plausible, 28 zile). Secțiunea „Cum funcționează" (4 pași numerotați) e la aproximativ 7 blocuri de la hero, sub linia de derulare a majorității vizitatorilor. Cei 4 pași actuali descriu serviciul („procesul e ghidat complet") în loc să dea acțiuni concrete, și includ pași aflați la ani distanță de vizitator („Cumpărați terenul", „Construiți și vă mutați").

Obiectiv: secțiunea se înlocuiește cu două căi de intrare concrete (de la teren / de la zonă), se mută imediat după blocul „Cum a devenit posibil" + „Cum facem asta?", iar CTA-ul secundar din hero („Cum funcționează") devine ancoră internă către ea, în loc de link către pagina-ghid externă.

---

## FAZA 1: AUDIT (fără modificări)

1. Identifică fișierul homepage-ului nelogat și confirmă structura secțiunilor în ordinea actuală: hero → carduri („Cum a devenit posibil" / „Cum facem asta?") → timelapse → citat Tiberiu M. → „Ce câștigi" → webinar → „Cum funcționează" (4 pași) → galerie Județului Housing → newsletter → echipa → video fondator → News → banner webinar → FAQ → footer.
2. Găsește CTA-ul secundar din hero („Cum funcționează") și notează href-ul actual (probabil pagina-ghid „cum-functioneaza").
3. Confirmă cum e integrat Plausible și dacă există deja evenimente custom (script cu `data-domain`, funcția `plausible()`).
4. Caută în fișier toate aparițiile pentru corecturile de limbaj (lista la Faza 2, pasul C) și raportează fiecare cu linia.
5. Raportează structura CSS a secțiunii actuale „Cum funcționează" (clase, grid) ca noua secțiune să reuse stilurile existente unde se poate.

**STOP 1: prezintă structura găsită, locațiile exacte ale textelor de corectat și planul de implementare. Așteaptă aprobarea.**

---

## FAZA 2: IMPLEMENTARE (local, fără commit)

### A. Secțiunea „Cum începi" (înlocuiește secțiunea „Cum funcționează" cu cei 4 pași)

Structură: eticheta „PROCESUL" rămâne, titlul devine „Cum începi", subtitlul devine „Pornești de la un teren sau de la o zonă. Ambele duc într-un grup." Sub el, două carduri egale (grid 2 coloane pe desktop, stivă pe mobil), apoi un rând de subsol al secțiunii.

Secțiunea primește `id="cum-incepi"`.

**Cardul 1:**
- Titlu: „Pornești de la un teren"
- Listă ordonată, 3 puncte:
  1. Cauți terenuri în zonele tale și le adaugi la profil
  2. Vezi cine mai e interesat de ele, oameni sau grupuri
  3. Te alături grupului sau faci unul cu cei interesați
- Buton: „Vezi terenurile" → /terenuri.html (sau ruta reală)

**Cardul 2:**
- Titlu: „Pornești de la o zonă"
- Listă ordonată, 3 puncte:
  1. Creezi un grup pe zona ta, de exemplu „Grup Bucureștii Noi"
  2. Adaugi terenurile care îți plac
  3. Ceilalți le văd și se alătură
- Buton: „Vezi grupurile" → /grupuri.html (sau ruta reală)

**Rândul de subsol al secțiunii** (text mic, o linie, deasupra unei borduri sau sub una):
„Din grup, drumul continuă în 7 etape până la recepție: analiza terenurilor, contractul de asociere, cumpărarea, proiectarea, construcția. Vezi tot drumul →"
„Vezi tot drumul" → linkul către pagina-ghid existentă (același href pe care îl avea CTA-ul din hero).

Stilul preia designul existent al site-ului (crem, negru, teracotă, fără umbre decorative). Fără em-dash nicăieri. Diacritice corecte peste tot.

### B. Mutarea secțiunii și ancora din hero

1. Secțiunea „Cum începi" se mută imediat DUPĂ blocul cu cele două carduri („Cum a devenit posibil" / „Cum facem asta?") și ÎNAINTE de timelapse.
2. CTA-ul secundar din hero („Cum funcționează"): textul devine „Cum începi", href devine `#cum-incepi`. Scroll smooth dacă site-ul are deja comportamentul; nu adăuga librării pentru asta.
3. Linkul „Află mai multe" din cardul negru „Cum facem asta?" rămâne neschimbat.

### C. Corecturi de limbaj (în tot fișierul homepage)

DOAR formulările cu „5 familii" se modifică. Restul termenilor (inclusiv „mic bloc", „primul din România", „fără dezvoltator", em-dash-urile, „prima joi a fiecărei luni") rămân NEATINȘI în acest handoff, prin decizia explicită a lui Lucian.

1. Hero, subtitlu: „5 familii din București s-au oprit din căutat..."
   → „Câteva familii din București s-au oprit din căutat..." (restul frazei rămâne identic)
2. Caseta webinar (banner negru): „Cele 5 familii care l-au construit"
   → „Familiile care l-au construit"
3. Dacă la Audit apar și alte formulări cu „5 familii" sau „cinci familii" în textele afișate, raportează-le la STOP 1 și corectează-le la fel, cu „câteva familii" sau „familiile".

### D. Evenimente Plausible

Pe cele trei acțiuni noi, adaugă evenimente custom:
- Click „Vezi terenurile" → eveniment `CumIncepi Teren`
- Click „Vezi grupurile" → eveniment `CumIncepi Grup`
- Click „Vezi tot drumul" → eveniment `CumIncepi DrumComplet`

Folosește mecanismul deja existent (plausible('NumeEveniment') pe click sau clasele tagged-events dacă site-ul folosește varianta cu clase). Nu adăuga scripturi noi dacă există deja infrastructura.

**STOP 2: prezintă diff-ul complet (HTML + orice CSS adăugat), lista înlocuirilor de em-dash și textele finale. Așteaptă aprobarea lui Lucian pe fiecare parte.**

---

## FAZA 3: TEST (local)

1. Verifică vizual pe desktop și pe viewport mobil (375px): cardurile se stivuiesc, listele nu se rup urât, butoanele au lățime plină pe mobil.
2. Verifică ancora: click pe CTA-ul din hero duce la secțiune.
3. Verifică că nu au rămas: „5 familii", „mic bloc", „primul din România", „fără dezvoltator", em-dash în textele afișate (grep pe fișier).
4. Verifică diacriticele în textele noi (ș/ț cu virgulă, nu sedilă).
5. Verifică evenimentele Plausible în consolă (plausible e definit, click-urile apelează funcția).

**STOP 3: raportează rezultatele testelor. Așteaptă aprobarea pentru commit.**

---

## FAZA 4: COMMIT (doar după aprobare explicită)

- Un singur commit: `Homepage: sectiunea Cum incepi (2 cai), mutare sus, ancora hero, corecturi limbaj, evenimente Plausible`
- Push doar după confirmarea finală a lui Lucian. Push = deploy automat pe Render în ~2 minute.
- După deploy, Lucian verifică live și confirmă.

---

## Ce NU face acest handoff

- Nu atinge pagina-ghid „Cum funcționează" (aia e handoff-ul 2, harta pe 7 etape)
- Nu atinge homepage-ul logat / prima pagină după cont
- Nu atinge pagina de grup
- Nu modifică baza de date, nu creează migrații
- Nu schimbă hero-ul dincolo de CTA-ul secundar și subtitlu

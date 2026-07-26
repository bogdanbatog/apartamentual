# Handoff: reparare filtru „Oraș" pe pagina Utilizatori

**Fișier vizat:** `js/utilizatori.js` (funcția `applyFilters`, în jurul liniei 299)

## Context și simptom

Pe `apartamentual.ro/utilizatori.html`, dacă selectezi Oraș = București și Zonă = Tineretului, pagina afișează **5 utilizatori**, deși în baza de date sunt **20 de utilizatori** cu zona Tineretului bifată (17 reali + 3 exemple), toți cu `pseudonym` completat și `account_type = 'activ'`, deci toți ar trebui să treacă de interogarea de încărcare.

## Cauza confirmată

Filtrul de oraș compară numele **zonelor** cu numele orașului:

```js
// linia ~299, GREȘIT
if (filters.oras) {
    filtered = filtered.filter(user =>
        user.zones.some(z => z.name && z.name.toLowerCase().includes(filters.oras.toLowerCase()))
    );
}
```

Rezultat: trec filtrul „București" doar utilizatorii care au bifat o zonă al cărei **nume conține literal cuvântul „București"** (de exemplu „București Noi"). Cineva care a bifat doar Tineretului, Carol sau Tei este eliminat, deși e evident din București.

De aceea apar preponderent utilizatorii cu foarte multe zone selectate (unul are 58 de zone, altul 17): ei au prins din întâmplare și „București Noi" în listă.

**Impact:** utilizatorii noi care filtrează după oraș văd o platformă aparent goală. Există în prezent zeci de profiluri reale ascunse de acest bug.

## Ce NU se schimbă

- Comportamentul prin care lista de zone se populează abia după alegerea orașului rămâne neatins. Este corect ca UX și nu face parte din acest handoff.
- Nu se modifică interogarea de încărcare a profilurilor (`loadUsers`), care este corectă.
- Nu se ating filtrul de interese, sortarea, sau alte pagini.

---

## Faza 1: Audit

1. Deschide `js/utilizatori.js` și confirmă blocul de filtrare a orașului din `applyFilters` (în jurul liniei 299).
2. Verifică ce structură are constanta `ORASE_CARTIERE` din `js/orase-cartiere.js`: cheile sunt nume de orașe, iar valorile ar trebui să fie liste de zone. Raportează formatul exact (array de string-uri? de obiecte? zone grupate pe subcategorii?).
3. Verifică dacă obiectele din `user.zones` conțin vreun câmp de oraș (de exemplu `city_id`). În interogarea curentă se selectează `zones(id, name)`, deci probabil NU. Confirmă.
4. Verifică dacă `profiles` returnează `preferred_city_id` în `loadUsers` (ar trebui, e în lista de select) și dacă există undeva în client o mapare de la `preferred_city_id` la numele orașului.

**STOP 1: raportează rezultatul auditului și așteaptă confirmarea lui Lucian înainte de a propune soluția.**

---

## Faza 2: Plan

Pe baza auditului, propune **una** dintre următoarele două soluții, cu argumentare:

**Soluția A (preferată dacă `ORASE_CARTIERE` conține lista de zone per oraș):**
filtrarea se face verificând dacă utilizatorul are cel puțin o zonă care aparține orașului selectat, folosind maparea din `ORASE_CARTIERE`. Nu necesită modificări în baza de date sau în interogare.

Schiță:

```js
if (filters.oras) {
    const zoneleOrasului = new Set(
        (typeof ORASE_CARTIERE !== 'undefined' && ORASE_CARTIERE[filters.oras])
            ? /* lista de nume de zone, normalizată conform structurii reale */ []
            : []
    );
    filtered = filtered.filter(user =>
        user.zones.some(z => z.name && zoneleOrasului.has(z.name))
    );
}
```

**Soluția B (dacă A nu e fiabilă):**
se adaugă `city_id` în selectul de zone din `loadUsers` (`zones(id, name, city_id)`) și se filtrează după `city_id`, comparând cu id-ul orașului selectat. Necesită o mapare nume oraș → id, care se poate încărca o dată din tabelul `cities`.

Include în plan și tratarea cazului în care un utilizator nu are nicio zonă bifată: în prezent este eliminat de filtru. Propune explicit ce se întâmplă cu el (rămâne eliminat, sau intră dacă `preferred_city_id` corespunde orașului) și lasă decizia lui Lucian.

**STOP 2: prezintă planul cu soluția aleasă și așteaptă confirmarea.**

---

## Faza 3: Implementare

1. Aplică soluția confirmată, modificând exclusiv blocul de filtrare a orașului.
2. Fără refactorizări colaterale, fără modificări de stil, fără alte „îmbunătățiri" observate pe parcurs (există o listă separată de curățenie).

---

## Faza 4: Test

Testează local, cu utilizator nelogat, următoarele cazuri:

1. Oraș = București, Zonă = Tineretului → trebuie să apară **20 de utilizatori** (17 reali plus 3 marcați „Exemplu"), nu 5.
2. Oraș = București, fără zonă → trebuie să apară toți utilizatorii din București (în jur de 50), nu doar cei cu zone al căror nume conține „București".
3. Fără niciun filtru → numărul total rămâne neschimbat față de comportamentul actual.
4. Oraș = Cluj-Napoca → apar doar utilizatorii cu zone din Cluj, fără utilizatori din București.
5. Butonul Resetează readuce lista completă.
6. Verifică în consolă că nu apar erori JavaScript.

**STOP 3: prezintă diff-ul complet și rezultatele celor 6 teste. NU face commit sau push fără aprobarea explicită a lui Lucian: push înseamnă deploy live pe Render.**

---

## Faza 5: Commit (doar după aprobarea de la STOP 3)

1. Mesaj de commit:

```
Fix city filter on users page: match zones by city instead of zone name substring
```

2. Push pe branch-ul principal (declanșează auto-deploy Render, aproximativ 2 minute).
3. După deploy, retestează pe live cazul 1 și cazul 2, ca utilizator nelogat.
4. Raportează rezultatul.

---

## Criteriu de succes

Filtrul de oraș selectează utilizatorii pe baza apartenenței reale a zonelor la oraș, nu pe baza potrivirii de text în numele zonei. Combinația București plus Tineretului returnează 20 de utilizatori.

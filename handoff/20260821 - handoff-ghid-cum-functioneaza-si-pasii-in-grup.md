# Handoff, 21 august 2026: ghidul „Cum funcționează" rescris din Word

**Stadiu: pasul 1 din 5 e gata pe disc, necommitat.** Restul de 4 pași nu sunt începuți.

---

## Starea exactă la închiderea sesiunii

| | |
|---|---|
| Fișiere modificate | **3**, toate în working tree |
| Commituri | **niciunul** |
| Migrații rulate | **niciuna** |
| Deploy | **niciunul** (site-ul se urcă manual din cPanel) |

```
frontend/ce-este/cum-functioneaza.html   ~985 inserții / ~455 ștergeri  (rescrisă integral)
frontend/ce-este/ce-este.css             ~41 linii                      (regula de linkuri)
frontend/js/faq.js                       1 linie                        (5-10 familii)
```

Nimic altceva n-a fost atins. Zero cod de plăți, zero Supabase, zero RLS.

---

## Sursa: documentul Word

`continut/Cum incepi si lista de pasi in grup si dupa cumpararea terenului.docx`

Are **două părți**, iar Lucian le vrea în **locuri diferite**:

1. **„Cum începi"**, 5 pași → merge în **Spațiul tău** din homepage (`index.html`),
   în ambele configurații (fără teren/grup și cu teren/grup). **NEFĂCUT.**
2. **„Pașii într-un grup"**, cea mai lungă → merge în **pagina grupului**, ca listă
   de pași cu casete care se deschid. **NEFĂCUT.**

Amândouă au intrat, deocamdată, doar în ghidul public (pasul 1, făcut).

⚠️ **Observație importantă despre structura Word-ului:** partea a doua **nu e o listă
plată**. Titlurile cu majuscule sunt deja **11 casete**, cu pași bifabili înăuntru:

```
 1. COMUNICAREA CU CEI DIN GRUP
 2. ORGANIZAREA PE TERENURI ȘI APARTAMENTE
 3. PAȘII PENTRU VERIFICAREA TERENULUI
 4. ANALIZA DETALIATĂ
 5. CONTRACT DE ASOCIERE
 6. CUMPĂRAȚI TERENUL
 7. ÎNCEPEȚI PROIECTAREA
 8. ȘANTIERUL
 9. CE FACEȚI DACĂ CINEVA VREA SĂ IASĂ DIN ASOCIERE
10. RECEPȚIA ȘI APARTAMENTAREA
11. MUTAREA
```

Se potrivesc exact peste mecanica de acordeon cerută pentru pagina grupului.

⚠️ La „ÎNCEPEȚI PROIECTAREA", Word-ul scrie explicit *„aici să scriem toate fazele de
proiectare, le-am scris destul de detaliat în ghid complet"*. Deci Word-ul **nu
înlocuiește tot ghidul**, ci îl rescrie păstrând bucata de proiectare care era deja bună.

---

## Cele trei decizii luate de Lucian la începutul sesiunii

1. **Textul vechi bun se topește în structura Word-ului**, nu se șterge și nu rămâne ca
   anexă. (Fazele de proiectare, cele două variante de contractare, recomandarea despre
   mărimea grupului.)
2. **Diagrama „Cronologia unui proiect" rămâne**, dar rescrisă după Word, astfel încât
   rândurile din ea să corespundă cu textul de dedesubt. Până acum nu corespundeau.
3. **Pagina grupului trece la structura de 11 casete**, nu rămâne pe cele 4 faze.
   Bifele existente NU se pierd: cheile din `grup_checklist.step_key` rămân, doar se
   regrupează la afișare. Pașii noi primesc chei noi.

---

## Ce conține acum pagina `ce-este/cum-functioneaza.html`

Structura, în ordine:

- **Cuprins** (15 intrări, două coloane pe desktop, una pe telefon)
- **Cronologia unui proiect**: 4 blocuri (Grupul se formează / Terenul / Proiectarea /
  Șantierul și mutarea) + bara de 23-54 luni. Fiecare rând e link către secțiunea care
  îl explică.
- **Partea întâi: Cum începi** — cei 5 pași, „Cât de mare să fie grupul", „Ce vă puneți
  de acord de la început"
- **Partea a doua: Pașii într-un grup** — cele 11 casete, toate deschise, fără accordion
  (cerut explicit: „fără casete care se deschid pentru detalii")
- **Următorii pași** (4 carduri)

Titlul paginii: **„Cum funcționează, ghidul complet"** (era cu liniuță lungă în `<h1>`).

### Corecții de fond făcute față de versiunea veche

- „Analiză generală / complexă" → **„preliminară / detaliată"**, numele reale ale
  produselor de pe `analize.html`. Vechile denumiri trimiteau omul să caute pe site un
  produs care nu există.
- În proiectare, ordinea corectă: **concept → certificat de urbanism**, nu invers.
- Explicat de ce recomandăm **proiectul tehnic înaintea DTAC**.
- Peste tot: **„legal ar trebui să dureze cel mult 30 de zile"**, nu „durează".

### Cele 14 corecții cerute de Lucian după prima citire

Toate aplicate. Cele care contează pentru cine continuă:

| # | Ce |
|---|---|
| 1 | Linkurile din text erau invizibile. Regula nouă e în `ce-este.css`, vezi mai jos. |
| 5 | Alăturarea la un grup: vezi profilurile membrilor ÎNAINTE, apoi ceri accesul, fondatorul aprobă. Profilul e „cartea ta de vizită". Plus: ai voie să faci oricând un grup separat cu cine te înțelegi. |
| 6b | **5-10 familii**, nu 4-8. |
| 7 | Caseta „Regulament de funcționare" a ieșit. Lucian: *„oamenii nu își fac acum un regulament"*. În loc, patru lucruri simple de stabilit la început. |
| 11 | La certificatul de urbanism pentru construire: cu numărul de înregistrare al depunerii poți cere întrevedere sau clarificări pe email, ca să ai un punct de vedere al autorității care te va autoriza. |
| 13 | Branșamentele: tot procesul, cu proiectare, avize și autorizație, **poate dura spre un an**. |
| 14 | Secțiunea „Factori critici de succes" a fost ștearsă. Lucian: *„prea pompos și generalist"*. |

⚠️ **Regulă de ton confirmată în sesiunea asta:** fără formulări „ușor amuzante".
Exemplul respins: *„Un grup de construcție trăiește sau moare din felul în care vorbește."*
Lucian: *„nu par profi, serioase și par scrise de AI"*.

### Trei funcții marcate „în curând" pe pagină

Sunt pe **pagină publică**, deci s-au marcat ca neconstruite în loc să fie promise:

- **Secretariatul grupului** (așa e formulat și în Word)
- **Organizatorul membrilor pe apartamente** (în Word e scris ca și cum ar exista)
- **Planificatorul de plăți** pe procente, după modelul Județului (idem)

Când se construiesc (pașii 4 și 5 de mai jos), se scoate eticheta `.eticheta-curand`.

### Bucăți scrise de Claude, nu de Lucian

În Word, **„RECEPȚIA ȘI APARTAMENTAREA" și „MUTAREA" au doar titlul**, fără text.

- Textul de la apartamentare e cel aprobat în sesiunea din 18 august (vezi handoff-ul
  de atunci, „FAZA 4, PASUL 8").
- Textul de la **mutare e nou și inventat**: utilități pe numele fiecăruia, administrarea
  părților comune, fondul de reparații, viciile ascunse. **Lucian nu l-a validat explicit.**

---

## Regula de linkuri, mutată în `ce-este.css`

**Problema:** `.ce-content a` lăsa linkul negru, ca restul textului, cu subliniere doar la
hover. În mijlocul unui paragraf nu se vedea că e link. Afecta toate paginile din `/ce-este/`.

**Soluția**, în `frontend/ce-este/ce-este.css`, la finalul fișierului:

```css
.ce-content a:not(.card):not(.hub-card):not(.ce-nav-link):not(.cta-primary):not(.cta-secondary):not(.step-item) {
    color:#a94a35;                 /* teracota logoului, întunecată cât să treacă pragul de contrast */
    text-decoration:underline;
    ...
}
```

⚠️ **Două capcane, dacă se umblă la ea:**

1. **Lista de excepții e scrisă de două ori**, o dată pentru starea normală și o dată
   pentru `:hover`. Dacă apare un tip nou de card-link în `/ce-este/`, clasa lui trebuie
   adăugată în **ambele**, altfel cardul primește subliniere la hover.
2. **Neutralizatorul Tailwind de deasupra a fost modificat.** Era
   `.ce-content .text-blue-600 { color:#1a1a1a !important; }` și, cu `!important`, bătea
   regula nouă. Acum e `.text-blue-600:not(a)`, deci `<div>` și `<span>` rămân negre, iar
   linkurile primesc culoarea. **Fără `:not(a)`, regula de linkuri nu funcționează deloc**,
   și e greu de depistat: sublinierea se aplică, doar culoarea nu.

---

## Restanțe cunoscute

### 1. `&mdash;` în `faq.js`, text citit de utilizatori

`frontend/js/faq.js`, în răspunsul la „Există proiecte Baugruppen realizate deja în România?":

```
Sectiunea <a href="prototip.html" ...>Povestea noastra &mdash; Prototipul Judetului Housing</a>
```

Încalcă regula permanentă din CLAUDE.md (13 august): fără liniuță lungă în text citit de
oameni. **Semnalat lui Lucian, nereparat**, fiindcă era în afara a ce ceruse.
Reparația e o linie: se rescrie titlul, nu se înlocuiește mecanic semnul.

### 2. `faq.js` e scris fără diacritice, deliberat

Tot fișierul. Răspunsul nou despre mărimea grupului a fost scris în același stil, ca să nu
iasă un singur rând cu diacritice din 167.

### 3. Mărimea grupului e scrisă acum în două locuri

- `frontend/ce-este/cum-functioneaza.html`, secțiunea „Cât de mare să fie grupul"
- `frontend/js/faq.js`, întrebarea „Cati membri are de obicei un grup?"

Ambele spun 5-10 familii. Dacă se schimbă una, se schimbă amândouă.

---

## Planul pe 5 pași, unde suntem

| # | Ce | Stare |
|---|---|---|
| **1** | `ce-este/cum-functioneaza.html` rescrisă din Word | ✅ **gata, necommitat** |
| **2** | „Cum începi", cei 5 pași, în Spațiul tău (`index.html`), ambele configurații | ⬜ neînceput |
| **3** | Pagina grupului: reordonare + acordeoane + cele 11 casete de pași | ⬜ neînceput |
| **4** | Terenuri în grup: atașamente + tab organizare pe apartamente | ⬜ neînceput, **cere handoff de la Lucian** |
| **5** | Atașamente generale de grup („secretariatul") | ⬜ neînceput, cere migrație + storage |

### Pasul 2, ce se știe deja

Spațiul de lucru din `index.html` are **două configurații**, iar logica e la
`index.html`, blocul „SPAȚIUL DE LUCRU" (începe pe la linia 2918):

- **Fără teren și fără grup:** `#bloc-stare` arată doi pași de intrare (adaugă teren,
  intră într-un grup) plus cuprinsul. Se randează și pentru contul nou, din 17 august.
- **Cu măcar unul dintre ele:** frază de stare („Ai 6 terenuri salvate și ești în X"),
  pasul rămas, cuprinsul.

Cardurile se declară în lista `CATEGORII` (linia ~4028), cu câmpul `cere: 'teren' | 'grup' | null`.
Cardurile care nu cer nimic: „Ce e nou", „Utilizatori compatibili", „Grupuri în zonele
tale", „Pașii până la recepție", „Notele tale".

Cei 5 pași din Word se mapează bine peste ce există: pasul 1 → cardul de terenuri,
pasul 2 → utilizatori compatibili + grupuri în zonele tale, pașii 3-5 → grupuri.
**Lista de pași din hero are acum doar 2 pași, Word-ul are 5.**

### Pasul 3, ce se știe deja

Ordinea **actuală** în `grup-details.html`:

```
Descriere → Zone preferate → Interese → Membri → Voturi excludere
→ Terenuri favorite → Anunțuri → Progresul grupului → Administrare → Invită
```

Ordinea **cerută de Lucian**:

```
Membri (casetă, cu câte zone/interese în comun are fiecare)
→ Anunțuri generale (destul de sus)
→ Cronologia pașilor (caseta deschisă pe stadiul actual)
→ Terenuri (comentarii + atașamente + tab organizare apartamente)
→ Atașamente generale de grup
→ Zone și preferințe (casete, la fund: „deja le-au văzut și e secundar")
```

**Logica de deschidere a casetelor**, cuvintele lui Lucian:

- casetă **fără nicio bifă** → închisă implicit; se poate deschide manual, apoi se
  reînchide după un timp;
- casetă **cu bife, dar nu toate** → rămâne deschisă tot timpul;
- casetă **cu toate bifele** → se închide, iar **următoarea** se deschide și rămâne așa
  până se bifează și acolo tot.

**Ce există deja în bază** (nu trebuie construit):

```
grup_checklist          bifele
grup_checklist_notes    comentarii pe pas
grup_checklist_files    atașamente pe pas
grup_teren_comments     comentarii pe teren
grup_anunturi           anunțuri generale
```

**Ce lipsește:** atașamente pe teren, atașamente generale de grup, tabela pentru
organizarea pe apartamente, și (din handoff-ul de pe 18 august) `grup_teren_checklist`
pentru pașii care se repetă pe fiecare teren candidat.

⚠️ `CHECKLIST_PHASES` din `grup-details.html` (linia ~1931) e **sursa reală** a cheilor
scrise în `grup_checklist.step_key`. Cheile existente **nu se redenumesc**, sunt legate de
bifele puse de grupuri reale.

---

## Comenzi concrete

**Ca să vezi paginile local** (Lucian rulează asta el, cu `!` în prompt; procesul pornit
de Claude în fundal e omorât între ture):

```
cd frontend; python -m http.server 8777 --bind 127.0.0.1
```

apoi `http://127.0.0.1:8777/ce-este/cum-functioneaza.html`, cu **Ctrl+Shift+R**.
Chrome ține paginile și CSS-ul în cache și arată versiunea veche fără el.

**Diff-ul, înainte de commit:**

```
git diff frontend/ce-este/cum-functioneaza.html
git diff frontend/ce-este/ce-este.css
git diff frontend/js/faq.js
```

---

## De unde continui

1. Lucian aprobă diff-ul → commit + urcat manual pe cPanel.
2. Decide dacă repar `&mdash;`-ul din `faq.js`.
3. Confirmă textul de la „Mutarea", singurul scris integral de Claude.
4. **Sesiune nouă** pentru pasul 2 (`index.html`).

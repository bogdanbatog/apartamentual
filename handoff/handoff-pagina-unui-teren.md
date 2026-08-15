# Handoff: reorganizarea paginii unui teren (`/teren-details.html`)

**Data:** 15 august 2026
**Stadiu:** ✅ construită și probată local pe baza reală. **Necomisă, neîmpinsă, nepublicată.**

⚠️ Deploy-ul se face manual din cPanel. Un push pe GitHub nu schimbă nimic pe
apartamentual.ro. (CLAUDE.md spune încă „Render face deploy automat", e depășit.)

Continuă sesiunea din 14 august, `handoff-reorganizare-pagina-terenuri.md`, punctul 2
din „Ce urmează".

---

## Fișiere atinse

| Fișier | Ce s-a întâmplat |
|---|---|
| `frontend/teren-details.css` | **nou** |
| `frontend/teren-details.html` | blocul `#teren-details` rescris; `<link>` nou în `<head>` |
| `frontend/js/teren-details.js` | galerie, panou de grupuri, inimă, descriere, status, carduri de interes |
| `NOTES.md` | două puncte deschise noi, un rând la „Rezolvate" |

**Zero atingeri** la plăți (Netopia/Oblio), la edge functions, la politicile RLS sau la SQL.

Din codul cu Supabase **nu s-a schimbat nicio interogare**: `terenuri`, `profiles`,
`grup_membri`, `terenuri_likes`, `terenuri_likes_grupuri` se citesc și se scriu exact ca
înainte, cu aceleași coloane și aceleași condiții. S-a schimbat doar ce se face cu
rezultatul.

---

## Ce s-a construit

Sursa: macheta `Pagina Teren - reorganizata.html` din
`handoff/apartamentual 03-handoff_pagina unui teren.zip`. S-au preluat **structura și
textele**, dar **îmbrăcate în tokenurile paginii de terenuri** (crem/ink, teracotă,
Mona Sans), nu în Nunito și teracota machetei. Aceeași decizie ca pe 14 august.

Trei blocuri:

1. **Antet** — galerie în stânga, în dreapta titlu, cele patru date în grilă
   (suprafață, zonă, preț total, preț pe mp), rândul cu inima și distribuirea, apoi un
   rând mic: „Adăugat de X, data · Vezi anunțul original".
2. **„Ce poți face cu terenul ăsta"** — cinci carduri: analiza preliminară (cardul mare,
   pe fundal plin), fă un grup, adaugă-l la grupurile tale, grupuri interesate,
   utilizatori interesați.
3. **Descrierea din anunțul original** — la subsol, pliată la trei rânduri.

**Mișcarea principală:** textul agentului a ieșit din antet. Stătea imediat sub titlu și,
la un anunț lung, împingea sub linia ecranului tot ce contează.

---

## Înălțimile, măsurate (nu estimate)

Același teren („Teren Carol - Rond Coșbuc 500mp", 5 poze, descriere de 740 de semne):

| Până la primul pas de făcut | Înainte | Acum |
|---|---|---|
| Telefon (390 px) | 1.619 px | **881 px** |
| Desktop (1440 px) | 867 px | **673 px** |

Descrierea, care înainte începea la 787 px pe telefon (adică prima), a coborât la 1.906 px.

Pagina e în total puțin mai înaltă (2.164 vs 1.899 px pe desktop), fiindcă blocul de
acțiuni e mai bogat decât înainte. Asta e în regulă: cine derulează până acolo caută deja
ceva anume, iar cine nu derulează are tot ce-i trebuie sus.

---

## Cele două rămășițe vechi, rezolvate

### 1. Butonul „Cere o analiză" n-avea explicație

Înainte, în tabelul de date, pe rândul „Număr apartamente", când nu exista o analiză, în
locul cifrei stătea **un buton mic și negru** care scria „Cere o analiză". Nicio vorbă
despre ce e aia, cât costă, ce primești.

Acum: rândul „Apartamente estimate" apare **doar dacă terenul are deja o analiză**, iar
cererea o face cardul mare din blocul de acțiuni, care spune tot: ce primești (șase
rânduri), cât costă (99 RON, TVA inclus) și ce trebuie să știi (adresa sau numărul
cadastral). Explicația stă lângă butonul care o cere, nu într-un ghid.

⚠️ **Măsurat pe 15 august: 0 din 46 de terenuri aprobate au `nr_apartamente_min/max`.**
Rândul „Apartamente estimate" e scris și merge, dar azi nu-l vede nimeni. Punct deschis
în `NOTES.md`.

### 2. Panoul de grupuri nu se randa deloc pentru cine nu e în niciun grup

`renderGroupLikesSection` ieșea din funcție cu `container.classList.add('hidden')` când
`userGroups.length === 0`. Adică **tocmai omul care n-are încă niciun grup** nu afla că
treaba asta se poate face.

Acum cardul există mereu, cu titlul și explicația scrise în HTML, iar din JS se scrie doar
partea de jos (`#group-likes-body`), cu trei stări:

- **nelogat** → „Ai nevoie de cont ca să adaugi terenul într-un grup" + „Intră în cont"
  (aceeași cale ca butonul din header: `openLoginModal()`, cu întoarcere la
  `/index.html?login=1` dacă funcția nu există)
- **logat, în niciun grup** → „Nu ești încă în niciun grup…" + „Vezi grupurile"
- **logat, cu grupuri** → lista lor, fiecare cu „Adaugă" / „Scoate"

Cardul dispare de tot **doar pentru conturile de agenție**, care nu sunt membre în grupuri.

---

## Un bug vechi, găsit din întâmplare

**Badge-ul de status scria „approved", în engleză, pe fiecare pagină de teren public.**

`statusMapping` din `teren-details.js` cunoștea `active`, `under_review`, `reserved`,
`sold`, `inactive`. Niciuna dintre ele nu există în baza de date. Statusurile reale sunt
`pending`, `approved`, `rejected` (vezi `admin-terenuri.html`, care le are deja traduse),
iar `terenuri.js` filtrează lista publică pe `status = 'approved'`. Codul avea o linie de
rezervă care afișa **valoarea brută** când nu găsea potrivire, deci pe toate paginile
publice ieșea cuvântul englezesc.

Reparat:

- `pending` → „În așteptarea aprobării", `rejected` → „Respins"
- `approved` → **nu se mai arată niciun semn.** Toate terenurile din listă sunt aprobate,
  deci un badge care spune același lucru peste tot nu spune nimic.
- un status necunoscut nu se mai scrie pe ecran, ca să nu mai iasă vreodată o valoare
  tehnică în fața vizitatorului.

---

## Pozele în portret nu se mai taie

Rama poziei principale e 16/10 (4/3 pe telefon), cu `object-fit: cover`. La o poză mai
înaltă decât lată, `cover` lasă din ea o fâșie din mijloc, iar la o captură de ecran de
telefon fâșia aia e adesea bandă neagră.

**Măsurat pe 15 august, pe toate cele 46 de terenuri aprobate:** 4 au poza principală în
portret (cea mai extremă 1080×2340, raport 0,46), iar alte 9 sunt aproape pătrate
(raport între 1,0 și 1,6). Peste un sfert din terenuri, deci.

Acum `potrivesteRama()` măsoară poza după ce s-a încărcat și, sub raportul 1,3, trece rama
pe `object-fit: contain`, cu fundal crem: poza se vede întreagă. Măsurarea se face la
fiecare schimbare de poză, fiindcă în aceeași galerie stau și fotografii orizontale, și
planuri cadastrale verticale.

⚠️ **Poza e deja în memoria browserului la a doua vizionare, iar atunci evenimentul `load`
nu mai vine.** De aceea `setMainImage` verifică și `imageEl.complete`, ca să măsoare pe
loc. Fără ramura aia, a doua oară când te întorci la aceeași poză rama rămâne greșită.

---

## ⚠️ Cinci capcane, toate scrise și în cod

### 1. Ce se măsoară cu `display: none` măsoară 0

Butonul „Citește mai mult" apare doar dacă textul chiar e tăiat, iar asta se află comparând
`scrollHeight` cu `clientHeight`. Prima variantă măsura din mijlocul lui
`displayTerenDetails`, **înainte** ca blocul `#teren-details` să iasă din `hidden`. Acolo
amândouă sunt 0, `0 > 0` e fals, deci „textul nu e tăiat" ieșea mereu adevărat și butonul
nu apărea niciodată, oricât de lung era anunțul.

Acum `setupDescriere` se apelează **ultima**, după `classList.remove('hidden')`, și mai are
și un retras: dacă la primul cadru înălțimea e tot 0, mai încearcă (până la cinci cadre).

### 2. Un rând gol mănâncă un rând din text

Descrierea păstrează rândurile din anunț (`white-space: pre-line`), dar **rândurile goale
se strâng** din JS (`\n{2,}` → `\n`). Fără asta, un rând gol consuma unul din cele trei
rânduri ale textului tăiat, iar cele trei puncte rămâneau singure pe el. Arăta ca o pagină
stricată.

### 3. Un nume lung de grup rupea pagina pe orizontală

Rândurile din lista „grupurile tale" sunt celule de grilă. Celulele au implicit
`min-width: auto`, adică nu au voie să fie mai înguste decât conținutul lor. Un grup cu
nume lung întindea rândul, rândul ieșea din card și **pagina întreagă căpăta bară de
derulare pe orizontală**. `grid-template-columns: minmax(0, 1fr)` pe listă și
`min-width: 0` pe rând. Abia acum se taie numele cu trei puncte, cum era scris.

### 4. Tailwind ascunde cu o singură clasă

Pagina încarcă Tailwind (CDN), `styles.css`, `css/apartamentual-v9.css` și acum
`teren-details.css`. `.hidden { display: none }` din Tailwind e o singură clasă, exact cât
regulile mele de layout (`.td-strip { display: flex }`), deci ar fi câștigat cine e scris
ultimul, imprevizibil. De aceea în foaia nouă există `.td-page .hidden { display: none }`,
cu două clase. **Toate ascunderile din JavaScript trec pe acolo.** Din același motiv, toate
clasele noi sunt prefixate `td-`: `.card`, `.badge` și `.subtitle` sunt deja luate în
`styles.css`.

### 5. `className` rescris șterge clasele puse în HTML

`displayTerenDetails` face `statusEl.className = 'badge ' + status.class`, adică **rescrie
lista întreagă**. Orice clasă pusă pe badge direct în HTML dispare la prima încărcare. De
aceea badge-ul e stilat pe ID (`.td-page #teren-status`), nu pe clasă.

---

## Decizii luate pe 15 august

- **Chips-urile de urbanism din machetă (POT, CUT, regim, deschidere, utilități) s-au
  sărit.** Nu există coloanele în `terenuri` și nici câmpurile în formularul de propunere.
  Nu s-au inventat. Punct deschis în `NOTES.md`: le adăugăm ca date adevărate, sau rămân
  în textul anunțului?
- **Cardurile „Vezi grupurile / utilizatorii interesați" rămân doar pentru cine e logat**
  (și nu e cont de agenție), ca înainte. Nelogatul nu le vede: `utilizatori.html` și
  `grupuri.html` cer oricum cont, deci l-am trimite într-o listă goală.
- **Cardul analizei e vizibil oricui**, ca și CTA-ul de pe cardul din `/terenuri.html`.
  `analize.html` se ocupă singur de autentificare. Înainte, butonul „Cere o analiză" stătea
  într-un bloc care se arăta doar celui logat.
- **Prețul se scrie „99 RON"**, ca peste tot pe site, nu „99 lei" ca în machetă.
- **Butoanele de administrare** („Modifică", „Dezactivează") au coborât la subsol, discrete,
  sub o etichetă „Administrare". Nu mai sunt albastre și roșii: le vede autorul terenului
  și superadminul, nu vizitatorul.
- **Rândul de administrare nu se mai deschide pentru `analiza_generala_status = 'pending'`.**
  Nu punea niciun buton în el, iar acum rândul are linie despărțitoare deasupra: s-ar fi
  văzut o dungă orizontală fără nimic sub ea.

---

## Ce s-a scos și de ce nu s-a pierdut nimic

- **Cutia „Informații de bază"** cu opt rânduri de tip etichetă/valoare. Cele patru date
  care contează sunt acum în grila din antet; data și autorul, în rândul de proveniență.
- **Butonul mic „Cere o analiză"** din rândul „Număr apartamente" (vezi mai sus).
- **Două bucăți de cod mort**: ascultătorii pentru `#btn-like-grup` și `#btn-share`, două
  ID-uri care nu există în pagină de multă vreme.
- **Eticheta „Distribuie:"** de dinaintea celor trei butoane. Butoanele scriu „Copiază
  link", „WhatsApp", „Facebook", deci eticheta repeta.

---

## Probele (local, pe baza de date REALĂ, 46 de terenuri)

| Probă | Rezultat |
|---|---|
| `node --check js/teren-details.js` | curat |
| consola | curată (rămâne doar avertismentul vechi de la Tailwind CDN) |
| galerie: clic pe miniatura 3 | schimbă poza mare, mută chenarul |
| modal: deschidere, săgeți, contor, închidere | 3/5 → 4/5, poza mare rămâne sincronizată |
| descriere de 740 de semne | tăiată la 79 px, butonul apare, se desface la 264 px și se strânge la loc |
| descriere de 201 de semne | fără buton, text întreg |
| teren fără descriere | secțiunea lipsește de tot (nu mai scrie „Fără descriere disponibilă") |
| teren fără poză | rama cu „Nu există imagine disponibilă", în locul galeriei |
| poză în portret (1080×2340) | rama trece pe `contain`, poza se vede întreagă |
| comutare orizontal ↔ vertical în aceeași galerie | rama se potrivește de fiecare dată, inclusiv la a doua trecere |
| „Cere analiza preliminară" | `analize.html?teren_id=…&teren_titlu=…` |
| „Fă un grup pe acest teren" | `grup-nou.html?teren=…` |
| „Vezi anunțul original", WhatsApp, Facebook, Copiază link | toate cu URL-ul corect |
| badge status | ascuns pe `approved` |
| la 390 px și la 360 px | nimic nu iese din ecran, nicio bară de derulare pe orizontală |
| listă de grupuri cu nume lung | numele se taie cu trei puncte, rândul rămâne în card |

⚠️ **Neprobat cu cont adevărat, fiindcă n-am parolă:** inima („Adaugă la profilul tău"),
adăugarea/scoaterea din grup, contoarele de interes. Stările lor au fost probate **vizual**,
cu date puse de mână în consolă, și **codul care vorbește cu baza de date nu s-a schimbat**.
De trecut o dată prin ele logat, înainte de publicare.

---

## Cum se probează local

```bash
cd C:/Users/lucia/proiecte/apartamentual/frontend
python -m http.server 8899
# apoi http://localhost:8899/teren-details.html?id=<id-ul unui teren>
```

Un `id` se ia dând clic pe orice card din `http://localhost:8899/terenuri.html`.

Pentru varianta de telefon: o pagină-ramă cu un `<iframe>` de 390 px lățime, **servită de
pe același port** (altfel e altă origine și nu se poate măsura nimic din JavaScript).
Redimensionarea ferestrei din uneltele de automatizare **nu funcționează** în mediul ăsta.

⚠️ **Browserul ține JavaScript-ul în memorie.** După o modificare în `js/teren-details.js`,
o reîncărcare obișnuită poate să ruleze tot codul vechi. Ctrl+Shift+R.

---

## Ce urmează

1. **Aprobarea diff-ului**, apoi commit + push.
2. **Deploy manual din cPanel** al celor trei fișiere: `frontend/teren-details.html`,
   `frontend/teren-details.css` (**fișier nou**, se urcă neapărat, altfel pagina rămâne
   fără stiluri), `frontend/js/teren-details.js`.
3. **O trecere logat** prin inimă, adăugare în grup și contoare (vezi mai sus).
4. **Emailul de luni 17 august**: altă treabă, e gata, vezi
   `handoff-automatizare-terenuri-noi.md`, secțiunea „CE SE FACE LUNI".

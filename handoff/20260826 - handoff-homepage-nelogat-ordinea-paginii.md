# Handoff: homepage nelogat, restul paginii

**Data:** 26 august 2026
**Fișiere:** `frontend/index.html`, `frontend/js/faq.js`, `frontend/contact.html`
**Commit:** `b1e7e97`, pe `main`. **Neîmpins pe GitHub.**
**Publicat:** ❌ NU. Live-ul e neschimbat.
**Pornit de la:** `handoff/20260825 - handoff-homepage-nelogat-primul-ecran.md` §3

---

## 1. Ce e gata

Pașii 3, 4 și 5 din ordinea de lucru a analizei (23 august, §6). Cu asta, ordinea
paginii e cea propusă în §5.3 al analizei, punct cu punct.

| # | Secțiune | Poziție (nelogat, 1440px) |
|---|---|---|
| 1 | Hero + dovada (timelapse) + bara de pătrate | 117px · 1% |
| 2 | Banda de credibilitate | 1.379px · 17% |
| 3 | **Ce câștigi** (contopit din trei blocuri) | 1.432px · 17% |
| 4 | Cum începi (două căi) **+ „Creează-ți un cont"** | 1.979px · 24% |
| 5 | **Video-ul fondatorului** | 2.768px · **33%** (era 61%) |
| 6 | Citatul familiei Tiberiu | 3.447px · 41% |
| 7 | Webinar (un singur bloc acum) | 3.782px · 45% |
| 8 | Galeria Județului | 4.358px · 52% |
| 9 | Newsletter | 4.736px · 57% |
| 10 | News | 5.296px · 64% |
| 11 | **FAQ, 6 întrebări** (erau 39) | 6.475px · 78% |
| 12 | Echipa (coborâtă aici) | 7.203px · 86% |
| 13 | Footer | 7.710px · 93% |

**Pagina:** 8.909px → **8.328px** (măsurat în browser, aceeași lățime, aceeași
stare). Cu 581px mai scurtă, dar mai important e că explicația și dovada au urcat.
(Fără caseta nouă de creat cont ar fi fost 8.158px, adică minus 751px.)

---

## 2. Ce s-a schimbat, pe rând

### 2.1. Trei blocuri de beneficii contopite în unul

Spuneau același lucru la 12%, 35% și 62% adâncime:

- „Cum a devenit posibil să construiești un apartament" (caseta în două panouri,
  cu panoul negru „Cum facem asta?")
- „Ce câștigi când construiești colaborativ?" (trei carduri)
- bullet-urile de lângă video-ul fondatorului (patru rânduri)

A rămas **formularea din „Ce câștigi"**, cea mai bine scrisă, plus al patrulea
punct nou, **„Nu ești singur"**, care răspunde la frica reală „nu știu să fac asta".
Textul lui absoarbe ce era în panoul negru (filtrarea terenurilor, coordonarea) plus
partea juridică și alegerea constructorului:

> Terenurile sunt filtrate de arhitecți. Platforma te ajută să le analizezi, ca să vezi
> ce se poate construi și la ce costuri estimative, apoi ai partea juridică, proiectarea,
> alegerea constructorului și coordonarea șantierului, la fiecare pas.

⚠️ **„filtrate", nu „analizate".** Prima variantă spunea „terenurile sunt analizate de
arhitecți înainte să ajungă pe platformă", corectat de Lucian în aceeași zi. Analiza e
serviciul plătit pe care îl ceri tu din pagina terenului, nu ceva deja făcut înainte de
listare. Înainte de listare se face doar o filtrare. Diferența nu e de nuanță: prima
variantă promitea gratuit lucrul care costă 99 RON.

Fraza despre Germania, din vechiul bloc, a devenit introducerea secțiunii noi.
Linkul „Află mai multe" a devenit „Cum funcționează, de la teren la mutare →",
tot către `/ce-este/`, dar acum spune unde duce.

**CSS:** `.avantaje` a trecut de la 3 la 4 coloane, cu o treaptă intermediară de
2 coloane sub 1000px (înainte de coloana unică de sub 768px, care exista deja).
Regulile pentru `.model-layout`, `.model-left`, `.model-right`, `.value-bullets`
și `.video-points` au fost șterse: nu le mai folosea nimic în pagină.

### 2.2. Video-ul fondatorului a urcat de la 61% la 32%

Stătea între Echipa și News. Acum e imediat după „Cum începi", cu citatul familiei
Tiberiu sub el: întâi explicația, apoi confirmarea de la un om care a trecut prin ea.

Bullet-urile de lângă el au dispărut (vezi 2.1). A rămas titlul, plus un rând nou:
„Arhitectul Lucian Luța povestește cum se formează un grup, cum se alege terenul și
cine duce partea tehnică mai departe."

⚠️ **Video-ul NU primește `js-marketing-only`, intenționat.** Regula e scrisă în
comentariul de la `.atu-logat .js-marketing-only`: cine s-a înregistrat direct de pe
o pagină de grup n-a văzut niciodată explicația modelului (187 de intrări directe în
site au fost pe pagini de grup). La fel galeria și FAQ-ul.

### 2.3. Un singur bloc de webinar

`.cta-final` (banda neagră de la 85% adâncime, „Nu rata următoarea întâlnire")
a fost ștearsă cu totul, împreună cu CSS-ul ei. Repeta cuvânt cu cuvânt îndemnul din
caseta „Nu îți vine să crezi", cu deosebirea că aproape nimeni nu ajungea până la ea.

⚠️ **În Plausible dispar evenimentele `CTA Click` cu `loc=final`** (`dest=webinar`
și `dest=povestea`). Numele evenimentului rămâne același, deci raportul nu se rupe,
dar liniile acelea două se opresc.

Linkul către povestea Județului nu s-a pierdut: e în subsolul galeriei
(„Vezi cum s-a construit, de la teren la recepție →").

### 2.4. FAQ-ul de pe homepage: 6 întrebări în loc de 39

Mecanismul, ca să nu se copieze lista în două locuri:

- `js/faq.js` are acum o listă `TOP_QUESTIONS` cu **textul exact** al celor 6 întrebări.
- Containerul de pe homepage are `data-faq-mode="top"`. Când atributul e prezent,
  `renderFAQ` cheamă `renderTopFAQ`: listă simplă, fără taburi de categorie.
- `/contact.html` **nu** are atributul, deci acolo rămân toate 39, cu taburi. Verificat.
- Casetele se randează prin `faqItemHtml()`, funcție nouă folosită de amândouă
  modurile, ca să nu existe două copii ale aceluiași HTML.

Cele 6, în ordinea în care apar obiecțiile la un om care tocmai a citit primul ecran:

1. Cu cât e mai ieftin față de un apartament de la dezvoltator?
2. Cât costă utilizarea platformei?
3. Cât durează un proiect de la formare la mutare?
4. Trebuie să am experiență în construcții?
5. Este legal modelul acesta în România?
6. Ce se întâmplă dacă un membru vrea să se retragă?

Întrebarea 2 acoperă parțial golul semnalat în handoff-ul de ieri, §2.5: rândul despre
bani a fost scos din hero, iar „ce plătesc eu aici?" n-avea răspuns nicăieri sus.
Acum are unul, dar la 77% adâncime. **Nu e același lucru cu un rând în primul ecran.**

Sub listă: „Vezi toate întrebările frecvente →" către `/contact.html#faq`.
Ancora `id="faq"` a fost adăugată în `contact.html` (n-avea).

⚠️ **Capcană nouă:** potrivirea se face pe textul exact al întrebării. O întrebare
rescrisă în `faqItems`, dar nu și în `TOP_QUESTIONS`, dispare de pe homepage. Ca să
nu fie complet tăcut, `renderTopFAQ` scrie un `console.warn` cu ce n-a găsit.

### 2.5. „Cum începi", rescrisă în jurul contului (cerut de Lucian, 26 august)

Trei schimbări, toate cerute de Lucian:

**a) Subtitlul a fost scos.** „Pornești de la un teren sau de la o zonă. Ambele duc
într-un grup." spunea exact ce scrie în cele două titluri de dedesubt și în rândul de
subsol. Trei formulări ale aceleiași propoziții, una sub alta.

**b) Caseta „Creează-ți un cont" e primul lucru din secțiune**, imediat sub titlu,
înaintea celor două căi. A stat o oră sub ele, pusă acolo ca o concluzie; e greșit,
fiindcă amândouă căile **încep** cu o acțiune care cere cont („le adaugi la profil",
„creezi un grup pe zona ta"). Contul e primul pas, nu ultimul.

Până acum, singurul buton de creat cont din toată pagina era cel mic, secundar, din
caseta de webinar, la 45% adâncime, lângă unul negru care ducea la Luma.

> Începe cu un cont. E gratuit, iar numele poate fi un pseudonim. Completezi o singură
> dată zonele care te interesează și ce fel de apartament cauți, fiindcă pe acestea se
> face potrivirea cu terenurile, cu grupurile și cu ceilalți oameni.
>
> **[ Creează-ți un cont → ]** către `/register.html`

**c) Textul spune ce completezi, nu doar „fă-ți cont".** Asta a fost cererea explicită:
omul trebuie să știe dinainte că sunt zone și preferințe de locuire, nu un formular greu.

⚠️ **Ce NU scrie în casetă, și de ce.**
- „Nu îți dai date personale" ar fi fost neadevărat: verificat în `profile-edit-new.html`,
  formularul cere și profesie, și telefon. (Numele e într-adevăr un câmp `pseudonym`, iar
  vârsta și emailul apar public doar dacă bifezi. Obligatorii pentru „profil complet" sunt
  doar camere, suprafață și zone.)
- „Nu cere acte" a stat o oră în pagină și a fost scos de Lucian: era adevărat, dar aducea
  în discuție o frică pe care omul n-o avea încă. Textul final spune doar ce se completează.

⚠️ **`js-marketing-only` e pe casetă, NU pe secțiune.** „Cum începi" rămâne vizibilă și
pentru cine e logat (intenționat, n-are clasa), dar butonul de creat cont n-are ce căuta
acolo. Verificat: `display:none` în stare logată, `display:flex` nelogat.

⚠️ **În Plausible apare o valoare nouă**: `CTA Click` cu `loc=cum-incepi` și
`dest=register`. Numele evenimentului e același, deci rămâne în raportul comun.

Rândul de subsol („Din grup, drumul continuă până la recepție…") a rămas neatins.

### 2.6. Echipa a coborât sub FAQ

Era între newsletter și News. E informație de încheiere, nu de convingere.

### 2.7. Reparațiile mici din analiză, §5.6

- **„Pe langa pretul mai accesibil"** scos din răspunsul despre avantaje. Era o
  promisiune de preț pe care n-o putem susține.
- **`prototip.html` → `/povestea-noastra.html`** în răspunsul despre proiecte în România.
- **Diacritice** puse pe cele 6 întrebări care ajung pe homepage (întrebare + răspuns).
  Restul de 33 rămân fără, e sesiunea separată de curățenie.
- Răspunsul despre legalitate nu mai promite „modele de contracte" (nu există);
  trimite la `/ce-este/legislatia-romania.html`, care există.

---

## 3. Ce am verificat, concret

- **Ordinea secțiunilor** citită din DOM, în stare nelogată simulată: e cea din tabelul §1.
- **Caseta „Creează-ți un cont":** ascunsă în stare logată, afișată nelogat.
- **Vizualul logat:** `atu-logat` pornit, spațiul de lucru afișat cu 6 carduri,
  secțiunile de marketing ascunse. Nimic din munca de pe 16-23 august nu s-a mișcat.
- **FAQ homepage:** 6 casete, se deschid una câte una, răspunsurile au diacritice.
- **FAQ contact.html:** 39 de casete, 5 taburi, ancora `#faq` merge.
- **Console:** curată, zero erori la încărcare.
- **`node --check js/faq.js`:** OK.
- **Balanța de etichete** în `index.html`: 12 `<section>` / 12 `</section>`, 2 `<style>` / 2 `</style>`.
- **Liniuța lungă „—":** zero apariții în text nou. Cele 36 din fișier sunt toate în
  comentarii, cu o singură excepție veche, vezi §5.

---

## 4. Ce a rămas de făcut

1. **Aprobarea diff-ului și commit.** Trei fișiere.
2. **Publicarea din cPanel:** `frontend/index.html`, `frontend/js/faq.js`,
   `frontend/contact.html`. Apoi **Ctrl+Shift+R** (CSS-ul și JS-ul din index sunt
   scrise în pagină, o reîncărcare simplă arată versiunea din cache).
   ⚠️ Rămâne nepublicat și commitul de ieri, `3668fb1`, tot pe `index.html`.
3. **Diacriticele din restul de 33 de întrebări** din `faq.js`. Sesiune separată.
4. **Rândul despre bani în primele două ecrane** (analiza §5.5), dacă te răzgândești.

---

## 5. Ce am găsit pe drum și n-am atins

- **`faq.js` încă vorbește despre „grupuri deschise".** Răspunsul la „Cum ma pot
  alatura unui grup existent?" spune „esti acceptat direct (grup deschis) sau dupa
  aprobarea administratorului". Contrazice decizia din 24 august: toate grupurile
  trec prin aprobarea fondatorului. Întrebarea nu e printre cele 6 de pe homepage,
  deci am lăsat-o pentru sesiunea de curățenie a `faq.js`. Aceeași problemă în
  „Pot sa imi creez propriul grup?" („statusul (deschis sau cu aprobare)").
- **O liniuță lungă rămasă în text vizibil:** `index.html:3550`,
  `var c = x.cartier || '—'` — un rând de rezervă din spațiul de lucru al omului
  logat, când terenul n-are cartier. E cod vechi, nu l-am atins, dar e singurul „—"
  din pagină pe care îl poate vedea cineva.
- **Butonul din emailul de terenuri e probabil tot negru** (`#1a1a1a`), de verificat
  înainte de trimiterea de joi 27 august.
- **Analiza de teren e descrisă acum în patru locuri, cu patru formulări diferite.**
  Erau trei (vezi memoria `explicatia-analizei-in-trei-locuri`), a apărut a patra:
  1. `index.html`, caseta „Nu ești singur": „ce se poate construi și la ce costuri estimative"
  2. `index.html:3784`, spațiul de lucru: „câte apartamente se pot construi…"
  3. `grup-details.html:2600`: „câte apartamente se pot construi aici și la ce prețuri ar ieși"
  4. `scripts/emailuri-terenuri-noi/`: „câte apartamente se pot construi acolo și la ce
     cost estimativ pe mp"

  Niciuna nu e greșită, dar nu există o sursă unică. Dacă se schimbă ce conține analiza,
  se schimbă în patru locuri sau minte unul dintre ele.

---

## 6. Comenzi

**Serverul de previzualizare** (detașat, supraviețuiește între ture):

```powershell
Start-Process -FilePath "C:\Python314\python.exe" `
  -ArgumentList "-m","http.server","8777","--bind","127.0.0.1" `
  -WorkingDirectory "C:\Users\lucia\proiecte\apartamentual\frontend" -WindowStyle Hidden
```

- pagina: `http://127.0.0.1:8777/index.html`
- ⚠️ **fereastră privată**, altfel vezi spațiul de lucru, nu pagina de marketing. Plus **Ctrl+Shift+R**.
- se oprește cu `Get-Process python | Stop-Process`

**Copia de dinaintea sesiunii** (dacă trebuie comparat ceva):
`%LOCALAPPDATA%\Temp\claude\C--Users-lucia-proiecte-apartamentual\ee11e03b-f9ce-4f09-93d7-d1123d130238\scratchpad\index.html.bak`

**Proba că nu s-a mutat nimic din greșeală:** `git diff -U0 frontend/index.html | grep "^@@"`.
Regula de ieri a ținut: toate mutările s-au făcut cu Edit pe text exact, niciun script.

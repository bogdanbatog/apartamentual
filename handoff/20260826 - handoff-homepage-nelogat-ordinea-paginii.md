# Handoff: homepage nelogat, restul paginii

**Data:** 26 august 2026
**Fișiere:** `frontend/index.html`, `frontend/js/faq.js`, `frontend/contact.html`
**Commituri:** șapte, toate pe `main` și **toate împinse pe GitHub**:

| | |
|---|---|
| `b1e7e97` | ordinea paginii, contul în „Cum începi", FAQ scurt |
| `0b0103c` | handoff |
| `4231cca` | timelapse-ul se aliniază cu restul paginii |
| `da73eaf` | ritm egal între secțiuni, 64px peste tot |
| `739f9fa` | „Nu ești singur": fraza nu se mai termină în aer |
| `35e7f8b` | experiența de la Județului Housing, sub cele patru casete |
| `8d4d9ec` | aceeași frază, la singular |

**Publicat:** ❌ NU. Live-ul e neschimbat, deployul din cPanel nu s-a făcut.
⚠️ Nepublicat e și `3668fb1` de ieri (primul ecran rescris). Urcarea le duce pe amândouă.

**Punct de întoarcere:** eticheta `homepage-nelogat-20260826`, împinsă pe GitHub.
⚠️ Ea arată spre `4231cca`, adică **înainte** de ritmul între secțiuni și de toate
schimbările de text de la „Nu ești singur". Dacă vrei punctul de salvare pe versiunea
finală, fă o etichetă nouă. La fel, `versiuni/homepage-nelogat-20260826.zip` (netrackuit)
e din aceeași stare veche.
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
> ce se poate construi și la ce costuri estimative, apoi putem face proiectare și
> coordonăm partea juridică, alegerea constructorului, ofertele și șantierul.

Sub cele patru casete, un rând care ține de toată secțiunea:

> La Județului Housing am trecut prin toate astea, ca arhitect și membru al grupului.

**Textul a trecut prin patru variante în aceeași zi. Motivele, ca să nu se refacă drumul:**

1. ⚠️ **„filtrate", nu „analizate".** Prima variantă spunea „terenurile sunt analizate de
   arhitecți înainte să ajungă pe platformă". Analiza e serviciul plătit pe care îl ceri
   tu din pagina terenului; înainte de listare se face doar o filtrare. Diferența nu e de
   nuanță: prima variantă promitea gratuit lucrul care costă 99 RON.
2. ⚠️ **Fraza nu se mai termină cu „la fiecare pas".** „…apoi ai partea juridică, […] și
   coordonarea șantierului, la fiecare pas" nu se lega de nimic. Nu o pune la loc.
3. ⚠️ **„putem face" proiectare, „coordonăm" partea juridică.** Nu „facem" nici una, nici
   alta. Grupul are voie să lucreze cu alt birou (decizia din 25 august), iar la partea
   juridică fiecare grup ar trebui să aibă propriul consilier: noi dăm modele orientative
   și pagina de legislație. Variantele respinse: „ai pe cineva lângă tine" (sună a ședință
   de terapie, cuvintele lui Lucian) și „ai juriști" (sună a serviciu inclus).
4. ⚠️ **Rândul despre Județului Housing e SUB grilă, nu în casetă**, și e la **singular**.
   - Pus întâi în casetă, o făcea de 9 rânduri față de 3 la „Tu decizi". Grila întinde
     toate casetele la înălțimea celei mai mari, deci rămânea un gol de 100px sub primele
     trei. Mutat în `.avantaje-nota`, casetele au revenit la 181px.
   - Singularul e dinadins: Lucian e cel care e și arhitect, și membru al grupului la
     Județului Housing; pluralul întindea afirmația peste toată firma.
   - **Consecință de urmărit la proba pe live:** „am trecut" se citește acum la persoana I
     singular, deși restul paginii vorbește cu „noi". Nu e greșeală de acord, e o alegere.
     Propoziția nu spune însă **cine** e „eu", iar Echipa e abia la 86% adâncime. Dacă
     sună fără stăpân, cea mai mică reparație e semnătura („Lucian Luța") după frază.
   - ⚠️ „am trecut prin toate astea", NU „am dus până la capăt" și NU „am terminat":
     blocul e în finalizare. Și NU „primul din România".

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

### 2.7. Alinierea și ritmul (găsite de Lucian, la probă)

Două probleme de aceeași natură, amândouă din marginile negative moștenite dintr-un
design mai vechi, unde blocurile „ieșeau" dinadins din coloana de text.

**a) Timelapse-ul ieșea cu 24px în fiecare parte.** `.video-ph` avea
`margin:2rem -1.5rem 0`, iar cei `-1.5rem` anulau exact `padding:0 1.5rem` de pe
`.container`. Efectul era voit cât timp filmulețul stătea la 25% adâncime, izolat între
două secțiuni. De când a urcat sub titlu (25 august) stă lipit de textul hero-ului, iar
diferența se citește ca o greșeală. Marginile negative au fost scoase.

**b) Galeria Județului era înghesuită sub linia ei ȘI avea linia mai lată.** Regula
`.img-carousel{ margin:1.5rem -1.5rem 0; padding:0 1.5rem }` făcea două rele deodată:
- `padding` scurt cu **două valori** punea padding-ul pe verticală la **zero**, anulând
  cei 4rem moșteniți de la `.section`. Titlul se lipea de linie.
- marginile negative lățeau cutia, deci și `border-top`-ul: linia de deasupra galeriei
  era cu 48px mai lungă decât toate celelalte linii din pagină.

Grila e `repeat(4, 1fr)`, nu un carusel care derulează, deci lățirea nu servea la nimic.
Regula a fost ștearsă cu totul; secțiunea folosește acum `.section`.

**c) Trei valori răzlețe de spațiere, aduse la 4rem** (căutate după ce Lucian a cerut
distanțe egale):

| | era | e acum |
|---|---|---|
| `.family-quote` (citatul lui Tiberiu) | `margin-top:3rem` (48px) | 4rem |
| `.aptbar` (bara de pătrate) | `margin-bottom:3.5rem` (56px) | 4rem |
| `.site-footer` | `margin-top:2rem`, deci linia avea 96px deasupra și 64px dedesubt | 4rem |

**Starea de acum, măsurată:** fiecare linie despărțitoare are exact 64px deasupra și
64px dedesubt, iar toate cutiile au aceeași lățime. Singura excepție e `.cred-band`,
care are 16px sus și jos: e o bandă de un rând strânsă între două linii, dinadris compactă.

⚠️ **Regula pentru sesiunile viitoare:** `padding` scris cu două valori (`padding:0 1.5rem`)
pune ZERO pe verticală și șterge tăcut ce moștenea elementul. Într-un fișier unde
`.section` dă ritmul întregii pagini, asta se vede ca „secțiunea aia arată ciudat", nu ca
o eroare. Caută `padding:0` și `margin:… -1.5rem` înainte de a bănui altceva.

### 2.8. Reparațiile mici din analiză, §5.6

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
- **Spațierea:** fiecare linie despărțitoare are 64px deasupra și dedesubt; toate cutiile
  au aceeași lățime (1052px la fereastră de 1440px).
- **Cele patru casete de beneficii:** aceeași înălțime, 181px.

⚠️ **Toate probele s-au dat pe `http://127.0.0.1:8777`, în sesiune logată, cu starea
nelogată simulată din consolă** (scos `atu-logat`, arătat hero-ul `marketing`, ascuns
`#spatiul-tau` și `#bloc-stare`). Ce NU s-a putut proba așa: **timelapse-ul nu pornește
niciodată local**, fiindcă scriptul de sesiune îi golește `src`-ul pentru cei logați.
Se verifică pe live, în fereastră privată.

---

## 4. Ce a rămas de făcut

1. **Publicarea din cPanel:** `frontend/index.html`, `frontend/js/faq.js`,
   `frontend/contact.html`. Apoi **Ctrl+Shift+R** (CSS-ul și JS-ul din index sunt
   scrise în pagină, o reîncărcare simplă arată versiunea din cache).
   ⚠️ Urcarea duce pe live și commitul de ieri, `3668fb1`, tot pe `index.html`.

   **De verificat cu ochiul, în fereastră privată, fiindcă local n-au putut fi probate:**
   - timelapse-ul se încarcă și rulează;
   - alinierea filmului și a galeriei cu restul paginii;
   - cele 6 întrebări din FAQ și linkul către `/contact.html#faq`;
   - dacă rândul „am trecut prin toate astea, ca arhitect și membru al grupului" sună
     fără stăpân, la persoana I fără nume (vezi §2.1, punctul 4).
2. **Joi 27 august: emailul cu terenuri noi**, pornit manual cu `force`. Vezi handoff-ul
   din 23 august, §7. ⚠️ De verificat înainte dacă butonul din el e tot negru (`#1a1a1a`).
3. **Diacriticele din restul de 33 de întrebări** din `faq.js`, plus cele două răspunsuri
   care încă vorbesc despre „grupuri deschise" (vezi §5). Sesiune separată, e curățenie.
4. **Rândul despre bani în primele două ecrane** (analiza §5.5), dacă te răzgândești.
5. **`notify-admins` tot nedeployat.** Restanță veche.

---

## 5. Ce am găsit pe drum și n-am atins

- **`faq.js` încă vorbește despre „grupuri deschise".** Răspunsul la „Cum ma pot
  alatura unui grup existent?" spune „esti acceptat direct (grup deschis) sau dupa
  aprobarea administratorului". Contrazice decizia din 24 august: toate grupurile
  trec prin aprobarea fondatorului. Întrebarea nu e printre cele 6 de pe homepage,
  deci am lăsat-o pentru sesiunea de curățenie a `faq.js`. Aceeași problemă în
  „Pot sa imi creez propriul grup?" („statusul (deschis sau cu aprobare)").
- **O liniuță lungă rămasă în text vizibil:** `index.html`, în scriptul spațiului de
  lucru, `var c = x.cartier || '—'` — un rând de rezervă când terenul n-are cartier
  (caută `peCartier`). E cod vechi, nu l-am atins, dar e singurul „—" din pagină pe
  care îl poate vedea cineva.
- **Eticheta din capul galeriei zice „04 IMAGINI · DERULEAZĂ →", dar nu derulează
  nimic.** Toate patru pătratele sunt vizibile deodată; ce se schimbă sunt imaginile
  din fiecare pătrat, singure. Semnalat lui Lucian, lăsat neatins.
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

**Starea nelogată, fără să te deloghezi** (probele din sesiunea asta s-au dat așa; de
lipit în consola browserului):

```js
document.documentElement.classList.remove('atu-logat');
document.querySelector('.hero[data-variant="marketing"]').removeAttribute('hidden');
document.querySelector('.hero[data-variant="a"]').setAttribute('hidden','');
['#spatiul-tau','#bloc-stare'].forEach(s=>{
  const e=document.querySelector(s); if(e) e.setAttribute('hidden','');
});
```

⚠️ Nu învie timelapse-ul: `src`-ul iframe-ului e deja golit de scriptul de sesiune.

**Punctele de întoarcere:**
- `git checkout homepage-nelogat-20260826` (stare de la `4231cca`, vezi antetul)
- `versiuni/homepage-nelogat-20260826.zip`, netrackuit, aceeași stare veche
- ⚠️ Folderul `versiuni/` NU e în `.gitignore`. Zip-ul ar intra la următorul
  `git add .`. De decis dacă se ignoră sau se ține în repo.

**Proba că nu s-a mutat nimic din greșeală:** `git diff -U0 frontend/index.html | grep "^@@"`.
Regula de ieri a ținut: toate mutările s-au făcut cu Edit pe text exact, niciun script.

# Email: „ce s-a schimbat pe platformă" (august 2026)

**Stare: DRAFT, neaprobat.** Scris 24 august 2026, pornind de la
`continut/mail anunt Modificari principale platforma.docx`.

⚠️ **Textul care se trimite efectiv este cel din
`scripts/emailuri-noutati-platforma/trimite-emailuri-noutati.js`** (funcția `continut()`).
Fișierul de față e versiunea de citit și de discutat; dacă schimbi ceva aici, schimbă și acolo.

**De ce pleacă:** tot ce s-a construit între 15 și 23 august e deja pe live. Cine se
loghează azi găsește altă platformă decât a lăsat, fără să-i fi spus nimeni.

**Lot:** conturi personale vii, cu emailul confirmat, minus echipa, conturile interne,
dezabonații de la newsletter. (Interogarea încă nescrisă.)

⚠️ Fără liniuță de dialog în corpul emailului. Fără procente de economie.

---

## Ce am verificat în cod înainte să scriu

| Afirmația din Word | Verificat în | Stare |
|---|---|---|
| Homepage logat = spațiul tău, 7 carduri | `index.html:4198-4234` | ✅ |
| Terenurile tale, cu câți sunt interesați | `index.html:3627` (`randTeren`) | ✅ |
| Utilizatori noi cu zone comune | `index.html:3521` (rândul 3 din flux) | ✅ |
| Ultimul episod + următorul webinar | `index.html:3574-3605` (rândurile 6 și 7, permanente) | ✅ |
| Pașii procesului | card `pasii`, din `js/pasi-din-ghid.js` | ✅ |
| Notele mutate din profil în spațiul tău | card `notele-tale`, `index.html:4232` | ✅ |
| Bifa „doar zonele mele" la terenuri | `terenuri.html:184-192` | ✅ |
| Cele mai noi primele | `terenuri.html:168` (`newest selected`) | ✅ |
| Trei bife de filtrare la utilizatori | `utilizatori.html:102-111` | ✅ |
| „Ai o întrebare?" în loc de „Cere consultanță" | `js/nav.js:775-787` | ✅ |
| Răspunsul scris nu costă nimic | `consultanta.html:193` | ✅ |
| Îndrumări la începutul paginii unui teren | `teren-details.html:194` | ✅ |

⚠️ **Cardurile „Terenurile tale" și „Grupurile tale" lipsesc pentru cine n-are teren sau
grup** (`cere:'teren'` / `cere:'grup'`). De asta emailul nu le promite la modul absolut,
ci spune la final ce vede cine n-are încă nimic.

---

## Subiect (variante)

1. ✅ **PROPUS** — `Ce s-a schimbat pe platformă în ultimele două săptămâni`
2. `Homepage-ul tău e acum spațiul tău de lucru`
3. `Ți-am pus grupurile, terenurile și oamenii într-un singur ecran`

Preheader: `Grupurile, terenurile și oamenii din zonele tale, într-un singur ecran.`

---

## Corp

Salut, {{nume}},

Am schimbat destul de mult pe platformă în ultimele două săptămâni. Dacă intri azi,
găsești altceva decât ai lăsat, așa că îți spunem pe scurt ce.

### Homepage-ul, după ce te loghezi, e acum spațiul tău

Într-un singur ecran vezi:

- grupurile tale și ce s-a întâmplat în ele de la ultima ta vizită
- terenurile tale, cu câți oameni și câte grupuri sunt interesate de fiecare
- utilizatorii noi înscriși care caută în aceleași zone ca tine
- pașii de urmat după ce intri într-un grup
- ultimul episod din serialul Județului Housing și data următorului webinar

Tot acolo au ajuns și notele tale, care înainte stăteau în profil.

### Cauți mai ușor

La terenuri ai o bifă „Doar terenurile din zonele mele”, iar lista începe cu cele mai noi.
La utilizatori poți bifa cine are zone comune cu tine, cine s-a înscris în ultimele două
săptămâni și cine are interese comune cu tine.

Pagina unui teren și pagina unui grup încep acum cu o scurtă introducere despre ce poți face
acolo.

### Butonul „Cere consultanță” se numește acum „Ai o întrebare?”

Suna a ofertă și nu-l apăsa nimeni. Întreabă-ne orice nu ți-e clar despre platformă sau
despre construcția în grup: răspunde un arhitect din echipă, iar răspunsul scris nu costă
nimic.

### Ce pregătim

- **În fiecare luni, un email cu terenurile noi** apărute în zonele pe care le-ai bifat.
- **Etapizarea plăților pe toată durata procesului**, pe procente și pe timp, din
  experiența de la Județului. Nu ai nevoie de toți banii deodată.
- **În grup:** o zonă cu organizarea pe apartamente și un „secretariat” al grupului, cu
  rezumat actualizat al discuțiilor și al stadiului.
- **Episoade noi din serial:** contractul de asociere, partea financiară, alegerea
  constructorului.

### Butonul

⚠️ **Terracotta (`#c2604a`), nu negru.** Schimbat pe 24 august 2026, după proba pe email.
Era `#1a1a1a`, ca butoanele de pe site, dar în clienții care afișează mesajele pe fundal
negru blocul se topea în fundal și nu se mai vedea că e un buton. Terracotta e culoarea
din logo și din linkurile emailurilor noastre, și e mijlocie: se distinge și pe cremul
nostru, și pe negru.

⚠️ **Aceeași problemă o au butoanele celorlalte campanii** din `scripts/emailuri-*`, încă
negre. Nu s-au atins.

### Finalul, în două variante după `profil_complet`

*(dacă `da`)*

> [ **Intră în spațiul tău** ] → https://apartamentual.ro
> *e chiar prima pagină, după ce te loghezi*

*(dacă `nu`. Cine are profilul neterminat NU ajunge pe homepage: `js/nav.js:716-728` îl
duce la formularul de profil de pe orice pagină. Un buton „Intră în spațiul tău” l-ar
trimite în altă parte decât scrie pe el.)*

> [ **Termină-ți profilul** ] → https://apartamentual.ro/profile-edit-new.html
> *durează două-trei minute*
>
> La tine e un pas în plus: profilul a rămas neterminat, iar până îl termini platforma te
> trimite înapoi la el de pe orice pagină. Nu e un zid pus împotriva ta. Spațiul de lucru
> se construiește din ce scrii acolo: fără orașul și zonele tale, n-are ce terenuri să-ți
> arate și n-are cu cine să te potrivească.

**Un rând în plus, doar dacă `profil_complet=da` ȘI n-are nici grup, nici teren:**

> Ce vezi acolo depinde de ce ai. Dacă n-ai încă niciun grup și niciun teren la favorite,
> cardurile lor lipsesc, iar în locul lor îți rămân noutățile din zonele tale, oamenii
> care caută unde cauți și tu, și pașii.

⚠️ Rândul ăsta e **sărit** pentru profilul neterminat, deși i s-ar potrivi. Îi spusesem
deja, cu două paragrafe mai sus, că nici nu ajunge acolo. Două explicații una peste alta
despre ce n-o să vadă fac un email care descurajează, nu unul care anunță.

Lucian și Liviu
ApartamenTUal / LTFB Studio

*Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal. Îți scriem rar, doar când se
schimbă ceva ce te privește direct. Dacă nu vrei să mai primești astfel de mesaje,
răspunde cu „stop”.*

---

## Ce am tăiat din Word și de ce

| Tăiat | Motiv |
|---|---|
| „vezi care e următorul webinar" ca punct separat | e pe același rând cu episodul, în același card |
| „call-urile pe zoom" din descrierea secretariatului | detaliu de canal, nu de folos. ⚠️ **Cuvântul „secretariat" a fost pus la loc de Lucian pe 24 august**, între ghilimele. Îl tăiasem eu fiindcă suna a produs promis; e limbajul lui de produs, rămâne. |
| „Un tab atașat unui teren pe care s-a cerut analiza preliminară" | detaliu de implementare, nu spune omului ce câștigă |
| „Abonează-te la newsletter" | primesc deja email de la noi; butonul principal trebuie să fie unul singur |
| enumerarea celor 6 puncte din spațiul de lucru, în ordinea din Word | reordonate: întâi ce e al lui (grupuri, terenuri), apoi ce e nou în jur |

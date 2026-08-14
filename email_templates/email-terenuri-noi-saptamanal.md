# Email automat: „terenuri noi în zonele tale" (săptămânal)

**PIESA 3** din automatizare. Scris 13 august 2026. ✅ **APROBAT, TURNAT ÎN COD ȘI DEPLOYAT.**
Ultima revizie: **14 august** (cârlig despre analiză sub intro; blocurile explicative mutate
la mijloc, între carduri și lista lungă). Revizia dinainte: 13 august, seara (liniuțe, buline
colorate, fără liniuță de dialog în text).
⚠️ **Revizia din 14 august e în cod, dar funcția NU e încă redeployată** la scrierea acestui rând.

⚠️ **Nu confunda cu `email-terenuri-noi-in-zonele-tale.md`.** Acela e campania **manuală**
din 3 august, trimisă o singură dată de la calculator. Aceasta e versiunea **recurentă**, care
va pleca singură în fiecare luni la 10:00. Textele diferă tocmai din cauza asta — vezi
„De ce nu se refolosește textul din august".

**Sursa datelor:** funcția `lot_terenuri_noi(now() - interval '14 days', 20, 40)`
(`db_schema/digest-terenuri/2c-functie-cu-lista-terenuri.sql`), un rând per persoană.
**Unde va trăi textul:** `supabase/functions/notify-admins/index.ts`, un `case 'terenuri_noi_zone'`
nou. Documentul de față e versiunea de citit și de discutat.

---

## De ce nu se refolosește textul din august

Campania manuală a fost scrisă ca **un eveniment**: „acum câteva zile îți scriam că...",
„tocmai am adăugat", o frază de legătură cu emailul precedent. Toate se sprijină pe faptul
că omul primea ceva rar și își amintea contextul.

⚠️ **Emailul automat ajunge la același om două-trei săptămâni la rând** (măsurat: în
săptămânile active pleacă la 20–43 de oameni din 70, cam aceiași de fiecare dată). Un text
scris ca noutate se uzează exact la a treia repetare, când începe să sune ca o reclamă.

Deci textul de mai jos e scris să fie **plictisitor în sensul bun**: constată ce a apărut,
arată, se dă la o parte. Fără cârlig, fără „nu rata", fără referințe la ce s-a mai trimis.

⚠️ **NICIO mențiune de perioadă** — nici „săptămâna asta", nici „în ultimele 7 zile".
Fereastra e **per persoană**, de la ultima trimitere către el, cu plafon la 14 zile. Dacă o
luni pică trimiterea, omul primește peste două săptămâni terenuri vechi de 12 zile, iar
„săptămâna asta" ar fi o minciună măruntă și verificabilă.

---

## Câmpuri de merge

Din funcție, un rând per om:

| Câmp | Ce conține | Exemplu |
|---|---|---|
| `nume` | pseudonimul, cu spațiile tăiate | `Andra` |
| `zona_1` … `zona_3` | zonele lui cu cele mai multe terenuri noi | `Tineretului` |
| `terenuri_1_text` | numărul din zona 1, cu acord corect | `3 terenuri noi` |
| `total_zone_cu_terenuri` | în câte zone ale lui au apărut terenuri | `2` |
| `total_terenuri` | câte terenuri noi în total, la el | `5` |
| `terenuri_lista` | **tabloul de terenuri** (jsonb), cel mai nou primul | vezi mai jos |

Fiecare element din `terenuri_lista`: `id`, `titlu`, `zona`, `oras`, `suprafata`,
`pret_total`, `pret_mp`, `ap_min`, `ap_max`, `imagine`, `adaugat_la`.

⚠️ **`ap_min` / `ap_max` sunt NULL la toate cele 46 de terenuri** (măsurat 13 august).
Nu construi niciun rând de text pe ele. Sunt în funcție pentru ziua în care se vor completa.

⚠️ **Linkul se compune în edge function**, nu în SQL:
`https://apartamentual.ro/teren-details.html?id={id}`. Verificat în `terenuri.js:432`.

⚠️ **Moneda e €**, iar prețul pe mp se **calculează** (`pret_total / suprafata`), fiindcă
așa face și pagina (`terenuri.js:335`, `:396`). Coloana `terenuri.pret_pe_mp` există în bază,
dar frontendul n-o citește — dacă emailul ar folosi-o, ar putea arăta alt număr decât pagina.

---

## Subiect

**Implicit:** `{terenuri_1_text} în {zona_1}` → *„3 terenuri noi în Tineretului"*

E factual, e util, și — important pentru un email recurent — **se schimbă singur de la o
săptămână la alta**, fiindcă se schimbă și zona, și cifra. Un subiect fix ar ajunge să arate
ca un abonament pe care omul uită că l-a cerut.

Variante, dacă vrei altceva:
2. `Terenuri noi în {zona_1}` — fără cifră
3. `{zona_1}: {terenuri_1_text}`

**Preheader:** `Le-am adăugat pe platformă de la ultimul email încoace.`

---

## TEXTUL

> **Bună, {nume},**
>
> *[o singură zonă]*
> Au apărut **{terenuri_1_text}** în **{zona_1}**, una dintre zonele pe care le-ai bifat în profil.
>
> *[mai multe zone]*
> Au apărut **{total_terenuri_text}** în **{total_zone_cu_terenuri}** dintre zonele pe care
> le-ai bifat în profil: {zona_1}, {zona_2} și {zona_3}.
>
> Pe oricare dintre ele poți cere o analiză de arhitect, ca să afli câte apartamente se pot
> construi acolo și la ce cost estimativ pe mp. Costă 99 RON, TVA inclus.
>
> [ Vezi ce conține analiza → ]  ← buton cu contur, urcat aici pe 14 august
>
> ---
>
> **[PRIMELE 3 TERENURI: dreptunghiuri cu poză]**
>
> ```
> ┌──────────────────────────────────────┐
> │            [ poza terenului ]        │
> │                                      │
> │  Teren 620 mp, Tineretului           │
> │  Tineretului · București             │
> │                                      │
> │  620 mp    ·    186.000 €            │
> │  300 €/mp                            │
> │                                      │
> │  [ Vezi terenul → ]                  │
> └──────────────────────────────────────┘
> ```
>
> ---
>
> **Ce nu scrie pe nicio pagină de teren**
>
> Suprafața și prețul le vezi și la noi, și în anunțul original. Ce nu vezi nicăieri e
> **câte apartamente se pot construi acolo și cât ar costa un apartament pe terenul acela**:
> cost pe mp construit, cost pe mp util și cât te costă terenul pentru un apartament de o
> anumită suprafață. Asta face analiza de arhitect, în mai multe variante de împărțire în
> apartamente.
> **99 RON**, TVA inclus, preț de lansare. Se comandă din pagina terenului.
>
> **Dacă vreunul îți place**
>
> Toate pornesc din pagina terenului:
>
> ● **Adaugă-l la profilul tău.** Nu te obligă la nimic, dar ceilalți văd că cineva e
>   interesat de el și te pot invita într-un grup.
>
> ● **Vezi cine mai e interesat.** Pagina îți arată câți sunt. Intri pe profilul oricăruia
>   și de acolo poți face un grup și îl inviți.
>
> ● **Vezi ce grupuri sunt interesate de el.** Dacă vreunul ți se potrivește, poți cere
>   alăturarea; odată intrat, puteți comenta chiar sub teren, pe pagina grupului.
>
> ● **Dacă ești deja într-un grup**, adaugă terenul la favoritele lui: îl vede toată lumea
>   și comentați pe el acolo.
>
> ● **Fă un grup pe terenul acesta.** Majoritatea grupurilor pornesc exact așa, de la un
>   teren pe care l-a găsit cineva primul.
>
> ---
>
> **[RESTUL TERENURILOR: linii scurte, fiecare cu link propriu]**
>
> Restul terenurilor noi, pe scurt:
>
> - **Teren 450 mp, Berceni**
>   Berceni · 450 mp · 121.000 € · 269 €/mp
> - **Teren colț, Vitan**
>   Vitan · 780 mp · 265.000 € · 340 €/mp
> - *(…)*
>
> ---
>
> [ **Vezi toate terenurile** ]  ← butonul mare
>
> Dacă acum niciunul nu ți se potrivește, nu trebuie să faci nimic. Îți scriem din nou
> când mai apar terenuri în zonele tale.
>
> Lucian
> ApartamenTUal / LTFB Studio
>
> ---
>
> *Primești acest email pentru că ai bifat în profil zonele în care ai vrea să locuiești,
> iar în ele au apărut terenuri noi. Îți scriem doar în săptămânile în care chiar apare
> ceva. Dacă nu vrei să-l mai primești, debifează „Terenuri noi în zonele mele" în
> [profilul tău](https://apartamentual.ro/profile-edit-new.html).*

---

## Deciziile luate la scrierea textului

### 1. Trei dreptunghiuri cu poză, restul linii scurte

Handoff-ul lăsa pragul deschis („se decide la scrierea textului, se mută oricând, fără SQL").
**Aleg 3.**

Media e **12 terenuri pe om**, maximul măsurat 27. Douăsprezece dreptunghiuri cu poză nu mai
sunt un mesaj, sunt un catalog pe care omul îl derulează fără să-l citească. Trei încap pe un
ecran de telefon fără derulare lungă, iar restul, ca linii de câte un rând, se citesc dintr-o
privire — omul vede **tot** ce a apărut, nu un eșantion.

⚠️ **La cei cu 1–3 terenuri nu apare deloc secțiunea de linii scurte**, iar emailul devine
foarte scurt. E în regulă și e chiar de dorit: cine caută într-o singură zonă primește un
mesaj de zece secunde.

Se schimbă dintr-o constantă în șablon (`CATE_CU_POZA = 3`). Fără SQL, fără migrație.

### 2. Prețul analizei stă într-o singură constantă

`PRET_ANALIZA` — o singură linie în șablon. ⚠️ Promoția e acum „primele 3 luni", deci pe la
**mijlocul lui noiembrie 2026** prețul se schimbă, iar emailul automat ar trimite tăcut un
preț învechit la ~62 de oameni. Cu o constantă, schimbarea e o linie.

⚠️ **Prețul mai apare în cel puțin trei locuri**: `analize.html`, `comanda-analiza.html` și
(dacă se face Piesa 5) butonul din pagina terenului. Emailul e al patrulea. **Merită o listă
scrisă a tuturor locurilor înainte de noiembrie** — altfel se schimbă trei din patru.

### 3. Ce NU promite textul

⚠️ Verificat în cod pe 13 august, iar textul e scris să nu depășească realitatea:

- ⛔ **SPUNE „Fă un grup pe terenul acesta" — ȘI BUTONUL NU EXISTĂ ÎNCĂ.** E singurul loc din
  email care promite ceva neconstruit, și e o **decizie luată în cunoștință de cauză de Lucian
  pe 13 august**: pagina terenului urmează să fie reorganizată și primește butonul (Piesa 5).
  Azi, `grup-nou.html` nu citește niciun `?teren=`, deci terenul nu vine cu omul.
  **CONSECINȚĂ DE ORDINE A LUCRĂRILOR, nu de text: emailul nu poate pleca real până când
  butonul nu e pe pagină.** Blocantele primei trimiteri sunt deci DOUĂ: Piesa 4 (bifa din
  profil, promisă în subsol) și Piesa 5 (butonul, promis aici).
- **Nu spune „filtrează pagina de terenuri după zonele tale".** Filtrul acela nu există
  (oraș + un singur cartier), iar `js/terenuri.js` nu citește parametri din URL. De asta
  emailul listează terenurile concrete: omul n-are ce filtra, are linkuri.
- **Nu spune că terenul devine „al grupului".** Butonul existent scrie în
  `terenuri_likes_grupuri` — **favoritele** grupului. Lista oficială (`grup_terenuri`) e
  altă pagină și doar pentru fondator.
- **Niciun procent de economie**, nicăieri.

✅ **„Puteți comenta pe el" e verificat** (13 august): comentariile pe terenurile favorite ale
grupului există — tabela `grup_teren_comments`, cheie (grup, teren), afișate sub fiecare teren
pe pagina grupului (`grup-details.html:1884`). ⚠️ **A nu se confunda cu `teren-notes.js`**,
care sunt note **private**, vizibile doar ție, pe propriul profil.

✅ **„Adaugă la profil" e verificat** (13 august): butonul există pe pagina terenului și scrie
în `terenuri_likes` (`teren-details.js:366`), iar pagina are și „Vezi utilizatorii interesați"
/ „Vezi grupurile interesate" (`teren-details.html:225`, `:235`).

⚠️ **De ce lista începe cu profilul și lasă grupul la urmă.** Panoul de grup din pagina
terenului **nu se randează deloc** dacă omul nu e în niciun grup (`teren-details.js:299` —
`fetchUserGroups()` întoarce gol). O listă care începe cu „adaugă-l la grupul tău" e, pentru
o parte din cititori, un text despre un buton pe care nu-l văd. „Adaugă la profil" merge pentru
toată lumea, deci stă prima, iar grupul e ultima liniuță și e explicit condiționată
(„dacă ești deja într-un grup").

### 3b. Rescrierea în liniuțe (13 august, cererea lui Lucian)

Paragraful de dinainte era un bloc de patru fraze în care se pierdea ce poți efectiv face.
Lucian a cerut: **o frază de deschidere, apoi variantele pe liniuțe.**

✅ **Toate pornesc din pagina terenului** — verificat, nu e o formulă de legătură: „Adaugă la
profil", „Vezi utilizatorii interesați", „Vezi grupurile interesate" și panoul de grupuri sunt
toate pe `teren-details.html`. De aceea fraza de deschidere poate spune exact asta, iar
liniuțele nu mai trebuie să repete fiecare „din pagina terenului". ⚠️ **A cincea va fi
adevărată abia după Piesa 5** — fraza de deschidere e scrisă la general („Toate pornesc"),
nu cu un număr, tocmai ca să nu ceară o corectură când se adaugă sau se scoate o liniuță.

✅ **„Ceilalți te pot invita într-un grup" e verificat** (13 august, adăugat la cererea lui
Lucian): cine bifează „Adaugă la profil" apare în „Vezi utilizatorii interesați", iar de pe
profilul lui oricine poate folosi „Invită într-un grup existent" / „Creează un grup și invită"
(`profile-view-new.js:993-1012`). Liniuța 1 și liniuța 2 sunt deci **aceeași mecanică, văzută
din cele două capete** — de asta stau una lângă alta.

✅ **„Poți face un grup și îl inviți" e verificat** (13 august): butonul **„Creează un grup și
invită"** există pe profilul altui utilizator (`profile-view-new.js:1012`), împreună cu invitarea
într-un grup existent. ⚠️ **Nu e în lista de utilizatori interesați** — `utilizatori.js` n-are
niciun buton de invitare (zero potriviri pe „invit"). Traseul real e: teren → „Vezi utilizatorii
interesați" → profilul omului → invitație. De asta liniuța spune „intri pe profilul oricăruia",
nu „îl inviți de acolo".

⚠️ **„Poți cere alăturarea", nu „te alături".** Butonul scrie literal **„Cere alăturarea"**
(`grupuri.js:488`, `grup-details.html:1773`) și fondatorul aprobă — grupurile sunt toate „cu
aprobare". Un email care spune „te alături" ar promite un clic acolo unde e o cerere care poate
fi refuzată.

⚠️ **Lista folosește un tabel, nu `<ul><li>`.** Outlook pe Windows ignoră `margin` pe listă și
pune indentarea lui, deci liniuțele ar fi ieșit aliniate altfel decât restul emailului.

### 3c. Bulinele iau paleta „TU"-ului (13 august, ideea lui Lucian)

Prima variantă avea em-dash-uri; a doua, buline cărămizii. Lucian a întrebat dacă pot fi
**culorile prin care se colorează „TU"-ul din apartamenTUal**. Pot, și e mai bine.

Paleta, identică în trei locuri: `index.html:2044`, `js/footer.js:279`, iar de acum și
`notify-admins` (constanta `PALETA_TU`):

```
#c2604a  cărămiziu    #5e8a6c  verde salvie    #5a7196  albastru prăfuit
#a76782  prun         #b8965c  ocru            #7a9a90  verde-cenușiu
```

Pe site culorile se rotesc la 2,2 secunde. **În email stau pe loc** — un email n-are
JavaScript — deci fiecare bulină ia altă culoare din paletă, în ordinea de acolo. Semnătura
casei, oprită într-un cadru.

⚠️ **Nu iese copilăresc fiindcă paleta e stinsă.** Cinci buline de 7px în teracotă, salvie,
albastru prăfuit, prun și ocru se citesc ca ceva gândit. Aceeași idee cu cinci culori
saturate ar fi arătat ca un meniu de copii — deci **dacă paleta se schimbă vreodată spre
tonuri vii, decizia asta trebuie recitită**.

⚠️ **PALETA E ACUM ÎN TREI LOCURI.** Emailul e singurul care nu se vede la o privire pe site,
deci e primul care rămâne în urmă.

⚠️ **Bulina e o celulă cu `bgcolor`, nu caracterul „•"** — caracterul se randează la mărimi
diferite de la un program de email la altul și își ia culoarea din font. `border-radius` e
ignorat de Outlook pe Windows, deci acolo bulinele ies pătrate; arată tot deliberat.

✅ **Culoarea e strict decorativă** — nicio liniuță nu depinde de ea ca să se înțeleagă, deci
nu se pierde nimic în citirea pe text simplu sau la cine nu distinge culorile.

⚠️ **Butoanele se văd doar logat**, iar cele două de „interesați" se ascund la conturile de
agenție (`teren-details.js` — `account_type === 'profesional'`). Destinatarii emailului sunt
oricum toți `account_type = 'activ'`, deci a doua parte nu ne atinge; prima e valabilă pentru
orice link din orice email al platformei și nu se explică în text.

✅ **REZOLVAT (13 august).** Emailul promite trei cifre: cost pe mp construit, cost pe mp util,
și **cât te costă terenul pentru un apartament de o anumită suprafață**. Primele două erau deja
pe pagină (`analize.html:507`); **a treia nu apărea nicăieri în lista de livrabile**, deci
emailul promitea mai mult decât pagina. Lucian a confirmat că analiza **chiar dă** cifra, iar
`analize.html` a primit rândul lipsă. Cele două spun acum la fel.

🟡 **RĂMÂNE: pagina de exemplu.** `analiza-simplificata.html` arată patru imagini ale paginilor
PDF-ului real (`assets/analize-exemple/simpla-1..4.jpg`). Ca să apară și acolo costul terenului
pe apartament, e nevoie de **PDF-ul nou, exportat din nou ca imagini** — nu e o schimbare de
cod. Până atunci, exemplul arată un raport fără cifra pe care pagina o promite.

### 3d. Ordinea blocurilor, schimbată pe 14 august (cererea lui Lucian)

**Problema pusă de Lucian:** blocurile explicative stăteau la coada emailului, după toate
terenurile. Cine are 27 de terenuri are înaintea lor trei carduri cu poză plus douăzeci și
patru de rânduri de listă. Practic, partea care spune *ce poate face omul* era acolo unde nu
ajunge nimeni.

**Ce s-a schimbat, două lucruri:**

1. **Cârlig sub intro**, o singură frază, înainte de terenuri: „Pe oricare dintre ele poți cere
   o analiză de arhitect, ca să afli câte apartamente se pot construi acolo și la ce cost
   estimativ pe mp. Scrie mai jos ce conține și cât costă."
   **Prețul apare și în cârlig** (decizia lui Lucian, 14 august). Ca să nu sune insistent,
   e anunțat o singură dată: în cârlig scrie „Costă 99 RON", iar mai jos e o linie de fapt,
   „99 RON, TVA inclus, preț de lansare", care adaugă informație în loc să repete anunțul.
   ⚠️ În șablon rămâne **o singură constantă** (`PRET_ANALIZA`), folosită în ambele locuri,
   deci schimbarea din noiembrie e tot o linie, nu două.
2. **Blocurile explicative au urcat la mijloc**, între carduri și lista lungă.
3. **Butonul „Vezi ce conține analiza" a urcat lângă cârlig**, înaintea cardurilor (a doua
   cerere a lui Lucian, tot pe 14 august). ⚠️ **Cârligul s-a rescris odată cu mutarea:**
   se termina cu „scrie mai jos ce conține", ceea ce devenea o contradicție cu butonul pus
   chiar sub el. Acum se termină cu „Costă 99 RON, TVA inclus."
   ⚠️ **Butonul e unul singur, nu doi.** Blocul de la mijloc a rămas fără buton: explică în
   detaliu și se încheie cu „Se comandă din pagina terenului", iar linkurile către terenuri
   sunt chiar deasupra lui.

**Ordinea de azi:** salut → intro → cârlig → butonul analizei → 3 carduri →
„Ce nu scrie pe nicio pagină de teren" → „Dacă vreunul îți place" + cele 5 liniuțe →
restul terenurilor, pe scurt → butonul mare → semnătură → subsol.

**Consecințe de ținut minte:**

- „Și restul, pe scurt:" a devenit **„Restul terenurilor noi, pe scurt:"**. „Și restul" se
  sprijinea pe cardurile de deasupra, care acum sunt despărțite de două blocuri de text.
- ⚠️ **La cine are 1–3 terenuri, lista lipsește cu totul**, deci emailul se termină cu blocurile
  explicative, exact ca înainte. Schimbarea se vede doar la cei cu multe terenuri, adică fix la
  cine avea problema.
- Cardurile rămân **primele** după intro. Materialul e motivul pentru care omul deschide emailul;
  dacă explicațiile ar urca deasupra terenurilor, ar deveni un email despre serviciile noastre,
  cu terenurile la coadă.

### 4. Semnat „Lucian", deși pleacă automat

E semnătura din campania manuală și din restul emailurilor. Un email automat semnat cu numele
firmei sună a robot; unul semnat cu numele tău e o promisiune că cineva răspunde dacă omul
răspunde. ⚠️ **Deci `reply-to` trebuie să fie o adresă citită de un om**, altfel semnătura e
o minciună mică repetată săptămânal.

### 5. Dezabonarea e din profil, nu „răspunde cu stop"

Campania manuală folosea „stop" fiindcă n-avea unde trimite omul — bifa nu exista. Acum
există (`profiles.email_terenuri_noi`), deci subsolul duce la pagina de profil, ca la digestul
de anunțuri. ⚠️ **Bifa din profil e Piesa 4 și încă nu e construită.** Textul de față o
presupune — dacă emailul pleacă înainte de Piesa 4, subsolul trimite omul către o pagină unde
nu găsește ce i se promite.

---

## ✅ Deciziile lui Lucian (13 august)

1. **Trei dreptunghiuri cu poză**, restul linii scurte. `CATE_CU_POZA = 3`.
2. **Prețul se scrie `99 RON`, TVA inclus — preț de lansare.** (Revenire pe 13 august: prima
   variantă scria „99 lei", simplu. Lucian a cerut mențiunea completă.)
   - **`99 RON`, nu `99 lei`** — exact scrierea de pe site (`analize.html:494`,
     `comanda-analiza.html:386`). Prima variantă era singurul loc care spunea altfel.
   - **„TVA inclus" e verificat**, nu presupus: `analize.html:495` scrie „TVA 21% inclus în
     preț", iar `comanda-analiza.html:387` „TVA inclus".
   - Două constante alăturate în șablon: `PRET_ANALIZA` și `PRET_MENTIUNE`.

   ✅ **ALINIAT PE TOT SITE-UL (13 august).** Înainte erau trei formulări pentru aceeași
   reducere. `servicii.html:292` spunea deja „99 RON este prețul de lansare, cu TVA inclus" —
   deci „preț de lansare" nu e un termen nou, e cel care exista deja, iar restul erau
   excepțiile. Schimbate:

   | Fișier | Înainte | Acum |
   |---|---|---|
   | `analize.html:495` | „TVA 21% inclus în preț" | „TVA 21% inclus în preț · **preț de lansare**" |
   | `comanda-analiza.html:389` | badge „PROMOȚIE PRIMA LUNĂ" | badge „**PREȚ DE LANSARE**" |
   | `analiza-simplificata.html:335` | „Promoție: 99 RON prima lună" | „**Preț de lansare: 99 RON**" |
   | `servicii.html:292` | — | neatins, spunea deja așa |

   ⚠️ **Prețul propriu-zis (99 / 149 RON) rămâne scris de mână în 8 locuri** din frontend —
   nu l-am centralizat, doar am unificat *eticheta*. La schimbarea prețului, caută `99 RON`
   și `149` în `frontend/`, plus constantele din șablonul de email.
3. **Rămâne butonul mare** „Vezi toate terenurile" → `/terenuri.html`.
4. **Rămâne și linkul** „Vezi grupurile deschise" în paragraful despre grupuri.
5. **Buton secundar „Vezi ce conține analiza"**, sub paragraful despre analiză (cerut de Lucian).
   ⚠️ **Duce la `analize.html`, NU la `comanda-analiza.html`.** Formularul de comandă merge și
   fără teren (`teren_id` e doar pre-completare, `comanda-analiza.js:63`), dar atunci omul
   trebuie să scrie singur linkul terenului într-un câmp gol — iar în momentul ăla din email
   încă n-a ales niciun teren. `analize.html` explică ce primește și duce mai departe la comandă.
   E **secundar** (contur, nu plin) ca să nu concureze cu „Vezi toate terenurile" de dedesubt.

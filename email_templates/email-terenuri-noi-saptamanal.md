# Email automat: „terenuri noi în zonele tale" (săptămânal)

**PIESA 3** din automatizare. Scris 13 august 2026. 🟡 **TEXT DE APROBAT — încă neturnat în cod.**

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
> ---
>
> **[PRIMELE 3 TERENURI — dreptunghiuri cu poză]**
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
> **[RESTUL — linii scurte, fiecare cu link propriu]**
>
> Și restul, pe scurt:
>
> - **Teren 450 mp, Berceni** — Berceni · 450 mp · 121.000 € (269 €/mp)
> - **Teren colț, Vitan** — Vitan · 780 mp · 265.000 € (340 €/mp)
> - *(…)*
>
> ---
>
> **Ce nu scrie pe nicio pagină de teren**
>
> Vezi suprafața și prețul — și la noi, și în anunțul original. Ce nu vezi nicăieri e
> **câte apartamente se pot construi acolo și cât ar costa un apartament pe terenul acela**:
> cost pe mp construit, cost pe mp util și cât te costă terenul pentru un apartament de o
> anumită suprafață. Asta face analiza de arhitect, în mai multe variante de împărțire.
> Costă **99 RON**, TVA inclus — preț de lansare. Se comandă din pagina terenului.
>
> [ Vezi ce conține analiza → ]  ← buton secundar, contur
>
> **Dacă vreunul îți place**
>
> Din pagina terenului îl poți adăuga la profil — nu te obligă la nimic, iar acolo vezi și
> cine s-a mai arătat interesat, oameni și grupuri. Dacă ești într-un grup, îl poți adăuga și
> la favoritele grupului: îl vede toată lumea și puteți comenta pe el, chiar sub teren, pe
> pagina grupului. Iar dacă încă nu ești într-un grup: majoritatea pornesc exact așa, de la
> un teren pe care l-a găsit cineva primul. [Vezi grupurile deschise →]
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

- **Nu spune „creează un grup pe terenul ăsta".** `grup-nou.html` nu primește niciun
  `?teren=`; omul ar crea grupul și ar constata că terenul n-a venit cu el. De aceea fraza e
  „grupurile pornesc de la un teren", care e adevărată, nu un buton care nu există.
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

⚠️ **De ce paragraful începe cu profilul, nu cu grupul.** Panoul de grup din pagina terenului
**nu se randează deloc** dacă omul nu e în niciun grup (`teren-details.js:299` —
`fetchUserGroups()` întoarce gol). Un paragraf care începe cu „adaugă-l la grupul tău" e, pentru
o parte din cititori, un text despre un buton pe care nu-l văd. „Adaugă la profil" merge pentru
toată lumea, deci stă primul, iar grupul vine ca treaptă a doua.

⚠️ **UN LUCRU DIN EMAIL NU E ACOPERIT DE `analize.html`.** Emailul promite trei cifre:
cost pe mp construit, cost pe mp util, și **cât te costă terenul pentru un apartament de o
anumită suprafață**. Primele două sunt exact ce scrie pagina (`analize.html:507` — „un preț
estimat pe metru pătrat construit și util"). **A treia nu apare nicăieri în lista de
livrabile.** Formularea e cerută de Lucian pe 13 august, deci rămâne — dar atunci **pagina
trebuie completată cu același rând**, altfel emailul promite mai mult decât pagina, iar omul
care compară le găsește în contradicție. 🟡 **`analize.html` NEMODIFICAT deocamdată.**

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

   ⚠️ **„Preț de lansare" e a treia formulare pentru aceeași reducere.** Pe site sunt deja
   două: `analize.html` arată doar `149` tăiat → `99 RON`, fără etichetă, iar
   `comanda-analiza.html:389` are badge-ul **„PROMOȚIE PRIMA LUNĂ"** — care e și învechit
   (promoția a devenit „primele 3 luni" pe 13 august) și diferit de ce spune emailul.
   🟡 **Niciuna dintre cele două pagini nu a fost modificată.**
3. **Rămâne butonul mare** „Vezi toate terenurile" → `/terenuri.html`.
4. **Rămâne și linkul** „Vezi grupurile deschise" în paragraful despre grupuri.
5. **Buton secundar „Vezi ce conține analiza"**, sub paragraful despre analiză (cerut de Lucian).
   ⚠️ **Duce la `analize.html`, NU la `comanda-analiza.html`.** Formularul de comandă merge și
   fără teren (`teren_id` e doar pre-completare, `comanda-analiza.js:63`), dar atunci omul
   trebuie să scrie singur linkul terenului într-un câmp gol — iar în momentul ăla din email
   încă n-a ales niciun teren. `analize.html` explică ce primește și duce mai departe la comandă.
   E **secundar** (contur, nu plin) ca să nu concureze cu „Vezi toate terenurile" de dedesubt.

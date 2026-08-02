# Email: „au apărut terenuri noi în zonele tale"

⚠️ **Textul care se trimite efectiv este cel din
`scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js`** (funcția `continut()`).
Fișierul de față e versiunea de citit și de discutat; dacă schimbi ceva aici, schimbă și acolo.

**Sursa datelor:** `db_schema/terenuri-noi/4-lot-destinatari.sql` — un rând per persoană.
**Lot:** utilizatori reali care au **cel puțin o zonă bifată în care a apărut un teren nou**
și **cel mult 12 zone bifate** în total (prag decis de Lucian, 2 august 2026 — cine a bifat
jumătate de București nimerește oricum o potrivire, deci „în zonele tale" ar suna fals).

Câmpuri de merge (numele coloanelor din interogarea 1):

| Câmp | Ce conține | Exemplu |
|---|---|---|
| `{{nume}}` | pseudonimul, cu spațiile tăiate | `Andra` |
| `{{zona_1}}` | zona lui cu cele mai multe terenuri noi | `Tineretului` |
| `{{terenuri_1_text}}` | numărul, cu acord corect | `3 terenuri noi` |
| `{{total_zone_cu_terenuri}}` | în câte zone ale lui au apărut terenuri | `2` |
| `{{total_terenuri}}` | câte terenuri noi în total, la el | `5` |

⚠️ **NU folosi `{{prenume}}`** — `first_name` e gol la toți. Numele vine din `pseudonym`.

---

## Subiect (variante)

1. ✅ **IMPLICIT** — `{{terenuri_1_text}} în {{zona_1}}` → *„3 terenuri noi în Tineretului"*
2. `Au apărut terenuri noi în zonele pe care le urmărești`
3. `{{zona_1}}: {{terenuri_1_text}}`

Preheader: `Le-am adăugat săptămâna asta pe platformă.`

> **Notă despre alegerea implicită.** La campania din 28 iulie ai ales varianta *fără* cifră
> în subiect. Acolo cifra era despre **oameni** („20 de oameni"), ceea ce putea suna a
> presiune. Aici cifra e despre **terenuri** — e o informație factuală și utilă, motiv real
> să deschidă emailul. De aceea implicit e varianta 1. Se schimbă cu `--subiect=2`.

---

## Două deschideri, după cine a mai primit ceva de la noi

Emailul are **două variante de prim paragraf**, alese automat de script. Nu trebuie să faci
nimic manual: scriptul citește jurnalul campaniei precedente
(`scripts/emailuri-zone/local/trimise-2026-07-28.json`) și decide singur. La lotul din
2 august 2026: **29 cu fraza de legătură, 9 fără**.

**A) Cei care au primit și emailul din 28 iulie** („în zona ta nu s-a pornit niciun grup").
Fără deschiderea asta, al doilea mesaj în câteva zile pare venit din senin:

> Acum câteva zile îți scriam că în zonele pe care le-ai bifat nu se pornise încă niciun
> grup. Între timp au apărut terenuri, iar o parte sunt exact acolo:

**B) Oamenii noi**, care n-au primit nimic până acum. Ei n-au ce să-și amintească, deci
orice referință la „îți scriam" ar suna fals:

> Când ți-ai făcut contul ai bifat zonele în care ai vrea să locuiești. Am adăugat terenuri
> noi pe platformă și o parte sunt exact acolo:

Formularea e „acum câteva zile", nu „săptămâna trecută": campania pleacă la câteva zile
după cea din iulie, iar dacă se amână cu o zi-două textul rămâne adevărat.

Cu `--fara-precedent` primesc toți varianta B.

---

## Corp

Salut, {{nume}},

*(aici vine deschiderea A sau B, după caz)*

> {{zone_pentru_email}}

*(exemplu de cum se completează:*
> *Tineretului: 3 terenuri noi*
> *Aviației: 2 terenuri noi)*

*(dacă are mai mult de 3 zone cu terenuri, aici vine în plus rândul:*
> *Și încă 2 zone bifate de tine au primit terenuri.)*

Ce sunt, ca să știi de la început la ce te uiți: terenuri de vânzare pe care le-am strâns
noi într-un singur loc, cu suprafața, prețul și prețul pe mp puse cap la cap, ca să nu cauți
tu prin zeci de anunțuri. **Nu sunt rezervate și nu sunt ale noastre.**

Dacă vreunul ți se pare bun, îl poți **adăuga la profil**. Nu te obligă la nimic: e felul în
care platforma află că terenul te interesează. Tot acolo vezi cine s-a mai arătat interesat
de el, oameni și grupuri.

Iar dacă vrei să mergi mai departe, poți **porni un grup** și lega de el terenurile care vă
plac. Cam așa începe de fiecare dată: câțiva oameni care caută în același loc și un teren
care le place tuturor.

👉 **[Vezi terenurile](https://apartamentual.ro/terenuri.html)**

Dacă niciunul nu ți se potrivește, e în regulă: rămâi cu zonele bifate și îți scriem când
mai apar.

Lucian
ApartamenTUal / LTFB Studio

---

*Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal și ai bifat aceste zone ca zone
de interes. Dacă nu vrei să primești astfel de anunțuri, răspunde la acest email cu „stop"
și nu-ți mai scriem.*

---

## Variantă pentru cine are o singură zonă cu terenuri

Pentru cei cu `{{total_zone_cu_terenuri}} = 1`, tabelul cu un singur rând arată sărăcăcios,
deci dispare cu totul și zona intră în frază. Și aici sunt două deschideri:

**A) a primit emailul din iulie:**

> Acum câteva zile îți scriam că în **{{zona_1}}** nu se pornise încă niciun grup. Între
> timp am adăugat **{{terenuri_1_text}}** exact acolo.

**B) om nou:**

> Ai bifat **{{zona_1}}** printre zonele în care ai vrea să locuiești. Tocmai am adăugat
> **{{terenuri_1_text}}** exact acolo.

Restul emailului rămâne identic.

---

## De verificat înainte de trimitere

- [ ] **`db_schema/terenuri-noi/2-potriviri-ratate.sql` iese GOL** — altfel unele terenuri
      nu se potrivesc pe nicio zonă și cifrele din email sunt mai mici decât realitatea,
      fără nicio eroare vizibilă
- [ ] toate cele 19 terenuri au status `approved` (cele `pending` nu se văd public — n-are
      sens să anunțăm ceva ce omul nu poate deschide)
- [ ] cifrele re-rulate în ziua trimiterii
- [ ] fără procente de economie în text
- [ ] test pe adresa ta înainte de lot
- [ ] adresele care au cerut „stop" după campania din 28 iulie sunt trecute în `--fara=`

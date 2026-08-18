# Handoff, 18 august 2026: lista unică de pași (analiză, nimic implementat)

**Sesiune de analiză, fără nicio modificare pe disc.** Zero fișiere atinse, zero
commituri. Tot ce s-a produs e în documentul ăsta. Sesiunea s-a închis pentru că
i-a picat bateria lui Lucian, nu pentru că am terminat.

---

## Starea la închiderea sesiunii

| | |
|---|---|
| Fișiere modificate | **niciunul** |
| Commituri | **niciunul** |
| Migrații rulate | **niciuna** |
| Ce rămâne de decis | 3 întrebări, mai jos la „Decizii blocante" |
| Ce urmează după decizii | scrierea celor ~40 de pași la nivel de text (≈4.000 de cuvinte) |

---

## Partea 1: cum funcționează digestul de anunțuri (întrebare lămurită, fără cod)

Prima parte a sesiunii a fost o întrebare, nu un task. Răspunsul, pe scurt, ca
să nu se recitească tot codul data viitoare:

- `pg_cron` cheamă `digest-anunturi-grup` **din oră în oră**, nu o dată pe zi.
  Funcția verifică ea dacă la București e ora 19 (`ORA_TRIMITERII`, linia 54).
  23 din 24 de execuții răspund „nu e ora potrivită". E normal.
- Fereastra nu e „ziua de azi", ci „de la ultimul digest al grupului încoace",
  cu plasă de 7 zile. Dacă o seară eșuează, anunțurile intră în digestul de mâine.
- Destinatari: `grup_membri` cu `status = 'activ'`, minus cei fără profil, minus
  `account_status = 'deleted'`, minus `is_demo`, minus cei cu
  `email_anunturi_grup = false`, minus autorul dacă a scris doar el.
- Trimiterea o face `notify-admins`, un singur apel per grup, cu `recipient_user_ids`.
  Acolo lista devine **câte un email separat per adresă** (`index.ts:1924`), ca
  membrii să nu-și vadă adresele unii altora.
- **Superadminul primește copie** (`SUPERADMIN_CC_ALWAYS`, `index.ts:84`), o
  singură dată per grup, printr-o trimitere separată. Adăugat pe 13 august.
  Plus mesaj pe Slack în `#app_events`, tot unul per grup.

**Rămas de făcut, neatins:** rularea scriptului `db_schema/digest-terenuri/0e-control-digest-anunturi.sql`
(strict SELECT), care confirmă dacă sarcina programată a trimis vreodată singură,
nesupravegheat. Lucian a fost întrebat de două ori, n-a apucat.

---

## Partea 2: lista unică de pași (subiectul principal)

### Ce a cerut Lucian

Să existe **o singură listă de pași**, folosită identic în trei locuri: ghidul
public „Cum funcționează", homepage-ul utilizatorului logat și pagina unui grup.
Lista trebuie să fie **cea mai detaliată și cea mai completă** dintre cele existente.
Abia după ce lista e înghețată se trece la restul lucrurilor cerute pentru pagina
de grup (vezi „Partea 3").

### Ce am găsit: patru liste, nu trei

| # | Fișier | Structură | Observație |
|---|---|---|---|
| 1 | `frontend/ce-este/cum-functioneaza.html` | diagramă (4 faze) **+** text detaliat dedesubt | diagrama și textul de pe aceeași pagină nu se potrivesc între ele |
| 2 | `frontend/index.html:3506` | `FAZE`, 27 de pași | copie a listei din grup, fără `_alte_note` |
| 3 | `frontend/grup-details.html:1931` | `CHECKLIST_PHASES`, 27 + 3 note | **sursa reală**; cheile se scriu în `grup_checklist.step_key` |
| 4 | `frontend/_macheta-spatiu-lucru.html:551` | 26 de pași, reformulați | machetă netrackuită, dar **cea mai bună versiune de până acum** |

Lista 4 are deja corecturi pe care celelalte nu le au: dirigintele de șantier,
certificatul de urbanism de construire cerut înainte de cumpărare, formularea
„preliminară/detaliată".

### Contradicțiile găsite

1. **Numele analizelor.** Platforma vinde „Analiză preliminară" și „Analiză
   detaliată" (`analize.html:493` și `:552`). Checklistul din grup și homepage
   spun „Analiză **generală**" și „Analiză **complexă**". Omul bifează un pas și
   caută pe site un produs cu numele acela, care nu există.
   → Se corectează **doar textul**. Cheile `f2_analiza_generala` și
   `f2_analiza_complexa` rămân cum sunt, nu le vede nimeni și schimbarea lor ar
   cere migrare pe `grup_checklist`.

2. **Ordinea concept ↔ certificat de urbanism, în faza 3.** Ghidul spune
   concept → CU de construire, cu explicația corectă („arhitectul va anexa un
   plan de situație cu amplasamentul propus în urma discuțiilor din faza de
   concept"). Checklistul le are invers. **Ghidul are dreptate.**

3. **Certificatul de urbanism de construire apare de două ori**, în faza 2
   (varianta din machetă și din mesajul lui Lucian) și în faza 3. Un CU e valabil
   12-24 de luni, deci s-ar putea să fie unul singur. → decizie blocantă, mai jos.

4. **Regulamentul de grup apare în două faze.** Faza 1 („Regulament de
   funcționare") și diagrama din ghid îl mai pune o dată în faza 4 („Regulament
   comunicare grup / decizii"). Se ține doar în faza 1.

5. **Trei ordini diferite în faza 2.** Ghid-text: caută → CU informare → extras CF
   → vizită. Ghid-diagramă: caută → analiză → extras CF → vizită. Checklist:
   identificare → vizite → extras CF → CU informativ.
   → Se păstrează ordinea checklistului: vizitezi întâi, e gratis, abia apoi
   cheltui pe acte.

6. **Faza 4 nu se acoperă între surse.** Ghidul are „centralizați cheltuielile" și
   „monitorizați execuția", checklistul are structură/instalații/finisaje.
   → Primele două nu sunt pași, sunt practici continue. Rămân în textul ghidului,
   nu intră în listă.

### Ce lipsea din toate patru, deși e scris pe `legislatia-romania.html`

- **Intabularea și apartamentarea.** Lista se termina la „Recepție 🏠", dar
  recepția nu te face proprietar pe apartament. E fix promisiunea proiectului și
  nu apărea ca pas nicăieri.
- **Dirigintele de șantier.** Obligatoriu prin HG 343/2017. Doar în machetă.
- **PUD, dacă primăria îl cere.** Adaugă 6-8 luni la calendar.
- **Varianta de finanțare** (aport propriu treptat vs. credit individual).
  Determină cine poate intra în grup.
- **Verificarea tehnică a proiectului** (Legea 10/1995). Ca subtitlu la proiectul
  tehnic, nu ca pas separat.
- **Discuția la urbanism, în primărie**, pe configurația din analiză. Recomandată
  în ghid, nu era pas.

### Problema de structură (cea mai importantă descoperire)

Lista actuală amestecă două axe diferite:

- **pași ai grupului**, care se fac o dată: regulament, contract de asociere, constructor;
- **pași pe fiecare teren candidat**, care se repetă: vizită, negociere preț,
  vecini, extras CF, notar, CU de construire, foraj, analiză.

Acum toți stau la grămadă în faza 2, ca pași unici. Dacă grupul urmărește trei
terenuri, bifa „Extras carte funciară obținut" nu spune pentru care teren. Iar
Lucian cere exact separarea asta pentru pagina de grup („fiecare tab de teren
conține și alți pași").

→ Faza 2 se sparge în **2A, pași de grup** și **2B, pași pe fiecare teren**.
**Asta e singura schimbare care cere muncă la baza de date** (tabelă nouă, gen
`grup_teren_checklist`, cu `grup_id + teren_id + step_key`). Restul e text.

---

## Lista unificată propusă (29 pași de grup + 11 pe fiecare teren)

Pașii marcați `NOU` nu există în nicio listă actuală.

### FAZA 1. Formarea grupului (2-6 luni)
1. În formare
2. Regulament de funcționare *(comunicare, luarea deciziilor, responsabilități)*
3. Principii și scopuri comune agreate *(calitatea construcției, eficiența termică și fonică, instalațiile, arhitectura)*
4. `NOU` Bugetul fiecăruia și varianta de finanțare, discutate *(aport propriu în tranșe sau credit individual pentru construcție)*
5. Grup format *(orientativ 4-8 familii)*

### FAZA 2A. Căutarea terenului, pași de grup (3-12 luni)
1. `NOU` Criterii de căutare stabilite *(zonă, suprafață, buget, număr de apartamente)*
2. Faza de identificare a terenurilor
3. `NOU` Terenul ales de grup
4. `NOU` Organizarea pe apartamente convenită *(cine ia ce, cotele indivize)*
5. Contract de asociere, întocmit de avocat și legalizat la notar
6. Achiziționarea terenului

### FAZA 2B. Pașii pe fiecare teren candidat `STRUCTURĂ NOUĂ`
1. Vizită pe teren, cu concluzii scrise
2. `NOU` Discuție cu proprietarul: preț, marjă de negociere, rezervare
3. Vecinii verificați *(calcane, acorduri necesare la autorizare)*
4. Extras de carte funciară obținut *(ANCPI online)*
5. Certificat de urbanism informativ
6. Acte și istoric verificate la notar
7. Analiză preliminară cerută pe platformă *(câte apartamente încap, costuri estimative)*
8. `NOU` Discuție la urbanism, în primărie, pe configurația propusă
9. `NOU` Certificat de urbanism pentru construire, depus de proprietar, cu propunerea grupului
10. Studiu geotehnic preliminar *(1-2 foraje)*
11. Analiză detaliată cerută *(planuri, suprafețe, randări, cote indivize)*

### FAZA 3. Proiectarea (6-12 luni)
1. Echipă de proiectanți selectată *(arhitectură, structură, instalații)*
2. Faza concept *(planuri, suprafețe finale pe apartament și spații comune, randări)*
3. Certificat de urbanism pentru construire *(sau confirmarea că cel obținut înainte de achiziție e valabil)* — **ordinea corectată: după concept**
4. `NOU` Studii de teren: topografic și geotehnic complet
5. `NOU` PUD, dacă primăria îl cere *(adaugă 6-8 luni)* — opțional
6. Avizele cerute prin certificatul de urbanism
7. Proiect tehnic, verificat tehnic, plus oferte de la constructori
8. DTAC și autorizația de construire *(recomandat după proiectul tehnic)*
9. Detalii de execuție

### FAZA 4. Construcția și intrarea în proprietate (12-24 luni)
1. Oferte de execuție actualizate și comparate
2. Constructor selectat *(antrepriză generală sau executanți contractați separat)*
3. `NOU` Diriginte de șantier ales
4. Execuție structură
5. Execuție instalații
6. Execuție finisaje
7. `NOU` Recepția la terminarea lucrărilor *(proces-verbal, cu comisie)*
8. `NOU` Intabularea și apartamentarea *(fiecare apartament primește număr cadastral propriu)*
9. Te muți în casa ta 🏠

---

## Forma sursei unice: trei niveluri per pas

Observația lui Lucian la finalul sesiunii: **lista de mai sus e doar schelet.**
„Oamenii nu înțeleg din niște titluri." Corect, e nivelul de checklist.

Deci fiecare pas are trei câmpuri, iar fiecare pagină afișează cât îi trebuie:

| Nivel | Ce e | Unde se vede |
|---|---|---|
| `titlu` | 3-8 cuvinte | bifa din grup, cardul de pe homepage |
| `sub` | o linie, contextul minim | sub bifă, în grup |
| `explicatie` | un paragraf adevărat, 60-110 cuvinte | ghidul public; în grup, la desfășurarea pasului |

Asta rezolvă și problema veche: azi explicația bună există doar în
`cum-functioneaza.html`, adică departe de omul care trebuie să bifeze pasul.
(Vezi memoria `educarea-se-face-punctual`.)

### ✅ TEXTUL COMPLET E SCRIS: `continut/pasi-proiect.md`

**Densitatea și tonul au fost aprobate de Lucian pe 18 august**, pe cei patru pași de
probă de mai jos. Restul de 36 au fost scriși imediat după, în același tipar, și stau
în **`continut/pasi-proiect.md`**: toți cei 40 de pași, fiecare cu titlu, sub și
explicație.

**Următorul lucru cerut de Lucian: același conținut într-un fișier Word, pentru
editare.** Pe mașină nu există nici `python-docx`, nici `pandoc`, deci prima dată se
instalează ceva (cu aprobarea lui) sau se generează un format pe care Word îl deschide
curat.

### Cei patru pași de probă, cei care au fost aprobați

**Text integral, păstrat aici la cererea explicită a lui Lucian** („o să ți le cer
să compunem lista de pași"). Sunt cei mai grei dintre cei 40: doi sunt pași noi,
doi conțin o recomandare care contrazice practica obișnuită.

Aprobați? **Nu încă.** Lucian n-a apucat să răspundă dacă densitatea și tonul sunt
bune. Dacă sunt, restul de 36 se scriu la fel.

⚠️ La scriere: **fără liniuță lungă „—"**, textele astea sunt citite de utilizatori.
⚠️ **Fără procente de economie**, niciodată.

---

**FAZA 1, PASUL 4**

**Titlu:** Bugetul fiecăruia și varianta de finanțare, discutate
**Sub:** Aport propriu în tranșe sau credit individual pentru construcție
**Explicație:**

> Este discuția pe care grupurile o amână cel mai des și care costă cel mai mult
> când vine târziu. Sunt două variante practicate. Prima: fiecare pune bani proprii,
> în tranșe legate de etapele proiectului, adică teren, proiectare, autorizații,
> fundație, structură, finisaje. Este varianta folosită la Județului Housing și cea
> care vă lasă independenți în decizii. A doua: terenul se plătește integral din
> bani proprii, iar pentru construcție fiecare merge separat la bancă, cu cota lui
> indiviză pe teren drept garanție. Băncile din România sunt încă rezervate, fiindcă
> modelul nu le e familiar, așa că mergeți la mai multe și explicați structura
> proiectului. Ce contează acum nu e să aveți banii, ci să știți unul despre altul
> cum îi aduceți.

---

**FAZA 2B, PASUL 9** (pe fiecare teren candidat)

**Titlu:** Certificat de urbanism pentru construire, depus de proprietar
**Sub:** Cu propunerea voastră de bloc, înainte să cumpărați
**Explicație:**

> Certificatul informativ vă spune ce scrie în plan pentru terenul acela. Cel pentru
> construire vă spune ce zice primăria despre ce vreți voi să ridicați acolo, ceea ce
> nu e același lucru. Se depune cu un plan de situație făcut de arhitect, pe baza
> analizei preliminare. Cererea o face proprietarul terenului, fiindcă voi încă nu
> sunteți proprietari, deci e o discuție de purtat cu el și un motiv bun să cereți o
> rezervare. Durează cel mult 30 de zile. Este cea mai ieftină formă de siguranță
> dinaintea unei plăți mari: aflați lista completă de avize cerute și dacă propunerea
> voastră stă în picioare, înainte să dați banii pe teren.

---

**FAZA 3, PASUL 8**

**Titlu:** DTAC și autorizația de construire
**Sub:** Recomandat după proiectul tehnic, nu înaintea lui
**Explicație:**

> Practica obișnuită e să depui DTAC cât mai repede, ca să ai autorizația în mână.
> Noi recomandăm invers, și e o recomandare care vă poate scuti de câteva luni. Cu
> proiectul tehnic gata, toți proiectanții scot liste de cantități, iar voi puteți
> cere oferte reale de la constructori. Abia atunci știți cât costă blocul vostru și
> puteți ajusta proiectul cât încă e ieftin de ajustat. După ce autorizația e emisă,
> orice schimbare de fațadă sau de volumetrie înseamnă modificare de temă și
> reautorizare. Autorizația e valabilă 12 luni pentru începerea lucrărilor și se
> poate prelungi o singură dată.

---

**FAZA 4, PASUL 8**

**Titlu:** Intabularea și apartamentarea
**Sub:** Momentul în care apartamentul devine al tău, pe hârtie
**Explicație:**

> Recepția atestă că blocul e construit conform proiectului autorizat. Nu vă face
> încă proprietari pe apartamente. Până aici ați deținut cote indivize dintr-un teren
> și dintr-o construcție. Prin apartamentare, fiecare unitate, apartament, loc de
> parcare, boxă, primește numărul ei cadastral, iar prin intabulare trece în cartea
> funciară pe numele membrului căruia îi revine, conform contractului de asociere sau
> actului constitutiv al firmei. Este ultimul pas juridic al proiectului și cel care
> închide promisiunea de la care ați pornit. Fără el aveți un bloc terminat și niciun
> apartament al nimănui.

---

## Decizii blocante (răspunsurile lui Lucian, înainte de orice cod)

1. **Certificatul de urbanism de construire:** un singur pas în faza 2B, cu
   confirmare în faza 3 (propunerea mea), sau două cereri distincte?
2. **Faza 4 se redenumește „Construcția și intrarea în proprietate"**, ca să
   încapă intabularea, sau se face o **fază 5** separată? Fază nouă înseamnă
   culoare nouă și bară de progres schimbată în trei locuri.
3. **Pașii de teren (2B) intră în procentul de progres al grupului?** Propunerea
   mea: nu. Dacă abandonezi un teren, progresul grupului n-are voie să scadă.

Plus două lucruri de lămurit, ridicate de mine, fără răspuns încă:

4. **Ce se întâmplă cu textul bun care există deja** în `cum-functioneaza.html`:
   recomandarea de 4-8 familii, cele două variante de constructor cu avantaje și
   dezavantaje, factorii critici de succes. Nu sunt pași, sunt context. Propunere:
   rămân pe pagina de ghid ca secțiuni proprii, iar pașii vin din sursa unică.
5. **Unde se citește explicația în grup:** 29 de pași cu câte un paragraf =
   perete de text. Propunere: bifă + o linie, iar paragraful apare la desfacerea
   pasului, în același loc unde vor sta comentariile și atașamentele.

---

## De unde continui

1. Iei răspunsurile la cele 3 decizii blocante (+ 2 lămuriri).
2. Confirmi tonul pe cei 4 pași scriși ca probă.
3. Scrii textul complet pentru toți cei 40 de pași. **Sesiune separată**, ≈4.000
   de cuvinte, nu se amestecă cu implementarea.
4. Abia apoi implementarea, în ordinea asta:
   - `frontend/js/pasi-proiect.js`, sursa unică (titlu + sub + explicatie).
     **Acum lista e copiată de mână în trei fișiere, de aici vin toate diferențele.**
   - `grup-details.html` citește din ea, în locul lui `CHECKLIST_PHASES`
   - `index.html` citește din ea, în locul lui `FAZE`
   - `ce-este/cum-functioneaza.html` generează secțiunea de pași din ea
   - ultima, fiindcă cere migrare: tabela `grup_teren_checklist` pentru faza 2B
5. Abia după ce lista e înghețată peste tot: restul cerințelor pentru pagina de
   grup, din „Partea 3".

⚠️ **Cheile existente din `grup_checklist.step_key` nu se redenumesc.** Bifele
puse deja de grupuri reale sunt legate de ele. Se schimbă doar textul afișat.

⚠️ Subtitlurile actuale conțin liniuțe („Arhitectură – Structură – Instalații",
`grup-details.html:1960`). Se rescriu la trecerea prin sursa unică.

---

## Partea 3: ce a mai cerut Lucian pentru pagina de grup (neanalizat)

Textul lui, păstrat aproape cuvânt cu cuvânt, ca să nu se piardă. **Nu s-a
discutat nimic din asta**, s-a oprit la lista de pași fiindcă „apar diverse liste
de pași în mai multe locuri". Se reia pas cu pas, împreună, după înghețarea listei.

Întrebarea de la care a pornit: *membrul a dat join la grup, vede niște terenuri,
vede membri, preferințe de locuire. Și acum ce fac, intru în vorbă cu oamenii ăștia?*

Ce ar trebui să poți face pe grup:

1. **Vezi stadiul grupului.** Ce au făcut până acum, ce terenuri au vizitat, ce
   discuții au avut cu proprietarii, ce au aflat, ce documente au încărcat
   (certificat de urbanism, carte funciară, cu aprobarea adminului pentru
   descărcare). *„Eu cred că aici trebuie deja implementat un secretariat al
   grupului, altfel sunt 2 care vorbesc pe WhatsApp și vine un al 3-lea care nu
   știe nimic."* **Trebuie să existe un rezumat a ceea ce a făcut grupul până atunci.**
2. **Vezi dacă îți place unul din terenurile grupului** și deblochezi tabul de
   organizare pe apartamente, dacă există analiză preliminară. Dacă nu există,
   poți discuta cu grupul și cere una.
3. **Comentarii și întrebări la terenuri.** Dacă sunt lucruri pe care noi, ca
   arhitecți, le putem clarifica, răspundem acolo.
4. **Planificator de plăți pe procente în timp**, la fiecare teren, așa cum s-a
   plătit la Județului Housing.
5. **Model de contract de asociere**, elementele principale de discutat cu un
   avocat și legalizat la notar, după gruparea membrilor pe un teren și
   stabilirea apartamentelor.

Plus, la fiecare pas din grup, **zonă de comentarii și atașamente** (formulat de
Lucian ca „probabil", de discutat când ajungem la pagina de grup).

Lista de pași pe teren din mesajul lui a fost deja absorbită în FAZA 2B de mai sus.

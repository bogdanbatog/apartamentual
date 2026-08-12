# Handoff: automatizarea emailului „terenuri noi în zonele tale"

**Data:** 12 august 2026 (actualizat seara) · **13 august: Piesa 1 gata**
**Stadiu:** ✅ **PIESA 1 SCRISĂ, RULATĂ ȘI DOVEDITĂ. Piesele 2–4 nescrise.**

**Ce e deja decis și făcut:**
- ✅ premisa verificată — potrivirea teren↔zonă e sigură (46 din 46)
- ✅ măsurătorile rulate și interpretate (ritmul + distribuția zonelor)
- ✅ **pragul ridicat de la 12 la 20 de zone bifate** (decizia lui Lucian, pe baza distribuției)
- ✅ **`profiles.cont_intern` există în bază** — lista de excluderi scrisă de mână a dispărut
- ✅ **ziua și ora: LUNI 10:00** (decizia lui Lucian, 13 august)
- ✅ **declanșare manuală: comandă locală** cu `dry_run`/`force` — zero cod nou (13 august)
- 🟡 **Piesa 1 (SQL de bază) scrisă** — trei fișiere, ✋ **NERULATE de Lucian**

**Următorul pas concret: PIESA 3 — TEXTUL EMAILULUI.** Sesiune nouă, după `/clear`; e o
lucrare de conținut, n-are nevoie de niciun rând din SQL. Parcursul pe care-l vrea Lucian și
ce se poate promite din el (doi pași din trei nu existau cum au fost formulați) sunt mai jos,
la „PARCURSUL DIN EMAIL". Abia după text se scrie Piesa 2 — edge function-ul are nevoie să
știe ce trimite.

Piesa 2, când se ajunge la ea: cheamă `lot_terenuri_noi(now() - interval '14 days', 20, 6)`,
verifică singură că la București e **luni, ora 10**, și scrie în `terenuri_digest_log` după
fiecare om servit.

---

## De unde a pornit

Întrebarea lui Lucian: *„am automatizat ceva pe zona asta — emailuri când apar
terenuri noi în zonele preferate?"*

**Răspuns: nu.** Există doar campania manuală din 3 august (38 de emailuri,
`handoff/handoff-campanie-terenuri-noi.md`), pornită de mână de la calculator cu
`scripts/emailuri-terenuri-noi/trimite-emailuri-terenuri.js`.

Verificat că **nu** există: nicio edge function pentru terenuri (cele deployate sunt
`creeaza-proforma-oblio`, `oblio-webhook`, `notify-admins`, `digest-anunturi-grup`,
`newsletter-*`), niciun `pg_cron` în afara digestului de anunțuri, **niciun trigger
care să lege un teren nou de `user_preferred_zones`** — nicio funcție de pe server
nu atinge tabela aia, doar frontendul și scripturile de campanie.

**Ce vrea Lucian:** trimitere automată la începutul fiecărei săptămâni, în funcție de
ce terenuri noi au apărut, **plus** posibilitatea de a o declanșa el manual.

---

## ✅ Premisa e verificată: potrivirea e sigură

Înainte de a automatiza, s-a măsurat cât de fragilă e legătura teren↔zonă (se face
pe **text**, nu pe cheie străină — vezi `db_schema/digest-terenuri/0-diagnostic-potrivire.sql`).

**Rezultat: 46 din 46 de terenuri publice se leagă corect.** Zero pierdute din cauza
scrierii, zero cartiere lipsă. Niciun teren de pe platformă nu e invizibil pentru
oameni. **Automatizarea poate merge mai departe fără reparații prealabile.**

### Două mine rămase, adormite (NU se ating separat)

- **„Griviţa"** (București) e scris cu **ţ cu sedilă** (U+0163) **și** în
  `frontend/js/orase-cartiere.js:14`, **și** în tabela `zones`. Cele două greșeli sunt
  identice, deci se potrivesc — greșeala se anulează pe sine.
- **„Pacurari"** (Iași) e fără diacritic în ambele locuri (corect ar fi „Păcurari").

⚠️ **În ziua în care cineva „corectează" una din ele într-un singur loc, potrivirea se
rupe în tăcere.** Iar corectura arată ca o îmbunătățire evidentă. De îndreptat cândva,
**numai în ambele locuri deodată**.

---

## ✅ Curățenie neprevăzută: 16 zone-fantomă (ÎNCHEIAT)

Diagnosticul a scos altceva decât căutam. `zones` avea **16 rânduri rămase din
numerotarea veche** (id 21–36), dinainte de convenția pe intervale (București 101-161,
Cluj 201+, Timișoara 301+, Iași 401+, Brașov 501+).

**De ce conta:** lista de zone din pagina de profil se citește **din tabela `zones`**
(`profile-edit-new.js:283`, `register.js:83`), deci omul vedea aceeași zonă de două ori
și oamenii se împărțeau între copii. Terenurile, în schimb, vin din fișierul JS care are
**o singură** scriere, deci cădeau mereu pe una singură — **cine bifase cealaltă n-ar fi
aflat niciodată**. Exact defecțiunea tăcută pe care o căutam, în alt loc decât bănuiam.

**Ce s-a șters:** 15 zone cu geamăn exact (regula: rămâne id-ul din intervalul orașului)
+ `Centru` Brașov (id 30), care era aceeași zonă cu „Centru Vechi" sub alt nume —
confirmat de Lucian, tratat printr-un bloc explicit fiindcă numele diferă și nicio regulă
automată nu le-ar fi legat.

**Impact:** 0 oameni de mutat, 0 grupuri, 0 terenuri afectate. Bucureștiul era deja curat.

**Starea finală — `zones` se potrivește acum EXACT cu `orase-cartiere.js`:**
București 62 | Cluj-Napoca 20 | Timișoara 18 | Iași 18 | Brașov 19.

### ⚠️ Capcanele găsite în timpul reparației

1. **`user_preferred_zones.zone_id` și `grup_preferred_zones.zone_id` sunt `ON DELETE
   CASCADE`.** Ștergerea unei zone ar fi șters preferințele oamenilor **fără niciun
   mesaj**. Ordinea (mută întâi, șterge după) nu era precauție, era necesară.
2. **Prima versiune a scriptului meu avea un `DELETE` prea larg** — ștergea legăturile
   către *orice* zonă cu id sub 100, dar `INSERT`-ul de dinainte punea înlocuitor doar
   pentru zonele *cu geamăn*. Pentru `Centru` Brașov (fără geamăn) ar fi șters preferința
   omului fără nimic în loc. Azi nu era nimeni pe ea — deci ar fi „mers din întâmplare".
   Reparat să fie corect prin construcție.
3. **Cluj n-are zone vechi**, deci regula `id < 100` nu putea fi folosită singură ca
   criteriu de ștergere; trebuia obligatoriu combinată cu „are geamăn".

---

## ✅ Steagul `cont_intern` — ÎNCHEIAT (12 august, `c0c317d`)

Era trecut mai jos ca „de rezolvat la construire". S-a rezolvat.

**Problema:** conturile noastre și ale prietenilor cu cont de test erau scoase din campanii
printr-o **listă de emailuri scrisă de mână**, copiată din fișier în fișier
(`terenuri-noi/4-lot-destinatari.sql:44-54`, `emailuri-profil-incomplet/1-lot-pentru-email.sql:42-53`).
Într-o campanie pornită de mână e acceptabil — te uiți la lot înainte de trimitere. Într-o
funcție care rulează singură în fiecare luni, e o bombă cu ceas.

### ⚠️ De ce NU s-a folosit `is_demo`

Cererea inițială a lui Lucian a fost „marchează-le mai bine cu demo". **`is_demo` e un marcaj
PUBLIC**, nu unul intern — verificat în cod înainte de a răspunde:

| Unde | Ce se vede |
|---|---|
| `js/utilizatori.js:440` | badge „Exemplu" lângă nume pe `/utilizatori` |
| `js/profile-view-new.js:269` | „Exemplu" în loc de „Utilizator Activ" pe profil |
| `grup-details.html:1839` | badge „Exemplu" în lista de membri |

Și **nu scoate contul din listă, nici din numărătoare** — doar îl împinge la coadă
(`utilizatori.js:230-234`). Deci n-ar fi curățat cifrele, doar ar fi pus o etichetă.
Pe site „Exemplu" înseamnă *personaj inventat* — ar fi etichetat public **co-fondatorul**
și oameni reali. Lucian a ales în schimb un steag nou, intern.

### Ce s-a construit

`profiles.cont_intern boolean not null default false`. **`not null` e deliberat:** cu NULL
permis, un `WHERE cont_intern = false` ar fi sărit tăcut peste rândurile cu NULL — exact
capcana lui `account_status`.

**Nu primește niciun `GRANT`, dinadins.** Pe 1 august, `authenticated` a rămas cu SELECT pe
o listă de exact 20 de coloane numite (`securitate-profiles/6-revoca-pentru-logati.sql:73-94`),
iar dreptul pe toată tabela a fost revocat. Consecință: **o coloană nouă e invizibilă din
naștere** — nu trebuie ascunsă. Și `profiles_visible` e înghețat la 31 de coloane, deci nici
pe acolo. Trei porți, toate deja închise. Se scrie doar din SQL Editor sau cu `service_role`.

> ⚠️ Dacă vreodată vrei bifa în `/admin.html`: ai nevoie de `GRANT UPDATE (cont_intern)`
> **PLUS** o politică RLS care s-o restrângă la superadmini. Fără politică, grantul o
> deschide pentru oricine e logat.

**Rezultat: 23 de conturi marcate, 70 de utilizatori reali rămași** (CSV 90 = diagnosticul,
CSV 91 = controlul de după).

### Două lecții din diagnostic

1. **Filtrul pe domeniul firmei nu prinde conturile făcute cu Gmail personal.**
   `%@ltfbstudio.ro` rata `ltfb.studio@gmail.com` — contul studioului, înscris 5 august,
   care apărea liniștit printre destinatarii reali. Găsit doar fiindcă diagnosticul are o
   secțiune C cu **toți cei care rămân**, citită cu ochiul. Confirmat de Lucian, adăugat.
2. **Regula „orice adresă cu `+` e cont de test" e singura care poate greși.** Există
   oameni reali care se înscriu cu alias (`numele+apartamentual@gmail.com`) ca să vadă cine
   le vinde adresa. ✅ Verificat pe 12 august: toate cele 14 adrese cu `+` din bază sunt
   `luta.lucian.m+testN`. **De reverificat la fiecare rulare** — regula prinde acum orice
   alias, al oricui, nu doar pe ale lui Lucian (lista veche prindea doar `luta.lucian.m+%`).

### Ce NU s-a atins

Blocurile `useri_exclusi` / `exclusi` din campaniile **deja rulate** au rămas neschimbate.
Se înlocuiesc cu `cont_intern = false` când se scrie campania următoare — altfel rescriem
istoria degeaba.

Cele două adrese scoase cu mâna pe 10 august **nu se pot recupera**: `trimise-2026-08-10.json`
notează doar ce a plecat, nu ce s-a scos.

---

## 🟡 Planul automatizării — patru piese, pe modelul `digest-anunturi-grup`

Digestul de anunțuri e tiparul de copiat. Citește-l întâi:
`supabase/functions/digest-anunturi-grup/index.ts` + `db_schema/digest-anunturi/`.

### Piesa 1 — SQL de bază (`db_schema/digest-terenuri/2-baza.sql`)

- coloană `profiles.email_terenuri_noi`, `not null default true`, **cu grant pe coloană**
  (`select` + `update` către `authenticated`);
- tabela-jurnal `terenuri_digest_log` (user_id, trimis_la, fereastra_de_la, nr_terenuri,
  nr_zone), cu **RLS pornit și zero politici** — `service_role` ocolește RLS, restul nu văd
  nimic, iar tu citești ca `postgres` din SQL Editor;
- funcția `lot_terenuri_noi(de_la, prag_zone)` — **`prag_zone` = 20**, vezi decizia de mai
  jos; **mută interogarea deja validată** din
  `db_schema/terenuri-noi/4-lot-destinatari.sql`, care întoarce un rând per persoană cu
  primele 3 zone și acordul gramatical rezolvat („1 teren nou" / „3 terenuri noi" /
  „21 de terenuri noi"). ⚠️ **NU o rescrie în JavaScript** — a fost verificată pe date
  reale în august; o rescriere e cod nou, neprobat. `SECURITY DEFINER`, cu `EXECUTE`
  revocat de la `anon` și `authenticated`.
  ✅ **O singură schimbare față de original:** blocul `useri_exclusi` (liniile 35-55, lista
  de emailuri scrisă de mână) se înlocuiește cu `AND p.cont_intern = false`. Steagul există
  deja în bază — vezi secțiunea de mai sus.

### Piesa 2 — edge function `digest-terenuri-zone`

Copie structurală a celei de anunțuri:
- poarta e antetul `x-cron-secret`, verificare care **eșuează închis** (dacă secretul nu
  e configurat pe server, funcția refuză tot);
- deploy cu `--no-verify-jwt`;
- **verifică ea ziua și ora la București** cu `Intl.DateTimeFormat` + `hourCycle: 'h23'`.
  ⚠️ `pg_cron` socotește în UTC, iar România schimbă ora de două ori pe an — o sarcină
  programată direct la ora fixă ar începe să trimită cu o oră mai devreme după ultima
  duminică din octombrie, tăcut, șase luni pe an. Cronul rulează din oră în oră;
- **fereastra e „de la ultima trimitere către omul ăsta"**, nu „ultimele 7 zile
  calendaristice". Dacă o luni pică trimiterea, terenurile nu se pierd — intră în emailul
  de săptămâna viitoare. Plafon de siguranță la 14 zile;
- **săptămânile fără terenuri noi sunt tăcute** — nu pleacă niciun email;
- are `dry_run` (arată ce AR trimite, fără să trimită) și `force` (sare peste verificarea
  de zi/oră);
- **raportează câte terenuri noi n-au putut fi legate de nicio zonă**, iar dacă e diferit
  de zero, semnalează pe Slack `#app_events`. Asta înlocuiește ochiul omenesc de la
  campania manuală.

### 📝 PARCURSUL DIN EMAIL — formulat de Lucian pe 13 august

Ce vrea Lucian să conțină emailul, după ce-i spune omului că au apărut terenuri noi:
**(1)** intră pe pagina de terenuri și vede rapid terenurile noi din zonele lui;
**(2)** ca să afle câte apartamente încap și la ce cost pe mp util, poate cere analiza
de arhitect (99 RON); **(3)** poate adăuga un teren la grupul din care face parte, sau
poate face un grup nou pe terenul acela ca să atragă alți oameni.

⚠️ **VERIFICAT ÎN COD PE 13 AUGUST — doi pași din trei nu existau așa cum sunt formulați:**

| Pasul | Realitatea din cod | Ce facem |
|---|---|---|
| 1. „filtrează cu zonele preferate" | ❌ **Nu există.** `terenuri.html` filtrează pe oraș + **UN singur** cartier, dintr-un dropdown. Nicio bifare multiplă, niciun filtru „zonele mele". Iar `js/terenuri.js` **nu citește deloc parametri din URL**, deci nici link gata filtrat nu se poate da. | ✅ **Rezolvat altfel** (decizia lui Lucian): emailul listează terenurile concrete, fiecare cu link direct. De aici versiunea 2 a funcției. |
| 2. analiza de 99 RON | ✅ **Exact cum e formulat.** `analize.html` promite „câte apartamente se pot construi (mai multe variante)" și „preț estimat pe mp construit și util". Din pagina unui teren se comandă analiza pentru terenul acela. | Rămâne ca atare. |
| 3a. „adaugă terenul la grupul tău" | ✅ Merge pentru **orice membru activ**, din pagina terenului. Dar scrie în `terenuri_likes_grupuri` — lista de **favorite** ale grupului. | Se poate spune în email. |
| 3b. terenurile *oficiale* ale grupului | ⚠️ Alt mecanism (`grup_terenuri`), altă pagină, iar butonul e vizibil **doar fondatorului**. | Nu se promite membrilor simpli. |
| 3c. „fac un grup nou și adaug acel teren" | ⚠️ **Nu e o singură acțiune.** Formularul de creare grup nu primește un teren; se creează grupul, apoi se intră pe pagina lui, apoi „Editează terenuri". Terenul nu se duce cu tine. | Textul nu poate spune „creează un grup pe terenul ăsta" ca pe un singur clic. |

**Prețul de 99 RON:** e promoțional („PROMOȚIE PRIMA LUNĂ", 149 tăiat). Lucian a decis pe
13 august că promoția devine **„primele 3 luni"**. ⚠️ Asta mută termenul, nu-l elimină:
pe la **mijlocul lui noiembrie 2026** emailul automat ar începe să trimită un preț învechit
la 62 de oameni. Prețul se scrie în șablon **într-un singur loc**, ca schimbarea să fie o linie.

### 📊 Ce material are, de fapt, emailul (măsurat 13 august, CSV 98)

Din 46 de terenuri publice: **46 au poză**, **46 au preț și suprafață** (deci și preț pe mp),
**0 au `nr_apartamente_min` completat**.

⚠️ **Ideea „arătăm 3–4 apartamente pe carduri" PICĂ** — coloanele există în tabelă, dar nu
sunt populate niciodată. Bine că s-a măsurat înainte de a scrie textul.

✅ **Și e o veste bună pentru mesaj:** dacă niciun teren de pe platformă nu arată ce se poate
construi pe el, atunci „câte apartamente încap" nu e o informație pe care omul o are și pe
care analiza o rafinează — e una pe care **nu o are deloc**. Emailul poate spune exact asta,
cinstit: vezi terenul, prețul, suprafața; ce nu vezi nicăieri e ce se poate ridica acolo.

✅ **`analiza_*_status` nu spune nimic despre email — închis pe 13 august.** Au ieșit
„completate" la 46 din 46 fiindcă `terrain-form-v2.js:469-470` pune `'pending'` la **fiecare**
teren creat: e valoarea implicită, nu un semnal. Iar textul analizei nu se afișează pe pagina
terenului — analiza comandată ajunge ca PDF pe emailul celui care a plătit-o.

⚠️ **Deci nu există „terenuri care au deja analiză" de ocolit în email.** Nimeni nu poate ști,
uitându-se la un teren, dacă cineva a comandat vreodată o analiză pentru el. Omul o comandă ca
să afle ce se poate construi, punct.

### Piesa 3 — șablon nou în `notify-admins`

Un `case 'terenuri_noi_zone'`, pe modelul lui `anunturi_digest` (linia 510).

⚠️ **Singura diferență structurală față de digestul de anunțuri:** acela trimite
**același** text unui grup întreg (un apel, `recipient_user_ids` → `recipient_emails`).
Al nostru e **personalizat per om** (zonele lui, numerele lui), deci e **câte un apel per
persoană**, secvențial, cu pauză mică între ele. `notify-admins` are deja reîncercare cu
componentă aleatoare pentru 429-urile de la Resend.

### Piesa 4 — bifa în profil

`profile-edit-new.html` + `.js`, lângă cea existentă pentru anunțuri.

⚠️ **Două porți pentru o coloană nouă pe `profiles`, ambele obligatorii:**
1. `grant update (email_terenuri_noi)` — fără el pică **tot** formularul de profil,
   pentru toți, tăcut. **SQL-ul se rulează ÎNAINTE de deployul frontendului.**
2. `profiles_visible` e înghețat la 31 de coloane (31 iulie), deci coloana nouă **nu iese
   dintr-un `select('*')` pe view**. Se citește separat, direct din `profiles`, ca la
   `email_anunturi_grup` (`profile-edit-new.js:333-339`). Dacă citirea eșuează, bifa apare
   PORNITĂ — o eroare de rețea n-are voie să dezaboneze pe cineva fără să știe.

Subsolul emailului trimite la pagina de profil pentru dezabonare, **nu** „răspunde cu stop".

---

## 📊 MĂSURĂTORILE — scrise, rulate, interpretate (12 august)

Lucian a cerut cifre înainte de a decide. Ambele măsurători sunt scrise, rulate, iar
rezultatele stau în `screenshots/20260812/`, CSV 88 și 89.

### Ritmul: săptămânalul e viabil (`0c-cate-emailuri-pe-saptamana.sql`)

⚠️ **Rezumatul spune „4 săptămâni cu material din 27" — cifra e înșelătoare.** Toate cele
46 de terenuri au fost adăugate în ultimele 9 săptămâni; înainte de 8 iunie platforma
n-avea niciun teren, deci săptămânile goale din februarie–mai nu spun nimic despre ritm.

**Semnalul real, ultimele 10 săptămâni — 6 din 10 au avut terenuri:**

| Săptămâna | Terenuri | Emailuri |
|---|---|---|
| 8 iun | 1 | 0 ⚠️ |
| 15 iun | 8 | 0 ⚠️ |
| 22 iun – 29 iun | 0 | — |
| 6 iul | 1 | 2 |
| 13 iul | 0 | — |
| 20 iul | 7 | 21 |
| 27 iul | 19 | 39 |
| 3 aug | 10 | 43 |
| 10 aug | 0 | — |

⚠️ **Cele două rânduri din iunie cu terenuri dar zero emailuri sunt un artefact al
măsurătorii**, nu un defect: se numără doar oamenii al căror cont exista deja atunci, iar
în iunie majoritatea celor 70 de utilizatori de azi încă nu se înscriseseră.

✅ **Verificare de sănătate:** săptămâna lui 3 august dă 43 de emailuri, iar campania reală
de atunci a trimis 38. Aceeași ordine de mărime, cu decupaj puțin diferit.

**Observație pentru TON, nu pentru arhitectură:** într-o săptămână activă emailul ar pleca
la **20–43 de oameni din 70**, și sunt cam aceiași de fiecare dată (27 iulie și 3 august au
atins, în mare, aceeași listă). Un om activ ar primi emailul **două-trei săptămâni la rând**.
Textul trebuie deci **să suporte repetiția**, nu să sune ca un anunț unic.

### Distribuția zonelor (`0d-cate-zone-bifeaza-oamenii.sql`)

70 de utilizatori reali, media 8,8 zone bifate, maximul 58.

```
 1–2 zone    6 oameni
 3–5 zone   22 oameni   ← masa
 6–9 zone   20 oameni   ← masa
10–12 zone   7 oameni
14–19 zone  13 oameni
─────────────────────  ruptură: nimeni între 20 și 29
30 zone      1 om
58 zone      1 om
```

**Zero oameni cu zero zone bifate** — toți cei 70 au bifat cel puțin una, probabil fiindcă
zonele fac parte din „profil complet". ⚠️ Deci ideea unei campanii separate „spune-ne unde
cauți" **pică: n-are destinatari.**

---

## ✅ DECIZIE LUATĂ (12 august): pragul se ridică de la 12 la **20**

| Prag | Tăiați | Rămân |
|---|---|---|
| 10 | 20 | 50 |
| 12 (vechi) | **15** | 55 |
| 15 | 7 | 63 |
| **20 (ales)** | **2** | **68** |
| fără | 0 | 70 |

**Ipoteza inițială era greșită și datele au corectat-o:** credeam că pragul de 12 e o regulă
scrisă pentru cazul acela cu 58 de zone. Nu e — **tăia 15 din 70 de oameni, 21% din
utilizatori**, adică era pus în mijlocul mulțimii, nu la marginea ei.

Distribuția arată o ruptură foarte clară: **68 din 70 au cel mult 19 zone**, apoi e un gol,
apoi doi oameni singuri la 30 și 58. Pragul 20 taie exact cei doi oameni pentru care regula
a fost gândită și **pe nimeni altcineva**.

*Contraargumentul, păstrat pentru cine reia discuția:* cine a bifat 15 din 61 de cartiere
primește o potrivire aproape la orice teren. Dacă emailul trebuie să rămână un semnal
puternic, nu doar frecvent, 15 ar fi compromisul (taie 7). **Nu s-a ales asta.**

⚠️ **Pragul e despre ZONE bifate, nu despre terenuri** — confuzie ușor de făcut. Se uită la
câte cartiere și-a bifat omul în profil, din cele 61 ale Bucureștiului. Și **nu-l scoate pe
om de pe platformă**: doar nu-i trimite acest email anume, restul rămâne neschimbat.

---

## ✅ DECIZII LUATE (13 august)

1. **Ziua și ora: LUNI 10:00.** Prinde terenurile apărute în weekend și păstrează senzația
   de „început de săptămână". ⚠️ Ora se verifică **în funcție**, la București, nu în
   `pg_cron` — cronul rulează din oră în oră. `pg_cron` socotește în UTC, iar la ultima
   duminică din octombrie emailurile ar începe să plece la 09:00, tăcut, șase luni pe an.

2. **Declanșarea manuală: comandă locală** (curl cu `dry_run` / `force`). Zero cod nou,
   zero suprafață de atac în plus. Butonul în `/admin.html` rămâne o opțiune de peste 2–3
   săptămâni de funcționare, dacă se dovedește necesar — el cere ca funcția să accepte și
   autentificare de superadmin pe lângă secretul de cron, adică **cod nou pe o poartă de
   securitate**.

---

## ✅ PIESA 1 — SCRISĂ ȘI RULATĂ (13 august)

Toate blocurile rulate de Lucian, fără erori. **Funcția e dovedită pe date reale.**

**Ce a ieșit la probe:**
- `6c` — funcția întoarce **62 de destinatari** (fereastră de 14 zile, prag 20), zero erori
  de tip. `nr_zone_bifate` maxim **19** pe toate rândurile ⇒ pragul funcționează.
  `fereastra_de_la` identică la toți ⇒ jurnalul gol, toți cad pe podea, cum trebuie.
  Acordul gramatical corect. **Niciun cont de-al nostru în listă.** (CSV 94)
- `2b` — **secțiunea C GOALĂ**: cei 49 de oameni prezenți în ambele variante au exact
  aceleași cifre. Secțiunea B goală: lista scrisă de mână nu excludea niciun om real.
  Secțiunea A un singur rând, `ltfb.studio@gmail.com` — singura diferență față de august,
  și e o îmbunătățire. (CSV 96)
- `3b` (cheia străină către `auth.users`) — **a mers**, după ce s-a reluat cu linia `do $$`
  inclusă. ⚠️ Capcană de copiere, nu de cod: selecția pornită de la `begin` lasă `do $$`
  afară și dă `42601 syntax error at or near "if"`. Aceeași pereche de `$$` contează și la
  corpul funcției din BLOC 5.

**Verificat și consemnat:** `rox.brustur@yahoo.com` apare în lot. Pe 28 iulie fusese scoasă
manual din campania „zone fără grup" (de aceea 36 de emailuri, nu 37). **Lucian a confirmat
pe 13 august că a fost o excludere de moment** — profil real, fără steag. Rămâne în lot.

---

### Fișierele Piesei 1

Toate în `db_schema/digest-terenuri/`. **Ordinea de rulare:**

| Fișier | Ce face | Scrie în bază? |
|---|---|---|
| `0e-control-digest-anunturi.sql` | verificarea de 2 minute: a trimis digestul de anunțuri ceva **singur**, de la proba manuală din 5 august? | nu — strict SELECT |
| `2-baza.sql` | bifa `email_terenuri_noi`, jurnalul `terenuri_digest_log`, funcția `lot_terenuri_noi` | **da** — se rulează pe blocuri |
| `2b-control-lot-vs-august.sql` | dovada că funcția dă aceleași cifre ca interogarea validată în august | nu — strict SELECT |
| `2c-functie-cu-lista-terenuri.sql` | **versiunea 2** a funcției: întoarce și terenurile efective (`terenuri_lista jsonb`), pentru cardurile din email. ⚠️ Înlocuiește BLOC 5 din `2-baza.sql` — acela nu se mai rulează. | **da** — ✅ RULAT 13 aug |
| `2c-doar-functia.sql` | același corp de funcție, extras singur, ca să poată fi rulat cu Ctrl+A fără selecție parțială | **da** — e o copie, nu ceva în plus |

**Dovada versiunii 2 (13 august):** 62 de destinatari și **719** terenuri însumate — exact
suma coloanei `total_terenuri` din CSV 94, adunată rând cu rând. Lista de terenuri s-a adăugat
fără să miște nimic din ce era deja dovedit cu `2b`.

⚠️ **Trei capcane plătite la rularea versiunii 2**, toate consemnate în antetul lui `2c`:
`max()` nu există pe `jsonb` (coloana intră în `group by`); `terenuri` are **două** coloane de
dată (`created_at`, folosită de noi, și `data_adaugat`) și **două** de zonă (`cartier`, folosită
la potrivire, și `zona`, rămasă din schema veche); iar `pret_pe_mp` există în bază dar
frontendul n-o citește — calculează din `pret_total / suprafata`, deci facem la fel, altfel
emailul ar arăta alt preț decât pagina.

### ⚠️ Trei lucruri de știut înainte de a scrie Piesa 2

1. **Funcția are TREI schimbări față de interogarea din august, nu una.** Handoff-ul de
   ieri prevedea doar înlocuirea listei de excluderi cu `cont_intern`. Celelalte două au
   apărut la scriere: filtrul pe bifa nouă `email_terenuri_noi` (coloana nu exista în
   august), și **fereastra per persoană**, care a cerut mutarea numărătorii de terenuri
   dintr-un CTE global într-unul per (om, zonă) — doi oameni cu ferestre diferite trebuie
   să vadă cifre diferite. A treia e o restructurare reală, de aceea există `2b`.

2. **`2b` are sens DOAR cât timp jurnalul e gol.** După prima trimitere reală, fiecare om
   are propria fereastră și cele două variante n-au cum să mai dea la fel. Fișierul îți
   spune singur, în secțiunea Z, dacă mai e valabil.

3. **Plafonul de 14 zile NU e în funcție**, deși handoff-ul de ieri îl punea acolo.
   `p_de_la` e podeaua ferestrei și se dă din afară, ca plafonul să stea într-un singur
   loc — în edge function — nu ascuns în SQL. Piesa 2 cheamă
   `lot_terenuri_noi(now() - interval '14 days', 20)`.

### Ce rămâne nescris

Piesa 2 (edge function `digest-terenuri-zone`), Piesa 3 (șablonul din `notify-admins`),
Piesa 4 (bifa în pagina de profil) — toate descrise mai sus, niciuna începută.
⚠️ **Granturile Piesei 4 sunt deja în `2-baza.sql`, BLOC 2** — deci SQL-ul e rulat
înaintea deployului de frontend, cum trebuie. Fără grantul de UPDATE, formularul de profil
pică în întregime, pentru toți, tăcut.

---

## ⚠️ Alte lucruri de rezolvat la construire

- ~~Conturile de test nu sunt marcate.~~ ✅ **REZOLVAT 12 august** prin
  `profiles.cont_intern` — vezi secțiunea dedicată de mai sus. (Numele propus atunci era
  `email_exclus_campanii`; s-a ales `cont_intern`, fiindcă steagul spune *ce e contul*, nu
  doar *ce nu-i trimitem* — se folosește și la statistici, nu numai la emailuri.)
- ~~Digestul de anunțuri n-a fost încă confirmat că a trimis un email real în producție.~~
  ✅ **CONFIRMAT 13 august** cu `0e-control-digest-anunturi.sql` (CSV 92). Digesturi plecate
  **singure** pe 10 și 11 august, 16 destinatari, emailuri `sent` în `notification_log`.
  Verificarea orei la București funcționează (`{"sarit":true,"motiv":"la București e ora 17;
  digestul pleacă la 19"}`). **Tiparul se poate copia fără rezerve.**
  ⚠️ Găsit pe drum: `cron.job_run_details` **nu are coloana `jobname`**, doar `jobid` —
  numele se ia din `cron.job` printr-un JOIN. Greșeala era în
  `digest-anunturi/2-programare.sql` pasul 3b din 5 august, semn că interogarea aceea
  n-a fost rulată niciodată. Corectată în ambele fișiere.
  ⚠️ Găsit pe drum (2): numele grupului **„Parcul Circului,"** are o virgulă la coadă în
  bază, deci apare așa în emailurile către 16 oameni. De reparat din admin.
- **Nu se preia „cele două deschideri"** din campania manuală (fraza de legătură pentru cine
  primise emailul din iulie). E un email recurent, n-are nevoie de cârlig la fiecare rundă.

---

## Fișiere din sesiune

Comise în **`cf60a4f`** (împins pe `main`; **fără deploy** — sunt doar SQL, nimic din `frontend/`):

```
db_schema/digest-terenuri/0-diagnostic-potrivire.sql    241  strict SELECT, rulabil oricând
db_schema/digest-terenuri/0b-diagnostic-zone-duble.sql  198  strict SELECT, rulabil oricând
db_schema/digest-terenuri/1-reparatie-zone-duble.sql    ~455 ✅ RULAT 12 aug, marcat ca atare
```

Adăugate după (măsurătorile), **strict SELECT, rulabile oricând**:

```
db_schema/digest-terenuri/0c-cate-emailuri-pe-saptamana.sql   ritmul, săptămână cu săptămână
db_schema/digest-terenuri/0d-cate-zone-bifeaza-oamenii.sql    distribuția zonelor + praguri
```

Comise în **`c0c317d`** (steagul `cont_intern`; tot fără deploy — doar SQL):

```
db_schema/conturi-interne/0-cine-ar-fi-marcat.sql   200  strict SELECT, rulabil oricând
db_schema/conturi-interne/1-adauga-coloana.sql      195  ✅ RULAT 12 aug, marcat în antet
```

⚠️ `0-cine-ar-fi-marcat.sql` **se rulează din nou** înainte de orice campanie sau înainte de
a construi funcția: arată cine s-a mai înscris între timp și, în secțiunea C, **toți cei care
vor primi emailurile** — partea care se citește cu ochiul, fiindcă acolo s-a găsit
`ltfb.studio@gmail.com`.

⚠️ **Fișierele care încep cu `0` se rulează ÎNTREGI, dintr-un singur Run** — sunt scrise ca
o singură interogare cu `UNION ALL` și o coloană `sectiune`, fiindcă editorul SQL din
Supabase arată doar rezultatul ultimei instrucțiuni dintr-un script. Doar `1-reparatie`
se rulează pe blocuri, fiindcă e singurul care scrie în bază.

Rezultatele rulărilor: `screenshots/20260812/`, CSV 82–89 (ignorate de git — `*.csv`).

**Zero atingeri** la plăți (Netopia/Oblio), la edge functions, la politicile RLS, sau la
orice fișier din `frontend/`.

# Handoff: automatizarea emailului „terenuri noi în zonele tale"

**Data:** 12 august 2026 (actualizat seara)
**Stadiu:** 🟡 **PLANIFICAT, NECONSTRUIT.** Zero cod scris pentru automatizarea propriu-zisă.
Ziua s-a dus pe trei lucruri pregătitoare, toate ✅ **încheiate și comise**: verificarea
premisei (potrivirea teren↔zonă), o curățenie neprevăzută în `zones` (`cf60a4f`), și
steagul `cont_intern` (`c0c317d`).

**Ce e deja decis și făcut:**
- ✅ premisa verificată — potrivirea teren↔zonă e sigură (46 din 46)
- ✅ măsurătorile rulate și interpretate (ritmul + distribuția zonelor)
- ✅ **pragul ridicat de la 12 la 20 de zone bifate** (decizia lui Lucian, pe baza distribuției)
- ✅ **`profiles.cont_intern` există în bază** — lista de excluderi scrisă de mână a dispărut

**Ce mai lipsește ca să se poată construi:** ziua și ora trimiterii, și cum o declanșează
Lucian manual. Ambele sunt la finalul acestui fișier.

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

## 🔴 DECIZII ÎNCĂ DESCHISE

1. **Ziua și ora.** Propuneri: luni 10:00 (recomandat — acoperă terenurile apărute în
   weekend), marți 10:00 (rată de deschidere mai bună, dar pierde senzația de „început de
   săptămână"), luni 19:00 (ca digestul de anunțuri). Măsurătoarea de ritm arată că
   săptămânalul e potrivit, deci rămâne doar alegerea momentului.

2. **Cum o declanșează Lucian manual.** Comandă locală (curl cu `dry_run`/`force` — zero cod
   nou, zero suprafață de atac) vs. buton în `/admin.html` (mai comod, dar cere ca funcția
   să accepte și autentificare de superadmin pe lângă secretul de cron — **cod nou pe o
   poartă de securitate**). Recomandarea mea: comanda locală întâi, butonul după 2–3
   săptămâni de funcționare, dacă mai e nevoie.

---

## ⚠️ Alte lucruri de rezolvat la construire

- ~~Conturile de test nu sunt marcate.~~ ✅ **REZOLVAT 12 august** prin
  `profiles.cont_intern` — vezi secțiunea dedicată de mai sus. (Numele propus atunci era
  `email_exclus_campanii`; s-a ales `cont_intern`, fiindcă steagul spune *ce e contul*, nu
  doar *ce nu-i trimitem* — se folosește și la statistici, nu numai la emailuri.)
- **Digestul de anunțuri n-a fost încă confirmat că a trimis un email real** în producție —
  verificarea primei nopți (5 august) e tot nebifată în `HANDOFF.md`. Nu blochează, dar dacă
  tiparul are un defect, l-am moșteni în ambele. 2 minute de SQL la început.
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

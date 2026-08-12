# Handoff: automatizarea emailului „terenuri noi în zonele tale"

**Data:** 12 august 2026
**Stadiu:** 🟡 **PLANIFICAT, NECONSTRUIT.** Zero cod scris pentru automatizare.
Sesiunea s-a dus pe verificarea premisei (potrivirea teren↔zonă) și pe o curățenie
neprevăzută în `zones`, care e ✅ **încheiată și comisă** (`cf60a4f`).

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

## 🟡 Planul automatizării — patru piese, pe modelul `digest-anunturi-grup`

Digestul de anunțuri e tiparul de copiat. Citește-l întâi:
`supabase/functions/digest-anunturi-grup/index.ts` + `db_schema/digest-anunturi/`.

### Piesa 1 — SQL de bază (`db_schema/digest-terenuri/2-baza.sql`)

- coloană `profiles.email_terenuri_noi`, `not null default true`, **cu grant pe coloană**
  (`select` + `update` către `authenticated`);
- tabela-jurnal `terenuri_digest_log` (user_id, trimis_la, fereastra_de_la, nr_terenuri,
  nr_zone), cu **RLS pornit și zero politici** — `service_role` ocolește RLS, restul nu văd
  nimic, iar tu citești ca `postgres` din SQL Editor;
- funcția `lot_terenuri_noi(de_la, prag_zone)` — **mută interogarea deja validată** din
  `db_schema/terenuri-noi/4-lot-destinatari.sql`, care întoarce un rând per persoană cu
  primele 3 zone și acordul gramatical rezolvat („1 teren nou" / „3 terenuri noi" /
  „21 de terenuri noi"). ⚠️ **NU o rescrie în JavaScript** — a fost verificată pe date
  reale în august; o rescriere e cod nou, neprobat. `SECURITY DEFINER`, cu `EXECUTE`
  revocat de la `anon` și `authenticated`.

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

## 🔴 TREI DECIZII DE LUAT ÎNAINTE DE A CONSTRUI

Lucian a cerut să le lămurim înainte de a alege. **Întrebarea lui deschisă:** vrea să vadă
întâi cifre, nu să ghicească.

1. **Ziua și ora.** Propuneri: luni 10:00 (recomandat — acoperă terenurile de weekend),
   marți 10:00 (rată de deschidere mai bună, dar pierde „începutul de săptămână"),
   luni 19:00 (ca digestul de anunțuri).
   📊 **Măsurătoarea utilă înainte de a alege:** un SQL care se uită în urmă și arată,
   săptămână cu săptămână, **câte emailuri ar fi plecat** dacă automatizarea ar fi existat.
   Spune dacă avem material săptămânal sau doar în rafale. **Nescris încă.**

2. **Cum o declanșează manual.** Comandă locală (curl cu `dry_run`/`force` — zero cod nou,
   zero suprafață de atac) vs. buton în `/admin.html` (mai comod, dar cere ca funcția să
   accepte și autentificare de superadmin pe lângă secretul de cron — **cod nou pe o poartă
   de securitate**). Recomandarea mea: comanda locală întâi, butonul după 2-3 săptămâni de
   funcționare, dacă mai e nevoie.

3. **Pragul de 12 zone bifate** (decizia lui Lucian din 2 august: cine a bifat mai multe nu
   primește email, fiindcă „în zonele tale" n-ar mai însemna nimic — un om avea 58 de zone
   bifate din 61). Se păstrează / se ridică / se scoate?
   📊 **Măsurătoarea utilă:** distribuția reală — câți oameni au bifat 1-5 zone, câți 6-12,
   câți peste. Fără ea, orice prag e ghicit. **Nescris încă.**

---

## ⚠️ Alte lucruri de rezolvat la construire

- **Conturile de test (Carmen, Tibs, aliasurile `+testN`) nu sunt marcate `is_demo`.** În
  campania manuală erau excluse printr-o listă de emailuri **scrisă de mână** în SQL
  (`4-lot-destinatari.sql`, blocul `useri_exclusi`). Într-o funcție care rulează singură
  săptămânal, lista scrisă de mână e o bombă cu ceas. **Propunere: coloană
  `profiles.email_exclus_campanii`**, pusă o dată pe conturile alea.
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

Rezultatele rulărilor: `screenshots/20260812/`, CSV 82–87 (ignorate de git — `*.csv`).

**Zero atingeri** la plăți (Netopia/Oblio), la edge functions, la politicile RLS, sau la
orice fișier din `frontend/`.

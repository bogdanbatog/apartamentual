# Handoff — emailuri duplicate la înregistrare + emailuri pierdute la Resend

**Data:** 26 iulie 2026
**Commits:** `9a00d07`, `284c6f6`, `1743a56` (toate pe `main`, împinse pe GitHub)
**Punct de plecare:** „utilizatorul petru.birgoveanu@gmail.com s-a înregistrat și
am primit 2 mailuri în loc de unul — de ce?"

---

## ⚠️ Ce a mai rămas de făcut

**Un singur pas, blocant pentru ca fixurile să fie live:**

**cPanel → Git Version Control → 1. Update from Remote → 2. Deploy HEAD Commit**

Ordinea contează (dacă apeși Deploy fără Update from Remote, se recopiază
versiunea veche din clona de pe server — vezi `HANDOFF-2026-06-15-hero-roluri-bara.md`).
Deployul publică toate cele trei commit-uri deodată. După, Ctrl+F5 pe site.

Restul e gata: SQL rulat, edge function deployat, email retrimis.

---

## Problema 1 — două emailuri „Utilizator nou" la o singură înregistrare

### Ce s-a găsit

Din `notification_log`: edge function-ul a fost apelat **de două ori**, la 0,5
secunde distanță, cu payload identic (același `user_id`).

```
08:41:43.667  slack   new_user  petru.birgoveanu@gmail.com
08:41:44.009  email   new_user  → apartamentual@ltfbstudio.ro
08:41:44.239  slack   new_user  (același payload)
08:41:44.770  email   new_user  → apartamentual@ltfbstudio.ro
```

Nu e o problemă de dublare în `notify-admins` — funcția dedublează destinatarii,
deci un apel = un email. Formularul de profil a fost trimis de două ori.

Notificarea „Utilizator nou" pleacă la **salvarea profilului** în fluxul
`?welcome=1` (`frontend/js/profile-edit-new.js`), nu la înregistrare. Butonul
„Salvează" nu era blocat cât timp salvarea era în curs (~1 secundă, 6 apeluri
Supabase), iar mesajul de succes apărea abia la final → dublu-click = două
salvări în paralel.

Toate celelalte înregistrări din log au o singură notificare. Nu e sistematic.

### Ce s-a făcut — commit `9a00d07`

`frontend/js/profile-edit-new.js`:
- steag global `isSaving` + `if (isSaving) return;` la începutul ambelor handlere
  de submit (activ și profesional);
- helper `setSaving(form, saving)` care dezactivează vizibil butonul („Se
  salvează…", gri, cursor blocat);
- blocarea pornește **după** validare, ca un formular incomplet să rămână
  editabil; pe eroare butonul revine la eticheta originală; pe succes rămâne
  inert până la redirectul de la 1,5s.

### Efect secundar verificat

A doua salvare rula din nou `delete + insert` pe `user_tags` și
`user_preferred_zones`, în paralel cu prima → risc de a pierde selecțiile.
**Profilul lui Petru** (`af8d73a8-7454-4198-99b3-0ae3c5f20be3`) a fost verificat:
15 taguri, 16 zone, fără duplicate, fără lipsuri. Între timp își editase
profilul din nou (la 09:53 UTC), ceea ce a rescris oricum tagurile și zonele.

---

## Problema 2 — 18 emailuri pierdute la Resend

### Ce s-a găsit

Fereastra 08:48–08:50 UTC (10:48–10:50 în panou), la aprobarea a doi membri în
„Parcul Circului,": **50 emailuri încercate, 32 trimise, 18 eșuate.**

| Secunda | Trimise | Eșuate |
|---|---|---|
| 08:48:13 | 2 | 0 |
| 08:48:14 | 12 | **13** |
| 08:48:15 | 6 | 0 |
| 08:49:41 | 10 | **5** |

Cele 13 erori de la 08:48:14 au căzut într-o fereastră de **93 ms** (14.698 →
14.791), unde au ajuns simultan ~16 cereri. Aceleași adrese reușeau cu
milisecunde înainte și după, domeniile erau amestecate (gmail, yahoo, ymail,
adresa noastră) → limitare de rată, nu problemă cu destinatarii.

**Cauza în cod:** broadcasturile trimit câte un apel per membru, fără `await`:

```js
// frontend/grup-details.html:2546 (și 3465, și 3635 cu Promise.all)
for (const email of emails) {
    notifyAdmins('member_joined', { ... });   // fără await → toate deodată
}
```

15 membri = 15 invocări simultane = 15 POST-uri separate la Resend. La 10:48
s-au aprobat doi membri aproape în același timp → ~30 cereri în 1,5 secunde.

**Rezervă onestă:** textul exact al erorii nu se salva nicăieri, deci „429" e o
deducție din tipar, nu o citire directă. Exact asta a rezolvat fixul 3.

**A doua rezervă, mai importantă:** cifra de 18 eșecuri e un **minim, nu un
total**. Scrierea în `notification_log` e și ea best-effort (try/catch, fără
reîncercare), deci sub aceeași încărcare poate să fi eșuat și ea în tăcere.
Ce nu s-a logat nu apare nicăieri. Vezi problema 4.

### Cine a pierdut ceva

În rafala de la 10:48 au fost aprobați **patru** oameni: radulesc, Robert,
CristianH și cristian (gherasim).

**Confirmările „Membru aprobat" către cei aprobați** — 3 din 4 au ajuns:

| Aprobat | Confirmare |
|---|---|
| radulesc | trimisă |
| Robert | trimisă |
| cristian (gherasim) | trimisă |
| CristianH (cristianghita123@gmail.com) | **eșuată** → retrimisă manual pe 26 iulie, 11:46, status OK |

**Către superadmin — 4 încercări, 1 reușită:**

| Notificare | Status |
|---|---|
| „radulesc s-a alăturat" | trimisă — **singura primită** |
| „Robert s-a alăturat" | eșuată |
| „Membru aprobat — radulesc" | eșuată |
| „Membru aprobat — Robert" | eșuată |
| orice despre CristianH | **nicio încercare în jurnal** |
| orice despre gherasim | **nicio încercare în jurnal** |

Confirmat de Lucian: a primit un singur email, cel despre radulesc.

**Către ceilalți membri:** broadcastul „X s-a alăturat" a plecat doar despre
Robert și radulesc — 26 emailuri, din care 10 eșuate. **NEretrimise.**

**Alte pierderi:** 5 membri nu au primit „Grup actualizat" (cristianghita123,
ionutcosminlupu, mihai.ppscu, timestreamer, sld.bogdan). **NEretrimise**,
considerate neimportante.

### Ce s-a făcut — commit `284c6f6`

`supabase/functions/notify-admins/index.ts` — funcția `sendEmailWithRetry`
înlocuiește apelul direct către Resend:
- până la 4 încercări, pauze ~0,4s / 0,8s / 1,6s;
- **plus până la 300ms aleator** — esențial, altfel toate invocările paralele ar
  reveni fix în același moment și s-ar lovi de aceeași limită;
- respectă antetul `retry-after` dacă Resend îl trimite;
- reîncearcă doar 429 și 5xx; o adresă invalidă sau o cheie greșită eșuează
  identic de fiecare dată, nu insistăm.

În cazul de la 10:48, cele 13 emailuri ar fi plecat la a doua/a treia încercare.

**Deployat deja** în Supabase (26 iulie).

---

## Problema 3 — erorile nu erau diagnosticabile

`notification_log` avea doar `status`, fără text de eroare. O notificare picată
apărea în admin ca „Eroare" și atât.

### Ce s-a făcut — tot în commit `284c6f6`

- **`supabase/migrations/035_notification_log_error.sql`** — coloană nouă
  `error` (text, opțională). **RULAT DEJA** în Supabase SQL Editor (26 iulie),
  verificat că există.
- `notify-admins` scrie acolo codul HTTP, mesajul de la Resend și numărul de
  încercări — atât pentru email cât și pentru Slack.
- `frontend/admin-notificari.html` — afișează motivul sub badge-ul roșu,
  prescurtat la 70 caractere, complet la hover. Textul vine de la un serviciu
  extern, deci e escapat (`escHtml` / `escAttr`) înainte de inserare.

**Atenție la ordine, dacă se reface undeva:** întâi SQL-ul, apoi deploy la
funcție. Invers, funcția scrie într-o coloană inexistentă și jurnalizarea eșuează
în tăcere (emailurile pleacă oricum — logarea e best-effort, în try/catch).

Rândurile dinainte de 26 iulie rămân cu `error = NULL`. Informația aia nu s-a
salvat niciodată, e pierdută definitiv.

---

## Problema 4 — două aprobări din patru n-au declanșat nimic

Descoperită la finalul sesiunii, când Lucian a observat că primise un singur
email deși fuseseră aprobați patru oameni.

Pentru aprobările lui **CristianH** și **cristian (gherasim)**, în jurnal există
**doar** confirmarea personală către cel aprobat. Lipsește tot restul fluxului:
broadcastul „X s-a alăturat" către ceilalți membri și ambele apeluri dedicate
superadminului. Zero rânduri, nici măcar cu status „Eroare".

Pentru radulesc și Robert, în schimb, fluxul complet apare în jurnal (parțial
eșuat, dar apare).

**Asta NU e limitarea de rată.** La limitare rămâne urmă în jurnal. Aici nu
există nici măcar încercarea.

### Cauza — reîncărcarea paginii taie cererile în zbor

`notifyAdmins` (`frontend/js/nav.js`) trimite o cerere de rețea către edge
function, iar aprobarea o apela **fără `await`** — „lansează și uită". La final,
aprobarea făcea `setTimeout(() => window.location.reload(), 1000)`.

Când pagina se reîncarcă, browserul **anulează** cererile care n-au apucat să
iasă. Ele nu ajung la edge function → edge function-ul nu rulează → **nu scrie
nimic în `notification_log`**. De-aia lipsesc complet, nu apar nici măcar ca
„Eroare": jurnalul e scris de funcția care n-a fost niciodată apelată.

**De ce exact CristianH și gherasim.** Confirmarea personală (pasul 1) pleacă
imediat după update. Broadcastul și apelurile către superadmin (pașii 2–3) vin
după încă **două** interogări la Supabase. Aprobând patru oameni unul după altul
în ~o secundă, reîncărcarea programată de **prima** aprobare a căzut exact peste
pașii 2–3 ai ultimelor două. Rămâne în jurnal doar pasul 1 — exact ce s-a văzut.

**Cum s-a departajat de explicația „s-au făcut, dar nu s-au jurnalizat":**

- Pasul 3b (`member_approved` către superadmin) e **în afara** oricărui
  try/catch. Nicio eroare JS nu-l poate sări; singurul lucru care oprește
  execuția în afara unui try/catch e plecarea de pe pagină.
- Dacă apelurile s-ar fi făcut, Lucian ar fi primit patru emailuri de
  superadmin, nu unul.
- `grup-details.html` e **singura** pagină care emite `member_approved` /
  `member_joined` — nu există altă cale de aprobare care să explice lipsa.
- Precedent în propriul cod: pe 24 iulie, la linkul de WhatsApp, s-a scris deja
  explicit „trimite cu `Promise.all` AȘTEPTAT ca reload-ul de la 1s să nu taie
  cererile în zbor". Același bug, reparat atunci într-un singur loc.

### Ce s-a făcut — commit `1743a56`

**`frontend/js/nav.js`** — contor global de operațiuni în zbor:

- `notifyAdmins` îl incrementează sincron la pornire (deci prinde și apelurile
  lansate fără `await`) și îl decrementează în `finally`;
- `reloadWhenIdle(delay)` / `navigateWhenIdle(url, delay)` — reîncarcă sau
  navighează **numai după** ce nu mai e nimic în zbor;
- plasă de siguranță de 8s: dacă o cerere rămâne agățată, pagina se reîncarcă
  oricum, ca să nu rămână blocată pe date vechi.

**`frontend/grup-details.html`**:

- toate cele 13 reîncărcări/navigări de pe pagină (aprobare, respingere,
  alăturare, invitație, plecare din grup, transfer admin, voturi) trec prin
  helperii locali `reloadPage()` / `navigatePage()` → nicio acțiune nu mai poate
  tăia emailurile alteia;
- în aprobare, notificările se adună într-o listă și se **așteaptă**
  (`await Promise.all`) înainte de reîncărcare;
- aprobarea e marcată `beginOp()` / `endOp()` pe toată durata ei, ca reîncărcarea
  programată de o aprobare anterioară să nu-i taie mijlocul;
- mesajul „X a fost acceptat în grup!" rămâne instant (aprobarea în sine s-a
  făcut deja în DB) — doar reîncărcarea așteaptă.

Zero atingeri DB, RLS, plăți sau edge functions. Nicio interogare Supabase
modificată. Sintaxa verificată cu Node pe ambele fișiere.

**⏭️ De deployat din cPanel** (împreună cu celelalte commituri, vezi sus).
**Test:** pe un grup de test cu 2–3 cereri în așteptare, aprobă-le rapid una
după alta; în admin → Notificări trebuie să apară fluxul **complet** pentru
fiecare aprobare, nu doar confirmarea personală la ultimele din rafală.

**Limită rămasă, onestă:** dacă tabul e închis manual imediat după aprobare,
emailurile tot se pot pierde. Nimic client-side nu repară asta complet —
reparația durabilă e mutarea difuzării pe server (vezi punctul 1 de mai jos).

Reîncercarea din commit `284c6f6` **nu** acoperea cazul ăsta. Rezolvă doar
notificările care ajung la Resend și sunt respinse.

---

## Deschise pentru sesiuni viitoare

**1. Trimitere în lot la Resend (rădăcina problemei 2 — și jumătate din 4).**
Reîncercarea tratează simptomul. Fixul corect: un singur apel către edge function
cu lista de destinatari, iar funcția să folosească endpointul de trimitere în lot
al Resend (`/emails/batch`) — 15 emailuri într-o cerere în loc de 15 cereri.
Bonus: cu o singură cerere în loc de 15, și fereastra în care reîncărcarea
paginii poate tăia ceva devine mult mai mică. Atinge toate locurile de broadcast
din `frontend/grup-details.html` (aprobare, acceptare invitație, link WhatsApp —
caută `for (const email of emails)` și `Promise.all`) plus edge function-ul.
Merită o sesiune dedicată.

**2. Patru avertismente de tipare preexistente** în `notify-admins/index.ts`:
`error.message` în blocurile `catch`, unde `error` e `unknown`. `deno check` le
semnalează, funcția se deployează normal cu ele. Existau înainte de sesiunea
asta — nu le-am atins ca să nu amestec curățenie nelegată într-o funcție
critică. Fix: `error instanceof Error ? error.message : String(error)`.

**3. Emailurile neretrimise** de la 10:48 (vezi lista de mai sus) — dacă se
consideră că merită, se pot retrimite manual invocând `notify-admins` cu
payload-ul din `notification_log` (coloana `payload` îl păstrează integral).

---

## Comenzi și căi utile

```bash
# Deploy edge function (fără Docker, CLI 2.x)
cd C:\Users\lucia\supabase
npx supabase functions deploy notify-admins
# fișierul se copiază întâi din repo:
#   apartamentual/supabase/functions/notify-admins/index.ts
#   → C:\Users\lucia\supabase\supabase\functions\notify-admins\index.ts

# Verificare tipare
npx deno check supabase/functions/notify-admins/index.ts
```

**Interogări utile** (rulate din consola browserului pe o pagină de admin, cu
sesiune de superadmin — `notification_log` e vizibil doar superadminului):

```js
// Ce a picat într-un interval, cu motiv
const r = await sb.from('notification_log')
  .select('created_at,event_type,channel,recipient,status,error')
  .gte('created_at','2026-07-26T08:48:00Z')
  .lte('created_at','2026-07-26T08:50:30Z')
  .order('created_at', {ascending: true});
```

Pagina de admin ține tot ce a încărcat în variabila globală `allLogs` — utilă
pentru analize rapide fără interogare nouă.

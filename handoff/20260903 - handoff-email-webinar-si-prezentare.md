# Handoff — 3 septembrie 2026
## Emailul de memento pentru webinar (trimis) și prezentarea reconstruită

---

## 1. Emailul de memento · TRIMIS, COMIS, ÎMPINS

**89 de emailuri plecate pe 2 septembrie, 18:21–18:22, zero eșecuri, zero reîncercări.**

Campanie locală după tiparul din `scripts/emailuri-*/`. Comisă în două rânduri:
`67aa3e7` (campania) și `7fa8e49` (o corectură, mai jos).

- Textul: `email_templates/email-webinar-septembrie.md`
- Cifrele: `db_schema/emailuri-webinar-septembrie/0-bilant.sql`
- Lotul: `db_schema/emailuri-webinar-septembrie/1-lot-pentru-email.sql`
- Scriptul: `scripts/emailuri-webinar-septembrie/trimite-emailuri-webinar-septembrie.js`

**Lotul:** 118 profile → 91 după filtre → **89 trimise**. Scoase cu ochiul, nu de cod:
`riltabutru@necub.com` (mail temporar expirat, ar fi fost bounce) și `bogdanbatog@gmail.com`
(omul casei, Gmail personal, pe care filtrul din SQL nu-l prinde).

**Un singur fel de email**, spre deosebire de campania din 25 august care avea patru
variante: butonul duce la Luma, în afara platformei, deci nu contează dacă omul are profilul
terminat, grup sau teren. Singura diferență e salutul: 11 oameni au primit „Salut," simplu,
8 fără pseudonim plus trei porecle adăugate în `SALUT_FARA_NUME` (`deatharrow`, `vultur`,
`alint`).

### ⚠️ Capcana care a cerut un al doilea commit

Adăugasem, ca „plasă de siguranță", numele jurnalului de anti-dublare pe ziua de la
București în loc de ziua UTC. **Raționamentul era greșit exact pe dos.** Cazul nevinovat e
să deschizi jurnalul de IERI: oamenii de ieri sunt săriți, adică protejați. Cazul periculos
e un jurnal GOL, iar el se deschidea: o trimitere la 23:50 re-rulată la 00:10 ar fi trimis
a doua oară către tot lotul.

Reparat în `7fa8e49`: se scrie în fișierul zilei curente, dar setul de „deja trimise" se
adună din **toate** fișierele `trimise-*.json` din folder, deci ora nu mai contează.
Probat pe un folder de test cu un jurnal datat ieri, fără niciun apel de rețea.

⚠️ **Celelalte patru scripturi de campanie au încă varianta veche.** Sunt campanii
încheiate, deci nu e o problemă activă, dar tiparul se copiază: la campania următoare
copiază `emailuri-webinar-septembrie`, nu alta.

---

## 2. Prezentarea de webinar · RECONSTRUITĂ, **NECOMISĂ**

`continut/webinarii/prezentare/` — 25 de slide-uri, HTML de sine stătător.
Se deschide cu dublu-click pe `index.html`. Fără internet, fără server, fără CDN.
Săgeți/spațiu pentru navigare, **F** pentru ecran complet, click dreapta/stânga înainte/înapoi.

| Fișier | |
|---|---|
| `index.html` | 38 KB, prezentarea |
| `img/` | 38 de poze procesate, 12 MB (din 78 MB originale) |
| `fa-pdf.ps1` | face PDF-ul |
| `webinar-septembrie-2026.pdf` | 25 de pagini, 10,7 MB — **rezultat, nu-l comite** |

Originalele stau în `continut/webinarii/20260903/`, 78 MB, **nu se comit**.

### Culorile: paleta „TU", fixă pe capitol

Decizia lui Lucian: cărămiziul `#c2604a` îi dă senzația de șablon, îl vede peste tot.
E scos complet. Paleta e cea a logoului din `frontend/js/nav.js:521`; pe site cele șase
culori se rotesc la 2,4 secunde, **în prezentare nu se mișcă nimic**.

| Capitol | Viu (bulină, linii) | Închis (titlu) |
|---|---|---|
| copertă | `#7a9a90` | `#5a776e` |
| Cine suntem / De ce | `#5e8a6c` | `#53795f` |
| Nu e un model nou (Berlin) | `#5a7196` | `#5a7196` |
| Cum am început (Județului) | `#b8965c` | `#896c3c` |
| Elementele procesului | `#a76782` | `#9f5c79` |
| Mai departe / Întrebări | revine `#5e8a6c` | `#53795f` |

⚠️ **Cele două nuanțe nu sunt interschimbabile.** Măsurat pe cremul `#faf8f3`, doar
albastrul trece pragul de 4,5:1. Ocrul viu e la **2,62:1**, adică invizibil pe proiector.
`--viu` nu se pune niciodată pe text.

### Patru reparații de conținut, cerute de Lucian după feedback

1. **Slide nou, „Cum se formează un grup astăzi"** (17), între povestea lor și elementele
   procesului. Emailul promisese „cum se formează un grup și cum intri într-unul", iar
   prezentarea povestea doar cum au început ei în 2019, cu o pagină de Facebook.
   ⚠️ Tot ce scrie acolo e verificat: grupurile sunt **toate cu aprobare**, mărimea e
   **5-10 familii**, jurnalul îl editează toți membrii. **Nu se promite mesagerie**, nu există.
2. **Slide nou la final, „Ce poți face mai departe"** (24), cu patru acțiuni concrete.
   Se termina pe „Întrebări", fără să spună nimănui ce are de făcut.
3. **„Cine suntem"** cu Liviu Fabian în coloana dreaptă. Numele stau ca titlu de coloană,
   ca să nu înceapă fiecare rând cu „Lucian Luță este". Rândul de jos e la persoana I,
   „Eu, Lucian, sunt și coproprietar acolo" — cu numele în el, fiindcă PDF-ul circulă și
   pe slide sunt două nume.
4. **Slide-ul de cost:** avertismentul mutat **deasupra** cifrei, la aceeași greutate, și
   titlul e acum „Costul, în Germania, în 2014". Cifra `1.000-1.150 €/mp` e cel mai
   fotografiabil lucru din prezentare; într-o captură pleacă singură.

### ⚠️ EXIF Orientation — cauza tuturor reclamațiilor de „rotește poza"

Patru poze au `Orientation = 6` în EXIF. **Pillow nu-l aplică**, deci le-am scris culcate,
deși în orice vizualizator arătau drept. De aici veneau toate cererile de rotire din
sesiune, inclusiv „poza asta e aceeași, doar că e rotită" (chiar era aceeași, culcată de mine).

**Orice script care procesează poze de la Lucian trebuie să înceapă cu
`ImageOps.exif_transpose`.** PNG-urile n-au EXIF; dacă o captură PNG e culcată, e culcată
în pixeli și se rotește de mână.

### ⚠️ Estomparea din capturile de Facebook

`fb-comentarii-01` și `-02` conțin comentarii reale, cu nume și fețe. Estomparea e făcută
prin **pixelare grosieră plus blur**, deci ireversibilă, nu doar un blur care se poate
desface. Dacă se reprocesează pozele alea din originale, **estomparea se pierde** și trebuie
refăcută. Codul e în istoricul sesiunii; regiunile sunt coloana de avataruri plus o bandă
peste fiecare nume.

### Cum se face PDF-ul

```powershell
powershell -ExecutionPolicy Bypass -File fa-pdf.ps1
```

Ctrl+P merge și el, dar cere **„Grafice de fundal" bifat** și **„Margini: fără"**; fără
bifă pleacă fundalul crem și bulinele colorate, adică tot sistemul de culori.

⚠️ Scriptul a fost reparat de două ori în sesiune, ambele defecte tăcute:
- **verifica dacă fișierul există, nu dacă a fost scris acum**, deci raporta „Gata, 10,7 MB"
  măsurând PDF-ul de acum o oră. Acum șterge întâi, reține un reper de timp, și cere ca
  PDF-ul să fie mai nou decât reperul **și** decât `index.html`, plus peste 5 MB;
- **refolosea folderul de profil Chrome**, care rămânea blocat de rularea dinainte și făcea
  Chrome să iasă cu cod 0 fără să scrie nimic. Acum face profil nou la fiecare rulare.

Dacă PDF-ul e deschis într-un vizualizator (inclusiv panoul de previzualizare din Explorer),
scriptul spune asta explicit și iese cu 1.

### Poze nefolosite

`corp-spate-01`, `santier-03`, `santier-06`, `santier-09`. Rămân în folder.
`santier-09` a fost scoasă la cererea lui („arată urât"); ce voia ea să arate, **șapa
flotantă** pentru izolarea la zgomot, a rămas ca bulină pe slide-ul de comunicare.

---

## 3. 🔴 DE FĂCUT, în ordinea urgenței

### a) Evenimentul de octombrie pe Luma — **cel mai urgent**

**Nu e făcut.** Lucian îl face în dimineața de 4 septembrie.

⚠️ **De pe 4 septembrie, homepage-ul minte.** Data de pe site se calculează
(`urmatorulWebinar`, `index.html:3752`) și sare singură la **joi 1 octombrie**, în timp ce
`WEBINAR_URL` rămâne linkul din septembrie. Butonul va scrie „1 octombrie" și va deschide
evenimentul încheiat.

Când vine URL-ul nou, se schimbă în **șase locuri vii**:

| Fișier | Linii |
|---|---|
| `frontend/index.html` | 2113 (hero), 2519 (blocul webinar), 3746 (`WEBINAR_URL`) |
| `frontend/servicii.html` | 141, 313 |
| `supabase/functions/notify-admins/index.ts` | 337 |

Plus, în `notify-admins`, constanta `WEBINAR`: `zi: 'joi, 1 octombrie'`,
`expira: '2026-10-01T21:00:00Z'` (finalul zilei, ora României). **Prima joi din octombrie
2026 este 1 octombrie**, verificat.

⚠️ Primele cinci sunt frontend, deci cer **urcare manuală în cPanel**. A șasea cere
**deploy la `notify-admins`**.

⚠️ **Termen: luni 7 septembrie, ora 10:00**, când pleacă digestul de terenuri. După
`expira`, emailul pleacă în fiecare luni **fără blocul de webinar, fără nicio eroare**.

**Idee de scos problema din calendar definitiv:** dacă Luma are o pagină de calendar a
organizatorului, care arată mereu evenimentul următor, cele șase butoane ar putea duce acolo
și URL-ul n-ar mai trebui schimbat niciodată. De întrebat pe Lucian dacă are așa ceva.

### b) De comis prezentarea

`index.html`, `img/` și `fa-pdf.ps1`. 12 MB o dată. **Nu** PDF-ul (rezultat regenerabil,
10 MB la fiecare modificare în istoric) și **nu** originalele din `20260903/`.

### c) Numele: „Luță", nu „Luța"

Confirmat de el că **ă** e corect. În prezentare e scris corect. CLAUDE.md, `user.name` din
git și site-ul îl au încă greșit. **A spus explicit „nu acum"** pentru corectură. Scrie-l
corect în texte noi, dar nu porni singur schimbarea.

### d) Avertisment pe Slack la expirarea webinarului (opțional)

Ca fereastra lunară să nu mai scape tăcut. `digest-terenuri-zone` trimite deja un rezumat pe
Slack cu patru avertismente de tipul ăsta; un al cincilea ar sta natural lângă ele.
**Cost:** constanta `WEBINAR` e în `notify-admins`, iar rezumatul în `digest-terenuri-zone`,
deci prima trebuie să întoarcă un steag pe care a doua îl citește. Zece linii în două
fișiere, dar **deploy la două edge functions**. Alternativa proastă, de evitat: copierea
datei de expirare și în digest, adică un al cincilea loc în care stă scrisă ora webinarului.

---

## 4. De urmărit acum

Emailul cerea explicit întrebări înainte de webinar, ca răspuns pe
`apartamentual@ltfbstudio.ro`. Dacă răspunde cineva **„stop"**, adresa se trece de mână în
`EXCLUSI_IMPLICIT` din scriptul campaniei: nu există flag de dezabonare pe `profiles`.

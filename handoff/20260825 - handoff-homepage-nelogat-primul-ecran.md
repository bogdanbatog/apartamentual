# Handoff: homepage nelogat, primul ecran rescris

**Data:** 25 august 2026, după-amiaza
**Commit:** `3668fb1`, un singur fișier (`frontend/index.html`), **împins pe `main`**
**Publicat:** ❌ NU. Live-ul e neschimbat, deployul din cPanel nu s-a făcut.
**Pornit de la:** `handoff/20260823 - handoff-analiza-homepage-nelogat.md` (analiza cu cifre)

---

## 1. Ce e gata

Primul ecran al homepage-ului pentru vizitatorul **nelogat**. Pașii 1 și 2 din ordinea de
lucru a analizei (§6). Totul într-un singur fișier, `frontend/index.html`.

| Loc | Ce s-a schimbat |
|---|---|
| Titlu | „Câteva familii își construiesc blocul. Fără dezvoltator." |
| Subtitlu | „Cumpără împreună un teren, participă la proiectare, aleg constructorul, iar apartamentele rămân ale lor. Se numește Baugruppen, e obișnuit în Germania, iar în București există deja primul bloc construit cu ajutorul apartamenTUal." |
| Buton principal | „Vezi terenurile din zona ta →" către `/terenuri.html` (era Luma) |
| Buton secundar | „Înscrie-te la webinar · joi 3 septembrie, gratuit" (era ancora `#cum-incepi`) |
| Eticheta de deasupra titlului | ștearsă („Platformă de construcție colaborativă") |
| Nota de sub butoane | ștearsă |
| Dovada | timelapse-ul a urcat de la 25% adâncime, imediat sub hero, în casetă 16:9 |
| Linia de sub timelapse | „Județului Housing, București · teren cu calcan lângă un parc · 5 apartamente · spațiu comun, terasă și curte verde · în finalizare" |
| Bara de pătrate | rămâne, dar sub dovadă |
| Aerul de sus, pe telefon | 133px → 20px |
| Echipa | „, primul din România" tăiat |

**Neatins:** hero-urile A și B (logat, agenție), spațiul de lucru, „Cum începi", tot ce e mai
jos în pagină, plățile, orice fetch către Supabase. Singura atingere de JavaScript sunt cele
10 linii din `scrieDataWebinarului()` care scriu data și pe butonul din hero.

---

## 2. Deciziile de conținut, cu motivele lor

Toate sunt scrise și ca avertismente în comentariile din `index.html`, lângă textele
respective. Sunt aici ca să nu se piardă raționamentul.

1. **Titlul are 56 de semne, nu 85.** Varianta 1 din analiză („Câteva familii cumpără
   împreună un teren și își construiesc blocul. Fără dezvoltator.") a fost aleasă pe 24
   august, dar la probă pe telefon ocupa șase rânduri și împingea butoanele sub marginea
   ecranului. „Cumpără împreună un teren" a coborât în subtitlu, unde era oricum nevoie de el.

2. **NU se scrie „primul din România" sau „primul bloc construit așa".** În anii '50 s-au
   construit la noi blocuri prin cooperative de locuințe, cu sprijinul statului (credit sau
   teren, mai ales pentru muncitori). Cine e „primul" e o dezbatere de istorici, pe care n-o
   câștigăm și n-o vrem. Formularea care rămâne adevărată: **„primul bloc construit cu
   ajutorul apartamenTUal"**. Scos din două locuri: hero și Echipa.

3. **NU se scrie „terminat" și NU se scrie „gata".** Blocul e ridicat, dar în finalizare.
   Timelapse-ul arată fațada gata, deci tentația e mare. Citatul lui Tiberiu din aceeași
   pagină îl contrazice pe cine scrie altfel: „Abia așteptăm să ne bucurăm de noua noastră casă".

4. **NU se scrie „își aleg arhitectul".** A fost în subtitlu câteva ore. Mulți oameni înțeleg
   oricum că proiectul se face cu noi, iar propoziția scotea în față tocmai libertatea de a
   lucra cu altcineva. Formularea lui Lucian: **„participă la proiectare"**. „Aleg
   constructorul" rămâne, e adevărat (grupul a ales Mozaic Engineering) și nu atinge aceeași coardă.

5. **Rândul despre bani a fost scris și apoi scos**, la cererea lui Lucian („Contul e gratuit.
   Plătești doar dacă ceri o analiză de teren sau consultanță."). ⚠️ Consecința rămâne: cea
   mai mare obiecție nespusă, „ce plătesc eu aici?", n-are răspuns pe primul ecran, iar
   `/servicii.html` primește 160 de vizitatori din 2.577. Locul unde stătea e marcat în cod.

6. **Filmulețul e 16:9, caseta era 16:7**, de aceea avea dungi negre în lateral. Caseta a luat
   proporția filmului. Alternativa (bandă lată, film mărit până acoperă) tăia 22% din
   înălțime, adică macaraua și ultimul etaj. Respinsă.

---

## 3. Ce urmează, în ordine

Toate sunt din analiza de pe 23 august, §5.3 și §6.

1. **Mută video-ul cu Lucian lângă testimonialul lui Tiberiu**, la circa 30% adâncime. Azi
   secțiunea `<!-- ── VIDEO ── -->` e între Echipa și News. Testimonialul e deja la locul
   potrivit, a urcat singur când a plecat timelapse-ul de acolo.
   ⚠️ **Se face cu Edit pe text exact, nu cu script.** Vezi §5.
2. **Contopește cele trei blocuri care spun același lucru:** „Cum a devenit posibil" (12%),
   „Ce câștigi când construiești colaborativ?" (35%), bullet-urile de lângă video (62%).
   Toate trei zic: fără marja dezvoltatorului, tu decizi, îți alegi vecinii. Propunerea, ne
   discutată încă: rămâne formularea din „Ce câștigi", plus un al patrulea punct nou, **„Nu
   ești singur"** (arhitecți, juriști, constructor, coordonare la fiecare pas), care răspunde
   la frica reală „nu știu să fac asta". E singurul text nou din tot pasul.
3. **Un singur bloc de webinar** în loc de două. Al doilea (`.cta-final`) e la 85% adâncime,
   adică invizibil.
4. **FAQ-ul de pe homepage, de la 39 de întrebări la 6**, cu link către restul.
5. **Diacriticele din `frontend/js/faq.js`** (39 de întrebări) plus cele 5 liniuțe lungi din
   el. Sesiune separată, e curățenie, nu design. Vezi NOTES.

---

## 4. Comenzi concrete

**Serverul de previzualizare** (pornit detașat, supraviețuiește între ture):

```powershell
Start-Process -FilePath "C:\Python314\python.exe" `
  -ArgumentList "-m","http.server","8777","--bind","127.0.0.1" `
  -WorkingDirectory "C:\Users\lucia\proiecte\apartamentual\frontend" -WindowStyle Hidden
```

- pagina: `http://127.0.0.1:8777/index.html`
- ⚠️ **OBLIGATORIU în fereastră privată.** Browserul lui Lucian are o sesiune veche de test pe
  portul 8777, iar logat vezi spațiul de lucru, nu pagina de marketing. Plus **Ctrl+Shift+R**.
- se oprește cu `Get-Process python | Stop-Process`

**Macheta de comparat titluri** (fișiere netrackuite, ca celelalte `_*.html`):
`http://127.0.0.1:8777/_macheta-hero-nelogat.html` — patru lungimi de titlu, trei feluri de
dovadă, comutator desktop/telefon, riglă cu „câte rânduri · câte semne". A fost folosită ca să
se aleagă titlul. **Nu mai e sursa de adevăr**, `index.html` a luat-o înainte.

**Publicarea, când va fi cazul:** un singur fișier, `frontend/index.html`, urcat manual din
cPanel, apoi Ctrl+Shift+R. CSS-ul și JS-ul modificate sunt scrise ÎN pagină, nu în fișiere
separate, deci o reîncărcare simplă arată versiunea din cache.

---

## 5. Capcane, din care una plătită azi

**🔴 Mutarea blocurilor cu script prinde comentariile CSS.** `index.html` are peste 5.000 de
linii, cu tot CSS-ul inline, iar fiecare secțiune apare de **două ori** cu același titlu în
casetă de linii: `/* ── VIDEO ── */` în foaia de stil și `<!-- ── VIDEO ── -->` în markup. Un
script care caută „prima linie care conține `── VIDEO ──`" îl prinde pe primul, iar „primul
`  </section>` de după" e la 1.100 de linii mai jos. Așa au ajuns azi 1.139 de linii mutate, cu
CSS în mijlocul markup-ului. La reparație s-a repetat identic greșeala, cu
`── CREDIBILITY BAND ──`. **Regula de acum: mutările se fac cu Edit pe text exact.** Dacă tot
scrii script, ancorează potrivirea (`x.lstrip().startswith('<!--')`) și fă întâi o copie în
scratchpad, fiindcă `git checkout` ar arunca modificările nesalvate ale sesiunii.
**Proba că nu s-a rupt nimic:** `git diff -U0 | grep "^@@"`. Un bloc mutat din greșeală sare
în ochi ca o pereche de hunk-uri de sute de linii. Greșeala **nu se vede în pagină**: browserul
ignoră liniile de CSS ajunse în `<body>` și afișează totul aparent normal.

**⚠️ `hidden` nu ascunde nimic dacă elementul are `display` pus dintr-o clasă.** În machetă,
rândul etichetei rămăsese pe ecran, gol, dar cu bulina teracotă în el, fiindcă `.eyebrow` are
`display:flex`. În `index.html` cazul e tratat corect peste tot (`.hero[hidden]`,
`.micro[hidden]`, `#bloc-stare[hidden]`, `#spatiul-tau[hidden]`).

**⚠️ Blocul de dovadă stă ÎN `.hero-stage`**, nu după el, fiindcă paleta pământie
(`--terracotta`, `--sage`…) e definită acolo, nu pe `:root`. Scos din ambalaj, ar randa fără culori.

**⚠️ Iframe-ul timelapse-ului trebuie să păstreze ambele clase** (`video-ph video-ph--live`)
oriunde ar fi mutat: scriptul de sesiune îi golește `src`-ul căutând `.video-ph--live iframe`,
ca să nu se încarce un player YouTube invizibil pentru cei logați.

**⚠️ În Plausible se schimbă valorile lui `dest` pe `loc=hero`** (principalul: webinar →
terenuri, secundarul: cum-incepi → webinar). Numele evenimentului rămâne `CTA Click`, deci nu
iese din raportul comun, dar în grafic linia veche se oprește și începe una nouă.

**⚠️ Data webinarului de pe butonul din hero NU e scrisă de mână.** O pune
`scrieDataWebinarului()` în `#webinarDataScurt`, din aceeași socoteală ca panoul de mai jos
(prima joi a lunii). Ce e scris în HTML e doar plasa de siguranță.

---

## 6. Restanțe nelegate de homepage

- **Joi 27 august: emailul cu terenuri noi**, pornit manual cu `force`. Vezi handoff-ul din 23
  august, §7, pentru ordinea comenzilor. Apoi `3-programare.sql` și prima rulare automată luni 31.
  ⚠️ De verificat înainte: butonul din emailul acela e probabil tot negru (`#1a1a1a`).
- **`notify-admins` tot nedeployat.**
- **`52aabf1` (`grup-details.html`) nu se știe dacă a ajuns pe live.**

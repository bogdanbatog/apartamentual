# Handoff, 16 august 2026: homepage-ul utilizatorului logat, profil obligatoriu, spațiul de lucru

**Sesiune lungă.** Două commituri făcute și netrimise, plus o machetă aprobată pentru
ce urmează. Citește secțiunea „De unde continui" înainte de orice.

---

## Starea la închiderea sesiunii

| | |
|---|---|
| Commituri făcute | `888fc1d` (homepage logat), `f2424da` (profil obligatoriu) |
| Push | **NU.** Nimic trimis pe GitHub |
| Publicat pe site | **NU.** Publicarea se face manual din cPanel, push-ul nu deployează |
| Machete pe disc, netrackuite | `frontend/_macheta-spatiu-lucru.html`, `frontend/_variante-hero.html` |

Cele două machete **nu se comit**, dar **nu se șterg**: sunt singura descriere a formei
aprobate pentru spațiul de lucru. Se deschid cu un server local:

```
cd C:\Users\lucia\proiecte\apartamentual\frontend
python -m http.server 8899 --bind 127.0.0.1
```

- `http://127.0.0.1:8899/_macheta-spatiu-lucru.html` — forma aprobată, cu comutator
  între „utilizator nou" și „are teren și grup"
- `http://127.0.0.1:8899/_variante-hero.html` — homepage-ul real cu date false, patru
  variante de la 1 teren la 12 terenuri și 5 grupuri

---

## De unde continui

Două lucruri, în ordinea asta:

### 1. Compatibilitatea pe zone în `index.html` (mic, se termină repede)

**Decizia lui Lucian:** compatibilitatea se calculează **întâi pe zone comune**, apoi
interesele se afișează doar informativ.

Astăzi există o inconsecvență reală în platformă:

| Unde | Cum ordonează |
|---|---|
| `js/utilizatori.js:238` | zone comune, apoi interese ✅ deja corect |
| `index.html`, `populateVariantA` | **interese**, iar cine n-are niciun interes comun e **exclus complet** ❌ |

Consecința azi: un om cu 5 zone comune și 0 interese comune nu apare deloc în pătratele
din hero, deși e primul pe pagina Utilizatori.

**De făcut:** în `populateVariantA` din `index.html`, scoate filtrul `commonTags > 0`,
sortează după `commonZones` și abia apoi după `commonTags`, iar eticheta de pe pătrat
devine „N zone · M interese" în loc de „N interese".

**Întrebare rămasă deschisă:** ce arătăm cuiva cu **zero zone comune** cu oricine? Listă
goală, sau coborâm pe interese ca plasă de siguranță? Lucian n-a răspuns.

### 2. Spațiul de lucru pe homepage (mare, mai multe sesiuni)

Forma e aprobată în machetă. Vezi „Ce s-a hotărât despre spațiul de lucru" mai jos.

---

## Ce s-a livrat azi

### `888fc1d` — Homepage logat

Pentru **conturile personale logate**, homepage-ul devine hub de acțiune.

- Cei doi pași (teren, grup) stau **în hero**, unde erau butoanele „Vezi terenuri" și
  „Grupuri în formare". Măsurătoarea care a forțat decizia: meniu 93 + hero 350 (limita
  de jos, sub ea se suprapun pătratele cu vecini) + bara de apartamente 122 + bloc 352
  = **941px pe un ecran de 731px**. Pe primul ecran încăpea hero-ul SAU blocul.
- Pasul nebifat își explică urmarea într-un rând. Pasul bifat nu e fundătură: duce mai
  departe (terenul direct dacă e unul singur, numele grupurilor cu link, maximum trei).
- **Nu există pas pentru profil.** Formularul de profil nu se poate salva parțial, iar
  `nav.js` duce la profil pe oricine e logat fără el.
- Se ascund 8 elemente: banda de credibilitate, „Cum a devenit posibil", timelapse și
  legenda lui, citatul, „Ce câștigi", echipa, CTA-ul final.
- **Rămân** galeria Județului, video-ul fondatorului și FAQ-ul. Motivul, dat de Lucian:
  187 de intrări directe în site au fost pe pagini de grup, deci sunt oameni care s-au
  înregistrat fără să vadă vreodată homepage-ul.
- Link nou sub galerie către `/povestea-noastra.html`, **vizibil pentru toată lumea**.
  Pagina nu e în meniul principal (`nav.js:383` are 6 intrări, fără ea), iar singurele
  două linkuri către ea de pe homepage stăteau în Echipa și în CTA-ul final, adică fix
  în secțiunile acum ascunse.
- Plausible: evenimentul existent `CTA Click` cu `loc=bloc-stare`, **nu** nume noi.

### `f2424da` — Profil obligatoriu

Verificarea stă în `nav.js`, în același bloc cu cea de cont suspendat, și refolosește
aceeași interogare (trei coloane în plus, nu o a doua lovitură în baza de date).

**FAIL OPEN.** Dacă interogarea pică sau întoarce ceva neclar, nu redirectăm pe nimeni.
Codul rulează pe fiecare pagină; o eroare de drepturi nu are voie să încuie oameni afară.

Excepții, toate probate cu codul real rulat cu sesiuni simulate:

- conturile de **agenție** (au alt formular de profil, fără camerele/suprafața/zonele
  cerute de `profil_complet`, deci ar fi blocate definitiv, fără scăpare)
- **adminii și superadminii** (contul de superadmin al lui Lucian chiar pică testul azi)
- paginile: profil, register, reset-parola, termeni, gdpr, politici, accept-invite

---

## Cifre măsurate azi, de refolosit

Din `db_schema/emailuri-profil-incomplet/0-bilant.sql`, rulat de Lucian (CSV în
`screenshots/20260816/`):

| | |
|---|---|
| Conturi personale vii (fără ale noastre, fără demo) | 87 |
| Cu profil complet | 73 |
| Cu profil incomplet | 14 |
| Din care nu și-au confirmat emailul (nu se pot loga) | 3 |
| **Chiar blocați de zid la următoarea intrare** | **11** |
| Din cei 11, cu pseudonim | **0** (deci niciunul nu apare pe platformă) |
| Din cei 11, au primit deja emailul din iulie | 6 |

**Decizia:** nu se mai trimite email. Un al treilea mesaj către cine a ignorat unul nu
schimbă nimic, iar zidul ajunge în clipa în care omul e prezent și poate rezolva.

Reconcilierea cu ce se vede pe platformă: lista Utilizatori arată **83** (Lucian vede 82,
fiindcă `utilizatori.js:221` îl scoate pe cel logat din listă) = 73 reali cu profil
complet + 5 marcate `is_demo` + 5 conturi ale noastre cu pseudonim.

---

## Ce s-a hotărât despre spațiul de lucru (de construit)

**Arhitectura, decisă de Lucian:** nu o pagină nouă. Trei spații personale (profil,
homepage personal, panou) ar fi prea mult. Homepage-ul logat **devine** spațiul de lucru,
iar la final rămân câteva secțiuni ca punct de referință.

Structura aprobată:

1. **Hero** — titlu unic „Spațiul tău, {nume}." (fără „Bun venit înapoi" și „Bun găsit",
   dublau formula de salut). Subtitlul e **cuprinsul**: linkuri cu săgeată în jos către
   fiecare categorie. Rezumat: câte terenuri, în ce grup, câte noutăți. **Fără** faza
   grupului (apare oricum în cardul grupului). **Fără** rândul „N vecini". Pătratele din
   dreapta = primii utilizatori după **zone comune**, etichetă „N zone · M interese".
2. **Spațiul de lucru**, fără titlu de secțiune și fără eyebrow (titlul din hero le
   acoperă). Categorii, fiecare cu titlul ei:
   - Ce e nou pentru tine
   - Terenurile tale
   - Grupurile tale
   - **Utilizatori compatibili cu tine** (nou)
   - **Grupuri care caută în zonele tale** (nou)
   - Pașii până la recepție
   - Notele tale
3. **„Ce poți face cu terenurile și grupurile"** — fostul „Cum începi", retitulat pentru
   cine a avansat. Conține lista de cinci puncte scrisă de Lucian despre ce poți face cu
   un teren, care până acum n-avea unde sta.
4. **Referință**: banner webinar, galeria Județului, newsletter, video fondator, News, FAQ.

**Cardurile de teren se strâng.** Închis: nume, suprafață, preț, plus starea pe scurt
(„✓ Analiză · 6 apartamente · 3 interesați" sau „Fără analiză · Nimeni interesat încă").
Deschis: nota ta și ce poți face. Primul deschis, restul închise. Cu 6 terenuri: 669px
toate închise, 961px la intrare, 1545px toate deschise.

**Hero-ul nu trimite în afara paginii.** Totul se centralizează în spațiul lui; de acolo
pleacă mai departe dacă vrea.

### Ce există deja și NU se construiește

| Ce | Unde |
|---|---|
| Note personale pe teren | tabela `user_teren_notes`, funcțional pe profil |
| Pașii cu bife, detalii, note și fișiere per pas | `grup_checklist` + `_notes` + `_files`, în `grup-details.html:1900` (`CHECKLIST_PHASES`, 4 faze, 30 de rânduri din care 26 pași reali) |
| Dacă terenul are analiză | `analiza_generala_status`, `analiza_specifica_status` |
| Cine e interesat de teren | pagina terenului |

### Ce nu există deloc

- **Fluxul de noutăți.** Piesa cea mai mare. Se poate face **fără migrație** în prima
  versiune: toate datele se pot calcula la citire. Tabelă de notificări e nevoie abia
  când vrem „citit/necitit" și emailuri.
- Fișiere atașate la terenurile personale (există doar la pașii din checklistul grupului)
- Zonă de note personale generale

### Decizia care ține totul în picioare

**Pașii NU se copiază pe profil.** Sunt decizii ale grupului („Contract de asociere",
„Achiziționare teren", „Constructor selectat"). Dacă lista ar sta pe profilul personal,
cinci membri ai aceluiași grup ar avea cinci adevăruri despre același lucru. În spațiul
de lucru se afișează **aceleași date** din checklistul grupului; cine n-are grup îi vede
doar de citit, ca să știe ce-l așteaptă.

---

## Decizii de conținut luate azi

**Cele patru funcții inexistente trec la viitor.** În textul scris de Lucian erau descrise
la prezent, dar nu există în cod: centralizatorul de comunicare, „Organizarea pe
apartamente", planificatorul de plăți, modelul de contract de asociere. În machetă poartă
eticheta „în viitor".

**DTAC se recomandă DUPĂ proiectul tehnic.** Astăzi platforma spune două lucruri diferite:
`grup-details.html`, la pasul `f3_dtac`, scrie că „în mod uzual se elaborează înaintea
fazei PTh"; cronologia din `cum-functioneaza.html` pune PTh înaintea DTAC. **Decizia lui
Lucian: după proiectul tehnic.** De aliniat în ambele locuri.

**„7 etape" e greșit și a fost corectat.** Cifra nu există nicăieri: `cum-functioneaza.html`
are 4 faze, checklistul are 4 faze cu 26 de pași. Cei 7 veneau din lista de intrare de pe
homepage (`#cum-incepi`), care descrie pașii de **dinainte** de grup. În `index.html` scrie
acum „în patru faze".

⏳ **Rămâne de decis unde duce acel link.** Acum duce la `/ce-este/cum-functioneaza.html`,
care e un ghid lung. Pentru cineva care are deja grup, checklistul grupului lui ar fi mai
util. Semnul e lăsat în cod, lângă text.

---

## Capcane găsite azi, de reținut

**Browserul cache-uiește `js/nav.js` fără versiune în URL, iar `_headers` nu setează
nicio regulă de cache.** Prima jumătate de oră de testare a dat rezultate false din
cauza asta. Consecință reală: **după publicare, zidul nu se aplică până nu li se
împrospătează cache-ul utilizatorilor.** La testare, `Ctrl+Shift+R` obligatoriu.

**Ștergerea unei zone din `zones` poate acum bloca oameni.** `user_preferred_zones.zone_id`
e `ON DELETE CASCADE`, deci ștergerea unei zone șterge tăcut preferințele. Cine rămâne cu
zero zone are profil incomplet și **lovește zidul** data viitoare când intră. Regula
„mută întâi, șterge după" era deja necesară; acum costul uitării ei e mai mare.

**`nav.js` e învelit într-un IIFE**, deci funcțiile lui nu sunt accesibile din afară. Ca
să testezi logica din el, fă o pagină care definește un `sb` fals **înainte** de a încărca
`nav.js`, nu una care încearcă să apeleze funcțiile după.

**Hero-ul are ordini explicite pe ecrane sub 980px** (`.eyebrow` order:1, `.title` order:2,
`.cluster` order:3…). Orice copil nou al hero-ului fără `order` cade pe 0 și ajunge
**deasupra titlului**. S-a întâmplat cu `#bloc-stare`, reparat.

**Clusterul de vecini e `position:absolute` întins pe înălțimea hero-ului.** Sub ~350px
pătratele se suprapun. E limita de jos la orice strângere a hero-ului.

---

## Ce nu e testat pe date reale

**Starea cu grupuri.** Ambele conturi ale lui Lucian (`luta.lucian.m@gmail.com` și
`lucianluta@yahoo.com`) au **0 grupuri și 0 terenuri**, iar cel de superadmin are și
profilul incomplet. Handoff-ul anterior presupunea că Lucian e în situația „toate bifate";
nu e adevărat pe niciunul din conturi. Randarea cu grupuri a fost probată doar cu date
puse de mână, prin rularea codului real cu răspunsuri Supabase simulate.

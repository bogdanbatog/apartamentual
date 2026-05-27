# HANDOFF — Integrare homepage v9 în site-ul existent

> **Pentru:** Claude Code pe laptop, în folderul `C:\Users\lucia\proiecte\apartamentual\`
> **De la:** Sesiunea anterioară (chat web Claude)
> **Data:** 27 mai 2026

---

## Context

Lucian a construit un homepage nou (v9) folosind Claude Design, ca **mockup vizual cu design și texte noi**. L-am procesat și i-am despachetat fontu-urile și imaginile, dar acum trebuie integrat în site-ul real existent.

**Problema:** Homepage-ul v9 e un fișier standalone. Nu folosește header-ul, footer-ul, FAQ-ul, butonul „Cere consultanță" sau alte componente comune ale site-ului existent. Toate linkurile sunt rupte când e deschis fără context.

**Obiectiv:** Înlocuim homepage-ul actual cu un homepage **integrat** care folosește toate componentele existente ale site-ului, dar păstrează design-ul și textele noi din v9.

---

## Resurse disponibile

### În folderul `homepage-v9-package/` (pe Desktop sau Downloads):
- `index.html` — homepage v9 standalone (53 KB) — **REFERINȚĂ VIZUALĂ + TEXTE**
- `assets/images/echipa/lucian-luta.jpg` — portret Lucian (124 KB, 600×600)
- `assets/images/echipa/liviu-fabian.jpg` — portret Liviu (99 KB, 600×600)
- `assets/images/judetul-housing/fotografii/` — 12 fotografii pătrate (1200×1200) Strada Județului
- `assets/images/judetul-housing/randari/` — 2 randări (1200×1200): fațada stradă + fațada curte

### În repo (`C:\Users\lucia\proiecte\apartamentual\`):
- `index.html` — homepage-ul actual
- Toate paginile existente: `terenuri.html`, `utilizatori.html`, `grupuri.html`, `parteneri.html`, `register.html`, `povestea-noastra.html`, `ce-este/...`
- Header-ul comun (probabil în `index.html` sau în fișier separat)
- Footer-ul comun (cu LTFB SRL, Netopia, ANPC, SAL — vezi structura completă mai jos)
- FAQ-ul (probabil `faq.html` sau echivalent) — 5 categorii: Concept, Platformă, Juridic & Financiar, Proces practic, Teren & Construcție
- Butonul „Cere consultanță" flotant pe toate paginile

---

## Plan de lucru — recomandat

### Faza 1 — Audit (citește fără să modifici)

Citește în ordine:
1. `CLAUDE.md` (instrucțiuni proiect)
2. `NOTES.md` (stadiu actual)
3. `HANDOFF.md` (de la sesiunea anterioară)
4. `index.html` (homepage actual — header, footer, FAQ, JavaScript)
5. Pagina FAQ existentă (caută `faq.html` sau referințe în nav)
6. Orice fișier CSS/JS partajat
7. Homepage-ul v9 (referință vizuală — îl primești de la Lucian)

Apoi prezintă un **diff conceptual**:
- Ce design folosește homepage-ul actual?
- Ce structură de header/footer?
- Cum e implementat FAQ-ul?
- Cum e implementat butonul „Cere consultanță"?
- Ce diferă față de v9?

### Faza 2 — Plan de integrare

Înainte să modifici ceva, prezintă-i lui Lucian un plan clar cu:
- Ce secțiuni din v9 păstrăm vizual
- Ce înlocuim cu componente existente
- Ce fișiere modificăm
- Care e ordinea modificărilor

Așteaptă aprobarea lui Lucian.

### Faza 3 — Implementare

Pe scurt:

#### 3.1 Păstrează din v9:
- Hero cu titlu nou (texte exacte din v9)
- Squares animation (SVG cu pătrate colorate care apar/dispar)
- Cred-band cu cele 3 mesaje
- Secțiunea „Cum a devenit posibil" (model-layout cu cele 2 carduri)
- Video timelapse (YouTube ID: `bfW2DJ1_du4`)
- Quote familie T.M.
- Secțiunea „Avantaje" (cu textele NOI din v9)
- CTA punchy webinar
- Steps 01-04 (cu textele NOI din v9)
- Carusel imagini Strada Județului
- Echipa (cu portrete reale + bio NOU)
- Video Lucian explică (cu descrierea NOUĂ)
- Cycle de culori pentru TU/tău (animația cu paleta hex)

#### 3.2 Înlocuiește cu componente existente:
- **Header:** scoate header-ul din v9, folosește header-ul comun al site-ului
- **Footer:** scoate footer-ul simplu din v9, folosește footer-ul existent care are:
  - Coloana 1: ApartamenTUal + tagline
  - Coloana 2: NAVIGARE (Acasă, Ce este, Povestea noastră, Terenuri, Utilizatori, Grupuri, Parteneri)
  - Coloana 3: LEGAL (Termeni și condiții, GDPR, Politica de retur, FAQ, Ghid platformă, Contact)
  - Bara firmă: SC LTFB Studio SRL · CUI: RO22004992 · Reg. Com.: J2007012417402 · Sediu: Str. Popa Petre 23, Sector 2, București · Telefon: +40 723 870 834 · Email: office@ltfbstudio.ro
  - Logos: Netopia Payments + Visa
  - Link-uri: ANPC, SAL, Platforma SAL
  - Copyright: © 2026 ApartamenTUal. Toate drepturile rezervate.
- **FAQ:** scoate FAQ-ul standalone din v9 (cele 4 întrebări placeholder). Folosește FAQ-ul existent cu 5 categorii și zeci de întrebări. Probabil afișezi un widget compact pe homepage (gen primele 5 întrebări din categoria „Concept") cu link „Vezi toate întrebările" către pagina FAQ completă.
- **Buton „Cere consultanță":** adaugă butonul flotant existent (probabil în colțul dreapta-jos, cu icon de mesaj + text).

#### 3.3 Link-uri de conectat:
Toate aceste linkuri din v9 trebuie să meargă la paginile reale:
| Link în v9 | Trebuie să ducă la |
|---|---|
| Hero CTA primar „Înscrie-te la webinar" | https://luma.com/ba9sq1yp (target=_blank) |
| Hero CTA secundar „Cum funcționează" | /ce-este/#cum-functioneaza |
| Card negru „Află mai multe" | /ce-este/ |
| Toate cele 3 CTA-uri „Înscrie-te la webinar" | https://luma.com/ba9sq1yp (target=_blank) |
| Echipa: „Citește povestea noastră" | /povestea-noastra.html |
| Articol News 1: Cohousing De Sijs | https://apartamentual.ro/news.html#cohousing-de-sijs-officeu-architects-mllju41i |
| Articol News 2: Brutopia | https://apartamentual.ro/news.html#brutopia-stekke-fraas-mllkph1u |
| Vezi toate articolele | /news.html |

#### 3.4 Imagini de mutat:
Copiază din `homepage-v9-package/assets/images/` în repo în `assets/images/` (sau orice structură folosește deja repo-ul pentru imagini).

**Verifică structura existentă în repo înainte!** Dacă deja există `assets/images/` folosit de alte pagini, integrează-te în structura existentă. Dacă nu există, creează folderele.

### Faza 4 — Test local

Înainte de commit:
- Deschide noul `index.html` în browser
- Verifică că toate linkurile merg pe paginile reale
- Verifică că imaginile se încarcă
- Verifică că video-urile pornesc
- Verifică că FAQ-ul afișează întrebări reale
- Verifică că butonul „Cere consultanță" funcționează

### Faza 5 — Commit + Deploy

- Backup homepage-ul vechi în `_archive/index-v8.html`
- Înlocuiește `index.html` cu cel nou
- Comite cu mesaj clar: `feat(homepage): integrare v9 (design + texte noi + componente existente)`
- Push pe GitHub
- Așteaptă deploy Render (~2-3 min)
- Verifică pe apartamentual.ro

---

## Modificări specifice de text (v9 vs v8) — pentru verificare

Acestea sunt textele NOI care trebuie să apară în homepage-ul final integrat:

### Hero
**Titlu:** „Cauți demult un apartament în zonă bună, la preț corect."
**Subtitlu:** „5 familii din București s-au oprit din căutat și au construit propriul bloc, susținute de experți la fiecare pas. Și tu poți avea apartamentul dorit, fără dezvoltator."
**CTA primar:** „Înscrie-te la webinar →" (https://luma.com/ba9sq1yp, target=_blank)
**CTA secundar:** „Cum funcționează" (/ce-este/#cum-functioneaza)
**Notă:** „Pune întrebări fondatorilor · Zoom · Gratuit"

### Avantaj 1 — „Fără marja dezvoltatorului"
> Toți banii tăi rămân în apartamentul tău. Niciun cost ascuns: fiecare buget e văzut și aprobat de grup, de la teren până la **finalizarea blocului**.

### Avantaj 2 — „Tu decizi ce construiești"
> Zona, suprafața, configurația, finisajele. Nu primești un **plan standardizat**, construiești ce ai nevoie de la zero.

### Step 01
> Pe platformă găsești terenuri propuse și verificate în zonele care te interesează. Prin ApartamenTUal afli câte apartamente se pot construi și care e costul estimativ **după experiența blocului din Strada Județului**.
> *Avantaj:* Știi ce poți construi pe el înainte să cumperi ceva.

### Step 02
> Platforma te conectează cu familii interesate de aceeași zonă și primești consultanță completă: ce se poate construi pe terenul ales, cum arată apartamentul tău, **cum să înaintați tehnic, legal, financiar**.
> *Avantaj:* Cunoști vecinii, **îți croiești apartamentul** și ai consultanța necesară pentru a înainta.

### Step 04
> Procesul e ghidat complet, **de la achiziție teren, la autorizații până la finalizarea execuției**. Juridic, financiar, arhitectural, fiecare etapă coordonată.
> *Avantaj:* Sprijiniți la fiecare pas.

### Echipă (bio nou)
> Arhitecți cu aproape 20 de ani de experiență în București, fondatorii LTFB Studio. Au proiectat școli, birouri și locuințe, mereu cu același unghi: **spații identitare care creează comunitate**.
>
> Prin ApartamenTUal **își doresc să creeze un hub al construcțiilor colaborative și să mute centrul de greutate al locuirii spre cei care chiar vor locui în acele spații**.
>
> Blocul de pe Strada Județului e primul lor proiect de acest fel, primul din România.

### Video Lucian (descriere)
> **Arhitectul** Lucian Luta explică modelul de construcție colaborativă.

---

## Probleme cunoscute care trebuie evitate

1. **Nu duplica header-ul/footer-ul.** Site-ul existent are probabil un sistem de includere (PHP, fetch JS, sau copy-paste). Respectă convenția.

2. **FAQ-ul nu se rescrie.** Pe pagina FAQ există deja zeci de întrebări organizate pe categorii. Pe homepage doar afișezi o secțiune redusă (ex: primele 5 din Concept) cu link către pagina completă.

3. **Imaginile carusel** așteaptă căile: `assets/images/judetul-housing/fotografii/01-...jpg` etc. Dacă repo-ul folosește altă structură (`img/`, `static/`, `public/`), adaptează căile.

4. **Squares animation + culori TU/tău** — sunt definite în `<script>` la finalul body-ului în v9. Trebuie portate cu CSS-ul aferent.

5. **Fonturile Google** — v9 folosește Mona Sans + JetBrains Mono. Verifică dacă restul site-ului folosește alt font (ex: Inter). Decizie: păstrăm Mona Sans pe homepage și se va alinia treptat și restul, SAU adaptăm homepage-ul la fontul existent pe site.

6. **Buton „Cere consultanță"** — există probabil ca element global în footer sau ca widget fix. Verifică implementarea actuală și replicheaz-o.

---

## Workflow git

```bash
# Înainte de a începe
git status
git pull origin main

# Backup
mkdir -p _archive
cp index.html _archive/index-v8-pre-integrare.html

# După integrare
git add .
git status
git diff index.html | head -200

# Commit cu Lucian
# (cere aprobare înainte de commit, conform CLAUDE.md regula 1)
git commit -m "feat(homepage): integrare v9 cu componente existente

- Hero cu titlu și subtitlu actualizate
- Texte noi în avantaje și steps
- Bio fondatori actualizat
- Portrete reale Lucian + Liviu
- Carusel imagini Strada Județului (12 fotografii + 2 randări)
- Link-uri webinar către luma.com/ba9sq1yp
- Video timelapse actualizat (bfW2DJ1_du4)
- Folosește header/footer/FAQ existente
- Păstrează butonul Cere consultanță"

git push origin main
```

---

## La final, scrie un nou HANDOFF.md

După ce integrarea e finalizată și deployată, actualizează HANDOFF.md cu:
- Ce s-a făcut în această sesiune
- Probleme întâmpinate și cum s-au rezolvat
- Ce mai rămâne de făcut (vezi NOTES.md)
- Comenzi specifice pentru sesiunea următoare

---

---

## CHECKPOINT sesiune 28 mai 2026 — audit făcut + decizii luate

### Realitatea repo-ului (diferă de presupunerile de mai sus)
- HTML-urile sunt în `frontend/`, NU în rădăcină. Homepage real = `frontend/index.html`.
- Pachetul v9 a fost copiat ca `package-homepage-v9/` (nu `homepage-v9-package/`). Conține deja imaginile redenumite curat (`lucian-luta.jpg`, `liviu-fabian.jpg`, folder `judetul-housing/`).
- Folderul `assets/` de la rădăcină = dump separat, mizerios (TIFF + zip-uri, „Judetului Housing" cu spații), NEFOLOSIT de v9.

### Cum se conectează componentele comune (prin injecție JS)
- `<div id="navigation">` → `js/nav.js` (umple nav-ul + adaugă AUTOMAT FAB „Cere consultanță" → `/consultanta.html` + buton scroll-to-top). FAB-ul vine gratuit dacă încarc nav.js.
- `<div id="footer">` → `js/footer.js` (footer slate închis cu bara firmă LTFB SRL/CUI/Reg.Com./sediu/tel/email + logo Netopia + ANPC/SAL/Platforma SAL + copyright).
- `<div id="faq-container">` → `js/faq.js` (randează TOT FAQ-ul: 39 întrebări, 5 categorii cu tab-uri; stiluri proprii DM Sans + accent portocaliu #f97316).
- Dependențe nav/footer/faq: `js/supabase-config.js`, `nav.css`, Font Awesome, `js/login-modal.js`.

### Decizii luate (28 mai)
1. **Font:** Mona Sans + JetBrains Mono (din v9).
2. **Nav/footer:** păstrez shell-ul vizual v9, conectez link-urile la paginile reale, adaug manual FAB-ul „Cere consultanță" + bara legală Netopia/ANPC/firmă în footer-ul v9. (NU folosim nav.js/footer.js ca atare, ca să păstrăm look-ul v9.)
3. **FAQ:** `faq.js` complet inline (39 întrebări). Va fi o insulă vizuală (stil diferit de v9) — acceptat.
4. **CTA final v9** (`/strada-judetului.html`, pagină inexistentă) → `/povestea-noastra.html`.
5. **Imagini:** copiez `package-homepage-v9/assets/` → `frontend/assets/`. (Pachetul are deja nume curate; fără conversie TIFF.)

### De corectat obligatoriu la implementare
- **`js/faq.js`** categoria „Concept", întrebarea 2 conține „economia poate fi de 15-30%" → ÎNCALCĂ regula CLAUDE.md despre procente. De corectat (diff separat).

### Rămas de confirmat
- Ștergerea folderului `assets/` vechi de la rădăcină (netracked, nefolosit).

### Pași rămași
- Pasul 2: copiez assets-urile pachetului în `frontend/assets/`.
- Pasul 3: construiesc `frontend/index.html` nou pe baza `package-homepage-v9/index.html` cu: font Mona Sans păstrat, link-uri reale, ancore `#navigation`/`#footer`/`#faq-container` + scripturile comune, FAB + bara legală, CTA final → povestea-noastra, fix 15-30% în faq.js.
- Pasul 4: test local. Pasul 5: backup `_archive/index-pre-v9.html` + diff + aprobare + commit + push.

---

**Importante de știut despre Lucian:**
- E arhitect, nu developer
- Lucrează cu Git via interfața GitHub web (sau Claude Code îl ajută)
- Vrea diff înainte de commit (regula 1 din CLAUDE.md)
- Toate răspunsurile în română
- Nu menționa procente specifice de economisire
- Distincția Baugruppen vs cohousing e importantă (folosește „grupuri de construcție")

Mult succes!

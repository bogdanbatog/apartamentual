# HANDOFF — ApartamenTUal

> Status curent al proiectului. Citește la începutul fiecărei sesiuni noi (chat sau Claude Code) ca să intri rapid în context.
> Ultima actualizare: 5 iunie 2026 (sesiune v9: devino-partener, ghid, news migrate la design v9 + reparat BUG header/footer lipsă pe ghid și news — placeholder cu id greșit)

---

## ⏭️ DE ÎNCEPUT ÎN SESIUNEA URMĂTOARE (după /clear)

**Niciun task obligatoriu în desfășurare — alege unul dintre cele de pe orizont.** Ultimele două sesiuni (flash header + curățare cod mort) sunt închise și deployate. Recomandate, în ordinea valorii:

1. **Aliniere v9 — paginile rămase** (cel mai vizibil progres). Pagini nemigrate la design system v9: `terenuri`, `grupuri`, `utilizatori`, `analize`, `comanda-analiza`, `teren-details`, `grup-detail`. (DONE: `ce-este/*`, `povestea-noastra`, `parteneri`, `gdpr`, `termeni`, `politica-retur`, `contact`, `register`, `consultanta`, **`devino-partener`, `ghid`, `news`**.) **La fiecare pagină verifică: placeholder-ul de header e exact `<div id="navigation">` (nu `nav`/`main-nav`) și există `<div id="footer">` — altfel chrome-ul nu se injectează (bug găsit pe ghid/news).** Pe fiecare: link `css/apartamentual-v9.css`, scos `<link href="/nav.css">` (devine mort DOAR după ce pagina are v9 — vezi nota despre nav.css mai jos), aliniat corpul la componentele v9. ATENȚIE la paginile cu fetch Supabase (terenuri, grupuri, utilizatori, teren-details, comanda-analiza) — doar straturi vizuale, NU schimba structura DOM; pe paginile cu markup generat din JS NU schimba numele claselor (vezi pattern-ul de la `parteneri`). Strategie agreată: **C (hibrid)** — fundație CSS comună + rafinare pagină cu pagină. Un task = o sesiune; ia 2-3 pagini odată, nu toate. **Trei pattern-uri refolosibile pt. migrare:** (a) pagini-document Tailwind text lung → `css/document.css` (clasa `.legal-doc`); (b) pagini Tailwind cu accente colorate → bloc `<style>` în-pagină scoped sub `.v9-page` pe `<main>` (vezi `contact`/`register`); (c) pagini cu `<style>` propriu → reskin în-pagină (vezi `consultanta`/`politica-retur`).
2. **Automatizare deploy cPanel** — acum Lucian dă manual „Update from Remote" + „Deploy HEAD Commit" după fiecare push. De automatizat (webhook GitHub→cPanel).

**Notă legată de nav.css (descoperită 6 iunie):** `nav.css` NU e cod mort cât timp paginile nu sunt migrate la v9 — el rezervă înălțimea header-ului (`#navigation { min-height:69px }`) ȘI încarcă fontul DM Sans pe ~25 de pagini. Pe măsură ce o pagină primește `apartamentual-v9.css`, ABIA ATUNCI se poate scoate `<link href="/nav.css">` de pe ea. Deci curățarea referințelor nav.css merge mână în mână cu migrarea v9, nu separat.

---

## Status general

Platformă activă pe https://apartamentual.ro, hostată pe Render, backend Supabase.
Pilot real în curs: **Județului Housing** (București, 5 familii, aproape de mutare).
Lansare publică iminentă, dar nu există dată fixă.

---

## Echipă

- **Lucian Marius Luța** (eu) — co-fondator LTFB Studio și ApartamenTUal
- **Liviu Fabian** — co-fondator LTFB Studio și ApartamenTUal
- **Ina German** — în discuție pentru asociere. Arhitect cu experiență tech și comunicare. **Nu formalizată încă.**

Împărțirea rolurilor între noi trei nu e stabilită. Nu presupune.

---

## Ce e finalizat și stabil

- Sistem de notificări (21 evenimente)
- Flux registrare (signup → verificare email → profile → homepage)
- Admin panel complet
- Integrare Oblio + Netopia (edge functions deployate)
- Database curat, migrațiile prin 029
- **Homepage v9 integrat și LIVE** (28 mai) — design + texte noi (Claude Design), font Mona Sans, portrete reale + carusel Strada Județului, footer cu secțiunile reale (Navigare/Legal) + bara firmă/Netopia/ANPC, FAQ real complet, timelapse în buclă, video cu buton play sub față, preview News din Supabase. Backup vechi în `_archive/index-pre-v9.html`. Detalii: `HANDOFF-integrare-homepage-v9.md`.
- **Header + footer v9 unificat pe toate paginile interioare** (2 iunie, commit `864240c`) — `frontend/js/nav.js` și `frontend/js/footer.js` rescrise integral în stil v9 (Mona Sans, fundal crem, badge BETA, „Povestea noastră" în nav și footer, „Acasă" scoasă din ambele — click pe logo duce acasă). Logica auth (login, avatar+dropdown, mobile menu, blocare cont suspendat) păstrată 1:1. Banda firmă LTFB + Netopia + ANPC păstrată integral în footer. Butoanele flotante „Cere consultanță" și scroll-to-top restilizate v9. CTA-urile page-specifice „Propune teren" / „Creează grup" scoase din header (vor reapărea mai vizibil în corpul paginilor). Pe `parteneri.html` s-a descoperit că `fab-consultanta.js` era de fapt o copie veche a nav.js mascată sub alt nume — scos din pagină. Pe `povestea-noastra.html` lipsea `<script src="js/nav.js">` — adăugat.
- **Polish header v9** (2–3 iunie, commits `d3f72db`, `bf91ebf`, `959953b`, `30b5885`, `0097cb6`):
  - Scos badge BETA de peste tot.
  - Redenumită clasa internă `logo-text` → `logo-mark` (eliminat conflict cu `utilizatori.css .logo-text { font-size:1.5rem }` care făcea logo-ul mai mare doar pe pagina utilizatori).
  - Fix flash de auth: ambele variante (avatar + login) ascunse inițial; `checkAuthState` decide ce afișează → fără mai apare „Intră în cont" → avatar la fiecare load când userul e logat.
  - Fix flash de header vechi pe `utilizatori.html` și `grupuri.html`: nav-ul vechi inline (`<nav class="navbar">` / `<nav class="main-nav">`) eliminat complet, înlocuit cu `<div id="navigation"></div>`. Mai rămân de curățat astfel: `terenuri.html`, `grup-details.html`, `grup-edit.html`, `grup-nou.html`.
  - Homepage trecut la `<div id="navigation"></div>` + Supabase SDK + supabase-config.js + login-modal.js + nav.js (toate scripturile la finalul body, în aceeași ordine ca pe paginile interioare). Header-ul de pe homepage acum identic poziționat cu restul (banda crem full-width).
  - Auth-aware nav pe homepage: când nelogat → „Intră în cont" (link text) + „Creează cont" (buton chenar); când logat → avatar+dropdown.
  - CTA „Cum funcționează" din hero homepage → link la subpagina `/ce-este/cum-functioneaza.html` (înainte trimitea la `/ce-este/#cum-functioneaza`, hash spre o secțiune).
- **Aliniere corp pagini la v9 — secțiunea `ce-este/` (3 iunie)** — pas 1 din migrarea graficii v9 pe restul site-ului. Creat `frontend/css/apartamentual-v9.css` = fundația CSS comună pentru **corpul** paginilor (tokenuri `:root`, tipografie, butoane `.cta-primary/.cta-secondary`, `.section`, `.card`, `.avantaje`, `.steps`, `.faq`, `.cta-final`, footer), extrasă 1:1 din homepage. Migrate toate cele 6 pagini din `ce-este/`:
  - `ce-este/index.html` (hub) rescris complet în v9 (hero, carduri-hub crem, `.avantaje`, `.cta-final`); scos Tailwind + styles.css + stilurile slate/portocaliu.
  - Celelalte 5 (`prezentare-generala`, `cum-functioneaza`, `exemple-europa`, `legislatia-romania`, `testimoniale`): `ce-este/ce-este.css` rescris în paletă v9 (hero crem, secțiuni soft, tabele/tip-uri/stat-uri ink) + strat override scoped `.ce-content` pentru rămășițe Tailwind (bg-orange/amber, buton portocaliu, numere colorate). Head curățat: scos `/nav.css`, adăugat `apartamentual-v9.css`, scos `bg-gray-50/text-gray-900` de pe body. Tailwind + styles.css **păstrate** (markup-ul depinde de ele). Diagrama de proces din `cum-functioneaza` recolorată monocrom ink.
  - **Conținut**: corectate 3 promisiuni de procent de economie din `testimoniale.html` („25%", „20% economie") → mesaj conform („toți banii rămân în apartament"). **REZOLVAT (5 iunie)**: proiectul fabricat („Parcul Circului" + stats inventate) înlocuit cu testimonialul real Tiberiu M. (Județului Housing) — vezi blocul „Sesiune polish v9 (5 iunie)" mai jos.
  - Strategie agreată pentru restul: **C (hibrid)** = fundație CSS comună + rafinare pagină cu pagină.
- **Aliniere corp pagini la v9 — povestea-noastra + parteneri (3 iunie)** — pasul 2. Ambele migrate prin reskin în-pagină: scos DM Sans + `nav.css`, legat `apartamentual-v9.css`, blocul `<style>` propriu rescris în paletă v9 (crem/ink), păstrând structura HTML + layout-ul specific + logica.
  - `povestea-noastra.html` (commit `7c17f24`): hero video pe ink, articol long-form, figuri, autori; butoane final → `.cta-primary/.cta-secondary`.
  - `parteneri.html` (commit `175fd3a`): ATENȚIE — cardurile sunt generate din JS, deci numele de clase (`partner-card`, `badge-verified/featured`, `btn-website/email`, `cat-pill`…) NU se schimbă, doar valorile CSS. Hero + banner CTA pe ink.
  - Pattern reutilizabil pt. pagini cu hero full-bleed: `#navigation{ margin-bottom:0 }` (anulează spațiul rezervat din v9).
- **Culori ce-este: pasteluri, NU monocrom (3 iunie, commit `b215ada`)** — Lucian a cerut explicit culoare (pală) pe carduri și pe diagrama fazelor, NU monocrom ink. Schimbat:
  - `ce-este.css`: override-ul Tailwind `bg-*-50` din `.ce-content` (care aplatiza cardurile la crem) → **pasteluri soft din paleta de accent v9** (ardezie `#e9eef3`, salvie `#e9f0ea`, ocru `#f5efe1`, mov pal `#f0eaef`, teracotă `#f6ebe6`, cărămiziu `#f6eae9`), text negru lizibil.
  - `cum-functioneaza.html`: headerele fazelor 1-4 din gradient verde/mov/gri-închis → pasteluri cu text ink; puncte + bara de timeline în tonuri saturate (`#5a7196`/`#b8965c`/`#c2604a`/`#8f5a48`); caseta „Te muți în casa ta!" din fundal închis → pastel cu text ink. (Înlocuiește nota mai veche „diagrama recolorată monocrom ink".)
  - **Regula de culoare a lui Lucian**: fundalurile pot fi colorate dar PALE, ca textul negru să rămână lizibil; NU negru/gri-închis cu text negru; a respins verde `#16a34a`, mov `#7c3aed`, gri-închis pe headere.
- **Toate cele de mai sus sunt pe `main`** (PR #1 fuzionat, commit merge `f098320`). Rămâne doar deploy-ul din cPanel (checkout `main` → Update from Remote → Deploy HEAD Commit).
- **Sesiune polish v9 (5 iunie) — totul pe `main`, împins, NEDEPLOYAT încă din cPanel**:
  - `7b1b452` Testimonial real **Tiberiu M.** (Județului Housing) în loc de cel fabricat („Parcul Circului" + stats inventate) în `ce-este/testimoniale.html`; atribuirea citatului aliniată și pe homepage (T.M. → Tiberiu M.) + formulare identică. (Notă: „Parcul Circului" ca **reper geografic** în `povestea-noastra.html` e legitim — terenul real de pe Str. Județului e lângă Parcul Circului; NU e fabricație.)
  - `1cc05ef` Scos cardul „Testimoniale" din hub-ul `ce-este/` + cele 2 cross-linkuri „Continuă să explorezi" (testimonialul unic nu justifică secțiune proeminentă). Pagina `testimoniale.html` rămâne accesibilă direct prin URL.
  - `39ef02d` „by LTFB Studio" apropiat de logo (gap 10→5px) + aliniat la baseline (în `nav.js`).
  - `71c87a6` Diagrama „Cronologia unui proiect" din `cum-functioneaza`: carduri **verticale** (1→2→3→4) în loc de zigzag cu săgeți, săgeți scoase, numere păstrate; culori per fază mai distincte (1 albastru `#e9eef3`, 2 verde `#e7f0e8`, 3 ocru `#f5efda`, 4 teracotă `#f3e3dc` — toate pale); bara „durată estimată" primește exact aceleași culori ca punctele/cardurile.
  - `ae63f5c` Banda de credibilitate de pe homepage (cele 3 fraze sub grafica cu pătrate) distribuită echidistant (`justify-content:space-between`), scoase separatoarele „·".
  - `1c438b9` **Header fix și identic pe toate paginile**: scoasă excepția de homepage din `nav.js` — zona din dreapta arată aceleași elemente peste tot pentru nelogați („Intră în cont" + „Creează cont"), cu lățime fixă (`min-width:200px`). Nu mai „sare" header-ul între homepage și restul, nici între logat/nelogat (cerculețul-avatar ocupă același spațiu).
  - `0233d86` Eliminată **linia dublă + saltul** header-ului la încărcare: scoasă linia-placeholder `box-shadow inset` de pe `#navigation` (în `apartamentual-v9.css` + `index.html`); `.site-nav` are acum **înălțime fixă 68px** (band = 69px) = spațiul rezervat, deci nu mai depinde de stare/font; rezervare mobil 77→69px.
  - `3c55677` `povestea-noastra`: adăugat SDK-ul Supabase (lipsea → `supabase-config.js` crăpa pe `window.supabase` undefined → `checkAuthState` nu rula → butoanele auth rămâneau ascunse). `terenuri`: nav vechi inline → `<div id="navigation">` (fără flash portocaliu „Propune teren").
  - `24af9c9` Același fix de flash pe `grup-details`, `grup-edit`, `grup-nou` (nav vechi `<nav class="main-nav">` inline → `<div id="navigation">`).
- **Sesiune flash header (5 iunie, seara) — totul pe `main`, împins, NEDEPLOYAT încă din cPanel**:
  - `fecf80c` **Font Awesome pe homepage**: `index.html` era SINGURA pagină din 41 care nu încărca Font Awesome → iconițele injectate de `nav.js` (`fa-user` pe avatar, `fa-arrow-up` pe scroll-to-top, plus dropdown profil + burger mobil) rămâneau invizibile (doar cerculețe goale). Adăugat `<link>`-ul 6.5.1 de pe cdnjs, identic cu restul paginilor.
  - `15f3397` **Eliminat flash-ul de header gol la refresh/navigare**: în `nav.js`, codul care desenează header-ul + butoanele flotante a fost mutat dintr-un handler `DOMContentLoaded` (care se declanșa abia după ce se descărcau TOATE scripturile, inclusiv bundle-ul mare Supabase) într-o funcție `initChrome()` apelată **imediat** (dacă `document.body` există deja — adevărat la finalul body-ului; altfel cade pe DOMContentLoaded). Pe homepage am reordonat și scripturile: `nav.js` primul, înaintea Supabase SDK → header-ul apare aproape instant; starea auth (avatar) se completează prin polling-ul existent după `sb`.
  - `e5246f7` Aceeași reordonare (`nav.js` primul) pe **9 pagini** care aveau Supabase + config + login + nav.js grupate la finalul body-ului: `grupuri`, `terenuri`, `utilizatori`, `analize`, `analiza-detaliata`, `analiza-simplificata`, `comanda-analiza`, `termeni-analize`, `ghid`.
  - ⏭️ **Rămâne** (vezi blocul de la începutul fișierului): paginile cu Supabase în `<head>` + `nav.js` singur la final — header-ul tot apare la finalul parsării body-ului. De abordat la începutul sesiunii următoare.
- **Sesiune v9 pagini legale (5 iunie) — pe `main`, commit `4bfabc9`, NEDEPLOYAT încă din cPanel**:
  - Migrate la design v9: **`gdpr.html`**, **`termeni.html`**, **`politica-retur.html`**. Niciun text juridic atins — doar straturi vizuale.
  - **Fișier nou `css/document.css`** (refolosibil): reskin v9 pentru paginile-document Tailwind, totul scoped sub clasa `.legal-doc` (carduri crem-soft, Mona Sans, linkuri ink). Rescrie utilitarele Tailwind colorate fără să atingă markup-ul: `.legal-doc .bg-blue-50/green-50/...` → pasteluri v9, `.legal-doc .border-blue-500/...` (cele 4 temeiuri GDPR) → cele 4 tonuri aprobate (ardezie `#5a7196`, ocru `#b8965c`, teracotă `#c2604a`, cărămiziu `#8f5a48`). Funcționează indiferent de ordinea față de Tailwind: `.legal-doc .clasă` (0-2-0) bate utilitarele (0-1-0).
  - `gdpr` + `termeni`: în head scos `/nav.css`, adăugat `apartamentual-v9.css` + `document.css`; pe body scos `bg-white text-gray-900` (preia crem/ink din v9); pe containerul `.max-w-4xl mx-auto` adăugat clasa `legal-doc`.
  - `politica-retur` (avea `<style>` propriu slate/portocaliu + DM Sans): reskin în-pagină ca povestea/parteneri — scos DM Sans + `nav.css`, adăugat `apartamentual-v9.css`, blocul `<style>` (clase `pr-*`) rescris în paletă v9 (hero pe ink, secțiuni crem-soft, portocaliul `#f97316` → ink/pasteluri, callout cu accent ink la stânga ca `.family-quote`), `#navigation{ margin-bottom:0 }` pt. hero full-bleed. Tailwind CDN rămâne încărcat dar nefolosit (doar `pr-*`) — curățare opțională ulterioară.

---

- **Sesiune v9 devino-partener/ghid/news (5 iunie) — pe `main`, commit `d249779`, NEDEPLOYAT încă din cPanel**:
  - Migrate la design v9, **doar straturi vizuale** (niciun JS / fetch Supabase / logică formular atinsă).
  - **🐛 BUG reparat — header/footer lipsă din placeholder cu id greșit**: `nav.js` injectează DOAR în `getElementById('navigation')`, `footer.js` DOAR în `getElementById('footer')`. `ghid` avea `<div id="nav">` → fără header; `news` avea `<nav id="main-nav">` → fără header + nu avea deloc `<div id="footer">` → fără footer. Reparat la ambele (`<div id="navigation">` + adăugat `<div id="footer">` la news).
  - `devino-partener` + `news` + `ghid` (toate aveau `<style>` propriu slate/portocaliu) → reskin în-pagină ca `consultanta`/`politica-retur`: hero pe ink, carduri/formulare crem-soft, accente portocaliu/albastru → ink, fundaluri colorate → pasteluri v9 aprobate. Iconițele celor 5 secțiuni din `ghid` + cele 4 faze din checklist mapate pe cele 4 tonuri aprobate (ardezie `#5a7196`, ocru `#b8965c`, teracotă `#c2604a`, cărămiziu `#8f5a48`). `nav.css` → `apartamentual-v9.css`; scos fontul DM Sans (devino, ghid).

- **Sesiune v9 contact/register/consultanta (5 iunie) — pe `main`, commit `7b53236`, NEDEPLOYAT încă din cPanel**:
  - Migrate la design v9, **doar straturi vizuale** (niciun JS / fetch Supabase / logică de formular atinsă):
  - `consultanta.html` (avea `<style>` propriu slate/portocaliu) → reskin în-pagină ca `politica-retur`: hero gradient slate → ink plin, card formular cu umbră → border subtil v9, info-box slate → crem-soft, inputuri/pills focus portocaliu `#d97706` → ink, buton submit slate → ink, nota „gratuită" + link succes portocaliu → tonuri v9, `#navigation{margin-bottom:0}` pt. hero full-bleed.
  - `contact.html` + `register.html` (Tailwind + styles.css) → **pattern nou `.v9-page`**: `nav.css` → `apartamentual-v9.css`, scos `bg-*/text-*` Tailwind de pe body, clasă `v9-page` pe `<main>`, bloc `<style>` în-pagină care rescrie accentele colorate prin `.v9-page .clasă` (0-2-0 bate utilitarele Tailwind 0-1-0): albastru→ardezie, mov→cărămiziu pal, galben→ocru, verde→salvie, portocaliu→ink. Pe register, culorile inline (checkbox `accent-color`, cerc+plic „verifică email") editate direct → ink.
  - ⚠️ FAQ-ul de pe `contact` e generat de `js/faq.js`, **partajat cu homepage-ul live** (accente portocalii hardcodate în JS) — lăsat NEATINS; recolorarea lui ar schimba și homepage-ul, e decizie separată.

## Ce e în lucru sau pe orizont apropiat

- **Aliniere v9 — paginile rămase** (după `ce-este/`, `povestea-noastra`, `parteneri`, `gdpr`, `termeni`, `politica-retur`, `contact`, `register`, `consultanta`, `devino-partener`, `ghid`, `news`, deja făcute): terenuri, grupuri, utilizatori, analize, comanda-analiza, teren-details, grup-detail. (Rămase mai delicate — majoritatea cu fetch Supabase; comanda-analiza atinge zona de plăți.) Pe fiecare: link `css/apartamentual-v9.css`, scos `/nav.css` (mort), aliniat corpul la componentele v9. Atenție la paginile cu fetch Supabase (terenuri, grupuri, utilizatori, teren-details, comanda-analiza) — doar straturi vizuale, fără structură DOM; pe paginile unde markup-ul e generat din JS, NU schimba numele de clase (vezi pattern-ul de la `parteneri`).

- **Automatizare deploy** — apartamentual.ro se deployează prin **cPanel** (NU Render, cum scrie CLAUDE.md): `.cpanel.yml` copiază `frontend/*` în `/home/ar4/app.ltfbstudio.ro/`. Momentan Lucian dă manual din cPanel „Update from Remote" + „Deploy HEAD Commit" după fiecare push. De automatizat (webhook GitHub→cPanel sau remote git direct care rulează `.cpanel.yml` la push).
- **Cod mort + flash header rămas de curățat după unificarea header/footer v9**:
  - **Flash de header vechi — REZOLVAT (5 iunie)** pe `terenuri.html`, `grup-details.html`, `grup-edit.html`, `grup-nou.html` (toate trecute la `<div id="navigation"></div>`). Nu mai sunt pagini cunoscute cu nav vechi inline.
  - `frontend/nav.css` — **NU e complet mort, NU șterge încă (6 iunie).** Clasele `.unified-nav-*` (liniile 1-293) sunt moarte (nav.js generează acum `.site-nav-*`), DAR: (1) blocul `#navigation { min-height:69px; background:#faf8f3 }` de la final rezervă înălțimea header-ului — pe cele ~25 de pagini care includ `nav.css` dar NU `apartamentual-v9.css`, e SINGURA sursă a rezervării (scoaterea → revine saltul vertical al header-ului); (2) `@import` DM Sans + Mona Sans — DM Sans e folosit activ în corpul multor pagini (`terenuri.css`, `utilizatori.css`, `grupuri.css`, inline). Concluzie: scoaterea `nav.css` ține de **migrarea v9** (fiecare pagină primește `apartamentual-v9.css` → abia atunci renunță la `nav.css`), nu de curățarea de cod mort. Notă: blocul `#navigation` din nav.css încă are linia `box-shadow inset` (linia dublă scoasă din v9 prin `0233d86`) — de aliniat când se migrează paginile.
  - `frontend/js/fab-consultanta.js` (227 linii) + `frontend/fab-consultanta.css` (76 linii) — **ȘTERSE (6 iunie)**, 303 linii cod mort. Copie veche a nav.js, neutilizate (referința fusese deja scoasă de pe parteneri.html).
  - În `nav.js`, mecanismul page-specific CTA (`ctaButton` din `getPageConfig`) rămâne dar nicio ramură nu îl mai setează. De curățat când e clar că nu mai e nevoie de el.
- **Patch analiza-simplificata.html** (înlocuire pop-up vechi cu link la /comanda-analiza.html)
- **Solicită aprobare Netopia** + test plată reală
- **Migrare domeniu** apartamentual.onrender.com → apartamentual.ro (DNS + URL-uri în cod și Supabase Auth)
- **Transfer ownership Render** către luta.lucian.m@gmail.com
- **MFA** pe contul Supabase admin

---

## Setup tehnic Claude Code (NOU, 20 mai)

- Instalat pe laptop, versiunea 2.1.144 (update automat a eșuat — TODO: claude doctor sau npm i -g)
- Logat cu contul `office@ltfbstudio.ro` (LTFB Studio Organization, plan Max)
- Username GitHub: `lutalucianm-lang`
- Repo clonat local la: `C:\Users\lucia\proiecte\apartamentual`
- CLAUDE.md în repo (cu reguli de siguranță, echipă, ton, juridic ca trimitere la pagina site)
- NOTES.md în repo (cu 5 observații tehnice din prima sesiune)
- Workflow ales: SQL manual + deploy edge functions manual (prudent la început)

---

## Decizii deschise (de luat în curând)

1. **Forma juridică ApartamenTUal**: SRL nou separat sau sub LTFB? Cum intră Ina? — **Necesită avocat de start-up** (NU de imobiliar)
2. **Organizație GitHub vs. cont personal** — în discuție cu Ina, ea propune să facă ea organizația
3. **Contul Claude Code**: rămân pe LTFB sau trec pe personal? — provizoriu LTFB
4. **Cele 5 observații tehnice din NOTES.md** — abordate când ajung pe rol

---

## Ce să NU faci fără confirmare explicită

- Commit/push pe repo fără diff arătat
- Modificări la logica de plată (Netopia/Oblio)
- Rulare directă migrații DB (eu rulez manual în SQL Editor)
- Decizii despre echipă (cine ce rol)
- Decizii despre forma juridică

---

## Resurse rapide

- Site: https://apartamentual.ro
- Repo: https://github.com/bogdanbatog/apartamentual
- Supabase project: glbvbbgmcobtswwlktic
- Slack: #app_events
- Pilot: Județului Housing (București)

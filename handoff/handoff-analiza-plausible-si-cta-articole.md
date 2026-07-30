# Handoff — Analiză Plausible + fix măsurare și CTA în articole

**Data:** 30 iulie 2026 (actualizat seara)
**Stare:** cod comis și pushat pe GitHub, **NU e încă live** (așteaptă upload cPanel)

---

## 1. Ce s-a făcut în sesiune

Patru commit-uri, în **două** fișiere:

| Commit | Fișier | Ce face |
|---|---|---|
| `fbde097` | `news.html` | `plausible.init({ hashBasedRouting: true })` — Plausible vede navigarea între articole |
| `f3c6f11` | `news.html` | CTA către `/grupuri.html` și `/terenuri.html` la mijlocul și la finalul articolului |
| `0e8abdc` | `news.html` | scoate dublarea linkului către episodul următor din caseta de final |
| `7f5793b` | `index.html` | tagged events Plausible pe cele 7 CTA-uri din homepage |

**⚠️ De urcat în cPanel: `frontend/news.html` ȘI `frontend/index.html`.** Niciunul nu e live.

### Detaliu `7f5793b` — de ce există etichete ciudate în `class`

**Nu e o greșeală, nu le șterge.** Cele trei butoane „Înscrie-te la webinar" (hero `:1525`, blocul webinar `:1649`, CTA final `:1879`) duc **toate la același URL** `luma.com/iwbly27g` — deci în Plausible apărea un singur număr de outbound, imposibil de atribuit unei poziții din pagină. La fel, „Cum funcționează" din hero nu se putea distinge de click-ul din meniul de sus.

Soluția: tagged events Plausible, prin clase pe linkurile existente. Un goal **`CTA Click`** cu două proprietăți:

| `loc` (unde în pagină) | `dest` (încotro) |
|---|---|
| `hero` | webinar · cum-functioneaza |
| `bloc-webinar` | webinar · register |
| `pasi` | register |
| `final` | webinar · povestea |

Zero JS nou, zero CSS — clasele noi n-au reguli de stil, butoanele arată identic (verificat local: padding, colțuri, fundal neschimbate).

Sintaxa e confirmată direct din sursa scriptului: regex `plausible-event-(.+)(=|--)(.+)` cu `r.replace(/\+/g," ")` — deci `CTA+Click` devine `CTA Click`.

⚠️ **Nu s-a putut testa end-to-end local:** scriptul Plausible refuză prin construcție să trimită de pe `127.0.0.1` (verificare `/^localhost$|^127(\.[0-9]+){0,2}\.[0-9]+$/` în sursă) și blochează și `navigator.webdriver`. Se confirmă doar pe domeniul live.

**Pas în dashboard:** Plausible → Site Settings → Goals → Custom event → `CTA Click` (cu spațiu, majuscule exact așa). Defalcarea pe butoane se vede în tab-ul **Properties** al goal-ului.

### Detaliu `0e8abdc` — dublarea din caseta de final

Caseta de final de episod repeta linkul către episodul următor („Episodul 1 e aici: …→"), care era deja afișat în cardul de navigare de deasupra (`episode-nav`). Aceeași informație de două ori, una sub alta.

- **Scos:** rândul `episodeOutroNext` din casetă + CSS-ul `.episode-outro__next`.
- **Păstrat neatins:** cardul de navigare `episode-nav` (titlu + săgeata orizontală), la cererea lui Lucian.
- **Uniformizat:** textul de deasupra formularului e acum mereu „Primește episoadele direct pe email:". Înainte varia între „Primește-**l** direct pe email" (singular, când episodul următor nu era publicat) și plural — de aici inconsistența dintre episoade.
- **Teaser neschimbat ca logică:** „Episodul 2 vine în curând…" apare doar pe finalul Episodului 1 **și** doar dacă episodul următor nu e publicat. Cum Episodul 2 e publicat, nu mai apare deloc.

⚠️ Push-ul pe GitHub **nu** înseamnă deploy. Site-ul se deployează manual din cPanel. (CLAUDE.md spune greșit că Render face deploy automat.)

### Ce NU s-a atins

Zero cod Supabase, zero `fetch`, zero interogări, zero JavaScript nou. Logica de randare a articolelor, navigarea prin hash, butoanele de share, formularul de newsletter — neschimbate. Pe homepage: doar atribute `class` pe linkuri existente, niciun `href` modificat. Zona de plăți, edge functions, RLS, schema DB — neatinse.

---

## 2. Verificat local (30 iulie, seara)

Server static local (`python -m http.server` în `frontend/`), articolele venite din Supabase live. Testate toate cele trei episoade publicate: `judetului-housing-episodul-0`, `-1-acordul-vecinilor`, `-2-grupul-cum-ne-am-gasit`.

- ✅ **Dublarea a dispărut** pe toate trei. Cardul de navigare arată episodul vecin, caseta începe direct cu formularul.
- ✅ **Textul e consistent** — „Primește episoadele direct pe email:" pe toate episoadele.
- ✅ **CTA-ul de la mijlocul articolului chiar se inserează** — apare pe Episodul 2, înainte de „Criza din 2023", cu ambele butoane. **Deci fixul de rezervă de mai jos NU e necesar.**
- ✅ Zero erori în consolă.

> Fixul de rezervă (rămâne documentat, dar nu e nevoie de el): dacă vreodată CTA-ul de la mijloc nu apare pe un articol, cauza e că `insertMidArticleCta` caută paragrafe `<p>` **copii direcți** ai containerului. Se schimbă `Array.from(container.children).filter(el => el.tagName === 'P')` în `Array.from(container.querySelectorAll('p'))`. Articolele sub 8 paragrafe sunt sărite intenționat.

## 2b. Rămas de verificat DUPĂ upload în cPanel

1. **Plausible vede articolul?** Realtime → trebuie să apară `/news.html#slug-articol` ca pagină separată, nu doar `/news.html`.

2. **Tracking-ul CTA merge?** Apasă „Cum funcționează" din hero pe apartamentual.ro → în Realtime apare goal-ul `CTA Click`. Dacă merge unul, merg toate 7 — e același mecanism.

3. **Așteptat în date:** `/news.html` se va sparge în intrări per articol. Comparațiile cu perioada anterioară pe `/news.html` nu mai sunt apples-to-apples.

*Punctele 1 și 2 sunt singurele care nu se pot verifica local — Plausible nu trimite de pe localhost.*

---

## 3. Analiza Plausible — 2–30 iulie 2026

1.5k vizitatori unici · 1.7k vizite · 5k pageviews · 2.82 pagini/vizită · bounce 61% · durată 2m55s

⚠️ Procentele de comparație (+22.2k%, −68%) sunt fără sens — Plausible e instalat recent, perioada anterioară n-avea date.

### Constatări principale

**Trafic event-driven, nu organic.** Două vârfuri (16–17 iul ~205, 21–22 iul ~175), restul zilelor 10–60. Surse identificate: Google 32, Gmail 23, LinkedIn 13, Instagram 4, Bing 3 — **~76 din 1.5k**. Restul e „Direct", adică share-uri private (WhatsApp/Messenger apar ca direct pe mobil). Fiecare val de trafic depinde 100% de o postare făcută manual.

**Mobil 74%** (1.1k mobile / 386 desktop / 9 tablet). București 905 (60%), Ilfov 73, Cluj 64, Prahova 46, Brașov 37, Constanța 35, Iași 32, Timiș 32. Cantabria ES 24 — probabil bot/VPN.

**Homepage pierde două treimi.** Din 953: 628 (66%) nicio acțiune · `/terenuri` 126 (13.2%) · `/ce-este` 73 · `/news` 62 · `/cum-functioneaza` 42 · `/servicii` 40 · `/grupuri` 37 · outbound 32 · **`/register` doar 14 (1.5%)**.

**`/news.html` — 82% cul-de-sac.** 421 vizitatori, 367 intră direct pe articol, 347 (82%) pleacă fără acțiune. Restul: `/` 41, `/terenuri` 14, `/ce-este/` 12, `/povestea-noastra` 7, form 3.
→ **Parțial artefact de măsurare** (vezi §4). Fixul din `fbde097` va arăta cifra reală.

**Ce funcționează — fluxul teren:**
```
/terenuri (287) → /teren-details 94 (32.8%) → /analize 30 (25.4%) → /comanda-analiza 5 → formular 2
```
Pe `/teren-details` doar 25% pleacă. Interesul e real și adânc.

**Ce funcționează — fluxul grup:**
```
/grupuri (204) → /grup-details 73 (35.8%)
              → /register 28 (13.7%) → Form: Submission 15
```
`/grupuri.html` convertește spre înregistrare **de 9 ori mai bine decât homepage-ul** (13.7% vs 1.5%). De aici alegerea destinațiilor pentru CTA.

**Linkul partajabil de grup funcționează:** `/grup-details.html` e a treia pagină de intrare, 132 intrări directe.

**Onboarding-ul e OK odată ce ajung acolo:** 88 pe `/register` → 55 trimit (63%) → **41 trimit formularul de profil (75%)**. Problema e volumul care ajunge la formular, nu formularul.

> ⚠️ **Corecție 30 iulie, seara.** Versiunea anterioară a acestui rând scria „41 pe `/profile-edit-new` → 26 trimit". **Cifra 26 era greșită** și nu se regăsește în nicio captură. Tabelul „Form Actions" (captura `092158`) spune clar: `/profile-edit-new.html` = **41 vizitatori** care au trimis, 57 evenimente. Rata reală de completare a profilului e 75%, nu 47%. Confirmat independent din baza de date — vezi §3b.

**Goals:** Form Submission 94 uniques / 180 total (CR 6%) · Outbound Link Click 91 / 113 (5.8%).
Form actions: `/register` 55 · `/profile-edit-new` 41 · `/grup-edit` 10 · `/` 6 · `/grup-nou` 3 · `/news` 3 · `/comanda-analiza` 2 · `/terenuri-propune` 2.

---

## 3b. Calibrare Plausible ↔ baza de date (30 iulie, seara)

Numărătoare manuală în admin (captura `screenshots/20260730/screencapture_1785442148890.png`), de la `robertm` (30.07) până la `Robert` (02.07) inclusiv — **exact aceeași perioadă pe care o acoperă Plausible**:

- **66 de conturi** create în iulie
- din care **15 „Fără nume"** (profil neterminat) — includ și conturile de test `luta.lucian.m+test80/81` și `bogdanbatog@gmail.com`, deci se scad automat
- ⇒ **51 cu profil completat**

Conturile Demo (Ana Dumitrescu, Cristina Moldovan, Bogdan Radu, Ioana Nistor, Ioana Voicu), cele șterse și [[conturi-test-carmen-tibs]] sunt toate **sub** Robert, în afara intervalului. Numărat independent de Lucian și de Claude — ambii 51.

| | Baza de date | Plausible | Acoperire |
|---|---|---|---|
| Înregistrări | 66 | 55 | 83% |
| Profil completat | 51 | 41 | 80% |
| **Rata de completare** | **77%** | **75%** | — |

### Cele două concluzii care contează pentru orice analiză viitoare

1. **Plausible ratează ~20% din oameni** (blocante de reclame, Safari, refuz cookie-uri). **Orice cifră absolută din §3 e cu ~20% mai mică decât realitatea.**
2. **Dar proporțiile sunt de încredere** — 77% vs 75%, două puncte procentuale diferență. Concluziile pe *rate* rămân valide, inclusiv „`/grupuri.html` convertește de 9× mai bine decât homepage-ul".

**Regulă de lucru:** când baza de date și Plausible nu se potrivesc, **baza de date are dreptate**. Plausible e bun la „cum s-au mișcat oamenii", nu la „câți sunt".

---

## 4. Descoperirea structurală (cea mai importantă)

**Articolele nu au URL-uri proprii.** Toate stau la `/news.html#slug`, navigarea se face prin `window.location.hash` (`news.html`, ~liniile 535 și 631).

Consecințe:

- **SEO zero.** Google nu indexează fragmente `#slug` ca pagini separate. De aici cei 32 de vizitatori organici. Conținutul lung și bun e invizibil pentru motoarele de căutare.
- **Preview-uri identice la share.** Meta tag-urile OG din `news.html` sunt statice (liniile 15–25), iar scraperul Facebook nu execută JS și ignoră hash-ul. **Toate articolele distribuite arată la fel** — același titlu generic, aceeași imagine. Contează mult, pe un canal care aduce ~93% din trafic.
- **Măsurare oarbă** până la commit-ul `fbde097`.

### Migrarea la URL-uri reale — planificată, NU făcută

Necesită trei lucruri, în ordine:

1. **Generator de pagini.** Script care citește articolele din Supabase și scrie câte un `.html` per articol, cu meta tag-uri proprii. Necesar pentru că site-ul e static pe cPanel, fără runtime de server. E o piesă nouă în workflow, rulată la fiecare publicare.
2. **Redirect obligatoriu client-side** în `news.html`:
   ```js
   const slug = location.hash.slice(1);
   if (slug) location.replace('/news/' + slug + '.html');
   ```
   ⚠️ Un redirect din `.htaccess` **nu poate funcționa** — hash-ul nu ajunge niciodată la server, browserul trimite doar `GET /news.html`. `news.html` trebuie păstrat permanent ca redirector, altfel se rup toate linkurile deja distribuite pe Facebook și WhatsApp.
3. **Protecție pentru slug.** Dacă slug-ul devine URL public, capcana cunoscută se agravează: editarea titlului în admin regenerează slug-ul și ar da **404 pe un URL public deja indexat**. Nevoie de slug înghețat după publicare sau tabelă de slug-uri vechi cu redirect.

**Merită sesiune proprie, cu context curat.** Nu începe migrarea fără pașii 2 și 3 planificați.

---

## 5. Rămase pe listă, în ordinea impactului

| Prioritate | Ce | Detaliu |
|---|---|---|
| **1** | URL-uri reale per articol | §4 — rezolvă simultan SEO, preview-uri share și măsurare |
| 2 | Homepage | 66% pleacă fără acțiune. **Formularea veche era greșită — vezi mai jos.** |
| 3 | Plăți | webhook Oblio neapelat (comandă rămâne `pending_payment`) + `/analize` → `/comanda-analiza` pierde 25 din 30 |
| 4 | Link confirmare cont | `Confirmare link esuat` = **5 oameni** (7.5% din cei 66). **NU e problema de newsletter descrisă înainte — vezi mai jos.** |
| 5 | Igienă date | exclude paginile de admin din Plausible — `/admin.html` are 20 intrări directe, `/profile-edit-new` 20; umflă toate ratele |
| 6 | CLAUDE.md | corectează „Render face deploy automat" → cPanel manual |

### Corecție la punctul 2 — nu există CTA de register în hero

Formularea veche („de mutat CTA-ul principal spre `/grupuri.html`") pornea de la o presupunere falsă. **Verificat în cod:** hero-ul (`index.html:1525-1526`) are doar *Înscrie-te la webinar* (luma.com) și *Cum funcționează*. `/register.html` apare pe homepage abia mai jos, ca buton **secundar**, în două locuri (`:1650`, `:1703`). Deci cei 1.5% nu măsoară un CTA slab — măsoară că register e a treia opțiune, sub fold. Nu e nimic de „mutat".

Instinctul „oamenii trebuie întâi să înțeleagă" **se confirmă în date**: `/ce-este` (73) + `/cum-functioneaza` (42) = **115 oameni, 12%** — al doilea flux ca mărime după terenuri. Nu scoate „Cum funcționează" din hero.

Ce rămâne real de investigat:
- `/terenuri` ia 126 de pe homepage — de 3× mai mult decât `/cum-functioneaza` — **deși nu e deloc în hero**, doar în meniul de sus. Oamenii caută concret.
- `/ce-este/cum-functioneaza.html` are **35 de ieșiri unice** (captura `091842`) — e în mare parte capăt de drum. Omul tocmai a înțeles modelul și n-are unde să meargă. **Cel mai cald public de pe site, pierdut complet.** Un CTA acolo e probabil cel mai bun raport efort/impact rămas.
- Poziția întâi din hero e ocupată de singura acțiune care **nu se poate face imediat** (webinarul e o dată pe lună).

### Corecție la punctul 4 — nu e o problemă de newsletter

Formularea veche („doar 4 din 97 form submissions ajung pe `/newsletter-confirmat.html`") **compara mere cu pere**. Cei 97 sunt **toate formularele de pe site**: register (55), profil (41), grup-edit (10), comandă analiză, propunere teren. Aproape niciunul nu are legătură cu newsletterul.

Abonările reale la newsletter sunt ~10 în toată luna (formularele de pe `/`, `/news.html`, `/gdpr.html`), din care `Newsletter Episod` = **2**. Deci „4 confirmați" e ~40%, o rată **normală** de confirmare prin email, nu 4%.

⇒ **Nu ai o problemă de livrare de emailuri.** Ai o problemă de volum: aproape nimeni nu se abonează. Alt tip de problemă — de conținut și plasare, nu de infrastructură. Verificările Supabase rămase (template „Confirm signup", Redirect URLs, expirare link) **coboară mult în priorități**.

Ce rămâne real: evenimentul `Confirmare link esuat` (`js/profile-edit-new.js:148-158`) se trimite când cineva vine **din linkul de confirmare a contului** fără sesiune validă. **5 unique / 8 total.** Raportat la cele 66 de conturi din iulie = 7.5%. Număr mic, dar sunt oameni care au vrut cont, au primit emailul, au apăsat — și au fost respinși.

> **Notă metodologică:** evenimentul `Confirmare link esuat` s-a dovedit cel mai util instrument de diagnostic din tot setul, pentru că distinge „nu deschid emailul" de „deschid, dar linkul e stricat" — două probleme cu soluții complet diferite. Merită păstrat și consultat înainte de orice sesiune pe fluxul de email.

---

## 6. Comenzi concrete

```bash
# starea curentă
cd C:/Users/lucia/proiecte/apartamentual
git log --oneline -5

# ce s-a schimbat în sesiune (toate patru commit-urile)
git diff 3f0db96..7f5793b -- frontend/news.html frontend/index.html

# verificare locală (ce s-a folosit în sesiune)
cd frontend && python -m http.server 8899 --bind 127.0.0.1
# apoi: http://127.0.0.1:8899/news.html#judetului-housing-episodul-0
```

**Deploy:** upload manual în cPanel a **două** fișiere — `frontend/news.html` și `frontend/index.html`.

**Capturile Plausible** din care s-a făcut analiza: `screenshots/20260730/`, inclusiv:
- `screencapture_1785398574090.png` — dashboard-ul întreg
- `092144.png` — Goals · `092158.png` — Form Actions (sursa cifrei corecte de 41)
- `091842.png` — Exit Pages (cele 35 de ieșiri de pe `/cum-functioneaza`)
- `screencapture_1785442148890.png` — **admin utilizatori**, sursa numărătorii din §3b

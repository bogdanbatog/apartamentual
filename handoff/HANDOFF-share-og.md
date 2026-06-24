# HANDOFF, distribuire (share) + previzualizări link (Open Graph)

> Plasează în `/_handoff/` și invocă-l în Claude Code.
> Structură în 5 faze. Oprește-te (STOP) la fiecare punct marcat. NU face deploy
> fără aprobare explicită de la Lucian.
> IMPORTANT: în orice text vizibil pe care îl introduci, NU folosi em-dash (—) sau
> en-dash (–). Folosește virgulă, două puncte sau paranteze.

---

## Context

Repo `bogdanbatog/apartamentual`, frontend vanilla HTML/JS/CSS, hostat pe Render,
domeniu live `https://apartamentual.ro`. Conținutul (articole, terenuri) se încarcă
dinamic din Supabase.

Scop de produs: distribuirea servește obiectivul de awareness (cât mai mulți oameni
află de platformă). Oamenii distribuie lucruri concrete care i-au impresionat
(un articol, un teren), nu platforma în abstract. Deci share-ul trebuie să fie
contextual, pe articol și pe teren, nu un buton generic în footer.

## Limitare cunoscută (NU încerca să o ocolești)

Articolele folosesc URL cu hash (`news.html#slug`) și se randează client-side.
Crawlerele Facebook/WhatsApp nu rulează JS și ignoră fragmentul `#`, deci NU pot
genera previzualizări unice per articol din meta tag-uri statice. La fel pentru
terenuri randate client-side. Prin urmare:
- Acest handoff adaugă Open Graph la nivel de PAGINĂ (previzualizare brandată
  generică, aceeași pentru toate articolele). E acceptabil pentru v1.
- Previzualizările UNICE per articol/teren sunt un task viitor separat (URL-uri
  reale + pre-randare server/edge). NU îl aborda aici. Dacă te lovești de el,
  oprește-te și semnalează, nu improviza.

---

## Ce livrăm (3 părți)

1. **Butoane de share** (Copiază link, WhatsApp, Facebook) verificate/adăugate pe:
   articole (inclusiv episodul 0), pagina de detaliu teren.
2. **Open Graph + Twitter Card** la nivel de pagină, pe paginile statice principale.
3. **Grupuri**: doar verificare, vezi nota de la 3.3 (probabil rămâne pe mai târziu).

---

## FAZA 1, AUDIT (fără modificări)

Raportează:
1. **Share pe articole**: în `news.html` (și/sau pagina care afișează un articol
   deschis), există deja butoane Copiază link / WhatsApp / Facebook? Cum e construit
   URL-ul de share al unui articol (format `news.html#slug`)? Funcționează pentru
   un articol deja publicat? Verifică inclusiv pentru episodul 0 (slug
   `judetului-housing-episodul-0`) dacă e publicat; dacă nu e, testează cu alt articol.
2. **Pagina de detaliu teren**: confirmă numele real al paginii (probabil
   `teren-details.html?id=...`) și ce date are disponibile în client (titlu teren,
   imagine, preț) ca să putem compune textul de share.
3. **Grupuri**: există o pagină publică de detaliu grup, sau detaliile sunt blocate
   în spatele login-ului ("Creează cont pentru detalii")? Raportează situația.
4. **Open Graph existent**: ce meta tag-uri OG/Twitter există deja în `<head>` pe
   `index.html`, `news.html`, `terenuri.html`, paginile din `ce-este/`,
   `servicii.html`, `povestea-noastra.html`? Listează ce e și ce lipsește.
5. **Imagine pentru previzualizare**: caută în `assets/` o imagine potrivită ca OG
   default (ideal o fațadă/șantier Județul Housing, format peisaj, aprox 1200x630).
   Propune calea ei. Dacă nu există una bună, semnalează ca să o furnizez eu.

> **STOP 1.** Prezintă constatările. Așteaptă OK.

---

## FAZA 2, PLAN

Listează exact:
- fișierele de modificat pentru butoanele de share (articol, teren)
- fișierele care primesc meta tag-uri OG (lista de pagini statice)
- imaginea OG default aleasă (calea, dimensiunea)
- textele OG propuse per pagină (vezi 3.2 ca punct de plecare)

> **STOP 2.** Așteaptă aprobarea planului.

---

## FAZA 3, IMPLEMENTARE

### 3.1 Butoane de share (articol + teren)

Trei controale, în aceeași ordine peste tot: **Copiază link**, **WhatsApp**, **Facebook**.

- **Copiază link**: copiază URL-ul canonic al elementului în clipboard, cu feedback
  vizual scurt (ex. textul butonului devine "Link copiat" 2 secunde). E controlul
  cel mai folosit, pune-l primul.
- **WhatsApp**: `https://wa.me/?text=` + textul encodat (titlu scurt + URL).
- **Facebook**: `https://www.facebook.com/sharer/sharer.php?u=` + URL encodat.

Pe **articol**: dacă butoanele există deja (din implementarea anterioară), doar
verifică-le și repară dacă e nevoie; nu dubla. URL-ul share = URL-ul canonic al
articolului (`https://apartamentual.ro/news.html#<slug>`).

Pe **pagina de detaliu teren**: adaugă cele trei controale. URL-ul share = URL-ul
canonic al terenului (`https://apartamentual.ro/teren-details.html?id=<id>`).
Textul WhatsApp, fără em-dash, de tipul:
`Am găsit un teren potrivit pentru construcție în grup pe ApartamenTUal: <URL>`

Stil: discret, consistent cu restul UI-ului. Fără biblioteci externe de share,
doar linkuri/JS simplu.

### 3.2 Open Graph + Twitter Card (pagini statice)

În `<head>`-ul fiecărei pagini din listă, adaugă (sau completează) meta tag-urile.
Set complet per pagină:
```
<meta property="og:type" content="website">
<meta property="og:site_name" content="ApartamenTUal">
<meta property="og:locale" content="ro_RO">
<meta property="og:title" content="...">
<meta property="og:description" content="...">
<meta property="og:image" content="https://apartamentual.ro/<cale-imagine-og>">
<meta property="og:url" content="https://apartamentual.ro/<pagina>">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="...">
<meta name="twitter:description" content="...">
<meta name="twitter:image" content="https://apartamentual.ro/<cale-imagine-og>">
```

Texte propuse (fără em-dash, fără procente de economie, "mic bloc" nu "bloc"):

- **index.html**
  - og:title: `ApartamenTUal, un apartament se poate și construi, nu doar cumpăra`
  - og:description: `Platformă de construcție colaborativă în România. Construiești apartamentul în care vei locui, împreună cu alții, fără dezvoltator.`
- **news.html**
  - og:title: `Povești și resurse despre construcția în grup`
  - og:description: `Articole, exemple și povestea reală a primului mic bloc colaborativ din România.`
- **terenuri.html**
  - og:title: `Terenuri pentru construcție în grup`
  - og:description: `Descoperă terenuri potrivite pentru proiectul tău de construcție colaborativă în București.`
- **ce-este/** (pagina principală)
  - og:title: `Ce este construcția colaborativă (Baugruppen)`
  - og:description: `Cum construiești apartamentul în care vei locui, împreună cu alții, fără dezvoltator. Definiții, cadru legal și exemple.`
- **servicii.html**
  - og:title: `Servicii ApartamenTUal`
  - og:description: `De la analiza terenului la coordonarea grupului, sprijin de la arhitecți pe tot parcursul construcției în grup.`
- **povestea-noastra.html**
  - og:title: `Povestea noastră, primul prototip ApartamenTUal`
  - og:description: `Cum cinci familii au construit primul mic bloc colaborativ din România, pas cu pas.`

Imaginea OG: aceeași imagine default aprobată la Faza 2 pentru toate paginile (dacă
nu avem una dedicată per pagină). Asigură-te că e accesibilă public la URL absolut,
format peisaj (ideal 1200x630), sub ~600KB ca WhatsApp să o preia sigur.

### 3.3 Grupuri (probabil doar nota, nu cod)

Dacă detaliile grupului sunt blocate în spatele login-ului, un share public ar
arăta doar teaser-ul. Share-ul cu adevărat util pentru grupuri este o "invitație"
pentru utilizatori logați, care e o funcție separată. Pentru acest handoff:
- dacă există o pagină publică de grup, adaugă doar "Copiază link" pe ea;
- altfel, NU construi nimic; notează în raport că share-ul de grup (invitație)
  rămâne task viitor pentru utilizatori logați.

> **STOP 3.** Arată diff-urile complete. NU face commit/push. Așteaptă review-ul.

---

## FAZA 4, TEST

1. Pe un articol publicat: Copiază link pune URL-ul corect în clipboard; WhatsApp și
   Facebook deschid dialogul cu URL-ul corect.
2. Pe pagina de detaliu teren: aceleași trei controale, URL corect cu `?id=`.
3. Lipește un URL de pagină statică (ex. homepage) în
   https://developers.facebook.com/tools/debug/ și verifică previzualizarea
   (titlu, descriere, imagine). Reține: per-articol va arăta tot previzualizarea
   de pagină, conform limitării cunoscute, e ok.
4. Verifică vizual că butoanele se încadrează în stilul paginii pe desktop și mobil.

---

## FAZA 5, COMMIT & DEPLOY

- Commit: `feat(share): butoane share pe articole și terenuri + Open Graph la nivel de pagină`
- Push-ul declanșează deploy automat pe Render.

> **STOP 5.** Commit/push DOAR după "dă commit" explicit de la Lucian.

---

## Task viitor (nu acum)

Previzualizări unice per articol/teren: necesită URL-uri reale (ex. `/articol/<slug>`,
`/teren/<id>`) + pre-randare a meta tag-urilor pentru crawlere (build step, SSR, sau
o edge function care servește OG pentru boți și redirecționează oamenii). De analizat
separat când vrem ca fiecare episod distribuit să-și arate propria poză și titlu.

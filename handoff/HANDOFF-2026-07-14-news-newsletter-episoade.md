# HANDOFF — 14 iulie 2026 — News, newsletter în episod, curățare articole, homepage dinamic

Sesiune lungă cu mai multe task-uri legate de secțiunea News / episoade. **Tot codul e comis + împins pe `main`**, dar **NIMIC nu e live încă** — apartamentual.ro se deployează **manual din cPanel** (nu automat). Un singur deploy publică tot pachetul.

---

## Ce s-a făcut (commit-uri împinse pe `main`, în ordine)

1. `500b307` — **Bloc newsletter inline la finalul episoadelor** (`news.html`) + `js/newsletter.js`. Formular inline (double opt-in, endpoint `newsletter-subscribe`), link spre povestea-noastra, event Plausible `Newsletter Episod`. Modificări aditive în newsletter.js: `data-success-msg` + `data-plausible-goal`, și scos em-dash din mesajul de succes comun.
2. `398af06` — **`povestea-noastra.html`**: titlu „Județului Housing / primul bloc construit prin ApartamenTUal" (fără pleonasm, fără „strada Județului"); scos numărul de familii (5 apartamente rămâne; „câteva familii" unde erau actorii); curățat „mic bloc" → „bloc"; aliniate og/twitter title+description.
3. `ea1cbe1` — card homepage Brutopia aliniat (fără em-dash / „cohousing").
4. `e6becc1` — card homepage De Sijs aliniat.
5. `5ecdc6f` — fix link card De Sijs la slug nou (slug-ul se schimbase la editare în admin).
6. `3f0c13d` — **imagini proprii** pe cardurile Brutopia + De Sijs (`frontend/assets/images/news/files/card-news-*.png`).
7. `0c88e67` — **Secțiunea News de pe homepage e acum DINAMICĂ** (`index.html`): episoadele serialului apar automat (nou→vechi) din Supabase; exemplele sunt curate manual în `CURATED_EXAMPLES` (acum doar Brutopia; De Sijs e comentat, o linie de decomentat). Match pe bucată stabilă din slug ca să nu se rupă la re-editare.
8. `03dd888` — **Navigare de serial** între episoade (`news.html`): la finalul fiecărui episod, link „← Episodul N-1" și/sau „Episodul N+1 →", calculate din numărul din slug. Nu mai e fundătură.

## Curățare drepturi de autor (făcută în ADMIN de Lucian, deja LIVE — DB, nu repo)
- **Brutopia** și **De Sijs**: text propriu în română, banda „Preluat de pe" scoasă (source_url golit), pozele lui Tim Van de Velde scoase din articole. Verificat în DB: ambele curate.

---

## DE FĂCUT (manual, Lucian, în afara Claude Code)

1. **[BLOCANT] Deploy din cPanel** — publică tot ce e mai sus. Fără el, homepage-ul dinamic, blocul de newsletter, navigarea și povestea-noastra nu se văd live.
2. **Plausible: creează goal-ul** `Newsletter Episod` — plausible.io → apartamentual.ro → Site Settings → Goals → + Add goal → **Custom event** → nume exact `Newsletter Episod` → Add goal. Numără doar de după deploy. (Fără el, evenimentul se trimite dar nu se contorizează.)
3. **Test după deploy:** abonare cu `nume+test@...` dintr-un episod → verifică emailul de confirmare + conversia în Plausible (Goal Conversions).
4. **Email către Tim Van de Velde** (fotograf Brutopia) — articolele din News nu-i mai au pozele. ⚠️ ATENȚIE: o poză a lui **încă apare în `frontend/ce-este/exemple-europa.html`** (linia ~299, `brutopia.jpg.jpg` din Supabase storage) — lăsată separat la cererea lui Lucian. Ține cont când formulezi emailul.
5. **Opțional, în admin:** titlul Brutopia are un spațiu greșit — „Bruxelles **:** 29" → „Bruxelles: 29".
6. **Opțional:** verifică în admin dacă mai există alt articol EXEMPLE (publicat 14 feb 2026) cu conținut preluat.
7. **Opțional:** șterge pozele Brutopia/De Sijs din Supabase storage (bucket `articles/`) dacă vrei să dispară complet.

---

## Context tehnic util pentru sesiunea următoare

- **Articolele News trăiesc în Supabase** (tabelul `articles`), randate dinamic în `news.html` din `article.content` (HTML). Modificările din admin sunt LIVE imediat, fără deploy. Nu se pot edita din repo.
- **Capcană slug:** editarea titlului în admin poate regenera slug-ul (dacă se atinge câmpul slug / butonul „↻ Auto") → rupe linkurile care-l țintesc. La homepage-ul dinamic am rezolvat prin match pe bucată stabilă din slug (`brutopia`, `de-sijs`). Vezi memoria `admin-slug-editare-articole`.
- **Homepage News dinamic** (`index.html`, scriptul de la finalul paginii, în jur de linia ~2151): episoadele = articolele cu slug `judetului-housing-episodul-N`, sortate desc; exemplele = lista `CURATED_EXAMPLES` (match pe slug + imagine locală). Pentru a adăuga De Sijs: decomentează linia lui în array.
- **Navigare serial** (`news.html`, în `showArticle()`): prev/next din numărul episodului (`judetului-housing-episodul-(\d+)`); container `#episodeNav`.
- **Verificare conținut live din DB** (fără admin): REST public Supabase cu cheia anon din `js/supabase-config.js`:
  `GET https://glbvbbgmcobtswwlktic.supabase.co/rest/v1/articles?select=...&status=eq.published&order=published_at.desc` cu headere `apikey` + `Authorization: Bearer <cheie>`.
- **Episoade existente acum:** Episodul 0 (`judetului-housing-episodul-0`), Episodul 1 (`judetului-housing-episodul-1-acordul-vecinilor`).
- **Fișiere grafice carduri:** doar PNG (`card-news-brutopia.png`, `card-news-desijs.png`). SVG-urile au fost șterse (fonturi Linux, nu se afișau corect).

## Deploy edge functions (dacă e nevoie, nu a fost în sesiunea asta)
Nu s-au atins edge functions. Reminder: se copiază din repo în `C:\Users\lucia\supabase\supabase\functions\<nume>\` → `npx supabase functions deploy <nume>` din `C:\Users\lucia\supabase` (fără Docker).

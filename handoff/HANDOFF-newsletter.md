# HANDOFF — Newsletter (double opt-in, Resend Audiences)

> Plasează acest fișier în `/_handoff/HANDOFF-newsletter.md` și invocă-l în Claude Code.
> Respectă structura în 5 faze. **Oprește-te (STOP) la fiecare punct marcat și
> așteaptă confirmarea lui Lucian. Nu face deploy fără aprobare explicită.**

---

## Context

ApartamenTUal are nevoie de un newsletter ca mecanism principal de revenire pentru
vizitatorii care nu fac cont (curioși + sceptici). Pagina `servicii.html` deja
**promite** newsletter ("Webinarii și newsletter — gratuit"), dar el nu există încă.

**Decizie de arhitectură (nu o schimba fără să întrebi):**
- **Resend (Contacts globale + Broadcasts)** = lista de trimitere efectivă +
  dezabonarea (automată, conformă List-Unsubscribe). Trimiterea campaniilor se face din
  dashboard-ul Resend → Broadcasts — **nu construim editor de campanii**. Modelul nou
  (nov. 2025) folosește contacte globale, fără `audience_id`.
- **Supabase** = sursa de adevăr pentru captură + consimțământ (dovadă GDPR,
  deținută de noi, segmentabilă pe zone în viitor).
- **Double opt-in.** Newsletterul pleacă de pe `ltfbstudio.ro`, același domeniu cu
  emailurile critice (auth, plăți). Lista trebuie ținută curată ca să nu strice
  livrarea acelor emailuri.

Fluxul:
```
formular pe site → edge fn newsletter-subscribe → Supabase (status=pending) + email confirmare
   → user apasă link → edge fn newsletter-confirm → Supabase (status=confirmed)
       + creează contactul global în Resend (POST /contacts, unsubscribed=false)
```

Stack relevant: Supabase project `glbvbbgmcobtswwlktic`
(`https://glbvbbgmcobtswwlktic.supabase.co`), Resend (secret `RESEND_API_KEY` deja
configurat, folosit de emailurile transacționale), frontend vanilla JS pe Render,
repo `bogdanbatog/apartamentual`. PLATFORM_URL = `https://apartamentual.ro`.

---

## FAZA 0 — Prerequisite manuale (Lucian, ÎNAINTE de Claude Code)

Claude Code NU poate face acești pași. Lucian îi face și confirmă că sunt gata.

> **Notă model Resend (nov. 2025):** Contactele sunt acum **globale** — endpoint-ul de
> contacte NU mai cere `audience_id`. Prin urmare NU se creează niciun Audience și NU se
> setează `RESEND_AUDIENCE_ID`. Edge function-ul adaugă contactul prin endpoint-ul global
> `POST https://api.resend.com/contacts`. Trimiterea campaniilor: din Resend → Broadcasts,
> selectând audiența (toate contactele).

1. **Rulează migrația SQL 023** (mai jos, secțiunea SQL) în **Supabase SQL Editor**.
   (`RESEND_API_KEY` există deja în secrets — nu îl atinge. Nu mai e nevoie de alt secret.)
2. *(Opțional, recomandat)* Decide dacă trimiterea broadcast-urilor se face de pe un
   subdomeniu de marketing (`news.ltfbstudio.ro`). Pentru v1 putem rămâne pe
   `apartamentual@ltfbstudio.ro` — nu blochează acest handoff.

> **STOP 0.** Lucian confirmă: SQL 023 rulat.

---

## SQL — Migrația 023 (rulează manual în SQL Editor)

```sql
-- Migration 023: newsletter_subscribers
-- Sursă de adevăr pentru abonați (double opt-in + dovadă consimțământ GDPR).
-- Lista de trimitere efectivă trăiește în Resend Audiences; aici deținem
-- consimțământul și starea, ca să putem segmenta în viitor.

create table if not exists public.newsletter_subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','unsubscribed')),
  source          text,            -- de unde s-a abonat: 'homepage_band' | 'footer' | ...
  zone_interest   text,            -- opțional, pentru segmentare viitoare (ex: 'Băneasa')
  confirm_token   uuid not null default gen_random_uuid(),
  consent_at      timestamptz,     -- momentul bifării consimțământului (dovadă GDPR)
  confirmed_at    timestamptz,     -- momentul confirmării (double opt-in)
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now()
);

-- email unic, case-insensitive (evită duplicate Ana@x.com / ana@x.com)
create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

create index if not exists newsletter_subscribers_status_idx
  on public.newsletter_subscribers (status);

create index if not exists newsletter_subscribers_token_idx
  on public.newsletter_subscribers (confirm_token);

-- RLS: clientul public (anon) NU scrie direct în tabel. Toate scrierile trec prin
-- edge functions cu service_role (care ocolește RLS). Previne spam-ul prin cheia anon.
alter table public.newsletter_subscribers enable row level security;
-- (intenționat fără policy anon/authenticated = acces zero din client; doar service_role scrie)
```

> Notă: dacă vrei să vezi lista din panoul de admin, adăugăm separat o policy SELECT
> pentru rolul superadmin. Pentru v1, lista o vezi în dashboard-ul Resend — nu e necesar.

---

## FAZA 1 — AUDIT (Claude Code)

Fără să modifici nimic, raportează:
1. Convențiile edge functions existente — deschide `supabase/functions/notify-admins/index.ts`
   și notează: cum citește env (`Deno.env.get`), cum face apelurile către Resend,
   header-ele CORS folosite, structura de răspuns. **Funcțiile noi trebuie să respecte
   exact aceleași convenții.**
2. Markup-ul footer-ului: e un partial comun sau e copiat în fiecare `.html`? Listează
   toate fișierele care conțin footer-ul. (Determină cum injectăm formularul o singură
   dată, peste tot.)
3. Structura `index.html` (homepage) — identifică (a) secțiunea cu imaginile
   Județului Housing ("Primul bloc construit colaborativ...") și (b) secțiunea de echipă
   imediat după ea ("Cine sunt oamenii din spatele..."). Banda de newsletter se inserează
   **între** aceste două secțiuni.
4. Confirmă că nu există deja cod de newsletter (formular, fn, tabel) ca să nu dublăm.

> **STOP 1.** Prezintă constatările. Așteaptă OK.

---

## FAZA 2 — PLAN

Listează exact fișierele de creat/modificat, cu căi:
- `supabase/functions/newsletter-subscribe/index.ts` (nou)
- `supabase/functions/newsletter-confirm/index.ts` (nou)
- `newsletter-confirmat.html` (nou — pagina de mulțumire)
- formular în footer (1 loc dacă e partial; altfel patch identic în toate paginile)
- bandă de newsletter în `index.html`, între imaginile Județului Housing și secțiunea echipă
- handler JS (fișier nou `assets/js/newsletter.js` sau în convenția existentă a repo-ului)

> **STOP 2.** Așteaptă aprobarea planului.

---

## FAZA 3 — IMPLEMENTARE

### 3.1 Edge function `newsletter-subscribe`

**Contract:** `POST` JSON `{ email: string, source?: string, zone_interest?: string }`

Comportament:
1. CORS: acceptă originea `https://apartamentual.ro` (și răspunde la `OPTIONS`).
2. Validează formatul email; normalizează `lower(trim(email))`.
3. Folosește clientul Supabase cu **service_role** (env `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`).
4. Caută abonatul după `lower(email)`:
   - `confirmed` → răspunde `{ ok: true, already: true }` (NU retrimite email).
   - `pending` → regenerează `confirm_token`, actualizează `consent_at=now()`,
     retrimite emailul de confirmare.
   - `unsubscribed` → tratează ca reabonare: `status='pending'`, token nou,
     `consent_at=now()`, `unsubscribed_at=null`, trimite confirmare.
   - inexistent → `insert` cu `status='pending'`, `consent_at=now()`, `source`,
     `zone_interest`.
5. Trimite emailul de confirmare prin Resend API (`RESEND_API_KEY`),
   `from: "ApartamenTUal <apartamentual@ltfbstudio.ro>"`, cu link de confirmare:
   `https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/newsletter-confirm?token=<confirm_token>`
6. *(Opțional, dacă e simplu)* notificare Slack în `#app_events`: "Newsletter: abonare nouă (pending)".
7. Răspuns `{ ok: true }`. La eroare, status 4xx/5xx + mesaj scurt.

Anti-abuz minim: validare email strictă; dacă există deja un `pending` creat în
ultimele 2 minute, nu retrimite (răspunde `{ ok: true }` oricum, ca să nu divulgi
existența adresei).

**Text email confirmare (RO, ton calm de arhitect):**
- Subject: `Confirmă abonarea la newsletter ApartamenTUal`
- Corp:
  ```
  Bună,

  Mulțumim că vrei să primești newsletterul ApartamenTUal — povestea reală a
  construcției colaborative, terenuri noi și pașii practici din spatele blocurilor
  construite în grup.

  Mai e un pas: confirmă-ți adresa.

  [ Confirmă abonarea ]   ← buton spre link-ul de confirmare

  Dacă nu te-ai abonat tu, poți ignora liniștit acest email.

  — Echipa ApartamenTUal
  ```
  (HTML simplu, butonul = link-ul de confirmare. Fără imagini grele.)

### 3.2 Edge function `newsletter-confirm`

**Contract:** `GET ?token=<uuid>`

Comportament:
1. Caută abonatul după `confirm_token`.
2. Dacă `status='pending'`: setează `status='confirmed'`, `confirmed_at=now()`.
   Apoi creează contactul global în Resend:
   `POST https://api.resend.com/contacts`
   body `{ "email": <email>, "unsubscribed": false }`,
   header `Authorization: Bearer <RESEND_API_KEY>`.
   (Model nou Resend: contacte globale, FĂRĂ `audience_id`. Dacă răspunsul indică
   "already exists", tratează ca succes — operația e idempotentă.)
3. Dacă deja `confirmed`: idempotent — doar redirect spre succes.
4. Dacă token invalid: redirect spre `https://apartamentual.ro/newsletter-confirmat.html?error=1`.
5. La succes: `302` redirect spre `https://apartamentual.ro/newsletter-confirmat.html`.

### 3.3 Pagina `newsletter-confirmat.html`

Pagină simplă, în stilul site-ului (refolosește header/footer/CSS existente).
Conținut (RO):
- Titlu: `Gata, ești pe listă.`
- Text: `Îți mulțumim. De acum primești newsletterul ApartamenTUal: povestea
  construcției colaborative, terenuri noi în zonele care contează și pașii reali din
  spatele grupurilor. Fără spam, te dezabonezi oricând.`
- Butoane: `Înapoi la pagina principală` (`/`) · `Vezi terenuri` (`/terenuri.html`)
- Dacă `?error=1`: afișează în loc `Link-ul de confirmare nu mai e valid. Încearcă să
  te abonezi din nou.` + buton spre homepage.

### 3.4 Formular footer (global, toate paginile)

Mic, discret, sub navigarea din footer. Conținut (RO):
- Etichetă: `Newsletter`
- Sub-text scurt: `Povești despre construcția în grup și terenuri noi. Fără spam.`
- Input email (placeholder `adresa ta de email`) + buton `Abonează-mă`
- Checkbox consimțământ (obligatoriu):
  `Sunt de acord să primesc newsletterul ApartamenTUal și am citit
  [politica de confidențialitate](/gdpr.html).`
- `source: "footer"`

### 3.5 Bandă newsletter homepage

**Poziție exactă:** în `index.html`, **între** secțiunea cu imaginile Județului Housing
("Primul bloc construit colaborativ...") și secțiunea de echipă ("Cine sunt oamenii din
spatele..."). NU lângă benzile de webinar.

**Greutate vizuală:** banda trebuie să fie **mai ușoară** decât benzile de webinar —
fundal deschis (nu întunecat), buton secundar, înălțime modestă. Scopul: ochiul citește
clar ierarhia (webinarul = cererea principală; newsletterul = alternativa blândă), ca să
nu intre în conflict cu CTA-urile de webinar de pe pagină.

Conținut (RO):
- Titlu: `Urmărește cum se construiește în grup.`
- Sub: `Primești povestea reală a blocurilor construite colaborativ, terenuri noi și
  pașii practici. Fără spam, te dezabonezi oricând.`
- Input email + buton `Abonează-mă` + același checkbox consimțământ ca în footer
- `source: "homepage_band"`

### 3.6 Handler JS (`assets/js/newsletter.js` sau convenția repo-ului)

- La submit: validează că checkbox-ul e bifat + email nevid.
- `POST` spre `https://glbvbbgmcobtswwlktic.supabase.co/functions/v1/newsletter-subscribe`
  cu `{ email, source, consent: true }`.
- La succes: înlocuiește formularul cu mesajul
  `Verifică-ți emailul — ți-am trimis un link de confirmare.`
- La eroare: mesaj scurt, neblocant.
- Funcția trebuie să meargă pentru ambele formulare (footer + bandă) — folosește un
  selector comun, nu cod dublat.

> **STOP 3.** Arată toate fișierele (diff-uri + conținut complet edge functions).
> NU face deploy. Așteaptă review-ul lui Lucian.

---

## FAZA 4 — TEST

Plan de test (după ce Lucian aprobă și face deploy-ul):
1. Abonare cu o adresă reală din banda de homepage → primește email de confirmare.
2. Apasă link → ajunge pe `newsletter-confirmat.html`, rândul devine `confirmed` în
   Supabase, contactul apare în Resend → Contacts (global).
3. Reabonare cu aceeași adresă confirmată → nu primește email duplicat (`already`).
4. Token invalid → pagina de eroare.
5. Submit fără checkbox → blocat în client.
6. Footer-ul funcționează identic pe o pagină internă (ex. `/terenuri.html`).
7. Verifică în Resend că un test broadcast include footer-ul de dezabonare.

---

## FAZA 5 — COMMIT & DEPLOY

- Commit: `feat(newsletter): double opt-in subscribe + confirm, Resend Audience sync, footer+homepage capture`
- Deploy edge functions (Lucian rulează din `C:\Users\lucia\supabase`, DOAR după aprobare):
  ```
  npx supabase functions deploy newsletter-subscribe
  npx supabase functions deploy newsletter-confirm
  ```
- Frontend-ul se deployează automat pe Render după push.

> **STOP 5.** Deploy-ul edge functions se face DOAR cu „dă deploy" explicit de la Lucian.

---

## Faza 2 (mai târziu, nu acum)

- Webhook Resend `contact.unsubscribed` → edge fn care oglindește dezabonarea în
  Supabase (`status='unsubscribed'`, `unsubscribed_at=now()`), ca să nu existe drift.
- Segmentare pe `zone_interest` → broadcast „terenuri noi în zona ta".
- Captură suplimentară: după webinar și la finalul articolelor din News.

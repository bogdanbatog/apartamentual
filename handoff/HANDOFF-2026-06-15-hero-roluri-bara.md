# HANDOFF — 15 iunie 2026 · Hero pe roluri + bara grafică

## Stadiu pe scurt

Sesiune de polish vizual pe **homepage** (`frontend/index.html`). Toate
modificările sunt **comise, pushate ȘI deployate live**. La momentul scrierii:
`apartamentual.ro` = 85.346 bytes = identic cu local, conține codul nou.

- Branch: `main`, la zi cu `origin/main`.
- Ultimul commit: **`5ccbfe2`**.
- Working tree curat (doar `handoff/` netrackuit — fișierele astea).
- **Nimic în așteptare de deploy.**

---

## Ce s-a făcut în sesiune (în ordine)

### 0. Fix deploy (operațional, nu cod)
La început hero-ul pe roluri (commit vechi `a24466e`) NU apărea live deși
„dădusem deploy". Cauză: în cPanel se apăsase **Deploy** fără pasul
**Update from Remote** înainte → s-a re-copiat versiunea veche din clona de pe
server. **Regula corectă, mereu 2 pași în ordine:**
1. **Update from Remote** (trage commit-urile noi de pe GitHub în clona de pe server)
2. **Deploy HEAD Commit** (rulează `.cpanel.yml`, copiază în folderul live)

`.cpanel.yml` copiază `frontend/*` în `/home/ar4/app.ltfbstudio.ro/` (acolo
servește apartamentual.ro). Deploy = manual din cPanel, **nu** Render.

### 1. Bara grafică de apartamente (`.aptbar`) — făcută dinamică din nou
Bara nouă era statică. Acum (commits `27e2485`, `c5bfee2`, `b465249`):
- **Trama random la fiecare încărcare**: grilă 22×3, blocuri 1×1 / 2×2 / 3×3
  plasate aleatoriu fără suprapunere (algoritm „occupancy", ca SVG-ul vechi).
- **Ritm de șantier**: la ~720ms câteva pătrate se sting spre fundal / reaprind /
  schimbă culoarea (paleta pământie). Respectă `prefers-reduced-motion`.
- **Celule pătrate**: înălțimea rândurilor o setează JS = lățimea coloanei
  (funcția `layout()`, recalculată la `resize`). Fără asta ieșeau dreptunghiuri.
- Cod: CSS la `.aptbar*` (~liniile 445-454) + IIFE JS „BARA DE APARTAMENTE"
  (caută `js-aptbar` în `<script>`-ul de la finalul paginii).

### 2. Hero pe roluri — aliniere la hero-ul de marketing
Cele 3 stări: **nelogat** = marketing (neschimbat); **logat fără grup / în grup**
= varianta A; **agenție** (`account_type='profesional'`) = varianta B.

- **Tipografie A/B aliniată la marketing** (`54e6a4e`): titlu 52px/500/1.05,
  subtitlu (`.lead`) 18px/1.55; pe mobil ≤768px 32px/16px.
- **Poziție verticală** (`edad8a3`): A/B aliniate sus (`justify-content:flex-start`
  + `padding-top:1rem`) ca marketing-ul — eyebrow/titlu pe aceeași poziție.
- **CTA-uri egale** (`edad8a3`): `.btn` din variante aduse la mărimea
  `.cta-primary/.cta-secondary` (13px/500/padding 13×22/radius 4/border 1px).
- **Fix flash „nelogat" ~1s după login** (`edad8a3`): `sb.auth.getSession()`
  (citire locală din localStorage, fără rețea) în loc de `getUser()`. În plus,
  varianta se memorează în `localStorage` (`atu_hero_variant`) și se afișează
  instant la încărcările următoare. **Nu** s-au atins interogările de date / plăți / RLS.

### 3. Hero agenție (B) — restructurat ca celelalte (`5ccbfe2`)
- Structură identică cu A: `eyebrow → titlu → subtitlu(.lead) → CTA`.
- „aprobate" / „în așteptare" scoase din flux → **2 pătrate plutitoare în dreapta**
  (`.stat-tile`, clasă `.cluster--b`), verde = aprobate (`--ok`), ocru = în
  așteptare (`--pending`), animate ca vecinii din A. Poziționate absolut → **nu
  împing bara grafică**. Cifrele populate de același JS (clasele
  `js-agency-approved` / `js-agency-pending` mutate pe `.stat-num`).
- Numele agenției **revine inline la 52px** (parte din titlu, ca numele din A).
- Pe mobil pătratele coboară în flux și se micșorează (`--k:.62`).
- (Commit-ul intermediar `958e3e1` — nume agenție pe rând separat — a fost
  înlocuit/revertat de `5ccbfe2`.)

---

## Puncte deschise / de verificat de Lucian

1. **Hero B cu numele real al agenției**: numele e iar inline la 52px. Un nume
   FOARTE lung poate duce titlul pe 3 rânduri și poate împinge ușor bara pe
   ecrane scunde. Dacă se întâmplă la numele real → opțiune rapidă: repus numele
   mai mic pe rândul lui (codul exista în `958e3e1`, ușor de readus).
2. **Pătratele de statistici B**: mărime/poziție/culoare se reglează direct în
   markup prin `--size` / `top` / `left` / `--bg-tile` (în secțiunea
   `data-variant="b"`, div-ul `.cluster--b`). Verificat cu cifre reale (agenție logată).
3. **Stare „logat, în grup”**: încă fallback la varianta A (dashboard dedicat =
   AMÂNAT, conform planului inițial).

---

## Comenzi / fișiere utile

- Singurul fișier atins în sesiune: `frontend/index.html`.
- Deploy: cPanel → Git Version Control → **Update from Remote** → **Deploy HEAD Commit**.
- Verificare rapidă „ce e live” (din Git Bash):
  ```
  curl -s "https://apartamentual.ro/?nc=$RANDOM" -o /tmp/x.html -w "%{size_download} bytes\n"
  grep -c "stat-tile" /tmp/x.html   # >0 => hero-b nou e live
  ```
  Local: `wc -c frontend/index.html` (trebuie să fie egal cu live).
- Repo: `bogdanbatog/apartamentual` · branch `main`.

---

## CSS/JS — repere în `frontend/index.html`

- Paleta + variabilele hero pe roluri: `.hero-stage{ … }` (~linia 296).
- Tipografie variante: `.hero-stage .hero[data-variant] .title/.lead` (~346-356).
- `.btn` variante: ~374. CTA marketing: `.cta-primary/.cta-secondary` ~249.
- Cluster A (vecini) + `.stat-tile` (B): ~390-448.
- Bara: `.aptbar*` ~445-454; responsive cluster/bară ~457-483.
- Markup hero-uri: `<div class="hero-stage">` ~1457 (marketing / A / B + aptbar).
- JS alegere variantă (getSession + cache + populate A/B): IIFE „HERO PE ROLURI",
  ~liniile 2065-2270.

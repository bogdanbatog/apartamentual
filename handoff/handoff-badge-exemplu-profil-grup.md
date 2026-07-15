# Handoff: Badge „Exemplu" pe profil, antet grup și membri-exemplu

> **STARE: IMPLEMENTAT, COMMIT + PUSH (2026-07-15).** Commit `c2e6ba6` pe `main`
> (`8d65f2b..c2e6ba6`), pushat pe GitHub (`bogdanbatog/apartamentual`).
> Rămâne de urcat manual din cPanel pe apartamentual.ro.

## Context și problemă

Utilizatorii și grupurile marcate ca exemplu (`is_demo`) aveau badge „Exemplu"
doar pe **listări** (`utilizatori.html`, `grupuri.html`). Pe paginile de
**detaliu** marcajul lipsea:
- Pagina de profil (`profile-view-new`) afișa „Utilizator Activ" chiar și pentru
  utilizatorii-exemplu — păreau conturi reale active.
- Pagina de grup (`grup-details`) nu avea deloc badge „Exemplu" în antet, iar
  membrii-exemplu nu erau marcați.

Obiectiv: pe paginile de detaliu, entitățile-exemplu se marchează „Exemplu",
nu „activ".

## Criteriu unic

Câmpul boolean **`is_demo`** din tabelele `grupuri` și `profiles` — aceeași
sursă de adevăr ca badge-urile existente de pe listări.

## Ce s-a implementat (commit `c2e6ba6`)

1. **`frontend/js/profile-view-new.js`** (`renderBasicInfo`, ~linia 256):
   dacă `profileData.is_demo` → badge „Exemplu" (gri neutru,
   `bg-gray-100 text-gray-600`) în loc de „Utilizator Activ" / „Agenție
   Imobiliară". Utilizatorii reali și agențiile rămân neschimbați.

2. **`frontend/grup-details.html` — antet** (HTML ~linia 963 + JS ~linia 1472):
   titlul înfășurat într-un rând flex; badge `#grupDemoBadge` (beige
   `#f0ece3`/`#6f6a61`, ca pe listare) afișat lângă nume când `group.is_demo`.

3. **`frontend/grup-details.html` — membri** (query ~linia 1373 + `renderMembers`
   ~linia 1767): `is_demo` adăugat la `select` pe `profiles` la încărcarea
   membrilor; badge „Exemplu" pe cardul membrului când `m.profile.is_demo`.

## Atins la nivel de date

Am adăugat coloana `is_demo` la query-ul `profiles` care încarcă membrii
grupului. E coloană publică, deja citită în `utilizatori.js` — fără implicații
RLS. NU s-a atins logica de plăți, join, membri sau alte fetch-uri.

## Verificat

- `node --check profile-view-new.js` → OK.
- `grup-details.html`: doar inserții (badge span + un `if` + o coloană în
  select), structura JS neatinsă.
- **Testul vizual end-to-end** (profil-exemplu, grup-exemplu cu membri-exemplu)
  rămâne de făcut pe site după deploy — nu se poate conduce auth-ul Supabase din
  Claude Code.

## ⚠️ Deploy

Push-ul pe GitHub NU schimbă site-ul live. Se urcă manual din **cPanel**:
- `frontend/js/profile-view-new.js`
- `frontend/grup-details.html`

## De testat după deploy

- Profil utilizator-exemplu → badge „Exemplu" (nu „Utilizator Activ").
- Grup-exemplu → badge „Exemplu" lângă nume în antet.
- Membru-exemplu într-un grup → badge „Exemplu" pe cardul lui.
- Utilizator / grup REAL → neschimbat („Utilizator Activ", fără badge).

## Legătură cu task-ul anterior

Punctul „badge Exemplu pe pagina de detaliu grup", amânat în
`handoff-buton-grup-exemplu.md`, este acum rezolvat aici. Rămân din acel handoff:
gardă backend pe cereri către grupuri demo, cererea pending a Alexandrei,
corecția „bloc mic" din descrieri.

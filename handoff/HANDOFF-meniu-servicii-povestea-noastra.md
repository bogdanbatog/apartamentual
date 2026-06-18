# HANDOFF Claude Code — „Servicii" în meniu + relocarea „Povestea noastră"

---

## ✅ STADIU: LIVRAT (2026-06-18) — commit `58f7321`, pushed pe `main`

**Audit cheie:** meniul e definit într-un SINGUR loc — `navItems` în `js/nav.js`. Nicio pagină nu are meniu hardcodat (inclusiv homepage, care folosește tot `nav.js`). Footer-ul (`js/footer.js` + footer inline `index.html`) avea deja „Povestea noastră".

**Făcut:**
- `js/nav.js`: meniu nou **Ce este · Servicii · Terenuri · Utilizatori · Grupuri · Parteneri** (scos „Povestea noastră" din header, adăugat „Servicii" → `/servicii.html`) + detectare `servicii` pentru starea „activ".
- `ce-este/index.html`: bloc proeminent „Povestea noastră" la finalul conținutului — randare Județului Housing (`assets/images/judetul-housing/randari/14-randare-fatada-strada.jpg`) + „5 familii, primul Baugruppen finalizat în România." + buton „Citește povestea →" → `povestea-noastra.html`. Responsive 2→1 coloană.
- `js/footer.js` + `index.html`: „Servicii" adăugat în coloana Navigare (oglindește meniul).
- `povestea-noastra.html` rămâne live și linkată (footer + bloc nou + CTA-uri homepage), doar scoasă din bara de meniu.

**Rămas:**
- **Deploy manual din cPanel** (nu e încă live pe apartamentual.ro).
- De verificat după deploy: meniul pe toate paginile, blocul Poveștii pe mobil, încărcarea imaginii.

---

## Context

Vrem să adăugăm „Servicii" în meniul principal, dar nu mai încape lângă celelalte iteme. Eliberăm slotul **scoțând „Povestea noastră" din header** și o facem **mai vizibilă** în alte trei locuri, fiindcă povestea Județului Housing e cea mai puternică dovadă că modelul funcționează în România — nu vrem s-o ascundem, vrem s-o mutăm acolo unde omul are nevoie de ea (între *înțeleg modelul* și *acționez*).

**NU este rebuild.** Trei modificări punctuale în structura existentă.

Rezultat dorit în header (6 iteme): **Ce este · Servicii · Terenuri · Utilizatori · Grupuri · Parteneri**.

---

## Faza 0 — Audit (NU scrie cod încă)

Citește repo-ul și raportează-mi:

- unde sunt definite itemele de meniu: în `nav.js`? hardcodate în header-ul fiecărei pagini? un partial/include comun? (de asta depinde dacă schimbarea se face într-un loc sau în mai multe);
- calea exactă a paginii „Povestea noastră" (`povestea-noastra.html`?);
- pagina „Ce este" — fișierul/directorul exact (`ce-este/`? `ce-este.html`?) și unde se termină conținutul ei principal (unde aș insera blocul nou);
- footer-ul: e markup comun (un include) sau e copiat în fiecare pagină? unde aș adăuga linkul;
- imaginea din Județul Housing disponibilă pentru bloc (caută în `assets/images/judetul-housing/`) — ce fișier folosesc;
- **pagina „Servicii": EXISTĂ deja?** caută `servicii*`. Dacă nu există, semnalează — vezi „De confirmat" mai jos (nu vreau link mort în meniu).

**STOP.** Prezintă plan scurt + întrebări. Așteaptă confirmarea mea.

---

## Faza 1 — Plan

Pe baza auditului, spune-mi exact: în ce fișier(e) modifici meniul, unde inserezi blocul în „Ce este", unde adaugi linkul în footer, și ce rută primește „Servicii". Confirmă înainte de implementare.

---

## Faza 2 — Implementare

### 1. Header
- **scoate** itemul „Povestea noastră" din meniul principal;
- **adaugă** „Servicii" imediat după „Ce este" (ordine: Ce este · Servicii · Terenuri · Utilizatori · Grupuri · Parteneri);
- „Servicii" linkează la ruta paginii de servicii (confirmată la Faza 0);
- aplică schimbarea în locul corect (dacă meniul e în `nav.js`/partial comun, un singur loc; dacă e hardcodat per pagină, în toate).

### 2. Bloc „Povestea noastră" la finalul paginii „Ce este"
Nu link pierdut în text, ci **bloc proeminent pe toată lățimea**, la finalul conținutului din „Ce este":
- imagine din Județul Housing (din `assets/images/judetul-housing/`);
- titlu scurt: „Povestea noastră";
- o linie: „5 familii, primul Baugruppen finalizat în România." *(factual, fără procente de economie, fără superlative)*;
- buton: „Citește povestea →" → `povestea-noastra.html`.
- **reutilizează** componentele/stilurile de bloc existente (card / secțiune cu imagine), nu inventa un sistem nou de stiluri.

### 3. Footer
- adaugă un link permanent „Povestea noastră" → `povestea-noastra.html` (dacă footer-ul e comun, o singură modificare; dacă e copiat, peste tot).

### Reguli de conținut (valabile peste tot)
- ton calm, explicativ — „arhitect care povestește"; fără superlative, fără promisiuni;
- **niciun procent de economie** nicăieri;
- „mic bloc", nu „bloc"; „grupuri de construcție" / Baugruppen, nu „co-housing" în context de marketing.

---

## Faza 3 — Test + commit

- verifică: meniul arată cele 6 iteme corecte pe toate paginile; „Servicii" duce unde trebuie; „Povestea noastră" NU mai e în header;
- blocul din „Ce este" se vede clar, e responsive, butonul duce la `povestea-noastra.html`;
- linkul din footer funcționează de pe orice pagină;
- nimic stricat la nav.js / restul meniului;
- commit cu mesaj clar ca save point. **NU** declanșa deploy fără confirmarea mea.

---

## De confirmat cu mine ÎNAINTE de Faza 2

1. **Pagina „Servicii"** — dacă încă NU există: vrei (a) să amânăm itemul „Servicii" în meniu până construim pagina (o facem ca task separat), sau (b) să pun un placeholder minimal acum ca să nu fie link mort? *(Implicit, dacă nu-mi spui: amânăm itemul „Servicii" și fac doar relocarea Poveștii, ca să nu livrăm link mort.)*
2. ruta/numele exact al paginii de servicii;
3. unde se află și cum e structurat conținutul paginii „Ce este" (din audit), ca să confirmăm locul blocului.

---

## Opțional (dacă vrei să-l incluzi acum)

Pe **homepage** ai deja o secțiune Județul Housing. Dacă nu are un CTA „Citește povestea →" către `povestea-noastra.html`, adaugă-l — așa povestea ajunge și la vizitatorii nelogați care nu deschid meniul. (Spune-mi dacă îl bag în acest handoff sau îl lăsăm separat.)

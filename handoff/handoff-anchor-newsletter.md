# Handoff: anchor direct către formularul de newsletter (homepage)

**Context:** Newsletterul se trimite manual (email) și avem nevoie de un link direct către formularul de abonare de pe homepage. Secțiunea de newsletter (banda „Serialul Județului Housing") nu are în prezent niciun `id`, deci nu poate fi țintită cu un anchor. Scopul: linkul `https://apartamentual.ro/#newsletter` să ducă utilizatorul direct pe formular.

**Amploare:** o singură editare de un rând în `index.html`. Nu se modifică nimic altceva. Nu se ating CSS, JS, alte pagini.

---

## Faza 1: Audit

1. Deschide `index.html` din rădăcina repo-ului.
2. Găsește secțiunea de newsletter. Reper (în jurul liniei 1731-1732):

```html
<!-- ── NEWSLETTER (bandă ușoară, double opt-in) ── -->
<section class="section nl-band" aria-label="Abonare newsletter">
```

3. Verifică că în `index.html` NU există deja un element cu `id="newsletter"` (căutare pe tot fișierul). Verifică și în `js/` dacă vreun script folosește selectorul `#newsletter` (nu ar trebui; formularul e țintit prin clasa `.js-newsletter-form`).
4. Raportează ce ai găsit.

**STOP 1: prezintă rezultatul auditului și așteaptă confirmarea lui Lucian înainte de a continua.**

---

## Faza 2: Plan

Modificarea propusă, un singur rând:

```html
<!-- înainte -->
<section class="section nl-band" aria-label="Abonare newsletter">

<!-- după -->
<section class="section nl-band" id="newsletter" aria-label="Abonare newsletter">
```

Niciun alt fișier atins. Niciun impact pe stiluri (CSS-ul benzii folosește clasa `.nl-band`, nu id) sau pe JS (handler-ul folosește `.js-newsletter-form`).

**STOP 2: confirmă planul cu Lucian.**

---

## Faza 3: Implementare

1. Aplică modificarea exact ca în plan.
2. Nu face alte „îmbunătățiri" colaterale în fișier, chiar dacă observi altceva (există o listă separată de curățenie de texte; nu e treaba acestui handoff).

---

## Faza 4: Test (local, înainte de commit)

1. Verifică diff-ul: trebuie să conțină o singură linie modificată, doar adăugarea `id="newsletter"`.
2. Deschide `index.html` local în browser (sau servește static) și accesează `index.html#newsletter`: pagina trebuie să sară la banda de newsletter, cu formularul vizibil.
3. Verifică vizual că banda arată neschimbat (stiluri intacte).

**STOP 3: prezintă diff-ul complet lui Lucian și așteaptă aprobarea explicită pentru commit. NU face commit / push fără aprobare: push = deploy live pe Render.**

---

## Faza 5: Commit (doar după aprobarea de la STOP 3)

1. Commit cu mesajul:

```
Add id="newsletter" anchor to homepage newsletter band for direct linking
```

2. Push pe branch-ul principal (declanșează auto-deploy Render, ~2 min).
3. După deploy, test final pe live: `https://apartamentual.ro/#newsletter` trebuie să ducă direct la formular, pe desktop și pe mobil.
4. Raportează rezultatul testului live.

---

## Criteriu de succes

`https://apartamentual.ro/#newsletter` deschide homepage-ul poziționat pe formularul de abonare, fără nicio altă schimbare vizibilă sau funcțională pe pagină.

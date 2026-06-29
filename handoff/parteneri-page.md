# Handoff: Pagina „Parteneri" (parteneri.html)

> **Invocare unică pentru Claude Code:**
> „Citește `_handoff/parteneri-page.md` și execută-l fază cu fază. Oprește-te la fiecare STOP și așteaptă confirmarea mea. Nu face commit și nu face push fără aprobarea mea explicită."

---

## Context

Construim o pagină nouă, `parteneri.html`, care prezintă profesioniștii reali care au construit **Județului Housing** (prima construcție colaborativă finalizată din România). Numele de brand este **„Județului Housing"**, formă fixă, invariabilă, identic în orice context (NU „Județul Housing").

Pagina are trei roluri, dar la lansare construim doar primele două vizibil:

1. **Peretele de credit** (privire în spate): grila de 8 carduri cu firmele reale de pe șantier. Dovadă, nu reclamă.
2. **Invitația generală** (privire în față, deschisă oricui): un bloc la final pentru profesioniștii care vor să devină parteneri pe viitor.
3. **Steaguri individuale de disponibilitate** pe carduri: NU se construiesc acum. Cardurile rămân credit-only. Modelul de card trebuie doar să fie pregătit structural să accepte pe viitor un marcaj opțional „Disponibil pentru grupuri noi", fără să-l afișeze acum.

Reguli de conținut care nu se încalcă:
- Fără promisiuni de procente de economie.
- Fără em-dash în textul afișat (se folosesc virgule sau două puncte).
- Diacritice corecte peste tot.
- Zero mențiune comercială pe pagină (fără „plătit", „listare", „comision"). Modelul de plată pentru parteneri noi se decide separat, peste ~6 luni.
- Ton calm, explicativ, de arhitect care povestește.

---

## FAZA 1 — Audit  ⛔ STOP la final

Înainte de orice cod, inspectează repo-ul și raportează-mi:

1. **Șablonul de pagină**: cum sunt structurate paginile statice existente (ex. `ce-este.html`, `servicii.html`). Există un header/footer partajat (include JS, fetch de partial, sau copy-paste în fiecare fișier)? Răspunsul stabilește cum integrăm header-ul și footer-ul în `parteneri.html`.
2. **Tokenii de design / clasele CSS** efectiv folosite live (culori, fonturi, spațieri, clasa de container, butoane/CTA). Le reutilizăm, nu inventăm altele. Notează numele variabilelor CSS reale.
3. **Navigația**: ordinea curentă din header. (Din memorie: „Ce este" apoi „Servicii"; „Povestea noastră" a fost scoasă din header.) Confirmă ordinea reală.
4. **Mecanismul de contact** folosit de FAB-ul „Cere consultanță" / butoanele de contact existente (pagină dedicată? `mailto:`? modal?). CTA-ul „Contactează-ne" din invitație va folosi exact același mecanism.
5. **Meta OG / share**: cum arată tag-urile OG pe o pagină statică existentă, ca să le replicăm static pe `parteneri.html` (fără SSR, conform deciziei anterioare).

**⛔ STOP.** Raportează-mi cele 5 puncte și propune: (a) unde în meniu intră „Parteneri", (b) dacă punem și link permanent în footer. Aștept confirmarea mea înainte de Faza 2.

---

## FAZA 2 — Plan

După confirmarea auditului, planul de implementare este:

- Creez `parteneri.html` pe baza șablonului real de pagină (header + footer identice cu restul site-ului).
- Conținut: `eyebrow` + titlu pagină, paragraf intro, grilă responsivă de 8 carduri, bloc de invitație la final.
- Adaug intrarea „Parteneri" în navigație (poziția confirmată în Faza 1).
- Opțional, link în footer (dacă ai confirmat).
- CSS-ul cardurilor reutilizează tokenii existenți; structura de card e pregătită pentru un viitor badge de disponibilitate (comentat, nerandat).

Fără JS dinamic, fără backend, fără Supabase. Pagină pur statică.

---

## FAZA 3 — Implementare

### 3.1 Conținut `parteneri.html` (secțiunea de body)

Inserează această secțiune în interiorul container-ului standard de pagină, între header și footer. Adaptează clasele la cele reale găsite în audit; clasele de mai jos sunt orientative.

```html
<main class="container parteneri">

  <p class="eyebrow">Profesioniștii proiectului-pilot</p>
  <h1 class="page-title">Parteneri</h1>

  <p class="page-intro">
    O construcție colaborativă se face cu profesioniști reali. Aici sunt cei care
    au construit Județului Housing: constructorul, instalațiile, tâmplăriile,
    hidroizolațiile, termoizolațiile și fonoizolațiile, confecțiile metalice.
    Și tot aici e locul pentru profesioniștii care vor să lucreze, de acum înainte,
    cu grupuri care își construiesc propriul bloc.
  </p>

  <section class="parteneri-grid" aria-label="Profesioniștii Județului Housing">

    <article class="partener-card">
      <h2 class="partener-nume">Mozaic Engineering</h2>
      <p class="partener-rol">Constructor general</p>
      <p class="partener-desc">A executat structura de rezistență și arhitectura clădirii.</p>
      <!-- viitor: <span class="partener-badge">Disponibil pentru grupuri noi</span> -->
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">Ecodivision</h2>
      <p class="partener-rol">Instalații sanitare și termice (furnizor)</p>
      <p class="partener-desc">A furnizat sistemele de instalații sanitare și termice.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">Hidrotec Instalații</h2>
      <p class="partener-rol">Instalații sanitare și termice (execuție)</p>
      <p class="partener-desc">A executat instalațiile sanitare și termice.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">Anyta Falko</h2>
      <p class="partener-rol">Instalații electrice</p>
      <p class="partener-desc">A executat instalațiile electrice.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">Qfort</h2>
      <p class="partener-rol">Tâmplării exterioare</p>
      <p class="partener-desc">A montat tâmplăriile exterioare PVC/aluminiu.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">HC93</h2>
      <p class="partener-rol">Hidroizolații</p>
      <p class="partener-desc">A executat hidroizolațiile la terase, balcoane și jardiniere.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">ISOVER</h2>
      <p class="partener-rol">Termoizolații și fonoizolații</p>
      <p class="partener-desc">Termoizolații exterioare și fonoizolații interioare.</p>
    </article>

    <article class="partener-card">
      <h2 class="partener-nume">CETBOX</h2>
      <p class="partener-rol">Confecții metalice</p>
      <p class="partener-desc">Confecții metalice exterioare și balustrade.</p>
    </article>

  </section>

  <section class="parteneri-invitatie">
    <h2 class="invitatie-titlu">Ești profesionist în construcții și vrei să lucrezi cu grupuri colaborative?</h2>
    <p class="invitatie-text">
      Constructori, proiectanți, furnizori de sisteme: dacă vrei să fii alături de
      grupurile care își construiesc propriul bloc, scrie-ne.
    </p>
    <a class="cta cta-primary" href="__CONTACT_HREF__">Contactează-ne</a>
  </section>

</main>
```

> `__CONTACT_HREF__` se înlocuiește cu mecanismul de contact real identificat în audit (pagina de contact, `mailto:apartamentual@ltfbstudio.ro`, sau modalul FAB). Confirmă-mi care înainte.

### 3.2 CSS (orientativ, aliniază la tokenii reali)

```css
.parteneri { padding-top: 2rem; padding-bottom: 4rem; }

.page-intro {
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 720px;
  margin: 1rem 0 2.5rem;
}

.parteneri-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-bottom: 3.5rem;
}

.partener-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1.25rem 1.25rem 1.4rem;
  background: #fff;
  transition: border-color 0.2s;
}
.partener-card:hover { border-color: var(--border-hover); }

.partener-nume {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.partener-rol {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 0.6rem;
}

.partener-desc {
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-secondary);
}

/* Pregătit pentru viitor, nerandat acum */
.partener-badge {
  display: inline-block;
  margin-top: 0.8rem;
  font-size: 12px;
  font-weight: 500;
  color: #BF6B50;
  border: 1px solid #BF6B50;
  border-radius: 999px;
  padding: 3px 10px;
}

.parteneri-invitatie {
  border-top: 1px solid var(--border);
  padding-top: 2.5rem;
  max-width: 640px;
}
.invitatie-titlu { font-size: 22px; font-weight: 500; line-height: 1.25; margin-bottom: 0.75rem; }
.invitatie-text { font-size: 15px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 1.25rem; }
```

### 3.3 Navigație + footer

- Adaugă „Parteneri" în header, la poziția confirmată în Faza 1.
- Dacă ai confirmat link în footer, adaugă-l acolo.
- Verifică să fie consistent pe TOATE paginile (dacă header-ul e copiat în fiecare fișier, actualizează peste tot; dacă e partial partajat, e un singur loc).

### 3.4 `<head>` (meta + OG static)

```html
<title>Parteneri — ApartamenTUal</title>
<meta name="description" content="Profesioniștii reali care au construit Județului Housing, prima construcție colaborativă finalizată din România.">
<meta property="og:title" content="Parteneri — ApartamenTUal">
<meta property="og:description" content="Profesioniștii reali care au construit Județului Housing.">
<meta property="og:type" content="website">
<meta property="og:url" content="https://apartamentual.ro/parteneri.html">
<!-- og:image: reutilizează imaginea OG standard a site-ului -->
```

---

## FAZA 4 — Test (local, înainte de orice commit)

Verifică:
1. Pagina se deschide local și arată corect pe desktop și pe mobil (grila trece la 1 coloană pe ecran îngust).
2. Cele 8 carduri apar toate, cu diacritice corecte, fără em-dash în text.
3. Header-ul și footer-ul sunt identice cu restul site-ului; linkul „Parteneri" e activ și duce la pagină.
4. Numele apare „Județului Housing" peste tot, niciun „Județul Housing".
5. CTA „Contactează-ne" duce la mecanismul de contact corect.
6. Niciun cuvânt despre plată/listare/comision pe pagină.

Raportează-mi rezultatul testului.

---

## FAZA 5 — Commit  ⛔ STOP înainte de push

> Push pe GitHub = deploy automat pe Render. NU face push fără aprobarea mea explicită.

1. Pregătește commit-ul (mesaj propus: `Add parteneri.html: pagina de credit Județului Housing + invitatie parteneri`).
2. Arată-mi `git status` și `git diff` rezumat: ce fișiere s-au modificat (parteneri.html nou + fișierele de navigație/footer atinse).
3. **⛔ STOP.** Aștept „aprob push" de la mine. Abia apoi faci push.

---

## Note pentru viitor (NU se implementează acum)

- Steag „Disponibil pentru grupuri noi" per card, activat individual după ce vorbesc cu fiecare partener.
- Tier de directory plătit pentru parteneri noi (decizie de model comercial peste ~6 luni; declanșator probabil „primul lead trimis", nu „au trecut 6 luni").
- Mozaic Engineering: candidatul principal pentru primul steag de disponibilitate, dar abia după discuție directă cu ei.

# Completare handoff: Parteneri (site-uri + contacte)

> **Invocare pentru Claude Code:**
> „Citește `_handoff/parteneri-page-completare.md`. Înlocuiește secțiunea 3.1 din `_handoff/parteneri-page.md` cu cardurile finale de mai jos. Restul fazelor (audit, navigație, test, STOP înainte de push) rămân valabile."

Această completare aduce două lucruri:
1. Pe fiecare card unde există, un **link către site-ul partenerului** (public, randat).
2. **Adresele de email** ale partenerilor, doar ca **referință internă**, comentate în cod și listate într-un bloc separat. NU se afișează pe pagină.

Motiv: site-ul partenerului întărește dovada (vizitatorul poate verifica singur că firma e reală). Adresa de email NU se publică: partenerii nu și-au dat încă acordul, iar emailurile expuse public atrag spam. Sunt în document doar ca să ai tu evidența completă.

Decizie rămasă: **Hidrotec Instalații**. L-am păstrat ca și card de credit (executant real, mențiune factuală), dar fără site și fără email, fiindcă nu avem date de contact. Dacă preferi să-l scoți complet, șterge cardul lui din blocul de mai jos. Restul intro-ului rămâne corect oricum (acolo zicem „instalațiile" generic, fără să numim firma).

---

## 3.1 (înlocuiește) Conținut carduri

```html
<section class="parteneri-grid" aria-label="Profesioniștii Județului Housing">

  <article class="partener-card">
    <h2 class="partener-nume">Mozaic Engineering</h2>
    <p class="partener-rol">Constructor general</p>
    <p class="partener-desc">A executat structura de rezistență și arhitectura clădirii.</p>
    <a class="partener-site" href="https://www.mozaiceng.ro/" target="_blank" rel="noopener">mozaiceng.ro</a>
    <!-- contact intern (NU se afișează): andrei.truica@mozaiceng.ro -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">Ecodivision</h2>
    <p class="partener-rol">Instalații sanitare și termice (furnizor)</p>
    <p class="partener-desc">A furnizat sistemele de instalații sanitare și termice.</p>
    <a class="partener-site" href="https://ecodivision.ro/" target="_blank" rel="noopener">ecodivision.ro</a>
    <!-- contact intern (NU se afișează): office@ecodivision.ro -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">Hidrotec Instalații</h2>
    <p class="partener-rol">Instalații sanitare și termice (execuție)</p>
    <p class="partener-desc">A executat instalațiile sanitare și termice.</p>
    <!-- fără site și fără contact disponibil -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">Anyta Falko</h2>
    <p class="partener-rol">Instalații electrice</p>
    <p class="partener-desc">A executat instalațiile electrice.</p>
    <a class="partener-site" href="https://anyta.ro/" target="_blank" rel="noopener">anyta.ro</a>
    <!-- contact intern (NU se afișează): comenzi@anyta.ro -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">Qfort</h2>
    <p class="partener-rol">Tâmplării exterioare</p>
    <p class="partener-desc">A montat tâmplăriile exterioare PVC/aluminiu.</p>
    <a class="partener-site" href="https://qfort.ro/" target="_blank" rel="noopener">qfort.ro</a>
    <!-- contact intern (NU se afișează): office@qfort.ro -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">HC93</h2>
    <p class="partener-rol">Hidroizolații</p>
    <p class="partener-desc">A executat hidroizolațiile la terase, balcoane și jardiniere.</p>
    <a class="partener-site" href="https://hc93.ro/" target="_blank" rel="noopener">hc93.ro</a>
    <!-- contact intern (NU se afișează): office@hc93.ro -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">ISOVER</h2>
    <p class="partener-rol">Termoizolații și fonoizolații</p>
    <p class="partener-desc">Termoizolații exterioare și fonoizolații interioare.</p>
    <a class="partener-site" href="https://www.isover.ro/" target="_blank" rel="noopener">isover.ro</a>
    <!-- contact intern (NU se afișează): info.constructionproducts@saint-gobain.com -->
  </article>

  <article class="partener-card">
    <h2 class="partener-nume">CETBOX</h2>
    <p class="partener-rol">Confecții metalice</p>
    <p class="partener-desc">Confecții metalice exterioare și balustrade.</p>
    <!-- fără site; contact intern (NU se afișează): e.tolstobrach@gmail.com -->
  </article>

</section>
```

## CSS suplimentar (pentru link-ul de site)

```css
.partener-site {
  display: inline-block;
  margin-top: 0.7rem;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
}
.partener-site:hover { color: var(--text-primary); border-bottom-color: var(--border-hover); }
```

---

## Referință internă de contacte (NU se publică)

Doar pentru evidența ta și pentru trimiterea mailurilor de acord. Nu intră pe pagină.

| Partener | Site | Email contact |
|---|---|---|
| Mozaic Engineering | mozaiceng.ro | andrei.truica@mozaiceng.ro |
| Ecodivision | ecodivision.ro | office@ecodivision.ro |
| Hidrotec Instalații | - | - |
| Anyta Falko | anyta.ro | comenzi@anyta.ro |
| Qfort | qfort.ro | office@qfort.ro |
| HC93 | hc93.ro | office@hc93.ro |
| ISOVER | isover.ro | info.constructionproducts@saint-gobain.com |
| CETBOX | - | e.tolstobrach@gmail.com |

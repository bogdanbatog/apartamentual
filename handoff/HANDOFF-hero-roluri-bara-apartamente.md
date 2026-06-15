# HANDOFF Claude Code — Hero pe roluri + restilizare bara de apartamente

## Context

Homepage-ul ApartamenTUal există deja (vanilla HTML/CSS/JS, conectat la `nav.js` / `nav.css`, footer, FAQ, sesiune Supabase). Vrem ca **zona de sus a hero-ului** să se adapteze după starea utilizatorului, **fără rebuild** — păstrăm tot ce e deja conectat. Separat, restilizăm bara colorată de apartamente de sub hero.

**NU este un rebuild.** Integrezi două variante noi de hero în pagina existentă și schimbi stilul barei. Atât.

## Fișier de referință

Am salvat în repo bundle-ul de la Claude Design ca `/_design/hero-reference.html` (sau pune-l unde îți e comod și spune-mi calea). E un fișier standalone cu:
- fonturile Hanken Grotesk încorporate base64 — **NU** le copia ca base64; folosește încărcarea de fonturi pe care o are deja site-ul, sau Google Fonts dacă deja se folosește acolo;
- un comutator `.switcher` (tab A/B) și un `<script>` de demo — **se elimină complet**, sunt doar pentru review;
- variantele A și B + bara de apartamente, din care extragi CSS-ul și markup-ul.

## Cele 4 stări ale hero-ului

1. **Nelogat** → hero-ul de marketing ACTUAL, **neschimbat**. (Bundle-ul de referință nu conține această variantă pentru că o avem deja în repo.)
2. **Logat, utilizator fără grup** → **Varianta A**.
3. **Logat, cont agenție** → **Varianta B**.
4. **Logat, utilizator ÎN grup** → **AMÂNAT.** Pentru acum fă fallback la Varianta A. **Nu** construi dashboard dedicat acum.

---

## Faza 0 — Audit (NU scrie cod încă)

Citește repo-ul și raportează-mi:

- fișierul homepage (probabil `index.html`) — unde începe și se termină markup-ul hero-ului curent + markup-ul + CSS-ul barei de apartamente curente (numele clasei);
- cum se citește sesiunea Supabase în paginile existente — **reutilizează exact același pattern** (ex. ce face `nav.js`);
- numele coloanei / flag-ului pentru **rolul de agenție** (caută în `nav.js`, paginile admin, fluxul de profil/înregistrare);
- tabelul / relația pentru **apartenența la grup** (caută în sistemul de grupuri și paginile de grupuri);
- datele de **matching**: tag-urile de interese + zonele preferate de pe profil; există deja o numărătoare de „interese comune" sau trebuie citite tabelele direct? Ce tabele/coloane?
- cum sunt incluse `nav.js` / `nav.css` / footer / `faq.js` în homepage, ca să le păstrăm intacte.

**STOP.** Prezintă un plan scurt + întrebările deschise. Așteaptă confirmarea mea înainte de Faza 1.

---

## Faza 1 — Plan

Pe baza auditului, propune-mi:
- ce markup adaugi și unde;
- o singură funcție care alege varianta după `sesiune + rol + apartenență grup`;
- ce interoghezi pentru A (vecinii cu cele mai multe interese comune) și pentru B (nr. propuneri aprobate / în așteptare).

Confirmă cu mine înainte de implementare.

---

## Faza 2 — Implementare

**Reguli generale**
- NU rebuild. Păstrează header / `nav.js` / `nav.css` / footer / FAQ existente.
- Adaugă CSS-ul variantelor din fișierul de referință în CSS-ul homepage-ului (NU inline): paleta pământie (variabilele `--terracotta`, `--slate`, `--sage`, `--mauve`, `--ochre`, `--cream-tile` etc.), `.hero[data-variant]`, `.eyebrow`, `.title`, `.lead`, `.actions`/`.btn`, `.micro`, `.cluster`/`.neighbor` + `@keyframes floaty`, `.status`/`.chip`, `.landpin`.
- Randează hero-ul imediat; populează clusterul / chips-urile **după** ce vin datele (nu bloca randarea paginii pe interogare).
- O singură interogare per variantă.

**Varianta A — utilizator logat fără grup**
- eyebrow: „Bun venit înapoi"; titlu: „Hai să-ți găsești grupul, {prenume}." — `{prenume}` din `displayName()`; dacă lipsește, folosește titlul fără numele atașat (fără virgulă goală).
- lead + 2 CTA: „Vezi terenuri" → pagina terenuri; „Grupuri în formare" → pagina grupuri (rutele exacte le confirmi la Faza 0).
- cluster: **maxim 4 vecini** cu CELE MAI MULTE interese comune cu utilizatorul curent. Pe fiecare pătrat: inițiale + badge „N interese" + tooltip „Nume · N interese comune". Link la profilul public.
- micro: „{N} vecini cu cele mai multe interese comune cu tine.", unde N = câți afișezi efectiv (≤4).
- **stare goală**: dacă utilizatorul n-are încă tag-uri / zone, afișează un cluster gol cu un mesaj blând (ex. „Completează-ți profilul ca să-ți găsim vecini compatibili"). NU inventa date, NU afișa procente.

**Varianta B — cont agenție**
- eyebrow: „Cont agenție"; titlu: „Terenurile tale, {nume agenție}."
- chips: „{X} aprobate" + „{Y} în așteptare" — din propunerile reale ale agenției.
- 2 CTA: „Propune un teren nou", „Vezi propunerile mele".
- micro: ultima propunere (dată relativă + locație), dacă există.
- **FĂRĂ avataruri de utilizatori** — agențiile nu pot vedea profiluri; respectă restricția existentă. Opțional, dacă e ușor: pini de teren (`.landpin`) cu ultimele propuneri ale agenției; altfel omite.

**Despre „interese comune"**
- Este o **numărătoare** de tag-uri / zone comune, **NU un procent** (sistemul nu calculează un procent real). Nicăieri „X% potrivire".
- Atenție să nu confunzi cu scorul 0–15 de completitudine a profilului de pe pagina Utilizatori — acela e pentru sortare, nu pentru compatibilitate.

---

## Faza 3 — Bara de apartamente (restilizare)

Bara curentă are borders / linii de demarcație între pătrate. O aducem la stilul din fișierul de referință:

- pătratele se separă prin **GAP (5px)**, NU prin borders / linii;
- colțuri ușor rotunjite: `border-radius` ~2px ca în referință (poți crește la 5–6px dacă vrem mai rotund — confirmă vizual cu mine);
- **fără border** pe pătrate; fundalul paginii (`--paper`) se vede prin gap;
- structură: rânduri flex cu spans ponderate pe lățime — vezi `.aptbar` / `.aptbar__cols` / `.aptbar__row` / `.aptbar__big` din referință. Poți păstra compoziția actuală de culori și proporții; schimbi DOAR modul de separare (gap + radius în loc de borders).
- aplică consistent oriunde apare aceeași bară.

---

## Faza 4 — Test + commit

- testează local toate stările: nelogat, user fără grup, user în grup (fallback A), agenție;
- testează lipsa de date: user nou fără tag-uri (cluster gol corect), agenție fără propuneri (chips pe 0, fără micro fals);
- responsive (mobil: clusterul devine rând orizontal, max 2–3 pătrate — vezi media queries din referință);
- commit cu mesaj clar ca save point. **NU** declanșa deploy fără confirmarea mea.

---

## De confirmat cu mine ÎNAINTE de Faza 2

1. numele coloanei pentru rolul de agenție + tabelul/relația de apartenență la grup (din audit);
2. rutele exacte pentru CTA: terenuri, grupuri, „propune un teren", „propunerile mele";
3. la Varianta B vrem pini de teren (`.landpin`) sau doar chips-urile de status?

# Handoff: reproiectarea paginii `ce-este/exemple-europa.html`

**Data:** 29 septembrie 2026
**De ce acum:** homepage-ul nelogat (commit `252d04f`) are o bandă de încredere nouă, cu linkul „vezi exemple" spre pagina asta. Deci mai mulți oameni ajung aici, iar pagina are trei probleme.

---

## ✅ STADIU (29 septembrie, seara): PUBLICAT

Commit `883064f`, deploy din cPanel făcut, verificat pe live (toate cele 8 imagini se încarcă, nav + footer OK, secțiunile vechi dispărute).

**Ce s-a decis în sesiune:**
- Pozele celor 5 exemple vechi **rămân** (tot din Storage, `articles/01b1acd7-...`); **Lucian cere acord** arhitecților. Dacă cineva refuză → se scoate poza lui.
- Toate cele 5 exemple vechi rămân; Scarwafa și De Sijs etichetate „Co-housing, model înrudit”, puse la final, explicate în intro.
- Ordine: AusbauHaus Neukölln, Haeck5, D2, Brutopia, Scarwafa, De Sijs.
- D2 rămâne scurt (un paragraf, fără frază „Față de Județului Housing” — avem prea puține date).
- Haeck5 și Brutopia: fără comentarii suplimentare despre Județului (Lucian n-a vrut să completeze); a rămas doar comparația de mărime. Neconfirmat dacă voia să dispară tot paragraful „Față de Județului Housing” la acestea două — de întrebat dacă revine subiectul.
- Linkul Berlin: `https://praegerrichter.de/Ausbauhaus-Neukolln-Berlin-2014`.

**Ce s-a făcut concret:**
- `frontend/ce-este/exemple-europa.html` rescris: fără casete, stilul paginii în `<style>` inline (clase `.ex-*`), pe v9 + `ce-este.css`.
- Pozele Berlin în repo: `frontend/assets/images/exemple-europa/ausbauhaus-neukolln-{fatada.jpg,raft.png,curte.jpg}`. Creditul foto Praeger Richter e sub ele (obligatoriu, condiția acordului).
- Scoase: „Impactul în Europa” (25% / 200+ / 0%-100%), „Ce putem învăța”, „Lecții învățate”, „Tendințe”, „Aplicabilitatea în România”.

## ⏳ RĂMAS DE FĂCUT

1. **Acordurile foto** pentru Haeck5, D2, Brutopia, Scarwafa, De Sijs (le cere Lucian). Pe măsură ce vin: se adaugă sub fiecare poză `<p class="ex-credit">Foto: …</p>` (ca la Berlin). Refuz → se scoate `<div class="ex-photo">` al exemplului.
2. Opțional: textul cererii de acord (Claude s-a oferit să-l scrie, după modelul Praeger Richter).
3. Neverificat pe lățime de telefon (390px) pe live; pe desktop e OK. Grid-ul `.ex-pair` trece pe o coloană sub 640px.
4. De verificat cu Lucian: la Haeck5 pagina veche zicea și „3 niveluri”, și „3 etaje”; acum scrie „trei niveluri”.

> Secțiunile de mai jos descriu starea DINAINTE de sesiune și sunt păstrate ca istoric.

---

## Problemele de acum

1. **Poze fără drept de folosire.** Toate cele cinci carduri (D2/IFUB, Haeck5, Scarwafa, Brutopia, De Sijs) au poze din `storage/.../articles/01b1acd7-...`, luate de pe ArchDaily și de pe site-urile arhitecților. Pentru Brutopia și De Sijs s-a stabilit deja (vezi `handoff/handoff-curatare-articole-exemple.md`) că nu avem drept; acolo s-au curățat doar articolele din News, NU și pagina asta.
2. **Afirmații fără sursă.** Secțiunea „Impactul în Europa": „25% din construcțiile noi în Germania sunt proiecte Baugruppen" (aproape sigur fals la nivel de țară), „200+ proiecte co-housing în Danemarca", „0% / 100% profit dezvoltator / valoare în calitate" (sună a promisiune de economie; vezi regula din CLAUDE.md).
3. **Note de lucru publice.** În fiecare card, „Ce putem învăța / aplicabilitate" conține texte pentru noi („Pentru platforma ta, este un exemplu concret de…", „Poți evidenția utilizarea lemnului…").

Plus: arată „a AI", spune Lucian. Casete colorate, steaguri emoji, „Specificații cheie / Inovații / Particularități" în liste cu buline.

---

## Ce a decis Lucian

- **Se scot secțiunile care nu sunt strict exemple:** „Impactul în Europa", „Ce putem învăța" din fiecare card, „Lecții învățate", „Tendințe actuale în Europa", „Aplicabilitatea în România" (e oricum pe `legislatia-romania.html`). Rămân exemplele și linkurile „Continuă să explorezi".
- **Primul exemplu devine AusbauHaus Neukölln** (Berlin, Praeger Richter Architekten), cel din ultima postare de pe Facebook.
- **Aspect nou**, fără casete.

## Direcția de design propusă (Lucian a văzut-o în chat, n-a respins-o, dar nici n-a aprobat-o explicit; arată-i o machetă întâi)

- Fiecare exemplu = o secțiune pe toată lățimea, fără casetă: fotografie mare, titlul (proiect, oraș), un rând de fapte mărunte (`Berlin · 24 de locuințe · Praeger Richter Architekten · Deutscher Bauherrenpreis`), apoi povestea în 2-3 paragrafe, cu vocea „arhitectului care povestește".
- Pentru fiecare, o frază despre legătura cu Județului Housing: ce seamănă, ce e altfel.
- Pe designul v9 (`css/apartamentual-v9.css`, pe care `ce-este/` îl folosește deja).
- Fără em-dash în textul citit de oameni. Fără procente de economie. Baugruppen = grupuri de construcție; co-housing doar comparativ (atenție: Scarwafa și De Sijs sunt co-housing, nu Baugruppen; de discutat dacă rămân și cum sunt etichetate).

## ⏳ De întrebat pe Lucian ÎNAINTE de cod (una câte una)

1. **Pozele celorlalte patru exemple:** le scoatem cu totul, le lăsăm fără poză (cu link spre sursă), sau cereți acord ca la Praeger Richter?
2. Rămân toate cele patru exemple vechi, sau doar cele care sunt Baugruppen propriu-zise?

---

## Materialul pentru AusbauHaus Neukölln

**Folder:** `continut/exemple Baugruppen/New folder/` — trebuia redenumit în `AusbauHaus Neukölln, Berlin (Praeger Richter)`, dar Windows a refuzat („Device or resource busy"; folderul sau documentul era deschis la Lucian). **Verifică dacă a fost redenumit.**

Conține: `AusNK_01_Fassade-Sued.jpg` (și o copie „(1)", vezi memoria despre Downloads: „(1)" nu înseamnă automat duplicat), `221108_…Foto-2.jpg`, `221220_…Foto-01/02/04.jpg`, `230124_…Konzeptisometrie.png`, `Ausbaustandard-Selbstausbau_WE-20.jpg`, `Grundrissflexibilitaet.gif`, și textul postării `FB_Nu suntem singurii care au făcut asta.docx`.

**Credit foto obligatoriu** (din postare): „Foto: Andreas Friedel și Christoph Naumann, prin amabilitatea Praeger Richter Architekten."

**Faptele din postare** (sursa de adevăr pentru text): Berlin, Neukölln; grup de familii; 24 de unități de locuit și de lucru; teren cumpărat împreună, asociație, rolul dezvoltatorului preluat de ei; fiecare familie proprietară pe apartamentul ei; structură comună prefabricată „ca un raft" (planșee cu deschidere mare, fără pereți portanți în apartamente, fațadă cu ritm regulat de ferestre); 3 m înălțime, loggie spre sud; trei niveluri de finisaj (finisat / minimal / la roșu); „puțină co-decizie la structură, multă libertate în interior"; execuție cu ~12 luni mai scurtă; primul de acest fel din cartier; Deutscher Bauherrenpreis. Legătura cu Județului Housing e scrisă chiar în postare.

Postarea mai conține „Link în primul comentariu": linkul spre proiect nu e în docx. Cere-l lui Lucian sau folosește pagina Praeger Richter.

Pozele sunt și în `continut/webinarii/20260903/exemplul din Berlin/` (folosite la webinar).

---

## Unde se publică
Doar `frontend/ce-este/exemple-europa.html` (+ poze noi, de urcat undeva: în repo sau în Storage, de decis). Deploy din cPanel, ca de obicei. Nu atinge plăți, DB, RLS, edge functions.

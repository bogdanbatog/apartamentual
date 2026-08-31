# Handoff: homepage nelogat, „ce face platforma"

**Data:** 31 august 2026
**Stadiu:** comis și împins pe GitHub, `020f2fa`. **Nedeployat**: apartamentual.ro se urcă
manual din cPanel, deci pe live nu se vede încă nimic din ce e mai jos.
**Un singur fișier atins:** `frontend/index.html` (+189 / -24).
**Mâine:** se continuă cu organizarea pe apartamente, vezi
`handoff/20260830 - handoff-impartirea-apartamentelor.md`.

---

## 1. De ce s-a făcut

Observația lui Lucian, la începutul sesiunii: pagina nu spune nicăieri cu ce te ajută
platforma. Verificat în cod și confirmat: **cuvântul „platformă" nu apărea în niciun titlu
și în niciun subtitlu** de pe homepage-ul nelogat. Singura frază concretă („Terenurile sunt
filtrate de arhitecți. Platforma te ajută să le analizezi…") stătea ascunsă în a patra
casetă din „Ce câștigi", iar banda de credibilitate spunea trei lucruri prea vagi ca să
conteze.

Pagina avea deci: modelul (hero), dovada (timelapse), de ce merită („Ce câștigi") și cum
intri („Cum începi"). **Lipsea treapta din mijloc: ce e lucrul ăsta la care mă uit.**

Măsurat înainte: primul cuvânt despre platformă apărea la **23% adâncime**, adică al
treilea ecran pe telefon. Adâncimea medie de derulare, măsurată pe 23 august, e 41%.

---

## 2. Ce s-a schimbat, în ordinea din pagină

### Hero, rând nou sub butoane (`.hero-platforma`)

> apartamenTUal e platforma pe care se formează aceste grupuri: oameni, terenuri și
> arhitecți, la un loc.

13px pe `--ink-2`, **nu** `.cta-note` (11px, `--ink-3`): aceea e mărime de subsol. Nu urcă
butoanele, stă în locul rămas liber de când a ieșit nota „București și împrejurimi"
(25 august). `max-width:680px`, fiindcă la 600 rămânea „loc." singur pe rândul al doilea.

### Banda de credibilitate, rescrisă

| înainte | acum |
|---|---|
| Modelul Baugruppen aplicat în România | Pe platformă găsești oamenii și grupurile din zona ta |
| Tu deții decizia, noi coordonăm | Terenuri filtrate de arhitecți, cu analiză la cerere |
| De la teren la apartamentul tău | Arhitecți lângă grup, până la mutare |

Banda stă la 15% adâncime (ecranul 1,3 pe telefon), imediat sub dovadă, și **nu costă niciun
pixel în plus**. Cele trei rânduri urmăresc punctele 1, 2 și 4 din secțiunea nouă: e
cuprinsul ei. Baugruppen nu se pierde, e în subtitlul hero-ului.

Pe telefon rândurile se desfac și, cu `gap:1.5rem` moștenit de la desktop, banda ajunsese la
160px de aer. Are acum coloană explicită și gap mic sub 768px: 131px, se citește ca o listă.

### Caseta „Nu ești singur", scurtată

> **Înainte:** Terenurile sunt filtrate de arhitecți. Platforma te ajută să le analizezi, ca
> să vezi ce se poate construi și la ce costuri estimative, apoi putem face proiectare și
> coordonăm partea juridică, alegerea constructorului, ofertele și șantierul.
>
> **Acum:** Nu trebuie să știi dinainte cum se cumpără un teren sau cum se autorizează un
> bloc. Ai pașii scriși în ordine și arhitecți lângă tine la fiecare dintre ei.

Enumerarea serviciilor s-a mutat în secțiunea nouă, care e locul unde se spune ce face
platforma. Aici rămâne răspunsul la frica reală („nu știu să fac asta"), care e rostul
casetei. Bonus măsurat: cele patru casete au acum **160px fiecare**, deci a dispărut golul
de sub primele trei (caseta era cea mai lungă și întindea grila).

### Secțiunea nouă „Cu ce te ajută apartamenTUal"

Stă **între „Ce câștigi" și „Cum începi"**. Eyebrow „Platforma", `js-marketing-only`.

> Un grup de construcție are nevoie de patru lucruri: oameni, un teren bun, o ordine a
> pașilor și arhitecți lângă el. Pe platformă le găsești pe toate într-un singur loc.
>
> 1. **Găsești oamenii.** Vezi cine mai caută în zonele tale și ce grupuri se formează acum,
>    apoi intri într-unul sau începi tu unul.
> 2. **Găsești terenul.** Terenurile sunt filtrate de arhitecți, iar pentru fiecare poți cere
>    o analiză care arată câte apartamente se pot construi și la ce prețuri.
> 3. **Vă organizați.** Grupul își ține pașii în ordine, documentele la un loc și jurnalul
>    discuțiilor, ca să nu se piardă nimic pe drum.
> 4. **Nu vă descurcați singuri.** Putem face proiectarea, iar mai departe coordonăm partea
>    juridică, alegerea constructorului, ofertele și șantierul.

### „Cum începi", eyebrow

„Procesul" → **„Primii pași pe platformă"**. Titlul rămâne scurt: procesul propriu-zis are
patru faze și e în „Cum funcționează", pe când secțiunea asta e despre intrarea pe platformă.

### Titlul secțiunii de video

„Ce este, concret, apartamenTUal" → **„Ce este, concret, un grup de construcție"**. Numele
mărcii apărea altfel în două titluri la câteva sute de pixeli distanță, iar video-ul chiar
despre formarea grupului vorbește.

---

## 3. Rezultatul, în cifre

| | înainte | acum |
|---|---|---|
| primul cuvânt despre platformă | 23% adâncime (ecranul 3,2 pe telefon) | **primul ecran** (hero), apoi banda la 15% |
| explicația pe larg | nu exista | 22% adâncime |
| casetele din „Ce câștigi" | inegale, gol sub primele trei | 160px fiecare |
| banda pe telefon | 160px | 131px |

---

## 4. Decizii luate, ca să nu se rediscute

1. **Secțiunea stă între „Ce câștigi" și „Cum începi"**, nu mai sus. Ordinea e: ce e modelul
   → că e real → de ce merită → ce face platforma → cum începi. Lipită de „Cum începi", se
   citește „asta găsești aici, uite cum intri".
2. **Listă numerotată, nu casete.** Deasupra sunt deja patru casete cu linie sus; o a doua
   grilă de carduri făcea cele două secțiuni să se citească ca una repetată.
3. **Titlul „Cum începi" rămâne scurt.** „Cum începi pe platformă" sună a manual; precizarea
   s-a dus în eyebrow, care era oricum spațiu irosit.
4. **Enumerarea serviciilor există într-un singur loc.** Regulile de formulare (filtrate ≠
   analizate, „putem face" la proiectare, „coordonăm" la juridic) s-au mutat odată cu textul
   și sunt scrise acum în comentariul secțiunii noi.
5. ⚠️ **FILMULEȚUL NU SE ÎNGUSTEAZĂ.** Probat la cererea lui Lucian: la 820px lățime (461px
   înălțime, față de 1052×592) se câștigau ~130px de derulare, dar arăta **sărăcăcios**, cu
   un gol în dreapta care făcea toată zona să pară neterminată. Respinse și variantele
   centrată (linia „Județului Housing…" de sub el pornea tot din stânga, deci nu se mai
   legau) și tăiată jos la 16:7,8 (câștiga 79px și tăia din imagine). **Micșorarea, dacă se
   face, se face din montaj**, nu din CSS. Motivul e scris și în CSS, la `.video-ph--live`.

---

## 5. Capcane întâlnite

- **`resize_window` nu schimbă viewportul paginii.** Raportează „Successfully resized", dar
  `window.innerWidth` rămâne la 1440, deci **media query-urile nu se declanșează** și te uiți
  la macheta de desktop crezând că probezi telefonul. Ce funcționează: un **iframe de 390px
  injectat în pagina însăși** (`f.src='/index.html'`), care are viewport propriu; fiind
  aceeași origine, i se poate și derula conținutul și citi `getComputedStyle`. Bun și pentru
  „la al câtelea ecran ajunge omul la secțiunea X".
- **Captura iese complet neagră** dacă fereastra Chrome nu e cea activă
  (`document.visibilityState === 'hidden'`). Nu e o eroare de randare, se reia captura.
- **Într-o filă automată, filmulețul de YouTube nu pornește** (rămâne la 0:00 cu cerculețul
  de așteptare), deci playerul își arată toată podoaba: bară de titlu, ceas, siglă. Am spus
  întâi că „arată ca un player YouTube" pe baza asta, ceea ce e o concluzie greșită: la un om
  care chiar îl vede pornind, YouTube ascunde singur bara. **Cum arată în mișcare se judecă
  pe ecranul lui Lucian, nu din capturi.**
- **`--terracotta` e definit pe `.hero-stage`, nu pe `:root`.** Secțiunea nouă e în afara lui,
  deci `var(--terracotta, #c06a4f)` are ȘI valoare de rezervă. Fără ea, cifrele listei ar fi
  rămas fără culoare, fără nicio eroare. Aceeași grijă e luată la `.cale ol li::before`.
- **Commit pe hunk-uri, nu pe fișier.** `index.html` conținea și modificările de ieri (de la
  împărțirea apartamentelor), încă neprobate. Cele 15 hunk-uri au fost împărțite 9 (azi) / 6
  (ieri) cu un patch filtrat și `git apply --cached`, apoi comise doar cele 9. Filtrul e în
  scratchpad-ul sesiunii; dacă mai e nevoie, se scrie în două minute.
  ⚠️ **Consecința pentru mâine:** un `git diff` pe `index.html` arată acum DOAR resturile de
  ieri. Nu te speria că „lipsesc" schimbările de azi, sunt comise.

---

## 6. Ce a rămas

- **Filmulețul, ca fișier propriu comprimat.** Playerul YouTube rămâne un chenar care nu e
  parte din design. Un `<video muted loop playsinline autoplay>` fără controale ar arăta
  curat și s-ar încărca mai repede. Avem fișierul
  (`frontend/povestea_noastra/videos/timelapse-santier.mp4`, folosit în „Povestea noastră"),
  **dar are 17,9 MB**, mult prea mult pentru pornire automată pe date mobile. Cere o
  versiune de 10-15 secunde, sub 3 MB, făcută din montaj. Lucian a spus că se ocupă el.
- **Nimic altceva din homepage.** Sesiunea s-a închis curat.

## 7. Starea necomisă, pentru mâine

Rămân pe disc, neatinse azi:

| Fișier | Ce e |
|---|---|
| `frontend/index.html` (+98 linii) | linkul spre împărțirea apartamentelor, din cardul grupului și din spațiul de lucru |
| `frontend/grup-details.html` | cardul terenului golit (comentariile și verificările s-au mutat) |
| `frontend/organizare-apartamente.html` | pagina, netrackuită |
| `frontend/js/organizare-apartamente.js` | logica, netrackuită |

Toate cele opt migrații sunt rulate, plus linia care a trecut `checklist-files` pe privat.
**Ce urmează mâine, din handoff-ul de ieri:** probele pe acțiuni (bifă, notă, document, link,
intrare de jurnal cu dată dată înapoi, preferințe), plus proba cu un cont care NU e în grup
(trebuie „Doar pentru membrii grupului") și un curl cu cheia anonimă pe `analiza_teren`
(trebuie listă goală). Abia apoi commit.

# Handoff, 22 august 2026: pagina de grup, pașii devin secțiunile paginii

**Stadiu: nimic din redesign nu e început.** Tot ce e mai jos e de făcut de la zero,
într-o sesiune curată. Ce s-a făcut azi e commitat și urcat.

---

## Ce s-a terminat azi (nu se reface)

| Commit | Ce |
|---|---|
| `7288e35` | Cronologia: 27 de bife mărunte → 11 casete, cheile `c1...c11` |
| `b5bba52` | Sursă unică `js/pasi-din-ghid.js` + `css/pasi-din-ghid.css`; casete și pe homepage, fără bife |
| `0dc37ac` | Bug-ul cu casetele care nu se deschideau, cardul de terenuri, denumiri, ascunderi |

SQL-ul `db_schema/cronologia-pasilor/01-mutare-note-si-fisiere.sql` **a fost rulat**.
Nota și cele 3 fișiere sunt pe `c2` și `c3`. Verificat cu CSV-ul din
`screenshots/20260822/`.

⚠️ **Capcana zilei, ca să nu se repete:** deschiderea casetelor fusese legată cu
`ontoggle="..."` scris în HTML. Tot spațiul de lucru din `index.html` trăiește într-un
`(function(){ ... })()`, deci funcțiile lui **nu sunt globale**, iar un atribut inline
le caută pe `window` și crapă cu `ReferenceError`. Caseta rămâne pe „Se încarcă…" fără
niciun semn vizibil în pagină. Orice ascultător nou se leagă din JavaScript, prin
cârligul `dupa` pe care îl are deja fiecare categorie de card.

---

## Ce a cerut Lucian: pașii nu mai sunt o listă, sunt capitolele paginii

Cuvintele lui: *„nu știu ce sens au aceste bife, ăștia sunt pași informativi, pașii
ăștia trebuie să aibă un scop, nu așa să bifezi doar ca să știi pe unde ești."*

Fiecare pas devine **titlul unei secțiuni**, iar sub el stă unealta reală pentru pasul
acela. Caseta cu teoria rămâne, dar ca **însoțitor**: *„deschide teoria dacă vrea să
afle."*

### Structura cerută

```
Titlul grupului
  → Terenurile grupului ↓          (sare direct la ele, fără scroll)
  → Toți pașii într-un grup →      (ghidul din /ce-este/cum-functioneaza.html)

Descrierea
Membrii                            ⚠️ mai compact decât acum

COMUNICAREA
   casetă „Comunicarea cu cei din grup"        (teorie, ÎNCHISĂ)
   Linkul de WhatsApp                          ← mutat aici din Administrare
   Anunțuri generale

TERENURILE
   casetă „Analiza preliminară și organizarea pe apartamente"   (ÎNCHISĂ)
   casetă „Verificarea terenului"                               (ÎNCHISĂ)
   Terenurile grupului
     fiecare cu lista LUI de verificare (bife), note, atașamente
     în viitor: tabul de organizare pe apartamente

ANALIZA ȘI CONTRACTUL
   casetele „Analiza detaliată", „Contractul de asociere", „Cumpărați terenul"

RESTUL DRUMULUI
   proiectarea, șantierul, ieșirea din asociere, recepția, mutarea
```

**Nicio casetă nu se deschide automat.** Regula veche („prima nebifată stă deschisă")
dispare odată cu bifele de grup.

⚠️ Titlul casetei 2 se schimbă: **„Analiza preliminară și organizarea pe apartamente"**,
nu „Organizarea pe terenuri și apartamente". Titlul e în `js/pasi-din-ghid.js`, dar
ancora din ghid (`organizarea`) rămâne.

### WhatsApp

**Afișarea** linkului se mută în secțiunea Comunicarea, unde o vede orice membru.
**Editarea** (câmpul + butonul de salvat) rămâne în Administrare, e treabă de fondator.

### `/ghid.html`

Se scoate linkul „Ce poți face într-un grup? Vezi ghidul" din capul paginii de grup
(`grup-details.html`, ~linia 1028). Pagina `ghid.html` **rămâne** linkată din subsolul
site-ului (`js/footer.js` și `index.html`). Decizia lui Lucian, explicit.

---

## Deciziile luate, ca să nu se redeschidă

1. **Bifele de grup dispar din interfață.** Cele 12 bife pe `c1...c11`, plus nota și
   cele 3 fișiere, **rămân în bază**, nefolosite, ca plasă de siguranță. Nu se șterge
   nimic, nu se scrie niciun `DELETE`.
2. **Bifele se mută pe teren**, unde chiar înseamnă ceva: se bifează pentru terenul
   ăla, nu pentru grup în general.
3. **Casetele rămân închise**, toate, mereu.
4. **Nu se copiază enciclopedia în pagina de grup.** Textul lung stă în ghid și se
   citește de acolo, cu mecanismul care există deja.

---

## Singura bucată care cere bază de date

Lista de verificare **pe fiecare teren** nu are unde să se salveze. Tabela nu există.

```
grup_teren_checklist
  grup_id, teren_id, step_key, checked, checked_at, checked_by
```

Plus RLS, pe modelul lui `grup_checklist`. Plus, probabil, echivalentele pentru note și
atașamente pe pas de teren, sau refolosirea celor existente cu o cheie compusă.

⚠️ **Se scrie SQL comentat și îl rulează Lucian manual**, în Supabase SQL Editor. Nu se
rulează migrații direct.

⚠️ Înainte de orice `REVOKE`/`GRANT` pe tabela nouă, citește memoriile despre
`supabase-grant-implicit-anon` și `politici-rls-citesc-direct-din-profiles`. Tabelele
noi vin cu drepturi depline pentru `anon` și `authenticated`.

### Ce pași merg pe teren

Din cele 11 casete, pașii care se repetă pe fiecare teren candidat sunt cei din caseta 3,
„Verificarea terenului": vizita cu concluzii scrise, extrasul de carte funciară, istoricul
la notar, certificatul de urbanism informativ, certificatul pentru construire depus de
proprietar, studiul geotehnic sumar, vecinii de la calcan. Textul lor e în ghid, la
ancora `verificarea-terenului`.

Caseta 2 aduce încă doi: analiza preliminară cerută, și organizarea pe apartamente.

---

## Ordinea de lucru propusă

1. **Structura paginii**, fără bază de date: cele patru categorii, casetele închise,
   WhatsApp mutat, trimiterile din capul paginii, membrii compactați, linkul la
   `ghid.html` scos. Se poate face și se poate vedea imediat.
2. **Migrația** `grup_teren_checklist`, scrisă și rulată de Lucian.
3. **Lista de verificare în fiecare teren**, care citește și scrie în tabela nouă.
4. Mai târziu, separat: tabul de organizare pe apartamente, atașamente generale de grup
   („secretariatul"), și graficul cu durate pe linia temporală (amânat explicit azi).

---

## Fișiere de urcat pe cPanel, când se termină

Deploy-ul e **manual, din cPanel**, nu Render (CLAUDE.md greșește). Din ce s-a atins azi:

```
index.html
grup-details.html
ce-este/cum-functioneaza.html
js/pasi-din-ghid.js        ← fișier nou
css/pasi-din-ghid.css      ← fișier nou
utilizatori.html
```

---

## Amânate explicit

- **Graficul cu durate** pe cronologia grupului, o linie temporală care arată cât ține
  fiecare etapă și unde e grupul. Lucian: *„renunțăm momentan, îl vom face în altă
  sesiune."* Când se reia, primul lucru necesar sunt intervalele de timp pentru fiecare
  din cele 11 casete; ghidul are durate doar pe patru blocuri mari.
- **Tabul de organizare pe apartamente** și **atașamentele generale de grup**, pașii 4
  și 5 din handoff-ul de pe 21 august.

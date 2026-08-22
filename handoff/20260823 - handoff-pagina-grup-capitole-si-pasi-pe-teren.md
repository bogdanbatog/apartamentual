# Handoff, 23 august 2026: pagina grupului, capitole și pași pe fiecare teren

**Stadiu: terminat și urcat pe GitHub. Nu e încă pe site.**
Singurul lucru rămas din sesiunea asta e **urcarea manuală pe cPanel**.

---

## Ce s-a făcut (commitat și pushuit)

| Commit | Ce |
|---|---|
| `0894684` | Spațiul tău: nota de teren își recapătă mărimea, „Utilizatori în zonele tale" scris întreg în cuprins, rândul „La pasul N" scos |
| `60c6835` | Pagina grupului: patru capitole, pașii bifați pe fiecare teren, spațiu strâns peste tot |

### Fișiere de urcat pe cPanel

```
index.html
grup-details.html
js/pasi-din-ghid.js
```

Deploy-ul e **manual, din cPanel**, nu Render (CLAUDE.md greșește).

---

## Baza de date: gata, rulată

`db_schema/pasi-pe-teren/1-tabela-grup-teren-checklist.sql`, rulat de Lucian pe
23 august. Blocurile 1, 2, 3, 4 și 6. **BLOC 5 nu s-a rulat și nici nu trebuie:**
`step_key` e `text` fără limită în toate trei tabelele.

Verificat cu BLOC 6: opt coloane, cheia primară pe tripleta (grup, teren, pas),
patru politici toate pe `authenticated`, RLS pornit, iar la drepturi **`anon` nu
apare deloc**, iar `authenticated` are strict SELECT / INSERT / UPDATE / DELETE.
Fără TRUNCATE, fără REFERENCES.

⚠️ Politicile **nu cheamă** `is_group_member()`, deși funcția există. Nu i se
vede corpul din inventar, iar dacă nu e `security definer` ar citi `grup_membri`
sub RLS și ar întoarce fals pentru membri adevărați, tăcut. Sunt copiate după
tiparul dovedit al lui `grup_checklist`, plus două strângeri: `to authenticated`
în loc de `public`, și `status = 'activ'` cerut și la INSERT/UPDATE.

### Proba, dată pe grupul exemplu

Bifat un pas prin funcția pe care o cheamă clicul, reîncărcată pagina, bifa era
acolo. Scrisă o notă pe cheia compusă, a ajuns în `grup_checklist_notes`. Ambele
curățate după. A rămas un rând cu `checked = false`, invizibil în interfață.

---

## Cum arată pagina acum

**Cardul grupului:** titlu, starea și butoanele în dreapta sus, două trimiteri,
apoi Descrierea (tăiată la trei rânduri, cu „Arată tot"), Membrii (primii opt),
și un rând pliat „Zonele și interesele grupului".

**Fraza dintre carduri:** „Mai jos ai pașii în ordine cronologică: comunicarea,
terenurile, analiza și contractul, restul drumului."

**Patru capitole, fiecare un card:**

| Capitol | Ce e înăuntru |
|---|---|
| Comunicarea | caseta `c1`, rândul de WhatsApp, Anunțurile |
| Terenurile | casetele `c2` și `c3`, lista de terenuri |
| Analiza și contractul | `c4`, `c5`, `c6` |
| Restul drumului | `c7`...`c11` |

**Fiecare teren** are două casete pliate: „Comentarii despre teren" și „Pașii de
verificare (N din 7)". Pașii au bifă, iar butonul `📎 note ˅` deschide notele și
atașamentele pasului.

---

## Lucruri de știut înainte de a atinge codul ăsta

1. **Ce casetă stă în ce capitol** se citește din atributul `data-pasi` scris în
   HTML pe `<div class="cap-pasi">`. Mutarea unei casete e o singură modificare.
2. **Cheia compusă.** Notele și fișierele pașilor de teren se scriu în tabelele
   vechi, cu `step_key` = `t-<terenId>-<pas>`. De acum acele tabele au două
   feluri de chei, `c1...c11` și `t-...`. Funcția e `cheiaPasTeren()`.
3. **`.member-only.visible` pune `display:block`** pe orice devine vizibil.
   Elementele care sunt `flex` au nevoie de o regulă cu două clase, altfel își
   pierd așezarea.
4. **Serverul de previzualizare** se pornește detașat, ca să supraviețuiască
   între ture:
   ```powershell
   Start-Process -FilePath "C:\Python314\python.exe" `
     -ArgumentList "-m","http.server","8777","--bind","127.0.0.1" `
     -WorkingDirectory "C:\Users\lucia\proiecte\apartamentual\frontend" -WindowStyle Hidden
   ```
   Browserul lui Lucian are deja **sesiune pe `127.0.0.1:8777`**, cu contul de
   test, membru în grupul exemplu. Deci se vede direct vederea de membru.
5. **`deleteStepNote` deschide un `confirm()`.** Nu se apelează din
   `javascript_tool`, blochează extensia. Ștergerea de probă se face direct prin
   `sb`, pe aceleași politici.

---

## Ce urmează, în ordinea în care are sens

1. **Urcarea pe cPanel** a celor trei fișiere. Restul e degeaba până atunci.
2. **Tabul de organizare pe apartamente**, în caseta 2. Amânat de pe 21 august.
3. **Atașamentele generale de grup** („secretariatul"), tot de pe 21 august.
4. **Graficul cu durate** pe linia temporală. Amânat explicit de Lucian pe
   22 august. Când se reia, primul lucru necesar sunt intervalele de timp pentru
   fiecare din cele 11 casete; ghidul are durate doar pe patru blocuri mari.

### Rest rămas din altă parte

`⏳ Utilizatorii logați pot scrie `account_status`` — găsit pe 13 august, încă
nereparat. Un cont suspendat își poate ridica singur suspendarea. Cere o sesiune
separată, e o problemă de securitate, nu de pagină.

# Handoff — 23 august 2026

Spațiul de lucru de pe homepage și pagina grupului. Plus o corectură de conținut în
episodul 3 al serialului Județului.

Tot ce e mai jos e **comis și împins pe `main`**. Nimic nu e publicat pe live: deployul
se face manual din cPanel.

---

## Ce s-a făcut

### 1. Episodul 3, forajele erau puse greșit în timp

Un cititor (Mihai Popescu) a întrebat dacă studiul geotehnic s-a făcut abia după
cumpărarea terenului. Paragraful spunea „Au trecut câteva luni de la rezervare până la
cumpărare", ceea ce lăsa impresia asta.

**Cronologia reală**, scoasă din conversațiile grupului Județului
(`continut/conversatii grup judetului/`, netrackuit în git):

| data | ce s-a întâmplat | de unde |
|---|---|---|
| 05.10.2020 | grupul „🏘️Județului Co-housing" se creează, terenul e deja subiectul lui, certificatul de urbanism era eliberat | mesajele de deschidere |
| **14.10.2020** | **forajele făcute pe teren**, în aceeași zi cu turul la vecinii de la calcan | 14.10, 12:35 |
| 07.11.2020 | actele date la notar | 07.11, 17:33 |
| 02.12.2020 | notarul confirmă că actele sunt în regulă | 02.12, 11:04 |
| **08.02.2021** | **promisiunea de vânzare-cumpărare**, semnată la notar (10.000 €) | facturile din 08.02 |
| **25.02.2021** | **cumpărarea: contract nr. 144/25.02.2021**, semnat odată cu acordul de asociere | 25.02, 11:46 și 16:41 |
| 20-22.04.2021 | studiile topo și geo **complete**, după cumpărare | 19.04, 19:49 |

Deci: de la promisiune la cumpărare au trecut **17 zile**, nu luni. De la înțelegerea
informală cu proprietarul, aproape cinci luni. Forajele au fost cu patru luni și
jumătate înainte de cumpărare.

Paragraful din `continut/SERIALUL JUDETULUI/E3_TERENUL/E3_terenul.docx` a fost rescris:
forajele trec primele, în ordinea reală, se spune explicit că terenul nu era încă al
lor, iar promisiunea și cumpărarea apar la final.

⏳ **RĂMÂNE DE FĂCUT: aceeași corectură în articolul publicat, din admin.** Articolele
stau în baza de date, nu în repo, deci commitul pe docx nu schimbă nimic pe site.
⚠️ La salvare, `published_at` se rescrie și articolul sare în capul listei.

### 2. Spațiul tău (homepage logat), `frontend/index.html`

**Cardul „Terenurile tale", terenul fără analiză.** Butonul „Cere o analiză" nu mai stă
singur: sub el scrie *ca să vezi câte apartamente se pot construi aici și la ce prețuri
ar ieși*.

**Cardul „Grupurile tale".** Avea două linkuri către aceeași adresă, titlul grupului și
butonul „Deschide grupul" de sub card. Butonul a ieșit. Rândul cu cererile de intrare a
devenit el însuși link, fiindcă e singurul care cere o faptă de la om.

În locul butonului, un rând cu ce s-a întâmplat în grup de la ultima ta vizită:
„De la ultima ta vizită: un anunț nou, un teren adăugat și 2 membri noi." Când nu s-a
întâmplat nimic, scrie „Nimic nou de la ultima ta vizită", mai stins.

- două citiri noi în runda a doua, `x[18]` = `grup_anunturi`, `x[19]` =
  `terenuri_likes_grupuri`, amândouă prin `bland`;
- se numără **numai ce au făcut alții** (`user_id` / `added_by` diferit de al meu);
- tăierea e în două trepte, ca la membrii noi: baza taie larg pe `pragMinim`, JS-ul taie
  fin pe `pragGrup[id]` (ultima vizită, ori intrarea mea în grup);
- ordinea cardurilor ține cont acum de toate trei, nu doar de membrii noi.

⚠️ `terenuri_likes_grupuri.created_at` **există**, probat pe 23 august cu cheia anonimă:
un `select=created_at` întoarce `[]` (RLS), iar o coloană inventată întoarce eroarea
`42703`. Așa se probează orice coloană fără să deschizi Supabase.

### 3. Pagina grupului, `frontend/grup-details.html`

**Butonul negru „Cere o analiză" s-a întors în capul cardului fiecărui teren**, cu
aceeași explicație (la plural, „ca să vedeți", fiindcă acolo vorbim cu grupul).
Coborâse în lista de pași, dar acolo stă sub o casetă pliată și nu ajungea nimeni la el.
Când analiza există, în locul butonului stă rezultatul: „✓ Analiză · 5-7 apartamente →".
⚠️ Linkul „Cere o analiză →" din lista de verificări **a rămas**. Nu e o dublare: caseta
e închisă, deci cele două nu se văd în același timp.

**Anunțurile spun acum că pleacă pe email.** Lângă titlu, cu gri: „Ce scrii aici pleacă
seara, la 19:00, pe emailul celorlalți membri." Verificat în `digest-anunturi-grup`:
19:00 la București, primesc ceilalți membri, nu și autorul, iar emailul e scurt (număr
de anunțuri + primele 90 de caractere din ultimul).
⚠️ **Ora 19 e scrisă acum în două locuri**, `ORA_TRIMITERII` din edge function și textul
ăsta, de mână. Dacă se schimbă acolo, pagina minte fără să crape nimic.

**Casetele de citit se văd acum ca text de citit.** Trei schimbări, toate din observația
lui Lucian că „lumea nu înțelege ce sunt casetele astea":

1. cerculețul cu o cifră a devenit o pastilă care scrie **„Pasul 3"**;
2. lângă săgeată stă cuvântul **„citește"** (dispare pe telefon și când caseta e
   deschisă);
3. casetele au o **dungă colorată de 4px în stânga**, în culoarea pasului.
   ⚠️ Regula ține doar cât timp nicio unealtă a paginii nu primește dunga asta. E
   singurul lucru care desparte „ce se citește" de „ce se folosește", fără cuvinte.

**Lista de bife de pe fiecare teren nu se mai numește „pași".** În aceeași pagină erau
două lucruri numite pas. Se cheamă acum **„Analiza și verificările"**, cu „0 din 7"
lângă. A trecut prin trei variante într-o zi și toate sunt scrise, cu motivul, în
`js/pasi-din-ghid.js`:

- „Pașii de verificare" — se lovea de pașii de citit;
- „De verificat pe teren" — suna a listă de dus cu tine la fața locului;
- „Verificările terenului" — prea aproape de titlul pasului 3, „Verificarea terenului".

⚠️ **Numele din cod rămâne `PASI_TEREN`, `tv-pas`, `cheiaPasTeren`.** Cheile ajung în
`grup_teren_checklist.step_key` și, cu id-ul terenului, în `grup_checklist_notes` și
`grup_checklist_files`. Nu se redenumesc fără migrare.

---

## Comituri (toate împinse pe `main`)

| commit | ce duce |
|---|---|
| `3212f68` | episodul 3, paragraful cu forajele |
| `555f623` | spațiul de lucru: explicația analizei, cardul de grup fără link dublat, rândul cu noutăți; butonul negru în pagina grupului |
| `7a38488` | nota de la anunțuri, pastila „Pasul N", cuvântul „citește" |
| `a0f7ce2` | dunga colorată pe casetele de citit + prima redenumire a listei |
| `889c677` | a doua redenumire |
| `3cb8bac` | „Analiza și verificările" |

---

## ⏭️ De făcut în sesiunea următoare

1. **Deploy manual din cPanel**, trei fișiere:
   - `frontend/index.html`
   - `frontend/grup-details.html`
   - `frontend/js/pasi-din-ghid.js`

   ⚠️ `grup-details.html` și `js/pasi-din-ghid.js` **merg împreună**: pagina citește
   pastilele și lista din fișierul acela.
   ⚠️ La verificare pe live, diferența în octeți față de repo e exact numărul de linii
   (CRLF vs LF), nu conținut lipsă.

2. **Corectura în articolul publicat**, din admin (vezi punctul 1 de mai sus).

3. **Rămas deschis, la decizia lui Lucian:** pe homepage, cardul „Pașii până la mutare"
   folosește aceleași 11 casete, dar acolo numărul e tot o cifră singură, fără cuvântul
   „Pasul" și fără dungă colorată. Dacă vrem aceeași limbă peste tot, se aliniază și
   acolo.

---

## Ce s-a probat, și cum

Toate schimbările au fost văzute pe un server local, pornit **detașat** (altfel moare
între ture):

```powershell
Start-Process -FilePath "C:\Python314\python.exe" `
  -ArgumentList "-m","http.server","8777","--bind","127.0.0.1" `
  -WorkingDirectory "C:\Users\lucia\proiecte\apartamentual\frontend" -WindowStyle Hidden
```

Pe `127.0.0.1:8777` browserul lui Lucian are sesiune cu contul de test
`luta.lucian.m+test5@gmail.com`, membru în grupul exemplu
`d6ab0a78-6935-4a95-8967-794708c208e5`.

Două lucruri s-au forțat temporar, doar pentru capturi, și au fost date înapoi:

- pragul „ce e nou" lărgit și filtrul „ce am făcut eu" oprit, ca să se vadă fraza plină;
- `euSuntAdmin` forțat, ca să apară rândul cu cererile de intrare (contul de test nu e
  administratorul grupului exemplu).

Un teren a fost adăugat la favoritele contului de test, ca să apară cardul „Terenurile
tale", **și scos imediat după captură**. Verificat: contul nu mai are niciun teren
salvat.

⚠️ Sintaxa se verifică extrăgând blocurile `<script>` din HTML și rulând `node --check`
pe fiecare. Prinde exact capcana cu apostroful invers din template string, care lasă
pagina pe „Se încarcă" cu consola curată.

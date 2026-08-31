# Handoff: Împărțirea apartamentelor

**Data:** 30-31 august 2026
**Stadiu:** tot codul e scris și verificat cât se poate fără date reale. **Nimic nu e comis.**
**Migrațiile: toate opt rulate pe 31 august**, cu verificările trecute, plus linia care a trecut
`checklist-files` pe privat.
**Blocant:** nimic. Pagina se deschide pe date reale din 31 august. Rămân de probat acțiunile
(bifă, notă, document, jurnal, preferințe) și cazul „nu ești membru", apoi commit.

> ⚠️ **Adăugat în seara de 31 august.** Între timp, `frontend/index.html` a primit și
> modificări care NU au legătură cu pachetul ăsta (homepage nelogat, vezi
> `handoff/20260831 - handoff-homepage-ce-face-platforma.md`) și **acelea au fost comise
> separat, pe hunk-uri**, în `020f2fa`. Deci un `git diff` pe `index.html` arată acum doar
> resturile pachetului de față (+98 de linii: linkul spre împărțirea apartamentelor din
> cardul grupului și din spațiul de lucru). Nu lipsește nimic, e doar împărțit.

---

## 1. Ce s-a construit

O unealtă prin care membrii unui grup își împart apartamentele dintr-o analiză urbanistică,
își scriu ce vor, strâng documentele terenului și țin jurnalul discuțiilor.

**Numele ei e „Împărțirea apartamentelor"** (decizie Lucian, 30 august), ales ca să meargă
lângă viitorul „Secretariatul grupului".

### De ce arată așa

Grupul **Parcul Circului** (~20 membri) și-a făcut în august un Google Sheet propriu în loc să
folosească platforma, „fiindcă le-a fost mai ușor". Cele trei file ale lui sunt cea mai bună
listă de cerințe pe care o avem, fiindcă nu e presupusă de noi. Screenshot-uri în
`handoff/xcel grup parc circului/`.

Din ele au ieșit trei lucruri pe care nu le aveam în plan:

- **bugetul e două întrebări, nu una** (cash pentru teren, separat de total cu credit): terenul
  se cumpără lichid, înainte de orice credit, iar aceea e cifra care decide dacă grupul poate
  cumpăra luna asta;
- **jurnalul cu data faptului**, nu doar cu data scrierii;
- **documentele într-un singur loc**, nu agățate de câte un anunț.

---

## 2. Fișierele

| Fișier | Ce e | Stare |
|---|---|---|
| `db_schema/organizare-apartamente/1-tabele-analiza-si-interes.sql` | 7 tabele: analiză, variante, niveluri, apartamente, suprafețe alese, interes, preferințe | ✅ rulat |
| `db_schema/organizare-apartamente/2-bucket-analize.sql` | bucket privat `analize-fise` pentru fișele PDF | ✅ rulat |
| `db_schema/organizare-apartamente/3-atasamente-teren.sql` | tabela `teren_atasamente` + bucket privat `teren-documente` | ✅ rulat |
| `db_schema/organizare-apartamente/4-jurnalul-terenului.sql` | două coloane pe `grup_teren_comments` | ✅ rulat |
| `db_schema/organizare-apartamente/5-strangere-comentarii.sql` | revoke de la `anon` + `status='activ'` în politici | ✅ rulat |
| `db_schema/organizare-apartamente/6-stergerea-notelor.sql` | fondatorul poate șterge notele oricui | ✅ rulat |
| `db_schema/organizare-apartamente/7-sterge-fisiere-de-proba.sql` | curățarea fișierelor de probă | ✅ rulat |
| `db_schema/organizare-apartamente/8-stergerea-fisierelor.sql` | fondatorul poate șterge fișierele oricui | ✅ rulat |
| `frontend/organizare-apartamente.html` | pagina | scrisă |
| `frontend/js/organizare-apartamente.js` | logica | scrisă |
| `frontend/index.html` | linkul grupului + scurtătura din cardul grupului | **modificat, necomis** |
| `frontend/grup-details.html` | cardul terenului golit: comentariile și verificările s-au mutat | **modificat, necomis** |
| `handoff/organizare-pagina-proprie-macheta.html` | macheta, cu date scrise de mână | de păstrat |
| `handoff/_previzualizare-telefon.html` | macheta într-un cadru de telefon | ajutor |
| `handoff/capturi-telefon/` | 17 capturi de pe parcurs | ajutor |

**Macheta rămâne locul unde se încearcă schimbări de formă.** Acolo nu e nevoie nici de bază de
date, nici de cont. Se deschide cu dublu-clic.

---

## 3. Ce ai de făcut, în ordine

### Migrațiile: gata

Toate șase au trecut pe 31 august, cu verificările citite rând cu rând. Ce a ieșit pe drum:

- **`anon` avea TRUNCATE** pe `grup_teren_comments`, iar TRUNCATE nu e atins de RLS. Strâns în
  migrația 5, împreună cu restul drepturilor.
- **Membrii `pending` citeau comentariile grupului.** Politicile cereau doar să EXISTE un rând în
  `grup_membri`, iar unul se creează în clipa în care cineva cere să intre. Erau șase astfel de
  cereri în platformă. Acum se cere `status = 'activ'`.
- **Indexul pe `coalesce(data_faptului, created_at::date)` a fost refuzat de bază**, fiindcă
  turnarea unui `timestamptz` în `date` depinde de fusul orar. Merge pe `created_at`, iar
  sortarea după data faptului se face în pagină.

### Prima deschidere pe date reale: 31 august

Lucian a intrat cu contul lui, pe un grup real cu terenuri, pe un teren FĂRĂ analiză. Pagina a
crăpat cu „Ceva n-a mers".

**Cauza:** `scrieCapulPaginii` citea `analiza.tip`, `analiza.titlu`, `analiza.pdf_path` ca și cum
analiza ar exista mereu. Când s-a hotărât pe 30 august că pagina se deschide și fără analiză, s-a
adaptat încărcarea, nu și scrierea capului de pagină. A crăpat exact pe cazul pentru care fusese
deschisă. **Reparat**; toate citirile din `analiza` sunt acum în spatele unei verificări.

⚠️ **Bug-ul n-a ieșit la nicio verificare automată**, fiindcă toate probele se făcuseră pe pagina
nelogată, care se oprește mai devreme. La fel mânerul de tragere și `body.se-trage`: trei urme
lăsate de schimbări tardive, toate ieșite doar când cineva a folosit pagina.

**Probat până acum:** pagina se deschide, se vede corect.
**NEPROBAT încă:** bifarea unui pas, scrierea și ștergerea unei note, urcarea unui document și a
unui link, o intrare în jurnal cu dată dată înapoi, completarea preferințelor. Plus proba cu un
cont care NU e în grup, care trebuie să spună „Doar pentru membrii grupului".

### Pasul următor: prima analiză

Când e gata analiza pe terenul de la Circului, îmi dai fișa și scriu scriptul de import. E o
traducere directă din ce produce Urban Analyzer, fără cifre inventate pe drum.

### Apoi: proba pe live

Cu un cont de test care NU e în grup: pagina trebuie să spună „Doar pentru membrii grupului".
Plus un curl cu cheia anonimă pe `analiza_teren`, care trebuie să întoarcă listă goală.

### Abia apoi: commit

Cu diff-ul arătat înainte. Sunt trei fișiere de frontend care așteaptă.

### Curățenia de fișiere: gata

Cele trei fișiere de probă s-au dus. Pe drum au ieșit la iveală **două fișiere reale rămase
orfane** dintr-un grup șters (`097aa33f-…`): un acord de asociere cu patru nume de oameni și o
anexă de 491 KB, urcate în martie 2026. Nu se vedeau din nicio pagină, fiindcă paginile citesc din
tabelă, iar rândurile lor plecaseră cu grupul. Erau tot de probă și s-au șters.

⚠️ **Cât au stat acolo, au fost accesibile oricui avea adresa**, fiindcă `checklist-files` e bucket
public. De aici, singura treabă rămasă din tot pachetul:

```sql
update storage.buckets set public = false where id = 'checklist-files';
```

Verificat că nu rupe nimic: codul descarcă prin `.download()`, nu prin adrese publice, iar
`getPublicUrl` nu apare nicăieri pe bucketul ăsta.

În bucket au rămas trei `.emptyFolderPlaceholder` de 0 KB, marcaje puse automat de Supabase când
se golește un folder. Inofensive.

### De ce erau, de fapt, acolo

Am crezut că rămăseseră orfane după mutarea verificărilor. **Nu erau:** cheile lor sunt `c2` și
`c3`, adică pașii de GRUP, nu pașii de TEREN.

Iar căile lor din storage conțineau `f1_regulament`, `f2_extras_cf`, `f2_analiza_generala` —
**chei dintr-o schemă veche, pe faze**, abandonată de atunci. Cheile s-au redenumit în tabelă
(`c1`-`c11`), căile din storage au rămas cu numele vechi. Explică și de ce un rând cu
`step_key = c2` avea o cale cu `f2_`.

## 4. Deciziile luate, ca să nu se rediscute

1. **Analiza aparține perechii (grup, teren).** Un grup plătește analiza; alt grup cu același
   teren la favorite nu o vede.
2. **Numele celor interesați se văd de toți membrii**, nu „2 familii interesate". Rostul uneltei
   e să arate unde se calcă grupul pe picioare, iar un număr nu pornește nicio discuție.
3. **Nu se spune nimănui că nu încape.** Un grup are aproape mereu mai mulți membri decât
   apartamente, și asta e starea normală. Prima formă a machetei anunța „încap 6 din 9 familii";
   a fost respinsă. Indicatorul măsoară cât de așezată e varianta, nu deficitul grupului.
4. **Suprafețele se reglează cu tragere de marginea casetei** (butoane − și + pe telefon), în
   intervalul din normativ. Oamenii se uită la preț, iar un preț afișat ca interval nu ajută pe
   nimeni să se hotărască.
5. **Pagina se deschide și fără analiză.** Grupul Circului se organiza pe preferințe și note cu
   luni înainte să existe una. Fără analiză, în locul clădirii stă o schiță estompată.
6. **Camerele și suprafața vin din profil**, unde sunt oricum obligatorii; se pot ajusta doar
   pentru grupul acesta, iar cardul arată „din profil" sau „ajustat aici".
7. **Documentele acceptă și linkuri**, nu doar fișiere. Grupurile lucrează deja pe Drive; ce le
   lipsea era lista, nu locul de stocare.
8. **Cardul terenului din pagina grupului nu mai are nicio unealtă** (31 august). Comentariile și
   verificările s-au mutat în pagina de organizare: altfel omul sărea între card și pagină pentru
   lucruri care se fac în același loc. Cardul rămâne carte de vizită, cu un singur drum spre locul
   unde grupul lucrează. Casetele de teorie din capitole sunt neatinse.
9. **Atașamentele pe pas au ieșit de tot.** Documentele stau într-o singură secțiune; agățate de
   câte un pas, nu le găsea nimeni fără să deschidă toate cele șapte casete.
10. **Notele și fișierele se șterg de autor sau de fondator**, nu doar de autor (fișierele
   `8-stergerea-fisierelor.sql`, plus condiția din `loadStepFiles`). `UPDATE` NU s-a lărgit:
   fondatorul poate șterge ceva greșit, dar nu poate rescrie ce a spus altcineva.
   ⚠️ Fișierele au DOUĂ porți: politica de pe tabelă ȘI cea de pe bucket. Deschisă doar prima,
   rândul pleacă și fișierul rămâne pe disc.

---

## 5. Regula de bani, cu tot cu greșeala din care a ieșit

```
Sd               = (Su împărțit + Su comun) / coef_su_sd
cost construcție = Sd × cost_constructie_mp + subsol × cost_mp × cost_subsol_pct
cost total       = cost_teren + cost construcție
cost apartament  = (mpu / Su împărțit) × cost total
```

**Singura sumă fixă e terenul.** Prima formă ținea costul construcției fix pe variantă, deci
micșorarea unui apartament împărțea aceeași sumă la mai puțini metri și anunța o scumpire de
2,9%. Lucian a corectat pe 28 august: o clădire mai mică chiar costă mai puțin. Adevărul e că
**investiția scade, dar terenul se împarte la mai puțini metri**, deci ponderea lui crește, și
de aceea golurile sunt neeficiente. Scumpirea reală iese 0,5-1,7%.

**Spațiul comun nu se numără ca gol:** se construiește (intră în cost) dar nu se împarte (nu
intră în cote). Fără scăderea lui, un parter comun de 48 mp arăta o scumpire de 14% în loc de 1,4%.

**Verificat:** suma prețurilor tuturor apartamentelor e exact costul total, diferență 0 €.

---

## 6. Capcane întâlnite pe drum

- **`position:relative` de pe casetă** e obligatoriu: mânerul de tragere e `absolute` și se
  agață de el. Fără, se ancorează de pagină, iese lat cât ecranul și înalt de zero, **fără
  nicio eroare în consolă**. S-a întâmplat de două ori, dintr-o rescriere de bloc CSS.
- **`hidden` nu funcționează** pe elemente cu `display` scris de noi: e doar `display:none` din
  foaia implicită. Pagina are acum `[hidden]{display:none !important}`.
- **Specificitatea în jurnalul de pe telefon:** `.jurnal-tabel td` bate `.j-cand`, deci
  `display:block` câștiga și data, felul și numele ajungeau pe câte un rând.
- **Regula generală de tabel** (`th,td{text-align:right}`) e făcută pentru cifre; jurnalul e
  text și are nevoie de `text-align:left` explicit.
- **Toate cele patru bucketuri vechi sunt publice**, iar ruta `/object/public/` nu trece prin
  RLS. Bucketurile noi sunt private de la început. `checklist-files` se repară cu o linie
  (`update storage.buckets set public = false where id = 'checklist-files';`), verificat că nu
  rupe nimic — **nerulată încă**.
- **Apostrof invers într-un comentariu HTML dintr-un template string.** Comentariul care explica
  mutarea comentariilor conținea `` `grup_teren_comments` ``, iar backtick-ul a închis string-ul
  și a rupt tot scriptul paginii grupului. Pagina rămâne pe „Se încarcă", cu consola curată. Prins
  cu `node --check`.
- **O verificare care se sprijină pe un nume ales de noi nu verifică nimic.** Blocul de control al
  bucketului de analize filtra `policyname like '%fise de analiza%'` și rata politica botezată
  „Membrii citesc FISELE de analiza": părea că lipsește exact cea mai importantă. Filtrul caută
  acum după `bucket_id`.
- **`information_schema.column_privileges` nu deosebește granturile pe tabelă de cele pe coloane**:
  le desfășoară pe amândouă pe coloane. Pentru „de unde vine dreptul" se întreabă
  `role_table_grants`.
- **Numele politicilor nu se ghicesc.** Scriptul 8 presupunea „Users can delete own checklist
  files" pe tabelă; acolo se cheamă `checklist_files_delete`, iar numele presupus exista pe
  storage. Rulat pe ghicite, ar fi creat o a doua politică lângă cea veche: ar fi mers (permisive,
  OR), dar tabela ar fi rămas cu două reguli de ștergere. De aceea fiecare script are BLOC 0.
- **Din `storage.objects` NU se poate șterge prin SQL.** Un declanșator al platformei
  (`storage.protect_delete`) refuză cu `42501: Direct deletion from storage tables is not allowed`,
  tocmai ca să nu rămână jumătăți: fișier fără rând sau rând fără fișier. Ștergerea se face prin
  Storage API, adică din pagină (butonul există deja) sau din dashboard.

---

## 7. Ce a rămas nefăcut

- **Preferințele lângă lista de membri** din pagina grupului, ca să fie folosibile și fără să
  intri pe un teren anume.

  (Caseta pliată cu V1 · V2 · V3 pe cardul terenului **nu se mai face**: pe 31 august s-a hotărât
  invers, ca tot ce ține de acțiuni să fie în pagină, iar cardul să rămână curat.)
- **Butonul de export JSON în Urban Analyzer**, discutat cu Liviu. Fără el, analizele intră în
  platformă doar prin script SQL scris de mână. Instrumentul lui e în
  `apartamentual-strategie/produs/urban-analyzer`, iar `CLAUDE.md`-ul de acolo cere explicit să
  nu se modifice HTML-ul fără discuție cu el.
- **Jurnalul de prospectare pe terenuri pe care platforma nu le are** (fila „terenuri" din
  Excelul lor: 11 terenuri de pe imobiliare.ro, cu POT, CUT, deschidere la stradă, observații).
  E cea mai mare nevoie descoperită și n-a fost băgată în scope. Merită handoff propriu.
- **Fila „potențiali vecini"** din același Excel, neexplorată.

---

## 8. Serverele locale pornite în sesiune

Două servere Python, pe `8010` (folderul `handoff`) și `8020` (folderul `frontend`). Se opresc
singure la repornirea calculatorului; dacă vrei mai devreme, închide procesele `python` din
Task Manager.

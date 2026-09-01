# Handoff: prima analiză reală în platformă (Luigi Galvani 57)

**Data:** 1 septembrie 2026, seara
**Stadiu:** analiza e în bază și se vede în pagină. Toate migrațiile rulate și verificate.
**Blocantul de dinainte** („prima analiză reală", din handoff-ul de pe 30 august) **a căzut.**

---

## 1. Ce s-a făcut

Prima analiză urbanistică reală a intrat în „Împărțirea apartamentelor": **Luigi Galvani 57**
(641 mp măsurați, UTR M3, Sector 2), pe grupul de probă **„Bloc Eco pentru Medici și
Profesioniști"** (`068008f3-e67e-4090-81d6-d41d07dcf8ae`), terenul
`8f46e444-76f7-4721-b8a5-96634956795f`.

**7 variante, 38 de niveluri, 64 de apartamente.** Două ipoteze de volum, fiecare din câte un
export Urban Analyzer:

| set | regim | Sd | POT / CUT | variante |
|---|---|---|---|---|
| P+5 | maximul admis | 1.596,01 mp | 43,22% / **2,490** (plafon 2,50) | 3 (10, 11, 10 ap.) |
| P+4 | mai jos | 1.439,81 mp | 47,94% / 2,246 | 4 (8, 9, 8, 8 ap.) |

Costurile de intrare, tastate de Liviu în UA: **1.200 €/mp Sd**, **teren 830.000 €**, subsolul
la **70%**. Nu sunt în CSV (acolo sunt doar rezultatele); s-au scos înapoi din formula UA și
au ieșit rotunde pe toate cele șapte variante, deci nu sunt ghicite.

---

## 2. Generatorul, nu SQL scris de mână

`scripts/import-analiza/genereaza-sql.js` + un JSON de configurație. Citește exportul CSV al
lui Liviu și scrie SQL comentat, de rulat manual. **Nu atinge baza de date.**

```
node scripts/import-analiza/genereaza-sql.js scripts/import-analiza/galvani-57.json \
  > db_schema/organizare-apartamente/import-galvani-57.sql
```

Avertismentele ies pe ecran, nu în fișier. **Se citesc înainte de a rula ceva.**

De ce generator: 64 de apartamente transcrise cu ochiul înseamnă că undeva iese o cifră
greșită, și nu în locul unde se vede. Un apartament cu 10 mp în plus schimbă prețul tuturor
celorlalte de pe nivel, fără să pară stricat nimic.

⚠️ **`*.csv` e în `.gitignore`** (linia 27), deci intrarea generatorului nu e în repo.
Fișierele stau la Lucian, în `analize din Urban Analyzer\`. Rularea dintr-un clonaj curat nu e
posibilă fără ele.

**Formatul CSV** e cel din `apartamentual-strategie/produs/urban-analyzer/format-csv-export.md`,
scris de Liviu pe 31 august **special pentru importul ăsta**. O linie = un TIP de apartament,
pe un nivel, într-o variantă. Se citesc counts; expandarea în apartamente individuale se face
în generator.

⭐ **Exportul CSV e nou** și contrazice ce știam: până pe 31 august Urban Analyzer scotea doar
PDF și DXF.

---

## 3. Trei lucruri găsite în date, de dus la Liviu

**(1) Parterul care nu încape, în trei variante din setul P+4.** V1 și V4 pun la parter un
3 camere, al cărui minim din normativ e 66 mp, pe un parter care mai are **58,37 mp** utili
după cele 13 parcaje. V2 pune un 2 camere (minim 52) pe **49,37 mp**. Regula pe care o scrie
chiar spec-ul lui Liviu, `Σ(apt_nr × suprafață) ≤ niv_su_locuinte_mp`, e încălcată de dozarea
din UA.

Generatorul nu repară asta, n-ar putea fără să mintă una din cifre: dă minimele și strigă.
BLOC 5 le scoate din nou după import, ca rânduri `NIVEL DEPĂȘIT`. **În pagină apartamentul
arată „min 66 max 58"**, iar capul variantei zice „859 mp împărțiți din 851".
**Se rezolvă la sursă:** ori se mută un loc de parcare, ori apartamentul de la parter devine
o tipologie mai mică.

**(2) `var_descriere` minte.** În setul P+5, eticheta lui V1 spunea „11 apartamente" pe o
variantă care are 10, iar a lui V2 „10" pe una care are 11: inversate. `var_apartamente_total`
și numărătoarea pe niveluri sunt de acord între ele; doar eticheta nu.
**Generatorul scrie descrierea din counts, nu o copiază.**

**(3) P+4 V1 și V4 au același amestec** (3 × 3 camere, 5 × 3-4 camere) și diferă doar prin
cum stau apartamentele pe etaje. Generatorul le deosebește în descriere („aceleași apartamente
ca la V1, altfel așezate pe etaje"), altfel cele două file arătau identic.

---

## 4. Fișa PDF și volumul KML (migrația 12)

⭐ **Amândouă sunt ale SETULUI, nu ale analizei și nici ale variantei.** Un export UA = un set
= o fișă + un KML, iar KML-ul e **volumul construibil al ipotezei de volum** („5 niveluri"
față de „6 niveluri"), deci toate variantele setului arată la fel în Google Earth.

`db_schema/organizare-apartamente/12-fisa-si-volum-pe-varianta.sql` (**rulată**): patru coloane
nullable pe `analiza_varianta` (`pdf_path`, `pdf_nume`, `kml_path`, `kml_nume`) plus trei tipuri
KML acceptate în bucketul `analize-fise`, care primea doar `application/pdf`.

Aceeași cale scrisă pe 3-4 variante e plata pentru a nu face o tabelă `analiza_set` cu RLS-ul
ei, doar pentru două linkuri. Se întoarce ca avantaj în ziua în care Liviu scoate câte un KML
pe variantă: atunci se scriu pur și simplu căi diferite.

`analiza_teren.pdf_path` **rămâne** și rămâne folosit: e fișa unei analize cu un singur set.
Pagina cade pe ea când variantele n-au una a lor.

**Nu e nevoie de niciun GRANT nou:** `analiza_varianta` are grant de SELECT **pe tabelă**, iar
acela acoperă și coloanele adăugate după el. (Capcana din `profiles`, unde o coloană nouă
rămâne invizibilă, vine de la un VIEW înghețat și de la granturi pe coloane.)

⚠️ **Google Earth nu se deschide printr-un link.** Nu există adresă care să încarce un KML
acolo, nici web, nici desktop. Linkul descarcă fișierul; textul de sub el spune asta.

---

## 5. Ce s-a schimbat în pagină

**(a) Avertismentul de spațiu neîmpărțit tace sub 0,5% scumpire.** Pornea la orice gol, iar pe
unul de 4 mp scria o frază care nu spune nimic: „ponderea lui urcă de la **34%** la **34%**
[…] cu 0.2% mai mare". Un gol de câțiva metri nu e o decizie a grupului, e rotunjirea
suprafețelor din analiză. Pragul stă pe scumpire (`PRAG_SCUMPIRE`), nu pe metri, fiindcă
despre scumpire e fraza. În plus, dacă cele două ponderi se rotunjesc la fel, clauza aceea
cade și rămâne doar prețul.

**(b) Virgulă, nu punct.** `toFixed` scria „0.2%" la doi pași de „2.613 €", care ies prin
`fmt` pe `ro-RO`. Helper nou, `pct()`.

**(c) Documentele setului, sub insignă.** Linia veche `#oaFisa` stătea la **subsolul secțiunii
de variante, sub tabelul de costuri**, și descărca fișa în loc să o deschidă. Mutată sus, sub
„Analiză preliminară Luigi Galvani 57 · 1 septembrie 2026".

⭐ **Prima formă a fost greșită și merită ținută minte.** Arăta doar documentele setului
DESCHIS, cu numele lui în etichetă („Fișa P+5"), tocmai ca schimbarea să se vadă. Lucian a
respins-o imediat ce a văzut-o: **linkurile stau DEASUPRA filelor**, deci apeși jos și se
schimbă ceva sus, în afara privirii. Eticheta nu ajută dacă nimeni nu se uită acolo în clipa
aceea. Acum e câte un rând fix pe set, toate vizibile deodată:

```
P+5   Fișa (PDF)  ·  Volumul (KML)
P+4   Fișa (PDF)  ·  Volumul (KML)
```

**Regula rămasă: nu lega de o filă ceva ce stă deasupra ei.**

Rândurile se construiesc din variante, grupate după prefixul din nume, deci o analiză cu un
singur set dă un rând fără etichetă. Nimic scris de mână pentru Galvani.

**(d) PDF-ul se deschide în filă**, prin adresă semnată (Supabase îl servește `inline`);
**KML-ul se descarcă**, ca blob.

---

## 6. Patru capcane, în ordinea în care au mușcat

**(1) O coloană NULL pe toate rândurile dintr-un `VALUES` e tipizată `text`.** BLOC 2 a crăpat
cu „column `su_comercial_mp` is of type numeric but expression is of type text", iar cursorul
din mesaj arăta spre lista de coloane din `select`, nu spre rândul vinovat. Se repară cu
`null::numeric`. ⚠️ Lovește exact coloanele care descriu excepții (comercial, spațiu comun),
deci un import pe o analiză complicată trece și crapă pe cea simplă. Generatorul scrie acum
`null::numeric` peste tot, prin `sqlNum`.

**(2) Fișier urcat în rădăcina bucketului = invizibil, fără nicio eroare.** Politica de citire
se uită la `(storage.foldername(name))[1]`, care trebuie să fie id-ul grupului; pentru un
fișier din rădăcină e NULL. ⚠️ **Din pagină nu se poate deosebi de „n-a fost urcat"**:
`createSignedUrl` zice `Object not found`, `list()` întoarce vector gol, fiindcă amândouă trec
prin RLS. Se diagnostichează doar din SQL Editor:

```sql
select name, (storage.foldername(name))[1] as primul_folder,
       round((metadata->>'size')::bigint / 1024.0) as kb, metadata->>'mimetype' as tip
  from storage.objects where bucket_id = 'analize-fise' order by name;
```

Ștergerea se face **din dashboard**; din SQL, `storage.protect_delete` refuză cu 42501.
Capcana e ușor de călcat fiindcă folderul nu există până nu îl faci: tragi fișierele peste
bucket și se așază în rădăcină, fără să te întrebe nimic. (S-a întâmplat; cele 4 copii au fost
șterse.)

**(3) `Content-Disposition` nu e expus de CORS.** `createSignedUrl(cale, sec, {download})` chiar
pune `?download=` în adresă, dar din JS **nu se poate verifica** dacă serverul răspunde cu
`attachment`: `fetch(...).headers.get('content-disposition')` întoarce `null` fie că vine, fie
că nu. Pentru un fișier care TREBUIE să se descarce, nu te baza pe el: dacă antetul n-ar veni,
clicul ar duce pagina la un document XML. Se ia blobul cu `.download()` și se dă unui
`<a download>` de aceeași origine. ⚠️ Eliberarea adresei se face **târziu**
(`setTimeout`, 30 s), nu imediat după clic: descărcarea abia a pornit.

**(4) `window.open` după un `await` e oprit de blocatorul de ferestre.** Fereastra se deschide
goală ÎNAINTE de `await`, apoi i se pune `location`.

---

## 7. Starea exactă

**Rulat pe bază, verificat:**
- `import-galvani-57.sql`, blocurile 0-5 și 7. ⚠️ **Blocurile 1-4 NU se mai rulează** din
  fișierul acela: ar face o a doua analiză cu același titlu, iar blocurile următoare, care se
  leagă de titlu, ar scrie fiecare variantă de două ori.
- migrația 12, blocurile 0-3.
- BLOC 5 dă exact cele **trei** rânduri `NIVEL DEPĂȘIT` de la punctul 3(1). Nimic altceva.

**Probat în pagină** (local, `127.0.0.1:8777`, cont Lucian LM): încărcarea, cele șapte file,
prețurile (2.613 / 3.056 / 3.056 / 2.681 / 2.697 / 2.761 / 2.681 €/mp), **tragerea cursorului**
(scrie în `apartament_suprafata`, calea nedovedită până acum), fișa PDF, volumul KML,
avertismentul reparat.

**NEPROBAT:** înscrierea pe un apartament (`apartament_interes`), preferințele de membru,
jurnalul terenului cu dată dată înapoi, documentele terenului, și **cazul „cont care NU e în
grup"**, care trebuie să spună „Doar pentru membrii grupului". Plus un curl cu cheia anonimă
pe `analiza_teren`, care trebuie să întoarcă listă goală.

**Fișierele în storage:** `analize-fise/068008f3-…/` cu `galvani-57-fisa-p5.pdf` (10 MB),
`-fisa-p4.pdf` (10 MB), `-volum-p5.kml`, `-volum-p4.kml`. Toate răspund 200.

**Prețurile din pagină NU sunt cele din fișa UA**, cu −3,2% până la +2,2%. E din modelul
hotărât pe 28 august: pagina reface Sd-ul din suprafața efectiv împărțită, deci o clădire mai
mică chiar costă mai puțin. ⚠️ **Consecință nerezolvată:** parcajele acoperite de la parter nu
se plătesc deloc în pagină, deși UA le construiește la 20%. Ele nu depind de cursoare, depind
de numărul de apartamente, deci sunt cost fix ca subsolul. E aceeași greșeală pe care a
prins-o Lucian pe 28 august, în oglindă. Cere o coloană nouă pe variantă.

---

## 8. Taskul următor

**Aceeași analiză, pe grupul Parcul Circului.** Analiza aparține perechii (grup, teren), deci
se duplică, nu se împarte: al doilea rând `analiza_teren` pe același teren.

Munca e mică: se copiază `galvani-57.json` în `galvani-57-circului.json`, se schimbă **o
linie** (`grup_cauta`), se regenerează, se rulează blocurile 0-5.

Două lucruri de hotărât înainte:

⚠️ **Parcul Circului are ~20 de membri reali.** Analiza le apare tuturor în clipa în care
rulează BLOC 2. Vor vedea și cele trei parteruri cu „min 66 max 58". **Recomandarea dată lui
Lucian: doar setul P+5 acolo**, până se lămurește cu Liviu.

⚠️ **Fișierele trebuie urcate a doua oară**, sub id-ul grupului Parcul Circului. Politica de
citire se uită la primul folder din nume, deci aceleași patru fișiere au nevoie de o copie
acolo. Vezi capcana 6(2).

**Restul, de la handoff-ul din 30 august, rămâne valabil:** proba cu un cont din afara
grupului, și zona unică de note și documente din pagina grupului.

# Importul unei analize din Urban Analyzer

Traduce exportul CSV al lui Liviu într-un script SQL pentru „Împărțirea apartamentelor".
Rulează local, **nu atinge baza de date** și nu trimite nimic nicăieri: scoate un fișier
`.sql` pe care îl rulezi tu, bloc cu bloc, în Supabase SQL Editor.

```
node scripts/import-analiza/genereaza-sql.js scripts/import-analiza/galvani-57.json \
  > db_schema/organizare-apartamente/import-galvani-57.sql
```

Avertismentele ies pe ecran, nu în fișier. **Citește-le înainte de a rula ceva.**

---

## De ce un generator și nu SQL scris de mână

O analiză cu șapte variante înseamnă 64 de apartamente, fiecare cu tipul, intervalul din
normativ și suprafața de pornire. Transcrise cu ochiul, undeva iese o cifră greșită, și nu
în locul unde se vede: un apartament cu 10 mp în plus schimbă prețul tuturor celorlalte de
pe nivel, fără să pară stricat nimic.

Formatul de intrare e cel din `apartamentual-strategie/produs/urban-analyzer/
format-csv-export.md`, deci analiza următoare se importă schimbând doar configurația.

---

## Configurația

Un JSON cu grupul, terenul, cele trei cifre de cost și lista de fișiere CSV. Vezi
`galvani-57.json`, comentat.

### Cum se nimerește terenul

Trei feluri, în ordinea încrederii:

| cheie | ce face |
|---|---|
| `teren_id` | id-ul, scris de mână. Cel mai sigur. |
| `teren_din_grup: true` | ia terenul pus de grup la favorite |
| `teren_cauta` | bucată din titlu, prin ilike. Cel mai fragil. |

⚠️ **Titlul terenului nu conține neapărat adresa.** La Constantin Bosianu 32, terenul e
trecut în platformă după rondul de lângă („Rond Coșbuc"), nu după stradă, deși e chiar
terenul analizei. `teren_cauta: "Bosianu"` nu-l nimerea, iar BLOC 0 raporta corect că nu
există niciun teren. Peste asta vine capcana veche: potrivirea pe text se rupe pe un
diacritic scris altfel și nu spune nimic, întoarce zero rânduri.

⚠️ **Sunt două tabele care leagă un teren de un grup, și contează a doua.** `grup_terenuri`
(cu `removed_at`, scrisă din `grup-terenuri-edit.html`) e goală la grupurile reale.
Legătura vie e **`terenuri_likes_grupuri`**: pe ea o scrie butonul de salvare la grup de pe
pagina terenului, și pe ea o citesc spațiul de lucru (`grupuri.js:204`) și pagina de
împărțire (`organizare-apartamente.js:1524`). Cine se uită în cea greșită vede zero rânduri,
fără nicio eroare, și trage concluzia că terenul nu e în platformă. De aceea BLOC 0 le
listează pe amândouă, nefiltrate: dacă terenul apare doar la „legat vechi", pagina de
împărțire nu-l va găsi și trebuie pus la favorite.

Un grup poate avea mai multe favorite. Dacă ies două, BLOC 1 se oprește cu „more than one
row returned by a subquery"; atunci se scrie `teren_id` de mână. BLOC 0 arată terenul ales,
cu id și titlu, și se citește înainte de BLOC 1.

### Coeficientul Su/Sd nu se scrie de mână

⛔ `coef_su_sd` **nu e raportul Su/Sd**, deși așa se numește. Urban Analyzer taxează
amprenta parcajelor de la parter la 20%, nu la 100%, iar pagina n-are niciun concept de
parcaj: singura pârghie prin care poate intra reducerea aceea e chiar coeficientul.

Până pe 4 septembrie 2026 stătea scris 0,70 în configurație. **Cu 0,70 pagina arăta un
cost de construcție cu 4,4% mai mic decât fișa PDF pe care o descarcă grupul**: 56.000 -
68.000 € pe fiecare variantă Galvani, 42.783 € la Bosianu. Vreo 7.000-8.500 € pe familie.

De acum generatorul îl calculează singur, **per variantă**, înapoi din costul scris de UA:

```
coef = Su × costMp / (cost_constructie − Sd_subsol × costMp × factor_subsol)
```

Subsolul se scade întâi fiindcă pagina îl ține separat, în `subsol_sd_mp`. Iese între
0,657 și 0,678 pe analizele de până acum. **E per variantă, nu pe analiză**: două variante
ale aceleiași clădiri au coeficienți diferiți dacă au număr diferit de parcaje la parter.

Coloana din bază e `numeric(4,3)`, deci trei zecimale; rotunjirea lasă cel mult 0,07%.
`coef_su_sd` din configurație a rămas doar ca plasă, pentru un CSV fără coloana de cost.

---

Cele trei cifre de cost (**euro pe mp Sd**, **prețul terenului**, **procentul subsolului**)
sunt lucruri pe care le tastează arhitectul în Urban Analyzer. **Nu sunt în CSV**, care
exportă rezultate, nu intrări. Se pot scoate înapoi din formula UA:

```
costConstr = (Sd − Sc_parcaje) × costMp
           + Sc_parcaje × costMp × 0,20
           + Sd_subsol  × costMp × factor_subsol
```

La Galvani au ieșit exact: 1.200 €/mp, 830.000 € terenul, subsolul la 70%. Dacă nu ies
cifre rotunde, întreabă, nu ghici.

### Același teren, două grupuri

Se poate, și nu cere nimic special: se copiază configurația, se schimbă `grup_cauta` și
`teren_id`, **titlul rămâne același**. Analiza e a perechii (grup, teren), deci un teren
analizat pentru două grupuri dă două analize care poartă firesc același nume.

⚠️ **Din 2 septembrie 2026** blocurile generate se leagă de analiză prin **titlu ȘI grup**.
Înainte se legau doar prin titlu, iar al doilea import ar fi scris variante și în analiza
primului grup, fără să se plângă nimic: patru variante cu nume duplicate sunt perfect
legale în schemă. Nu rula un import de-al doilea grup cu o versiune veche a scriptului.

Alternativa ar fi fost să lipim o etichetă pe titlu ca să iasă unic, adică să stricăm ce
citește omul pe pagină ca să-i fie comod uneltei.

---

## Ce nu se ia din CSV, deși e acolo

**`var_descriere`.** Eticheta auto din UA poate să nu se potrivească cu varianta. La
Galvani, în setul P+5, eticheta lui V1 spunea „11 apartamente" pe o variantă care are 10,
iar a lui V2 spunea „10" pe una care are 11: erau inversate. Descrierea se scrie din
numărătoarea pe niveluri.

**`niv_su_mp`.** Bugetul de împărțit e `niv_su_locuinte_mp`. Diferă la parter, unde poate
sta comercial.

**Subsolul ca nivel.** Ar intra în desen ca cel mai lat rând (365 mp utili, față de 194 pe
un etaj), iar lățimile din pagină se raportează la nivelul cel mai mare: toate
apartamentele s-ar strânge la jumătate de lățime pentru un rând gol. Sd-ul lui merge în
`analiza_varianta.subsol_sd_mp`, rubrica pentru care a fost făcută.

---

## Suprafața de pornire a fiecărui apartament

Urban Analyzer nu dă suprafața fiecărui apartament, și nici nu trebuie: la faza
preliminară ea nu există, se negociază pe nivel, la proiectare. Ce dă e Su-ul nivelului și
câte apartamente de fiecare tip stau pe el.

`mpu_propus` e propunerea arhitectului, de unde pornește cursorul în pagină: Su-ul
nivelului împărțit proporțional cu mijlocul intervalelor din normativ. Cine iese din
intervalul lui se fixează la capăt, iar restul se reîmparte între ceilalți.

Rămâne scrisă în bază, deci există mereu drum înapoi: se șterge rândul din
`apartament_suprafata` și revine propunerea, fără nicio coloană în plus.

---

## Când dozarea din UA nu încape în propriul ei nivel

Se întâmplă. La Galvani, trei variante din setul P+4 pun la parter un apartament al cărui
**minim din normativ e mai mare decât tot ce a rămas liber pe nivel** după parcaje: un 3
camere (minim 66 mp) pe 58,37 mp utili.

Generatorul nu repară asta: n-ar putea fără să mintă una din cifre. Dă minimele, strigă pe
ecran, iar BLOC 5 din SQL le scoate din nou după import, ca rânduri `NIVEL DEPĂȘIT`.

În pagină, un astfel de apartament arată „min 66 / max 58". **Se rezolvă la sursă**, în
Urban Analyzer: ori se mută un loc de parcare, ori apartamentul de la parter devine mai
mic ca tipologie.

---

## Fișa PDF și volumul KML

Amândouă sunt ale **setului**, nu ale variantei și nici ale analizei: KML-ul e volumul
construibil al ipotezei de volum („5 niveluri" față de „6 niveluri"), deci toate variantele
aceluiași set arată la fel în Google Earth. Stau în `analiza_varianta.pdf_path` și
`kml_path`, adăugate de migrația `db_schema/organizare-apartamente/12-fisa-si-volum-pe-varianta.sql`.
Aceeași cale scrisă pe trei-patru variante e prețul plătit ca să nu apară o tabelă nouă
doar pentru două linkuri.

Se scriu punând `pdf_nume` și `kml_nume` pe fiecare set din configurație. Atunci
generatorul scoate **BLOC 7**, care leagă căile, în locul lui BLOC 1b (fișa unei analize
cu un singur set, ținută pe `analiza_teren`).

Bucketul `analize-fise` e privat și primește încărcări doar de la superadmin, deci
fișierele se urcă de mână din Storage. **Drumul trebuie să înceapă cu id-ul grupului**:
politica de citire se uită la primul folder din nume ca să știe cine are voie să descarce.
Un fișier pus în rădăcină nu se vede de nimeni, fără nicio eroare. BLOC 7 verifică asta la
final, cu o coloană `incepe_cu_grupul`.

**Google Earth nu se deschide printr-un link.** Nu există adresă care să încarce un KML în
Google Earth, nici web, nici desktop. Linkul din pagină descarcă fișierul, iar el se
deschide cu dublu clic sau prin „Import KML" pe earth.google.com. Textul de sub link spune
asta, fiindcă altfel omul apasă și se întreabă unde e harta.

# Handoff — 2 septembrie 2026

**Galvani pe Parcul Circului, superadminul vede împărțirea oricărui grup, cinci reparații în
generator. Totul rulat, comis (`ec5ca6c`, `c2fa56f`), împins și deployat din cPanel.
Confirmat live de Lucian.**

---

## 1. Analiza Galvani e acum și pe Parcul Circului

7 variante, 38 de niveluri, 64 de apartamente, cu fișele PDF și volumele KML legate.
Grup `75a1c2cf-6683-4802-8ff8-1a236661f82f`, teren `8f46e444-…` („Luigi Galvani 57 - 639mp"),
**21 de membri activi**, cel mai mare grup de pe platformă.

Configurația: `scripts/import-analiza/galvani-57-circului.json`.
SQL-ul rulat: `db_schema/organizare-apartamente/import-galvani-57-circului.sql`.
Fișierele urcate a doua oară, sub id-ul acestui grup (politica de citire se uită la primul
folder din nume, deci copia de sub grupul medicilor nu le folosea la nimic).

BLOC 5 a ieșit exact cum fusese calculat dinainte, până la a doua zecimală, plus cele trei
`NIVEL DEPĂȘIT` cunoscute.

### 🔴 Am ignorat, fără să știu, recomandarea sesiunii de ieri

Handoff-ul din 1 septembrie spunea: **pentru Parcul Circului, doar setul P+5**, fiindcă
membrii reali ar vedea parterurile stricate din P+4. Au intrat amândouă seturile. Lucian a
fost avertizat înainte de rulare despre cele trei `NIVEL DEPĂȘIT` și despre cum arată în
pagină („min 66 / max 58"), dar recomandarea din handoff nu i-a fost pusă pe masă, fiindcă
n-o citisem.

**Consecință:** 21 de oameni văd trei variante (P+4 · V1, V2, V4) cu un apartament al cărui
minim din normativ e mai mare decât Su-ul rămas pe nivel după parcaje.

**Reparație, când se decide:** se șterg cele patru variante P+4
(`delete from public.analiza_varianta where grup_id = '75a1c2cf-…' and nume like 'P+4 · %'`,
cascada duce nivelurile și apartamentele), sau se lasă până vine corectura din Urban Analyzer.
**Decizia e a lui Lucian, încă neluată.**

**Lecția:** citește handoff-ul înainte de a executa un task pe care handoff-ul îl descrie.
Recomandarea era scrisă acolo cu ⚠️ și cu motivul.

---

## 2. Superadminul vede împărțirea pe orice teren, al oricărui grup

`db_schema/superadmin-vede-impartirea/` — trei fișiere: diagnosticul, politicile, și de ce
n-ar răspunde funcția.

**Zece politici noi de SELECT**, rulate și verificate: `analiza_teren`, `analiza_varianta`,
`analiza_nivel`, `analiza_apartament`, `apartament_suprafata`, `apartament_interes`,
`grup_membru_preferinte`, `grup_teren_checklist`, `grup_teren_comments`, `teren_atasamente`.

**Zece, nu douăsprezece.** `grup_checklist_notes` avea deja „Super admin full access checklist
notes", iar `grup_membri` are o politică largă. O politică în plus pe o tabelă care are deja
acces nu e inofensivă: cele permisive se combină cu OR, deci cea largă o anulează tăcut pe cea
strictă.

**Al patrulea caz al aceluiași tipar**, după `grup_checklist_files` (25 iulie), `grup_anunturi`
(13 august) și butonul de ștergere a anunțurilor. Superadminul nu e membru nicăieri, deci
primea listă goală, fără eroare.

**Trei alegeri care nu se văd în cod:** politicile cheamă `is_super_admin()` și nu citesc din
`profiles` (o politică ce citește o coloană revocată crapă toată interogarea și ar goli pagina
pentru toți membrii); sunt învelite în `select`, deci se calculează o dată pe interogare;
`to authenticated`, nu `to public`.

**Doar SELECT.** Frontendul nu-i dă superadminului butoanele fondatorului, ca să nu apară
butoane care eșuează tăcut — exact ca butonul de ștergere a anunțurilor, care i se arată din
13 august și nu face nimic.

**Frontend:** trece de ambele porți (membru, și „terenul nu e la favorite"), iar eticheta de
sus scrie **„vezi ca superadmin"** când nu e membru acolo. Detectarea se face prin
`sb.rpc('is_super_admin')`, aceeași funcție pe care o cheamă politicile, deci interfața și baza
nu pot ajunge să spună lucruri diferite. Plasă: dacă RPC-ul dă eroare, cade pe coloana din
`profiles_visible`, cum face restul platformei; interogarea în plus se face **doar pe eroare**,
nu și când funcția răspunde cinstit „nu".

**⚠️ DECIZIE DE PRODUS, DE COMUNICAT.** `grup_membru_preferinte` conține bugete. Oamenii le
scriu crezând că le vede grupul lor; de acum le văd și cei doi superadmini. Se justifică pentru
suport, dar **merită spus utilizatorilor**, la momentul potrivit, exact ca la anunțuri.

### Capcana de deploy, a doua oară

Prima urcare în cPanel n-a dus JS-ul. Simptomul (pagina te oprește la poartă) arată identic cu
„politicile nu merg" și cu „funcția nu răspunde". S-au verificat degeaba amândouă.

**Proba care lămurește din prima:** deschide `https://apartamentual.ro/js/<fișier>.js` și caută
un cuvânt din codul nou. E chiar fișierul de pe server, deci Ctrl+Shift+R nu intră în discuție.
De făcut ASTA înainte de orice diagnostic pe bază.

---

## 3. Rândul cu premisa de cost

Sus pe pagina de împărțire: „Toate costurile din pagină sunt calculate la **1.200 € pe metru
pătrat construit**, un cost de referință din experiența recentă a construcției colaborative.
Costul real se stabilește la ofertarea constructorului și poate să difere."

Cifra se citește din `analiza_teren.cost_constructie_mp`, **nu e scrisă de mână**: un „1200"
hardcodat ar deveni o minciună tăcută la prima analiză cu alt preț. Dacă analiza n-are cifra,
rândul nu apare deloc.

⏳ **Nefăcut, propus și refuzat tacit:** celelalte două premise, prețul terenului și subsolul la
70%, nu apar nicăieri în pagină. Împreună cu cei 1.200 € formează tot ce intră în calcul.

---

## 4. Cinci reparații în generatorul de importuri

`scripts/import-analiza/genereaza-sql.js`. Toate au ieșit din date reale, nu din bănuială.

1. **Terenul se poate da prin `teren_id` sau prin `teren_din_grup`**, nu doar prin bucată de
   titlu. Titlul unui teren nu conține neapărat adresa: cel din Constantin Bosianu 32 e trecut
   „Teren zona Rond Cosbuc, blvd Libertății, Unirii".
2. **BLOC 0 listează amândouă tabelele de legătură**, nefiltrate. Vezi secțiunea 5.
3. **Plasă anti-dublare pe toate cele patru blocuri de inserare.** Vezi secțiunea 6.
4. **Blocurile se leagă de analiză prin titlu ȘI grup.** Același teren analizat pentru două
   grupuri dă două analize cu același titlu, ceea ce e corect; fără filtrul pe grup, importul
   celui de-al doilea ar fi scris variante și în analiza primului. Alternativa ar fi fost o
   etichetă artificială pe titlu, adică stricarea a ceea ce citește omul ca să-i fie comod
   uneltei.
5. **BLOC 5**: grupează pe `va.id` (vezi secțiunea 6), are o secțiune `ANALIZĂ DUBLĂ`, iar
   `mp_de_dat` e suma Su-urilor de locuințe ale nivelurilor, nu `su_total_mp` al variantei,
   care include subsolul și comercialul. Pe o variantă cu subsol ieșea o diferență de zeci de
   mp care arăta a pierdere și nu era nimic.

---

## 5. Capcană nouă: două tabele leagă un teren de un grup

- `grup_terenuri` (are `removed_at`, scrisă din `grup-terenuri-edit.html`) e **goală** la
  grupurile reale.
- **`terenuri_likes_grupuri`** e legătura vie: o scrie butonul de salvare la grup de pe pagina
  terenului, o citesc `grupuri.js:204`, pagina terenului și `organizare-apartamente.js:1524`.

Cine se uită în cea greșită vede zero rânduri, fără nicio eroare, și trage concluzia că terenul
nu e în platformă. A costat două runde. Salvată și în memorie:
`doua-tabele-leaga-teren-de-grup`.

⏳ **Neverificat:** `grup-terenuri-edit.js:222` filtrează terenurile pe `status = 'active'`, dar
valoarea reală pare să fie `'approved'` (`terenuri.js:391` și digestul o folosesc pe aceasta).
Dacă e așa, lista din care legi un teren de un grup e goală mereu, ceea ce ar explica de ce
tabela aceea e nefolosită. **O linie de reparat, dar de confirmat întâi.**

⏳ **Găsit pe drum, neatins:** politica de pe `grup_membri` se cheamă „Authenticated users can
view group members" dar e pusă pe rolul **`public`**. Dacă `qual` e `true`, un vizitator
nelogat poate lista cine e în ce grup. Același tipar cu `profiles_select_all` din 31 iulie.

---

## 6. Incidentul dublurii de la Bosianu, și de ce n-a fost prins

La primul import Bosianu, **BLOC 2 a intrat de două ori**: 4 variante în loc de 2, două purtând
numele „P+3 · V1" și două „P+3 · V2". Blocurile 3 și 4 au rulat apoi o singură dată, dar se
leagă de variante **pe nume**, deci fiecare rând al lor a nimerit două variante: 16 niveluri și
24 de apartamente în loc de 8 și 12.

**Nimic n-a sărit în aer:** patru variante cu nume duplicate sunt perfect legale în schemă.

**BLOC 5 nu l-a prins** fiindcă grupa pe `va.nume`, deci lipea perechile și arăta două rânduri
cu cifre duble în loc de patru rânduri. Adică verificarea se uita la aceleași chei pe care se
legau inserările. **Asta era greșeala de fond.**

Reparat: ștergere după id (`import-bosianu-32-reparare-dublura.sql`, rulat, `DELETE 1`), apoi
plasă pe toate cele patru blocuri. Rulate a doua oară scriu acum `INSERT 0 0`:

| bloc | pe ce se verifică |
|---|---|
| 1 · analiza | `(grup_id, teren_id)` |
| 2 · variantele | `(analiza_id, nume)` |
| 3 · nivelurile | `(varianta_id, nume)` |
| 4 · apartamentele | `(nivel_id, ordine)` |

La apartamente cheia e `ordine`: două de 2 camere pe același etaj au același tip și aceeași
suprafață, nimic altceva nu le separă.

---

## 7. Bosianu 32: în așteptare

**Liviu mai lucrează la analiză**, erau probleme, trimite varianta finală. Importul **nu se
rulează** până atunci.

Ce e gata: `scripts/import-analiza/bosianu-32.json` (grup verificat, `teren_id` fixat pe
`f5d185cc-…`, cele trei cifre de cost deduse și verificate) și SQL-ul generat din el. Când vine
exportul nou, se schimbă calea CSV în JSON și se regenerează, o comandă.

⚠️ **Dacă exportul nou vine cu altă ipoteză de volum** (nu doar P+3), configurația are nevoie
de încă un set, cu prefixul lui, și de o a doua pereche fișă + volum.

**De dus la Liviu, dacă n-a prins-o singur:** în exportul din 1 septembrie, **varianta V2 cere
9 locuri de parcare și așază doar 7** (6 la parter, 1 pe teren, exact ca V1, care are nevoie de
7). Cele trei apartamente de 3-4 camere din V2 cer câte două locuri. Costul e identic pe ambele
variante, deci nici nu s-a plătit ceva în plus. Așa cum e, V2 nu se poate autoriza.

`import-bosianu-32-proba-medici.sql` (proba pe grupul medicilor) a rămas nerulat și
probabil nu mai are rost: analiza se schimbă oricum. ⚠️ Dacă totuși se rulează, terenul corect
(`f5d185cc`, 468 mp) trebuie întâi pus la favoritele grupului de medici; acolo e pus din
greșeală un ALT teren, „Teren Carol - Rond Coşbuc 500mp" (`19725d9d`), care are 500 mp și
scris cu „ş" cu sedilă.

---

## 8. Costul de construcție nu e în CSV

Cele trei cifre (€/mp Sd, prețul terenului, procentul subsolului) se tastează în Urban
Analyzer și **nu se exportă**. Se scot înapoi din formula UA. La Bosianu au ieșit exact
1.200 €/mp, aceeași cifră ca la Galvani, verificată pe amândouă exporturile din aceeași zi.

⚠️ **Formula folosește 15 mp pe loc de parcare, NU `var_sc_per_parcare_parter_mp`** (care era
18 și 19,50 în cele două exporturi): acela e amprenta cu acces, folosită la geometrie, nu la
cost.

⚠️ Ghidul de citire din 2 august scrie **1.000 €/mp**: cifra veche, dinaintea reexportului.
Dacă documentul acela mai circulă la grupul Bosianu, cifrele nu se mai potrivesc.

---

## ⏭️ De făcut în sesiunea următoare

1. 🔴 **Decide ce se face cu setul P+4 de pe Parcul Circului** (secțiunea 1). 21 de oameni văd
   trei variante cu un parter imposibil.
2. **Importul Bosianu**, când trimite Liviu exportul final.
3. ⏳ Confirmă și repară filtrul `status = 'active'` din `grup-terenuri-edit.js:222`.
4. ⏳ Verifică politica de pe `grup_membri`, pusă pe rolul `public`.
5. Comunicarea către utilizatori: superadminii văd preferințele și bugetele.

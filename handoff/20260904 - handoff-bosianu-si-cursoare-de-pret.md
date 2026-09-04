# Handoff, 4 septembrie 2026
## Importul Bosianu 32 și cursoarele de preț pe împărțirea apartamentelor

Cinci commituri, toate împinse: `baf4c0a`, `1524bb7`, `4a4036c`, `1729990`, `40f7488`.
Deploy cPanel făcut de Lucian pentru al doilea (singurul care atinge `frontend/`).

---

## 1. Bosianu 32 e importat și e live

**Terminat.** Grupul „Constantin Bosianu nr. 32, sector 4"
(`597d71bd-2289-468a-8988-d510e1ac55a6`), terenul `f5d185cc-…` („Teren zona Rond Cosbuc,
blvd Libertății, Unirii", 468 mp). Blocurile 0 → 5 rulate curat, BLOC 7 rulat, ambele
variante cu `incepe_cu_grupul = true`.

Analiza: **P+3, două variante, 5 apartamente fiecare.**

| | Su de locuit | cost total | €/mp util |
|---|---|---|---|
| V1 · 5 ap., 18,69 mp liberi la parter | 380,37 mp | 1.261 mii € | 3.485 |
| V2 · 5 ap., 30 mp birouri la parter | 362,07 mp | 1.315 mii € | 3.637 |

Cifrele de intrare: **teren 600.000 €**, **construcție 1.200 €/mp Sd**, `coef_su_sd` **0,657**
la V1 și **0,659** la V2 (vezi secțiunea 3: e per variantă, nu pe analiză).

### Ce s-a schimbat față de exportul din 1 septembrie

UTR **L1b** (era M1), Su de locuit scade de la 419,97 la 380,37, **5 apartamente pe variantă
în loc de 6** (mai mari), parterul primește 8 parcaje în loc de 6. Sd (703,84), POT (39,99%),
CUT (1,504) și suprafața terenului sunt IDENTICE, deci volumul construibil nu s-a schimbat
și KML-ul din 1 septembrie a rămas bun.

✅ **Problema de parcare de la V2 e rezolvată la sursă.** Pe exportul vechi cerea 9 locuri și
așeza 7. Acum V1 cere 8 și așază 9, V2 cere 8 și așază 8. Cele 8 ale lui V2 ies din 6 de la
apartamente plus 2 pentru cei 30 mp de birouri.

### Reexportul „final" din 4 septembrie

Liviu a reexportat cu terenul la 600.000 (era 650.000, prețul din anunț).
Față de exportul din 2 septembrie **diferă DOAR prețul terenului și cele două cifre derivate
din el**; geometria, nivelurile, apartamentele, parcajele și costul de construcție sunt
identice la ultimul caracter. Deci **în bază n-a fost nimic de schimbat**, importul rulat era
deja corect, iar SQL-ul regenerat diferă prin două comentarii și niciun rând de date.

✅ **Fișa din Storage a fost înlocuită și verificată.** Descărcată din
`analize-fise/597d71bd-2289-468a-8988-d510e1ac55a6/`, i s-a calculat amprenta SHA-256 și e
**identică la nivel de octet** cu cea de pe disc (`b1c43a7e…`, 415.746 octeți). Proba s-a făcut
pe amprentă, nu pe mărime, fiindcă cele două versiuni diferă printr-un singur octet.
KML-ul, neatins. Numele a rămas identic, deci căile din bază sunt valabile și BLOC 7 nu s-a
rerulat. **Nu mai există niciun loc unde grupul să vadă 650.000 €.**

---

## 2. Eroarea din generator: comercialul se scădea de două ori

🔴 **`su_mp` pe nivel se scria ca `niv_su_locuinte_mp` MINUS comercialul.** Coloana aceea din
CSV e deja fără comercial, deci era scădere de două ori. La V2, parterul ieșea cu
**`su_mp = −29,61`**, suprafață negativă, perfect legală în schemă și fără nicio eroare.

**De ce n-a lovit până acum:** nicio analiză importată nu avusese comercial, iar zero minus
zero e tot zero. Verificat pe toate CSV-urile: **importurile Galvani din bază sunt curate.**

**Ce vrea de fapt coloana:** Su-ul ÎNTREG al nivelului (locuințe + comercial), fiindcă pagina
scade ea singură `su_comun_mp` (`organizare-apartamente.js:130`) și îl adună înapoi la cost,
spațiul comercial construindu-se chiar dacă nu se împarte.

**De ce n-a prins-o BLOC 5:** verificarea se uita la aceleași chei pe care se lega inserarea.
Al doilea caz al aceluiași tipar, după dublura din 1 septembrie.

### Plase noi în generator

- suma nivelurilor trebuie să dea Su-ul variantei (`SU NEPOTRIVITĂ`)
- niciun nivel cu suprafață negativă (`NIVEL CU SUPRAFAȚĂ NEGATIVĂ`)
- `niv_su_mp` trebuie să fie locuințe + comercial, altfel avertisment
- prețul terenului din configurație diferit de cel din CSV: avertisment pe ecran ȘI scris în
  capul SQL-ului, fiindcă avertismentele se pierd iar SQL-ul se citește peste o lună
- `NIVEL DEPĂȘIT` compară acum cu `su_mp − su_comun_mp`, ca pagina
- descrierea variantei spune ce e la parter când acolo stă comercial; altfel V2 se descria
  „tot parterul intră în parcaje" pe un parter cu 30 mp de birouri

---

## 3. `coef_su_sd` nu e 0,70

⛔ **Nu e Su/Sd, e Su împărțit la Sd-ul care se taxează INTEGRAL**, adică fără partea de
parcaje, care intră la 20%. Valoarea reală e între **0,657 și 0,678** pe tot ce s-a importat.

Cu 0,70, pagina arăta la Bosianu V1 un cost de construcție de 652.063 € acolo unde fișa scrie
694.846: **42.783 € în minus, vreo 8.500 € pe familie.** Bosianu e importat cu 0,657 și acum
platforma și fișa spun același lucru la ultimul euro.

✅ **Formula e confirmată de fișă, nu doar dedusă.** Sub „Cost construcție" fișa tipărește
`547,84 mp × 1.200,00 + 156,00 mp parc. × 20%`. Cei 156 mp sunt 8 × 19,50, adică exact
coloana `var_sc_per_parcare_parter_mp`. **Nota veche care presupunea 15 mp pe loc de parcare
era greșită**: pe exportul din 1 septembrie ambele variante aveau același număr de parcaje,
deci cifra nu se putea deduce, doar ghici.

✅ **REPARAT în aceeași seară, pe toate analizele.** Migrația
`db_schema/organizare-apartamente/13-coeficientul-su-sd.sql`, rulată, `UPDATE 16`: 7 variante
× 2 grupuri Galvani („Bloc Eco pentru Medici și Profesioniști" și „Parcul Circului") plus
cele 2 de la Bosianu. Înainte, pagina arăta între 56.139 și 68.105 € mai puțin decât fișa pe
fiecare variantă; acum diferența maximă e **1.052 €, adică 0,07%**, doar rotunjirea la trei
zecimale. Probat și în pagină, nu doar în SQL Editor: P+5 · V1 la Parcul Circului a urcat de
la 2.613 la 2.685 €/mp.

**Coeficienții, per variantă:** P+5 V1 0,672 · V2 0,677 · V3 0,678; P+4 V1 0,669 · V2 0,668 ·
V3 0,670 · V4 0,669; Bosianu V1 0,657 · V2 0,659. Diferă între ele fiindcă depind de câte
parcaje stau la parter.

✅ **Și cauza e reparată, nu doar efectul.** Generatorul îl calculează de acum singur, per
variantă, înapoi din costul scris de UA în CSV, deci nu mai e o cifră scrisă de mână care se
poate uita la următorul import. Descoperirea care face calculul posibil: la Galvani
`var_sd_total_mp` **nu include subsolul**, deci costul se reconstituie exact scăzând întâi
partea de subsol, pe care pagina o ține separat în `subsol_sd_mp`.

⚠️ **Costurile au CRESCUT pentru 21 de oameni la Parcul Circului.** Nu e o scumpire, e o
subestimare reparată, dar cine și-a notat cifrele vechi merită o vorbă pe grup.

---

## 4. Cursoarele de preț

Două cursoare deasupra tabelului de costuri, în pagina de împărțire: prețul terenului și
prețul construcției pe mp desfășurat.

**Le vede orice membru și oricine poate trage de ele, dar ce trage unul nu ajunge la nimeni.**
Simularea stă într-o variabilă din fila lui de browser: nu se salvează, nu pleacă nimic către
bază, piere la reîncărcare. Decizia, luată cu Lucian: suprafețele apartamentelor sunt o
decizie a grupului și de aceea se scriu în `apartament_suprafata`; prețurile nu se hotărăsc,
se află, din negocierea cu vânzătorul și din oferta constructorului. Dacă fiecare și-ar putea
fixa prețul pentru toți, cinci familii s-ar uita la cinci totaluri diferite fără să vadă de ce.

**Marginile sunt asimetrice la construcție, mai mult loc în sus decât în jos** (−15% / +40%),
fiindcă la Județului Housing costurile au depășit estimările, nu au scăzut sub ele. Un cursor
de preț proiectat prost e o mașină de autoamăgire.

Cât timp cifrele nu mai sunt cele din analiză: panoul se face teracotă, capul variantei poartă
cuvântul „simulare", tabelul primește bandă, apare butonul de revenire. Textul spune, în
amândouă stările, că nu se schimbă nimic pentru ceilalți, că reîncărcarea readuce cifrele
analizei, și că se pot deschide mai multe taburi pentru comparație.

⚠️ **`coef_su_sd` NU primește cursor**, dinadins: nu e un preț, e o proprietate geometrică.
Cine îl mișcă începe să inventeze altă clădire.

Toate cele nouă locuri care citeau prețurile trec acum prin `pretTeren()` și `pretMp()`, deci
nicio cifră din pagină nu poate rămâne în urmă.

**Probat în browser pe analiza reală Galvani de la Parcul Circului:** ambele cursoare,
revenirea, schimbarea variantei cu simularea pornită, lățimea de telefon, consola curată,
zero scrieri către bază.

---

## 5. Caseta de parcare de la parter

Rândul parterului arăta mai scurt decât etajele și restul lui rămânea gol, fără nicio
explicație. Cauza: `analiza_nivel.su_mp` e suprafața utilă rămasă **după** ce parcajele și-au
luat locul. La Galvani P+5 V1, parterul are 4,24 mp utili dintr-un rând care la etaj înseamnă
193,95: **98% gol, pentru 15 mașini**, și arăta ca o greșeală de afișare. Golul e între 53% și
98% pe toate cele 16 variante.

Migrația `14-locurile-de-parcare.sql`, rulată: trei coloane noi pe `analiza_varianta`
(`locuri_parcare_parter`, `_subsol`, `_teren`) plus cifrele pentru variantele existente.

⚠️ **Erau necesare fiindcă `locuri_parcare` e NECESARUL, nu așezarea lui.** Galvani P+5 V2 are
16 necesare, dar 8 la parter și 8 la subsol; Bosianu V1 are 8 necesare și pune 9 (8 la parter,
1 pe teren). Nu se poate deduce, trebuie ținut.

Caseta arată ca una de apartament, fiindcă asta întreabă omul când vede rândul scurt, dar e
punctată și în gri ca spațiul comun: nu se apasă și nu se trage de ea. Scrie numărul de locuri,
iar dedesubt unde stau celelalte („plus 8 la subsol", „plus 1 pe teren").

⚠️ **Lățimea e golul până la nivelul cel mai lat, NU amprenta reală a parcajelor** (8 × 19,50 =
156 mp la Bosianu). Rândul e o scară de suprafață **utilă**; desenată la scara ei, caseta ar
ieși din rând și ar strica comparația dintre niveluri. **De aceea nu se scriu mp pe ea, doar
locuri:** o cifră de mp lângă o casetă care nu e de acea mărime ar minți.

⚠️ Pe telefon unitatea rămâne vizibilă doar pe caseta asta. La un apartament „100" se citește
mp fără să te gândești, fiindcă tot rândul e despre suprafețe; la parcare un „8" singur pare
8 mp, adică fix ce nu e.

---

## 6. Semnal de produs: V2 costă mai mult și dă mai puțin

🟡 **Nu e o eroare, e o problemă de fond, de discutat cu Liviu.** Pentru 54 mii € în plus,
grupul primește cu 18 mp de locuință mai puțin. Singurul lucru care ar justifica V2 sunt cei
30 mp de birouri de la parter, dar pagina nu spune nimic despre ei în afară de
**„Spațiu comun · plătit de toți"**.

Adică un membru citește „plătesc în plus pentru 30 de metri care nu sunt ai nimănui". Nimeni
n-o să aleagă V2 vreodată, și pe bună dreptate.

Cauza: pagina are **un singur concept, `su_comun_mp`**, folosit până acum pentru spațiu comun
adevărat (hol mare, spălătorie), care chiar e plătit de toți și nu produce nimic. Un spațiu
comercial e altceva: se vinde, se închiriază (venit pentru asociație), sau îl cumpără unul
dintre membri. Nici una dintre variante nu încape în „plătit de toți".

**Întrebarea de răspuns înainte de orice cod:** ce se întâmplă, la ApartamenTUal, cu spațiul
comercial de la parter? Din răspuns iese și textul din pagină, și dacă `su_comun_mp` trebuie
despicat în două coloane cu înțelesuri diferite.

---

## 7. Alte lucruri de ținut minte

**Grupul are 5 membri activi și amândouă variantele au fix 5 apartamente.** Se potrivește
exact, dar înseamnă zero rezervă: dacă pleacă cineva rămâne un apartament fără om, iar dacă
vine al șaselea nu are loc în nicio variantă. De spus lui Alin înainte să caute oameni noi.

**Superadminul VEDE împărțirea apartamentelor**, din 2 septembrie
(`db_schema/superadmin-vede-impartirea/2-politici.sql`, zece politici de citire). Politicile
din `1-tabele-analiza-si-interes.sql` cer membru activ și par să spună contrariul; nu te opri
la ele.

**Proba pe pagina de împărțire cere cont de membru sau de superadmin**, plus server local
(`python -m http.server 8123 --directory frontend`, pornit detașat cu `Start-Process`).
Sesiunea Supabase e per-origine, deci pe `127.0.0.1` trebuie logat din nou.

---

## ⏭️ De făcut în sesiunea următoare

1. ✅ Fișa Bosianu a fost înlocuită în Storage și verificată prin amprentă SHA-256, identică
   la nivel de octet cu cea de pe disc. Nimic de făcut.
2. 🟡 **Ce se întâmplă cu spațiul comercial de la parter** (secțiunea 6). Blochează V2.
3. Spune-le celor de la Parcul Circului că s-au corectat costurile în sus (secțiunea 3).
4. Rămase din sesiunile dinainte: setul P+4 de pe Parcul Circului cu parterul imposibil,
   filtrul `status = 'active'` din `grup-terenuri-edit.js:222`, politica de pe `grup_membri`
   pusă pe rolul `public`, comunicarea către utilizatori că superadminii văd preferințele.

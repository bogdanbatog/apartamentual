# Email: „profilul necompletat te blochează, concret"

⚠️ **Textul care se trimite efectiv este cel din
`scripts/emailuri-profil-incomplet/trimite-emailuri-profil.js`** (funcția `continut()`).
Fișierul de față e versiunea de citit și de discutat; dacă schimbi ceva aici, schimbă și acolo.

**Sursa datelor:** `db_schema/emailuri-profil-incomplet/1-lot-pentru-email.sql` — un rând per persoană.
**Lot:** conturi personale vii, cu emailul confirmat, pentru care `profil_complet()` întoarce fals.
Scoși: echipa, conturile de test, cei înregistrați în ultimele 2 zile, dezabonații de la newsletter.

**Ce NU e emailul ăsta:** o campanie de marketing. E explicația unui blocaj real pe care omul
nu are de unde să-l vadă din interfață. De aici vine și tonul: motivul e al lui, nu al nostru.

Câmpuri de merge (numele coloanelor din interogarea 1):

| Câmp | Ce conține | Exemplu |
|---|---|---|
| `{{nume}}` | pseudonimul, cu spațiile tăiate. **Poate fi gol.** | `Andra` |
| `{{inregistrat_text}}` | data contului, în română | `12 martie 2026` |
| `{{nr_lipsuri}}` | câte din cele 6 condiții lipsesc | `3` |
| `{{lipseste_pentru_email}}` | lista de lipsuri, un rând fiecare | vezi mai jos |
| `{{apare_in_utilizatori}}` | `da` / `nu` — **decide o frază întreagă** | `nu` |
| `{{notificat_iulie}}` | `da` / `nu` — decide paragraful de deschidere | `da` |

⚠️ **NU folosi `{{prenume}}`** — `first_name` e gol la toți. Numele vine din `pseudonym`,
iar cine n-are pseudonim primește „Salut," simplu.

---

## Subiect (variante)

1. ✅ **ALES** — `Ce te oprește acum să intri într-un grup`
2. `Îți mai lipsesc {{nr_lipsuri}} lucruri din profil` (acord corect: „un lucru" / „3 lucruri")
3. `Profilul tău a rămas neterminat — și acum contează`

Preheader: `Nu e o formalitate. Fără profil, cererea de intrare nu trece.`

---

## Corp

Salut, {{nume}},

**Deschiderea, în două variante — după `notificat_iulie`:**

*(dacă `nu`)*

> Ți-ai făcut cont pe ApartamenTUal pe {{inregistrat_text}}, dar profilul a rămas
> neterminat. Îți scriem fiindcă acest lucru te va împiedica să faci următoarele
> lucruri pe platformă:

*(dacă `da` — le-am mai scris în iulie, ăsta e al treilea mesaj; trebuie să spună de ce revenim)*

> Ți-am mai scris în iulie despre profilul rămas neterminat. Revenim fiindcă între
> timp s-a schimbat ceva: profilul necompletat te va împiedica să faci următoarele
> lucruri pe platformă:

⚠️ Amândouă deschiderile se termină cu „:”, fiindcă lista de mai jos vine imediat după.
**Nu există titlu de tip „Ce nu poți face acum:”** — a fost scos pe 9 august, suna a
amenințare. Anunțul e ce urmează, nu o etichetă pusă deasupra.

- **Nu te poți alătura niciunui grup.** Cererea de intrare nu trece de platformă,
  oricât de potrivit ai fi pentru grupul acela.
- **Nu poți porni un grup al tău.** Formularul de creare nu ți se va deschide.
- *(doar dacă `apare_in_utilizatori` = `nu`)* **Nu apari în lista de utilizatori** —
  cine caută în aceeași zonă cu tine nu are cum să dea de tine.

Amândouă sunt din august. Când am început platforma, aceste lucruri se puteau face și cu
profilul necompletat, dar am rectificat aspectul acesta pentru transparență și pentru
eficiența scopului platformei: găsirea de grupuri cu care să-ți construiești propriul
apartament.

⚠️ „Amândouă" ține doar cât sunt **două** puncte în listă. Cine n-are pseudonim vede trei,
iar al treilea nu e o regulă din august — pentru el scriptul scrie „Primele două sunt din
august". Se schimbă singur, nu-l atinge.

Punem aceste reguli pentru că un grup de construcție ajunge, în timp, să însemne câțiva
oameni care semnează împreună pentru un teren și pentru un constructor. Înainte de asta
vor să știe cu cine stau de vorbă: în ce oraș cauți, ce fel de apartament, în ce zone.
Fondatorul care aprobă cererile se uită exact la lucrurile astea, iar un profil gol nu-i
spune nimic despre tine.

**La tine mai lipsesc:**

> {{lipseste_pentru_email}}

*(exemplu de cum se completează:*
> *orașul în care cauți*
> *cel puțin o zonă din oraș*
> *cel puțin un interes bifat)*

[ **Completează profilul** ] → `https://apartamentual.ro/profile-edit-new.html`
*durează două-trei minute*

După ce salvezi, se deblochează pe loc: poți cere să intri în orice grup deschis și poți
porni unul al tău.

Dacă între timp nu mai cauți apartament, e perfect în regulă — răspunde la acest email cu
„stop" și nu-ți mai scriem.

Lucian
ApartamenTUal / LTFB Studio

---

## Subsol

> Ai primit acest mesaj pentru că ai un cont pe ApartamenTUal, iar profilul a rămas
> neterminat. Nu e un buletin informativ, e o explicație despre ce nu funcționează în
> contul tău. Dacă nu vrei să mai primești astfel de mesaje, răspunde cu „stop".

Plus antetul `List-Unsubscribe: <mailto:apartamentual@ltfbstudio.ro?subject=stop>`, ca la
celelalte campanii. Nu există flag de consimțământ pe `profiles` (doar la newsletter), deci
cine cere „stop" se notează manual, în `EXCLUSI_IMPLICIT` din script.

---

## Trei lucruri care s-au verificat în cod înainte de a fi scrise aici

1. **„Nu te poți alătura unui grup" — ADEVĂRAT** din 2 august: și politica de INSERT pe
   `grup_membri`, și `accept_group_invitation()` cer `profil_complet()`.
2. **„Nu poți porni un grup" — ADEVĂRAT** din 7 august (politica „Creare grup: doar cu
   profil completat"). De aceea emailul spune explicit că regula e nouă — pentru cineva
   care a încercat în iulie, ea chiar nu exista.
3. **„Nu apari la Utilizatori" — ADEVĂRAT DOAR PENTRU O PARTE.** Filtrul paginii cere
   `pseudonym IS NOT NULL`; cine are pseudonim dar n-are zone sau taguri **apare** în listă,
   deși nu se poate alătura niciunui grup. De asta fraza e condiționată de
   `apare_in_utilizatori`, nu scrisă pentru toți.

## Ce NU spune emailul, deliberat

- Niciun procent de economie, nicăieri.
- Nicio urgență falsă („mai ai X zile"), niciun număr de oameni care „te-au căutat".
- Nu-i cere omului să respecte regulile. Îi arată ce nu-i merge și cât durează să repare.

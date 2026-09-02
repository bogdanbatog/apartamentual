# Campania „memento webinar" (2 septembrie 2026)

Un email către toți cei cu cont viu, cu o zi înainte de a doua ediție a webinarului:
**joi, 3 septembrie 2026, ora 11:30**, online și gratuit.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți**. Doar citește un CSV și trimite emailuri prin API-ul Resend.

- Textul emailului: `email_templates/email-webinar-septembrie.md`
- Bilanțul (cifrele): `db_schema/emailuri-webinar-septembrie/0-bilant.sql`
- Lotul (datele): `db_schema/emailuri-webinar-septembrie/1-lot-pentru-email.sql`
- Scriptul: `trimite-emailuri-webinar-septembrie.js`

---

## Trei lucruri de știut înainte de orice

**1. Un singur fel de email pentru toată lumea.** Campania din 25 august avea patru
variante, fiindcă butonul ei ducea în platformă și conta dacă omul are profilul terminat.
Aici butonul duce la **Luma**, în afara platformei, iar la webinar se intră cu un link,
nu cu un cont. Singura diferență rămâne salutul: cine n-are pseudonim primește „Salut,"
simplu.

**2. Nu putem scoate din lot pe cine s-a înscris deja.** Lista de înscriși e la Luma, nu
în baza noastră. De aceea emailul are în final fraza „Iar dacă te-ai înscris deja, ne
vedem mâine." Nu o scoate: e singurul lucru care ține locul filtrului care lipsește.

**3. Pe 25 august a plecat emailul „ce s-a schimbat pe platformă"** către aceeași listă,
iar el avea deja un P.S. despre acest webinar. Pentru mulți e a doua oară în nouă zile.
E în regulă (unul e anunț, celălalt e memento cu o zi înainte), dar nu mai adăuga un al
treilea înainte de webinar.

⚠️ **Emailul spune „mâine" de șase ori.** Scriptul verifică data și **refuză modul live**
dacă îl rulezi pe 3 septembrie sau după. Dacă trimiterea alunecă, se rescrie textul din
`continut()`, nu se forțează steagul.

---

## Pasul 0 — cifrele, apoi datele

**În ziua trimiterii**, în Supabase → SQL Editor:

1. Rulează `0-bilant.sql`. Te uiți la **lot_final** (câți pleacă) și la **fara_nume_afisat**.
   Dacă lotul e mult mai mare sau mai mic decât te aștepți, oprește-te și verifică de ce.
2. Rulează `1-lot-pentru-email.sql` → Download CSV → salvează-l undeva ușor de scris în
   comandă, de exemplu `C:\Users\lucia\Desktop\webinar-septembrie.csv`.

Scriptul verifică singur că fișierul are coloanele corecte și se oprește la adrese
duplicate sau invalide.

## Pasul 1 — proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-webinar-septembrie\trimite-emailuri-webinar-septembrie.js --csv="C:\Users\lucia\Desktop\webinar-septembrie.csv"
```

Scrie toate emailurile pe disc, în `scripts\emailuri-webinar-septembrie\local\`. Deschide
`local\previzualizare.html` și citește unul cu nume și unul marcat `fara nume`.

**Aici citești și lista de adrese cu ochiul**, nu doar numărul din bilanț. Filtrul din SQL
nu prinde oamenii casei cu Gmail personal (ex. `bogdanbatog@gmail.com`) și nici adresele de
mail temporar. Ce găsești, scoți cu `--fara=a@b.ro,c@d.ro` pe **toate** rulările.

## Pasul 2 — test doar către tine

Cheia API se dă ca variabilă de mediu, în **aceeași** fereastră PowerShell:

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-webinar-septembrie\trimite-emailuri-webinar-septembrie.js --csv="C:\Users\lucia\Desktop\webinar-septembrie.csv" --mod=test
```

Trimite până la 2 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect.
Pe un lot în care toată lumea are pseudonim iese unul singur; nu e defecțiune.

Verifică pe telefon și pe desktop: diacriticele, **butonul (unde duce, chiar apeși pe el)**,
ora de sub buton, linia de „stop".

## Pasul 3 — lotul întreg

```powershell
node scripts\emailuri-webinar-septembrie\trimite-emailuri-webinar-septembrie.js --csv="C:\Users\lucia\Desktop\webinar-septembrie.csv" --mod=live --confirm-trimit
```

Fără `--confirm-trimit` scriptul refuză să pornească. Pauză de 600 ms între trimiteri, ca
să nu lovim limita Resend de 2 cereri/secundă.

La final închide fereastra PowerShell sau rulează `$env:RESEND_API_KEY=""`.

---

## Ce se întâmplă dacă ceva pică

Fiecare trimitere reușită se scrie imediat în `local\trimise-<data>.json` (data e ziua la
ora Bucureștiului, nu UTC). Dacă rulezi din nou aceeași comandă, adresele deja trimise
sunt **sărite** și se reîncearcă doar cele eșuate. De aceea:

> ⚠️ Nu șterge `local\trimise-<data>.json` în ziua campaniei. Fără el, o re-rulare
> trimite a doua oară acelorași oameni.

Erorile 429 și 5xx sunt reîncercate automat de până la 4 ori, cu pauze crescătoare.

## Opțiuni

| Opțiune | Ce face |
|---|---|
| `--mod=dry\|test\|live` | treapta de rulare (implicit `dry`) |
| `--subiect=1\|2\|3` | varianta de subiect (implicit **1**, „Mâine dimineață, la 11:30: primii pași, explicați live") |
| `--doar=a@b.ro,...` | trimite doar către adresele astea din CSV |
| `--fara=a@b.ro,...` | sare peste adresele astea (cine a cerut „stop") |
| `--limita=5` | doar primele N rânduri |
| `--test-email=...` | altă adresă pentru probe |
| `--iesire=cale` | alt folder pentru previzualizări și jurnal |

## De reținut

- **Resend, plan plătit din 24 august 2026:** 50.000 de emailuri pe lună, fără plafon
  zilnic. Ce a rămas e limita de **2 cereri pe secundă** a API-ului, de care se ocupă
  pauza de 600 ms. Nu o scoate.
- **Cheia Resend nu e salvată nicăieri.** Se face una nouă (Sending access) la
  resend.com → API Keys, se pune pe aceeași linie de comandă, și se șterge după campanie.
- **Cine răspunde „stop" se trece de mână** în `EXCLUSI_IMPLICIT`, la începutul scriptului.
- **Ora webinarului stă acum în patru locuri:** `frontend/index.html`, constanta `WEBINAR`
  din `supabase/functions/notify-admins/index.ts`, pagina de pe Luma, și scriptul ăsta.
  Un grep prin repo NU acoperă Luma.
- **Fiecare ediție are alt URL Luma.** Septembrie 2026 = `00ig0k40`.
- Previzualizările și jurnalele conțin adrese reale. Sunt acoperite de `scripts/*/local/`
  în `.gitignore`.
- Răspunsurile ajung pe `apartamentual@ltfbstudio.ro`. Emailul cere explicit întrebări
  înainte de webinar, deci **verifică inboxul în seara asta și mâine dimineață.**

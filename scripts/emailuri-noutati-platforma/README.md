# Campania „ce s-a schimbat pe platformă" (august 2026)

Un email către toți cei cu cont viu: ce s-a construit între 15 și 23 august e deja pe
live, iar cine se loghează azi găsește altă platformă fără să-i fi spus nimeni.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți** — doar citește un CSV și trimite emailuri prin API-ul Resend.

- Textul emailului: `email_templates/email-noutati-platforma-august.md`
- Bilanțul (cifrele): `db_schema/emailuri-noutati-platforma/0-bilant.sql`
- Lotul (datele): `db_schema/emailuri-noutati-platforma/1-lot-pentru-email.sql`
- Scriptul: `trimite-emailuri-noutati.js`

---

## ⚠️ Un lucru de știut înainte de orice

**Cine are profilul neterminat nu ajunge pe homepage.** `frontend/js/nav.js:716-728` îl
redirectează la `/profile-edit-new.html?obligatoriu=1` de pe orice pagină a site-ului.
Un buton „Intră în spațiul tău" l-ar duce în altă parte decât scrie pe el.

De aceea emailul are **două finaluri**, alese după coloana `profil_complet` din CSV:

| `profil_complet` | Buton | Paragraf în plus |
|---|---|---|
| `da` | „Intră în spațiul tău" → apartamentual.ro | doar dacă n-are nici grup, nici teren: ce vede totuși |
| `nu` | „Termină-ți profilul" → profile-edit-new.html | de ce platforma îl trimite înapoi la profil |

Restul emailului e identic pentru toată lumea.

---

## Pasul 0 — cifrele, apoi datele

**În ziua trimiterii**, în Supabase → SQL Editor:

1. Rulează `0-bilant.sql`. Te uiți la trei cifre: **lotul final** (câți pleacă), **cu
   profil incomplet** (câți primesc celălalt final) și **fără grup și fără teren**.
   Dacă lotul e mult mai mare sau mai mic decât te așteptai, oprește-te și verifică de ce.
2. Rulează `1-lot-pentru-email.sql` → Download CSV → salvează-l undeva ușor de scris în
   comandă, de exemplu `C:\Users\lucia\Desktop\noutati-platforma.csv`.

Scriptul verifică singur că fișierul are coloanele corecte, se oprește la adrese
duplicate sau invalide, și **se oprește dacă vreun steag nu e chiar `da` sau `nu`** (o
coloană goală ar trece tăcut drept „nu" și ar trimite tot lotul varianta greșită).

## Pasul 1 — proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-noutati-platforma\trimite-emailuri-noutati.js --csv="C:\Users\lucia\Desktop\noutati-platforma.csv"
```

Scrie toate emailurile pe disc, în `scripts\emailuri-noutati-platforma\local\`. Deschide
`local\previzualizare.html` și citește **câte unul din fiecare fel** — sunt marcate în
listă:

| Marcaj | Ce e diferit în email |
|---|---|
| `profil neterminat` | alt buton („Termină-ți profilul") și paragraful despre redirect |
| `fara grup si teren` | fraza despre ce vede totuși în spațiul de lucru |
| `fara nume` | începe cu „Salut," simplu |
| (fără marcaj) | varianta curată, cea pe care o primesc cei mai mulți |

## Pasul 2 — test doar către tine

Cheia API se dă ca variabilă de mediu, în **aceeași** fereastră PowerShell:

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-noutati-platforma\trimite-emailuri-noutati.js --csv="C:\Users\lucia\Desktop\noutati-platforma.csv" --mod=test
```

Trimite până la 4 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect,
câte unul din fiecare variantă **existentă în lot**. Pe un lot omogen ies mai puține de
patru; nu e defecțiune. Verifică pe telefon și pe desktop: diacriticele, butonul (unde
duce), lista de la „Ce pregătim", linia de „stop".

## Pasul 3 — lotul întreg

```powershell
node scripts\emailuri-noutati-platforma\trimite-emailuri-noutati.js --csv="C:\Users\lucia\Desktop\noutati-platforma.csv" --mod=live --confirm-trimit
```

Fără `--confirm-trimit` scriptul refuză să pornească. Pauză de 600 ms între trimiteri, ca
să nu lovim limita Resend de 2 cereri/secundă.

La final închide fereastra PowerShell sau rulează `$env:RESEND_API_KEY=""`.

---

## Ce se întâmplă dacă ceva pică

Fiecare trimitere reușită se scrie imediat în `local\trimise-<data>.json`. Dacă rulezi din
nou aceeași comandă, adresele deja trimise sunt **sărite** și se reîncearcă doar cele
eșuate. De aceea:

> ⚠️ Nu șterge `local\trimise-<data>.json` în ziua campaniei. Fără el, o re-rulare
> trimite a doua oară acelorași oameni.

Erorile 429 și 5xx sunt reîncercate automat de până la 4 ori, cu pauze crescătoare.

## Opțiuni

| Opțiune | Ce face |
|---|---|
| `--mod=dry\|test\|live` | treapta de rulare (implicit `dry`) |
| `--subiect=1\|2\|3` | varianta de subiect (implicit **1**, „Ce s-a schimbat pe platformă în ultimele două săptămâni") |
| `--doar-completi` | doar cei cu profilul complet |
| `--doar-incompleti` | doar cei cu profilul neterminat (dacă vrei să-i trimiți separat, altă zi) |
| `--doar=a@b.ro,...` | trimite doar către adresele astea din CSV |
| `--fara=a@b.ro,...` | sare peste adresele astea (cine a cerut „stop") |
| `--limita=5` | doar primele N rânduri |
| `--test-email=...` | altă adresă pentru probe |
| `--iesire=cale` | alt folder pentru previzualizări și jurnal |

## De reținut

- **Resend, plan plătit din 24 august 2026: 50.000 de emailuri pe lună, fără plafon
  zilnic.** Un lot de campanie nu are cum să-l atingă, deci nu se mai împarte pe zile.
  ⚠️ Ce a rămas e limita de **2 cereri pe secundă** a API-ului, care nu ține de plan.
  De asta scriptul face pauză de 600 ms între trimiteri. Nu o scoate.
  ⚠️ Campaniile mai vechi din `scripts/emailuri-*/` au încă scris „100 pe zi" în
  README-urile lor. E o cifră depășită, nu o regulă separată.
- **Cine răspunde „stop" se trece de mână** în `EXCLUSI_IMPLICIT`, la începutul
  scriptului. Nu există flag de consimțământ pe `profiles` (doar la newsletter), deci
  opt-out-ul se ține manual, ca la campaniile dinainte.
- **Nu trimite în aceeași zi cu emailul de terenuri noi.** Acela pleacă manual joi 27, cu
  `force`, iar de luni 31 automat în fiecare luni la 10:00. Două emailuri de la noi în
  aceeași zi arată a campanie, nu a anunț.
- **Filtrul de excluderi nu prinde tot.** Blocul `exclusi` din SQL ratează oamenii casei
  cu Gmail personal și adresele temporare. Citește lista exportată cu ochiul înainte de
  trimitere.
- **Interogarea 1 se re-rulează în ziua trimiterii**, nu se refolosește un CSV vechi. Cine
  și-a terminat profilul între timp nu trebuie să primească varianta cu „Termină-ți
  profilul".
- Răspunsurile ajung pe `apartamentual@ltfbstudio.ro`.

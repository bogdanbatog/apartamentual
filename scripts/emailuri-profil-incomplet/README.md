# Campania „profilul necompletat te blochează, concret”

A treia rundă de mesaje către oamenii cu profilul neterminat — dar prima cu un motiv
nou: din august, profilul incomplet chiar **blochează** intrarea și crearea de grupuri.
Primele două runde (17 și 22 iulie) au plecat manual din Trimise, fără jurnal; de asta nu
știm exact cui i-am scris atunci. Runda asta are jurnal propriu.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți** — doar citește un CSV și trimite emailuri prin API-ul Resend.

- Textul emailului: `email_templates/email-profil-incomplet.md`
- Bilanțul (cifrele): `db_schema/emailuri-profil-incomplet/0-bilant.sql`
- Lotul (datele): `db_schema/emailuri-profil-incomplet/1-lot-pentru-email.sql`
- Scriptul: `trimite-emailuri-profil.js`

---

## Pasul 0 — cifrele, apoi datele

**În ziua trimiterii**, în Supabase → SQL Editor:

1. Rulează `0-bilant.sql`. Îți spune câți oameni sunt în lot și, mai important, **câți
   dintre ei apar totuși în lista de Utilizatori** — de asta depinde o frază din email.
   Dacă „lotul final” e mult mai mare sau mai mic decât te așteptai, oprește-te aici și
   verifică de ce, nu trimite.
2. Rulează `1-lot-pentru-email.sql` → Download CSV → salvează-l undeva ușor de scris în
   comandă, de exemplu `C:\Users\lucia\Desktop\profil-incomplet.csv`.

Scriptul verifică singur că fișierul are coloanele corecte și se oprește dacă găsește
adrese duplicate, adrese invalide sau rânduri fără nicio lipsă.

## Pasul 1 — proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-profil-incomplet\trimite-emailuri-profil.js --csv="C:\Users\lucia\Desktop\profil-incomplet.csv"
```

Scrie toate emailurile pe disc, în `scripts\emailuri-profil-incomplet\local\`. Deschide
`local\previzualizare.html` și citește **câte unul din fiecare fel** — sunt marcate în
listă:

| Marcaj | Ce e diferit în email |
|---|---|
| `repetat` | altă deschidere: „ți-am mai scris în iulie, revenim fiindcă s-a schimbat ceva” |
| `nu apare in lista` | are în plus fraza „nu apari în lista de utilizatori” |
| `fara nume` | începe cu „Salut,” simplu, fără nume |

## Pasul 2 — test doar către tine

Cheia API se dă ca variabilă de mediu, în **aceeași** fereastră PowerShell:

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-profil-incomplet\trimite-emailuri-profil.js --csv="C:\Users\lucia\Desktop\profil-incomplet.csv" --mod=test
```

Trimite 3 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect, alese
special ca să fie diferite între ele. Verifică pe telefon și pe desktop: diacriticele,
lista de lipsuri, butonul, linia de „stop”.

## Pasul 3 — lotul întreg

```powershell
node scripts\emailuri-profil-incomplet\trimite-emailuri-profil.js --csv="C:\Users\lucia\Desktop\profil-incomplet.csv" --mod=live --confirm-trimit
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
| `--subiect=1\|2\|3` | varianta de subiect (implicit **1**, „Ce te oprește acum să intri într-un grup”) |
| `--doar-noi` | doar cei cărora NU le-am scris în iulie |
| `--doar-repetati` | doar cei din iulie (dacă vrei să-i trimiți separat, altă zi) |
| `--doar=a@b.ro,...` | trimite doar către adresele astea din CSV |
| `--fara=a@b.ro,...` | sare peste adresele astea (cine a cerut „stop”) |
| `--limita=5` | doar primele N rânduri |
| `--test-email=...` | altă adresă pentru probe |
| `--iesire=cale` | alt folder pentru previzualizări și jurnal |

## De reținut

- **Cine răspunde „stop” se trece de mână** în `EXCLUSI_IMPLICIT`, la începutul
  scriptului. Nu există flag de consimțământ pe `profiles` (doar la newsletter), deci
  opt-out-ul se ține manual, ca la campania de zone.
- Plan gratuit Resend: **100 de emailuri pe zi**. Dacă lotul e mare sau în aceeași zi au
  plecat multe notificări de pe platformă, verifică înainte în Resend. Dacă nu încape,
  împarte pe două zile cu `--doar-noi` / `--doar-repetati`.
- Răspunsurile ajung pe `apartamentual@ltfbstudio.ro`.
- **Interogarea 1 se re-rulează în ziua trimiterii, nu se refolosește un CSV vechi.**
  Cine și-a completat profilul între timp nu trebuie să primească un email care-i spune
  că e blocat. Scriptul prinde cazul evident (rând fără nicio lipsă) și se oprește, dar
  nu poate ști ce s-a schimbat în baza de date după export.
- Fraza „nu apari în lista de utilizatori” **nu e adevărată pentru toți** — vezi cele trei
  verificări din `email_templates/email-profil-incomplet.md`. Coloana
  `apare_in_utilizatori` din CSV e cea care decide; nu o scoate.

# Campania „zonele tale au cerere, dar niciun grup”

Script local de trimitere pentru cei care au bifat zone căutate în care nu s-a pornit
încă niciun grup. Rulează pe calculatorul tău, **nu atinge baza de date, platforma sau
zona de plăți** — doar citește un CSV și trimite emailuri prin API-ul Resend.

- Textul emailului: `email_templates/email-porneste-grup-zona.md`
- Interogarea care produce datele: `db_schema/analiza-zone/5-merge-multizona.sql`
- Scriptul: `trimite-emailuri-zone.js`

---

## Pasul 0 — datele proaspete

Cifrele se schimbă de la o săptămână la alta, deci **în ziua trimiterii**:

1. Supabase → SQL Editor → rulează `db_schema/analiza-zone/5-merge-multizona.sql`
   (doar `SELECT`, nu modifică nimic).
2. Download CSV → salvează fișierul undeva ușor de scris în comandă, de exemplu
   `C:\Users\lucia\Desktop\zone.csv`.

Scriptul verifică singur că fișierul are coloanele corecte și se oprește dacă
găsește adrese duplicate sau invalide.

## Pasul 1 — proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-zone\trimite-emailuri-zone.js --csv="C:\Users\lucia\Desktop\zone.csv"
```

Afișează lista de destinatari cu subiectul fiecăruia și scrie toate emailurile pe disc, în
`scripts\emailuri-zone\local\`. Deschide `local\previzualizare.html` în browser și
citește câteva — mai ales unul cu multe zone și unul cu o singură zonă.

## Pasul 2 — test doar către tine

Cheia API se dă ca variabilă de mediu, în **aceeași** fereastră PowerShell:

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-zone\trimite-emailuri-zone.js --csv="C:\Users\lucia\Desktop\zone.csv" --mod=test
```

Trimite 3 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect: cel cu cele
mai multe zone, cel cu cele mai puține și unul din mijloc. Verifică pe telefon și pe
desktop: diacriticele, butonul, linia de „stop”.

## Pasul 3 — lotul întreg

```powershell
node scripts\emailuri-zone\trimite-emailuri-zone.js --csv="C:\Users\lucia\Desktop\zone.csv" --mod=live --confirm-trimit
```

Fără `--confirm-trimit` scriptul refuză să pornească. Durează în jur de 25 de secunde
(pauză de 600 ms între trimiteri, ca să nu lovim limita Resend de 2 cereri/secundă).

La final închide fereastra PowerShell sau rulează `$env:RESEND_API_KEY=""`, iar cheia
o ștergi din Resend dacă a fost făcută doar pentru campania asta.

---

## Ce se întâmplă dacă ceva pică

Fiecare trimitere reușită se scrie imediat în `local\trimise-<data>.json`. Dacă rulezi
din nou aceeași comandă, adresele deja trimise sunt **sărite** și se reîncearcă doar cele
eșuate. De aceea:

> ⚠️ Nu șterge `local\trimise-<data>.json` în ziua campaniei. Fără el, o re-rulare
> trimite a doua oară acelorași oameni.

Erorile de tip 429 (prea multe cereri) și 5xx sunt reîncercate automat de până la 4 ori,
cu pauze crescătoare.

## Opțiuni

| Opțiune | Ce face |
|---|---|
| `--mod=dry\|test\|live` | treapta de rulare (implicit `dry`) |
| `--subiect=1\|2\|3` | varianta de subiect (implicit **2**, cea aleasă: „În Tineretului nu s-a pornit încă niciun grup”) |
| `--doar=a@b.ro,c@d.ro` | trimite doar către adresele astea din CSV |
| `--fara=a@b.ro` | sare peste adresele astea (cine a cerut „stop”, sau DeathArrow) |
| `--limita=5` | doar primele N rânduri |
| `--test-email=...` | altă adresă pentru probe |
| `--iesire=cale` | alt folder pentru previzualizări și jurnal |

## De reținut

- Plan gratuit Resend: **100 de emailuri pe zi**. Lotul e de ~38, dar dacă în aceeași zi
  s-au trimis multe notificări de pe platformă, verifică înainte în Resend.
- Răspunsurile („stop” sau oameni interesați) ajung pe `apartamentual@ltfbstudio.ro` —
  confirmat că adresa primește și trimite.
- Decizii luate pe 28 iulie 2026, deja puse ca implicit în script: subiectul e **varianta 2**
  (fără cifră în subiect), iar `vlad.radu@gmail.com` („DeathArrow”, 21 de zone bifate fără
  grup) e **scos din lot** — rămân 37 de destinatari. Ambele se văd la începutul scriptului,
  în `SUBIECT_IMPLICIT` și `EXCLUSI_IMPLICIT`.
- Nu există flag de consimțământ pe `profiles` (doar la newsletter), de aceea opt-out-ul
  e prin răspuns cu „stop” + antetul `List-Unsubscribe`. Cine cere „stop” se notează
  manual, deocamdată.
- `first_name` e gol la toți; numele din email vine din `pseudonym`. Poreclele la care nu
  vrem „Salut, X,” se trec în lista `SALUT_FARA_NUME` din script (acum: `DeathArrow`).

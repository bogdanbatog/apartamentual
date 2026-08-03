# Campanie: corecția orei la webinarul din 6 august

Un email scurt către cei înscriși la webinar: ora e **11:30**, nu 10:30.

## De unde iau lista

Înscrierile se fac pe Luma (`https://luma.com/iwbly27g`), nu în baza noastră de
date. Deci lista vine de acolo:

1. Intri pe eveniment → **Guests**
2. **Export / Download CSV**
3. Salvezi fișierul undeva local (nu în repo — are adrese de email)

Scriptul își găsește singur coloanele `email` și `name` din exportul Luma.

## Cum trimit

Trei trepte, în ordinea asta, mereu:

```powershell
# 1. PROBĂ — nu trimite nimic, scrie emailul pe disc ca să-l citești
node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="C:\cale\catre\guests.csv"
# apoi deschizi scripts/emailuri-webinar-ora/local/previzualizare.html

# 2. TEST — un singur email, doar către tine
$env:RESEND_API_KEY="re_xxx"
node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="C:\cale\catre\guests.csv" --mod=test

# 3. LOTUL ÎNTREG
node scripts/emailuri-webinar-ora/trimite-emailuri-webinar.js --csv="C:\cale\catre\guests.csv" --mod=live --confirm-trimit
```

Fiecare trimitere reușită se scrie în `local/trimise-<data>.json`. La o
re-rulare, adresele de acolo sunt sărite automat — nimeni nu primește de două
ori. Nu șterge fișierul.

## Înainte de trimitere: schimbă ora și pe Luma

Pe site ora e corectată (`frontend/index.html`, blocul „Următoarea întâlnire”).
Pagina de eveniment de pe Luma se editează separat, de mână — dacă acolo rămâne
10:30, emailul ăsta contrazice pagina pe care oamenii dau click.

## Dacă cineva răspunde „stop”

Îl treci în `EXCLUSI_IMPLICIT`, sus în script, sau îl scoți la rulare cu
`--fara=adresa@exemplu.ro`. Nu există încă un steag de consimțământ în bază;
opt-out-ul se notează manual.

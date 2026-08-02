# Campania „au apărut terenuri noi în zonele tale”

Script local de trimitere către utilizatorii care au bifat zone în care tocmai am adăugat
terenuri. Rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți** — doar citește un CSV și trimite emailuri prin API-ul Resend.

- Textul emailului: `email_templates/email-terenuri-noi-in-zonele-tale.md`
- Interogările care produc datele: `db_schema/terenuri-noi/`
- Scriptul: `trimite-emailuri-terenuri.js`

Structura e identică cu campania din 28 iulie (`scripts/emailuri-zone/`) — aceleași trei
trepte, același jurnal anti-dublare, aceleași opțiuni.

---

## Pasul 0 — ⚠️ verificarea care contează cel mai mult

Terenurile țin zona ca **text** (`oras` + `cartier`), iar utilizatorii au zonele ca
**legături** către tabela `zones`. Potrivirea se face pe nume. O literă în plus, un spațiu
la final sau un diacritic diferit rup potrivirea **în tăcere**: terenul nu apare la nimeni
și nu primești nicio eroare.

Fișierele din `db_schema/terenuri-noi/` se rulează **în ordinea numerelor**. Fiecare fișier
e o singură interogare: selectezi tot fișierul, apeși Run, iese un tabel. Niciunul nu are
blocuri comentate de decomentat.

1. **`1-ce-terenuri-avem.sql`** — se văd cele 19 adăugate pe 30 iulie? Toate cu status
   `approved`? (Cele `pending` nu se văd public, deci n-au ce căuta într-un email.)
   Verifică și coloana `atentie`: tabela are două date, `created_at` și `data_adaugat`,
   iar dacă s-au despărțit undeva trebuie să știm pe care filtrăm.
2. **`2-potriviri-ratate.sql`** — trebuie să iasă **gol**. Fiecare rând e un teren despre
   care nu va fi anunțat nimeni. Se corectează cartierul din admin, apoi re-rulezi.
3. **`3-zone-cu-terenuri.sql`** — zonele care au primit terenuri și câți oameni le au
   bifate. De aici vezi din start cât de mare poate fi lotul.

## Pasul 1 — lotul

`4-lot-destinatari.sql` → Download CSV → salvează-l undeva ușor de scris în comandă, de
exemplu `C:\Users\lucia\Desktop\terenuri.csv`.

Data e deja pusă pe **30 iulie 2026** (ziua în care au fost adăugate cele 19 terenuri), iar
pragul pe **12 zone bifate**. Ambele se schimbă în blocul `parametri`, la începutul
fișierului.

Opțional, `5-control-cine-a-fost-sarit.sql` îți arată câți oameni au picat pragul de 12
zone, ca să știi ce lași pe masă. Dacă schimbi pragul în 4, schimbă-l și în 5.

## Pasul 2 — proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-terenuri-noi\trimite-emailuri-terenuri.js --csv="C:\Users\lucia\Desktop\terenuri.csv"
```

Scrie toate emailurile pe disc, în `scripts\emailuri-terenuri-noi\local\`. Deschide
`local\previzualizare.html` și citește **cel puțin două**: unul cu mai multe zone și unul
cu o singură zonă (textul diferă între ele).

## Pasul 3 — test doar către tine

Cheia API se dă ca variabilă de mediu, în **aceeași** fereastră PowerShell:

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-terenuri-noi\trimite-emailuri-terenuri.js --csv="C:\Users\lucia\Desktop\terenuri.csv" --mod=test
```

Trimite 3 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect: cel cu cele
mai multe terenuri, cel cu cele mai puține și unul din mijloc. Verifică pe telefon și pe
desktop: diacriticele, butonul, linia de „stop”.

## Pasul 4 — lotul întreg

```powershell
node scripts\emailuri-terenuri-noi\trimite-emailuri-terenuri.js --csv="C:\Users\lucia\Desktop\terenuri.csv" --mod=live --confirm-trimit
```

Fără `--confirm-trimit` scriptul refuză să pornească.

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
| `--subiect=1\|2\|3` | varianta de subiect (implicit **1**: „3 terenuri noi în Tineretului”) |
| `--doar=a@b.ro,c@d.ro` | trimite doar către adresele astea din CSV |
| `--fara=a@b.ro` | sare peste adresele astea (cine a cerut „stop”) |
| `--limita=5` | doar primele N rânduri |
| `--test-email=...` | altă adresă pentru probe |
| `--iesire=cale` | alt folder pentru previzualizări și jurnal |

## De reținut

- **Plan gratuit Resend: 100 de emailuri pe zi.** Campania din 28 iulie a folosit ~39.
  Dacă lotul de acum e mare sau s-au trimis multe notificări de pe platformă în aceeași zi,
  verifică în Resend înainte.
- **Opt-out-ul e manual.** Nu există flag de consimțământ pe `profiles` (doar la newsletter),
  de aceea opt-out-ul e prin răspuns cu „stop” + antetul `List-Unsubscribe`. Cine a cerut
  „stop” după campania din 28 iulie trebuie trecut în `EXCLUSI_IMPLICIT`, la începutul
  scriptului, **înainte** de rularea live.
- **Aceiași oameni au primit un email pe 28 iulie.** Cine intră și acum în lot primește al
  doilea mesaj în mai puțin de o săptămână. Dacă ți se pare des, `--fara=` cu adresele din
  `scripts/emailuri-zone/local/trimise-2026-07-28.json` le scoate.
- `first_name` e gol la toți; numele din email vine din `pseudonym`. Poreclele la care nu
  vrem „Salut, X,” se trec în lista `SALUT_FARA_NUME` din script.
- Previzualizările și jurnalul (`local/`) conțin adrese reale și sunt **negitate**
  (`scripts/*/local/` în `.gitignore`).

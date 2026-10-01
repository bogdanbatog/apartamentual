# Campania „trezire” (octombrie 2026)

Un email personal de la Lucian, la persoana întâi, către cei care **și-au completat
profilul și nu sunt în niciun grup**. Emailul face două lucruri:

1. cere un **răspuns scurt** la întrebarea „ce te-a oprit după înscriere?”
2. îi invită în **grupul general de WhatsApp**

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți**. Doar citește un CSV și trimite emailuri prin API-ul Resend.

- Analiza (cifrele): `db_schema/emailuri-trezire/0-analiza-adormiti.sql`
- Lotul (datele): `db_schema/emailuri-trezire/4-lot-pentru-email.sql`
- Scriptul: `trimite-emailuri-trezire.js` (textul e în funcția `continut()`)

---

## Cine primește și cine nu

| | primește? |
|---|---|
| profil complet, în niciun grup, cont mai vechi de 30 de zile | **da** |
| fondatori, membri activi, cereri în așteptare | nu, sunt deja într-un grup |
| profil incomplet | nu, au campania lor (`emailuri-profil-incomplet`) |
| cont făcut în ultimele 30 de zile | nu (decizia lui Lucian, 1 octombrie). Abia au venit, iar „nu te-am mai văzut de atunci” le-ar suna a reproș |

La analiza din septembrie erau 44 fără grup, cu profil complet, din care 5 proaspeți,
deci **cam 39**. Scriptul refuză singur orice rând cu `cont_din` mai nou de 30 de zile.

---

## Pasul 0: datele, în ziua trimiterii

În Supabase → SQL Editor:

1. (opțional) Rulează `0-analiza-adormiti.sql` ca să vezi cifrele la zi.
2. Rulează `4-lot-pentru-email.sql` → Download CSV → salvează-l, de exemplu,
   `C:\Users\lucia\Desktop\trezire.csv`.

## Pasul 1: proba (nu trimite nimic)

```powershell
cd C:\Users\lucia\proiecte\apartamentual
node scripts\emailuri-trezire\trimite-emailuri-trezire.js --csv="C:\Users\lucia\Desktop\trezire.csv"
```

Deschide `scripts\emailuri-trezire\local\previzualizare.html` și citește unul cu nume și
unul marcat `salut simplu`.

**Citește și lista de adrese cu ochiul.** Filtrul nu prinde oamenii casei cu Gmail
personal și nici adresele de mail temporar. Oamenii pe care îi cunoști personal îi poți
suna în loc să le trimiți email. Ce scoți, scoți cu `--fara=a@b.ro,c@d.ro` pe **toate**
rulările.

## Pasul 2: test doar către tine

```powershell
$env:RESEND_API_KEY="re_..."
node scripts\emailuri-trezire\trimite-emailuri-trezire.js --csv="C:\Users\lucia\Desktop\trezire.csv" --mod=test
```

Trimite până la 2 emailuri către `apartamentual@ltfbstudio.ro`, cu `[TEST]` în subiect.
Verifică pe telefon: diacriticele, **butonul (apasă-l, trebuie să deschidă WhatsApp-ul pe
grupul bun)** și numele expeditorului („Lucian Luță de la ApartamenTUal”).

## Pasul 3: lotul întreg

```powershell
node scripts\emailuri-trezire\trimite-emailuri-trezire.js --csv="C:\Users\lucia\Desktop\trezire.csv" --mod=live --confirm-trimit
```

La final: `$env:RESEND_API_KEY=""` sau închide fereastra.

---

## După trimitere

- **Răspunsurile ajung pe `apartamentual@ltfbstudio.ro`** (constanta `REPLY_TO`). Ele sunt
  rostul emailului, deci verifică inboxul în zilele următoare. Dacă vrei să vină direct la
  tine, schimbă `REPLY_TO` înainte de trimitere.
- **În grupul de WhatsApp e pornit „Aprobă membrii noi”.** Emailul spune „Cererea de
  intrare o aprob eu”, deci cererile trebuie aprobate în zilele de după.
- **Cine răspunde „stop”** se trece de mână în `EXCLUSI_IMPLICIT`.

## De reținut

- Linkul de WhatsApp e scris în **două locuri**: `WHATSAPP_URL` din `frontend/index.html`
  și constanta cu același nume din script. Dacă regenerezi invitația, schimbi în amândouă.
- Jurnalele `local\trimise-*.json` împiedică trimiterea dublă la re-rulare. Nu le șterge.
- Previzualizările și jurnalele conțin adrese reale. Sunt acoperite de `scripts/*/local/`
  în `.gitignore`.

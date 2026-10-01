# Campania „grupul general de WhatsApp” (octombrie 2026)

Un email personal de la Lucian, către **toți cei de pe platformă** (în grup sau nu),
cu invitația în grupul general de WhatsApp. Cei deja într-un grup primesc o frază în
plus: grupul general nu îl înlocuiește pe al lor.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți**. Doar citește un CSV și trimite emailuri prin API-ul Resend.

- Lotul (datele): `db_schema/emailuri-whatsapp-general/1-lot-pentru-email.sql`
- Scriptul: `trimite-emailuri-whatsapp.js` (textul e în funcția `continut()`)

## Cine primește și cine nu

| | primește? |
|---|---|
| cont personal viu, confirmat, nedezabonat, cu sau fără grup, cu sau fără profil complet | **da** |
| cei 41 de la „trezire” (1 octombrie) | nu, au avut deja invitația. Scriptul îi sare din `../emailuri-trezire/local/trimise-*.json` și **refuză să pornească** dacă jurnalele lipsesc |
| agenții (`profesional`), oamenii casei, conturi demo | nu |

## Pașii

1. Supabase → SQL Editor → rulează `1-lot-pentru-email.sql` → Download CSV →
   de exemplu `C:\Users\lucia\Desktop\whatsapp.csv`.
2. Proba (nu trimite nimic):
   ```powershell
   node scripts\emailuri-whatsapp-general\trimite-emailuri-whatsapp.js --csv="C:\Users\lucia\Desktop\whatsapp.csv"
   ```
   Deschide `local\previzualizare.html`. **Citește lista de adrese cu ochiul**
   (oamenii casei cu Gmail personal, participanții de la Județului pe care îi anunți
   oricum personal). Ce scoți, scoți cu `--fara=a@b.ro,c@d.ro` pe **toate** rulările.
3. Test, doar către tine (până la 3 emailuri: în grup, fără grup, salut simplu):
   ```powershell
   $env:RESEND_API_KEY="re_..."
   node scripts\emailuri-whatsapp-general\trimite-emailuri-whatsapp.js --csv="C:\Users\lucia\Desktop\whatsapp.csv" --mod=test
   ```
4. Lotul întreg:
   ```powershell
   node scripts\emailuri-whatsapp-general\trimite-emailuri-whatsapp.js --csv="C:\Users\lucia\Desktop\whatsapp.csv" --mod=live --confirm-trimit
   ```
   La final: `$env:RESEND_API_KEY=""` sau închide fereastra.

## După trimitere

- **În grupul de WhatsApp e pornit „Aprobă membrii noi”**: cererile trebuie aprobate.
- Cine răspunde „stop” se trece de mână în `EXCLUSI_IMPLICIT`.
- Linkul de WhatsApp e scris și în `frontend/index.html` și în campania „trezire”.
  Dacă regenerezi invitația, schimbi peste tot.

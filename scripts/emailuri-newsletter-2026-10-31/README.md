# Newsletterul din 31 octombrie 2026 (Tübingen + grupul de WhatsApp)

Un email personal de la Lucian, cu două lucruri: articolul nou despre Tübingen
(cum vinde primăria teren grupurilor de construcție) și grupul general de
WhatsApp, unde se poate întreba orice.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți**. Doar citește un CSV și trimite emailuri prin API-ul Resend.

- Lotul (datele): `db_schema/emailuri-newsletter-2026-10-31/1-lot-pentru-email.sql`
- Scriptul: `trimite-newsletter.js` (textul e în funcția `continut()`)

## Cine primește și cine nu

| | primește? |
|---|---|
| cont personal viu, confirmat, nedezabonat, cu sau fără grup | **da** |
| abonat la newsletter, confirmat, fără niciun cont | **da** (subsolul spune „te-ai abonat”, nu „ai un cont”) |
| abonat neconfirmat (`pending`) sau dezabonat | nu |
| agenții (`profesional`), oamenii casei, conturi demo | nu |

Fraza despre WhatsApp are două variante:
- **reamintire**: adresa e în jurnalele campaniilor „trezire” (1 oct.) sau
  „whatsapp-general” (2 oct.), deci omul a primit deja invitația;
- **invitație**: ceilalți (conturi noi din octombrie, abonații fără cont).

Nu știm cine e efectiv în grupul de WhatsApp (lista de membri e din 3 oct.),
deci textul merge și pentru cine a intrat deja. Scriptul **refuză să pornească**
dacă lipsesc jurnalele celor două campanii.

## Pașii

1. Supabase → SQL Editor → rulează `1-lot-pentru-email.sql` → Download CSV →
   de exemplu `C:\Users\lucia\Desktop\newsletter.csv`.
2. Proba (nu trimite nimic):
   ```powershell
   node scripts\emailuri-newsletter-2026-10-31\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter.csv"
   ```
   Deschide `local\previzualizare.html`. **Citește lista de adrese cu ochiul**
   (oamenii casei cu Gmail personal, adresele de test abonate la newsletter).
   Ce scoți, scoți cu `--fara=a@b.ro,c@d.ro` pe **toate** rulările.
3. Test, doar către tine (până la 3 emailuri: cont cu reamintire, cont cu
   invitație, abonat fără cont):
   ```powershell
   $env:RESEND_API_KEY="re_..."
   node scripts\emailuri-newsletter-2026-10-31\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter.csv" --mod=test
   ```
4. Lotul întreg:
   ```powershell
   node scripts\emailuri-newsletter-2026-10-31\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter.csv" --mod=live --confirm-trimit
   ```
   La final: `$env:RESEND_API_KEY=""` sau închide fereastra.

## După trimitere

- **În grupul de WhatsApp e pornit „Aprobă membrii noi”**: cererile trebuie aprobate.
- Cine răspunde „stop” se trece de mână în `EXCLUSI_IMPLICIT` (aici și în
  campaniile următoare).
- În Plausible, vizitele din email apar cu sursa `newsletter`.

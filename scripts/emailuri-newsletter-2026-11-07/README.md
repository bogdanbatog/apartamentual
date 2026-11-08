# Newsletterul din 7 noiembrie 2026 (articolul despre asociere)

Un email personal de la Lucian. Subiectul principal: articolul
„Cum se asociază un grup care își construiește blocul”, cu un singur buton.
La final, scurt, linkuri simple în text: Zeppelin #179 (cu UrbanEye și
expoziția de la ARCUB) și cele cinci momente din emisiunea TVR.

Scriptul rulează pe calculatorul tău, **nu atinge baza de date, platforma sau zona de
plăți**. Doar citește un CSV și trimite emailuri prin API-ul Resend.

- Lotul (datele): `db_schema/emailuri-newsletter-2026-11-07/1-lot-pentru-email.sql`
- Scriptul: `trimite-newsletter.js` (textul e în funcția `continut()`)

## Cine primește

Aceleași reguli ca la 31 octombrie (conturi personale vii + abonații confirmați
fără cont), plus: se scot adresele din tabela `emailuri_stop`.

Linkurile duc direct pe `news.html#<slug>` cu `utm_campaign=2026-11-07`, nu pe
paginile `/a/<slug>.html`: acelea pierd parametrii `utm` la redirecționare.

## Pașii

1. Supabase → SQL Editor → rulează `1-lot-pentru-email.sql` → Download CSV →
   de exemplu `C:\Users\lucia\Desktop\newsletter-7-nov.csv`.
2. Proba (nu trimite nimic):
   ```powershell
   node scripts\emailuri-newsletter-2026-11-07\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter-7-nov.csv"
   ```
   Deschide `local\previzualizare.html`. **Citește lista de adrese cu ochiul.**
   Ce scoți, scoți cu `--fara=a@b.ro,c@d.ro` pe **toate** rulările.
3. Test, doar către tine (până la 2 emailuri: cont, abonat fără cont):
   ```powershell
   $env:RESEND_API_KEY="re_..."
   node scripts\emailuri-newsletter-2026-11-07\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter-7-nov.csv" --mod=test
   ```
4. Lotul întreg:
   ```powershell
   node scripts\emailuri-newsletter-2026-11-07\trimite-newsletter.js --csv="C:\Users\lucia\Desktop\newsletter-7-nov.csv" --mod=live --confirm-trimit
   ```
   La final: `$env:RESEND_API_KEY=""` sau închide fereastra.

## După trimitere

- Cine răspunde „stop” se trece în tabela `emailuri_stop` (SQL Editor):
  `insert into public.emailuri_stop (email, nota) values (lower('...'), 'stop la newsletter 7 nov.');`
- În Plausible, vizitele din email apar cu sursa `newsletter`, campania `2026-11-07`.
